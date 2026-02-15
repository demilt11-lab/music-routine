import { useMemo } from "react";
import { Heart, Brain, Sparkles, Activity, Music, Zap, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface BiometricMusicMapperProps {
  heartRate: number;
  stressLevel: number;
  focusScore: number;
  relaxationScore: number;
  flowState: "none" | "entering" | "in-flow" | "exiting";
  targetTempo?: number;
  targetEnergy?: number;
  action?: string;
  reasoning?: string;
  isAdaptiveEnabled: boolean;
}

interface MappingLink {
  label: string;
  bioValue: number;
  bioIcon: React.ReactNode;
  bioColor: string;
  musicParam: string;
  musicValue: string;
  influence: "increasing" | "decreasing" | "stable";
  strength: number; // 0-100
}

export function BiometricMusicMapper({
  heartRate,
  stressLevel,
  focusScore,
  relaxationScore,
  flowState,
  targetTempo,
  targetEnergy,
  action,
  reasoning,
  isAdaptiveEnabled,
}: BiometricMusicMapperProps) {
  const mappings = useMemo((): MappingLink[] => {
    if (!targetTempo && !targetEnergy) return [];

    const tempo = targetTempo || 120;
    const energy = targetEnergy || 0.5;

    // Determine how each biometric influences the music output
    const hrInfluence: MappingLink["influence"] =
      heartRate > 85 ? "decreasing" : heartRate < 65 ? "increasing" : "stable";
    const stressInfluence: MappingLink["influence"] =
      stressLevel > 60 ? "decreasing" : stressLevel < 30 ? "increasing" : "stable";
    const focusInfluence: MappingLink["influence"] =
      focusScore > 70 ? "stable" : focusScore < 40 ? "increasing" : "stable";

    return [
      {
        label: "Heart Rate",
        bioValue: heartRate,
        bioIcon: <Heart className="w-4 h-4" />,
        bioColor: "text-red-500",
        musicParam: "Tempo",
        musicValue: `${tempo} BPM`,
        influence: hrInfluence,
        strength: Math.min(100, Math.abs(heartRate - 75) * 3),
      },
      {
        label: "Stress",
        bioValue: stressLevel,
        bioIcon: <Activity className="w-4 h-4" />,
        bioColor: "text-orange-500",
        musicParam: "Energy",
        musicValue: `${Math.round(energy * 100)}%`,
        influence: stressInfluence,
        strength: Math.min(100, Math.abs(stressLevel - 40) * 2),
      },
      {
        label: "Focus",
        bioValue: focusScore,
        bioIcon: <Brain className="w-4 h-4" />,
        bioColor: "text-purple-500",
        musicParam: "Tempo",
        musicValue: `${tempo} BPM`,
        influence: focusInfluence,
        strength: Math.min(100, Math.abs(focusScore - 60) * 2),
      },
    ];
  }, [heartRate, stressLevel, focusScore, targetTempo, targetEnergy]);

  const flowScore = useMemo(() => {
    return Math.round((focusScore + relaxationScore - stressLevel / 2) / 2);
  }, [focusScore, relaxationScore, stressLevel]);

  const actionIcon = useMemo(() => {
    if (!action) return <Minus className="w-4 h-4" />;
    if (action.includes("increase")) return <TrendingUp className="w-4 h-4" />;
    if (action.includes("decrease")) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  }, [action]);

  const actionColor = useMemo(() => {
    if (!action) return "text-muted-foreground";
    if (action.includes("increase")) return "text-primary";
    if (action.includes("decrease")) return "text-blue-400";
    return "text-muted-foreground";
  }, [action]);

  if (!isAdaptiveEnabled) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardContent className="py-6 text-center">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Enable adaptive music to see live bio→music mapping
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-card/50 backdrop-blur overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="relative">
            <Sparkles className="w-5 h-5 text-primary" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
          </div>
          Bio → Music Mapping
          <Badge variant="outline" className="ml-auto text-[10px] bg-primary/10 text-primary border-primary/20">
            LIVE
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Central Flow Gauge */}
        <div className="flex items-center justify-center gap-6">
          {/* Bio Side */}
          <div className="text-center space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Body</p>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <Heart className="w-4 h-4 mx-auto text-red-500 animate-pulse" />
                <span className="text-lg font-bold">{heartRate}</span>
                <p className="text-[10px] text-muted-foreground">BPM</p>
              </div>
              <div className="text-center">
                <Brain className="w-4 h-4 mx-auto text-purple-500" />
                <span className="text-lg font-bold">{focusScore}%</span>
                <p className="text-[10px] text-muted-foreground">Focus</p>
              </div>
            </div>
          </div>

          {/* Arrow with action */}
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
              flowState === "in-flow"
                ? "border-green-500 bg-green-500/20 text-green-500"
                : flowState === "entering"
                ? "border-yellow-500 bg-yellow-500/20 text-yellow-500"
                : "border-muted bg-muted/50 text-muted-foreground"
            )}>
              <ArrowRight className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-muted-foreground capitalize">{flowState}</span>
          </div>

          {/* Music Side */}
          <div className="text-center space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Music</p>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <Music className="w-4 h-4 mx-auto text-primary" />
                <span className="text-lg font-bold">{targetTempo || "—"}</span>
                <p className="text-[10px] text-muted-foreground">BPM</p>
              </div>
              <div className="text-center">
                <Zap className="w-4 h-4 mx-auto text-amber-500" />
                <span className="text-lg font-bold">
                  {targetEnergy != null ? `${Math.round(targetEnergy * 100)}%` : "—"}
                </span>
                <p className="text-[10px] text-muted-foreground">Energy</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mapping Links */}
        {mappings.length > 0 && (
          <div className="space-y-2">
            {mappings.map((mapping, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30"
              >
                <div className={cn("shrink-0", mapping.bioColor)}>
                  {mapping.bioIcon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{mapping.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {mapping.bioValue}{mapping.label === "Heart Rate" ? "" : "%"}
                    </span>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-all duration-700",
                        mapping.influence === "increasing"
                          ? "bg-primary"
                          : mapping.influence === "decreasing"
                          ? "bg-blue-400"
                          : "bg-muted-foreground/40"
                      )}
                      style={{ width: `${mapping.strength}%` }}
                    />
                  </div>
                </div>
                <div className={cn("shrink-0", actionColor)}>
                  {mapping.influence === "increasing" ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : mapping.influence === "decreasing" ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <Minus className="w-3 h-3" />
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[10px] text-muted-foreground">{mapping.musicParam}</span>
                  <p className="text-xs font-medium">{mapping.musicValue}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Current AI Action */}
        {action && (
          <div className="flex items-center gap-2 p-2 rounded-lg border border-primary/20 bg-primary/5">
            <div className={cn("shrink-0", actionColor)}>
              {actionIcon}
            </div>
            <div className="flex-1 min-w-0">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 mb-1">
                {action.replace(/_/g, " ")}
              </Badge>
              {reasoning && (
                <p className="text-[10px] text-muted-foreground line-clamp-2">{reasoning}</p>
              )}
            </div>
          </div>
        )}

        {/* Flow Score Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Flow Score</span>
            <span className="font-medium">{flowScore}%</span>
          </div>
          <Progress value={flowScore} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
