import { useEffect } from 'react'
import { USE_API } from '../../services/_base'
import { syncQueue } from '../utils/syncQueue'

/**
 * useOfflineSync
 *
 * Monta un listener de `window.online` que dispara la sincronización
 * automáticamente al recuperar la conexión.
 *
 * La lógica de sync vive en syncQueue.js para que el panel manual
 * (SyncQueuePanel) pueda invocarla sin duplicar código.
 *
 * Solo activo cuando USE_API = true. En modo mock no hace nada.
 * Montar una sola vez en App.jsx (dentro de TenantApp).
 */
export function useOfflineSync() {
  useEffect(() => {
    if (!USE_API) return

    const handleOnline = () => syncQueue({ silent: false })
    window.addEventListener('online', handleOnline)

    // Si hay cola pendiente al montar (ej: recargar la página con cola guardada)
    if (navigator.onLine) syncQueue({ silent: true })

    return () => window.removeEventListener('online', handleOnline)
  }, [])
}
