/**
 * syncQueue — lógica de sincronización de la cola offline.
 *
 * ACTUALIZADO: ahora usa POST /sync/pending-sales (un solo request batch)
 * en lugar de N llamadas individuales. Esto reduce latencia, simplifica el
 * manejo de errores y permite que el backend aplique resolución de conflictos
 * de forma atómica y en orden.
 *
 * Flujo:
 *  1. Filtra operaciones con status === 'pending' del store.
 *  2. Envía todas al endpoint /sync/pending-sales en un único POST.
 *  3. El backend responde con resultados individuales por operación.
 *  4. Actualiza/elimina cada entrada de la cola según su resultado.
 *
 * El flag _syncing a nivel de módulo actúa como mutex para evitar
 * dos ejecuciones concurrentes (ej: online event + click del usuario).
 *
 * Sigue siendo callable desde:
 *   - useOfflineSync (auto-trigger al detectar 'online')
 *   - SyncQueuePanel (trigger manual por el usuario)
 */
import { useStore } from '../../store/index'
import { api, USE_API } from '../../services/_base'
import toast from 'react-hot-toast'

let _syncing = false

export async function syncQueue({ silent = false } = {}) {
  if (!USE_API || _syncing || !navigator.onLine) return

  const store   = useStore.getState()
  const pending = store.offlineQueue.filter(e => e.status === 'pending')

  if (!pending.length) {
    if (!silent) toast('No hay operaciones pendientes de sincronizar')
    return
  }

  _syncing = true
  store.setQueueSyncing(true)

  const toastId = silent ? null : toast.loading(`Sincronizando ${pending.length} operación(es)…`)

  // Marcar todas como 'syncing' antes de enviar
  for (const entry of pending) {
    useStore.getState().updateOfflineOp(entry.id, { status: 'syncing' })
  }

  // Construir el payload batch:
  // El backend recibe ops[] donde cada op tiene { id, type, payload }
  const ops = pending.map(entry => ({
    id:      entry.id,
    type:    entry.type,
    payload: entry.payload,
  }))

  let results = []
  let networkError = false

  try {
    const { data } = await api.post('/sync/pending-sales', { ops })
    results = data.data || []
  } catch (err) {
    // Error de red o 5xx — marcar todas como pending de nuevo para reintentar
    networkError = true
    for (const entry of pending) {
      useStore.getState().updateOfflineOp(entry.id, {
        status:   'pending',
        attempts: (entry.attempts ?? 0) + 1,
        error:    err.message || 'Error de red',
      })
    }
  }

  if (!networkError) {
    let synced    = 0
    let skipped   = 0
    let conflicts = 0
    let errors    = 0

    for (const result of results) {
      const opId = result.opId

      switch (result.status) {
        case 'ok':
          // Procesada exitosamente: eliminar de la cola
          useStore.getState().removeOfflineOp(opId)
          synced++
          break

        case 'skipped':
          // Idempotencia: ya existía / ya estaba en el estado correcto
          // También eliminar de la cola — no es un error
          useStore.getState().removeOfflineOp(opId)
          skipped++
          break

        case 'error': {
          // Error de negocio (409 conflicto de datos, 404 not found, etc.)
          const entry = pending.find(e => e.id === opId)
          const nextAttempts = (entry?.attempts ?? 0) + 1
          const isConflict   = result.reason?.includes('conflict') || result.reason?.includes('409')

          useStore.getState().updateOfflineOp(opId, {
            status:   isConflict ? 'conflict' : (nextAttempts >= 3 ? 'error' : 'pending'),
            attempts: nextAttempts,
            error:    result.reason || 'Error del servidor',
          })

          if (isConflict) conflicts++
          else errors++
          break
        }

        default:
          // Resultado desconocido — dejar como pending
          useStore.getState().updateOfflineOp(opId, { status: 'pending' })
          errors++
      }
    }

    // Eliminar ops que el backend no devolvió resultado (no deberían existir, pero por seguridad)
    const returnedIds = new Set(results.map(r => r.opId))
    for (const entry of pending) {
      if (!returnedIds.has(entry.id)) {
        useStore.getState().updateOfflineOp(entry.id, {
          status:  'error',
          error:   'No se recibió respuesta del servidor para esta operación',
        })
        errors++
      }
    }

    if (toastId) toast.dismiss(toastId)

    const total = synced + skipped
    if (total > 0)     toast.success(`${total} operación(es) sincronizada(s)${skipped ? ` (${skipped} ya existían)` : ''}`)
    if (conflicts > 0) toast.error(`${conflicts} con conflicto de datos — revísalas en la cola`, { duration: 6000 })
    if (errors > 0 && total === 0 && conflicts === 0) {
      toast.error('Algunos errores al sincronizar — se reintentarán al reconectar')
    }
  } else {
    if (toastId) toast.dismiss(toastId)
    if (!silent) toast.error('Sin respuesta del servidor — se reintentará al reconectar')
  }

  _syncing = false
  useStore.getState().setQueueSyncing(false)
}
