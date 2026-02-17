import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WebPushState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
}

// The VAPID public key needs to be available client-side.
// We fetch it from an edge function so we don't hardcode it.
let cachedVapidKey: string | null = null;

async function getVapidPublicKey(): Promise<string | null> {
  if (cachedVapidKey) return cachedVapidKey;
  try {
    const { data, error } = await supabase.functions.invoke("get-vapid-key");
    if (error) throw error;
    cachedVapidKey = data.vapidPublicKey;
    return cachedVapidKey;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const useWebPush = () => {
  const [state, setState] = useState<WebPushState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
  });

  useEffect(() => {
    const check = async () => {
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!supported) {
        setState({ isSupported: false, isSubscribed: false, isLoading: false });
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const pm = (registration as any).pushManager;
        const subscription = await pm?.getSubscription();
        setState({
          isSupported: true,
          isSubscribed: !!subscription,
          isLoading: false,
        });
      } catch {
        setState({ isSupported: true, isSubscribed: false, isLoading: false });
      }
    };
    check();
  }, []);

  const subscribe = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied.");
        setState((prev) => ({ ...prev, isLoading: false }));
        return false;
      }

      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) {
        toast.error("Could not retrieve push configuration.");
        setState((prev) => ({ ...prev, isLoading: false }));
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const pm = (registration as any).pushManager;
      const subscription = await pm.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJson = subscription.toJSON();

      // Save to database
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to enable notifications.");
        setState((prev) => ({ ...prev, isLoading: false }));
        return false;
      }

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: subJson.keys!.p256dh!,
          auth: subJson.keys!.auth!,
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) throw error;

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
      }));
      toast.success("Web push notifications enabled!");
      return true;
    } catch (err) {
      console.error("Web push subscribe error:", err);
      toast.error("Failed to enable web push notifications.");
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const registration = await navigator.serviceWorker.ready;
      const pm = (registration as any).pushManager;
      const subscription = await pm?.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user.id)
            .eq("endpoint", endpoint);
        }
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));
      toast.info("Web push notifications disabled.");
    } catch (err) {
      console.error("Web push unsubscribe error:", err);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const sendTestNotification = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke(
        "send-push-notification",
        {
          body: {
            title: "🎵 BioMusic Test",
            body: "Web push notifications are working!",
          },
        }
      );
      if (error) throw error;
      toast.success("Test notification sent!");
    } catch (err) {
      console.error("Test notification error:", err);
      toast.error("Failed to send test notification.");
    }
  }, []);

  return { ...state, subscribe, unsubscribe, sendTestNotification };
};
