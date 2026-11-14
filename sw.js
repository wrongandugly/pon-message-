/* =====================================================================
   PON — service worker (arquivo de verdade, na raiz do repo)
   Faz duas coisas:
   1) PUSH: recebe o aviso da Edge Function "send-push" e mostra a
      notificação do sistema — mas só se o app NÃO estiver aberto e
      visível (app aberto já treme e toca o som sozinho).
   2) Rede-primeiro nas navegações: deploy novo nunca fica preso
      atrás de cache velho.
   ===================================================================== */

self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function (e) {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(function () { return caches.match(e.request); })
    );
  }
});

self.addEventListener('push', function (e) {
  var data = {};
  if (e.data) {
    try { data = e.data.json() || {}; }
    catch (err) { try { data = { body: e.data.text() }; } catch (ignored) { data = {}; } }
  }
  var roomId = data.room_id || '';
  var url = self.registration.scope + (roomId ? ('?sala=' + encodeURIComponent(roomId)) : '');
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      var appNaFrente = list.some(function (c) {
        return c.visibilityState === 'visible' || c.focused === true;
      });
      if (appNaFrente) return; /* app aberto: ele mesmo chama a atenção */
      return self.registration.showNotification(data.title || 'PON', {
        body: data.body || 'alguém te chamou numa sala da PON',
        icon: self.registration.scope + 'icon-192.png',
        badge: self.registration.scope + 'icon-192.png',
        tag: 'pon-' + (roomId || 'geral'),
        data: { url: url, room_id: roomId }
      });
    })
  );
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url.indexOf(self.registration.scope) === 0 && 'focus' in c) {
          if ('navigate' in c) {
            return c.navigate(url).then(function (cc) { return (cc || c).focus(); });
          }
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
