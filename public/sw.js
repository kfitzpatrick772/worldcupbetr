// Minimal service worker — its only job is to make the site installable
// ("Add to Home Screen") on Android/Chrome. Pass-through: no caching, no
// offline behavior, so it can never serve stale data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Intentionally empty — every request is handled by the browser as normal.
});
