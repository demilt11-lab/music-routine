import { Bell, BellOff, Clock, Brain, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  usePushNotifications,
  useLocalNotifications,
} from "@/hooks/usePushNotifications";
import { useWebPush } from "@/hooks/useWebPush";
import { useState } from "react";
import { toast } from "sonner";

const NotificationSettings = () => {
  const { isSupported, isRegistered, requestPermission } =
    usePushNotifications();
  const { scheduleSessionReminder } = useLocalNotifications();
  const webPush = useWebPush();
  const [sessionReminders, setSessionReminders] = useState(true);
  const [flowAlerts, setFlowAlerts] = useState(true);
  const [reminderTime, setReminderTime] = useState("15");

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success("Push notifications enabled!");
    }
  };

  const handleTestReminder = () => {
    scheduleSessionReminder(
      "🎵 Session Starting Soon",
      "Your scheduled BioMusic session begins in a few minutes. Get ready to flow!",
      1
    );
  };

  return (
    <div className="space-y-6">
      {/* Native push (Capacitor) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isRegistered ? (
            <Bell className="h-5 w-5 text-primary" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium text-foreground">
              Push Notifications
            </p>
            <p className="text-xs text-muted-foreground">
              {isSupported
                ? isRegistered
                  ? "Enabled — receiving alerts"
                  : "Tap to enable notifications"
                : "Available in the native app"}
            </p>
          </div>
        </div>
        {!isRegistered && isSupported && (
          <Button size="sm" variant="outline" onClick={handleEnable}>
            Enable
          </Button>
        )}
      </div>

      {/* Web Push */}
      {webPush.isSupported && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Browser Notifications
              </p>
              <p className="text-xs text-muted-foreground">
                {webPush.isSubscribed
                  ? "Enabled — receive alerts even when the tab is closed"
                  : "Get notified even when BioMusic isn't open"}
              </p>
            </div>
          </div>
          {webPush.isSubscribed ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={webPush.sendTestNotification}
                disabled={webPush.isLoading}
              >
                Test
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={webPush.unsubscribe}
                disabled={webPush.isLoading}
              >
                Disable
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={webPush.subscribe}
              disabled={webPush.isLoading}
            >
              {webPush.isLoading ? "…" : "Enable"}
            </Button>
          )}
        </div>
      )}

      <div className="space-y-4 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="session-reminders" className="text-sm">
              Session Reminders
            </Label>
          </div>
          <Switch
            id="session-reminders"
            checked={sessionReminders}
            onCheckedChange={setSessionReminders}
          />
        </div>

        {sessionReminders && (
          <div className="ml-7">
            <Select value={reminderTime} onValueChange={setReminderTime}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Remind me before" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 minutes before</SelectItem>
                <SelectItem value="15">15 minutes before</SelectItem>
                <SelectItem value="30">30 minutes before</SelectItem>
                <SelectItem value="60">1 hour before</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs text-muted-foreground"
              onClick={handleTestReminder}
            >
              Send test reminder
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="flow-alerts" className="text-sm">
              Flow State Alerts
            </Label>
          </div>
          <Switch
            id="flow-alerts"
            checked={flowAlerts}
            onCheckedChange={setFlowAlerts}
          />
        </div>

        {flowAlerts && (
          <p className="ml-7 text-xs text-muted-foreground">
            Get notified when you reach peak flow, when stress is detected, or
            when your session adapts to a new biometric zone.
          </p>
        )}
      </div>
    </div>
  );
};

export default NotificationSettings;
