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
import { APP_CONFIG }                   from '../config/app'

// Deriva el tenantSlug de la URL al momento de cargar el módulo.
// Como el store es un singleton, el slug queda fijo para toda la sesión,
// que es el comportamiento correcto: cada URL /app/<slug> tiene su propio store.
// Para cambiar de tenant el usuario debe navegar a otra URL (full reload).
const _getTenantSlug = () =>
  window.location.pathname.match(/\/app\/([^/]+)/)?.[1] ?? 'demo'

const _STORE_KEY = `mm_store_v5_${_getTenantSlug()}`

// ─── Slices ───────────────────────────────────────────────────────────────────
import { createAuditSlice }         from './slices/auditSlice'
import { createAuthSlice }          from './slices/authSlice'
import { createConfigSlice }        from './slices/configSlice'
import { createCatalogSlice }       from './slices/catalogSlice'
import { createSalesSlice }         from './slices/salesSlice'
import { createCashSlice }          from './slices/cashSlice'
import { createStakeholdersSlice }  from './slices/stakeholdersSlice'
import { createDiscountsSlice }     from './slices/discountsSlice'
import { createSessionTrackingSlice } from './slices/sessionTrackingSlice'

// ─────────────────────────────────────────────────────────────────────────────
// STORE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export const useStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({

        // 1. Datos iniciales: solo en modo demo (sin API). En modo API la
        //    data viene del backend y reemplaza este estado en cada fetch.
        ...(APP_CONFIG.useApi ? {} : getInitialDemoState()),

        // 2. Slices — ORDEN IMPORTANTE: auditSlice va primero
        ...createAuditSlice(set, get),
        ...createAuthSlice(set, get),
        ...createConfigSlice(set, get),
        ...createCatalogSlice(set, get),
        ...createSalesSlice(set, get),
        ...createCashSlice(set, get),
        ...createStakeholdersSlice(set, get),
        ...createDiscountsSlice(set, get),
        ...createSessionTrackingSlice(set, get),

        // ─── Demo reset ──────────────────────────────────────────────────────
        resetDemo: (sector) => {
          const initial = getInitialDemoState()
          if (sector) initial.businessConfig.sector = sector
          set({ ...initial, currentUser: get().currentUser })
        },

        // ─── Limpiar todos los datos transaccionales (solo modo demo) ─────────
        // Borra toda la data operativa registrada por el usuario dejando el
        // sistema en blanco para que el cliente pueda ingresar su propia data.
        // Conserva: configuración, usuarios del sistema, categorías y marcas.
        clearUserData: () => {
          set({
            products:          [],
            productVariants:   [],
            stockMovements:    [],
            sales:             [],
            clients:           [],
            suppliers:         [],
            purchases:         [],
            cashSessions:      [],
            activeCashSession: null,
            debtPayments:      [],
            cart:              [],
            nextInvoice:       1,
            auditLog:          [],
            notifications:     [],
            discountCampaigns: [],
            discountTickets:   [],
            returns:           [],
          })
        },

        // ─── Cargar datos demo ricos ──────────────────────────────────────────
        // Inyecta 30 días de ventas históricas y todos los maestros (productos,
        // clientes, proveedores, etc.) necesarios para que las referencias sean
        // consistentes. Respeta la configuración del tenant: IGV, usuario activo
        // y configuración del negocio no se sobreescriben.
        loadDemoData: () => {
          const { systemConfig, businessConfig, currentUser } = get()
          const seed = getInitialDemoState()

          // Ajustar IGV de cada venta al configurado en este tenant
          const igvRate = parseFloat(systemConfig?.igvRate ?? 0.18)
          const adjustedSales = seed.sales.map(sale => {
            if (Math.abs(igvRate - 0.18) < 0.001) return sale
            const igv  = parseFloat((sale.total / (1 + igvRate) * igvRate).toFixed(2))
            const base = parseFloat((sale.total - igv).toFixed(2))
            return { ...sale, igv, baseImponible: base, igvRate }
          })

          set({
            // ── Maestros: siempre inyectar seed para garantizar consistencia
            //    con los productId/clientId referenciados en las ventas demo.
            products:          seed.products,
            productVariants:   [],
            categories:        seed.categories,
            brands:            seed.brands,
            clients:           seed.clients,
            suppliers:         seed.suppliers,
            users:             seed.users,
            // ── Transaccionales
            sales:             adjustedSales,
            stockMovements:    [],
            purchases:         [],
            cashSessions:      [],
            activeCashSession: null,
            debtPayments:      [],
            discountCampaigns: [],
            discountTickets:   [],
            returns:           [],
            mermaRecords:      [],
            auditLog:          [],
            notifications:     [],
            cart:              [],
            nextInvoice:       Math.max(...adjustedSales.map(s =>
              parseInt(s.invoiceNumber?.split('-')[1] || '0')
            )) + 1,
            // ── Preservar configuración y sesión del tenant
            businessConfig:    businessConfig ?? seed.businessConfig,
            systemConfig:      systemConfig,
            currentUser:       currentUser,
          })
        },

      }),

      // ─── Configuración de persistencia ────────────────────────────────────
      {
        name: _STORE_KEY,  // aislado por tenant: mm_store_v5_<slug>

        // Solo persiste los datos necesarios.
        // systemConfig NO viene de seedData, se define en configSlice,
        // por eso se incluye explícitamente.
        partialize: (s) => ({
          // Datos de negocio (vienen de seedData y se modifican en runtime)
          products:          s.products,
          productVariants:   s.productVariants,
          stockMovements:    s.stockMovements,
          sales:             s.sales,
          clients:           s.clients,
          suppliers:         s.suppliers,
          categories:        s.categories,
          brands:            s.brands,
          users:             s.users,
          cashSessions:      s.cashSessions,
          activeCashSession: s.activeCashSession,
          purchases:         s.purchases,
          debtPayments:      s.debtPayments,
          cart:              s.cart,
          nextInvoice:       s.nextInvoice,
          // Configuración
          businessConfig:    s.businessConfig,
          systemConfig:      s.systemConfig,
          alertRules:        s.alertRules,
          // Usuario activo
          currentUser:       s.currentUser,
          // Auditoría y notificaciones
          auditLog:          s.auditLog,
          notifications:     s.notifications,
          // Descuentos y devoluciones
          discountCampaigns: s.discountCampaigns,
          discountTickets:   s.discountTickets,
          returns:           s.returns,
          // Merma
          mermaRecords:      s.mermaRecords,
          // Sesiones de usuarios
          activeSessions:    s.activeSessions,
          sessionHistory:    s.sessionHistory,
        }),
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

/** Sesiones activas (evitar mapeo para prevenir re-renders infinitos) */
export const selectActiveSessions = (s) => 
  s.activeSessions || []

/** Historial de sesiones (últimas 50 más recientes) */
export const selectRecentSessionHistory = (s) =>
  (s.sessionHistory || []).slice(0, 50)

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
