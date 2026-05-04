/**
 * cashSlice.js — Slice de Caja
 * Ruta: src/store/slices/cashSlice.js
 */

/** @param {Function} set @param {Function} get @returns {Object} */
export const createCashSlice = (set, get) => ({

  openCashSession: (session) => {
    get().addAuditLog({
      action:   'CREATE',
      module:   'Caja',
      detail:   `Caja aperturada · Inicial: S/${session.openingAmount}`,
      entityId: session.id,
    })
    set({ activeCashSession: session })
  },

  closeCashSession: (closedSession) => {
    get().addAuditLog({
      action:   'UPDATE',
      module:   'Caja',
      detail:   `Caja cerrada · Ventas: S/${closedSession.totalSales} · Dif: S/${closedSession.difference}`,
      entityId: closedSession.id,
    })
    set((s) => ({
      activeCashSession: null,
      cashSessions: [closedSession, ...s.cashSessions],
    }))
  },
})
