/**
 * Tests de integración: saleService (modo demo, USE_API=false)
 * Cubre getAll (filtros), create (stock, venta) y cancel (validaciones).
 * El store se controla con un objeto mutable para aislar cada test.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ─── Estado mutable compartido entre gs() y useStore.getState() ───────────────
let storeState = {}

vi.mock('../../store/index', () => ({
  useStore: { getState: () => storeState },
}))

vi.mock('../../services/_base', () => ({
  USE_API:  false,
  ok:    (data, total) => ({ data, meta: { total: total ?? (Array.isArray(data) ? data.length : 1) }, error: null }),
  fail:  (msg)         => ({ data: null, meta: null, error: msg }),
  gs:    ()            => storeState,
  delay: vi.fn().mockResolvedValue(undefined),
  api:   {},
}))

// inventoryEngine mockeado: stock simple sin lotes
vi.mock('../../shared/utils/inventoryEngine', () => ({
  allocateStock: vi.fn(({ product, quantity }) => ({
    error:            null,
    stockUpdate:      { stock: (product.stock ?? 0) - quantity },
    movement:         { type: 'salida', quantity, previousStock: product.stock, newStock: (product.stock ?? 0) - quantity },
    batchAllocations: [],
  })),
  calcStockDisponible: vi.fn((p) => p.stock ?? 0),
}))

import { saleService } from '../../services/saleService'

// ─── Fixture helpers ──────────────────────────────────────────────────────────
const makeProduct = (id = 'prd-001', stock = 50) => ({
  id, name: `Producto ${id}`, priceSell: 10, priceBuy: 7,
  stock, stockMin: 5, stockControl: 'simple', isActive: true, type: 'product',
})

const makeSale = (id, status = 'completada', overrides = {}) => ({
  id, invoiceNumber: `B001-${id}`, total: 100, status,
  items: [{ productId: 'prd-001', quantity: 2, unitPrice: 10, subtotal: 20, discount: 0 }],
  tipoComprobante: 'ticket',
  createdAt: new Date().toISOString(),
  ...overrides,
})

const makePayload = (overrides = {}) => ({
  invoiceNumber:   'B001-000001',
  items: [{ productId: 'prd-001', productName: 'Arroz', quantity: 2, unitPrice: 10, subtotal: 20 }],
  total:           20,
  payments:        [{ method: 'efectivo', amount: 20 }],
  userId:          'user-1',
  tipoComprobante: 'ticket',
  ...overrides,
})

// ─── Reset del store antes de cada test ───────────────────────────────────────
beforeEach(() => {
  storeState = {
    sales:           [],
    products:        [makeProduct()],
    productVariants: [],
    clients:         [],
    returns:         [],
    stockMovements:  [],
    cart:            [],
    systemConfig:    { auditEnabled: false },
    currentUser:     null,
    invoiceCounters: {},
    nextInvoice:     1,

    // Actions stubs
    addSale:         vi.fn((sale) => { storeState.sales = [sale, ...storeState.sales] }),
    updateSale:      vi.fn((id, updates) => {
      storeState.sales = storeState.sales.map(s => s.id === id ? { ...s, ...updates } : s)
    }),
    clearCart:       vi.fn(),
    addReturn:       vi.fn(),
    anularReturn:    vi.fn(),
    addStockMovement:vi.fn(),
    updateProduct:   vi.fn((id, updates) => {
      storeState.products = storeState.products.map(p => p.id === id ? { ...p, ...updates } : p)
    }),
    updateVariant:   vi.fn(),
    updateClient:    vi.fn(),
    getNextInvoice:  vi.fn(() => 'NC001-000001'),
    enqueueOfflineOp: vi.fn(),
    addAuditLog:     vi.fn(),
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// saleService.getAll — filtros en modo demo
// ═══════════════════════════════════════════════════════════════════════════════
describe('saleService.getAll', () => {
  beforeEach(() => {
    storeState.sales = [
      makeSale('s1', 'completada', { createdAt: '2026-06-01T10:00:00Z' }),
      makeSale('s2', 'cancelada',  { createdAt: '2026-06-02T12:00:00Z' }),
      makeSale('s3', 'completada', { createdAt: '2026-06-03T09:00:00Z', clientId: 'cli-1' }),
    ]
  })

  it('sin filtros → retorna todas las ventas ordenadas por fecha desc', async () => {
    const r = await saleService.getAll()
    expect(r.error).toBeNull()
    expect(r.data).toHaveLength(3)
    // Más reciente primero
    expect(r.data[0].id).toBe('s3')
    expect(r.data[2].id).toBe('s1')
  })

  it('filtro status=completada → solo ventas completadas', async () => {
    const r = await saleService.getAll({ status: 'completada' })
    expect(r.data).toHaveLength(2)
    r.data.forEach(s => expect(s.status).toBe('completada'))
  })

  it('filtro status=cancelada → solo ventas canceladas', async () => {
    const r = await saleService.getAll({ status: 'cancelada' })
    expect(r.data).toHaveLength(1)
    expect(r.data[0].id).toBe('s2')
  })

  it('filtro clientId → solo ventas del cliente', async () => {
    const r = await saleService.getAll({ clientId: 'cli-1' })
    expect(r.data).toHaveLength(1)
    expect(r.data[0].id).toBe('s3')
  })

  it('filtro dateFrom → solo ventas a partir de esa fecha', async () => {
    const r = await saleService.getAll({ dateFrom: '2026-06-02' })
    expect(r.data).toHaveLength(2)
  })

  it('carrito de ventas vacío → retorna array vacío sin error', async () => {
    storeState.sales = []
    const r = await saleService.getAll()
    expect(r.error).toBeNull()
    expect(r.data).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// saleService.create — creación de venta en modo demo
// ═══════════════════════════════════════════════════════════════════════════════
describe('saleService.create', () => {
  it('retorna ok con la venta creada', async () => {
    const r = await saleService.create(makePayload())
    expect(r.error).toBeNull()
    expect(r.data).toBeDefined()
    expect(r.data.invoiceNumber).toBe('B001-000001')
  })

  it('venta creada tiene status=completada', async () => {
    const r = await saleService.create(makePayload())
    expect(r.data.status).toBe('completada')
  })

  it('venta creada recibe un id único', async () => {
    const r = await saleService.create(makePayload())
    expect(r.data.id).toBeTruthy()
    expect(typeof r.data.id).toBe('string')
  })

  it('llama addSale con la venta creada', async () => {
    await saleService.create(makePayload())
    expect(storeState.addSale).toHaveBeenCalledOnce()
    const [salePassed] = storeState.addSale.mock.calls[0]
    expect(salePassed.status).toBe('completada')
  })

  it('llama clearCart después de registrar la venta', async () => {
    await saleService.create(makePayload())
    expect(storeState.clearCart).toHaveBeenCalledOnce()
  })

  it('llama updateProduct para descontar el stock', async () => {
    await saleService.create(makePayload())
    expect(storeState.updateProduct).toHaveBeenCalled()
  })

  it('llama addStockMovement para registrar la salida', async () => {
    await saleService.create(makePayload())
    expect(storeState.addStockMovement).toHaveBeenCalled()
  })

  it('payload sin clientId → no toca updateClient (sin fidelización)', async () => {
    await saleService.create(makePayload({ clientId: null }))
    expect(storeState.updateClient).not.toHaveBeenCalled()
  })

  it('el resultado incluye todos los items del payload', async () => {
    const r = await saleService.create(makePayload())
    expect(r.data.items).toHaveLength(1)
    expect(r.data.items[0].productId).toBe('prd-001')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// saleService.cancel — cancelación de venta
// ═══════════════════════════════════════════════════════════════════════════════
describe('saleService.cancel', () => {
  beforeEach(() => {
    storeState.sales = [
      makeSale('s1', 'completada'),
      makeSale('s2', 'cancelada'),
    ]
  })

  it('venta no encontrada → retorna fail', async () => {
    const r = await saleService.cancel('id-inexistente', 'motivo', 'user-1')
    expect(r.error).toBeTruthy()
    expect(r.data).toBeNull()
  })

  it('venta ya cancelada → retorna fail', async () => {
    const r = await saleService.cancel('s2', 're-cancelar', 'user-1')
    expect(r.error).toBeTruthy()
    expect(r.data).toBeNull()
  })

  it('venta completada → retorna ok con status cancelada', async () => {
    const r = await saleService.cancel('s1', 'error de cobro', 'user-1')
    expect(r.error).toBeNull()
    expect(r.data.status).toBe('cancelada')
  })

  it('cancelación llama updateSale con status=cancelada', async () => {
    await saleService.cancel('s1', 'error', 'user-1')
    expect(storeState.updateSale).toHaveBeenCalledWith('s1', expect.objectContaining({
      status: 'cancelada',
    }))
  })

  it('cancelación restaura el stock del producto', async () => {
    storeState.sales[0].items = [
      { productId: 'prd-001', quantity: 2, stockControlUsed: 'simple', batchAllocations: [] }
    ]
    await saleService.cancel('s1', 'motivo', 'user-1')
    expect(storeState.updateProduct).toHaveBeenCalled()
  })

  it('tipo ticket → NO genera nota de crédito al cancelar', async () => {
    // tipoComprobante: 'ticket' no genera NC
    await saleService.cancel('s1', 'motivo', 'user-1')
    expect(storeState.addReturn).not.toHaveBeenCalled()
  })
})
