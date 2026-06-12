import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get("APP_ORIGIN") ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { hrZone, band, dominantEegBand } from "../_shared/privacy.ts";

interface BiometricState {
  heartRate: number;
  stressLevel: number;
  focusScore: number;
  relaxationScore: number;
  flowState: "none" | "entering" | "in-flow" | "exiting";
  // EEG brainwave data
  eegAlpha?: number;
  eegBeta?: number;
  eegTheta?: number;
  eegGamma?: number;
  eegDelta?: number;
  meditationScore?: number;
}

interface MusicRecommendation {
  action: "increase_tempo" | "decrease_tempo" | "increase_energy" | "decrease_energy" | "maintain" | "change_genre";
  targetTempo: number;
  targetEnergy: number;
  reasoning: string;
  suggestedSongs: Array<{
    title: string;
    artist: string;
    tempo: number;
    energy: number;
    reason: string;
  }>;
  flowPrediction: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Biometric payloads are health data — require an authenticated user.
  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const {
      biometricState,
      activityType,
      currentSong,
      targetFlowState = "in-flow",
      recentReadings = [],
      userPreferences,
    } = await req.json();

    if (!biometricState || !activityType) {
      return new Response(JSON.stringify({ error: 'Biometric state and activity type are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Analyze biometric trends
    const trend = analyzeTrend(recentReadings);
    
    // Calculate optimal targets based on activity
    const targets = getActivityTargets(activityType, targetFlowState);

    // Determine what adjustment is needed
    const adjustment = calculateAdjustment(biometricState, targets, trend);

    // Check if EEG data is available
    const hasEEGData = biometricState.eegAlpha !== undefined;

    // Coarse qualitative summary only — raw band powers never leave our infra
    const alphaBetaRatio = (biometricState.eegAlpha || 0) / ((biometricState.eegBeta || 0) + 0.001);
    const eegSection = hasEEGData ? `
## Brainwave Summary (EEG, qualitative):
- Dominant band: ${dominantEegBand(biometricState)}
- Alpha/Beta balance: ${alphaBetaRatio > 1 ? "relaxation-leaning" : "active-thinking-leaning"}
- Focus indicator: ${biometricState.eegBeta && biometricState.eegTheta ? ((biometricState.eegBeta / (biometricState.eegTheta + (biometricState.eegAlpha || 0) + 0.001)) > 0.7 ? "High" : "Moderate") : "Unknown"}
${biometricState.meditationScore !== undefined ? `- Meditation depth: ${band(biometricState.meditationScore)}` : ''}
` : "";

    // Build user preference section from feedback data
    const preferencesSection = userPreferences ? `
## User Preferences (from thumbs-up/down feedback):
${userPreferences.preferenceDescription}
${userPreferences.likedArtists?.length > 0 ? `- Preferred artists: ${userPreferences.likedArtists.join(", ")}` : ""}
${userPreferences.dislikedArtists?.length > 0 ? `- AVOID these artists: ${userPreferences.dislikedArtists.join(", ")}` : ""}
${userPreferences.likedTempoRange ? `- Preferred tempo range: ${userPreferences.likedTempoRange.min}-${userPreferences.likedTempoRange.max} BPM` : ""}
${userPreferences.likedEnergyRange ? `- Preferred energy range: ${Math.round(userPreferences.likedEnergyRange.min * 100)}-${Math.round(userPreferences.likedEnergyRange.max * 100)}%` : ""}

IMPORTANT: Strongly factor these preferences into your recommendations. Avoid disliked artists entirely. Prioritize songs similar to liked artists and preferred tempo/energy ranges.
` : "";

    const systemPrompt = `You are an AI music therapist specializing in using music to optimize mental states through physiological entrainment. You analyze real-time biometric data${hasEEGData ? " including brainwave activity" : ""} and recommend specific music adjustments to guide users toward their target mental state.

## Current User State (qualitative bands — no raw vitals):
- Heart Rate Zone: ${hrZone(biometricState.heartRate)}
- Stress Level: ${band(biometricState.stressLevel)}
- Focus: ${band(biometricState.focusScore)}
- Relaxation: ${band(biometricState.relaxationScore)}
- Current Flow State: ${biometricState.flowState}
${eegSection}
## Current Song:
${currentSong ? `"${currentSong.title}" by ${currentSong.artist} (${currentSong.tempo || 'unknown'} BPM, ${Math.round((currentSong.energy || 0.5) * 100)}% energy)` : 'No song currently playing'}

## Activity: ${activityType}
## Target State: ${targetFlowState}
${preferencesSection}

## Biometric Trend Analysis:
${trend.description}

## Physiological Targets for ${activityType}:
- Target Heart Rate: ${targets.heartRate.min}-${targets.heartRate.max} BPM
- Target Stress Level: <${targets.maxStress}%
- Target Focus Score: >${targets.minFocus}%
- Optimal Tempo Range: ${targets.tempo.min}-${targets.tempo.max} BPM
- Optimal Energy Range: ${Math.round(targets.energy.min * 100)}-${Math.round(targets.energy.max * 100)}%

## Analysis Needed:
${adjustment.prompt}

Based on this real-time biometric data${hasEEGData ? " and brainwave activity" : ""}, provide immediate music recommendations. Consider:
1. Music tempo affects heart rate through rhythmic entrainment
2. Energy levels affect stress and arousal
3. Familiarity and genre can affect focus and relaxation
4. Gradual changes are more effective than abrupt ones
${hasEEGData ? `5. Alpha wave dominance suggests calm focus - maintain with ambient music
6. Beta wave dominance suggests active thinking - support with moderate tempo
7. Theta wave increase suggests approaching meditation - use slower, ambient tracks
8. High gamma may indicate cognitive overload - consider reducing musical complexity` : ""}

Return your response in this exact JSON format:
{
  "action": "${adjustment.suggestedAction}",
  "targetTempo": 120,
  "targetEnergy": 0.6,
  "reasoning": "Brief explanation of the physiological reasoning${hasEEGData ? " including brainwave analysis" : ""}",
  "suggestedSongs": [
    {
      "title": "Song Name",
      "artist": "Artist Name",
      "tempo": 120,
      "energy": 0.6,
      "reason": "Why this song will help achieve the target state"
    }
  ],
  "flowPrediction": "What flow state this should lead to and in roughly how long"
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
            content: `Analyze my current biometric state and recommend the optimal music adjustment to help me reach ${targetFlowState} during ${activityType}. My current flow state is "${biometricState.flowState}" and I need specific, actionable music recommendations.` 
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
      
      // Return a fallback recommendation
      return new Response(JSON.stringify({
        success: true,
        recommendation: generateFallbackRecommendation(biometricState, activityType, targets, adjustment)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    let recommendation: MusicRecommendation;
    try {
      const jsonMatch = content?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recommendation = JSON.parse(jsonMatch[0]);
      } else {
        recommendation = generateFallbackRecommendation(biometricState, activityType, targets, adjustment);
      }
    } catch {
      recommendation = generateFallbackRecommendation(biometricState, activityType, targets, adjustment);
    }

    return new Response(JSON.stringify({
      success: true,
      recommendation,
      currentState: biometricState,
      targets,
      trend: trend.direction,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error generating recommendation:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function analyzeTrend(readings: BiometricState[]): { direction: string; description: string } {
  if (readings.length < 3) {
    return { direction: "stable", description: "Insufficient data for trend analysis" };
  }

  const recent = readings.slice(-5);
  const older = readings.slice(-10, -5);

  if (older.length === 0) {
    return { direction: "stable", description: "Building baseline data" };
  }

  const recentAvgFocus = recent.reduce((s, r) => s + r.focusScore, 0) / recent.length;
  const olderAvgFocus = older.reduce((s, r) => s + r.focusScore, 0) / older.length;
  const recentAvgStress = recent.reduce((s, r) => s + r.stressLevel, 0) / recent.length;
  const olderAvgStress = older.reduce((s, r) => s + r.stressLevel, 0) / older.length;

  const focusChange = recentAvgFocus - olderAvgFocus;
  const stressChange = recentAvgStress - olderAvgStress;

  if (focusChange > 5 && stressChange < -5) {
    return { direction: "improving", description: "Focus increasing and stress decreasing - approaching flow state" };
  } else if (focusChange < -5 && stressChange > 5) {
    return { direction: "declining", description: "Focus dropping and stress rising - losing flow state" };
  } else if (focusChange > 5) {
    return { direction: "focus_rising", description: "Focus improving but stress stable - continue current approach" };
  } else if (stressChange > 10) {
    return { direction: "stress_rising", description: "Stress increasing significantly - need calming intervention" };
  }

  return { direction: "stable", description: "Metrics stable - minor adjustments may help" };
}

function getActivityTargets(activityType: string, targetFlowState: string) {
  const baseTargets: Record<string, any> = {
    workout: {
      heartRate: { min: 120, max: 160 },
      maxStress: 50,
      minFocus: 50,
      tempo: { min: 130, max: 160 },
      energy: { min: 0.7, max: 0.95 },
    },
    study: {
      heartRate: { min: 60, max: 85 },
      maxStress: 30,
      minFocus: 70,
      tempo: { min: 100, max: 130 },
      energy: { min: 0.3, max: 0.6 },
    },
    sleep: {
      heartRate: { min: 50, max: 65 },
      maxStress: 15,
      minFocus: 20,
      tempo: { min: 50, max: 80 },
      energy: { min: 0.05, max: 0.25 },
    },
    relax: {
      heartRate: { min: 55, max: 75 },
      maxStress: 20,
      minFocus: 40,
      tempo: { min: 70, max: 100 },
      energy: { min: 0.2, max: 0.45 },
    },
    commute: {
      heartRate: { min: 70, max: 100 },
      maxStress: 35,
      minFocus: 55,
      tempo: { min: 100, max: 140 },
      energy: { min: 0.5, max: 0.8 },
    },
  };

  return baseTargets[activityType] || baseTargets.study;
}

function calculateAdjustment(state: BiometricState, targets: any, trend: any) {
  const issues: string[] = [];
  let suggestedAction = "maintain";
  let prompt = "";

  // Check heart rate
  if (state.heartRate > targets.heartRate.max) {
    issues.push("Heart rate too high");
    suggestedAction = "decrease_tempo";
  } else if (state.heartRate < targets.heartRate.min) {
    issues.push("Heart rate too low");
    suggestedAction = "increase_tempo";
  }

  // Check stress
  if (state.stressLevel > targets.maxStress) {
    issues.push("Stress level elevated");
    if (suggestedAction === "maintain") suggestedAction = "decrease_energy";
  }

  // Check focus
  if (state.focusScore < targets.minFocus) {
    issues.push("Focus below target");
    if (suggestedAction === "maintain" && state.stressLevel < targets.maxStress) {
      suggestedAction = "increase_energy";
    }
  }

  // Flow state specific adjustments
  if (state.flowState === "none" && trend.direction !== "improving") {
    issues.push("Not in flow state");
    prompt = "User is not achieving flow. Recommend music that creates gradual physiological entrainment toward the target state.";
  } else if (state.flowState === "in-flow") {
    suggestedAction = "maintain";
    prompt = "User is in flow state. Recommend similar music to maintain this optimal state without disruption.";
  } else if (state.flowState === "exiting") {
    issues.push("Exiting flow state");
    prompt = "User is losing flow. Recommend subtle adjustments to bring them back without jarring changes.";
  } else if (state.flowState === "entering") {
    prompt = "User is entering flow. Continue with current music direction but fine-tune for optimal entry.";
  }

  if (issues.length === 0) {
    prompt = "All metrics within target range. Maintain current music characteristics.";
  } else {
    prompt = `Issues detected: ${issues.join(", ")}. ${prompt}`;
  }

  return { issues, suggestedAction, prompt };
}

function generateFallbackRecommendation(
  state: BiometricState, 
  activityType: string, 
  targets: any, 
  adjustment: any
): MusicRecommendation {
  const currentTempo = 120;
  let targetTempo = currentTempo;
  let targetEnergy = 0.5;

  if (adjustment.suggestedAction === "increase_tempo") {
    targetTempo = Math.min(targets.tempo.max, currentTempo + 10);
    targetEnergy = (targets.energy.min + targets.energy.max) / 2 + 0.1;
  } else if (adjustment.suggestedAction === "decrease_tempo") {
    targetTempo = Math.max(targets.tempo.min, currentTempo - 10);
    targetEnergy = (targets.energy.min + targets.energy.max) / 2 - 0.1;
  } else if (adjustment.suggestedAction === "increase_energy") {
    targetEnergy = Math.min(targets.energy.max, 0.6 + 0.15);
    targetTempo = (targets.tempo.min + targets.tempo.max) / 2;
  } else if (adjustment.suggestedAction === "decrease_energy") {
    targetEnergy = Math.max(targets.energy.min, 0.4 - 0.15);
    targetTempo = (targets.tempo.min + targets.tempo.max) / 2;
  } else {
    targetTempo = (targets.tempo.min + targets.tempo.max) / 2;
    targetEnergy = (targets.energy.min + targets.energy.max) / 2;
  }

  return {
    action: adjustment.suggestedAction as MusicRecommendation["action"],
    targetTempo: Math.round(targetTempo),
    targetEnergy: Math.round(targetEnergy * 100) / 100,
    reasoning: `Based on your current ${state.flowState} state and ${activityType} activity, adjusting music to optimize your physiological response.`,
    suggestedSongs: [
      {
        title: "Ambient Instrumental",
        artist: "Focus Flow",
        tempo: Math.round(targetTempo),
        energy: targetEnergy,
        reason: `Optimized for ${activityType} with tempo to guide heart rate toward target zone`
      }
    ],
    flowPrediction: state.flowState === "in-flow" 
      ? "Maintaining current flow state" 
      : `Expected to reach flow state within 3-5 minutes with gradual music adjustment`
  };
}
