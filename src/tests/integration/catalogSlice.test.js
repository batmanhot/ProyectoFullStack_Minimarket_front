/**
 * Tests de integración: catalogSlice
 * Valida CRUD de productos, variantes con sincronización de stock,
 * movimientos de stock (límite 1000) y contador de facturas.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { create } from 'zustand'
import { createAuditSlice }   from '../../store/slices/auditSlice'
import { createCatalogSlice } from '../../store/slices/catalogSlice'

const createTestStore = () =>
  create((set, get) => ({
    products:        [],
    productVariants: [],
    stockMovements:  [],
    categories:      [],
    brands:          [],
    mermaRecords:    [],
    invoiceCounters: {},
    nextInvoice:     1,
    systemConfig:    { auditEnabled: false },
    currentUser:     null,
    auditLog:        [],
    ...createAuditSlice(set, get),
    ...createCatalogSlice(set, get),
  }))

const makeProduct = (id = 'prd-001', overrides = {}) => ({
  id,
  name:       `Producto ${id}`,
  priceSell:  10.00,
  priceBuy:   7.00,
  stock:      50,
  stockMin:   10,
  categoryId: 'cat-001',
  isActive:   true,
  ...overrides,
})

const makeVariant = (id, productId, stock, overrides = {}) => ({
  id,
  productId,
  sku:   `${productId}-${id}`,
  stock,
  ...overrides,
})

// ═══════════════════════════════════════════════════════════════════════════════
// addProduct
// ═══════════════════════════════════════════════════════════════════════════════
describe('addProduct', () => {
  it('agrega el producto al listado', () => {
    const store = createTestStore()
    store.getState().addProduct(makeProduct())
    expect(store.getState().products).toHaveLength(1)
    expect(store.getState().products[0].id).toBe('prd-001')
  })

  it('inserta al frente (los más nuevos primero)', () => {
    const store = createTestStore()
    store.getState().addProduct(makeProduct('prd-001'))
    store.getState().addProduct(makeProduct('prd-002'))
    expect(store.getState().products[0].id).toBe('prd-002')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// updateProduct
// ═══════════════════════════════════════════════════════════════════════════════
describe('updateProduct', () => {
  it('actualiza los campos indicados por id', () => {
    const store = createTestStore()
    store.getState().addProduct(makeProduct('prd-001', { priceSell: 10 }))
    store.getState().updateProduct('prd-001', { priceSell: 15 })

    expect(store.getState().products[0].priceSell).toBe(15)
  })

  it('conserva campos no actualizados', () => {
    const store = createTestStore()
    store.getState().addProduct(makeProduct('prd-001', { stock: 50, priceSell: 10 }))
    store.getState().updateProduct('prd-001', { priceSell: 12 })

    expect(store.getState().products[0].stock).toBe(50)
  })

  it('añade updatedAt al actualizar', () => {
    const store = createTestStore()
    store.getState().addProduct(makeProduct())
    store.getState().updateProduct('prd-001', { priceSell: 12 })

    expect(store.getState().products[0].updatedAt).toBeTruthy()
  })

  it('no modifica otros productos', () => {
    const store = createTestStore()
    store.getState().addProduct(makeProduct('prd-001', { priceSell: 10 }))
    store.getState().addProduct(makeProduct('prd-002', { priceSell: 20 }))
    store.getState().updateProduct('prd-001', { priceSell: 99 })

    expect(store.getState().products.find(p => p.id === 'prd-002').priceSell).toBe(20)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// deleteProduct — soft-delete
// ═══════════════════════════════════════════════════════════════════════════════
describe('deleteProduct (soft-delete)', () => {
  it('marca el producto como inactivo (no lo elimina físicamente)', () => {
    const store = createTestStore()
    store.getState().addProduct(makeProduct('prd-001', { isActive: true }))
    store.getState().deleteProduct('prd-001')

    const product = store.getState().products.find(p => p.id === 'prd-001')
    expect(product).toBeDefined()        // sigue en el array
    expect(product.isActive).toBe(false) // pero inactivo
  })

  it('no afecta a otros productos', () => {
    const store = createTestStore()
    store.getState().addProduct(makeProduct('prd-001'))
    store.getState().addProduct(makeProduct('prd-002'))
    store.getState().deleteProduct('prd-001')

    expect(store.getState().products.find(p => p.id === 'prd-002').isActive).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Variantes — addVariant / updateVariant / deleteVariant
// ═══════════════════════════════════════════════════════════════════════════════
describe('addVariant', () => {
  it('agrega variante al listado', () => {
    const store = createTestStore()
    store.getState().addVariant(makeVariant('var-1', 'prd-v01', 10))
    expect(store.getState().productVariants).toHaveLength(1)
    expect(store.getState().productVariants[0].id).toBe('var-1')
  })
})

describe('updateVariant', () => {
  let store

  beforeEach(() => {
    store = createTestStore()
    store.getState().addProduct(makeProduct('prd-v01', { stock: 0, hasVariants: true }))
    store.getState().addVariant(makeVariant('var-azul', 'prd-v01', 5))
    store.getState().addVariant(makeVariant('var-rojo', 'prd-v01', 10))
  })

  it('actualiza los campos de la variante', () => {
    store.getState().updateVariant('var-azul', { sku: 'NUEVO-SKU' })
    const variant = store.getState().productVariants.find(v => v.id === 'var-azul')
    expect(variant.sku).toBe('NUEVO-SKU')
  })

  it('al actualizar stock de una variante, sincroniza el stock del producto padre', () => {
    // var-azul=5, var-rojo=10 → total=15
    store.getState().updateVariant('var-azul', { stock: 20 })
    // ahora var-azul=20, var-rojo=10 → total=30
    const product = store.getState().products.find(p => p.id === 'prd-v01')
    expect(product.stock).toBe(30)
  })

  it('sin cambio de stock → no recalcula stock del padre', () => {
    const productBefore = store.getState().products.find(p => p.id === 'prd-v01')
    const stockBefore = productBefore.stock

    store.getState().updateVariant('var-azul', { sku: 'solo-sku-change' })

    const productAfter = store.getState().products.find(p => p.id === 'prd-v01')
    expect(productAfter.stock).toBe(stockBefore) // sin cambio
  })
})

describe('deleteVariant', () => {
  it('elimina la variante del listado (hard-delete)', () => {
    const store = createTestStore()
    store.getState().addVariant(makeVariant('var-1', 'prd-v01', 5))
    store.getState().addVariant(makeVariant('var-2', 'prd-v01', 10))
    store.getState().deleteVariant('var-1')

    expect(store.getState().productVariants).toHaveLength(1)
    expect(store.getState().productVariants[0].id).toBe('var-2')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// addStockMovement — límite de 1000 registros
// ═══════════════════════════════════════════════════════════════════════════════
describe('addStockMovement', () => {
  it('agrega un movimiento al listado', () => {
    const store = createTestStore()
    const movement = { id: 'mov-1', productId: 'prd-001', type: 'entrada', quantity: 10 }
    store.getState().addStockMovement(movement)

    expect(store.getState().stockMovements).toHaveLength(1)
    expect(store.getState().stockMovements[0].id).toBe('mov-1')
  })

  it('inserta al frente (los más recientes primero)', () => {
    const store = createTestStore()
    store.getState().addStockMovement({ id: 'mov-1', quantity: 5 })
    store.getState().addStockMovement({ id: 'mov-2', quantity: 10 })

    expect(store.getState().stockMovements[0].id).toBe('mov-2')
  })

  it('respeta el límite de 1000 registros — descarta los más viejos', () => {
    const store = createTestStore()
    // Agregar 1001 movimientos
    for (let i = 1; i <= 1001; i++) {
      store.getState().addStockMovement({ id: `mov-${i}`, quantity: i })
    }

    const movements = store.getState().stockMovements
    expect(movements).toHaveLength(1000)
    // El más reciente debe estar primero
    expect(movements[0].id).toBe('mov-1001')
    // El más viejo (mov-1) fue descartado
    expect(movements.find(m => m.id === 'mov-1')).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getNextInvoice y setInvoiceCounter
// ═══════════════════════════════════════════════════════════════════════════════
describe('getNextInvoice', () => {
  it('primera llamada con B001 → B001-000001', () => {
    const store = createTestStore()
    expect(store.getState().getNextInvoice('B001')).toBe('B001-000001')
  })

  it('segunda llamada → B001-000002 (incrementa el contador)', () => {
    const store = createTestStore()
    store.getState().getNextInvoice('B001')
    expect(store.getState().getNextInvoice('B001')).toBe('B001-000002')
  })

  it('contadores por prefijo son independientes', () => {
    const store = createTestStore()
    store.getState().getNextInvoice('B001') // 1
    store.getState().getNextInvoice('B001') // 2
    expect(store.getState().getNextInvoice('F001')).toBe('F001-000001') // F001 independiente
    expect(store.getState().getNextInvoice('B001')).toBe('B001-000003')
  })

  it('emite comprobantes con 6 dígitos rellenos de ceros', () => {
    const store = createTestStore()
    const invoice = store.getState().getNextInvoice('NC001')
    expect(invoice).toBe('NC001-000001')
    expect(invoice.split('-')[1]).toHaveLength(6)
  })
})

describe('setInvoiceCounter', () => {
  it('permite configurar el número de inicio del correlativo', () => {
    const store = createTestStore()
    store.getState().setInvoiceCounter('B001', 100)
    expect(store.getState().getNextInvoice('B001')).toBe('B001-000100')
  })

  it('valor mínimo = 1 (no permite 0 ni negativos)', () => {
    const store = createTestStore()
    store.getState().setInvoiceCounter('B001', 0)
    expect(store.getState().invoiceCounters['B001']).toBe(1)

    store.getState().setInvoiceCounter('B001', -5)
    expect(store.getState().invoiceCounters['B001']).toBe(1)
  })

  it('no afecta otros prefijos', () => {
    const store = createTestStore()
    store.getState().setInvoiceCounter('B001', 50)
    expect(store.getState().getNextInvoice('F001')).toBe('F001-000001')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Categorías — CRUD básico
// ═══════════════════════════════════════════════════════════════════════════════
describe('categorías', () => {
  it('addCategory → agrega y retorna la categoría en la lista', () => {
    const store = createTestStore()
    store.getState().addCategory({ id: 'cat-001', name: 'Abarrotes' })
    expect(store.getState().categories).toHaveLength(1)
    expect(store.getState().categories[0].name).toBe('Abarrotes')
  })

  it('updateCategory → actualiza el nombre', () => {
    const store = createTestStore()
    store.getState().addCategory({ id: 'cat-001', name: 'Abarrotes' })
    store.getState().updateCategory('cat-001', { name: 'Abarrotes y Granos' })
    expect(store.getState().categories[0].name).toBe('Abarrotes y Granos')
  })

  it('deleteCategory → elimina del array (hard-delete)', () => {
    const store = createTestStore()
    store.getState().addCategory({ id: 'cat-001', name: 'Abarrotes' })
    store.getState().addCategory({ id: 'cat-002', name: 'Bebidas' })
    store.getState().deleteCategory('cat-001')
    expect(store.getState().categories).toHaveLength(1)
    expect(store.getState().categories[0].id).toBe('cat-002')
  })
})
