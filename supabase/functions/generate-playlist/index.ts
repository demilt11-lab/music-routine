import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Fetch user's listening history for this activity
    const { data: sessions } = await supabaseClient
      .from('listening_sessions')
      .select(`
        *,
        activity_types!inner(name),
        session_songs(
          song_id,
          skipped,
          songs(title, artist, energy, valence, tempo, danceability)
        )
      `)
      .eq('activity_types.name', activityType)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Build context for AI
    const listeningContext = sessions?.map(s => ({
      mood_before: s.mood_before,
      mood_after: s.mood_after,
      songs: s.session_songs?.map((ss: any) => ({
        title: ss.songs?.title,
        artist: ss.songs?.artist,
        skipped: ss.skipped,
        energy: ss.songs?.energy,
        valence: ss.songs?.valence
      }))
    })) || [];

    const systemPrompt = `You are an expert music psychologist and DJ who creates personalized playlists optimized for specific activities and mental states.

Your task is to analyze the user's listening patterns during ${activityType} sessions and generate a perfectly curated playlist.

Consider these factors:
1. Activity type: ${activityType}
2. User's mood preference: ${moodPreference || 'not specified'}
3. Desired energy level: ${energyLevel || 'moderate'}
4. Past listening data: ${JSON.stringify(listeningContext)}

Based on this analysis, recommend 10-15 songs that would be optimal for this activity. For each song, explain why it fits.

IMPORTANT: Return your response in this exact JSON format:
{
  "playlistName": "A creative name for this playlist",
  "description": "A brief description of the playlist vibe",
  "reasoning": "Your analysis of the user's patterns and why these songs are chosen",
  "songs": [
    {
      "title": "Song Title",
      "artist": "Artist Name", 
      "reason": "Why this song fits the activity",
      "suggestedEnergy": 0.7,
      "suggestedMood": "relaxed"
    }
  ]
}`;

    console.log(`Generating playlist for user ${user.id}, activity: ${activityType}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Create an optimized ${activityType} playlist for me based on my listening history and preferences.` 
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
      // Try to extract JSON from the response (it might be wrapped in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        playlistData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      playlistData = {
        playlistName: `${activityType.charAt(0).toUpperCase() + activityType.slice(1)} Mix`,
        description: "AI-generated playlist for your activity",
        reasoning: content,
        songs: []
      };
    }

    // Get activity type ID
    const { data: activityTypeData } = await supabaseClient
      .from('activity_types')
      .select('id')
      .eq('name', activityType)
      .single();

    // Save the generated playlist
    const { data: savedPlaylist, error: saveError } = await supabaseClient
      .from('generated_playlists')
      .insert({
        user_id: user.id,
        activity_type_id: activityTypeData?.id,
        name: playlistData.playlistName,
        description: playlistData.description,
        song_recommendations: playlistData.songs,
        ai_reasoning: playlistData.reasoning
      })
      .select()
      .single();

    if (saveError) {
      console.error("Failed to save playlist:", saveError);
    }

    console.log(`Successfully generated playlist: ${playlistData.playlistName}`);

    return new Response(JSON.stringify({
      success: true,
      playlist: {
        id: savedPlaylist?.id,
        ...playlistData
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
