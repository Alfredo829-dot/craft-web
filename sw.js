const V = 'craftweb-v3';
const BASE = ['./', 'index.html', 'css/style.css', 'js/util.js', 'js/ai.js', 'js/diseno.js', 'js/lienzo.js', 'js/ia.js', 'js/clonar.js', 'js/chat.js', 'js/app.js', 'lib/fabric.min.js', 'lib/jspdf.umd.min.js', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(BASE))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin === location.origin) {
    if (u.pathname.endsWith('keys.enc.json')) return;
    // Red primero (para recibir mejoras); si no hay internet, lo guardado
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  } else if (u.host.includes('fonts.g')) {
    e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; })));
  }
});
