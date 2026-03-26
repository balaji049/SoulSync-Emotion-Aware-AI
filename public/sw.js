self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

// Network passthrough to avoid stale-cache issues during development.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request))
})
