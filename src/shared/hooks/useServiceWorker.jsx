// src/shared/hooks/useServiceWorker.js
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export const useServiceWorker = () => {
  const [registration, setRegistration] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    // Verificar si el navegador soporta Service Workers
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ Service Workers no soportados en este navegador')
      return
    }

    registerServiceWorker()
    setupOnlineOfflineListeners()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      console.warn('[SW] Notificaciones no soportadas en este navegador')
      return null
    }

    if (Notification.permission === 'granted') {
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      toast.error('Las notificaciones están bloqueadas en el navegador', { icon: '🔕' })
      return 'denied'
    }

    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        toast.success('Permiso de notificaciones habilitado', { icon: '🔔' })
      } else {
        toast('Notificaciones no autorizadas', { icon: '⚠️' })
      }
      return permission
    } catch (error) {
      console.error('[SW] Error solicitando permiso de notificaciones:', error)
      return null
    }
  }

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

      console.log('✅ Service Worker registrado:', reg.scope)
      setRegistration(reg)

      if ('Notification' in window && Notification.permission === 'default') {
        await requestNotificationPermission()
      }

      // Escuchar actualizaciones
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Hay una actualización disponible
            console.log('🔄 Actualización disponible')
            setUpdateAvailable(true)
            
            toast(
              (t) => (
                <div className="flex flex-col gap-2">
                  <p className="font-medium">Nueva versión disponible</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        newWorker.postMessage({ type: 'SKIP_WAITING' })
                        window.location.reload()
                        toast.dismiss(t.id)
                      }}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      Actualizar ahora
                    </button>
                    <button
                      onClick={() => toast.dismiss(t.id)}
                      className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                    >
                      Más tarde
                    </button>
                  </div>
                </div>
              ),
              {
                duration: Infinity,
                icon: '🔄'
              }
            )
          }
        })
      })

      // Escuchar mensajes del SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📨 Mensaje del SW:', event.data)
        
        if (event.data.type === 'CACHE_UPDATED') {
          toast.success('Contenido actualizado', { icon: '✓' })
        }
      })

    } catch (error) {
      console.error('❌ Error registrando Service Worker:', error)
    }
  }

  const handleOnline = () => {
    setIsOnline(true)
    toast.success('Conexión restaurada', { 
      icon: '🌐',
      duration: 3000 
    })
  }

  const handleOffline = () => {
    setIsOnline(false)
    toast.error('Sin conexión. Trabajando offline', { 
      icon: '📡',
      duration: 5000 
    })
  }

  const setupOnlineOfflineListeners = () => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  const updateServiceWorker = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
  }

  const unregisterServiceWorker = async () => {
    if (registration) {
      await registration.unregister()
      console.log('Service Worker desregistrado')
    }
  }

  return {
    registration,
    isOnline,
    updateAvailable,
    updateServiceWorker,
    unregisterServiceWorker
  }
}
