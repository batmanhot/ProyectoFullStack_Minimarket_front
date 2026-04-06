import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { getInitialDemoState } from '../data/seedData'
import { formatInvoice, formatNumber } from '../shared/utils/helpers'

// ─── STORE PRINCIPAL ──────────────────────────────────────────────────────────
export const useStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({

        ...getInitialDemoState(),

        // ── AUTH ────────────────────────────────────────────────────────────
        setCurrentUser: (user) => set({ currentUser: user }),
        logout: () => set({ currentUser: null, activeCashSession: null, cart: [] }),

        // ── CONFIGURACIÓN DEL NEGOCIO ────────────────────────────────────────
        updateBusinessConfig: (updates) =>
          set((s) => ({ businessConfig: { ...s.businessConfig, ...updates } })),

        // ── CONTADOR DE FACTURAS (atómico — fix del parseInt frágil) ─────────
        getNextInvoice: () => {
          const n = get().nextInvoice
          set({ nextInvoice: n + 1 })
          return formatInvoice(n)
        },

        // ── PRODUCTOS ───────────────────────────────────────────────────────
        addProduct: (product) =>
          set((s) => ({ products: [product, ...s.products] })),

        updateProduct: (id, updates) =>
          set((s) => ({
            products: s.products.map((p) =>
              p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
            ),
          })),

        deleteProduct: (id) =>
          set((s) => ({
            products: s.products.map((p) => (p.id === id ? { ...p, isActive: false } : p)),
          })),

        // ── VARIANTES ───────────────────────────────────────────────────────
        productVariants: [],
        addVariant: (variant) =>
          set((s) => ({ productVariants: [variant, ...s.productVariants] })),

        updateVariant: (id, updates) =>
          set((s) => ({
            productVariants: s.productVariants.map((v) =>
              v.id === id ? { ...v, ...updates } : v
            ),
          })),

        // ── MOVIMIENTOS DE STOCK ─────────────────────────────────────────────
        addStockMovement: (movement) =>
          set((s) => ({
            stockMovements: [movement, ...s.stockMovements].slice(0, 1000),
          })),

        // ── CARRITO POS ──────────────────────────────────────────────────────
        addToCart: (product, quantity = 1, variantId = null) => {
          const cart = get().cart
          const key = variantId ? `${product.id}_${variantId}` : product.id
          const existing = cart.find((i) => i._key === key)
          if (existing) {
            set((s) => ({
              cart: s.cart.map((i) =>
                i._key === key
                  ? { ...i, quantity: i.quantity + quantity, subtotal: formatNumber((i.quantity + quantity) * i.unitPrice) }
                  : i
              ),
            }))
          } else {
            set((s) => ({
              cart: [
                ...s.cart,
                {
                  _key: key,
                  id: crypto.randomUUID(),
                  productId: product.id,
                  variantId: variantId || null,
                  productName: product.name,
                  barcode: product.barcode,
                  quantity,
                  unitPrice: product.priceSell,
                  discount: 0,
                  subtotal: formatNumber(quantity * product.priceSell),
                  unit: product.unit || 'unidad',
                },
              ],
            }))
          }
        },

        updateCartItem: (key, updates) =>
          set((s) => ({
            cart: s.cart.map((i) => {
              if (i._key !== key && i.productId !== key) return i
              const updated = { ...i, ...updates }
              updated.subtotal = formatNumber((updated.quantity * updated.unitPrice) - (updated.discount || 0))
              return updated
            }),
          })),

        removeFromCart: (key) =>
          set((s) => ({ cart: s.cart.filter((i) => i._key !== key && i.productId !== key) })),

        clearCart: () => set({ cart: [] }),

        // ── VENTAS ───────────────────────────────────────────────────────────
        addSale: (sale) => set((s) => ({ sales: [sale, ...s.sales] })),

        updateSale: (id, updates) =>
          set((s) => ({
            sales: s.sales.map((sale) => (sale.id === id ? { ...sale, ...updates } : sale)),
          })),

        // ── CAJA ─────────────────────────────────────────────────────────────
        openCashSession:  (session)       => set({ activeCashSession: session }),
        closeCashSession: (closedSession) =>
          set((s) => ({
            activeCashSession: null,
            cashSessions: [closedSession, ...s.cashSessions],
          })),

        // ── CLIENTES ─────────────────────────────────────────────────────────
        addClient: (client) =>
          set((s) => ({ clients: [client, ...s.clients] })),

        updateClient: (id, updates) =>
          set((s) => ({
            clients: s.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)),
          })),

        // ── PROVEEDORES ──────────────────────────────────────────────────────
        addSupplier: (supplier) =>
          set((s) => ({ suppliers: [supplier, ...s.suppliers] })),

        updateSupplier: (id, updates) =>
          set((s) => ({
            suppliers: s.suppliers.map((s2) => (s2.id === id ? { ...s2, ...updates } : s2)),
          })),

        // ── COMPRAS A PROVEEDOR ──────────────────────────────────────────────
        addPurchase: (purchase) =>
          set((s) => ({ purchases: [purchase, ...s.purchases] })),

        updatePurchase: (id, updates) =>
          set((s) => ({
            purchases: s.purchases.map((p) => (p.id === id ? { ...p, ...updates } : p)),
          })),

        // ── USUARIOS ─────────────────────────────────────────────────────────
        addUser: (user) =>
          set((s) => ({ users: [user, ...s.users] })),

        updateUser: (id, updates) =>
          set((s) => ({
            users: s.users.map((u) => (u.id === id ? { ...u, ...updates } : u)),
          })),

        // ── RESET DEMO ────────────────────────────────────────────────────────
        resetDemo: (sector) => {
          const initial = getInitialDemoState()
          if (sector) initial.businessConfig.sector = sector
          set({ ...initial, currentUser: get().currentUser })
        },

      }),
      {
        name: 'mm_store_v2',
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
          cart:              s.cart,
          currentUser:       s.currentUser,
          businessConfig:    s.businessConfig,
          nextInvoice:       s.nextInvoice,
        }),
      }
    )
  )
)

// ─── FIX: usar getState() en lugar de window.__MM_STORE__ ────────────────────
// Los servicios llaman useStore.getState() directamente — sin window, sin snapshot

// ─── SELECTORES ───────────────────────────────────────────────────────────────
export const selectLowStockProducts = (s) =>
  s.products.filter((p) => p.isActive && p.stock <= p.stockMin)

export const selectActiveProducts = (s) =>
  s.products.filter((p) => p.isActive)

export const selectTodaySales = (s) => {
  const now = new Date()
  return s.sales.filter((sale) => {
    const d = new Date(sale.createdAt)
    return sale.status === 'completada' &&
      d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
}

export const selectCartTotal = (s) =>
  parseFloat(s.cart.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2))

export const selectCartCount = (s) =>
  s.cart.reduce((acc, i) => acc + i.quantity, 0)

export const selectNearExpiryProducts = (s) =>
  s.products.filter(p => {
    if (!p.isActive || !p.expiryDate) return false
    const days = Math.ceil((new Date(p.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    return days >= 0 && days <= 30
  })
