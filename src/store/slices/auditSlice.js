/**
 * auditSlice.js — Slice de Auditoría
 * Ruta: src/store/slices/auditSlice.js
 *
 * Responsabilidad única: registrar y consultar eventos de auditoría.
 * Límite de 2000 registros en memoria/localStorage (descarta los más viejos).
 * Si auditEnabled = false en systemConfig, los registros se ignoran silenciosamente.
 */

/** @param {Function} set @param {Function} get @returns {Object} */
export const createAuditSlice = (set, get) => ({
  auditLog: [],

  /**
   * Registra un evento de auditoría.
   * @param {{ action: string, module: string, detail: string, entityId?: string|null }} param0
   */
  addAuditLog: ({ action, module, detail, entityId = null }) => {
    if (!get().systemConfig?.auditEnabled) return

    const state = get()
    const entry = {
      id:        crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId:    state.currentUser?.id       || 'system',
      userName:  state.currentUser?.fullName || state.currentUser?.username || 'Sistema',
      userRole:  state.currentUser?.role     || 'system',
      action,
      module,
      detail,
      entityId,
    }

    set((s) => ({
      auditLog: [entry, ...s.auditLog].slice(0, 2000),
    }))
  },

  /** Elimina todos los registros de auditoría (acción de admin, requiere confirmación en UI) */
  clearAuditLog: () => {
    // Se registra el borrado ANTES de limpiar para tener trazabilidad del propio evento
    get().addAuditLog({
      action:  'DELETE',
      module:  'Auditoría',
      detail:  `Log limpiado por ${get().currentUser?.fullName || 'admin'} · ${get().auditLog.length} registros eliminados`,
      entityId: null,
    })
    set({ auditLog: [] })
  },
})
