// SİLVAN CEBİMDE — push bildirim service worker.
// Sekme/uygulama kapalıyken de bildirim gösterebilmek için gereklidir.

self.addEventListener("push", (event) => {
  let payload = { title: "SİLVAN CEBİMDE", body: "Yeni bir bildiriminiz var." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // JSON değilse varsayılan metin kullanılır
  }

  const options = {
    body: payload.body,
    icon: "/app-icon-192.png",
    badge: "/app-icon-192.png",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          await client.focus();
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
