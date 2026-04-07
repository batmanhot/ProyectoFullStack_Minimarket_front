// Service Worker para POS Minimarket PWA
const CACHE_NAME = 'pos-minimarket-v1.0.0'
const RUNTIME_CACHE = 'pos-runtime-v1'

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

  // Estrategia: Cache First para assets estáticos (JS, CSS, imágenes)
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
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
    
    // Si es exitoso, guardar en caché
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, networkResponse.clone())
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
    
    // Guardar en caché para futuras requests
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
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
        const cache = caches.open(RUNTIME_CACHE)
        cache.then((c) => c.put(request, networkResponse.clone()))
      }
      return networkResponse
    })
    .catch((error) => {
      console.log('[SW] Error actualizando desde red:', request.url)
      return null
    })
  
  // Devolver caché si existe, sino esperar la red
  return cachedResponse || fetchPromise
}

// ==========================================
// SYNC EN BACKGROUND (para ventas offline)
// ==========================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background Sync:', event.tag)
  
  if (event.tag === 'sync-pending-sales') {
    event.waitUntil(syncPendingSales())
  }
})

async function syncPendingSales() {
  try {
    // Aquí implementarías la lógica para sincronizar ventas pendientes
    console.log('[SW] Sincronizando ventas pendientes...')
    
    // Ejemplo:
    // const pendingSales = await getPendingSalesFromIndexedDB()
    // for (const sale of pendingSales) {
    //   await sendSaleToServer(sale)
    //   await removeSaleFromIndexedDB(sale.id)
    // }
    
    console.log('[SW] Sincronización completada')
  } catch (error) {
    console.error('[SW] Error en sincronización:', error)
    throw error // Reintentar más tarde
  }
}

// ==========================================
// NOTIFICACIONES PUSH (opcional)
// ==========================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push recibido:', event)
  
  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: 'Ver',
        icon: '/icons/check.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/icons/close.png'
      }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification('POS Minimarket', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notificación clickeada:', event.action)
  
  event.notification.close()
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    )
  }
})

// ==========================================
// MENSAJES DESDE LA APP
// ==========================================
self.addEventListener('message', (event) => {
  console.log('[SW] Mensaje recibido:', event.data)
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE)
        .then((cache) => cache.addAll(event.data.payload))
    )
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        ))
    )
  }
})

console.log('[SW] Service Worker cargado correctamente')
