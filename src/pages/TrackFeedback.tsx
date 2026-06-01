import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Music, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthReady } from "@/hooks/useAuthReady";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { EmptyState } from "@/components/EmptyState";

type FeedbackFilter = "all" | "up" | "down";

interface FeedbackRow {
  id: string;
  track_title: string;
  track_artist: string;
  feedback: "up" | "down";
  activity_type: string | null;
  target_tempo: number | null;
  target_energy: number | null;
  created_at: string;
}

const filterOptions: { value: FeedbackFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "up", label: "👍 Liked" },
  { value: "down", label: "👎 Disliked" },
];

const FeedbackStats = memo(function FeedbackStats({
  total,
  liked,
  disliked,
}: {
  total: number;
  liked: number;
  disliked: number;
}) {
  return (
    <div className="mb-6 grid grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-accent">{liked}</p>
          <p className="text-xs text-muted-foreground">Liked</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{disliked}</p>
          <p className="text-xs text-muted-foreground">Disliked</p>
        </CardContent>
      </Card>
    </div>
  );
});

const FilterBar = memo(function FilterBar({
  activeFilter,
  onChange,
}: {
  activeFilter: FeedbackFilter;
  onChange: (value: FeedbackFilter) => void;
}) {
  return (
    <div className="mb-6 flex gap-2">
      {filterOptions.map((option) => (
        <Button
          key={option.value}
          variant={activeFilter === option.value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
});

const FeedbackListItem = memo(function FeedbackListItem({
  item,
  onDelete,
}: {
  item: FeedbackRow;
  onDelete: (id: string) => void;
}) {
  const formattedDate = useMemo(
    () => new Date(item.created_at).toLocaleDateString(),
    [item.created_at]
  );

  const handleDelete = useCallback(() => {
    onDelete(item.id);
  }, [item.id, onDelete]);

  return (
    <div className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
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

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{item.track_title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.track_artist}
          {item.activity_type ? ` · ${item.activity_type}` : ""}
        </p>
      </div>

      <div className="hidden text-xs text-muted-foreground/50 sm:block">
        {formattedDate}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="text-destructive opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        onClick={handleDelete}
        aria-label={`Delete feedback for ${item.track_title}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
});

const TrackFeedback = () => {
  const navigate = useNavigate();
  const { user, isReady } = useAuthReady();

  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FeedbackFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && !user) {
      navigate("/auth", { replace: true });
    }
  }, [isReady, user, navigate]);

  const loadFeedback = useCallback(async () => {
    if (!isReady || !user) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("track_feedback")
      .select(
        "id, track_title, track_artist, feedback, activity_type, target_tempo, target_energy, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load feedback");
      setLoading(false);
      return;
    }

    setFeedback((data || []) as FeedbackRow[]);
    setLoading(false);
  }, [isReady, user]);

  useEffect(() => {
    if (!user || !isReady) return;
    void loadFeedback();
  }, [user, isReady, loadFeedback]);

  const filteredFeedback = useMemo(() => {
    if (filter === "all") return feedback;
    return feedback.filter((item) => item.feedback === filter);
  }, [feedback, filter]);

  const stats = useMemo(() => {
    let liked = 0;
    let disliked = 0;

    for (const item of feedback) {
      if (item.feedback === "up") liked += 1;
      else if (item.feedback === "down") disliked += 1;
    }

    return {
      total: feedback.length,
      liked,
      disliked,
    };
  }, [feedback]);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleFilterChange = useCallback((value: FeedbackFilter) => {
    setFilter(value);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (deletingId) return;

    setDeletingId(id);

    const { error } = await supabase.from("track_feedback").delete().eq("id", id);

    if (error) {
      toast.error("Failed to remove feedback");
      setDeletingId(null);
      return;
    }

    setFeedback((prev) => prev.filter((item) => item.id !== id));
    toast.success("Feedback removed");
    setDeletingId(null);
  }, [deletingId]);

  if (!isReady) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <h1 className="text-2xl font-bold text-foreground">Track Preferences</h1>
            <p className="text-sm text-muted-foreground">
              Manage your music feedback history
            </p>
          </div>
        </div>

        <FeedbackStats
          total={stats.total}
          liked={stats.liked}
          disliked={stats.disliked}
        />

        <FilterBar activeFilter={filter} onChange={handleFilterChange} />

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading...</div>
        ) : filteredFeedback.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={Music}
              title="No feedback yet"
              description="Rate tracks during sessions to build your preferences."
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredFeedback.map((item) => (
              <FeedbackListItem
                key={item.id}
                item={item}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackFeedback;
