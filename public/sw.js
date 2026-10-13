// Service Worker para POS Minimarket PWA
const CACHE_NAME = 'pos-minimarket-v1.1.0'
const RUNTIME_CACHE = 'pos-runtime-v2'

// Archivos esenciales para cachear (App Shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  // Los archivos JS y CSS se cachearán automáticamente por Vite
]

// Estrategias de caché
const CACHE_STRATEGIES = {
  networkFirst: 'network-first',
  cacheFirst: 'cache-first',
  staleWhileRevalidate: 'stale-while-revalidate'
}

// ==========================================
// INSTALACIÓN
// ==========================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...')
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-cacheando archivos esenciales')
        return cache.addAll(PRECACHE_URLS)
      })
      .then(() => {
        console.log('[SW] Instalación completa')
        return self.skipWaiting() // Activar inmediatamente
      })
  )
})

// ==========================================
// ACTIVACIÓN
// ==========================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Eliminar cachés antiguos
              return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE
            })
            .map((cacheName) => {
              console.log('[SW] Eliminando caché antigua:', cacheName)
              return caches.delete(cacheName)
            })
        )
      })
      .then(() => {
        console.log('[SW] Activación completa')
        return self.clients.claim() // Tomar control inmediatamente
      })
  )
})

// ==========================================
// FETCH - Estrategias de Caché
// ==========================================
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar requests que no sean GET
  if (request.method !== 'GET') {
    return
  }

  // Ignorar requests a dominios externos (APIs, CDNs)
  if (url.origin !== location.origin) {
    return
  }

  // Estrategia: Network First para HTML (siempre intentar obtener la última versión)
  if (request.destination === 'document') {
    event.respondWith(networkFirst(request))
    return
  }

  // Estrategia: Network First para JS/CSS (recibe actualizaciones del código inmediato)
  // Cache First solo para imágenes y fuentes (no cambian con el código)
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(networkFirst(request))
    return
  }
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(cacheFirst(request))
    return
  }

  // Estrategia: Stale While Revalidate para APIs locales
  if (url.pathname.startsWith('/api')) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // Por defecto: Network First
  event.respondWith(networkFirst(request))
})

// ==========================================
// ESTRATEGIA: Network First
// ==========================================
async function networkFirst(request) {
  try {
    // Intentar obtener de la red
    const networkResponse = await fetch(request)

    // Si es exitoso, guardar en caché (clonar ANTES de retornar)
    if (networkResponse && networkResponse.status === 200) {
      const responseToCache = networkResponse.clone()
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, responseToCache)
    }

    return networkResponse
  } catch (error) {
    // Si falla la red, intentar caché
    console.log('[SW] Red no disponible, intentando caché:', request.url)
    const cachedResponse = await caches.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Si tampoco hay en caché, devolver página offline
    if (request.destination === 'document') {
      const offlinePage = await caches.match('/offline.html')
      if (offlinePage) {
        return offlinePage
      }
    }
    
    throw error
  }
}

// ==========================================
// ESTRATEGIA: Cache First
// ==========================================
async function cacheFirst(request) {
  // Intentar obtener de caché primero
  const cachedResponse = await caches.match(request)
  
  if (cachedResponse) {
    return cachedResponse
  }
  
  // Si no está en caché, obtener de la red
  try {
    const networkResponse = await fetch(request)

    // Guardar en caché para futuras requests (clonar ANTES de retornar)
    if (networkResponse && networkResponse.status === 200) {
      const responseToCache = networkResponse.clone()
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, responseToCache)
    }

    return networkResponse
  } catch (error) {
    console.error('[SW] Error obteniendo recurso:', request.url, error)
    throw error
  }
}

// ==========================================
// ESTRATEGIA: Stale While Revalidate
// ==========================================
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request)
  
  // Fetch de la red en background
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const responseToCache = networkResponse.clone()
        caches.open(RUNTIME_CACHE).then((c) => c.put(request, responseToCache))
      }
      return networkResponse
    })
    .catch(() => {
      console.log('[SW] Error actualizando desde red:', request.url)
      return null
    })
  
  // Devolver caché si existe, sino esperar la red
  return cachedResponse || fetchPromise
}

// ==========================================