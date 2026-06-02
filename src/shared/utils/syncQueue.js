/**
 * syncQueue — lógica de sincronización de la cola offline.
 *
 * Diseño intencional: función standalone (no hook) que opera sobre el store
 * directamente. Esto permite llamarla desde:
 *   - useOfflineSync (auto-trigger al detectar 'online')
 *   - SyncQueuePanel (trigger manual por el usuario)
 * sin duplicar código ni crear dos instancias React desincronizadas.
 *
 * El flag _syncing a nivel de módulo actúa como mutex para evitar
 * dos ejecuciones concurrentes (ej: online event + click del usuario).
 */
import { useStore } from '../../store/index'
import { api, USE_API } from '../../services/_base'
import toast from 'react-hot-toast'

let _syncing = false

export async function syncQueue({ silent = false } = {}) {
  if (!USE_API || _syncing || !navigator.onLine) return

  const store = useStore.getState()
  const pending = store.offlineQueue.filter(e => e.status === 'pending')
  if (!pending.length) {
    if (!silent) toast('No hay operaciones pendientes de sincronizar')
    return
  }

  _syncing = true
  store.setQueueSyncing(true)

  const toastId = silent ? null : toast.loading(`Sincronizando ${pending.length} operación(es)…`)

  let synced    = 0
  let conflicts = 0
  let errors    = 0

  for (const entry of pending) {
    useStore.getState().updateOfflineOp(entry.id, { status: 'syncing' })
    try {
      const method = (entry.method ?? 'POST').toLowerCase()
      await api[method](entry.endpoint, entry.payload)
      useStore.getState().removeOfflineOp(entry.id)
      synced++
    } catch (err) {
      const httpStatus = err.response?.status
      const isConflict = httpStatus === 409 || httpStatus === 422
      const nextAttempts = (entry.attempts ?? 0) + 1
      useStore.getState().updateOfflineOp(entry.id, {
        status:   isConflict ? 'conflict' : (nextAttempts >= 3 ? 'error' : 'pending'),
        attempts: nextAttempts,
        error:    err.response?.data?.message ?? err.message ?? 'Error de red',
      })
      if (isConflict) conflicts++
      else errors++
    }
  }

  _syncing = false
  useStore.getState().setQueueSyncing(false)

  if (toastId) toast.dismiss(toastId)

  if (synced > 0)    toast.success(`${synced} operación(es) sincronizada(s)`)
  if (conflicts > 0) toast.error(`${conflicts} con conflicto — revísalas en la cola`, { duration: 6000 })
  if (errors > 0 && synced === 0 && conflicts === 0) toast.error('Sin respuesta del servidor — se reintentará al reconectar')
}
