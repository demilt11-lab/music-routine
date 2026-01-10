import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Music, LogOut, Moon, Dumbbell, BookOpen, Coffee, Car, 
  Sparkles, Loader2, Play, Clock, ListMusic, Headphones, Heart
} from "lucide-react";
import { MusicTabs } from "@/components/music/MusicTabs";
import { BiometricMonitor } from "@/components/biometrics/BiometricMonitor";
import { SessionInsights } from "@/components/biometrics/SessionInsights";
import type { User } from "@supabase/supabase-js";

interface ActivityType {
  id: string;
  name: string;
  description: string;
  icon: string;
}

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
  const [user, setUser] = useState<User | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [playlists, setPlaylists] = useState<GeneratedPlaylist[]>([]);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [activitiesRes, playlistsRes] = await Promise.all([
        supabase.from("activity_types").select("*"),
        supabase
          .from("generated_playlists")
          .select("*, activity_types(name)")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (activitiesRes.data) setActivityTypes(activitiesRes.data);
      if (playlistsRes.data) setPlaylists(playlistsRes.data as GeneratedPlaylist[]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

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

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(`Generated "${data.playlist.playlistName}"!`);
      fetchData();
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Music className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">MindTune</span>
          </div>
          <div className="flex items-center gap-4">
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
          <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
          <p className="text-muted-foreground">
            Play music from multiple sources - no API keys required!
          </p>
        </section>

        {/* Biometric Monitor */}
        <section className="mb-8">
          <BiometricMonitor />
        </section>

        {/* Music Player Section */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Headphones className="w-5 h-5 text-primary" />
            Your Music
          </h2>
          <MusicTabs />
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
            <Card className="p-8 text-center">
              <ListMusic className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No playlists yet. Generate your first one above!
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map((playlist) => (
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

        {/* Session Analytics & Insights */}
        <section className="mb-12">
          <SessionInsights />
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
