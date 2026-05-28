import { useNavigate } from "react-router-dom";
import { Clock, Flame, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/database.types";
import { useActivities, useCreateSession, useSessions } from "@/features/sessions/hooks";
import { useInsights } from "@/features/insights/hooks";
import { useProfile } from "@/features/profile/hooks";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: activities = [] } = useActivities();
  const { data: sessions = [] } = useSessions(5);
  const { data: insights } = useInsights("week");
  const createSession = useCreateSession();

  const start = async (activity: Activity) => {
    try {
      const session = await createSession.mutateAsync({ activity });
      navigate(`/session/${session.id}`);
    } catch {
      toast.error("Couldn't start session");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="text-2xl font-semibold">{profile?.display_name ?? "Let's find your flow"}</h1>
      </div>

      <section className="grid grid-cols-3 gap-3">
        <Stat icon={Flame} label="Sessions" value={insights ? String(insights.totalSessions) : "—"} hint="this week" />
        <Stat icon={Clock} label="Minutes" value={insights ? String(insights.totalMinutes) : "—"} hint="this week" />
        <Stat
          icon={Sparkles}
          label="Avg flow"
          value={insights?.avgFlow != null ? `${Math.round(insights.avgFlow * 100)}%` : "—"}
          hint="this week"
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Start a session</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {activities.map((a) => (
            <button
              key={a.key}
              type="button"
              disabled={createSession.isPending}
              onClick={() => start(a.key)}
              className={cn(
                "rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary hover:shadow-sm disabled:opacity-60",
              )}
            >
              <p className="font-medium">{a.label}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet — start one above.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium capitalize">{s.activity}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.started_at).toLocaleString()}</p>
                  </div>
                  {s.status === "active" ? (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/session/${s.id}`)}>
                      Resume
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {s.avg_flow_score != null ? `${Math.round(s.avg_flow_score * 100)}% flow` : "completed"}
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {createSession.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Flame; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
