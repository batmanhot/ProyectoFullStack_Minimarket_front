/**
 * Tests: inventoryEngine.js
 * Cubre las 4 estrategias de stock (simple, fefo, fifo, serie),
 * merma, alertas automáticas y constantes de configuración.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  STOCK_CONTROL,
  SECTOR_STOCK_DEFAULTS,
  calcStockDisponible,
  allocateStock,
  allocateMerma,
  detectStockAlerts,
} from '../../shared/utils/inventoryEngine'

// ─── Helpers para construir fixtures ─────────────────────────────────────────
const tomorrow = () => {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}
const yesterday = () => {
  const d = new Date(); d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}
const daysFromNow = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const makeBatch = (overrides = {}) => ({
  id:          'b1',
  batchNumber: 'LOT-001',
  quantity:    10,
  status:      'activo',
  expiryDate:  tomorrow(),
  createdAt:   new Date(Date.now() - 86400_000).toISOString(),
  priceBuy:    5,
  ...overrides,
})

const makeProduct = (overrides = {}) => ({
  id:           'p1',
  name:         'Producto Test',
  unit:         'kg',
  stock:        20,
  stockMin:     5,
  stockControl: STOCK_CONTROL.SIMPLE,
  priceBuy:     5,
  batches:      [],
  isActive:     true,
  ...overrides,
})

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK_CONTROL — constantes
// ═══════════════════════════════════════════════════════════════════════════════
describe('STOCK_CONTROL', () => {
  it('define los 4 valores de estrategia', () => {
    expect(STOCK_CONTROL.SIMPLE).toBe('simple')
    expect(STOCK_CONTROL.LOTE_FEFO).toBe('lote_fefo')
    expect(STOCK_CONTROL.LOTE_FIFO).toBe('lote_fifo')
    expect(STOCK_CONTROL.SERIE).toBe('serie')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SECTOR_STOCK_DEFAULTS — configuración por sector
// ═══════════════════════════════════════════════════════════════════════════════
describe('SECTOR_STOCK_DEFAULTS', () => {
  it('define al menos 10 sectores', () => {
    expect(Object.keys(SECTOR_STOCK_DEFAULTS).length).toBeGreaterThanOrEqual(10)
  })
  it('bodega usa FEFO por defecto', () => {
    expect(SECTOR_STOCK_DEFAULTS.bodega.defaultControl).toBe('lote_fefo')
    expect(SECTOR_STOCK_DEFAULTS.bodega.useBatches).toBe(true)
  })
  it('electronica usa serie por defecto', () => {
    expect(SECTOR_STOCK_DEFAULTS.electronica.defaultControl).toBe('serie')
  })
  it('boutique usa simple por defecto', () => {
    expect(SECTOR_STOCK_DEFAULTS.boutique.defaultControl).toBe('simple')
    expect(SECTOR_STOCK_DEFAULTS.boutique.useBatches).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// calcStockDisponible
// ═══════════════════════════════════════════════════════════════════════════════
describe('calcStockDisponible', () => {
  it('simple: devuelve product.stock directamente', () => {
    const p = makeProduct({ stock: 15, stockControl: STOCK_CONTROL.SIMPLE })
    expect(calcStockDisponible(p)).toBe(15)
  })

  it('serie: devuelve product.stock', () => {
    const p = makeProduct({ stock: 1, stockControl: STOCK_CONTROL.SERIE })
    expect(calcStockDisponible(p)).toBe(1)
  })

  it('sin stockControl → trata como simple', () => {
    const p = makeProduct({ stock: 8, stockControl: undefined })
    expect(calcStockDisponible(p)).toBe(8)
  })

  it('fefo: suma lotes activos no vencidos', () => {
    const p = makeProduct({
      stock: 0, stockControl: STOCK_CONTROL.LOTE_FEFO,
      batches: [
        makeBatch({ id: 'b1', quantity: 10, expiryDate: tomorrow() }),
        makeBatch({ id: 'b2', quantity: 5,  expiryDate: tomorrow() }),
        makeBatch({ id: 'b3', quantity: 8,  status: 'agotado', expiryDate: tomorrow() }),
      ],
    })
    expect(calcStockDisponible(p)).toBe(15) // b1 + b2; b3 agotado no cuenta
  })

  it('fefo: excluye lotes ya vencidos', () => {
    const p = makeProduct({
      stock: 0, stockControl: STOCK_CONTROL.LOTE_FEFO,
      batches: [
        makeBatch({ id: 'b1', quantity: 10, expiryDate: yesterday() }), // vencido
        makeBatch({ id: 'b2', quantity: 5,  expiryDate: tomorrow() }),  // vigente
      ],
    })
    expect(calcStockDisponible(p)).toBe(5)
  })

  it('fefo: incluye lotes sin expiryDate', () => {
    const p = makeProduct({
      stock: 0, stockControl: STOCK_CONTROL.LOTE_FEFO,
      batches: [
        makeBatch({ id: 'b1', quantity: 8, expiryDate: null }),
      ],
    })
    expect(calcStockDisponible(p)).toBe(8)
  })

  it('fifo: suma todos los lotes activos (sin filtrar por fecha)', () => {
    const p = makeProduct({
      stock: 0, stockControl: STOCK_CONTROL.LOTE_FIFO,
      batches: [
        makeBatch({ id: 'b1', quantity: 10, expiryDate: yesterday() }), // vencido pero FIFO no filtra
        makeBatch({ id: 'b2', quantity: 5,  expiryDate: null }),
      ],
    })
    // FIFO no excluye vencidos en calcStockDisponible
    expect(calcStockDisponible(p)).toBe(15)
  })

  it('producto sin batches → 0 para fefo/fifo', () => {
    const p = makeProduct({ stock: 0, stockControl: STOCK_CONTROL.LOTE_FEFO, batches: [] })
    expect(calcStockDisponible(p)).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// allocateStock — estrategia SIMPLE
// ═══════════════════════════════════════════════════════════════════════════════
describe('allocateStock — SIMPLE', () => {
  it('descuenta correctamente el stock', () => {
    const product = makeProduct({ stock: 20, stockControl: STOCK_CONTROL.SIMPLE })
    const result = allocateStock({ product, quantity: 5, invoiceNumber: 'B001-000001' })

    expect(result.error).toBeNull()
    expect(result.stockUpdate.stock).toBe(15)
    expect(result.batchAllocations).toHaveLength(0)
  })

  it('stock nunca queda negativo (newStock = max(0, prev - qty))', () => {
    const product = makeProduct({ stock: 3, stockControl: STOCK_CONTROL.SIMPLE })
    const result = allocateStock({ product, quantity: 10, invoiceNumber: 'B001-000001' })
    // stock < quantity pero calcStockDisponible devuelve 3 < 10 → error
    expect(result.error).toBeTruthy()
  })

  it('stock insuficiente → error con mensaje descriptivo', () => {
    const product = makeProduct({ stock: 2, stockControl: STOCK_CONTROL.SIMPLE })
    const result = allocateStock({ product, quantity: 5, invoiceNumber: 'B001-000001' })

    expect(result.error).toContain('Stock insuficiente')
    expect(result.stockUpdate).toBeNull()
    expect(result.movement).toBeNull()
  })

  it('movement tiene los campos correctos', () => {
    const product = makeProduct({ stock: 10, priceBuy: 5, stockControl: STOCK_CONTROL.SIMPLE })
    const result = allocateStock({ product, quantity: 3, invoiceNumber: 'B001-000001' })

    expect(result.movement.type).toBe('salida')
    expect(result.movement.quantity).toBe(3)
    expect(result.movement.previousStock).toBe(10)
    expect(result.movement.newStock).toBe(7)
    expect(result.movement.stockControl).toBe('simple')
    expect(result.movement.totalValue).toBe(15)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// allocateStock — estrategia SERIE
// ═══════════════════════════════════════════════════════════════════════════════
describe('allocateStock — SERIE', () => {
  it('libera el serial y descuenta stock', () => {
    const product = makeProduct({
      stock: 1,
      stockControl: STOCK_CONTROL.SERIE,
      serialNumber: 'SN-ABC-123',
    })
    const result = allocateStock({ product, quantity: 1, invoiceNumber: 'B001-000001' })

    expect(result.error).toBeNull()
    expect(result.stockUpdate.stock).toBe(0)
    expect(result.stockUpdate.serialNumber).toBe('')
    expect(result.batchAllocations[0].batchNumber).toBe('SN-ABC-123')
  })

  it('movement incluye el número de serie en el reason', () => {
    const product = makeProduct({
      stock: 1, stockControl: STOCK_CONTROL.SERIE, serialNumber: 'SN-XYZ',
    })
    const result = allocateStock({ product, quantity: 1, invoiceNumber: 'B001-000001' })
    expect(result.movement.reason).toContain('SN-XYZ')
    expect(result.movement.serialNumber).toBe('SN-XYZ')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// allocateStock — estrategia FEFO
// ═══════════════════════════════════════════════════════════════════════════════
describe('allocateStock — LOTE_FEFO', () => {
  it('asigna primero el lote que vence antes', () => {
    const earlyBatch = makeBatch({ id: 'b-early', batchNumber: 'EARLY', quantity: 5, expiryDate: daysFromNow(5) })
    const lateBatch  = makeBatch({ id: 'b-late',  batchNumber: 'LATE',  quantity: 5, expiryDate: daysFromNow(30) })
    const product = makeProduct({
      stock: 10, stockControl: STOCK_CONTROL.LOTE_FEFO,
      batches: [lateBatch, earlyBatch], // orden inverso para verificar que se reordena
    })
    const result = allocateStock({ product, quantity: 3, invoiceNumber: 'B001-000001' })

    expect(result.error).toBeNull()
    const firstAlloc = result.batchAllocations[0]
    expect(firstAlloc.batchNumber).toBe('EARLY')
    expect(firstAlloc.quantity).toBe(3)
  })

  it('distribuye entre varios lotes cuando uno solo no alcanza', () => {
    const b1 = makeBatch({ id: 'b1', batchNumber: 'B1', quantity: 3, expiryDate: daysFromNow(5) })
    const b2 = makeBatch({ id: 'b2', batchNumber: 'B2', quantity: 10, expiryDate: daysFromNow(15) })
    const product = makeProduct({
      stock: 13, stockControl: STOCK_CONTROL.LOTE_FEFO, batches: [b1, b2],
    })
    const result = allocateStock({ product, quantity: 8, invoiceNumber: 'B001-000001' })

    expect(result.batchAllocations).toHaveLength(2)
    expect(result.batchAllocations[0].quantity).toBe(3) // b1 agotado
    expect(result.batchAllocations[1].quantity).toBe(5) // b2 parcial
  })

  it('marca lote como agotado cuando llega a 0', () => {
    const b1 = makeBatch({ id: 'b1', quantity: 5, expiryDate: daysFromNow(5) })
    const product = makeProduct({
      stock: 5, stockControl: STOCK_CONTROL.LOTE_FEFO, batches: [b1],
    })
    const result = allocateStock({ product, quantity: 5, invoiceNumber: 'B001-000001' })

    const updatedB1 = result.stockUpdate.batches.find(b => b.id === 'b1')
    expect(updatedB1.status).toBe('agotado')
    expect(updatedB1.quantity).toBe(0)
  })

  it('excluye lotes vencidos de la asignación', () => {
    const expired = makeBatch({ id: 'b-exp', quantity: 10, expiryDate: yesterday() })
    const valid   = makeBatch({ id: 'b-ok',  quantity: 5,  expiryDate: tomorrow() })
    const product = makeProduct({
      stock: 5, stockControl: STOCK_CONTROL.LOTE_FEFO, batches: [expired, valid],
    })
    const result = allocateStock({ product, quantity: 5, invoiceNumber: 'B001-000001' })

    expect(result.error).toBeNull()
    expect(result.batchAllocations[0].batchNumber).toBe(valid.batchNumber)
  })

  it('error cuando stock en lotes no alcanza', () => {
    const b1 = makeBatch({ id: 'b1', quantity: 3, expiryDate: tomorrow() })
    const product = makeProduct({
      stock: 3, stockControl: STOCK_CONTROL.LOTE_FEFO, batches: [b1],
    })
    const result = allocateStock({ product, quantity: 5, invoiceNumber: 'B001-000001' })
    expect(result.error).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// allocateStock — estrategia FIFO
// ═══════════════════════════════════════════════════════════════════════════════
describe('allocateStock — LOTE_FIFO', () => {
  it('asigna primero el lote más antiguo', () => {
    const older = makeBatch({
      id: 'b-old', batchNumber: 'OLD', quantity: 5,
      createdAt: new Date(Date.now() - 10 * 86400_000).toISOString(),
    })
    const newer = makeBatch({
      id: 'b-new', batchNumber: 'NEW', quantity: 5,
      createdAt: new Date(Date.now() - 1 * 86400_000).toISOString(),
    })
    const product = makeProduct({
      stock: 10, stockControl: STOCK_CONTROL.LOTE_FIFO, batches: [newer, older],
    })
    const result = allocateStock({ product, quantity: 3, invoiceNumber: 'B001-000001' })

    expect(result.error).toBeNull()
    expect(result.batchAllocations[0].batchNumber).toBe('OLD')
  })

  it('FIFO no filtra lotes vencidos (los toma igual)', () => {
    const expired = makeBatch({
      id: 'b-exp', batchNumber: 'EXP', quantity: 5, expiryDate: yesterday(),
      createdAt: new Date(Date.now() - 20 * 86400_000).toISOString(),
    })
    const product = makeProduct({
      stock: 5, stockControl: STOCK_CONTROL.LOTE_FIFO, batches: [expired],
    })
    const result = allocateStock({ product, quantity: 3, invoiceNumber: 'B001-000001' })
    // FIFO toma el lote aunque esté vencido (diferente a FEFO)
    expect(result.error).toBeNull()
    expect(result.batchAllocations[0].batchNumber).toBe('EXP')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// allocateMerma
// ═══════════════════════════════════════════════════════════════════════════════
describe('allocateMerma', () => {
  it('simple: descuenta del stock y crea mermaRecord', () => {
    const product = makeProduct({ stock: 10, stockControl: STOCK_CONTROL.SIMPLE })
    const result  = allocateMerma({ product, quantity: 3, reason: 'Producto dañado' })

    expect(result.error).toBeNull()
    expect(result.stockUpdate.stock).toBe(7)
    expect(result.mermaRecord.quantity).toBe(3)
    expect(result.mermaRecord.batchId).toBeNull()
    expect(result.movement.type).toBe('merma')
  })

  it('serie: igual que simple (usa product.stock)', () => {
    const product = makeProduct({ stock: 1, stockControl: STOCK_CONTROL.SERIE })
    const result  = allocateMerma({ product, quantity: 1, reason: 'Defecto' })
    expect(result.error).toBeNull()
    expect(result.stockUpdate.stock).toBe(0)
  })

  it('con lote: descuenta del lote y recalcula stock', () => {
    const b1 = makeBatch({ id: 'b1', quantity: 10 })
    const product = makeProduct({
      stock: 10, stockControl: STOCK_CONTROL.LOTE_FEFO, batches: [b1],
    })
    const result = allocateMerma({ product, quantity: 4, reason: 'Vencido', batchId: 'b1' })

    expect(result.error).toBeNull()
    expect(result.mermaRecord.batchId).toBe('b1')
    expect(result.mermaRecord.quantity).toBe(4)
    const updatedBatch = result.stockUpdate.batches.find(b => b.id === 'b1')
    expect(updatedBatch.quantity).toBe(6)
  })

  it('con lote no encontrado → error', () => {
    const product = makeProduct({
      stock: 10, stockControl: STOCK_CONTROL.LOTE_FEFO, batches: [],
    })
    const result = allocateMerma({ product, quantity: 3, reason: 'Test', batchId: 'nonexistent' })
    expect(result.error).toBeTruthy()
  })

  it('mermaRecord tiene id y createdAt únicos', () => {
    const product = makeProduct({ stock: 10, stockControl: STOCK_CONTROL.SIMPLE })
    const r1 = allocateMerma({ product, quantity: 1, reason: 'A' })
    const r2 = allocateMerma({ product, quantity: 1, reason: 'B' })
    expect(r1.mermaRecord.id).not.toBe(r2.mermaRecord.id)
  })

  it('lote se marca como merma cuando llega a 0', () => {
    const b1 = makeBatch({ id: 'b1', quantity: 5 })
    const product = makeProduct({
      stock: 5, stockControl: STOCK_CONTROL.LOTE_FEFO, batches: [b1],
    })
    const result = allocateMerma({ product, quantity: 5, reason: 'Vencido', batchId: 'b1' })
    const updatedBatch = result.stockUpdate.batches.find(b => b.id === 'b1')
    expect(updatedBatch.status).toBe('merma')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// detectStockAlerts
// ═══════════════════════════════════════════════════════════════════════════════
describe('detectStockAlerts', () => {
  it('stock_bajo: stock > 0 y <= stockMin', () => {
    const products = [makeProduct({ stock: 3, stockMin: 5, stockControl: STOCK_CONTROL.SIMPLE })]
    const alerts   = detectStockAlerts(products, {})
    expect(alerts).toContainEqual(expect.objectContaining({ type: 'stock_bajo', productId: 'p1' }))
  })

  it('sin_stock: stock = 0', () => {
    const products = [makeProduct({ stock: 0, stockMin: 5 })]
    const alerts   = detectStockAlerts(products, {})
    expect(alerts).toContainEqual(expect.objectContaining({ type: 'sin_stock', productId: 'p1' }))
  })

  it('producto inactivo → no genera alertas', () => {
    const products = [makeProduct({ stock: 0, isActive: false })]
    expect(detectStockAlerts(products, {})).toHaveLength(0)
  })

  it('vencido: lote con expiryDate en el pasado (FEFO)', () => {
    const b = makeBatch({ expiryDate: yesterday() })
    const products = [makeProduct({
      stock: 10, stockControl: STOCK_CONTROL.LOTE_FEFO,
      batches: [b], stockMin: 2,
    })]
    const alerts = detectStockAlerts(products, {})
    expect(alerts).toContainEqual(expect.objectContaining({ type: 'vencido' }))
  })

  it('por_vencer: lote que vence en <= expiryAlertDays días (FEFO)', () => {
    const b = makeBatch({ expiryDate: daysFromNow(10) })
    const products = [makeProduct({
      stock: 10, stockControl: STOCK_CONTROL.LOTE_FEFO,
      batches: [b], stockMin: 2,
    })]
    const alerts = detectStockAlerts(products, { expiryAlertDays: 30 })
    expect(alerts).toContainEqual(expect.objectContaining({ type: 'por_vencer' }))
  })

  it('lote agotado no genera alerta de vencimiento', () => {
    const b = makeBatch({ expiryDate: yesterday(), status: 'agotado' })
    const products = [makeProduct({
      stock: 0, stockControl: STOCK_CONTROL.LOTE_FEFO, batches: [b], stockMin: 0,
    })]
    const alerts = detectStockAlerts(products, {})
    const vencidos = alerts.filter(a => a.type === 'vencido')
    expect(vencidos).toHaveLength(0)
  })

  it('usa expiryAlertDays=30 por defecto cuando systemConfig es vacío', () => {
    const b = makeBatch({ expiryDate: daysFromNow(25) }) // dentro de 30 días
    const products = [makeProduct({
      stock: 10, stockControl: STOCK_CONTROL.LOTE_FEFO,
      batches: [b], stockMin: 0,
    })]
    const alerts = detectStockAlerts(products, {})
    expect(alerts).toContainEqual(expect.objectContaining({ type: 'por_vencer' }))
  })

  it('FIFO/SIMPLE no generan alertas de vencimiento', () => {
    const b = makeBatch({ expiryDate: yesterday() })
    const products = [makeProduct({
      stock: 10, stockControl: STOCK_CONTROL.LOTE_FIFO,
      batches: [b], stockMin: 0,
    })]
    const alerts = detectStockAlerts(products, {})
    const vencidos = alerts.filter(a => a.type === 'vencido' || a.type === 'por_vencer')
    expect(vencidos).toHaveLength(0)
  })
})
