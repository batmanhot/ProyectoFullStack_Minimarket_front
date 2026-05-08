/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  STORE v5 — Zustand refactorizado en slices independientes              ║
 * ║  Ruta: src/store/index.js                                               ║
 * ║                                                                          ║
 * ║  COMPATIBILIDAD: 100% — todos los imports existentes siguen igual.      ║
 * ║  import { useStore, selectXxx } from '../../store/index'                ║
 * ║                                                                          ║
 * ║  ESTRUCTURA EN SLICES:                                                  ║
 * ║    auditSlice       → addAuditLog, clearAuditLog                        ║
 * ║    authSlice        → currentUser, setCurrentUser, logout               ║
 * ║    configSlice      → systemConfig, businessConfig, alertas, notifs     ║
 * ║    catalogSlice     → productos, variantes, stockMovements, facturas    ║
 * ║    salesSlice       → carrito POS, ventas, debtPayments                 ║
 * ║    cashSlice        → sesiones de caja                                  ║
 * ║    stakeholdersSlice→ clientes, proveedores, usuarios, compras          ║
 * ║    discountsSlice   → campañas, tickets, devoluciones/NCs               ║
 * ║                                                                          ║
 * ║  NOTA SOBRE ORDEN DE COMPOSICIÓN:                                       ║
 * ║  auditSlice DEBE ir primero porque los demás slices llaman a             ║
 * ║  get().addAuditLog(). Zustand compone de izquierda a derecha,           ║
 * ║  por lo que addAuditLog ya existe cuando los otros métodos se definen.  ║
 * ║                                                                          ║
 * ║  LÍMITES DE MEMORIA (protección contra localStorage lleno):             ║
 * ║    auditLog:        2000 entradas (descarta las más viejas)             ║
 * ║    stockMovements:  1000 entradas                                        ║
 * ║    notifications:   200  entradas                                        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { create }                      from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { getInitialDemoState }          from '../data/seedData'
import { isCampaignActive }             from '../shared/utils/discountEngine'

// ─── Slices ───────────────────────────────────────────────────────────────────
import { createAuditSlice }         from './slices/auditSlice'
import { createAuthSlice }          from './slices/authSlice'
import { createConfigSlice }        from './slices/configSlice'
import { createCatalogSlice }       from './slices/catalogSlice'
import { createSalesSlice }         from './slices/salesSlice'
import { createCashSlice }          from './slices/cashSlice'
import { createStakeholdersSlice }  from './slices/stakeholdersSlice'
import { createDiscountsSlice }     from './slices/discountsSlice'

// ─────────────────────────────────────────────────────────────────────────────
// STORE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export const useStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({

        // 1. Datos iniciales del demo (productos, ventas, clientes, etc.)
        ...getInitialDemoState(),

        // 2. Slices — ORDEN IMPORTANTE: auditSlice va primero
        ...createAuditSlice(set, get),
        ...createAuthSlice(set, get),
        ...createConfigSlice(set, get),
        ...createCatalogSlice(set, get),
        ...createSalesSlice(set, get),
        ...createCashSlice(set, get),
        ...createStakeholdersSlice(set, get),
        ...createDiscountsSlice(set, get),

        // ─── Demo reset ──────────────────────────────────────────────────────
        // Restaura el estado inicial del demo manteniendo al usuario logueado.
        resetDemo: (sector) => {
          const initial = getInitialDemoState()
          if (sector) initial.businessConfig.sector = sector
          set({ ...initial, currentUser: get().currentUser })
        },

      }),

      // ─── Configuración de persistencia ────────────────────────────────────
      {
        name: 'mm_store_v5',

        partialize: (s) => ({
          products:          s.products,
          productVariants:   s.productVariants,
          stockMovements:    s.stockMovements,
          sales:             s.sales,
          clients:           s.clients,
          suppliers:         s.suppliers,
          categories:        s.categories,
          users:             s.users,
          cashSessions:      s.cashSessions,
          activeCashSession: s.activeCashSession,
          purchases:         s.purchases,
          debtPayments:      s.debtPayments,
          cart:              s.cart,
          nextInvoice:       s.nextInvoice,
          businessConfig:    s.businessConfig,
          systemConfig:      s.systemConfig,
          alertRules:        s.alertRules,
          currentUser:       s.currentUser,
          auditLog:          s.auditLog,
          notifications:     s.notifications,
          discountCampaigns: s.discountCampaigns,
          discountTickets:   s.discountTickets,
          returns:           s.returns,
        }),

        // ── SERIALIZE: control de tamaño del localStorage ─────────────────
        // Si el JSON supera 4MB recorta historial no crítico antes de escribir.
        // Evita el fallo silencioso del navegador al superar el límite de 5MB.
        serialize: (state) => {
          const json    = JSON.stringify(state)
          const sizeKB  = Math.round(json.length / 1024)
          if (sizeKB > 3072) {
            console.warn(`[Store] localStorage: ${sizeKB}KB / 5120KB máx.`)
          }
          if (sizeKB > 4096) {
            console.error(`[Store] Superó 4MB. Recortando historial...`)
            try {
              const p = JSON.parse(json)
              if (p.state?.auditLog?.length       > 500) p.state.auditLog       = p.state.auditLog.slice(0, 500)
              if (p.state?.stockMovements?.length > 300) p.state.stockMovements = p.state.stockMovements.slice(0, 300)
              if (p.state?.notifications?.length  >  50) p.state.notifications  = p.state.notifications.slice(0, 50)
              return JSON.stringify(p)
            } catch { /* si falla el recorte, intentar guardar igualmente */ }
          }
          return json
        },

        // ── MERGE: preserva campos loyalty del localStorage sobre el seed ──
        merge: (persistedState, currentState) => {
          const merged = { ...currentState, ...persistedState }
          if (persistedState?.clients && currentState?.clients) {
            const pMap = {}
            persistedState.clients.forEach(c => { pMap[c.id] = c })
            merged.clients = currentState.clients.map(seed => {
              const p = pMap[seed.id]
              if (!p) return seed
              return {
                ...seed, ...p,
                loyaltyPoints:       p.loyaltyPoints       ?? seed.loyaltyPoints       ?? 0,
                loyaltyAccumulated:  p.loyaltyAccumulated  ?? seed.loyaltyAccumulated  ?? 0,
                loyaltyLevel:        p.loyaltyLevel         ?? seed.loyaltyLevel         ?? 'Bronce',
                loyaltyTransactions: p.loyaltyTransactions  ?? seed.loyaltyTransactions  ?? [],
              }
            })
            const seedIds = new Set(currentState.clients.map(c => c.id))
            persistedState.clients
              .filter(c => !seedIds.has(c.id))
              .forEach(c => merged.clients.push({
                ...c,
                loyaltyPoints:       c.loyaltyPoints       ?? 0,
                loyaltyAccumulated:  c.loyaltyAccumulated  ?? 0,
                loyaltyLevel:        c.loyaltyLevel         ?? 'Bronce',
                loyaltyTransactions: c.loyaltyTransactions  ?? [],
              }))
          }
          return merged
        },
      }
    )
  )
)

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORES COMPUTADOS
// Exportados para uso con useStore(selector) — evitan re-renders innecesarios.
// Los componentes deben preferir selectores sobre desestructurar el store completo.
// ─────────────────────────────────────────────────────────────────────────────

/** Productos activos con stock bajo o agotado */
export const selectLowStockProducts = (s) =>
  s.products.filter((p) => p.isActive && p.stock <= p.stockMin)

/** Todos los productos activos */
export const selectActiveProducts = (s) =>
  s.products.filter((p) => p.isActive)

/** Suma del subtotal del carrito (después de descuentos por línea) */
export const selectCartTotal = (s) =>
  parseFloat(s.cart.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2))

/** Cantidad total de unidades en el carrito */
export const selectCartCount = (s) =>
  s.cart.reduce((acc, i) => acc + i.quantity, 0)

/** Número de notificaciones no leídas */
export const selectUnreadNotifications = (s) =>
  (s.notifications || []).filter((n) => !n.read).length

/** Productos próximos a vencer (en los próximos 30 días) */
export const selectNearExpiryProducts = (s) =>
  s.products.filter((p) => {
    if (!p.isActive || !p.expiryDate) return false
    const days = Math.ceil((new Date(p.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    return days >= 0 && days <= 30
  })

/** Ventas completadas del día de hoy */
export const selectTodaySales = (s) => {
  const now = new Date()
  return s.sales.filter((sale) => {
    const d = new Date(sale.createdAt)
    return (
      sale.status === 'completada' &&
      d.getDate()     === now.getDate()     &&
      d.getMonth()    === now.getMonth()    &&
      d.getFullYear() === now.getFullYear()
    )
  })
}

/** Campañas de descuento activas en este momento */
export const selectActiveDiscountCampaigns = (s) =>
  (s.discountCampaigns || []).filter(isCampaignActive)

/** Devoluciones del día (Notas de Crédito no anuladas) */
export const selectTodayReturns = (s) => {
  const today = new Date().toDateString()
  return (s.returns || []).filter(
    (r) => new Date(r.createdAt).toDateString() === today && r.status !== 'anulada'
  )
}

/** Clientes con deuda pendiente, ordenados de mayor a menor */
export const selectClientsWithDebt = (s) =>
  s.clients
    .filter((c) => c.isActive && (c.currentDebt || 0) > 0)
    .sort((a, b) => (b.currentDebt || 0) - (a.currentDebt || 0))

/** Total reembolsado en el día */
export const selectTodayRefundTotal = (s) =>
  parseFloat(
    (s.returns || [])
      .filter(
        (r) =>
          r.status !== 'anulada' &&
          new Date(r.createdAt).toDateString() === new Date().toDateString()
      )
      .reduce((acc, r) => acc + r.totalRefund, 0)
      .toFixed(2)
  )
