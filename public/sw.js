/**
 * Kill-Switch (2026-08-26): Der alte Cache-First-Service-Worker (Mai-Ära)
 * hat Clients dauerhaft veraltete Stände serviert (HTML stale-while-
 * revalidate, _next/static für immer gepinnt, precachte /training-Route
 * existiert nicht mehr). Diese Version räumt bei bestehenden Installationen
 * alle Caches weg, deregistriert sich selbst und lädt offene Tabs neu.
 * Die Datei muss erreichbar BLEIBEN, bis alle Clients einmal online waren —
 * erst dann darf sie entfernt werden. Die Registrierung (PwaRegister) ist
 * aus dem Layout entfernt.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});
