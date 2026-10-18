/* عامل خدمة بسيط لتطبيق الموظف: يخزّن ملفات التطبيق الثابتة فقط (لا يخزّن أي طلب إلى Supabase أو بيانات شخصية). */
const CACHE = 'ariba-emp-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./employee.html', './manifest.webmanifest']).catch(() => {}))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin) return;          // لا نعترض أي طلبات خارجية (Supabase…)
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => caches.match('./employee.html'))); return; }
  if (/\/assets\//.test(u.pathname)) {                                           // ملفات مُجزّأة بالـhash: كاش أولاً
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); return res; })));
  }
});
