import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Music, LogOut, Moon, Dumbbell, BookOpen, Coffee, Car, 
  Sparkles, Loader2, Play, Clock, ListMusic, Headphones, BarChart3, History, Calendar, Settings
} from "lucide-react";
import { MusicTabs } from "@/components/music/MusicTabs";
import { BiometricMonitor } from "@/components/biometrics/BiometricMonitor";
import { SessionInsights } from "@/components/biometrics/SessionInsights";
import { BiometricCharts } from "@/components/biometrics/BiometricCharts";
import { PersonalizedInsights } from "@/components/biometrics/PersonalizedInsights";
import { SessionFlow } from "@/components/session/SessionFlow";
import { RecommendationEngine } from "@/components/music/RecommendationEngine";
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

const activityIcons: Record<string, React.ReactNode> = {
  sleep: <Moon className="w-6 h-6" />,
  workout: <Dumbbell className="w-6 h-6" />,
  study: <BookOpen className="w-6 h-6" />,
  relax: <Coffee className="w-6 h-6" />,
  commute: <Car className="w-6 h-6" />,
};

const Dashboard = () => {
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
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

        {/* Biometric Monitor */}
        <section className="mb-8">
          <SectionErrorBoundary fallbackTitle="Biometric monitor failed to load">
            <BiometricMonitor />
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
          <h2 className="text-xl font-semibold mb-4">Generate Playlist by Activity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {activityTypes.map((activity) => (
              <Card 
                key={activity.id} 
                className="hover:border-primary/50 transition-colors cursor-pointer group"
              >
                <CardHeader className="pb-2">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                    {activityIcons[activity.name] || <Music className="w-6 h-6" />}
                  </div>
                  <CardTitle className="capitalize">{activity.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {activity.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => handleGeneratePlaylist(activity.name)}
                    disabled={generatingFor === activity.name}
                  >
                    {generatingFor === activity.name ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
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
