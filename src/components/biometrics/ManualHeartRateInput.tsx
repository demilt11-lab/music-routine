import { useState } from "react";
import { Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ManualHeartRateInputProps {
  sessionId?: string;
}

export function ManualHeartRateInput({ sessionId }: ManualHeartRateInputProps) {
  const [hr, setHr] = useState("");
  const [saving, setSaving] = useState(false);

  const handleLog = async () => {
    const val = parseInt(hr, 10);
    if (isNaN(val) || val < 30 || val > 250) {
      toast({ title: "Invalid heart rate", description: "Enter a value between 30–250 bpm.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Not signed in", description: "Please sign in to log readings.", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from("biometric_readings").insert({
        user_id: user.id,
        heart_rate: val,
        device_type: "manual_input",
        recorded_at: new Date().toISOString(),
        session_id: sessionId || null,
      });

      if (error) throw error;
      toast({ title: "Logged!", description: `Heart rate ${val} bpm saved.` });
      setHr("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-500" />
          Manual Heart Rate
        </CardTitle>
        <CardDescription className="text-xs">
          Enter your reading from Apple Watch or Health app
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="72"
            min={30}
            max={250}
            value={hr}
            onChange={(e) => setHr(e.target.value)}
            className="flex-1 touch-manipulation"
            onKeyDown={(e) => e.key === "Enter" && handleLog()}
          />
          <span className="flex items-center text-sm text-muted-foreground">bpm</span>
          <Button
            onClick={handleLog}
            disabled={saving || !hr}
            size="sm"
            className="touch-manipulation min-w-[44px] min-h-[44px]"
          >
            {saving ? "…" : "Log"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
