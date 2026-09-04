self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Fund AI Pro", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Fund AI Pro";
  const options = {
    body: data.body || "有新的基金提醒",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || "fund-ai-pro",
    renotify: true,
    data: data.data || { url: "/portfolio" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/portfolio";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const sameOrigin = clients.find((client) => client.url.startsWith(self.location.origin));
    if (sameOrigin) return sameOrigin.focus().then(() => sameOrigin.navigate(url));
    return self.clients.openWindow(url);
  }));
});
