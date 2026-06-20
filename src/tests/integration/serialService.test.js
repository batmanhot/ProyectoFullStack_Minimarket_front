/**
 * Tests de integración: serialService (modo localStorage, USE_API=false)
 * Cubre todo el ciclo de vida de un serial:
 *   createBatch → validate → markSold → markAvailable → patchStatus → remove
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ─── Estado mutable del store ─────────────────────────────────────────────────
let storeState = {}

vi.mock('../../store/index', () => ({
  useStore: { getState: () => storeState },
}))

vi.mock('../../services/_base', () => ({
  USE_API: false,
  ok:      (data, total) => ({ ok: true, data, meta: { total: total ?? 1 }, error: null }),
  fail:    (msg)         => ({ ok: false, data: null, meta: null, error: msg }),
  gs:      ()            => storeState,
  delay:   vi.fn().mockResolvedValue(undefined),
  api:     {},
}))

import { serialService } from '../../services/serialService'

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const PRODUCT_ID = 'prod-serie-1'

const makeSerial = (overrides = {}) => ({
  id:            'ser-001',
  productId:     PRODUCT_ID,
  serialNumber:  'SN-TEST-001',
  status:        'disponible',
  saleId:        '',
  invoiceNumber: '',
  soldAt:        null,
  notes:         '',
  createdAt:     '2026-01-01T00:00:00Z',
  updatedAt:     '2026-01-01T00:00:00Z',
  ...overrides,
})

// ─── Reset del store antes de cada test ───────────────────────────────────────
beforeEach(() => {
  storeState = {
    productSerials: [],
    products: [{ id: PRODUCT_ID, name: 'TV Samsung', stock: 0, stockControl: 'serie' }],

    updateProduct:     vi.fn((id, upd) => {
      storeState.products = storeState.products.map(p => p.id === id ? { ...p, ...upd } : p)
    }),
    setProductSerials: vi.fn((list) => { storeState.productSerials = list }),
    addProductSerials: vi.fn((list) => { storeState.productSerials = [...storeState.productSerials, ...list] }),
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// getByProduct
// ═══════════════════════════════════════════════════════════════════════════════
describe('serialService.getByProduct', () => {
  it('producto sin seriales → array vacío', async () => {
    const r = await serialService.getByProduct(PRODUCT_ID)
    expect(r.ok).toBe(true)
    expect(r.data).toHaveLength(0)
  })

  it('retorna solo los seriales del producto solicitado', async () => {
    storeState.productSerials = [
      makeSerial({ id: 'ser-A', productId: PRODUCT_ID,  serialNumber: 'SN-A' }),
      makeSerial({ id: 'ser-B', productId: 'otro-prod', serialNumber: 'SN-B' }),
    ]
    const r = await serialService.getByProduct(PRODUCT_ID)
    expect(r.data).toHaveLength(1)
    expect(r.data[0].serialNumber).toBe('SN-A')
  })

  it('filtro status=disponible → solo seriales disponibles', async () => {
    storeState.productSerials = [
      makeSerial({ id: 'ser-1', serialNumber: 'SN-1', status: 'disponible' }),
      makeSerial({ id: 'ser-2', serialNumber: 'SN-2', status: 'vendido' }),
    ]
    const r = await serialService.getByProduct(PRODUCT_ID, { status: 'disponible' })
    expect(r.data).toHaveLength(1)
    expect(r.data[0].status).toBe('disponible')
  })

  it('filtro status=vendido → solo vendidos', async () => {
    storeState.productSerials = [
      makeSerial({ id: 'ser-1', serialNumber: 'SN-1', status: 'disponible' }),
      makeSerial({ id: 'ser-2', serialNumber: 'SN-2', status: 'vendido' }),
      makeSerial({ id: 'ser-3', serialNumber: 'SN-3', status: 'vendido' }),
    ]
    const r = await serialService.getByProduct(PRODUCT_ID, { status: 'vendido' })
    expect(r.data).toHaveLength(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// createBatch
// ═══════════════════════════════════════════════════════════════════════════════
describe('serialService.createBatch', () => {
  it('crea seriales nuevos y actualiza el stock', async () => {
    const r = await serialService.createBatch(PRODUCT_ID, [
      { serialNumber: 'SN-001', notes: '' },
      { serialNumber: 'SN-002', notes: 'Con caja' },
    ])
    expect(r.ok).toBe(true)
    expect(r.data.created).toBe(2)
    expect(storeState.addProductSerials).toHaveBeenCalled()
    // Stock recalculado: 2 disponibles
    expect(storeState.updateProduct).toHaveBeenCalledWith(PRODUCT_ID, { stock: 2 })
  })

  it('recalcula el stock = cantidad de seriales disponibles', async () => {
    storeState.productSerials = [
      makeSerial({ id: 's1', serialNumber: 'SN-EXIST', status: 'disponible' }),
    ]
    await serialService.createBatch(PRODUCT_ID, [
      { serialNumber: 'SN-NEW', notes: '' },
    ])
    // Después de addProductSerials, stock = 2 disponibles
    expect(storeState.updateProduct).toHaveBeenCalledWith(PRODUCT_ID, { stock: 2 })
  })

  it('rechaza seriales duplicados', async () => {
    storeState.productSerials = [
      makeSerial({ serialNumber: 'SN-EXISTE' }),
    ]
    const r = await serialService.createBatch(PRODUCT_ID, [
      { serialNumber: 'SN-EXISTE', notes: '' },
    ])
    expect(r.ok).toBe(false)
    expect(r.error).toContain('SN-EXISTE')
  })

  it('rechaza si alguno del lote está duplicado (los demás tampoco se crean)', async () => {
    storeState.productSerials = [makeSerial({ serialNumber: 'SN-DUP' })]
    const r = await serialService.createBatch(PRODUCT_ID, [
      { serialNumber: 'SN-NUEVO' },
      { serialNumber: 'SN-DUP' },
    ])
    expect(r.ok).toBe(false)
  })

  it('los seriales creados tienen status=disponible', async () => {
    await serialService.createBatch(PRODUCT_ID, [{ serialNumber: 'SN-X' }])
    const call = storeState.addProductSerials.mock.calls[0][0]
    expect(call[0].status).toBe('disponible')
    expect(call[0].productId).toBe(PRODUCT_ID)
    expect(call[0].serialNumber).toBe('SN-X')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// validate
// ═══════════════════════════════════════════════════════════════════════════════
describe('serialService.validate', () => {
  it('serial disponible → ok con datos del serial y el producto', async () => {
    storeState.productSerials = [makeSerial({ serialNumber: 'SN-DISP', status: 'disponible' })]
    const r = await serialService.validate('SN-DISP')
    expect(r.ok).toBe(true)
    expect(r.data.serialNumber).toBe('SN-DISP')
    expect(r.data.product).toBeDefined()
  })

  it('case-insensitive: SN-disp === SN-DISP', async () => {
    storeState.productSerials = [makeSerial({ serialNumber: 'SN-DISP', status: 'disponible' })]
    const r = await serialService.validate('sn-disp')
    expect(r.ok).toBe(true)
  })

  it('serial no encontrado → error con mensaje claro', async () => {
    const r = await serialService.validate('SN-NO-EXISTE')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('no encontrado')
  })

  it('serial con status=vendido → error con número de comprobante', async () => {
    storeState.productSerials = [
      makeSerial({ serialNumber: 'SN-VEND', status: 'vendido', invoiceNumber: 'B001-000042' }),
    ]
    const r = await serialService.validate('SN-VEND')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('vendido')
  })

  it('serial dado_baja → error', async () => {
    storeState.productSerials = [
      makeSerial({ serialNumber: 'SN-BAJA', status: 'dado_baja' }),
    ]
    const r = await serialService.validate('SN-BAJA')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('baja')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// markSold
// ═══════════════════════════════════════════════════════════════════════════════
describe('serialService.markSold', () => {
  it('cambia status a vendido con saleId e invoiceNumber', async () => {
    storeState.productSerials = [makeSerial({ serialNumber: 'SN-A', status: 'disponible' })]
    await serialService.markSold(PRODUCT_ID, 'SN-A', 'sale-123', 'B001-000007')
    expect(storeState.setProductSerials).toHaveBeenCalled()
    const updated = storeState.setProductSerials.mock.calls[0][0]
    const serial  = updated.find(s => s.serialNumber === 'SN-A')
    expect(serial.status).toBe('vendido')
    expect(serial.saleId).toBe('sale-123')
    expect(serial.invoiceNumber).toBe('B001-000007')
    expect(serial.soldAt).not.toBeNull()
  })

  it('recalcula el stock: stock = disponibles restantes', async () => {
    storeState.productSerials = [
      makeSerial({ id: 's1', serialNumber: 'SN-A', status: 'disponible' }),
      makeSerial({ id: 's2', serialNumber: 'SN-B', status: 'disponible' }),
    ]
    await serialService.markSold(PRODUCT_ID, 'SN-A', 'sale-1', 'B001-1')
    // Solo SN-B queda disponible → stock=1
    expect(storeState.updateProduct).toHaveBeenCalledWith(PRODUCT_ID, { stock: 1 })
  })

  it('no afecta seriales de otros productos', async () => {
    storeState.productSerials = [
      makeSerial({ serialNumber: 'SN-A', productId: PRODUCT_ID,  status: 'disponible' }),
      makeSerial({ serialNumber: 'SN-B', productId: 'otro-prod', status: 'disponible' }),
    ]
    await serialService.markSold(PRODUCT_ID, 'SN-A', 'sale-1', 'B001-1')
    const updated = storeState.setProductSerials.mock.calls[0][0]
    const snB = updated.find(s => s.serialNumber === 'SN-B')
    expect(snB.status).toBe('disponible')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// markAvailable
// ═══════════════════════════════════════════════════════════════════════════════
describe('serialService.markAvailable', () => {
  it('restaura serial vendido a disponible y limpia campos de venta', async () => {
    storeState.productSerials = [
      makeSerial({
        serialNumber: 'SN-SOLD', status: 'vendido',
        saleId: 'sale-99', invoiceNumber: 'B001-000099', soldAt: '2026-01-10T00:00:00Z',
      }),
    ]
    await serialService.markAvailable(PRODUCT_ID, 'SN-SOLD')
    const updated = storeState.setProductSerials.mock.calls[0][0]
    const serial  = updated.find(s => s.serialNumber === 'SN-SOLD')
    expect(serial.status).toBe('disponible')
    expect(serial.saleId).toBe('')
    expect(serial.invoiceNumber).toBe('')
    expect(serial.soldAt).toBeNull()
  })

  it('recalcula el stock tras restaurar', async () => {
    storeState.productSerials = [
      makeSerial({ serialNumber: 'SN-A', status: 'vendido' }),
      makeSerial({ serialNumber: 'SN-B', status: 'disponible' }),
    ]
    await serialService.markAvailable(PRODUCT_ID, 'SN-A')
    // Ahora los dos están disponibles → stock=2
    expect(storeState.updateProduct).toHaveBeenCalledWith(PRODUCT_ID, { stock: 2 })
  })

  it('no modifica seriales de otros productos', async () => {
    storeState.productSerials = [
      makeSerial({ serialNumber: 'SN-A', productId: PRODUCT_ID,  status: 'vendido' }),
      makeSerial({ serialNumber: 'SN-B', productId: 'otro-prod', status: 'vendido' }),
    ]
    await serialService.markAvailable(PRODUCT_ID, 'SN-A')
    const updated = storeState.setProductSerials.mock.calls[0][0]
    const snB = updated.find(s => s.serialNumber === 'SN-B')
    expect(snB.status).toBe('vendido')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// patchStatus
// ═══════════════════════════════════════════════════════════════════════════════
describe('serialService.patchStatus', () => {
  it('cambia el status del serial por id', async () => {
    storeState.productSerials = [makeSerial({ id: 'ser-001', status: 'disponible' })]
    const r = await serialService.patchStatus(PRODUCT_ID, 'ser-001', 'dado_baja')
    expect(r.ok).toBe(true)
    expect(r.data.status).toBe('dado_baja')
    const updated = storeState.setProductSerials.mock.calls[0][0]
    expect(updated[0].status).toBe('dado_baja')
  })

  it('actualiza notes cuando se proporcionan', async () => {
    storeState.productSerials = [makeSerial({ id: 'ser-001', notes: '' })]
    await serialService.patchStatus(PRODUCT_ID, 'ser-001', 'dado_baja', 'Pantalla rota')
    const updated = storeState.setProductSerials.mock.calls[0][0]
    expect(updated[0].notes).toBe('Pantalla rota')
  })

  it('no modifica notes si no se pasan', async () => {
    storeState.productSerials = [makeSerial({ id: 'ser-001', notes: 'Nota original' })]
    await serialService.patchStatus(PRODUCT_ID, 'ser-001', 'dado_baja')
    const updated = storeState.setProductSerials.mock.calls[0][0]
    expect(updated[0].notes).toBe('Nota original')
  })

  it('recalcula el stock', async () => {
    storeState.productSerials = [
      makeSerial({ id: 'ser-001', serialNumber: 'SN-1', status: 'disponible' }),
    ]
    await serialService.patchStatus(PRODUCT_ID, 'ser-001', 'dado_baja')
    expect(storeState.updateProduct).toHaveBeenCalledWith(PRODUCT_ID, { stock: 0 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// remove
// ═══════════════════════════════════════════════════════════════════════════════
describe('serialService.remove', () => {
  it('elimina serial disponible', async () => {
    storeState.productSerials = [makeSerial({ id: 'ser-001', status: 'disponible' })]
    const r = await serialService.remove(PRODUCT_ID, 'ser-001')
    expect(r.ok).toBe(true)
    expect(r.data.deleted).toBe(true)
    const updated = storeState.setProductSerials.mock.calls[0][0]
    expect(updated).toHaveLength(0)
  })

  it('NO elimina serial vendido → error', async () => {
    storeState.productSerials = [makeSerial({ id: 'ser-001', status: 'vendido' })]
    const r = await serialService.remove(PRODUCT_ID, 'ser-001')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('vendido')
    expect(storeState.setProductSerials).not.toHaveBeenCalled()
  })

  it('serial no encontrado → error', async () => {
    const r = await serialService.remove(PRODUCT_ID, 'ser-no-existe')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('no encontrado')
  })

  it('recalcula el stock tras eliminar', async () => {
    storeState.productSerials = [
      makeSerial({ id: 'ser-001', serialNumber: 'SN-A', status: 'disponible' }),
      makeSerial({ id: 'ser-002', serialNumber: 'SN-B', status: 'disponible' }),
    ]
    await serialService.remove(PRODUCT_ID, 'ser-001')
    expect(storeState.updateProduct).toHaveBeenCalledWith(PRODUCT_ID, { stock: 1 })
  })

  it('no afecta otros productos al eliminar', async () => {
    storeState.productSerials = [
      makeSerial({ id: 'ser-001', productId: PRODUCT_ID,  status: 'disponible' }),
      makeSerial({ id: 'ser-002', productId: 'otro-prod', status: 'disponible' }),
    ]
    await serialService.remove(PRODUCT_ID, 'ser-001')
    const updated = storeState.setProductSerials.mock.calls[0][0]
    expect(updated).toHaveLength(1)
    expect(updated[0].productId).toBe('otro-prod')
  })
})
