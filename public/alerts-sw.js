// Shows Horses Tour alerts (birdies, lead changes, final cards). They're
// sent by the live scoring Google script through Firebase Cloud Messaging
// as data messages: { title, body, url, tag }.
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  let payload
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { data: { body: event.data ? event.data.text() : "" } }
  }
  const data = payload.data || {}
  const note = payload.notification || {}
  const title = data.title || note.title || "Horses Tour"
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || note.body || "",
    icon: "apple-touch-icon.png",
    badge: "favicon-64.png",
    tag: data.tag || undefined,
    data: { url: data.url || "./live" },
  }))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || "./live", self.registration.scope).href
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    const client = open.find((c) => c.url.startsWith(self.registration.scope))
    if (client) {
      await client.focus()
      if ("navigate" in client) return client.navigate(url)
      return undefined
    }
    return self.clients.openWindow(url)
  })())
})
