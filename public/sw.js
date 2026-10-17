/* Avisos push del navegador: llegan aunque la pestaña esté en segundo plano o cerrada. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { title: "Aviso", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Con la pestaña a la vista, la propia página avisa (sonido + notificación): solo se le pide refrescar.
      const visible = ventanas.filter((w) => w.visibilityState === "visible");
      if (visible.length) {
        visible.forEach((w) => w.postMessage({ tipo: "push" }));
        return;
      }
      await self.registration.showNotification(d.title || "Aviso", {
        body: d.body || "",
        tag: d.tag,
        data: { url: d.url || "/" },
        renotify: Boolean(d.tag),
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of ventanas) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus();
          // La app es una SPA: se le pide navegar sin recargar.
          w.postMessage({ tipo: "ir", url: destino });
          return;
        }
      }
      await self.clients.openWindow(destino);
    })()
  );
});
