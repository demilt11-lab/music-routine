import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Loader2,
  Moon,
  Music,
  Palette,
  Save,
  Sun,
  ThumbsUp,
  User,
} from "lucide-react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";

const NotificationSettings = lazy(() => import("@/components/notifications/NotificationSettings"));

interface Preferences {
  theme: "light" | "dark" | "system";
  notifications: boolean;
  autoplay: boolean;
  sessionReminders: boolean;
  achievementAlerts: boolean;
  weeklySummaryEmails: boolean;
}

interface SettingsForm {
  displayName: string;
  avatarUrl: string;
  preferences: Preferences;
}

const defaultPreferences: Preferences = {
  theme: "dark",
  notifications: true,
  autoplay: true,
  sessionReminders: true,
  achievementAlerts: true,
  weeklySummaryEmails: false,
};

const defaultForm: SettingsForm = {
  displayName: "",
  avatarUrl: "",
  preferences: defaultPreferences,
};

const themeOptions = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Palette },
];

const preferenceRows = [
  {
    key: "notifications" as const,
    title: "Notifications",
    description: "Receive session reminders and insights",
  },
  {
    key: "autoplay" as const,
    title: "Autoplay",
    description: "Automatically play the next track",
  },
];

const notificationRows = [
  {
    key: "sessionReminders" as const,
    title: "Session Reminders",
    description: "Get reminded to start your daily session",
  },
  {
    key: "achievementAlerts" as const,
    title: "Achievement Alerts",
    description: "Be notified when you earn badges or hit streaks",
  },
  {
    key: "weeklySummaryEmails" as const,
    title: "Weekly Summary Emails",
    description: "Receive a weekly email with your session stats",
  },
];

const SettingsHeader = memo(function SettingsHeader({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <header className="border-b border-border">
      <div className="container mx-auto flex items-center gap-4 px-4 py-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Music className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">Settings</span>
        </div>
      </div>
    </header>
  );
});

const ProfileCard = memo(function ProfileCard({
  email,
  displayName,
  avatarUrl,
  onFieldChange,
}: {
  email: string;
  displayName: string;
  avatarUrl: string;
  onFieldChange: (field: "displayName" | "avatarUrl", value: string) => void;
}) {
  const showAvatarPreview = avatarUrl.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Profile
        </CardTitle>
        <CardDescription>Update your personal information</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} disabled className="bg-muted" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => onFieldChange("displayName", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="avatarUrl">Avatar URL</Label>
          <Input
            id="avatarUrl"
            placeholder="https://example.com/avatar.png"
            value={avatarUrl}
            onChange={(e) => onFieldChange("avatarUrl", e.target.value)}
          />

          {showAvatarPreview ? (
            <img
              src={avatarUrl}
              alt="Avatar preview"
              className="mt-2 h-16 w-16 rounded-full border border-border object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
});

const AppearanceCard = memo(function AppearanceCard({
  activeTheme,
  onThemeChange,
}: {
  activeTheme?: string;
  onThemeChange: (theme: "light" | "dark" | "system") => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          Appearance
        </CardTitle>
        <CardDescription>Choose your preferred theme</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map(({ value, label, icon: Icon }) => {
            const isActive = activeTheme === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => onThemeChange(value)}
                className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

const ToggleCard = memo(function ToggleCard({
  title,
  description,
  icon,
  rows,
  preferences,
  onToggle,
}: {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  rows: { key: keyof Preferences; title: string; description: string }[];
  preferences: Preferences;
  onToggle: (key: keyof Preferences, value: boolean) => void;
}) {
  const Icon = icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {rows.map((row, index) => (
          <div key={row.key}>
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="font-medium">{row.title}</p>
                <p className="text-sm text-muted-foreground">{row.description}</p>
              </div>

              <Switch
                checked={Boolean(preferences[row.key])}
                onCheckedChange={(value) => onToggle(row.key, value)}
              />
            </div>

            {index < rows.length - 1 ? <Separator className="mt-6" /> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
});

const FeedbackNavigationCard = memo(function FeedbackNavigationCard({
  onNavigate,
}: {
  onNavigate: () => void;
}) {
  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/30"
      onClick={onNavigate}
    >
      <CardContent className="flex items-center gap-4 py-5">
        <div className="rounded-full bg-accent/10 p-2">
          <ThumbsUp className="h-5 w-5 text-accent" />
        </div>

        <div className="flex-1">
          <p className="font-medium text-foreground">Track Preferences</p>
          <p className="text-sm text-muted-foreground">
            View and manage your music feedback history
          </p>
        </div>

        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
});

const Settings = () => {
  const { user, isReady } = useAuthReady();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [form, setForm] = useState<SettingsForm>(defaultForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isReady && !user) {
      navigate("/auth", { replace: true });
    }
  }, [isReady, user, navigate]);

  useEffect(() => {
    if (!isReady || !user) return;

    let isMounted = true;

    const fetchProfile = async () => {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, preferences")
        .eq("id", user.id)
        .single();

      if (!isMounted) return;

      if (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load settings");
        setIsLoading(false);
        return;
      }

      const preferenceSource =
        data?.preferences && typeof data.preferences === "object" && !Array.isArray(data.preferences)
          ? (data.preferences as Record<string, unknown>)
          : {};

      setForm({
        displayName: data?.display_name ?? "",
        avatarUrl: data?.avatar_url ?? "",
        preferences: {
          theme: (preferenceSource.theme as Preferences["theme"]) ?? "dark",
          notifications: (preferenceSource.notifications as boolean) ?? true,
          autoplay: (preferenceSource.autoplay as boolean) ?? true,
          sessionReminders: (preferenceSource.sessionReminders as boolean) ?? true,
          achievementAlerts: (preferenceSource.achievementAlerts as boolean) ?? true,
          weeklySummaryEmails: (preferenceSource.weeklySummaryEmails as boolean) ?? false,
        },
      });

      setIsLoading(false);
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [isReady, user]);

  const hasUnsavedChanges = useMemo(() => {
    return (
      form.displayName !== defaultForm.displayName ||
      form.avatarUrl !== defaultForm.avatarUrl ||
      JSON.stringify(form.preferences) !== JSON.stringify(defaultForm.preferences)
    );
  }, [form]);

  const handleBack = useCallback(() => {
    navigate("/dashboard");
  }, [navigate]);

  const handleFeedbackNavigate = useCallback(() => {
    navigate("/feedback");
  }, [navigate]);

  const handleFieldChange = useCallback(
    (field: "displayName" | "avatarUrl", value: string) => {
      setForm((current) => ({
        ...current,
        [field]: value,
      }));
    },
    []
  );

  const handlePreferenceToggle = useCallback((key: keyof Preferences, value: boolean) => {
    setForm((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        [key]: value,
      },
    }));
  }, []);

  const handleThemeChange = useCallback(
    (nextTheme: "light" | "dark" | "system") => {
      setTheme(nextTheme);
      setForm((current) => ({
        ...current,
        preferences: {
          ...current.preferences,
          theme: nextTheme,
        },
      }));
    },
    [setTheme]
  );

  const handleSave = useCallback(async () => {
    if (!user || isSaving) return;

    setIsSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.displayName || null,
        avatar_url: form.avatarUrl || null,
        preferences: form.preferences as unknown as Json,
      })
      .eq("id", user.id);

    if (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
      setIsSaving(false);
      return;
    }

    toast.success("Profile updated!");
    setIsSaving(false);
  }, [form, isSaving, user]);

  if (!isReady) {
    return <DashboardSkeleton />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SettingsHeader onBack={handleBack} />

      <main className="container mx-auto max-w-2xl space-y-6 px-4 py-8">
        <ProfileCard
          email={user?.email ?? ""}
          displayName={form.displayName}
          avatarUrl={form.avatarUrl}
          onFieldChange={handleFieldChange}
        />

        <AppearanceCard activeTheme={theme} onThemeChange={handleThemeChange} />

        <ToggleCard
          title="Preferences"
          description="Customize your experience"
          rows={preferenceRows}
          preferences={form.preferences}
          onToggle={handlePreferenceToggle}
        />

        <ToggleCard
          title="Notification Preferences"
          description="Choose which notifications you receive"
          icon={Bell}
          rows={notificationRows}
          preferences={form.preferences}
          onToggle={handlePreferenceToggle}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>Configure push notifications and alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense
              fallback={
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading notification settings...
                </div>
              }
            >
              <NotificationSettings />
            </Suspense>
          </CardContent>
        </Card>

        <FeedbackNavigationCard onNavigate={handleFeedbackNavigate} />

        <Button
          className="w-full"
          size="lg"
          onClick={handleSave}
          disabled={isSaving || !hasUnsavedChanges}
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </main>
    </div>
  );
};

export default Settings;
