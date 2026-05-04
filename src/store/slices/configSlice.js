/**
 * configSlice.js — Slice de Configuración del Sistema
 * Ruta: src/store/slices/configSlice.js
 *
 * Agrupa: systemConfig, businessConfig, alertRules, notifications.
 * Todas son configuraciones del sistema, no datos de negocio.
 */

/** @param {Function} set @param {Function} get @returns {Object} */
export const createConfigSlice = (set, get) => ({

  // ─── Configuración del sistema ─────────────────────────────────────────────
  systemConfig: {
    igvRate:            0.18,
    stockAlertEnabled:  true,
    expiryAlertDays:    30,
    lowStockDefault:    5,
    currencySymbol:     'S/',
    timeZone:           'America/Lima',
    allowNegativeStock: false,
    requireCashToSell:  true,
    allowDiscounts:     true,
    maxDiscountPct:     50,
    ticketFooter:       '¡Gracias por su compra!',
    invoicePrefix:      'B001',
    printAutomatically: false,
    auditEnabled:       true,
  },

  updateSystemConfig: (updates) => {
    get().addAuditLog({
      action: 'UPDATE',
      module: 'Config Sistema',
      detail: `Parámetros: ${Object.keys(updates).join(', ')}`,
    })
    set((s) => ({ systemConfig: { ...s.systemConfig, ...updates } }))
  },

  // ─── Configuración del negocio ─────────────────────────────────────────────
  updateBusinessConfig: (updates) => {
    get().addAuditLog({
      action: 'UPDATE',
      module: 'Configuración',
      detail: `Campos: ${Object.keys(updates).join(', ')}`,
    })
    set((s) => ({ businessConfig: { ...s.businessConfig, ...updates } }))
  },

  // ─── Reglas de alerta ──────────────────────────────────────────────────────
  alertRules: [],

  addAlertRule: (rule) =>
    set((s) => ({
      alertRules: [
        { ...rule, id: crypto.randomUUID(), isActive: true, createdAt: new Date().toISOString() },
        ...s.alertRules,
      ],
    })),

  updateAlertRule: (id, updates) =>
    set((s) => ({
      alertRules: s.alertRules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    })),

  deleteAlertRule: (id) =>
    set((s) => ({
      alertRules: s.alertRules.filter((r) => r.id !== id),
    })),

  // ─── Notificaciones ────────────────────────────────────────────────────────
  // Límite de 200 — las más antiguas se descartan automáticamente.
  notifications: [],

  addNotification: (n) =>
    set((s) => ({
      notifications: [
        { ...n, id: crypto.randomUUID(), createdAt: new Date().toISOString(), read: false },
        ...s.notifications,
      ].slice(0, 200),
    })),

  markNotifRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),

  markAllNotifsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),
})
