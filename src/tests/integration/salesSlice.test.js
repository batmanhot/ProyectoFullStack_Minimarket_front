/**
 * Tests de integración: salesSlice
 * Valida carrito POS, acumulación, descuentos manuales e historial de ventas.
 * Cada test crea su propio store Zustand limpio (sin persist, sin seedData).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { create } from 'zustand'
import { createAuditSlice } from '../../store/slices/auditSlice'
import { createSalesSlice } from '../../store/slices/salesSlice'

// ─── Factory: store mínimo con audit stub + salesSlice ────────────────────────
const createTestStore = () =>
  create((set, get) => ({
    cart:          [],
    sales:         [],
    debtPayments:  [],
    systemConfig:  { auditEnabled: false }, // audit deshabilitado en tests
    currentUser:   null,
    auditLog:      [],
    ...createAuditSlice(set, get),
    ...createSalesSlice(set, get),
  }))

// Producto fixture reutilizable
const makeProduct = (id = 'prd-001', price = 10.00) => ({
  id,
  name:     `Producto ${id}`,
  priceSell: price,
  barcode:  `BAR-${id}`,
  unit:     'unidad',
})

// ═══════════════════════════════════════════════════════════════════════════════
// addToCart
// ═══════════════════════════════════════════════════════════════════════════════
describe('addToCart', () => {
  it('agrega un nuevo producto con los campos correctos', () => {
    const store = createTestStore()
    store.getState().addToCart(makeProduct(), 1)

    const cart = store.getState().cart
    expect(cart).toHaveLength(1)
    expect(cart[0].productId).toBe('prd-001')
    expect(cart[0].quantity).toBe(1)
    expect(cart[0].unitPrice).toBe(10.00)
    expect(cart[0].subtotal).toBe(10.00)
    expect(cart[0].discount).toBe(0)
  })

  it('agrega con cantidad > 1 y calcula subtotal', () => {
    const store = createTestStore()
    store.getState().addToCart(makeProduct(), 3)
    expect(store.getState().cart[0].quantity).toBe(3)
    expect(store.getState().cart[0].subtotal).toBe(30.00)
  })

  it('acumula cantidad si el mismo producto ya existe', () => {
    const store = createTestStore()
    store.getState().addToCart(makeProduct(), 2)
    store.getState().addToCart(makeProduct(), 3)

    expect(store.getState().cart).toHaveLength(1) // sigue siendo 1 línea
    expect(store.getState().cart[0].quantity).toBe(5)
    expect(store.getState().cart[0].subtotal).toBe(50.00)
  })

  it('productos distintos → líneas separadas', () => {
    const store = createTestStore()
    store.getState().addToCart(makeProduct('prd-001', 10), 1)
    store.getState().addToCart(makeProduct('prd-002', 9.50), 1)
    expect(store.getState().cart).toHaveLength(2)
  })

  it('variantes distintas del mismo producto → líneas separadas', () => {
    const store = createTestStore()
    const product = makeProduct('prd-v01', 25)
    store.getState().addToCart(product, 1, 'var-rojo')
    store.getState().addToCart(product, 1, 'var-azul')

    expect(store.getState().cart).toHaveLength(2)
    expect(store.getState().cart[0]._key).toBe('prd-v01_var-rojo')
    expect(store.getState().cart[1]._key).toBe('prd-v01_var-azul')
  })

  it('misma variante → acumula en la misma línea', () => {
    const store = createTestStore()
    const product = makeProduct('prd-v01', 25)
    store.getState().addToCart(product, 1, 'var-rojo')
    store.getState().addToCart(product, 2, 'var-rojo')

    expect(store.getState().cart).toHaveLength(1)
    expect(store.getState().cart[0].quantity).toBe(3)
  })

  it('_key sin variante = productId', () => {
    const store = createTestStore()
    store.getState().addToCart(makeProduct('prd-001'), 1)
    expect(store.getState().cart[0]._key).toBe('prd-001')
  })

  it('_key con variante = productId_variantId', () => {
    const store = createTestStore()
    store.getState().addToCart(makeProduct('prd-001'), 1, 'var-M')
    expect(store.getState().cart[0]._key).toBe('prd-001_var-M')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// updateCartItem
// ═══════════════════════════════════════════════════════════════════════════════
describe('updateCartItem', () => {
  let store

  beforeEach(() => {
    store = createTestStore()
    store.getState().addToCart(makeProduct('prd-001', 10), 2)
    store.getState().addToCart(makeProduct('prd-002', 20), 1)
  })

  it('actualiza la cantidad y recalcula subtotal', () => {
    const key = store.getState().cart[0]._key
    store.getState().updateCartItem(key, { quantity: 5 })

    expect(store.getState().cart[0].quantity).toBe(5)
    expect(store.getState().cart[0].subtotal).toBe(50.00) // 5 × 10
  })

  it('aplica descuento manual y lo descuenta del subtotal', () => {
    const key = store.getState().cart[0]._key
    store.getState().updateCartItem(key, { discount: 5 })

    // subtotal = (2 × 10) - 5 = 15
    expect(store.getState().cart[0].subtotal).toBe(15.00)
  })

  it('cantidad + descuento juntos → subtotal correcto', () => {
    const key = store.getState().cart[0]._key
    store.getState().updateCartItem(key, { quantity: 3, discount: 5 })
    // (3 × 10) - 5 = 25
    expect(store.getState().cart[0].subtotal).toBe(25.00)
  })

  it('busca SOLO por _key, no modifica otras líneas', () => {
    const key = store.getState().cart[0]._key
    store.getState().updateCartItem(key, { quantity: 10 })

    // La segunda línea debe quedar intacta
    expect(store.getState().cart[1].quantity).toBe(1)
    expect(store.getState().cart[1].subtotal).toBe(20.00)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// removeFromCart
// ═══════════════════════════════════════════════════════════════════════════════
describe('removeFromCart', () => {
  it('elimina la línea correcta por _key', () => {
    const store = createTestStore()
    store.getState().addToCart(makeProduct('prd-001'), 1)
    store.getState().addToCart(makeProduct('prd-002'), 1)

    const keyToRemove = store.getState().cart[0]._key
    store.getState().removeFromCart(keyToRemove)

    expect(store.getState().cart).toHaveLength(1)
    expect(store.getState().cart[0].productId).toBe('prd-002')
  })

  it('carrito queda vacío si era el único item', () => {
    const store = createTestStore()
    store.getState().addToCart(makeProduct(), 1)
    const key = store.getState().cart[0]._key
    store.getState().removeFromCart(key)

    expect(store.getState().cart).toHaveLength(0)
  })

  it('_key inexistente → no altera el carrito', () => {
    const store = createTestStore()
    store.getState().addToCart(makeProduct(), 1)
    store.getState().removeFromCart('key-que-no-existe')

    expect(store.getState().cart).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// clearCart
// ═══════════════════════════════════════════════════════════════════════════════
describe('clearCart', () => {
  it('vacía el carrito con múltiples líneas', () => {
    const store = createTestStore()
    store.getState().addToCart(makeProduct('prd-001'), 2)
    store.getState().addToCart(makeProduct('prd-002'), 3)
    store.getState().clearCart()

    expect(store.getState().cart).toHaveLength(0)
  })

  it('clearCart en carrito ya vacío → no lanza error', () => {
    const store = createTestStore()
    expect(() => store.getState().clearCart()).not.toThrow()
    expect(store.getState().cart).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// restoreCart
// ═══════════════════════════════════════════════════════════════════════════════
describe('restoreCart', () => {
  it('reemplaza el carrito actual con el snapshot', () => {
    const store = createTestStore()
    store.getState().addToCart(makeProduct(), 1) // carrito previo

    const snapshot = [
      { _key: 'prd-snap', productId: 'prd-snap', quantity: 5, unitPrice: 10, subtotal: 50, discount: 0 },
    ]
    store.getState().restoreCart(snapshot)

    expect(store.getState().cart).toEqual(snapshot)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// addSale
// ═══════════════════════════════════════════════════════════════════════════════
describe('addSale', () => {
  it('agrega la venta al historial', () => {
    const store = createTestStore()
    const sale = { id: 'sale-1', invoiceNumber: 'B001-000001', total: 50, items: [] }
    store.getState().addSale(sale)

    expect(store.getState().sales).toHaveLength(1)
    expect(store.getState().sales[0].id).toBe('sale-1')
  })

  it('inserción al frente — venta más reciente primero', () => {
    const store = createTestStore()
    store.getState().addSale({ id: 'sale-1', invoiceNumber: 'B001-000001', total: 50 })
    store.getState().addSale({ id: 'sale-2', invoiceNumber: 'B001-000002', total: 80 })

    expect(store.getState().sales[0].id).toBe('sale-2')
    expect(store.getState().sales[1].id).toBe('sale-1')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// updateSale
// ═══════════════════════════════════════════════════════════════════════════════
describe('updateSale', () => {
  it('actualiza el status de una venta por id', () => {
    const store = createTestStore()
    store.getState().addSale({ id: 'sale-1', invoiceNumber: 'B001-000001', total: 50, status: 'pendiente' })
    store.getState().updateSale('sale-1', { status: 'completada' })

    expect(store.getState().sales[0].status).toBe('completada')
  })

  it('conserva los campos no actualizados', () => {
    const store = createTestStore()
    store.getState().addSale({ id: 'sale-1', total: 50, status: 'pendiente', items: [{ id: 1 }] })
    store.getState().updateSale('sale-1', { status: 'completada' })

    expect(store.getState().sales[0].total).toBe(50)
    expect(store.getState().sales[0].items).toHaveLength(1)
  })

  it('no modifica otras ventas', () => {
    const store = createTestStore()
    store.getState().addSale({ id: 'sale-1', total: 50, status: 'pendiente' })
    store.getState().addSale({ id: 'sale-2', total: 80, status: 'pendiente' })
    store.getState().updateSale('sale-1', { status: 'completada' })

    expect(store.getState().sales.find(s => s.id === 'sale-2').status).toBe('pendiente')
  })
})
