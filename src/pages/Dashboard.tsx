import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Music, LogOut, Moon, Dumbbell, BookOpen, Coffee, Car, Brain,
  Sparkles, Loader2, Play, Clock, ListMusic, Headphones, BarChart3, History, Calendar, Settings,
  ExternalLink
} from "lucide-react";
import { MusicTabs } from "@/components/music/MusicTabs";
import { BiometricMonitor } from "@/components/biometrics/BiometricMonitor";
import { SessionInsights } from "@/components/biometrics/SessionInsights";
import { BiometricCharts } from "@/components/biometrics/BiometricCharts";
import { PersonalizedInsights } from "@/components/biometrics/PersonalizedInsights";
import { SessionFlow } from "@/components/session/SessionFlow";
import { RecommendationEngine } from "@/components/music/RecommendationEngine";
import { AppleWatchConnect } from "@/components/AppleWatchConnect";
import { SmartScheduler } from "@/components/scheduling/SmartScheduler";
import { RecentSessionWidget } from "@/components/dashboard/RecentSessionWidget";
import { AchievementBadges } from "@/components/dashboard/AchievementBadges";
import { WeeklyRecap } from "@/components/dashboard/WeeklyRecap";
import { QuickStatsRow } from "@/components/dashboard/QuickStatsRow";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { useCurrentUser, useActivityTypes, useUserProfile, useRecentPlaylists } from "@/hooks/useDashboardData";
import { useQueryClient } from "@tanstack/react-query";
import { QuickLogButton } from "@/components/dashboard/QuickLogButton";
import type { User } from "@supabase/supabase-js";

interface GeneratedPlaylist {
  id: string;
  name: string;
  description: string;
  song_recommendations: any[];
  ai_reasoning: string;
  created_at: string;
  activity_types: { name: string };
}

interface CuratedPlaylist {
  name: string;
  description: string;
  spotifyQuery: string;
  youtubeQuery: string;
}

const curatedPlaylists: Record<string, CuratedPlaylist[]> = {
  sleep: [
    { name: "Deep Sleep Soundscapes", description: "Ambient drones and nature sounds for effortless sleep", spotifyQuery: "deep+sleep+ambient+soundscape", youtubeQuery: "deep+sleep+ambient+music+8+hours" },
    { name: "Piano Lullabies", description: "Gentle solo piano pieces with slow, soothing melodies", spotifyQuery: "sleep+piano+lullaby+calm", youtubeQuery: "relaxing+piano+sleep+music" },
    { name: "Rain & Thunder", description: "Natural rain sounds layered with soft orchestral pads", spotifyQuery: "rain+sounds+sleep+relaxation", youtubeQuery: "rain+thunder+sleep+sounds" },
    { name: "432 Hz Healing Sleep", description: "Tuned to 432 Hz for deep restorative rest", spotifyQuery: "432+hz+sleep+healing+music", youtubeQuery: "432+hz+deep+sleep+music" },
    { name: "Lo-Fi Sleep Beats", description: "Ultra-chill lo-fi with downtempo beats under 70 BPM", spotifyQuery: "lofi+sleep+beats+chill", youtubeQuery: "lofi+sleep+beats+playlist" },
  ],
  workout: [
    { name: "Beast Mode Bangers", description: "High-energy EDM & hip-hop for max intensity (140+ BPM)", spotifyQuery: "workout+beast+mode+high+energy", youtubeQuery: "best+workout+music+2024+high+energy" },
    { name: "Power Lifting Anthems", description: "Heavy metal and hard rock for lifting sessions", spotifyQuery: "powerlifting+metal+workout+music", youtubeQuery: "powerlifting+motivation+music+metal" },
    { name: "Cardio Pop Hits", description: "Upbeat pop hits perfect for running and cardio", spotifyQuery: "cardio+pop+hits+running+workout", youtubeQuery: "cardio+workout+pop+hits+playlist" },
    { name: "Hip-Hop Grind", description: "Motivational hip-hop and trap for pushing through", spotifyQuery: "hip+hop+workout+motivation+gym", youtubeQuery: "hip+hop+gym+workout+playlist" },
    { name: "Electronic Energy", description: "Progressive house and trance for sustained energy", spotifyQuery: "electronic+workout+progressive+house", youtubeQuery: "electronic+workout+music+progressive" },
  ],
  study: [
    { name: "Lo-Fi Study Beats", description: "Classic lo-fi hip-hop for deep focus and concentration", spotifyQuery: "lofi+study+beats+focus", youtubeQuery: "lofi+hip+hop+study+beats" },
    { name: "Classical Focus", description: "Bach, Debussy, and Satie for peak concentration", spotifyQuery: "classical+focus+study+bach+debussy", youtubeQuery: "classical+music+for+studying+concentration" },
    { name: "Ambient Concentration", description: "Minimal ambient textures that disappear into the background", spotifyQuery: "ambient+concentration+focus+minimal", youtubeQuery: "ambient+focus+music+for+studying" },
    { name: "Jazz Study Session", description: "Smooth jazz instrumentals for a coffee-shop study vibe", spotifyQuery: "jazz+study+smooth+instrumental", youtubeQuery: "jazz+study+music+coffee+shop" },
    { name: "Video Game Soundtracks", description: "Designed to keep you focused — Zelda, Final Fantasy, Undertale", spotifyQuery: "video+game+soundtrack+study+focus", youtubeQuery: "video+game+music+for+studying" },
  ],
  relax: [
    { name: "Chill Acoustic Vibes", description: "Gentle acoustic guitar and soft vocals for unwinding", spotifyQuery: "chill+acoustic+relax+unwind", youtubeQuery: "chill+acoustic+relaxing+music" },
    { name: "Spa & Meditation", description: "Flowing water, singing bowls, and nature ambience", spotifyQuery: "spa+meditation+relaxation+nature", youtubeQuery: "spa+relaxation+music+nature+sounds" },
    { name: "Sunday Morning Jazz", description: "Warm jazz trio recordings for lazy weekend mornings", spotifyQuery: "sunday+morning+jazz+relax+chill", youtubeQuery: "sunday+morning+jazz+relaxing" },
    { name: "Chillwave Sunset", description: "Dreamy synths and reverb-soaked melodies", spotifyQuery: "chillwave+sunset+dreamy+synth", youtubeQuery: "chillwave+sunset+relaxing+music" },
    { name: "Bossa Nova Breeze", description: "Brazilian bossa nova for a warm, carefree mood", spotifyQuery: "bossa+nova+relax+chill+brazilian", youtubeQuery: "bossa+nova+relaxing+music+playlist" },
  ],
  commute: [
    { name: "Drive Time Hits", description: "Feel-good pop and rock hits for the road", spotifyQuery: "drive+time+hits+road+trip+pop", youtubeQuery: "best+driving+music+road+trip+hits" },
    { name: "Podcast-Ready Chill", description: "Low-key background beats between podcast episodes", spotifyQuery: "chill+background+beats+commute", youtubeQuery: "chill+commute+music+background+beats" },
    { name: "Morning Motivation", description: "Energizing tracks to kickstart your morning commute", spotifyQuery: "morning+motivation+commute+upbeat", youtubeQuery: "morning+motivation+music+commute" },
    { name: "Indie Road Trip", description: "Indie folk and alternative for scenic drives", spotifyQuery: "indie+road+trip+folk+alternative", youtubeQuery: "indie+folk+road+trip+playlist" },
    { name: "Rush Hour Electronic", description: "Upbeat electronic to make traffic bearable", spotifyQuery: "electronic+commute+upbeat+driving", youtubeQuery: "electronic+driving+music+upbeat" },
  ],
  meditation: [
    { name: "Tibetan Singing Bowls", description: "Resonant bowl tones for deep mindfulness practice", spotifyQuery: "tibetan+singing+bowls+meditation", youtubeQuery: "tibetan+singing+bowls+meditation+music" },
    { name: "Guided Breathwork", description: "Ambient backdrops for breathing exercises", spotifyQuery: "breathwork+ambient+meditation+calm", youtubeQuery: "breathwork+meditation+ambient+music" },
    { name: "Chakra Healing Tones", description: "Frequency-tuned tones for each chakra center", spotifyQuery: "chakra+healing+tones+meditation", youtubeQuery: "chakra+healing+meditation+music" },
    { name: "Zen Garden", description: "Japanese-inspired koto and flute for peaceful meditation", spotifyQuery: "zen+garden+japanese+meditation+music", youtubeQuery: "zen+garden+japanese+meditation+music" },
    { name: "Binaural Focus", description: "Binaural beats in theta range for deep meditation", spotifyQuery: "binaural+beats+theta+meditation", youtubeQuery: "binaural+beats+theta+meditation+deep" },
  ],
};

const activityIcons: Record<string, React.ReactNode> = {
  sleep: <Moon className="w-6 h-6" />,
  workout: <Dumbbell className="w-6 h-6" />,
  study: <BookOpen className="w-6 h-6" />,
  relax: <Coffee className="w-6 h-6" />,
  commute: <Car className="w-6 h-6" />,
  meditation: <Brain className="w-6 h-6" />,
};

const Dashboard = () => {
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: activityTypes = [] } = useActivityTypes();
  const { data: profile } = useUserProfile(user?.id);
  const { data: playlists = [] } = useRecentPlaylists(user?.id);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        navigate("/auth", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGeneratePlaylist = async (activityName: string) => {
    setGeneratingFor(activityName);
    try {
      const { data, error } = await supabase.functions.invoke("generate-playlist", {
        body: { 
          activityType: activityName,
          moodPreference: "balanced",
          energyLevel: activityName === "workout" ? "high" : activityName === "sleep" ? "low" : "moderate"
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success(`Generated "${data.playlist.playlistName}"!`);
      queryClient.invalidateQueries({ queryKey: ["recent-playlists"] });
    } catch (error) {
      console.error("Error generating playlist:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate playlist");
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  if (userLoading) {
    return <DashboardSkeleton />;
  }

  const displayName = profile?.display_name;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Music className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">BioMusic</span>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/insights")}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Weekly
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/monthly")}>
              <Calendar className="w-4 h-4 mr-2" />
              Monthly
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
              <History className="w-4 h-4 mr-2" />
              History
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-32">
        {/* Welcome Section */}
        <section className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back{displayName ? `, ${displayName}` : ""}! 👋
          </h1>
          <p className="text-muted-foreground">
            Play music from multiple sources - no API keys required!
          </p>
        </section>

        {/* Quick Stats Row */}
        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Quick stats failed to load">
            <QuickStatsRow />
          </SectionErrorBoundary>
        </section>

        {/* Weekly Recap Notification */}
        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Weekly recap failed to load">
            <WeeklyRecap />
          </SectionErrorBoundary>
        </section>

        {/* Recent Session Stats & Streak */}
        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Session stats failed to load">
            <RecentSessionWidget />
          </SectionErrorBoundary>
        </section>

        {/* Achievement Badges */}
        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Achievements failed to load">
            <AchievementBadges />
          </SectionErrorBoundary>
        </section>

        {/* Session Flow - Dedicated Listening Session */}
        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Session flow failed to load">
            <SessionFlow />
          </SectionErrorBoundary>
        </section>

        {/* Biometric Monitor & Apple Watch */}
        <section className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <SectionErrorBoundary fallbackTitle="Biometric monitor failed to load">
            <BiometricMonitor />
          </SectionErrorBoundary>
          <SectionErrorBoundary fallbackTitle="Apple Watch connect failed to load">
            <AppleWatchConnect />
          </SectionErrorBoundary>
        </section>

        {/* Smart Recommendations */}
        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Recommendations failed to load">
            <RecommendationEngine />
          </SectionErrorBoundary>
        </section>

        {/* Smart Scheduling */}
        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Scheduler failed to load">
            <SmartScheduler />
          </SectionErrorBoundary>
        </section>

        {/* Music Player Section */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Headphones className="w-5 h-5 text-primary" />
            Your Music
          </h2>
          <SectionErrorBoundary fallbackTitle="Music player failed to load">
            <MusicTabs />
          </SectionErrorBoundary>
        </section>

        {/* Activity Cards */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Curated Playlists by Activity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {activityTypes.map((activity) => (
              <Card 
                key={activity.id} 
                className={cn(
                  "hover:border-primary/50 transition-colors cursor-pointer group",
                  expandedActivity === activity.name && "border-primary"
                )}
                onClick={() => setExpandedActivity(expandedActivity === activity.name ? null : activity.name)}
              >
                <CardHeader className="pb-2">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                    {activityIcons[activity.name] || <Music className="w-6 h-6" />}
                  </div>
                  <CardTitle className="capitalize text-base">{activity.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {activity.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    variant={expandedActivity === activity.name ? "secondary" : "default"}
                    size="sm"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {expandedActivity === activity.name ? "Hide" : "Browse"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Expanded curated playlists */}
          {expandedActivity && curatedPlaylists[expandedActivity] && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {curatedPlaylists[expandedActivity].map((playlist, idx) => (
                <Card key={idx} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{playlist.name}</CardTitle>
                    <CardDescription className="text-sm">{playlist.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => window.open(`https://open.spotify.com/search/${encodeURIComponent(playlist.spotifyQuery)}`, "_blank")}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Spotify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => window.open(`https://music.youtube.com/search?q=${encodeURIComponent(playlist.youtubeQuery)}`, "_blank")}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      YouTube
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Recent Playlists */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Recent Playlists</h2>
          {playlists.length === 0 ? (
            <Card className="p-8">
              <EmptyState
                icon={ListMusic}
                title="No playlists yet"
                description="Generate your first playlist by selecting an activity above!"
                actionLabel="Scroll to Activities"
                onAction={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(playlists as GeneratedPlaylist[]).map((playlist) => (
                <Card key={playlist.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{playlist.name}</CardTitle>
                        <CardDescription className="capitalize">
                          {playlist.activity_types?.name} • {playlist.song_recommendations?.length || 0} songs
                        </CardDescription>
                      </div>
                      <Button size="icon" variant="ghost">
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {playlist.description}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(playlist.created_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Biometric Charts & Visualizations */}
        <section className="mb-12">
          <SectionErrorBoundary fallbackTitle="Charts failed to load">
            <BiometricCharts />
          </SectionErrorBoundary>
        </section>

        {/* Session Analytics & Insights */}
        <section className="mb-12">
          <SectionErrorBoundary fallbackTitle="Session insights failed to load">
            <SessionInsights />
          </SectionErrorBoundary>
        </section>

        {/* Personalized Music Insights */}
        <section className="mb-12">
          <SectionErrorBoundary fallbackTitle="Personalized insights failed to load">
            <PersonalizedInsights />
          </SectionErrorBoundary>
        </section>
      </main>
      <QuickLogButton />
    </div>
  );
};

export default Dashboard;
