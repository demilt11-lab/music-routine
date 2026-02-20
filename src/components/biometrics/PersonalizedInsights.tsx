import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useDashboardData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  LineChart, Line, Cell
} from "recharts";
import { 
  Sparkles, Music, Zap, Brain, Heart, Target, TrendingUp, 
  Moon, Dumbbell, BookOpen, Coffee, Car, RefreshCw, 
  BarChart3, Activity, Lightbulb, ArrowUp, ArrowDown, Minus
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MusicCharacteristics {
  tempo: number;
  energy: number;
  valence: number;
  danceability: number;
}

interface ActivityMusicProfile {
  activityId: string;
  activityName: string;
  sessionCount: number;
  avgFlowScore: number;
  optimalCharacteristics: MusicCharacteristics;
  characteristicRanges: {
    tempo: { min: number; max: number; optimal: number };
    energy: { min: number; max: number; optimal: number };
    valence: { min: number; max: number; optimal: number };
    danceability: { min: number; max: number; optimal: number };
  };
  biometricCorrelations: {
    tempoToFocus: number;
    energyToRelaxation: number;
    valenceToMood: number;
    danceabilityToFlow: number;
  };
  topPerformingSongs: {
    title: string;
    artist: string;
    flowScore: number;
    characteristics: MusicCharacteristics;
  }[];
  recommendations: string[];
}

interface InsightsSummary {
  totalSessionsAnalyzed: number;
  overallFlowAchievement: number;
  mostEffectiveActivity: string;
  keyFindings: string[];
  musicPreferences: {
    preferredTempoRange: string;
    preferredEnergyLevel: string;
    preferredMood: string;
  };
}

const activityIcons: Record<string, React.ReactNode> = {
  sleep: <Moon className="w-5 h-5" />,
  workout: <Dumbbell className="w-5 h-5" />,
  study: <BookOpen className="w-5 h-5" />,
  relax: <Coffee className="w-5 h-5" />,
  commute: <Car className="w-5 h-5" />,
};

const activityColors: Record<string, string> = {
  sleep: "hsl(var(--chart-1))",
  workout: "hsl(var(--chart-2))",
  study: "hsl(var(--chart-3))",
  relax: "hsl(var(--chart-4))",
  commute: "hsl(var(--chart-5))",
};

function getCorrelationIndicator(value: number) {
  if (value > 0.3) return { icon: <ArrowUp className="w-3 h-3 text-green-500" />, label: "Strong positive" };
  if (value > 0) return { icon: <ArrowUp className="w-3 h-3 text-green-400" />, label: "Positive" };
  if (value > -0.3) return { icon: <Minus className="w-3 h-3 text-muted-foreground" />, label: "Neutral" };
  return { icon: <ArrowDown className="w-3 h-3 text-red-400" />, label: "Negative" };
}

export function PersonalizedInsights() {
  const { data: user } = useCurrentUser();
  const [profiles, setProfiles] = useState<ActivityMusicProfile[]>([]);
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);

  const calculateInsights = useCallback(async () => {
    if (!user) {
      setError("Not authenticated");
      return;
    }

    // Fetch sessions with songs and biometrics
    const { data: sessions, error: sessionsError } = await supabase
      .from("listening_sessions")
      .select(`
        *,
        activity_types(id, name),
        session_songs(
          id,
          song_id,
          skipped,
          play_duration_ms,
          songs(id, title, artist, tempo, energy, valence, danceability)
        )
      `)
      .eq("user_id", user.id)
      .order("started_at", { ascending: false });

    if (sessionsError) {
      setError(sessionsError.message);
      return;
    }

    const { data: biometrics } = await supabase
      .from("biometric_readings")
      .select("*")
      .eq("user_id", user.id);

    // Group by activity and calculate profiles
    const activityMap = new Map<string, {
      sessions: typeof sessions;
      biometrics: typeof biometrics;
      songs: any[];
    }>();

    sessions?.forEach((session) => {
      const activityId = session.activity_type_id;
      const activityName = session.activity_types?.name || "unknown";
      
      if (!activityMap.has(activityId)) {
        activityMap.set(activityId, { 
          sessions: [], 
          biometrics: [], 
          songs: [],
        });
      }
      
      const entry = activityMap.get(activityId)!;
      entry.sessions.push(session);
      
      // Get session biometrics
      const sessionBiometrics = biometrics?.filter((b) => b.session_id === session.id) || [];
      entry.biometrics.push(...sessionBiometrics);
      
      // Get session songs with their characteristics
      session.session_songs?.forEach((ss: any) => {
        if (ss.songs && !ss.skipped) {
          const avgFocus = sessionBiometrics.length > 0
            ? sessionBiometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / sessionBiometrics.length
            : 50;
          const avgRelax = sessionBiometrics.length > 0
            ? sessionBiometrics.reduce((sum, b) => sum + (b.relaxation_score || 0), 0) / sessionBiometrics.length
            : 50;
          const avgStress = sessionBiometrics.length > 0
            ? sessionBiometrics.reduce((sum, b) => sum + (b.stress_level || 0), 0) / sessionBiometrics.length
            : 30;
          
          const flowScore = Math.round((avgFocus * 0.4 + avgRelax * 0.3 + (100 - avgStress) * 0.3));
          
          entry.songs.push({
            ...ss.songs,
            flowScore,
            focusScore: avgFocus,
            relaxationScore: avgRelax,
          });
        }
      });
    });

    // Calculate activity profiles
    const calculatedProfiles: ActivityMusicProfile[] = [];
    let totalFlow = 0;
    let totalSessions = 0;
    
    activityMap.forEach((data, activityId) => {
      const activityName = data.sessions[0]?.activity_types?.name || "unknown";
      const songs = data.songs;
      
      if (songs.length === 0) return;
      
      // Calculate optimal characteristics (weighted by flow score)
      const totalWeight = songs.reduce((sum, s) => sum + s.flowScore, 0);
      
      const optimalTempo = songs.reduce((sum, s) => sum + (s.tempo || 100) * s.flowScore, 0) / totalWeight;
      const optimalEnergy = songs.reduce((sum, s) => sum + (s.energy || 0.5) * s.flowScore, 0) / totalWeight;
      const optimalValence = songs.reduce((sum, s) => sum + (s.valence || 0.5) * s.flowScore, 0) / totalWeight;
      const optimalDanceability = songs.reduce((sum, s) => sum + (s.danceability || 0.5) * s.flowScore, 0) / totalWeight;
      
      // Calculate ranges
      const tempos = songs.map((s) => s.tempo).filter(Boolean);
      const energies = songs.map((s) => s.energy).filter(Boolean);
      const valences = songs.map((s) => s.valence).filter(Boolean);
      const danceabilities = songs.map((s) => s.danceability).filter(Boolean);
      
      // Calculate correlations (simplified Pearson correlation)
      const calculateCorrelation = (xs: number[], ys: number[]) => {
        if (xs.length < 2) return 0;
        const n = xs.length;
        const sumX = xs.reduce((a, b) => a + b, 0);
        const sumY = ys.reduce((a, b) => a + b, 0);
        const sumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0);
        const sumX2 = xs.reduce((sum, x) => sum + x * x, 0);
        const sumY2 = ys.reduce((sum, y) => sum + y * y, 0);
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        return denominator === 0 ? 0 : numerator / denominator;
      };
      
      const focusScores = songs.map((s) => s.focusScore);
      const relaxScores = songs.map((s) => s.relaxationScore);
      const flowScores = songs.map((s) => s.flowScore);
      
      // Generate recommendations based on data
      const recommendations: string[] = [];
      
      if (optimalTempo > 120) {
        recommendations.push(`Faster tempo tracks (${Math.round(optimalTempo)} BPM) boost your ${activityName} performance`);
      } else if (optimalTempo < 90) {
        recommendations.push(`Slower, calmer tracks (~${Math.round(optimalTempo)} BPM) help you during ${activityName}`);
      }
      
      if (optimalEnergy > 0.7) {
        recommendations.push("High-energy music correlates with your best sessions");
      } else if (optimalEnergy < 0.4) {
        recommendations.push("Low-energy, ambient tracks work best for you");
      }
      
      if (optimalValence > 0.6) {
        recommendations.push("Upbeat, positive-sounding music improves your flow state");
      } else if (optimalValence < 0.4) {
        recommendations.push("Minor key or melancholic music helps you focus");
      }
      
      const avgFlowScore = songs.reduce((sum, s) => sum + s.flowScore, 0) / songs.length;
      totalFlow += avgFlowScore * data.sessions.length;
      totalSessions += data.sessions.length;
      
      // Get top performing songs
      const topSongs = [...songs]
        .sort((a, b) => b.flowScore - a.flowScore)
        .slice(0, 5)
        .map((s) => ({
          title: s.title,
          artist: s.artist,
          flowScore: s.flowScore,
          characteristics: {
            tempo: s.tempo || 100,
            energy: s.energy || 0.5,
            valence: s.valence || 0.5,
            danceability: s.danceability || 0.5,
          },
        }));
      
      calculatedProfiles.push({
        activityId,
        activityName,
        sessionCount: data.sessions.length,
        avgFlowScore: Math.round(avgFlowScore),
        optimalCharacteristics: {
          tempo: Math.round(optimalTempo),
          energy: optimalEnergy,
          valence: optimalValence,
          danceability: optimalDanceability,
        },
        characteristicRanges: {
          tempo: {
            min: Math.min(...tempos, 60),
            max: Math.max(...tempos, 180),
            optimal: Math.round(optimalTempo),
          },
          energy: {
            min: Math.min(...energies, 0),
            max: Math.max(...energies, 1),
            optimal: optimalEnergy,
          },
          valence: {
            min: Math.min(...valences, 0),
            max: Math.max(...valences, 1),
            optimal: optimalValence,
          },
          danceability: {
            min: Math.min(...danceabilities, 0),
            max: Math.max(...danceabilities, 1),
            optimal: optimalDanceability,
          },
        },
        biometricCorrelations: {
          tempoToFocus: calculateCorrelation(tempos, focusScores.slice(0, tempos.length)),
          energyToRelaxation: calculateCorrelation(energies, relaxScores.slice(0, energies.length)),
          valenceToMood: calculateCorrelation(valences, flowScores.slice(0, valences.length)),
          danceabilityToFlow: calculateCorrelation(danceabilities, flowScores.slice(0, danceabilities.length)),
        },
        topPerformingSongs: topSongs,
        recommendations,
      });
    });

    setProfiles(calculatedProfiles);
    
    // Calculate overall summary
    if (calculatedProfiles.length > 0) {
      const bestActivity = calculatedProfiles.reduce((best, p) => 
        p.avgFlowScore > best.avgFlowScore ? p : best
      );
      
      const avgTempo = calculatedProfiles.reduce((sum, p) => sum + p.optimalCharacteristics.tempo, 0) / calculatedProfiles.length;
      const avgEnergy = calculatedProfiles.reduce((sum, p) => sum + p.optimalCharacteristics.energy, 0) / calculatedProfiles.length;
      const avgValence = calculatedProfiles.reduce((sum, p) => sum + p.optimalCharacteristics.valence, 0) / calculatedProfiles.length;
      
      const keyFindings: string[] = [];
      
      // Generate key findings
      if (bestActivity.avgFlowScore > 70) {
        keyFindings.push(`You achieve excellent flow state (${bestActivity.avgFlowScore}%) during ${bestActivity.activityName}`);
      }
      
      const tempoVariance = calculatedProfiles.reduce((sum, p) => 
        sum + Math.abs(p.optimalCharacteristics.tempo - avgTempo), 0
      ) / calculatedProfiles.length;
      
      if (tempoVariance < 15) {
        keyFindings.push(`You prefer consistent tempo (~${Math.round(avgTempo)} BPM) across activities`);
      } else {
        keyFindings.push("Your optimal tempo varies significantly by activity - adaptive music selection recommended");
      }
      
      if (avgEnergy > 0.6) {
        keyFindings.push("Overall, you respond better to energetic music");
      } else if (avgEnergy < 0.4) {
        keyFindings.push("You tend to perform better with calm, low-energy music");
      }
      
      setSummary({
        totalSessionsAnalyzed: totalSessions,
        overallFlowAchievement: Math.round(totalFlow / Math.max(totalSessions, 1)),
        mostEffectiveActivity: bestActivity.activityName,
        keyFindings,
        musicPreferences: {
          preferredTempoRange: `${Math.round(avgTempo - 15)}-${Math.round(avgTempo + 15)} BPM`,
          preferredEnergyLevel: avgEnergy > 0.6 ? "High" : avgEnergy > 0.4 ? "Medium" : "Low",
          preferredMood: avgValence > 0.6 ? "Upbeat" : avgValence > 0.4 ? "Balanced" : "Calm/Melancholic",
        },
      });
      
      setSelectedActivity(calculatedProfiles[0]?.activityId || null);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await calculateInsights();
    setIsLoading(false);
  }, [calculateInsights]);

  useEffect(() => {
    if (user) refresh();
  }, [refresh, user]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Personalized Music Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={refresh}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (profiles.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="font-semibold mb-2">No Insights Yet</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Complete listening sessions with biometric tracking to discover your optimal music profile for each activity.
        </p>
      </Card>
    );
  }

  const selectedProfile = profiles.find((p) => p.activityId === selectedActivity);

  // Prepare comparison chart data
  const comparisonData = profiles.map((p) => ({
    activity: p.activityName.charAt(0).toUpperCase() + p.activityName.slice(1),
    tempo: Math.round(p.optimalCharacteristics.tempo / 2), // Normalized for display
    energy: Math.round(p.optimalCharacteristics.energy * 100),
    valence: Math.round(p.optimalCharacteristics.valence * 100),
    danceability: Math.round(p.optimalCharacteristics.danceability * 100),
    flowScore: p.avgFlowScore,
  }));

  // Radar chart data for selected activity
  const radarData = selectedProfile ? [
    { subject: 'Tempo', value: Math.min(100, (selectedProfile.optimalCharacteristics.tempo / 180) * 100), fullMark: 100 },
    { subject: 'Energy', value: selectedProfile.optimalCharacteristics.energy * 100, fullMark: 100 },
    { subject: 'Valence', value: selectedProfile.optimalCharacteristics.valence * 100, fullMark: 100 },
    { subject: 'Danceability', value: selectedProfile.optimalCharacteristics.danceability * 100, fullMark: 100 },
    { subject: 'Flow Score', value: selectedProfile.avgFlowScore, fullMark: 100 },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Personalized Music Insights
          </h2>
          <p className="text-sm text-muted-foreground">
            Discover which music characteristics optimize your performance
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <BarChart3 className="w-4 h-4" />
                Sessions Analyzed
              </div>
              <p className="text-2xl font-bold">{summary.totalSessionsAnalyzed}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Target className="w-4 h-4" />
                Overall Flow
              </div>
              <p className="text-2xl font-bold">{summary.overallFlowAchievement}%</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Zap className="w-4 h-4" />
                Best Activity
              </div>
              <p className="text-2xl font-bold capitalize">{summary.mostEffectiveActivity}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Music className="w-4 h-4" />
                Preferred Tempo
              </div>
              <p className="text-2xl font-bold">{summary.musicPreferences.preferredTempoRange}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Key Findings */}
      {summary && summary.keyFindings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              Key Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.keyFindings.map((finding, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span>{finding}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Music Characteristics by Activity</CardTitle>
          <CardDescription>Compare your optimal music profile across different activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="activity" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Legend />
                <Bar dataKey="energy" name="Energy %" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="valence" name="Valence %" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="danceability" name="Danceability %" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="flowScore" name="Flow Score" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Activity Detail Tabs */}
      <Tabs value={selectedActivity || ""} onValueChange={setSelectedActivity}>
        <TabsList className="w-full flex-wrap h-auto gap-1">
          {profiles.map((profile) => (
            <TabsTrigger 
              key={profile.activityId} 
              value={profile.activityId}
              className="flex items-center gap-2"
            >
              {activityIcons[profile.activityName] || <Music className="w-4 h-4" />}
              <span className="capitalize">{profile.activityName}</span>
              <Badge variant="secondary" className="ml-1">{profile.avgFlowScore}%</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {profiles.map((profile) => (
          <TabsContent key={profile.activityId} value={profile.activityId} className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Radar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg capitalize flex items-center gap-2">
                    {activityIcons[profile.activityName] || <Music className="w-5 h-5" />}
                    {profile.activityName} Profile
                  </CardTitle>
                  <CardDescription>
                    Based on {profile.sessionCount} sessions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid className="stroke-muted" />
                        <PolarAngleAxis dataKey="subject" className="text-xs" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} className="text-xs" />
                        <Radar
                          name={profile.activityName}
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.3}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Optimal Characteristics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Optimal Music Settings</CardTitle>
                  <CardDescription>Your ideal music characteristics for {profile.activityName}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-sm font-medium mb-1">
                        <Activity className="w-4 h-4 text-primary" />
                        Tempo
                      </div>
                      <p className="text-2xl font-bold">{profile.optimalCharacteristics.tempo} BPM</p>
                      <p className="text-xs text-muted-foreground">
                        Range: {profile.characteristicRanges.tempo.min}-{profile.characteristicRanges.tempo.max}
                      </p>
                    </div>
                    
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-sm font-medium mb-1">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        Energy
                      </div>
                      <p className="text-2xl font-bold">{Math.round(profile.optimalCharacteristics.energy * 100)}%</p>
                      <Progress 
                        value={profile.optimalCharacteristics.energy * 100} 
                        className="h-2 mt-2 [&>div]:bg-yellow-500" 
                      />
                    </div>
                    
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-sm font-medium mb-1">
                        <Heart className="w-4 h-4 text-pink-500" />
                        Valence (Mood)
                      </div>
                      <p className="text-2xl font-bold">{Math.round(profile.optimalCharacteristics.valence * 100)}%</p>
                      <Progress 
                        value={profile.optimalCharacteristics.valence * 100} 
                        className="h-2 mt-2 [&>div]:bg-pink-500" 
                      />
                    </div>
                    
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-sm font-medium mb-1">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        Danceability
                      </div>
                      <p className="text-2xl font-bold">{Math.round(profile.optimalCharacteristics.danceability * 100)}%</p>
                      <Progress 
                        value={profile.optimalCharacteristics.danceability * 100} 
                        className="h-2 mt-2 [&>div]:bg-blue-500" 
                      />
                    </div>
                  </div>

                  {/* Biometric Correlations */}
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-3">Biometric Correlations</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Tempo → Focus</span>
                        <div className="flex items-center gap-1">
                          {getCorrelationIndicator(profile.biometricCorrelations.tempoToFocus).icon}
                          <span className="text-muted-foreground">
                            {getCorrelationIndicator(profile.biometricCorrelations.tempoToFocus).label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Energy → Relaxation</span>
                        <div className="flex items-center gap-1">
                          {getCorrelationIndicator(profile.biometricCorrelations.energyToRelaxation).icon}
                          <span className="text-muted-foreground">
                            {getCorrelationIndicator(profile.biometricCorrelations.energyToRelaxation).label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Valence → Mood</span>
                        <div className="flex items-center gap-1">
                          {getCorrelationIndicator(profile.biometricCorrelations.valenceToMood).icon}
                          <span className="text-muted-foreground">
                            {getCorrelationIndicator(profile.biometricCorrelations.valenceToMood).label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Danceability → Flow</span>
                        <div className="flex items-center gap-1">
                          {getCorrelationIndicator(profile.biometricCorrelations.danceabilityToFlow).icon}
                          <span className="text-muted-foreground">
                            {getCorrelationIndicator(profile.biometricCorrelations.danceabilityToFlow).label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              {profile.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-500" />
                      Personalized Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {profile.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/30">
                          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Songs */}
              {profile.topPerformingSongs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top Performing Songs</CardTitle>
                    <CardDescription>Songs that produced your highest flow scores</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {profile.topPerformingSongs.map((song, i) => (
                        <div 
                          key={i}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Music className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{song.title}</p>
                              <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary">
                              {song.characteristics.tempo} BPM
                            </Badge>
                            <Badge className="bg-primary/10 text-primary">
                              {song.flowScore}% flow
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
