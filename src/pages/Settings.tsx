import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Bell, ChevronRight, Loader2, Music, Save, ThumbsUp, User } from "lucide-react";
import NotificationSettings from "@/components/notifications/NotificationSettings";
import type { User as SupaUser } from "@supabase/supabase-js";

interface Preferences {
  theme: string;
  notifications: boolean;
  autoplay: boolean;
  sessionReminders: boolean;
  achievementAlerts: boolean;
  weeklySummaryEmails: boolean;
}

const Settings = () => {
  const [user, setUser] = useState<SupaUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [preferences, setPreferences] = useState<Preferences>({
    theme: "dark",
    notifications: true,
    autoplay: true,
    sessionReminders: true,
    achievementAlerts: true,
    weeklySummaryEmails: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/auth");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, preferences")
      .eq("id", user!.id)
      .single();

    if (data) {
      setDisplayName(data.display_name ?? "");
      setAvatarUrl(data.avatar_url ?? "");
      if (data.preferences && typeof data.preferences === "object" && !Array.isArray(data.preferences)) {
        const p = data.preferences as Record<string, unknown>;
        setPreferences({
          theme: p.theme as string ?? "dark",
          notifications: p.notifications as boolean ?? true,
          autoplay: p.autoplay as boolean ?? true,
          sessionReminders: p.sessionReminders as boolean ?? true,
          achievementAlerts: p.achievementAlerts as boolean ?? true,
          weeklySummaryEmails: p.weeklySummaryEmails as boolean ?? false,
        });
      }
    }
    if (error) console.error("Error fetching profile:", error);
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        avatar_url: avatarUrl || null,
        preferences: preferences as unknown as import("@/integrations/supabase/types").Json,
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to save profile");
      console.error(error);
    } else {
      toast.success("Profile updated!");
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Music className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Settings</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Profile
            </CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input
                id="avatarUrl"
                placeholder="https://example.com/avatar.png"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt="Avatar preview"
                  className="w-16 h-16 rounded-full object-cover border border-border mt-2"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Customize your experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Notifications</p>
                <p className="text-sm text-muted-foreground">Receive session reminders and insights</p>
              </div>
              <Switch
                checked={preferences.notifications}
                onCheckedChange={(v) => setPreferences((p) => ({ ...p, notifications: v }))}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Autoplay</p>
                <p className="text-sm text-muted-foreground">Automatically play the next track</p>
              </div>
              <Switch
                checked={preferences.autoplay}
                onCheckedChange={(v) => setPreferences((p) => ({ ...p, autoplay: v }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notification Preferences
            </CardTitle>
            <CardDescription>Choose which notifications you receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Session Reminders</p>
                <p className="text-sm text-muted-foreground">Get reminded to start your daily session</p>
              </div>
              <Switch
                checked={preferences.sessionReminders}
                onCheckedChange={(v) => setPreferences((p) => ({ ...p, sessionReminders: v }))}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Achievement Alerts</p>
                <p className="text-sm text-muted-foreground">Be notified when you earn badges or hit streaks</p>
              </div>
              <Switch
                checked={preferences.achievementAlerts}
                onCheckedChange={(v) => setPreferences((p) => ({ ...p, achievementAlerts: v }))}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Weekly Summary Emails</p>
                <p className="text-sm text-muted-foreground">Receive a weekly email with your session stats</p>
              </div>
              <Switch
                checked={preferences.weeklySummaryEmails}
                onCheckedChange={(v) => setPreferences((p) => ({ ...p, weeklySummaryEmails: v }))}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>Configure push notifications and alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <NotificationSettings />
          </CardContent>
        </Card>

        {/* Track Feedback */}
        <Card
          className="cursor-pointer hover:border-primary/30 transition-colors"
          onClick={() => navigate("/feedback")}
        >
          <CardContent className="flex items-center gap-4 py-5">
            <div className="rounded-full bg-accent/10 p-2">
              <ThumbsUp className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Track Preferences</p>
              <p className="text-sm text-muted-foreground">
                View and manage your music feedback history
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </main>
    </div>
  );
};

export default Settings;
