import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInsights, type InsightsRange } from "@/features/insights/hooks";

export default function Insights() {
  const [range, setRange] = useState<InsightsRange>("week");
  const { data } = useInsights(range);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Insights</h1>
        <Tabs value={range} onValueChange={(v) => setRange(v as InsightsRange)}>
          <TabsList>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Sessions" value={data ? String(data.totalSessions) : "—"} />
        <Stat label="Minutes" value={data ? String(data.totalMinutes) : "—"} />
        <Stat label="Avg flow" value={data?.avgFlow != null ? `${Math.round(data.avgFlow * 100)}%` : "—"} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Minutes per day</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="flow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                />
                <Area type="monotone" dataKey="minutes" stroke="hsl(var(--primary))" fill="url(#flow)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">By activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data && data.byActivity.length > 0 ? (
            data.byActivity
              .sort((a, b) => b.minutes - a.minutes)
              .map((a) => (
                <div key={a.activity} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{a.activity}</span>
                  <span className="text-muted-foreground">
                    {a.minutes} min · {a.sessions} session{a.sessions > 1 ? "s" : ""}
                  </span>
                </div>
              ))
          ) : (
            <p className="text-sm text-muted-foreground">No data for this range yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
