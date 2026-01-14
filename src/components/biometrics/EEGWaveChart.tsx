import { useState, useEffect, useMemo } from "react";
import { Brain, Activity, Waves, Sparkles, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { EEGReading } from "@/hooks/useMuseEEG";
import { cn } from "@/lib/utils";

interface EEGWaveChartProps {
  readings: EEGReading[];
  isConnected: boolean;
  currentReading?: EEGReading | null;
  focusScore?: number;
  relaxationScore?: number;
  meditationScore?: number;
}

interface WaveBand {
  name: string;
  key: keyof EEGReading;
  color: string;
  description: string;
  icon: React.ReactNode;
  range: string;
}

const waveBands: WaveBand[] = [
  {
    name: "Delta",
    key: "delta",
    color: "#8b5cf6",
    description: "Deep sleep, healing",
    icon: <Sparkles className="w-4 h-4" />,
    range: "0.5-4 Hz",
  },
  {
    name: "Theta",
    key: "theta",
    color: "#06b6d4",
    description: "Meditation, creativity",
    icon: <Waves className="w-4 h-4" />,
    range: "4-8 Hz",
  },
  {
    name: "Alpha",
    key: "alpha",
    color: "#10b981",
    description: "Relaxed focus, calm",
    icon: <Eye className="w-4 h-4" />,
    range: "8-12 Hz",
  },
  {
    name: "Beta",
    key: "beta",
    color: "#f59e0b",
    description: "Active thinking, alertness",
    icon: <Activity className="w-4 h-4" />,
    range: "12-30 Hz",
  },
  {
    name: "Gamma",
    key: "gamma",
    color: "#ef4444",
    description: "Peak concentration, insight",
    icon: <Brain className="w-4 h-4" />,
    range: "30-100 Hz",
  },
];

export function EEGWaveChart({
  readings,
  isConnected,
  currentReading,
  focusScore = 0,
  relaxationScore = 0,
  meditationScore = 0,
}: EEGWaveChartProps) {
  const [displayMode, setDisplayMode] = useState<"realtime" | "distribution">("realtime");

  // Format data for charts - keep last 60 readings for real-time view
  const chartData = useMemo(() => {
    const recentReadings = readings.slice(-60);
    return recentReadings.map((reading, index) => ({
      time: index,
      delta: reading.delta,
      theta: reading.theta,
      alpha: reading.alpha,
      beta: reading.beta,
      gamma: reading.gamma,
    }));
  }, [readings]);

  // Calculate current distribution
  const distribution = useMemo(() => {
    if (!currentReading) return null;

    const total = currentReading.alpha + currentReading.beta + currentReading.theta + 
                  currentReading.gamma + currentReading.delta + 0.001;

    return {
      delta: (currentReading.delta / total) * 100,
      theta: (currentReading.theta / total) * 100,
      alpha: (currentReading.alpha / total) * 100,
      beta: (currentReading.beta / total) * 100,
      gamma: (currentReading.gamma / total) * 100,
    };
  }, [currentReading]);

  // Determine dominant wave
  const dominantWave = useMemo(() => {
    if (!distribution) return null;
    const entries = Object.entries(distribution);
    const [key, value] = entries.reduce((max, current) => 
      current[1] > max[1] ? current : max
    );
    return waveBands.find(b => b.key === key);
  }, [distribution]);

  if (!isConnected) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Brainwave Activity
          </CardTitle>
          <CardDescription>
            Connect a Muse EEG headband to see real-time brainwave data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Brain className="w-16 h-16 opacity-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary animate-pulse" />
              Brainwave Activity
            </CardTitle>
            <CardDescription>
              Real-time alpha, beta, theta, gamma, and delta wave visualization
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge
              variant={displayMode === "realtime" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setDisplayMode("realtime")}
            >
              Real-time
            </Badge>
            <Badge
              variant={displayMode === "distribution" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setDisplayMode("distribution")}
            >
              Distribution
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Cognitive Scores */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
            <div className="text-2xl font-bold text-yellow-600">{focusScore}%</div>
            <div className="text-xs text-muted-foreground">Focus</div>
          </div>
          <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
            <div className="text-2xl font-bold text-green-600">{relaxationScore}%</div>
            <div className="text-xs text-muted-foreground">Relaxation</div>
          </div>
          <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/30">
            <div className="text-2xl font-bold text-purple-600">{meditationScore}%</div>
            <div className="text-xs text-muted-foreground">Meditation</div>
          </div>
        </div>

        {/* Dominant Wave */}
        {dominantWave && (
          <div 
            className="p-4 rounded-lg border-2 flex items-center gap-4"
            style={{ 
              borderColor: dominantWave.color,
              backgroundColor: `${dominantWave.color}15`,
            }}
          >
            <div 
              className="p-2 rounded-full"
              style={{ backgroundColor: `${dominantWave.color}30` }}
            >
              {dominantWave.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{dominantWave.name} Dominant</span>
                <Badge variant="outline" style={{ borderColor: dominantWave.color }}>
                  {dominantWave.range}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{dominantWave.description}</p>
            </div>
          </div>
        )}

        {/* Real-time Chart */}
        {displayMode === "realtime" && chartData.length > 0 && (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="time" 
                  tick={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend />
                {waveBands.map((band) => (
                  <Area
                    key={band.key}
                    type="monotone"
                    dataKey={band.key}
                    name={band.name}
                    stroke={band.color}
                    fill={band.color}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Distribution View */}
        {displayMode === "distribution" && distribution && (
          <div className="space-y-4">
            {waveBands.map((band) => {
              const value = distribution[band.key as keyof typeof distribution];
              return (
                <div key={band.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: band.color }}
                      />
                      <span className="font-medium text-sm">{band.name}</span>
                      <span className="text-xs text-muted-foreground">({band.range})</span>
                    </div>
                    <span className="font-medium text-sm">{value.toFixed(1)}%</span>
                  </div>
                  <Progress 
                    value={value} 
                    className="h-3"
                    style={{ 
                      "--progress-color": band.color,
                    } as React.CSSProperties}
                  />
                  <p className="text-xs text-muted-foreground">{band.description}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Wave Band Legend */}
        <div className="grid grid-cols-5 gap-2">
          {waveBands.map((band) => {
            const bandValue = currentReading ? currentReading[band.key as keyof EEGReading] : null;
            const isActive = typeof bandValue === "number" && bandValue > 5;
            return (
            <div
              key={band.key}
              className={cn(
                "p-2 rounded-lg text-center transition-all",
                isActive && "ring-2 ring-offset-2"
              )}
              style={{ 
                backgroundColor: `${band.color}20`,
                borderColor: band.color,
              }}
            >
              <div 
                className="w-6 h-6 mx-auto mb-1 rounded-full flex items-center justify-center"
                style={{ backgroundColor: band.color }}
              >
                {band.icon}
              </div>
              <div className="text-xs font-medium">{band.name}</div>
              {currentReading && (
                <div className="text-xs text-muted-foreground">
                  {(currentReading[band.key as keyof EEGReading] as number)?.toFixed(1)}
                </div>
              )}
            </div>
          );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
