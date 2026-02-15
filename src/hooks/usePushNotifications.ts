import { useEffect, useCallback, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

interface NotificationState {
  isSupported: boolean;
  isRegistered: boolean;
  token: string | null;
}

export const usePushNotifications = () => {
  const [state, setState] = useState<NotificationState>({
    isSupported: false,
    isRegistered: false,
    token: null,
  });

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    setState((prev) => ({ ...prev, isSupported: isNative }));

    if (!isNative) return;

    const setup = async () => {
      try {
        const { PushNotifications } = await import(
          "@capacitor/push-notifications"
        );

        await PushNotifications.addListener("registration", (token) => {
          console.log("Push registration success:", token.value);
          setState((prev) => ({
            ...prev,
            isRegistered: true,
            token: token.value,
          }));
        });

        await PushNotifications.addListener("registrationError", (err) => {
          console.error("Push registration error:", err);
        });

        await PushNotifications.addListener(
          "pushNotificationReceived",
          (notification) => {
            toast(notification.title ?? "BioMusic", {
              description: notification.body,
            });
          }
        );

        await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            console.log("Push action performed:", action.actionId);
          }
        );
      } catch (e) {
        console.warn("Push notification setup skipped:", e);
      }
    };

    setup();
  }, []);

  const requestPermission = useCallback(async () => {
    if (!state.isSupported) {
      toast.info("Push notifications are available in the native app.");
      return false;
    }

    try {
      const { PushNotifications } = await import(
        "@capacitor/push-notifications"
      );
      const result = await PushNotifications.requestPermissions();
      if (result.receive === "granted") {
        await PushNotifications.register();
        return true;
      }
      toast.error("Push notification permission denied.");
      return false;
    } catch {
      return false;
    }
  }, [state.isSupported]);

  return { ...state, requestPermission };
};

export const useLocalNotifications = () => {
  const isSupported = Capacitor.isNativePlatform();

  const scheduleSessionReminder = useCallback(
    async (title: string, body: string, minutesBefore: number) => {
      if (!isSupported) return;

      try {
        const { LocalNotifications } = await import(
          "@capacitor/local-notifications"
        );
        const perms = await LocalNotifications.requestPermissions();
        if (perms.display !== "granted") return;

        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 100000),
              title,
              body,
              schedule: {
                at: new Date(Date.now() + minutesBefore * 60 * 1000),
              },
              sound: undefined,
              smallIcon: "ic_notification",
              largeIcon: "ic_notification",
            },
          ],
        });

        toast.success(`Reminder set for ${minutesBefore} minutes from now`);
      } catch (e) {
        console.warn("Local notification error:", e);
      }
    },
    [isSupported]
  );

  const scheduleFlowAlert = useCallback(
    async (message: string) => {
      if (!isSupported) return;

      try {
        const { LocalNotifications } = await import(
          "@capacitor/local-notifications"
        );

        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 100000),
              title: "🧠 Flow State Alert",
              body: message,
              schedule: { at: new Date(Date.now() + 1000) },
              sound: undefined,
              smallIcon: "ic_notification",
              largeIcon: "ic_notification",
            },
          ],
        });
      } catch (e) {
        console.warn("Flow alert error:", e);
      }
    },
    [isSupported]
  );

  return { isSupported, scheduleSessionReminder, scheduleFlowAlert };
};
