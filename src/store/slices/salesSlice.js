/**
 * salesSlice.js — Slice de Ventas y Carrito POS
 * Ruta: src/store/slices/salesSlice.js
 *
 * Agrupa: cart (carrito activo del POS), sales (historial), debtPayments.
 * El carrito acumula cantidad por producto (_key único por producto+variante).
 */

import { formatNumber } from '../../shared/utils/helpers'

/** @param {Function} set @param {Function} get @returns {Object} */
export const createSalesSlice = (set, get) => ({

  // ─── Carrito POS ───────────────────────────────────────────────────────────
  cart: [],

  /**
   * Agrega un producto al carrito.
   * Si el mismo producto (o variante) ya existe, acumula la cantidad.
   * La clave (_key) distingue: mismo producto con distinta variante = líneas separadas.
   *
   * IMPORTANTE: la _key siempre usa variantId cuando se proporciona, garantizando
   * que dos variantes distintas del mismo producto sean líneas independientes.
   */
  addToCart: (product, quantity = 1, variantId = null) => {
    // _key es la identidad única de la línea en el carrito:
    //   - Con variante : "productId_variantId"  → líneas separadas por variante
    //   - Sin variante : "productId"             → una sola línea por producto
    const key      = variantId ? `${product.id}_${variantId}` : `${product.id}`
    const existing = get().cart.find((i) => i._key === key)

    if (existing) {
      // Acumula cantidad en la línea existente
      set((s) => ({
        cart: s.cart.map((i) =>
          i._key === key
            ? {
                ...i,
                quantity: i.quantity + quantity,
                subtotal: formatNumber((i.quantity + quantity) * i.unitPrice),
              }
            : i
        ),
      }))
    } else {
      // Nueva línea en el carrito
      set((s) => ({
        cart: [
          ...s.cart,
          {
            _key:        key,
            id:          crypto.randomUUID(),
            productId:   product.id,
            variantId:   variantId || null,
            productName: product.name,
            barcode:     product.barcode || '',
            quantity,
            unitPrice:   product.priceSell,
            discount:    0,
            subtotal:    formatNumber(quantity * product.priceSell),
            unit:        product.unit || 'unidad',
          },
        ],
      }))
    }
  },

  /**
   * Actualiza campos de una línea del carrito (discount, quantity, etc.).
   * Recalcula el subtotal automáticamente: (quantity × unitPrice) - discount.
   * Busca SOLO por _key (nunca por productId) para evitar ambigüedad entre
   * variantes del mismo producto.
   */
  updateCartItem: (key, updates) =>
    set((s) => ({
      cart: s.cart.map((i) => {
        if (i._key !== key) return i   // ← busca SOLO por _key
        const updated = { ...i, ...updates }
        updated.subtotal = formatNumber(
          (updated.quantity * updated.unitPrice) - (updated.discount || 0)
        )
        return updated
      }),
    })),

  // Elimina una línea del carrito buscando SOLO por _key
  removeFromCart: (key) =>
    set((s) => ({
      cart: s.cart.filter((i) => i._key !== key),
    })),

  clearCart: () => set({ cart: [] }),

  // Restaura un carrito completo desde un snapshot (p.ej. venta en espera).
  // Acepta ítems ya formateados con todos sus campos (_key, unitPrice, subtotal…).
  restoreCart: (items) => set({ cart: items }),

  // ─── Ventas ────────────────────────────────────────────────────────────────
  addSale: (sale) => {
    get().addAuditLog({
      action:   'CREATE',
      module:   'Ventas',
      detail:   `Venta: ${sale.invoiceNumber} · S/${sale.total}`,
      entityId: sale.id,
    })
    set((s) => ({ sales: [sale, ...s.sales] }))
  },

  updateSale: (id, updates) => {
    const statusLabel = updates.status ? ` · ${updates.status}` : ''
    get().addAuditLog({
      action:   'UPDATE',
      module:   'Ventas',
      detail:   `Venta actualizada${statusLabel}`,
      entityId: id,
    })
    set((s) => ({
      sales: s.sales.map((sale) => (sale.id === id ? { ...sale, ...updates } : sale)),
    }))
  },

  // ─── Pagos de deuda ────────────────────────────────────────────────────────
  debtPayments: [],

  addDebtPayment: (payment) => {
    get().addAuditLog({
      action:   'CREATE',
      module:   'Cobranza',
      detail:   `Pago deuda: ${payment.receiptNumber} · ${payment.clientName} · S/${payment.amount}`,
      entityId: payment.id,
    })
    set((s) => ({ debtPayments: [payment, ...s.debtPayments] }))
  },
})
