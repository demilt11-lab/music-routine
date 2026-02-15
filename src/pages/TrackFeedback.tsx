import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ThumbsUp, ThumbsDown, Trash2, Music } from "lucide-react";
import { toast } from "sonner";

interface FeedbackRow {
  id: string;
  track_title: string;
  track_artist: string;
  feedback: string;
  activity_type: string | null;
  target_tempo: number | null;
  target_energy: number | null;
  created_at: string;
}

const TrackFeedback = () => {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "up" | "down">("all");

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("track_feedback")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setFeedback(data as FeedbackRow[]);
    }
    setLoading(false);
  };

  const deleteFeedback = async (id: string) => {
    const { error } = await supabase.from("track_feedback").delete().eq("id", id);
    if (!error) {
      setFeedback((prev) => prev.filter((f) => f.id !== id));
      toast.success("Feedback removed");
    } else {
      toast.error("Failed to remove feedback");
    }
  };

  const filtered = feedback.filter((f) =>
    filter === "all" ? true : f.feedback === filter
  );

  const likedCount = feedback.filter((f) => f.feedback === "up").length;
  const dislikedCount = feedback.filter((f) => f.feedback === "down").length;

  return (
    <div className="min-h-screen bg-background dark">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Track Preferences
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage your music feedback history
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{feedback.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-accent">{likedCount}</p>
            <p className="text-xs text-muted-foreground">Liked</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{dislikedCount}</p>
            <p className="text-xs text-muted-foreground">Disliked</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(["all", "up", "down"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className={filter === f ? "gradient-primary text-primary-foreground" : ""}
            >
              {f === "all" ? "All" : f === "up" ? "👍 Liked" : "👎 Disliked"}
            </Button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center text-muted-foreground py-16">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Music className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No feedback yet</p>
            <p className="text-muted-foreground/60 text-sm mt-1">
              Rate tracks during sessions to build your preferences
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 group hover:border-primary/30 transition-colors"
              >
                <div
                  className={`shrink-0 rounded-full p-2 ${
                    item.feedback === "up"
                      ? "bg-accent/10 text-accent"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {item.feedback === "up" ? (
                    <ThumbsUp className="h-4 w-4" />
                  ) : (
                    <ThumbsDown className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-medium text-sm truncate">
                    {item.track_title}
                  </p>
                  <p className="text-muted-foreground text-xs truncate">
                    {item.track_artist}
                    {item.activity_type && ` · ${item.activity_type}`}
                  </p>
                </div>
                <div className="text-muted-foreground/50 text-xs hidden sm:block">
                  {new Date(item.created_at).toLocaleDateString()}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={() => deleteFeedback(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackFeedback;
