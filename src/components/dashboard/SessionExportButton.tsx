import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface SessionData {
  id: string;
  name: string | null;
  started_at: string;
  ended_at: string | null;
  mood_before: string | null;
  mood_after: string | null;
  notes: string | null;
  avgHeartRate: number;
  avgFocus: number;
  avgRelaxation: number;
  avgStress: number;
  flowScore: number;
  duration: number;
  activity_types: { name: string } | null;
}

export const SessionExportButton = ({ sessions }: { sessions: SessionData[] }) => {
  const [exporting, setExporting] = useState(false);

  const exportCSV = () => {
    if (sessions.length === 0) {
      toast.info("No sessions to export");
      return;
    }
    setExporting(true);
    try {
      const headers = ["Date", "Activity", "Name", "Duration (min)", "Avg HR (bpm)", "Focus %", "Relaxation %", "Stress %", "Flow Score %", "Mood Before", "Mood After", "Notes"];
      const rows = sessions.map((s) => [
        format(new Date(s.started_at), "yyyy-MM-dd HH:mm"),
        s.activity_types?.name || "Unknown",
        s.name || "",
        s.duration.toString(),
        s.avgHeartRate.toString(),
        s.avgFocus.toString(),
        s.avgRelaxation.toString(),
        s.avgStress.toString(),
        s.flowScore.toString(),
        s.mood_before || "",
        s.mood_after || "",
        (s.notes || "").replace(/"/g, '""'),
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `biomusic-sessions-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Sessions exported!");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={exportCSV} disabled={exporting}>
      <Download className="w-4 h-4 mr-2" />
      {exporting ? "Exporting..." : "Export CSV"}
    </Button>
  );
};
