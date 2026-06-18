/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  STORE v5 — Zustand refactorizado en slices independientes              ║
 * ║  Ruta: src/store/index.js                                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { create }                      from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { getInitialDemoState, SEED_VARIANTS } from '../data/seedData'
import { isCampaignActive }             from '../shared/utils/discountEngine'
import { STORAGE_KEYS }                 from '../config/storageKeys'

const _getTenantSlug = () =>
  window.location.pathname.match(/\/app\/([^/]+)/)?.[1] ?? 'demo'

const _STORE_KEY = `${STORAGE_KEYS.storePrefix}${_getTenantSlug()}`

import { createAuditSlice }           from './slices/auditSlice'
import { createAuthSlice }            from './slices/authSlice'
import { createConfigSlice }          from './slices/configSlice'
import { createCatalogSlice }         from './slices/catalogSlice'
import { createSalesSlice }           from './slices/salesSlice'
import { createCashSlice }            from './slices/cashSlice'
import { createStakeholdersSlice }    from './slices/stakeholdersSlice'
import { createDiscountsSlice }       from './slices/discountsSlice'
import { createSessionTrackingSlice } from './slices/sessionTrackingSlice'
import { createLocationSlice }        from './slices/locationSlice'
import { createOfflineQueueSlice }    from './slices/offlineQueueSlice'

export const useStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({

        ...getInitialDemoState(),

        ...createAuditSlice(set, get),
        ...createAuthSlice(set, get),
        ...createConfigSlice(set, get),
        ...createCatalogSlice(set, get),
        ...createSalesSlice(set, get),
        ...createCashSlice(set, get),
        ...createStakeholdersSlice(set, get),
        ...createDiscountsSlice(set, get),
        ...createSessionTrackingSlice(set, get),
        ...createLocationSlice(set, get),
        ...createOfflineQueueSlice(set, get),

        clearUserData: () => {
          set({
            products:          [],
            productVariants:   [],
            productSerials:    [],
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
            invoiceCounters:   { T001: 1, B001: 1, F001: 1, NC001: 1 },
            auditLog:          [],
            notifications:     [],
            discountCampaigns: [],
            discountTickets:   [],
            returns:           [],
            mermaRecords:      [],
          })
        },

        loadDemoData: () => {
          const { systemConfig, businessConfig, currentUser } = get()
          const seed = getInitialDemoState()

          const igvRate = parseFloat(systemConfig?.igvRate ?? 0.18)
          const adjustedSales = seed.sales.map(sale => {
            if (Math.abs(igvRate - 0.18) < 0.001) return sale
            const igv  = parseFloat((sale.total / (1 + igvRate) * igvRate).toFixed(2))
            const base = parseFloat((sale.total - igv).toFixed(2))
            return { ...sale, igv, baseImponible: base, igvRate }
          })

          set({
            products:          seed.products,
            productVariants:   SEED_VARIANTS,
            productSerials:    [],
            categories:        seed.categories,
            brands:            seed.brands,
            clients:           seed.clients,
            suppliers:         seed.suppliers,
            users:             seed.users,
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
            nextInvoice: (() => {
              const nums = adjustedSales.map(s => parseInt(s.invoiceNumber?.split('-')[1] || '0'))
              return (nums.length ? Math.max(...nums) : 0) + 1
            })(),
            invoiceCounters: (() => {
              const byPrefix = adjustedSales.reduce((acc, s) => {
                if (!s.invoiceNumber) return acc
                const [pfx, numStr] = s.invoiceNumber.split('-')
                if (pfx && numStr) acc[pfx] = Math.max(acc[pfx] || 0, parseInt(numStr, 10) || 0)
                return acc
              }, {})
              return {
                T001:  (byPrefix['T001']  || 0) + 1,
                B001:  (byPrefix['B001']  || 0) + 1,
                F001:  (byPrefix['F001']  || 0) + 1,
                NC001: (byPrefix['NC001'] || 0) + 1,
              }
            })(),
            businessConfig:    businessConfig ?? seed.businessConfig,
            systemConfig:      systemConfig,
            currentUser:       currentUser,
          })
        },

      }),

      {
        name: _STORE_KEY,
        partialize: (s) => ({
          products:          s.products,
          productVariants:   s.productVariants,
          productSerials:    s.productSerials || [],
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
          invoiceCounters:   s.invoiceCounters,
          businessConfig:    s.businessConfig,
          systemConfig:      s.systemConfig,
          alertRules:        s.alertRules,
          currentUser:       s.currentUser,
          auditLog:          s.auditLog,
          notifications:     s.notifications,
          discountCampaigns: s.discountCampaigns,
          discountTickets:   s.discountTickets,
          returns:           s.returns,
          mermaRecords:      s.mermaRecords,
          activeSessions:    s.activeSessions,
          sessionHistory:    s.sessionHistory,
          locations:         s.locations,
          offlineQueue:      s.offlineQueue,
        }),
      }
    )
  )
)

export const selectLowStockProducts        = (s) => s.products.filter((p) => p.isActive && p.stock <= p.stockMin)
export const selectActiveProducts          = (s) => s.products.filter((p) => p.isActive)
export const selectCartTotal               = (s) => parseFloat(s.cart.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2))
export const selectCartCount               = (s) => s.cart.reduce((acc, i) => acc + i.quantity, 0)
export const selectUnreadNotifications     = (s) => (s.notifications || []).filter((n) => !n.read).length
export const selectNearExpiryProducts      = (s) => s.products.filter((p) => { if (!p.isActive || !p.expiryDate) return false; const days = Math.ceil((new Date(p.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)); return days >= 0 && days <= 30 })
export const selectTodaySales              = (s) => { const now = new Date(); return s.sales.filter((sale) => { const d = new Date(sale.createdAt); return sale.status === 'completada' && d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() }) }
export const selectActiveDiscountCampaigns = (s) => (s.discountCampaigns || []).filter(isCampaignActive)
export const selectTodayReturns            = (s) => { const today = new Date().toDateString(); return (s.returns || []).filter((r) => new Date(r.createdAt).toDateString() === today && r.status !== 'anulada') }
export const selectActiveSessions          = (s) => s.activeSessions || []
export const selectRecentSessionHistory    = (s) => (s.sessionHistory || []).slice(0, 50)
export const selectClientsWithDebt         = (s) => s.clients.filter((c) => c.isActive && (c.currentDebt || 0) > 0).sort((a, b) => (b.currentDebt || 0) - (a.currentDebt || 0))
export const selectTodayRefundTotal        = (s) => parseFloat((s.returns || []).filter((r) => r.status !== 'anulada' && new Date(r.createdAt).toDateString() === new Date().toDateString()).reduce((acc, r) => acc + r.totalRefund, 0).toFixed(2))
