import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { getInitialDemoState } from '../data/seedData'
import { formatInvoice, formatNumber } from '../shared/utils/helpers'

export const useStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...getInitialDemoState(),

        setCurrentUser: (user) => set({ currentUser: user }),
        logout: () => {
          get().addAuditLog({ action:'LOGOUT', module:'Auth', detail:'Sesión cerrada' })
          set({ currentUser: null, activeCashSession: null, cart: [] })
        },

        updateBusinessConfig: (updates) => {
          get().addAuditLog({ action:'UPDATE', module:'Configuración', detail:`Campos: ${Object.keys(updates).join(', ')}` })
          set((s) => ({ businessConfig: { ...s.businessConfig, ...updates } }))
        },

        systemConfig: {
          igvRate:0.18, stockAlertEnabled:true, expiryAlertDays:30,
          lowStockDefault:5, currencySymbol:'S/', timeZone:'America/Lima',
          allowNegativeStock:false, requireCashToSell:true,
          allowDiscounts:true, maxDiscountPct:50,
          ticketFooter:'¡Gracias por su compra!', invoicePrefix:'B001',
          printAutomatically:false, auditEnabled:true,
        },
        updateSystemConfig: (updates) => {
          get().addAuditLog({ action:'UPDATE', module:'Config Sistema', detail:`Parámetros: ${Object.keys(updates).join(', ')}` })
          set((s) => ({ systemConfig: { ...s.systemConfig, ...updates } }))
        },

        alertRules: [],
        addAlertRule:    (rule)    => set((s) => ({ alertRules: [{ ...rule, id:crypto.randomUUID(), isActive:true, createdAt:new Date().toISOString() }, ...s.alertRules] })),
        updateAlertRule: (id, upd) => set((s) => ({ alertRules: s.alertRules.map(r => r.id===id ? { ...r, ...upd } : r) })),
        deleteAlertRule: (id)      => set((s) => ({ alertRules: s.alertRules.filter(r => r.id!==id) })),

        notifications: [],
        addNotification:   (n)  => set((s) => ({ notifications: [{ ...n, id:crypto.randomUUID(), createdAt:new Date().toISOString(), read:false }, ...s.notifications].slice(0,200) })),
        markNotifRead:     (id) => set((s) => ({ notifications: s.notifications.map(n => n.id===id ? { ...n, read:true } : n) })),
        markAllNotifsRead: ()   => set((s) => ({ notifications: s.notifications.map(n => ({ ...n, read:true })) })),

        // ── CAMPAÑAS DE DESCUENTOS ────────────────────────────────────────────
        discountCampaigns: [],
        addDiscountCampaign: (campaign) => {
          get().addAuditLog({ action:'CREATE', module:'Descuentos', detail:`Campaña creada: ${campaign.name}`, entityId:campaign.id })
          set((s) => ({ discountCampaigns: [campaign, ...s.discountCampaigns] }))
        },
        updateDiscountCampaign: (id, updates) => {
          get().addAuditLog({ action:'UPDATE', module:'Descuentos', detail:`Campaña actualizada: ID ${id}`, entityId:id })
          set((s) => ({ discountCampaigns: s.discountCampaigns.map(c => c.id===id ? { ...c, ...updates } : c) }))
        },
        deleteDiscountCampaign: (id) => {
          get().addAuditLog({ action:'DELETE', module:'Descuentos', detail:`Campaña eliminada: ID ${id}`, entityId:id })
          set((s) => ({ discountCampaigns: s.discountCampaigns.filter(c => c.id!==id) }))
        },

        // ── TICKETS DE DESCUENTO ─────────────────────────────────────────────
        discountTickets: [],
        addDiscountTicket: (ticket) => {
          get().addAuditLog({ action:'CREATE', module:'Tickets Descuento', detail:`Ticket creado: ${ticket.code} · ${ticket.holderName}`, entityId:ticket.id })
          set((s) => ({ discountTickets: [ticket, ...s.discountTickets] }))
        },
        updateDiscountTicket: (id, updates) => {
          get().addAuditLog({ action:'UPDATE', module:'Tickets Descuento', detail:`Ticket actualizado: ID ${id}`, entityId:id })
          set((s) => ({ discountTickets: s.discountTickets.map(t => t.id===id ? { ...t, ...updates } : t) }))
        },
        redeemDiscountTicket: (code, saleId, saleTotal, userId) => {
          const state = get()
          const ticket = state.discountTickets.find(t => t.code.toUpperCase() === code.toUpperCase())
          if (!ticket) return { ok: false, error: 'Código de ticket no encontrado' }
          if (!ticket.isActive) return { ok: false, error: 'Este ticket está desactivado' }
          if (ticket.used) return { ok: false, error: `Ticket ya utilizado el ${new Date(ticket.usedAt).toLocaleDateString('es-PE')}` }
          const now = new Date()
          if (ticket.validFrom && now < new Date(ticket.validFrom)) return { ok: false, error: 'El ticket aún no está vigente' }
          if (ticket.validTo && now > new Date(ticket.validTo + 'T23:59:59')) return { ok: false, error: 'El ticket ha vencido' }
          // Calcular el descuento
          let discountAmt = 0
          if (ticket.discountType === 'pct') {
            discountAmt = parseFloat((saleTotal * ticket.discountValue / 100).toFixed(2))
            if (ticket.maxAmount) discountAmt = Math.min(discountAmt, ticket.maxAmount)
          } else {
            discountAmt = Math.min(ticket.discountValue, saleTotal)
          }
          discountAmt = Math.max(0, parseFloat(discountAmt.toFixed(2)))
          // Marcar como usado
          state.updateDiscountTicket(ticket.id, {
            used: true, usedAt: now.toISOString(), usedInSale: saleId,
            usedByUserId: userId, discountApplied: discountAmt
          })
          get().addAuditLog({ action:'UPDATE', module:'Tickets Descuento', detail:`Ticket canjeado: ${ticket.code} · S/${discountAmt} desc. en venta ${saleId}`, entityId:ticket.id })
          return { ok: true, ticket, discountAmt }
        },

        // ── AUDIT LOG ─────────────────────────────────────────────────────────
        auditLog: [],
        addAuditLog: ({ action, module, detail, entityId=null }) => {
          const state = get()
          if (!state.systemConfig?.auditEnabled) return
          const entry = {
            id:crypto.randomUUID(), timestamp:new Date().toISOString(),
            userId:state.currentUser?.id||'system',
            userName:state.currentUser?.fullName||state.currentUser?.username||'Sistema',
            userRole:state.currentUser?.role||'system',
            action, module, detail, entityId,
          }
          set((s) => ({ auditLog: [entry, ...s.auditLog].slice(0,2000) }))
        },

        getNextInvoice: () => {
          const n = get().nextInvoice
          set({ nextInvoice: n+1 })
          return formatInvoice(n)
        },

        addProduct: (product) => {
          get().addAuditLog({ action:'CREATE', module:'Catálogo', detail:`Producto creado: ${product.name}`, entityId:product.id })
          set((s) => ({ products: [product, ...s.products] }))
        },
        updateProduct: (id, updates) => {
          get().addAuditLog({ action:'UPDATE', module:'Catálogo', detail:`Producto actualizado: ${updates.name||id}`, entityId:id })
          set((s) => ({ products: s.products.map((p) => p.id===id ? { ...p, ...updates, updatedAt:new Date().toISOString() } : p) }))
        },
        deleteProduct: (id) => {
          const p = get().products.find(p => p.id===id)
          get().addAuditLog({ action:'DELETE', module:'Catálogo', detail:`Producto desactivado: ${p?.name||id}`, entityId:id })
          set((s) => ({ products: s.products.map((p) => (p.id===id ? { ...p, isActive:false } : p)) }))
        },

        productVariants: [],
        addVariant:    (v)       => set((s) => ({ productVariants: [v, ...s.productVariants] })),
        updateVariant: (id, upd) => set((s) => ({ productVariants: s.productVariants.map(v => v.id===id ? { ...v, ...upd } : v) })),

        addStockMovement: (movement) =>
          set((s) => ({ stockMovements: [movement, ...s.stockMovements].slice(0,1000) })),

        addToCart: (product, quantity=1, variantId=null) => {
          const cart = get().cart
          const key  = variantId ? `${product.id}_${variantId}` : product.id
          const existing = cart.find((i) => i._key===key)
          if (existing) {
            set((s) => ({ cart: s.cart.map((i) => i._key===key ? { ...i, quantity:i.quantity+quantity, subtotal:formatNumber((i.quantity+quantity)*i.unitPrice) } : i) }))
          } else {
            set((s) => ({ cart: [...s.cart, { _key:key, id:crypto.randomUUID(), productId:product.id, variantId:variantId||null, productName:product.name, barcode:product.barcode, quantity, unitPrice:product.priceSell, discount:0, subtotal:formatNumber(quantity*product.priceSell), unit:product.unit||'unidad' }] }))
          }
        },
        updateCartItem: (key, updates) =>
          set((s) => ({ cart: s.cart.map((i) => { if(i._key!==key&&i.productId!==key) return i; const u={...i,...updates}; u.subtotal=formatNumber(u.quantity*u.unitPrice); return u }) })),
        removeFromCart: (key) => set((s) => ({ cart: s.cart.filter((i) => i._key!==key&&i.productId!==key) })),
        clearCart: () => set({ cart:[] }),

        addSale: (sale) => {
          get().addAuditLog({ action:'CREATE', module:'Ventas', detail:`Venta: ${sale.invoiceNumber} · S/${sale.total}`, entityId:sale.id })
          set((s) => ({ sales: [sale, ...s.sales] }))
        },
        updateSale: (id, updates) => {
          const status = updates.status ? ` · ${updates.status}` : ''
          get().addAuditLog({ action:'UPDATE', module:'Ventas', detail:`Venta actualizada${status}`, entityId:id })
          set((s) => ({ sales: s.sales.map((sale) => (sale.id===id ? { ...sale, ...updates } : sale)) }))
        },

        debtPayments: [],
        addDebtPayment: (payment) => {
          get().addAuditLog({ action:'CREATE', module:'Cobranza', detail:`Pago deuda: ${payment.receiptNumber} · ${payment.clientName} · S/${payment.amount}`, entityId:payment.id })
          set((s) => ({ debtPayments: [payment, ...s.debtPayments] }))
        },

        openCashSession: (session) => {
          get().addAuditLog({ action:'CREATE', module:'Caja', detail:`Caja aperturada · Inicial: S/${session.openingAmount}`, entityId:session.id })
          set({ activeCashSession: session })
        },
        closeCashSession: (closedSession) => {
          get().addAuditLog({ action:'UPDATE', module:'Caja', detail:`Caja cerrada · Ventas: S/${closedSession.totalSales} · Dif: S/${closedSession.difference}`, entityId:closedSession.id })
          set((s) => ({ activeCashSession:null, cashSessions:[closedSession, ...s.cashSessions] }))
        },

        addClient: (client) => {
          get().addAuditLog({ action:'CREATE', module:'Clientes', detail:`Cliente creado: ${client.name}`, entityId:client.id })
          set((s) => ({ clients: [client, ...s.clients] }))
        },
        updateClient: (id, updates) =>
          set((s) => ({ clients: s.clients.map((c) => (c.id===id ? { ...c, ...updates } : c)) })),

        addSupplier: (supplier) => {
          get().addAuditLog({ action:'CREATE', module:'Proveedores', detail:`Proveedor creado: ${supplier.name}`, entityId:supplier.id })
          set((s) => ({ suppliers: [supplier, ...s.suppliers] }))
        },
        updateSupplier: (id, updates) => {
          get().addAuditLog({ action:'UPDATE', module:'Proveedores', detail:`Proveedor actualizado: ID ${id}`, entityId:id })
          set((s) => ({ suppliers: s.suppliers.map((s2) => (s2.id===id ? { ...s2, ...updates } : s2)) }))
        },

        addPurchase: (purchase) => {
          get().addAuditLog({ action:'CREATE', module:'Compras', detail:`Compra: ${purchase.supplierName} · S/${purchase.total} · ${purchase.items?.length} prods`, entityId:purchase.id })
          set((s) => ({ purchases: [purchase, ...s.purchases] }))
        },
        updatePurchase: (id, updates) => {
          get().addAuditLog({ action:'UPDATE', module:'Compras', detail:`Compra actualizada: ID ${id}`, entityId:id })
          set((s) => ({ purchases: s.purchases.map((p) => (p.id===id ? { ...p, ...updates } : p)) }))
        },

        addUser: (user) => {
          get().addAuditLog({ action:'CREATE', module:'Usuarios', detail:`Usuario creado: ${user.username} · Rol: ${user.role}`, entityId:user.id })
          set((s) => ({ users: [user, ...s.users] }))
        },
        updateUser: (id, updates) => {
          get().addAuditLog({ action:'UPDATE', module:'Usuarios', detail:`Usuario actualizado: ID ${id}`, entityId:id })
          set((s) => ({ users: s.users.map((u) => (u.id===id ? { ...u, ...updates } : u)) }))
        },

        resetDemo: (sector) => {
          const initial = getInitialDemoState()
          if (sector) initial.businessConfig.sector = sector
          set({ ...initial, currentUser: get().currentUser })
        },
      }),
      {
        name: 'mm_store_v4',
        partialize: (s) => ({
          products:s.products, productVariants:s.productVariants,
          stockMovements:s.stockMovements, sales:s.sales,
          clients:s.clients, suppliers:s.suppliers, categories:s.categories,
          users:s.users, cashSessions:s.cashSessions,
          activeCashSession:s.activeCashSession, purchases:s.purchases,
          debtPayments:s.debtPayments, cart:s.cart, currentUser:s.currentUser,
          businessConfig:s.businessConfig, systemConfig:s.systemConfig,
          alertRules:s.alertRules, notifications:s.notifications,
          auditLog:s.auditLog, nextInvoice:s.nextInvoice,
          discountCampaigns:s.discountCampaigns,
          discountTickets:s.discountTickets,
        }),
      }
    )
  )
)

export const selectLowStockProducts    = (s) => s.products.filter((p) => p.isActive && p.stock<=p.stockMin)
export const selectActiveProducts      = (s) => s.products.filter((p) => p.isActive)
export const selectCartTotal           = (s) => parseFloat(s.cart.reduce((acc,i) => acc+i.subtotal, 0).toFixed(2))
export const selectCartCount           = (s) => s.cart.reduce((acc,i) => acc+i.quantity, 0)
export const selectUnreadNotifications = (s) => (s.notifications||[]).filter(n => !n.read).length
export const selectNearExpiryProducts  = (s) => s.products.filter(p => {
  if(!p.isActive||!p.expiryDate) return false
  const days = Math.ceil((new Date(p.expiryDate)-new Date())/(1000*60*60*24))
  return days>=0&&days<=30
})
export const selectTodaySales = (s) => {
  const now = new Date()
  return s.sales.filter((sale) => {
    const d = new Date(sale.createdAt)
    return sale.status==='completada' && d.getDate()===now.getDate() && d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear()
  })
}
// selectActiveDiscounts: usar isCampaignActive directamente en el componente
