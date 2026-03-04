/// <reference lib="webworker" />

// Self-destruct in non-production environments
const hostname = self.location.hostname;
if (
  hostname.includes("lovableproject.com") ||
  hostname.includes("localhost") ||
  hostname.startsWith("id-preview--")
) {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      self.clients.claim().then(() =>
        self.registration.unregister()
      )
    );
  });
  // Stop executing — no caching, no push handling in dev/preview
} else {
  // Push event – display the notification
  self.addEventListener("push", (event) => {
    let data = { title: "BioMusic", body: "You have a new notification" };

    if (event.data) {
      try {
        data = event.data.json();
      } catch {
        data.body = event.data.text();
      }
    }

    const options = {
      body: data.body,
      icon: "/app-icon.png",
      badge: "/app-icon.png",
      vibrate: [100, 50, 100],
      data: { url: data.url || "/" },
      actions: data.actions || [],
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  });

  // Notification click – open or focus the app
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const url = event.notification.data?.url || "/";

    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && "focus" in client) {
              client.navigate(url);
              return client.focus();
            }
          }
          return self.clients.openWindow(url);
        })
    );
  });
}
