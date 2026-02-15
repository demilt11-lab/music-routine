import { useMemo } from "react";
import { Heart, Brain, Sparkles, Activity, Music, Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";
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
  strength: number;
}

// Animated SVG connection line with flowing particles
function ConnectionLine({
  x1, y1, x2, y2,
  influence,
  strength,
  index,
}: {
  x1: number; y1: number; x2: number; y2: number;
  influence: "increasing" | "decreasing" | "stable";
  strength: number;
  index: number;
}) {
  const midX = (x1 + x2) / 2;
  const curveOffset = (index - 1) * 12; // spread curves vertically
  const midY = (y1 + y2) / 2 + curveOffset;
  const path = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;

  const strokeColor =
    influence === "increasing"
      ? "hsl(var(--primary))"
      : influence === "decreasing"
      ? "hsl(220, 70%, 60%)"
      : "hsl(var(--muted-foreground))";

  const opacity = Math.max(0.25, strength / 100);
  const particleCount = strength > 60 ? 3 : strength > 30 ? 2 : 1;
  const duration = influence === "stable" ? 4 : 2.5;

  return (
    <g>
      {/* Base path glow */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeOpacity={opacity * 0.3}
        filter="url(#glow)"
      />
      {/* Main path */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1}
        strokeOpacity={opacity}
        strokeDasharray="4 4"
      >
        <animate
          attributeName="stroke-dashoffset"
          from={influence === "decreasing" ? "0" : "80"}
          to={influence === "decreasing" ? "80" : "0"}
          dur={`${duration}s`}
          repeatCount="indefinite"
        />
      </path>
      {/* Flowing particles */}
      {Array.from({ length: particleCount }).map((_, i) => (
        <circle key={i} r={2.5} fill={strokeColor} opacity={opacity}>
          <animateMotion
            dur={`${duration + i * 0.4}s`}
            repeatCount="indefinite"
            begin={`${i * (duration / particleCount)}s`}
            path={path}
          />
          <animate
            attributeName="opacity"
            values={`0;${opacity};${opacity};0`}
            dur={`${duration + i * 0.4}s`}
            repeatCount="indefinite"
            begin={`${i * (duration / particleCount)}s`}
          />
          <animate
            attributeName="r"
            values="1.5;3;1.5"
            dur={`${duration + i * 0.4}s`}
            repeatCount="indefinite"
            begin={`${i * (duration / particleCount)}s`}
          />
        </circle>
      ))}
    </g>
  );
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

  // SVG layout constants
  const svgW = 360;
  const svgH = 160;
  const bioX = 60;
  const musicX = 300;
  const bioNodes = [
    { y: 30, label: `${heartRate}`, sub: "HR", icon: "♥", color: "hsl(0, 70%, 60%)" },
    { y: 80, label: `${stressLevel}%`, sub: "Stress", icon: "⚡", color: "hsl(30, 80%, 55%)" },
    { y: 130, label: `${focusScore}%`, sub: "Focus", icon: "🧠", color: "hsl(270, 60%, 55%)" },
  ];
  const musicNodes = [
    { y: 55, label: targetTempo ? `${targetTempo}` : "—", sub: "BPM", color: "hsl(var(--primary))" },
    { y: 105, label: targetEnergy != null ? `${Math.round(targetEnergy * 100)}%` : "—", sub: "Energy", color: "hsl(40, 80%, 55%)" },
  ];
  // Connection map: bio index -> music index
  const connections = [
    { bioIdx: 0, musicIdx: 0 }, // HR -> Tempo
    { bioIdx: 1, musicIdx: 1 }, // Stress -> Energy
    { bioIdx: 2, musicIdx: 0 }, // Focus -> Tempo
  ];

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
        {/* Animated Connection Diagram */}
        <div className="relative w-full flex justify-center">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full max-w-sm"
            style={{ height: "auto", aspectRatio: `${svgW}/${svgH}` }}
          >
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Connection lines */}
            {mappings.length > 0 && connections.map((conn, i) => {
              const mapping = mappings[conn.bioIdx];
              if (!mapping) return null;
              return (
                <ConnectionLine
                  key={i}
                  x1={bioX + 30}
                  y1={bioNodes[conn.bioIdx].y}
                  x2={musicX - 30}
                  y2={musicNodes[conn.musicIdx].y}
                  influence={mapping.influence}
                  strength={mapping.strength}
                  index={i}
                />
              );
            })}

            {/* Bio nodes */}
            {bioNodes.map((node, i) => (
              <g key={`bio-${i}`}>
                <circle
                  cx={bioX}
                  cy={node.y}
                  r={18}
                  fill="hsl(var(--card))"
                  stroke={node.color}
                  strokeWidth={2}
                  opacity={0.9}
                />
                <text
                  x={bioX}
                  y={node.y - 2}
                  textAnchor="middle"
                  fill={node.color}
                  fontSize="11"
                  fontWeight="bold"
                >
                  {node.label}
                </text>
                <text
                  x={bioX}
                  y={node.y + 10}
                  textAnchor="middle"
                  fill="hsl(var(--muted-foreground))"
                  fontSize="8"
                >
                  {node.sub}
                </text>
              </g>
            ))}

            {/* Music nodes */}
            {musicNodes.map((node, i) => (
              <g key={`music-${i}`}>
                <circle
                  cx={musicX}
                  cy={node.y}
                  r={18}
                  fill="hsl(var(--card))"
                  stroke={node.color}
                  strokeWidth={2}
                  opacity={0.9}
                />
                <text
                  x={musicX}
                  y={node.y - 2}
                  textAnchor="middle"
                  fill={node.color}
                  fontSize="11"
                  fontWeight="bold"
                >
                  {node.label}
                </text>
                <text
                  x={musicX}
                  y={node.y + 10}
                  textAnchor="middle"
                  fill="hsl(var(--muted-foreground))"
                  fontSize="8"
                >
                  {node.sub}
                </text>
              </g>
            ))}

            {/* Labels */}
            <text x={bioX} y={svgH - 4} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9" fontWeight="600" letterSpacing="0.05em">
              BODY
            </text>
            <text x={musicX} y={svgH - 4} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9" fontWeight="600" letterSpacing="0.05em">
              MUSIC
            </text>

            {/* Center flow state indicator */}
            <circle
              cx={svgW / 2}
              cy={svgH / 2}
              r={16}
              fill={
                flowState === "in-flow"
                  ? "hsla(140, 60%, 45%, 0.2)"
                  : flowState === "entering"
                  ? "hsla(45, 80%, 50%, 0.2)"
                  : "hsla(var(--muted), 0.3)"
              }
              stroke={
                flowState === "in-flow"
                  ? "hsl(140, 60%, 45%)"
                  : flowState === "entering"
                  ? "hsl(45, 80%, 50%)"
                  : "hsl(var(--muted-foreground))"
              }
              strokeWidth={2}
            >
              {flowState === "in-flow" && (
                <animate attributeName="r" values="14;18;14" dur="2s" repeatCount="indefinite" />
              )}
            </circle>
            <text
              x={svgW / 2}
              y={svgH / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={
                flowState === "in-flow"
                  ? "hsl(140, 60%, 45%)"
                  : flowState === "entering"
                  ? "hsl(45, 80%, 50%)"
                  : "hsl(var(--muted-foreground))"
              }
              fontSize="8"
              fontWeight="bold"
            >
              {flowState === "in-flow" ? "FLOW" : flowState === "entering" ? "ENTERING" : flowState === "exiting" ? "EXITING" : "IDLE"}
            </text>
          </svg>
        </div>

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
