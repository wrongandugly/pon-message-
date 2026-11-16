// Kill-switch: o jogo mudou para https://wrongandugly.github.io/wrong-and-ugly-game/
// Apaga os caches antigos, desregistra este SW e manda as janelas abertas para a casa nova.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: "window" }); })
      .then(function (cs) {
        cs.forEach(function (c) { c.navigate("https://wrongandugly.github.io/wrong-and-ugly-game/"); });
      })
  );
});
