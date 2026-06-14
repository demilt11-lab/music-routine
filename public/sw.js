/// <reference lib="webworker" />

// ── Cache versioning ──────────────────────────────────────────────────────────
// Bump CACHE_VERSION on every production deploy to bust stale assets.
// In CI, this value should be replaced with the build hash via sed/envsubst.
const CACHE_VERSION = "biomusic-v3";
const CACHE_NAME = CACHE_VERSION;

const hostname = self.location.hostname;

// Self-destruct on localhost — dev mode should never serve stale assets
if (hostname === "localhost" || hostname === "127.0.0.1") {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      self.clients.claim().then(() => self.registration.unregister())
    );
  });
} else {
  // ── INSTALL: precache critical shell (including offline fallback) ───────────
  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) =>
        // offline.html MUST be precached so it's available without a network
        cache.addAll(["/", "/offline.html", "/app-icon.png", "/manifest.json"])
      ).then(() => self.skipWaiting())
    );
  });

  // ── ACTIVATE: delete all old cache versions ────────────────────────────────
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      ).then(() => self.clients.claim())
    );
  });

  // ── FETCH ──────────────────────────────────────────────────────────────────
  self.addEventListener("fetch", (event) => {
    const { request } = event;

    // Only handle GET; skip cross-origin Supabase/OAuth API calls
    if (request.method !== "GET") return;
    if (
      request.url.includes("supabase.co") ||
      request.url.includes("/~oauth") ||
      request.url.includes("lovableproject.com")
    ) return;

    if (request.mode === "navigate") {
      // Network-first for page navigations; fall back to cached page, then offline.html
      event.respondWith(
        fetch(request)
          .then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
          .catch(() =>
            caches.match(request)
              .then((cached) => cached || caches.match("/offline.html"))
          )
      );
      return;
    }

    // Stale-while-revalidate for scripts and styles:
    // Serve cached version immediately (fast), but always fetch a fresh copy
    // in the background so the next load gets up-to-date code.
    // Never serve stale scripts beyond one generation — delete on revalidate.
    if (
      request.destination === "script" ||
      request.destination === "style"
    ) {
      event.respondWith(
        caches.open(CACHE_NAME).then((cache) =>
          cache.match(request).then((cached) => {
            const networkFetch = fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            });
            // Return cached immediately; background-update for next visit
            return cached || networkFetch;
          })
        )
      );
      return;
    }

    // Cache-first for immutable assets (images, fonts) — safe to cache long-term
    if (
      request.destination === "image" ||
      request.destination === "font"
    ) {
      event.respondWith(
        caches.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          });
        })
      );
      return;
    }
  });

  // ── PUSH NOTIFICATIONS ─────────────────────────────────────────────────────
  self.addEventListener("push", (event) => {
    let data = { title: "BioMusic", body: "You have a new notification", url: "/" };
    if (event.data) {
      try {
        const parsed = event.data.json();
        // Only accept string fields from push payload — no object injection
        data = {
          title:   typeof parsed.title === "string" ? parsed.title : "BioMusic",
          body:    typeof parsed.body  === "string" ? parsed.body  : "You have a new notification",
          url:     typeof parsed.url   === "string" ? parsed.url   : "/",
          actions: Array.isArray(parsed.actions)    ? parsed.actions : [],
        };
      } catch {
        data.body = event.data.text();
      }
    }

    // Validate URL is same-origin before storing — prevents open redirect on click
    const safeUrl = isSameOrigin(data.url) ? data.url : "/";

    const options = {
      body:      data.body,
      icon:      "/icons/icon-192x192.png",
      badge:     "/icons/icon-192x192.png",
      vibrate:   [100, 50, 100],
      data:      { url: safeUrl },
      actions:   data.actions || [],
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  });

  self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    // Re-validate URL on click — defence in depth against tampered notification data
    const rawUrl = event.notification.data?.url || "/";
    const url = isSameOrigin(rawUrl) ? rawUrl : "/";

    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url.startsWith(self.location.origin) && "focus" in client) {
              client.navigate(url);
              return client.focus();
            }
          }
          return self.clients.openWindow(url);
        })
    );
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function isSameOrigin(url) {
  if (!url || typeof url !== "string") return false;
  // Relative paths are always safe
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
}
