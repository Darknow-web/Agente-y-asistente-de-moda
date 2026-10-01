/* SASTRA — service worker: solo notificaciones push (no cachea la app). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let datos = { titulo: 'SASTRA', cuerpo: '', url: '/avisos', etiqueta: 'sastra' };
  try {
    datos = { ...datos, ...e.data.json() };
  } catch {
    if (e.data) datos.cuerpo = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.cuerpo,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: datos.etiqueta,
      data: { url: datos.url },
      lang: 'es',
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/avisos';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ('focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
