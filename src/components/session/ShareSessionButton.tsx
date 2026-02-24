import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface ShareSessionButtonProps {
  activityName: string;
  durationSeconds: number;
  avgHeartRate?: number;
  flowPercentage?: number;
}

export function ShareSessionButton({ activityName, durationSeconds, avgHeartRate, flowPercentage }: ShareSessionButtonProps) {
  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    return m > 0 ? `${m} min` : `${s}s`;
  };

  const handleShare = async () => {
    const lines = [
      `🎵 BioMusic Session Complete!`,
      `Activity: ${activityName}`,
      `Duration: ${formatDuration(durationSeconds)}`,
    ];
    if (avgHeartRate) lines.push(`💓 Avg HR: ${avgHeartRate} bpm`);
    if (flowPercentage != null) lines.push(`🎯 Flow: ${flowPercentage}%`);
    lines.push("", "Track your flow state with BioMusic");

    const text = lines.join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: "BioMusic Session", text });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: "Session summary copied to clipboard." });
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleShare} className="touch-manipulation min-h-[44px]">
      <Share2 className="w-4 h-4 mr-2" />
      Share Session
    </Button>
  );
}
