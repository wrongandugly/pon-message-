/* =====================================================================
   PON — service worker (arquivo de verdade, na raiz do repo)
   Faz duas coisas:
   1) PUSH: recebe o aviso da Edge Function "send-push" e mostra a
      notificação do sistema. REGRA DE OURO (v3 — icone novo, logica igual): na dúvida, MOSTRA.
      A supressão (app aberto e visível) é best-effort com timeout —
      qualquer erro, demora ou ambiente estranho (iOS) cai no fallback
      de mostrar, nunca no silêncio.
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

function showPon(data) {
  var roomId = data.room_id || '';
  var url = self.registration.scope + (roomId ? ('?sala=' + encodeURIComponent(roomId)) : '');
  return self.registration.showNotification(data.title || 'PON', {
    body: data.body || 'alguém te chamou numa sala da PON',
    icon: self.registration.scope + 'icon-192.png',
    tag: 'pon-' + (roomId || 'geral'),
    data: { url: url, room_id: roomId }
  });
}

self.addEventListener('push', function (e) {
  var data = {};
  if (e.data) {
    try { data = e.data.json() || {}; }
    catch (err) { try { data = { body: e.data.text() }; } catch (ignored) { data = {}; } }
  }
  var work = (async function () {
    try {
      /* best-effort: se houver uma janela do app VISÍVEL agora, não faz
         banner (a pessoa já está vendo a sala). Timeout curto e qualquer
         falha cai pra MOSTRAR — silêncio nunca mais. */
      var list = await Promise.race([
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }),
        new Promise(function (res) { setTimeout(function () { res(null); }, 350); })
      ]);
      if (list) {
        var appNaFrente = list.some(function (c) {
          return c.visibilityState === 'visible';
        });
        if (appNaFrente) return;
      }
    } catch (ignored) { /* segue pra mostrar */ }
    return showPon(data);
  })();
  e.waitUntil(work.catch(function () {
    /* último recurso: nem que seja o banner mais simples */
    return self.registration.showNotification('PON', {
      body: (data && data.body) || 'alguém te chamou numa sala da PON'
    }).catch(function () {});
  }));
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
