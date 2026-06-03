/**
 * Tests de integración: returnService (modo demo, USE_API=false)
 * Cubre create (NC + stock), getAll, getById y anular.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

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

import { returnService } from '../../services/returnService'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeNC = (id, saleId = 'sale-1', status = 'completada', overrides = {}) => ({
  id,
  ncNumber:      `NC001-${id}`,
  saleId,
  items:         [{ productId: 'prd-001', productName: 'Arroz', quantity: 1, totalRefund: 10 }],
  totalRefund:   10,
  status,
  createdAt:     new Date().toISOString(),
  ...overrides,
})

const makeNCPayload = (saleId = 'sale-1', overrides = {}) => ({
  ncNumber:    'NC001-000001',
  saleId,
  reason:      'devolucion',
  items:       [{ productId: 'prd-001', productName: 'Arroz', quantity: 2, totalRefund: 20 }],
  totalRefund: 20,
  userId:      'user-1',
  ...overrides,
})

beforeEach(() => {
  storeState = {
    products: [{ id: 'prd-001', name: 'Arroz', stock: 50 }],
    sales:    [
      {
        id: 'sale-1', invoiceNumber: 'B001-000001', status: 'completada', total: 40,
        items: [{ productId: 'prd-001', quantity: 4, unitPrice: 10 }],
      },
    ],
    returns:  [],

    addReturn:       vi.fn(), // stub puro — no actualiza storeState.returns para evitar doble conteo
    anularReturn:    vi.fn((id) => {
      storeState.returns = storeState.returns.map(r => r.id === id ? { ...r, status: 'anulada' } : r)
    }),
    updateProduct:   vi.fn((id, updates) => {
      storeState.products = storeState.products.map(p => p.id === id ? { ...p, ...updates } : p)
    }),
    addStockMovement:vi.fn(),
    updateSale:      vi.fn((id, updates) => {
      storeState.sales = storeState.sales.map(s => s.id === id ? { ...s, ...updates } : s)
    }),
    enqueueOfflineOp: vi.fn(),
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// returnService.create — creación de nota de crédito
// ═══════════════════════════════════════════════════════════════════════════════
describe('returnService.create', () => {
  it('retorna ok con la NC creada', async () => {
    const r = await returnService.create(makeNCPayload())
    expect(r.error).toBeNull()
    expect(r.data).toBeDefined()
    expect(r.data.ncNumber).toBe('NC001-000001')
  })

  it('NC creada tiene status=completada por defecto', async () => {
    const r = await returnService.create(makeNCPayload())
    expect(r.data.status).toBe('completada')
  })

  it('la NC recibe un id si no se proporciona uno', async () => {
    const r = await returnService.create(makeNCPayload())
    expect(r.data.id).toBeTruthy()
  })

  it('llama addReturn con la nota de crédito', async () => {
    await returnService.create(makeNCPayload())
    expect(storeState.addReturn).toHaveBeenCalledOnce()
  })

  it('restaura el stock del producto devuelto', async () => {
    await returnService.create(makeNCPayload('sale-1', { items: [{ productId: 'prd-001', productName: 'Arroz', quantity: 2 }] }))
    expect(storeState.updateProduct).toHaveBeenCalled()
    // Stock debería haber subido de 50 a 52
    const calls = storeState.updateProduct.mock.calls
    const updateCall = calls.find(([id]) => id === 'prd-001')
    expect(updateCall[1].stock).toBe(52)
  })

  it('registra movimiento de entrada en stockMovements', async () => {
    await returnService.create(makeNCPayload())
    expect(storeState.addStockMovement).toHaveBeenCalled()
    const [movement] = storeState.addStockMovement.mock.calls[0]
    expect(movement.type).toBe('entrada')
  })

  it('devolución total → actualiza venta a status=devolucion', async () => {
    // La venta tiene 4 uds. El payload devuelve 4 → devolución total
    const r = await returnService.create(makeNCPayload('sale-1', {
      items: [{ productId: 'prd-001', productName: 'Arroz', quantity: 4, totalRefund: 40 }],
    }))
    expect(r.error).toBeNull()
    expect(storeState.updateSale).toHaveBeenCalledWith('sale-1', { status: 'devolucion' })
  })

  it('devolución parcial → actualiza venta a status=dev-parcial', async () => {
    // La venta tiene 4 uds. El payload devuelve 2 → parcial
    await returnService.create(makeNCPayload('sale-1', {
      items: [{ productId: 'prd-001', productName: 'Arroz', quantity: 2, totalRefund: 20 }],
    }))
    expect(storeState.updateSale).toHaveBeenCalledWith('sale-1', { status: 'dev-parcial' })
  })

  it('sin saleId → no actualiza estado de venta', async () => {
    await returnService.create(makeNCPayload(null, { saleId: null }))
    expect(storeState.updateSale).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// returnService.getAll — listado con filtros
// ═══════════════════════════════════════════════════════════════════════════════
describe('returnService.getAll', () => {
  beforeEach(() => {
    storeState.returns = [
      makeNC('nc1', 'sale-1', 'completada', { createdAt: '2026-06-01T10:00:00Z' }),
      makeNC('nc2', 'sale-2', 'anulada',    { createdAt: '2026-06-02T12:00:00Z' }),
      makeNC('nc3', 'sale-1', 'completada', { createdAt: '2026-06-03T09:00:00Z' }),
    ]
  })

  it('sin filtros → retorna todas las NCs ordenadas por fecha desc', async () => {
    const r = await returnService.getAll()
    expect(r.error).toBeNull()
    expect(r.data).toHaveLength(3)
    expect(r.data[0].id).toBe('nc3')
  })

  it('filtro status=completada → solo NCs completadas', async () => {
    const r = await returnService.getAll({ status: 'completada' })
    expect(r.data).toHaveLength(2)
    r.data.forEach(nc => expect(nc.status).toBe('completada'))
  })

  it('filtro saleId → solo NCs de esa venta', async () => {
    const r = await returnService.getAll({ saleId: 'sale-1' })
    expect(r.data).toHaveLength(2)
    r.data.forEach(nc => expect(nc.saleId).toBe('sale-1'))
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// returnService.getById — búsqueda individual
// ═══════════════════════════════════════════════════════════════════════════════
describe('returnService.getById', () => {
  beforeEach(() => {
    storeState.returns = [makeNC('nc1')]
  })

  it('id existente → retorna la NC', async () => {
    const r = await returnService.getById('nc1')
    expect(r.error).toBeNull()
    expect(r.data.id).toBe('nc1')
  })

  it('id inexistente → retorna fail', async () => {
    const r = await returnService.getById('nc-fantasma')
    expect(r.data).toBeNull()
    expect(r.error).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// returnService.anular — anulación de NC
// ═══════════════════════════════════════════════════════════════════════════════
describe('returnService.anular', () => {
  beforeEach(() => {
    storeState.returns = [
      makeNC('nc1', 'sale-1', 'completada'),
      makeNC('nc2', 'sale-1', 'anulada'),
    ]
  })

  it('NC inexistente → retorna fail', async () => {
    const r = await returnService.anular('nc-fantasma', 'error', 'user-1')
    expect(r.error).toBeTruthy()
    expect(r.data).toBeNull()
  })

  it('NC ya anulada → retorna fail', async () => {
    const r = await returnService.anular('nc2', 'reintentar', 'user-1')
    expect(r.error).toBeTruthy()
    expect(r.data).toBeNull()
  })

  it('NC completada → retorna ok con status=anulada', async () => {
    const r = await returnService.anular('nc1', 'error operativo', 'user-1')
    expect(r.error).toBeNull()
    expect(r.data.status).toBe('anulada')
  })

  it('anulación llama anularReturn con el id correcto', async () => {
    await returnService.anular('nc1', 'motivo', 'user-1')
    expect(storeState.anularReturn).toHaveBeenCalledWith('nc1', 'motivo')
  })

  it('anulación descuenta el stock devuelto (revierte la devolución)', async () => {
    // nc1 tiene 1 unidad del prd-001
    await returnService.anular('nc1', 'error', 'user-1')
    expect(storeState.updateProduct).toHaveBeenCalled()
    // stock bajó de 50 a 49 (la unidad devuelta se quita de nuevo)
    const updateCalls = storeState.updateProduct.mock.calls
    const updateCall = updateCalls.find(([id]) => id === 'prd-001')
    expect(updateCall[1].stock).toBe(49)
  })
})
