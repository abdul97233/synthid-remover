/*
 * Offline support (generated at build time from scripts/sw.template.js).
 *
 * On install it downloads EVERY file the app needs (HTML, JS chunks, the
 * processing worker, CSS, fonts, icons), so the app works fully offline after
 * a single visit. It only caches this site's own static files — user media
 * never touches the network or this cache.
 *  - Page loads: network first (short timeout), cached copy when offline.
 *  - Everything else from this site: cache first, network as fallback.
 */
const VERSION = '__VERSION__'
const CACHE = `sr-${VERSION}`
const PRECACHE = __PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sr-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      Promise.race([fetch(req), timeout(4000)])
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put('./index.html', copy))
          }
          return res
        })
        .catch(() =>
          caches.open(CACHE).then((c) => c.match('./index.html').then((r) => r || c.match('./'))),
        ),
    )
    return
  }

  event.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(req, { ignoreSearch: true }).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && res.type === 'basic') c.put(req, res.clone())
            return res
          }),
      ),
    ),
  )
})
