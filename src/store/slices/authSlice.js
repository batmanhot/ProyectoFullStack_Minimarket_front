/**
 * authSlice.js — Slice de Autenticación
 * Ruta: src/store/slices/authSlice.js
 *
 * Registra login/logout via sessionTrackingSlice
 * Previene re-calls múltiples usando verificación de estado
 */

/** @param {Function} set @param {Function} get @returns {Object} */
export const createAuthSlice = (set, get) => ({
  currentUser: null,

  setCurrentUser: (user) => {
    const prevUser = get().currentUser
    
    // Si el usuario no cambió, no hacer nada
    if (prevUser?.id === user?.id) return

    set({ currentUser: user })
    
    // Registrar login solo si es un user nuevo (no null -> user)
    if (user && user.id && !prevUser) {
      get().recordLogin(user)
    }
  },

  logout: () => {
    const currentUser = get().currentUser
    if (currentUser?.id) {
      get().recordLogout(currentUser.id)
    }
    get().addAuditLog({ action: 'LOGOUT', module: 'Auth', detail: 'Sesión cerrada' })
    set({ currentUser: null, activeCashSession: null, cart: [] })
  },
})
