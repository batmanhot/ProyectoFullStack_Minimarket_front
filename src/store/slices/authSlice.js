/**
 * authSlice.js — Slice de Autenticación
 * Ruta: src/store/slices/authSlice.js
 */

/** @param {Function} set @param {Function} get @returns {Object} */
export const createAuthSlice = (set, get) => ({
  currentUser: null,

  setCurrentUser: (user) => set({ currentUser: user }),

  logout: () => {
    get().addAuditLog({ action: 'LOGOUT', module: 'Auth', detail: 'Sesión cerrada' })
    set({ currentUser: null, activeCashSession: null, cart: [] })
  },
})
