/// <reference lib="webworker" />

const CACHE_NAME = "biomusic-v1";
const hostname = self.location.hostname;

// Self-destruct ONLY on localhost — keep alive on all deployed domains
if (hostname === "localhost" || hostname === "127.0.0.1") {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      self.clients.claim().then(() => self.registration.unregister())
    );
  });
} else {
  // ── INSTALL: precache shell ──
  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) =>
        cache.addAll(["/", "/app-icon.png", "/manifest.json"])
      )
    );
    self.skipWaiting();
  });

  // ── ACTIVATE: clean old caches ──
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ).then(() => self.clients.claim())
    );
  });

  // ── FETCH: network-first for navigations & API, cache-first for assets ──
  self.addEventListener("fetch", (event) => {
    const { request } = event;

    // Skip non-GET and cross-origin API calls
    if (request.method !== "GET") return;

    // Never cache Supabase or OAuth requests
    if (request.url.includes("supabase") || request.url.includes("/~oauth")) return;

    if (request.mode === "navigate") {
      // Network-first for pages
      event.respondWith(
        fetch(request)
          .then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
          .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
      );
      return;
    }

    // Cache-first for static assets
    if (request.destination === "image" || request.destination === "style" || request.destination === "script" || request.destination === "font") {
      event.respondWith(
        caches.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          });
        })
      );
      return;
    }
  });

  // ── PUSH NOTIFICATIONS ──
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
