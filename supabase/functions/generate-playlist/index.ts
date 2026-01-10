import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BiometricInsight {
  optimalTempoRange: { min: number; max: number };
  optimalEnergyRange: { min: number; max: number };
  avgFocusScore: number;
  avgRelaxationScore: number;
  avgHeartRate: number;
  flowStatePercentage: number;
  bestPerformingSongs: { title: string; artist: string; tempo: number; energy: number; focusScore: number }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { activityType, moodPreference, energyLevel } = await req.json();

    if (!activityType) {
      return new Response(JSON.stringify({ error: 'Activity type is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating biometric-enhanced playlist for user ${user.id}, activity: ${activityType}`);

    // Fetch user's listening history for this activity
    const { data: sessions } = await supabaseClient
      .from('listening_sessions')
      .select(`
        *,
        activity_types!inner(name),
        session_songs(
          song_id,
          skipped,
          play_duration_ms,
          songs(id, title, artist, energy, valence, tempo, danceability)
        )
      `)
      .eq('activity_types.name', activityType)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Fetch biometric readings for these sessions
    const sessionIds = sessions?.map(s => s.id) || [];
    const { data: biometricReadings } = await supabaseClient
      .from('biometric_readings')
      .select('*')
      .eq('user_id', user.id)
      .in('session_id', sessionIds.length > 0 ? sessionIds : ['no-sessions']);

    // Calculate biometric insights
    const biometricInsight = calculateBiometricInsights(sessions, biometricReadings, activityType);

    // Build enhanced context for AI
    const listeningContext = sessions?.map(s => {
      const sessionBiometrics = biometricReadings?.filter(b => b.session_id === s.id) || [];
      const avgFocus = sessionBiometrics.length > 0
        ? sessionBiometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / sessionBiometrics.length
        : null;
      const avgRelax = sessionBiometrics.length > 0
        ? sessionBiometrics.reduce((sum, b) => sum + (b.relaxation_score || 0), 0) / sessionBiometrics.length
        : null;
      const avgStress = sessionBiometrics.length > 0
        ? sessionBiometrics.reduce((sum, b) => sum + (b.stress_level || 0), 0) / sessionBiometrics.length
        : null;

      return {
        mood_before: s.mood_before,
        mood_after: s.mood_after,
        biometrics: {
          avgFocusScore: avgFocus ? Math.round(avgFocus) : null,
          avgRelaxationScore: avgRelax ? Math.round(avgRelax) : null,
          avgStressLevel: avgStress ? Math.round(avgStress) : null,
        },
        songs: s.session_songs?.map((ss: any) => ({
          title: ss.songs?.title,
          artist: ss.songs?.artist,
          skipped: ss.skipped,
          energy: ss.songs?.energy,
          valence: ss.songs?.valence,
          tempo: ss.songs?.tempo,
        }))
      };
    }) || [];

    const systemPrompt = `You are an expert music psychologist and DJ who creates personalized playlists optimized for specific activities and mental states. You have access to the user's biometric data including heart rate, stress levels, focus scores, and relaxation metrics.

Your task is to analyze the user's listening patterns AND their physiological responses during ${activityType} sessions to generate a perfectly curated playlist.

## User's Biometric Profile for ${activityType}:
${JSON.stringify(biometricInsight, null, 2)}

## Key Insights from Biometric Data:
- Optimal tempo range that produces best focus: ${biometricInsight.optimalTempoRange.min}-${biometricInsight.optimalTempoRange.max} BPM
- Optimal energy level: ${Math.round(biometricInsight.optimalEnergyRange.min * 100)}-${Math.round(biometricInsight.optimalEnergyRange.max * 100)}%
- Average focus score achieved: ${biometricInsight.avgFocusScore}%
- Average relaxation score: ${biometricInsight.avgRelaxationScore}%
- Flow state achievement rate: ${biometricInsight.flowStatePercentage}%
- Average heart rate during sessions: ${biometricInsight.avgHeartRate} BPM

## Best Performing Songs (highest focus/relaxation based on biometrics):
${biometricInsight.bestPerformingSongs.map(s => `- "${s.title}" by ${s.artist} (${s.tempo} BPM, ${Math.round(s.energy * 100)}% energy, ${s.focusScore}% focus)`).join('\n')}

## Past Listening Sessions with Biometric Data:
${JSON.stringify(listeningContext.slice(0, 5), null, 2)}

## User Preferences:
- Activity: ${activityType}
- Mood preference: ${moodPreference || 'not specified'}
- Desired energy level: ${energyLevel || 'moderate'}

Based on this comprehensive biometric analysis, recommend 10-15 songs that would be OPTIMAL for achieving flow state during ${activityType}. 

CRITICAL: Use the biometric insights to inform your recommendations:
- For focus activities (study, work): Prioritize songs in the optimal tempo range that produced highest focus scores
- For relaxation (sleep, relax): Prioritize lower energy songs that produced highest relaxation scores
- For physical activities (workout, commute): Match tempo to optimal heart rate zones

IMPORTANT: Return your response in this exact JSON format:
{
  "playlistName": "A creative name for this playlist",
  "description": "A brief description mentioning the biometric optimization",
  "reasoning": "Your analysis of the user's biometric patterns and why these songs are physiologically optimized",
  "optimalBpm": 120,
  "optimalEnergy": 0.7,
  "songs": [
    {
      "title": "Song Title",
      "artist": "Artist Name", 
      "reason": "Why this song is biometrically optimal for this activity",
      "suggestedTempo": 120,
      "suggestedEnergy": 0.7,
      "expectedFocusBoost": 15,
      "expectedRelaxationBoost": 10
    }
  ]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Create a biometrically-optimized ${activityType} playlist for me. Use my heart rate, focus scores, and stress patterns to select songs that will help me achieve the best flow state for this activity.` 
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI service requires payment. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON from the AI response
    let playlistData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        playlistData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      playlistData = {
        playlistName: `${activityType.charAt(0).toUpperCase() + activityType.slice(1)} Flow Mix`,
        description: "Biometrically-optimized playlist for your activity",
        reasoning: content,
        optimalBpm: biometricInsight.optimalTempoRange.min + (biometricInsight.optimalTempoRange.max - biometricInsight.optimalTempoRange.min) / 2,
        optimalEnergy: (biometricInsight.optimalEnergyRange.min + biometricInsight.optimalEnergyRange.max) / 2,
        songs: []
      };
    }

    // Get activity type ID
    const { data: activityTypeData } = await supabaseClient
      .from('activity_types')
      .select('id')
      .eq('name', activityType)
      .single();

    // Enhanced playlist data with biometric insights
    const enhancedPlaylistData = {
      ...playlistData,
      biometricInsights: {
        optimalTempoRange: biometricInsight.optimalTempoRange,
        optimalEnergyRange: biometricInsight.optimalEnergyRange,
        expectedFocusScore: biometricInsight.avgFocusScore,
        flowStateTarget: biometricInsight.flowStatePercentage + 10,
      }
    };

    // Save the generated playlist
    const { data: savedPlaylist, error: saveError } = await supabaseClient
      .from('generated_playlists')
      .insert({
        user_id: user.id,
        activity_type_id: activityTypeData?.id,
        name: playlistData.playlistName,
        description: playlistData.description,
        song_recommendations: enhancedPlaylistData.songs,
        ai_reasoning: `${playlistData.reasoning}\n\nBiometric Analysis: Optimal BPM ${playlistData.optimalBpm || 'N/A'}, Energy ${Math.round((playlistData.optimalEnergy || 0.5) * 100)}%`
      })
      .select()
      .single();

    if (saveError) {
      console.error("Failed to save playlist:", saveError);
    }

    console.log(`Successfully generated biometric-enhanced playlist: ${playlistData.playlistName}`);

    return new Response(JSON.stringify({
      success: true,
      playlist: {
        id: savedPlaylist?.id,
        ...enhancedPlaylistData
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error generating playlist:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateBiometricInsights(
  sessions: any[] | null, 
  biometrics: any[] | null,
  activityType: string
): BiometricInsight {
  // Default values based on activity type
  const activityDefaults: Record<string, { tempoMin: number; tempoMax: number; energyMin: number; energyMax: number }> = {
    workout: { tempoMin: 130, tempoMax: 160, energyMin: 0.7, energyMax: 0.95 },
    study: { tempoMin: 100, tempoMax: 130, energyMin: 0.3, energyMax: 0.6 },
    sleep: { tempoMin: 50, tempoMax: 80, energyMin: 0.1, energyMax: 0.3 },
    relax: { tempoMin: 70, tempoMax: 100, energyMin: 0.2, energyMax: 0.5 },
    commute: { tempoMin: 100, tempoMax: 140, energyMin: 0.5, energyMax: 0.8 },
  };

  const defaults = activityDefaults[activityType] || { tempoMin: 100, tempoMax: 140, energyMin: 0.4, energyMax: 0.7 };

  if (!sessions || sessions.length === 0 || !biometrics || biometrics.length === 0) {
    return {
      optimalTempoRange: { min: defaults.tempoMin, max: defaults.tempoMax },
      optimalEnergyRange: { min: defaults.energyMin, max: defaults.energyMax },
      avgFocusScore: 50,
      avgRelaxationScore: 50,
      avgHeartRate: 72,
      flowStatePercentage: 0,
      bestPerformingSongs: [],
    };
  }

  // Calculate averages from biometric data
  const avgFocus = biometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / biometrics.length;
  const avgRelax = biometrics.reduce((sum, b) => sum + (b.relaxation_score || 0), 0) / biometrics.length;
  const avgHr = biometrics.reduce((sum, b) => sum + (b.heart_rate || 72), 0) / biometrics.length;
  const avgStress = biometrics.reduce((sum, b) => sum + (b.stress_level || 30), 0) / biometrics.length;

  // Calculate flow state (high focus, moderate relaxation, low stress)
  const flowReadings = biometrics.filter(b => 
    (b.focus_score || 0) > 60 && 
    (b.relaxation_score || 0) > 40 && 
    (b.stress_level || 100) < 40
  );
  const flowPercentage = (flowReadings.length / biometrics.length) * 100;

  // Analyze which songs produced best biometric responses
  const songPerformance: Map<string, { title: string; artist: string; tempo: number; energy: number; focusScores: number[] }> = new Map();

  sessions.forEach(session => {
    const sessionBiometrics = biometrics.filter(b => b.session_id === session.id);
    if (sessionBiometrics.length === 0) return;

    const sessionAvgFocus = sessionBiometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / sessionBiometrics.length;

    session.session_songs?.forEach((ss: any) => {
      if (!ss.songs) return;
      const songKey = `${ss.songs.title}-${ss.songs.artist}`;
      
      if (!songPerformance.has(songKey)) {
        songPerformance.set(songKey, {
          title: ss.songs.title,
          artist: ss.songs.artist,
          tempo: ss.songs.tempo || 120,
          energy: ss.songs.energy || 0.5,
          focusScores: [],
        });
      }
      
      songPerformance.get(songKey)!.focusScores.push(sessionAvgFocus);
    });
  });

  // Get best performing songs
  const bestSongs = Array.from(songPerformance.values())
    .map(s => ({
      ...s,
      focusScore: s.focusScores.reduce((a, b) => a + b, 0) / s.focusScores.length,
    }))
    .filter(s => s.focusScores.length > 0)
    .sort((a, b) => b.focusScore - a.focusScore)
    .slice(0, 5);

  // Calculate optimal ranges from best performing songs
  let optimalTempoMin = defaults.tempoMin;
  let optimalTempoMax = defaults.tempoMax;
  let optimalEnergyMin = defaults.energyMin;
  let optimalEnergyMax = defaults.energyMax;

  if (bestSongs.length > 0) {
    const tempos = bestSongs.map(s => s.tempo).filter(t => t > 0);
    const energies = bestSongs.map(s => s.energy).filter(e => e > 0);
    
    if (tempos.length > 0) {
      optimalTempoMin = Math.min(...tempos) - 10;
      optimalTempoMax = Math.max(...tempos) + 10;
    }
    
    if (energies.length > 0) {
      optimalEnergyMin = Math.max(0, Math.min(...energies) - 0.1);
      optimalEnergyMax = Math.min(1, Math.max(...energies) + 0.1);
    }
  }

  return {
    optimalTempoRange: { min: Math.round(optimalTempoMin), max: Math.round(optimalTempoMax) },
    optimalEnergyRange: { min: optimalEnergyMin, max: optimalEnergyMax },
    avgFocusScore: Math.round(avgFocus),
    avgRelaxationScore: Math.round(avgRelax),
    avgHeartRate: Math.round(avgHr),
    flowStatePercentage: Math.round(flowPercentage),
    bestPerformingSongs: bestSongs,
  };
}
