import { useRef, useEffect } from "react";
import {
  TrendingUp, TrendingDown, Zap, Minus, Target,
  Music2, Clock, Heart, Brain, Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface AdaptationEvent {
  id: string;
  timestamp: Date;
  type: "recommendation" | "track_change" | "flow_shift" | "spotify_queue" | "biometric_trigger";
  title: string;
  description: string;
  details?: {
    action?: string;
    targetTempo?: number;
    targetEnergy?: number;
    source?: string;
    flowState?: string;
  };
}

interface LiveAdaptationFeedProps {
  events: AdaptationEvent[];
  maxVisible?: number;
}

const typeIcons: Record<string, React.ReactNode> = {
  recommendation: <Sparkles className="w-3.5 h-3.5" />,
  track_change: <Music2 className="w-3.5 h-3.5" />,
  flow_shift: <Brain className="w-3.5 h-3.5" />,
  spotify_queue: <Music2 className="w-3.5 h-3.5" />,
  biometric_trigger: <Heart className="w-3.5 h-3.5" />,
};

const typeColors: Record<string, string> = {
  recommendation: "bg-primary/10 text-primary border-primary/20",
  track_change: "bg-accent/50 text-accent-foreground border-accent",
  flow_shift: "bg-secondary/50 text-secondary-foreground border-secondary",
  spotify_queue: "bg-primary/10 text-primary border-primary/20",
  biometric_trigger: "bg-destructive/10 text-destructive border-destructive/20",
};

const actionBadgeColors: Record<string, string> = {
  increase_tempo: "bg-primary/20 text-primary",
  decrease_tempo: "bg-secondary text-secondary-foreground",
  increase_energy: "bg-primary/20 text-primary",
  decrease_energy: "bg-muted text-muted-foreground",
  maintain: "bg-accent text-accent-foreground",
  change_genre: "bg-secondary text-secondary-foreground",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function LiveAdaptationFeed({ events, maxVisible = 50 }: LiveAdaptationFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleEvents = events.slice(0, maxVisible);

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length]);

  if (visibleEvents.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-border bg-muted/30 text-center">
        <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">
          Adaptation events will appear here as the AI adjusts your music
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-medium text-foreground">Live Adaptation Feed</span>
        <Badge variant="secondary" className="text-xs ml-auto">
          {visibleEvents.length} events
        </Badge>
      </div>
      <ScrollArea className="h-[280px]" ref={scrollRef}>
        <div className="p-2 space-y-1.5">
          {visibleEvents.map((event) => (
            <div
              key={event.id}
              className={cn(
                "flex gap-2 p-2 rounded-md border text-sm transition-all animate-in fade-in slide-in-from-top-1 duration-300",
                typeColors[event.type] || "bg-muted/30 border-border"
              )}
            >
              <div className="mt-0.5 shrink-0">
                {typeIcons[event.type] || <Target className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-xs">{event.title}</span>
                  {event.details?.action && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        actionBadgeColors[event.details.action] || ""
                      )}
                    >
                      {event.details.action === "increase_tempo" && <TrendingUp className="w-2.5 h-2.5 mr-0.5" />}
                      {event.details.action === "decrease_tempo" && <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                      {event.details.action === "increase_energy" && <Zap className="w-2.5 h-2.5 mr-0.5" />}
                      {event.details.action === "decrease_energy" && <Minus className="w-2.5 h-2.5 mr-0.5" />}
                      {event.details.action.replace("_", " ")}
                    </Badge>
                  )}
                  {event.details?.source && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {event.details.source}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {event.description}
                </p>
                {(event.details?.targetTempo || event.details?.targetEnergy) && (
                  <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                    {event.details.targetTempo && (
                      <span>{event.details.targetTempo} BPM</span>
                    )}
                    {event.details.targetEnergy !== undefined && (
                      <span>{Math.round(event.details.targetEnergy * 100)}% energy</span>
                    )}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                {formatTime(event.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
