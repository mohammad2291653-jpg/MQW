// Cache only the static offline explanation. Private pages, API responses, answers,
// notes and voice data are deliberately never cached by this service worker.
self.addEventListener('install',event=>{event.waitUntil(caches.open('mqw-shell-v1').then(cache=>cache.add('/offline.html')));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!=='mqw-shell-v1').map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')))});
