self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: "Aquarium Logbuch",
      body: event.data ? event.data.text() : "Zeit für deine Pflege-Aufgabe.",
    };
  }

  const title = data.title || "Aquarium Logbuch";
  const options = {
    body: data.body || "Zeit für deine Pflege-Aufgabe.",
    icon: data.icon || "/icon-192.png",
    data: {
      url: data.url || "/",
    },
    vibrate: [120, 60, 120],
    tag: data.tag || "aquarium-reminder",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
