/**
 * sessionTrackingSlice.js — Tracking de sesiones de usuarios
 * Ruta: src/store/slices/sessionTrackingSlice.js
 *
 * Registra login/logout de usuarios con timestamp
 * Mantiene lista de usuarios activos en tiempo real
 * Histórico con límite de 500 entradas (para evitar saturar memoria)
 */

/** @param {Function} set @param {Function} get @returns {Object} */
export const createSessionTrackingSlice = (set, get) => ({
  // ─── Sesiones activas (usuarios conectados actualmente) ────────────────────
  activeSessions: [], // [{ userId, username, fullName, role, loginTime, lastActivity }]

  // ─── Histórico de sesiones ────────────────────────────────────────────────
  sessionHistory: [], // [{ id, userId, username, fullName, role, loginTime, logoutTime, duration }]

  /**
   * Registra el login de un usuario
   * @param {Object} user - { id, username, fullName, role, email }
   */
  recordLogin: (user) => {
    if (!user || !user.id) return
    
    const loginTime = new Date().toISOString()
    const state = get()

    // Verificar si el usuario ya tiene sesión activa (login duplicado)
    const existingSession = state.activeSessions.find(s => s.userId === user.id)
    if (existingSession) {
      // Actualizar última actividad si ya estaba logueado
      set(s => ({
        activeSessions: s.activeSessions.map(sess =>
          sess.userId === user.id
            ? { ...sess, lastActivity: loginTime }
            : sess
        )
      }))
      return
    }

    // Agregar nueva sesión activa
    set(s => ({
      activeSessions: [
        ...s.activeSessions,
        {
          id: crypto.randomUUID(),
          userId: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          email: user.email,
          loginTime,
          lastActivity: loginTime,
        }
      ]
    }))

    get().addAuditLog({
      action: 'LOGIN',
      module: 'Sesiones',
      detail: `${user.fullName} ingresó al sistema`,
      entityId: user.id,
    })
  },

  /**
   * Registra el logout de un usuario
   * @param {String} userId - ID del usuario
   */
  recordLogout: (userId) => {
    if (!userId) return
    
    const state = get()
    const activeSession = state.activeSessions.find(s => s.userId === userId)
    
    if (!activeSession) return

    const logoutTime = new Date().toISOString()
    const durationMs = new Date(logoutTime) - new Date(activeSession.loginTime)
    const durationMinutes = Math.floor(durationMs / 60000)

    // Mover de sesiones activas a histórico
    set(s => ({
      activeSessions: s.activeSessions.filter(sess => sess.userId !== userId),
      sessionHistory: [
        {
          id: crypto.randomUUID(),
          userId: activeSession.userId,
          username: activeSession.username,
          fullName: activeSession.fullName,
          role: activeSession.role,
          email: activeSession.email,
          loginTime: activeSession.loginTime,
          logoutTime,
          durationMinutes,
          durationFormatted: formatDuration(durationMinutes),
        },
        ...s.sessionHistory
      ].slice(0, 500) // Mantener solo últimas 500 sesiones
    }))

    get().addAuditLog({
      action: 'LOGOUT',
      module: 'Sesiones',
      detail: `${activeSession.fullName} cerró sesión (${formatDuration(durationMinutes)})`,
      entityId: userId,
    })
  },

  /**
   * Obtiene estadísticas de sesión para un usuario específico
   * @param {String} userId
   */
  getUserSessionStats: (userId) => {
    const state = get()
    const userSessions = state.sessionHistory.filter(s => s.userId === userId)
    
    if (userSessions.length === 0) {
      return { totalSessions: 0, avgDuration: 0, totalTime: 0, lastLogin: null }
    }

    const totalTime = userSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0)
    const avgDuration = Math.floor(totalTime / userSessions.length)

    return {
      totalSessions: userSessions.length,
      avgDuration: formatDuration(avgDuration),
      totalTime: formatDuration(totalTime),
      lastLogin: userSessions[0]?.loginTime || null,
    }
  },

  /**
   * Limpia el histórico de sesiones (mantenimiento)
   * Elimina sesiones más antiguas de X días
   */
  cleanOldSessions: (daysOld = 30) => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    
    set(s => ({
      sessionHistory: s.sessionHistory.filter(
        session => new Date(session.logoutTime) >= cutoffDate
      )
    }))
  },
})

/**
 * Formatea duración en minutos a string legible (Xh Ym)
 */
function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0m'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export { formatDuration }
