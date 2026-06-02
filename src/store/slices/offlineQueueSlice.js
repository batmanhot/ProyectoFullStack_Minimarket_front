/**
 * offlineQueueSlice — cola de operaciones generadas sin conexión.
 *
 * Ciclo de vida de una entrada:
 *   pending  → el usuario operó offline, aún no se sincronizó
 *   syncing  → useOfflineSync la está enviando al backend ahora mismo
 *   conflict → el backend la rechazó (409/422); requiere revisión del admin
 *   error    → falló 3+ veces por error de red
 *   (synced) → se elimina de la lista en cuanto el backend confirma
 *
 * La cola se persiste en localStorage junto con el resto del store.
 * En modo mock (USE_API = false) la cola nunca se llena porque no hay
 * backend al que sincronizar; todo funciona localmente de forma nativa.
 */
export const createOfflineQueueSlice = (set) => ({
  offlineQueue: [],
  isSyncing: false,

  enqueueOfflineOp: ({ type, endpoint, method = 'POST', payload }) =>
    set(s => ({
      offlineQueue: [
        ...s.offlineQueue,
        {
          id:        crypto.randomUUID(),
          type,
          endpoint,
          method,
          payload,
          status:    'pending',
          attempts:  0,
          error:     null,
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  updateOfflineOp: (id, updates) =>
    set(s => ({
      offlineQueue: s.offlineQueue.map(op => op.id === id ? { ...op, ...updates } : op),
    })),

  removeOfflineOp: (id) =>
    set(s => ({
      offlineQueue: s.offlineQueue.filter(op => op.id !== id),
    })),

  clearResolvedOps: () =>
    set(s => ({
      offlineQueue: s.offlineQueue.filter(op => op.status === 'pending' || op.status === 'syncing'),
    })),

  setQueueSyncing: (value) => set({ isSyncing: value }),
})
