const CACHE = 'metapps-v2'
const CORE = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']

// Navegações de callback do OAuth nunca devem ser respondidas com o cache
// da landpage: o token chega na query string e precisa ser lido pelo app.
// Se a rede falhar nesse caso, deixamos a própria navegação falhar (o app
// refaz o login) em vez de dar um "landpage fantasma" pro usuário.
function isOAuthCallback(url) {
  return url.pathname === '/auth/google/callback'
}

// Em dev, o Vite serve módulos transformados sob /src/, /@vite* e /@fs/,
// além de URLs com query string (?t=...). Esses nunca devem ser cacheados:
// se ficarem no cache, o SW passa a servir código velho do dev server —
// foi isso que "congelou" o frontend num bundle antigo depois de uma
// build/preview rodar na mesma porta.
function isCacheable(url) {
  if (url.search) return false
  if (url.pathname.startsWith('/src/')) return false
  if (url.pathname.startsWith('/@vite')) return false
  if (url.pathname.startsWith('/@fs/')) return false
  return true
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Navegações (SPA): rede primeiro, cai no cache só se offline
  if (req.mode === 'navigate') {
    if (isOAuthCallback(url)) return
    e.respondWith(
      fetch(req).catch(() => caches.match('/'))
    )
    return
  }

  // Recursos estáticos: cache primeiro, depois rede (e salva no cache)
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit
      return fetch(req)
        .then((res) => {
          const copy = res.clone()
          if (res.ok && isCacheable(url)) caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => Response.error())
    })
  )
})