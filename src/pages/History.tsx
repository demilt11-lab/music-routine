import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessions } from "@/features/sessions/hooks";
import type { SessionRow } from "@/lib/database.types";

function duration(s: SessionRow): string {
  if (!s.ended_at) return "in progress";
  const mins = Math.max(1, Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000));
  return `${mins} min`;
}

export default function History() {
  const { data: sessions, isLoading } = useSessions(100);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">History</h1>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sessions yet.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium capitalize">{s.activity}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.started_at).toLocaleDateString()} · {duration(s)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {s.avg_flow_score != null && (
                    <span className="text-sm text-muted-foreground">{Math.round(s.avg_flow_score * 100)}% flow</span>
                  )}
                  <Badge variant={s.status === "completed" ? "secondary" : s.status === "active" ? "default" : "outline"}>
                    {s.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
