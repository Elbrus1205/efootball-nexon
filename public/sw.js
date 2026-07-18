self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("nexon-shell-v1").then((cache) =>
      cache.addAll([
        "/offline.html",
        "/icons/efootball-nexon-app-192-v2.png",
        "/icons/efootball-nexon-app-512-v2.png",
      ]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== "nexon-shell-v1").map((key) => caches.delete(key))),
      ),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // HTML is never stored: authenticated pages and APIs must not leak through a
  // shared cache. The pre-cached document is only a network-failure fallback.
  event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "eFootball Nexon", {
      body: payload.body || "Новое уведомление",
      icon: payload.icon || "/icons/efootball-nexon-app-192-v2.png",
      badge: payload.badge || "/icons/efootball-nexon-app-192-v2.png",
      tag: payload.tag || "efootball-nexon",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url === targetUrl);
      return existing ? existing.focus() : self.clients.openWindow(targetUrl);
    }),
  );
});
