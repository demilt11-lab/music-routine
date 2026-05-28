import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useActivities } from "@/features/sessions/hooks";
import { useUpdateProfile } from "@/features/profile/hooks";

export default function Onboarding() {
  const navigate = useNavigate();
  const { data: activities = [] } = useActivities();
  const updateProfile = useUpdateProfile();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (key: string) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const finish = async () => {
    try {
      await updateProfile.mutateAsync({ onboarded: true, preferences: { favorites: selected } });
      navigate("/dashboard", { replace: true });
    } catch {
      toast.error("Couldn't save your preferences");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>What do you want BioMusic for?</CardTitle>
          <CardDescription>Pick the activities you care about. You can change these anytime.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {activities.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => toggle(a.key)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  selected.includes(a.key)
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-border",
                )}
              >
                <p className="font-medium">{a.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={finish} disabled={updateProfile.isPending}>
            {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
