import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  lazy,
  Suspense,
} from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Music,
  LogOut,
  Moon,
  Dumbbell,
  BookOpen,
  Coffee,
  Car,
  Brain,
  Sparkles,
  Play,
  Clock,
  ListMusic,
  Headphones,
  BarChart3,
  History,
  Calendar,
  Settings,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { MusicTabs } from "@/components/music/MusicTabs";
import { BiometricMonitor } from "@/components/biometrics/BiometricMonitor";
import { SessionInsights } from "@/components/biometrics/SessionInsights";
import { SessionFlow } from "@/components/session/SessionFlow";
import { RecommendationEngine } from "@/components/music/RecommendationEngine";
import { AppleWatchConnect } from "@/components/AppleWatchConnect";
import { RecentSessionWidget } from "@/components/dashboard/RecentSessionWidget";
import { AchievementBadges } from "@/components/dashboard/AchievementBadges";
import { WeeklyRecap } from "@/components/dashboard/WeeklyRecap";
import { QuickStatsRow } from "@/components/dashboard/QuickStatsRow";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ChartSkeleton } from "@/components/skeletons/ListSkeleton";
import { useActivityTypes, useUserProfile, useRecentPlaylists, useUserSessions } from "@/hooks/useDashboardData";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useQueryClient } from "@tanstack/react-query";

const QuickLogButton = lazy(() =>
  import("@/components/dashboard/QuickLogButton").then((m) => ({
    default: m.QuickLogButton,
  }))
);
const BiometricCharts = lazy(() =>
  import("@/components/biometrics/BiometricCharts").then((m) => ({
    default: m.BiometricCharts,
  }))
);
const PersonalizedInsights = lazy(() =>
  import("@/components/biometrics/PersonalizedInsights").then((m) => ({
    default: m.PersonalizedInsights,
  }))
);
const SmartScheduler = lazy(() =>
  import("@/components/scheduling/SmartScheduler").then((m) => ({
    default: m.SmartScheduler,
  }))
);

interface GeneratedPlaylist {
  id: string;
  name: string;
  description: string;
  song_recommendations: unknown[];
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

interface ActivityType {
  id: string;
  name: string;
  description: string;
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

const activityIconMap: Record<string, typeof Moon> = {
  sleep: Moon,
  workout: Dumbbell,
  study: BookOpen,
  relax: Coffee,
  commute: Car,
  meditation: Brain,
};

const chartFallback = <ChartSkeleton />;

const DashboardHeader = memo(function DashboardHeader({
  email,
  onNavigate,
  onLogout,
}: {
  email?: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) {
  return (
    <header className="border-b border-border">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Music className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">BioMusic</span>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Button variant="ghost" size="sm" onClick={() => onNavigate("/insights")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Weekly
          </Button>
          {/* Fix: was /monthly (no route) — corrected to /progress */}
          <Button variant="ghost" size="sm" onClick={() => onNavigate("/progress")}>
            <Calendar className="mr-2 h-4 w-4" />
            Monthly
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("/history")}>
            <History className="mr-2 h-4 w-4" />
            History
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <span className="text-sm text-muted-foreground">{email}</span>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
});

const ActivityPlaylistBrowser = memo(function ActivityPlaylistBrowser({
  activityTypes,
  expandedActivity,
  onToggleActivity,
  onGeneratePlaylist,
  generatingActivity,
}: {
  activityTypes: ActivityType[];
  expandedActivity: string | null;
  onToggleActivity: (activityName: string) => void;
  onGeneratePlaylist: (activityName: string) => void;
  generatingActivity: string | null;
}) {
  const expandedPlaylists = useMemo(
    () => (expandedActivity ? curatedPlaylists[expandedActivity] ?? [] : []),
    [expandedActivity]
  );

  const openSpotify = useCallback((query: string) => {
    window.open(`https://open.spotify.com/search/${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer");
  }, []);

  const openYoutube = useCallback((query: string) => {
    window.open(`https://music.youtube.com/search?q=${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer");
  }, []);

  return (
    <section className="mb-12">
      <h2 className="mb-4 text-xl font-semibold">Curated Playlists by Activity</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {activityTypes.map((activity) => {
          const isExpanded = expandedActivity === activity.name;
          const isGenerating = generatingActivity === activity.name;
          const Icon = activityIconMap[activity.name] ?? Music;

          return (
            <Card
              key={activity.id}
              className={cn(
                "cursor-pointer transition-colors hover:border-primary/50",
                isExpanded && "border-primary"
              )}
              onClick={() => onToggleActivity(activity.name)}
            >
              <CardHeader className="pb-2">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors">
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-base capitalize">{activity.name}</CardTitle>
                <CardDescription className="text-xs">{activity.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-2">
                <Button className="w-full" variant={isExpanded ? "secondary" : "default"} size="sm">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {isExpanded ? "Hide" : "Browse"}
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  size="sm"
                  disabled={isGenerating}
                  onClick={(e) => {
                    e.stopPropagation();
                    onGeneratePlaylist(activity.name);
                  }}
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {isGenerating ? "Generating..." : "AI Playlist"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {expandedActivity && expandedPlaylists.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {expandedPlaylists.map((playlist) => (
            <Card key={`${expandedActivity}-${playlist.name}`} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{playlist.name}</CardTitle>
                <CardDescription className="text-sm">{playlist.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    openSpotify(playlist.spotifyQuery);
                  }}
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Spotify
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    openYoutube(playlist.youtubeQuery);
                  }}
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  YouTube
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
});

const RecentPlaylistsSection = memo(function RecentPlaylistsSection({
  playlists,
}: {
  playlists: GeneratedPlaylist[];
}) {
  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">Recent AI Playlists</h2>

      {playlists.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={ListMusic}
            title="No AI playlists yet"
            description='Hit "AI Playlist" on any activity above to generate a personalized playlist.'
            actionLabel="Scroll to Activities"
            onAction={handleScrollToTop}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist) => (
            <Card key={playlist.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{playlist.name}</CardTitle>
                    <CardDescription className="capitalize">
                      {playlist.activity_types?.name} • {playlist.song_recommendations?.length || 0} songs
                    </CardDescription>
                  </div>

                  <Button size="icon" variant="ghost" aria-label={`Play ${playlist.name}`}>
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{playlist.description}</p>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="mr-1 h-3 w-3" />
                  {new Date(playlist.created_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
});

const DashboardAnalytics = memo(function DashboardAnalytics() {
  return (
    <>
      <section className="mb-12">
        <SectionErrorBoundary fallbackTitle="Charts failed to load">
          <Suspense fallback={chartFallback}>
            <BiometricCharts />
          </Suspense>
        </SectionErrorBoundary>
      </section>

      <section className="mb-12">
        <SectionErrorBoundary fallbackTitle="Session insights failed to load">
          <SessionInsights />
        </SectionErrorBoundary>
      </section>

      <section className="mb-12">
        <SectionErrorBoundary fallbackTitle="Personalized insights failed to load">
          <Suspense fallback={chartFallback}>
            <PersonalizedInsights />
          </Suspense>
        </SectionErrorBoundary>
      </section>
    </>
  );
});

const Dashboard = () => {
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [generatingActivity, setGeneratingActivity] = useState<string | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { user, isReady } = useAuthReady();
  const { data: activityTypes = [] } = useActivityTypes();
  const { data: profile } = useUserProfile(user?.id);
  const { data: playlists = [] } = useRecentPlaylists(user?.id);
  const { data: sessions = [] } = useUserSessions(user?.id);

  useEffect(() => {
    if (isReady && !user) {
      navigate("/auth", { replace: true });
    }
  }, [isReady, user, navigate]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setShowAnalytics(true);
    }, 150);

    return () => window.clearTimeout(id);
  }, []);

  const displayName = profile?.display_name ?? "";
  const sessionCount = sessions.length;
  const typedPlaylists = useMemo(
    () => playlists as GeneratedPlaylist[],
    [playlists]
  );

  const handleRouteNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  const handleToggleActivity = useCallback((activityName: string) => {
    setExpandedActivity((current) => (current === activityName ? null : activityName));
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  }, [navigate]);

  const handleGeneratePlaylist = useCallback(
    async (activityName: string) => {
      setGeneratingActivity(activityName);
      try {
        const { data, error } = await supabase.functions.invoke("generate-playlist", {
          body: {
            activityType: activityName,
            moodPreference: "balanced",
            energyLevel:
              activityName === "workout"
                ? "high"
                : activityName === "sleep"
                ? "low"
                : "moderate",
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
        setGeneratingActivity(null);
      }
    },
    [queryClient]
  );

  if (!isReady) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        email={user?.email}
        onNavigate={handleRouteNavigate}
        onLogout={handleLogout}
      />

      <main className="container mx-auto px-4 py-8 pb-32">
        <section className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">
            Welcome back{displayName ? `, ${displayName}` : ""}! 👋
          </h1>
          {/* Fix: replaced Lovable template string with contextual session count */}
          <p className="text-muted-foreground">
            {sessionCount > 0
              ? `${sessionCount} session${sessionCount === 1 ? "" : "s"} logged. Keep the momentum going.`
              : "Start your first session to begin tracking your flow state."}
          </p>
        </section>

        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Quick stats failed to load">
            <QuickStatsRow />
          </SectionErrorBoundary>
        </section>

        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Weekly recap failed to load">
            <WeeklyRecap />
          </SectionErrorBoundary>
        </section>

        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Session stats failed to load">
            <RecentSessionWidget />
          </SectionErrorBoundary>
        </section>

        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Achievements failed to load">
            <AchievementBadges />
          </SectionErrorBoundary>
        </section>

        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Session flow failed to load">
            <SessionFlow />
          </SectionErrorBoundary>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <SectionErrorBoundary fallbackTitle="Biometric monitor failed to load">
            <BiometricMonitor />
          </SectionErrorBoundary>

          <SectionErrorBoundary fallbackTitle="Apple Watch connect failed to load">
            <AppleWatchConnect />
          </SectionErrorBoundary>
        </section>

        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Recommendations failed to load">
            <RecommendationEngine />
          </SectionErrorBoundary>
        </section>

        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Scheduler failed to load">
            <Suspense fallback={chartFallback}>
              <SmartScheduler />
            </Suspense>
          </SectionErrorBoundary>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <Headphones className="h-5 w-5 text-primary" />
            Your Music
          </h2>

          <SectionErrorBoundary fallbackTitle="Music player failed to load">
            <MusicTabs />
          </SectionErrorBoundary>
        </section>

        <ActivityPlaylistBrowser
          activityTypes={activityTypes as ActivityType[]}
          expandedActivity={expandedActivity}
          onToggleActivity={handleToggleActivity}
          onGeneratePlaylist={handleGeneratePlaylist}
          generatingActivity={generatingActivity}
        />

        <RecentPlaylistsSection playlists={typedPlaylists} />

        {showAnalytics ? <DashboardAnalytics /> : null}
      </main>

      <Suspense fallback={null}>
        <QuickLogButton />
      </Suspense>
    </div>
  );
};

export default Dashboard;
