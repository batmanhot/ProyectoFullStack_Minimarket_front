/**
 * Tests adicionales: saleService — paths no cubiertos
 * Cubre: SERIE, BUNDLE, crédito, puntos de lealtad y cancelación.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

let storeState = {}

vi.mock('../../store/index', () => ({
  useStore: { getState: () => storeState },
}))

vi.mock('../../services/_base', () => ({
  USE_API:      false,
  USE_FACTUAPI: false,
  ok:    (data, total) => ({ data, meta: { total: total ?? 1 }, error: null }),
  fail:  (msg)         => ({ data: null, meta: null, error: msg }),
  gs:    ()            => storeState,
  delay: vi.fn().mockResolvedValue(undefined),
  api:   {},
}))

vi.mock('../../shared/utils/inventoryEngine', () => ({
  allocateStock: vi.fn(({ product, quantity }) => ({
    error:            null,
    stockUpdate:      { stock: Math.max(0, (product.stock ?? 0) - quantity) },
    movement:         { type: 'salida', quantity, previousStock: product.stock, newStock: Math.max(0, (product.stock ?? 0) - quantity) },
    batchAllocations: [],
  })),
  calcStockDisponible: vi.fn((p) => p.stock ?? 0),
}))

// vi.mock se hoist al top — no usar variables externas en la factory
vi.mock('../../services/serialService', () => ({
  serialService: {
    markSold:      vi.fn().mockResolvedValue(undefined),
    markAvailable: vi.fn().mockResolvedValue(undefined),
  },
}))

import { saleService }   from '../../services/saleService'
import { serialService } from '../../services/serialService'

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const makeProduct = (id, stock, overrides = {}) => ({
  id, name: `Producto ${id}`, priceSell: 10, priceBuy: 7,
  stock, stockMin: 5, stockControl: 'simple', isActive: true,
  type: 'simple', components: [], ...overrides,
})

const makeClient = (id, overrides = {}) => ({
  id, name: 'Cliente Test', documentType: 'DNI', documentNumber: '12345678',
  creditLimit: 500, currentDebt: 0,
  loyaltyPoints: 0, loyaltyAccumulated: 0, loyaltyLevel: 'Bronce',
  loyaltyTransactions: [], ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  storeState = {
    sales: [], products: [], productVariants: [], clients: [],
    productSerials: [], stockMovements: [], cart: [],
    systemConfig: { auditEnabled: false },
    currentUser: { id: 'usr-1', role: 'admin' },
    invoiceCounters: {}, nextInvoice: 1,

    addSale:          vi.fn((s) => { storeState.sales = [s, ...storeState.sales] }),
    updateSale:       vi.fn((id, u) => { storeState.sales = storeState.sales.map(s => s.id === id ? { ...s, ...u } : s) }),
    clearCart:        vi.fn(),
    addReturn:        vi.fn(),
    addStockMovement: vi.fn(),
    updateProduct:    vi.fn((id, u) => { storeState.products = storeState.products.map(p => p.id === id ? { ...p, ...u } : p) }),
    updateVariant:    vi.fn(),
    updateClient:     vi.fn((id, u) => { storeState.clients = storeState.clients.map(c => c.id === id ? { ...c, ...u } : c) }),
    enqueueOfflineOp: vi.fn(),
    addAuditLog:      vi.fn(),
    getNextInvoice:   vi.fn(() => 'NC001-000001'),
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// SERIE — venta con selectedSerial
// ═══════════════════════════════════════════════════════════════════════════════
describe('saleService.create — producto SERIE', () => {
  beforeEach(() => {
    storeState.products = [
      makeProduct('prd-serie', 3, { stockControl: 'serie' }),
    ]
    storeState.productSerials = [
      { id: 'ser-1', productId: 'prd-serie', serialNumber: 'SN-001', status: 'disponible' },
      { id: 'ser-2', productId: 'prd-serie', serialNumber: 'SN-002', status: 'disponible' },
    ]
  })

  it('llama serialService.markSold con el serial y comprobante correctos', async () => {
    await saleService.create({
      invoiceNumber: 'B001-000010',
      items: [{ productId: 'prd-serie', productName: 'TV', quantity: 1, unitPrice: 500, subtotal: 500, selectedSerial: 'SN-001', stockControl: 'serie' }],
      total: 500, payments: [{ method: 'efectivo', amount: 500 }],
    })
    expect(serialService.markSold).toHaveBeenCalledWith('prd-serie', 'SN-001', null, 'B001-000010')
  })

  it('registra movimiento de salida con el serial en el reason', async () => {
    await saleService.create({
      invoiceNumber: 'B001-000011',
      items: [{ productId: 'prd-serie', productName: 'TV', quantity: 1, unitPrice: 500, subtotal: 500, selectedSerial: 'SN-002', stockControl: 'serie' }],
      total: 500, payments: [{ method: 'efectivo', amount: 500 }],
    })
    const call = storeState.addStockMovement.mock.calls[0][0]
    expect(call.reason).toContain('SN-002')
    expect(call.serialNumber).toBe('SN-002')
    expect(call.type).toBe('salida')
  })

  it('la venta queda como completada', async () => {
    const r = await saleService.create({
      invoiceNumber: 'B001-000012',
      items: [{ productId: 'prd-serie', productName: 'TV', quantity: 1, unitPrice: 500, subtotal: 500, selectedSerial: 'SN-001', stockControl: 'serie' }],
      total: 500, payments: [{ method: 'efectivo', amount: 500 }],
    })
    expect(r.data.status).toBe('completada')
    expect(storeState.addSale).toHaveBeenCalledOnce()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// BUNDLE — la venta descuenta stock de los componentes
// ═══════════════════════════════════════════════════════════════════════════════
describe('saleService.create — producto BUNDLE', () => {
  beforeEach(() => {
    storeState.products = [
      makeProduct('comp-A', 10),
      makeProduct('comp-B', 8),
      makeProduct('bundle-1', 4, {
        type: 'bundle',
        components: [
          { productId: 'comp-A', quantity: 2, _name: 'Componente A' },
          { productId: 'comp-B', quantity: 1, _name: 'Componente B' },
        ],
      }),
    ]
  })

  it('expande los componentes y descuenta su stock individualmente', async () => {
    await saleService.create({
      invoiceNumber: 'B001-000020',
      items: [{ productId: 'bundle-1', productName: 'Kit TV+Soporte', quantity: 1, unitPrice: 100, subtotal: 100 }],
      total: 100, payments: [{ method: 'efectivo', amount: 100 }],
    })
    // allocateStock se llama para cada componente expandido
    const { allocateStock } = await import('../../shared/utils/inventoryEngine')
    expect(allocateStock).toHaveBeenCalled()
    const calls = allocateStock.mock.calls.map(c => c[0].product.id)
    expect(calls).toContain('comp-A')
    expect(calls).toContain('comp-B')
  })

  it('la venta se registra como completada', async () => {
    const r = await saleService.create({
      invoiceNumber: 'B001-000021',
      items: [{ productId: 'bundle-1', productName: 'Kit', quantity: 1, unitPrice: 100, subtotal: 100 }],
      total: 100, payments: [{ method: 'efectivo', amount: 100 }],
    })
    expect(r.data.status).toBe('completada')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Crédito — registra deuda en el cliente
// ═══════════════════════════════════════════════════════════════════════════════
describe('saleService.create — pago a crédito', () => {
  beforeEach(() => {
    storeState.products = [makeProduct('prd-001', 20)]
    storeState.clients  = [makeClient('cli-1', { currentDebt: 50, creditLimit: 500 })]
  })

  it('suma la deuda al saldo actual del cliente', async () => {
    await saleService.create({
      invoiceNumber: 'B001-000030',
      clientId: 'cli-1',
      items: [{ productId: 'prd-001', productName: 'Arroz', quantity: 1, unitPrice: 30, subtotal: 30 }],
      total: 30,
      payments: [{ method: 'credito', amount: 30 }],
    })
    expect(storeState.updateClient).toHaveBeenCalledWith('cli-1', expect.objectContaining({
      currentDebt: 80,  // 50 existente + 30 de crédito
    }))
  })

  it('pago mixto efectivo+crédito → solo suma el monto a crédito', async () => {
    await saleService.create({
      invoiceNumber: 'B001-000031',
      clientId: 'cli-1',
      items: [{ productId: 'prd-001', productName: 'Arroz', quantity: 1, unitPrice: 100, subtotal: 100 }],
      total: 100,
      payments: [{ method: 'efectivo', amount: 60 }, { method: 'credito', amount: 40 }],
    })
    expect(storeState.updateClient).toHaveBeenCalledWith('cli-1', expect.objectContaining({
      currentDebt: 90,  // 50 + 40 crédito
    }))
  })

  it('sin clientId → no intenta actualizar deuda', async () => {
    storeState.products = [makeProduct('prd-001', 20)]
    await saleService.create({
      invoiceNumber: 'B001-000032',
      items: [{ productId: 'prd-001', productName: 'Arroz', quantity: 1, unitPrice: 30, subtotal: 30 }],
      total: 30,
      payments: [{ method: 'credito', amount: 30 }],
    })
    // updateClient solo puede ser llamado para puntos de lealtad, no por deuda
    const debtCall = storeState.updateClient.mock.calls.find(c => 'currentDebt' in (c[1] || {}))
    expect(debtCall).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Puntos de lealtad — acumulación al comprar
// ═══════════════════════════════════════════════════════════════════════════════
describe('saleService.create — programa de puntos', () => {
  beforeEach(() => {
    storeState.products = [makeProduct('prd-001', 50, { priceSell: 10 })]
    storeState.clients  = [makeClient('cli-1', {
      loyaltyPoints: 100, loyaltyAccumulated: 500,
      loyaltyLevel: 'Bronce', loyaltyTransactions: [],
    })]
  })

  it('acumula puntos al cliente tras la venta', async () => {
    await saleService.create({
      invoiceNumber: 'B001-000040',
      clientId: 'cli-1',
      items: [{ productId: 'prd-001', productName: 'Arroz', quantity: 5, unitPrice: 10, subtotal: 50 }],
      total: 50, payments: [{ method: 'efectivo', amount: 50 }],
    })
    // Debe llamar updateClient con loyaltyPoints actualizado
    const loyaltyCall = storeState.updateClient.mock.calls.find(c => 'loyaltyPoints' in (c[1] || {}))
    expect(loyaltyCall).toBeDefined()
    expect(loyaltyCall[1].loyaltyPoints).toBeGreaterThanOrEqual(100)
  })

  it('redime puntos y reduce el saldo del cliente', async () => {
    storeState.clients = [makeClient('cli-1', { loyaltyPoints: 200, loyaltyAccumulated: 1000 })]
    await saleService.create({
      invoiceNumber: 'B001-000041',
      clientId:       'cli-1',
      redeemedPoints: 50,
      loyaltyDiscount: 5,
      items: [{ productId: 'prd-001', productName: 'Arroz', quantity: 1, unitPrice: 10, subtotal: 10 }],
      total: 5, payments: [{ method: 'efectivo', amount: 5 }],
    })
    const loyaltyCall = storeState.updateClient.mock.calls.find(c => 'loyaltyPoints' in (c[1] || {}))
    expect(loyaltyCall).toBeDefined()
    // 200 puntos - 50 redimidos = 150 (antes de acumular nuevos)
    expect(loyaltyCall[1].loyaltyPoints).toBeLessThan(200)
  })

  it('sin clientId → no toca puntos de lealtad', async () => {
    await saleService.create({
      invoiceNumber: 'B001-000042',
      items: [{ productId: 'prd-001', productName: 'Arroz', quantity: 1, unitPrice: 10, subtotal: 10 }],
      total: 10, payments: [{ method: 'efectivo', amount: 10 }],
    })
    const loyaltyCall = storeState.updateClient.mock.calls.find(c => 'loyaltyPoints' in (c[1] || {}))
    expect(loyaltyCall).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// cancel — anulación de venta
// ═══════════════════════════════════════════════════════════════════════════════
describe('saleService.cancel', () => {
  beforeEach(() => {
    storeState.products = [makeProduct('prd-001', 10)]
  })

  it('cambia el estado de la venta a cancelada', async () => {
    storeState.sales = [{
      id: 'sale-1', status: 'completada', invoiceNumber: 'B001-001',
      items: [{ productId: 'prd-001', quantity: 2, unitPrice: 10, batchAllocations: [], stockControlUsed: 'simple' }],
      payments: [], tipoComprobante: 'ticket', total: 20, createdAt: new Date().toISOString(),
    }]
    const r = await saleService.cancel('sale-1', 'Error de caja', 'usr-1')
    expect(r.data.status).toBe('cancelada')
    expect(storeState.updateSale).toHaveBeenCalledWith('sale-1', expect.objectContaining({ status: 'cancelada' }))
  })

  it('restaura el stock del producto al cancelar', async () => {
    storeState.sales = [{
      id: 'sale-2', status: 'completada', invoiceNumber: 'B001-002',
      items: [{ productId: 'prd-001', quantity: 3, unitPrice: 10, batchAllocations: [], stockControlUsed: 'simple' }],
      payments: [], tipoComprobante: 'ticket', total: 30, createdAt: new Date().toISOString(),
    }]
    await saleService.cancel('sale-2', 'Devolución', 'usr-1')
    expect(storeState.updateProduct).toHaveBeenCalledWith('prd-001', expect.objectContaining({
      stock: 13,  // 10 + 3 devueltos
    }))
  })

  it('restaura serial al cancelar venta de tipo SERIE', async () => {
    storeState.sales = [{
      id: 'sale-3', status: 'completada', invoiceNumber: 'B001-003',
      items: [{
        productId: 'prd-001', quantity: 1, unitPrice: 500,
        batchAllocations: [{ batchNumber: 'SN-SOLD-001', quantity: 1 }],
        stockControlUsed: 'serie',
      }],
      payments: [], tipoComprobante: 'ticket', total: 500, createdAt: new Date().toISOString(),
    }]
    await saleService.cancel('sale-3', 'Cliente arrepentido', 'usr-1')
    expect(serialService.markAvailable).toHaveBeenCalledWith('prd-001', 'SN-SOLD-001')
  })

  it('venta no encontrada → error', async () => {
    storeState.sales = []
    const r = await saleService.cancel('no-existe', 'motivo', 'usr-1')
    expect(r.error).toBeDefined()
    expect(r.data).toBeNull()
  })

  it('venta ya cancelada → error (no doble cancelación)', async () => {
    storeState.sales = [{
      id: 'sale-4', status: 'cancelada',
      items: [], payments: [], total: 0, createdAt: new Date().toISOString(),
    }]
    const r = await saleService.cancel('sale-4', 'motivo', 'usr-1')
    expect(r.error).toBeDefined()
  })
})
