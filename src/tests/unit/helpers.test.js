/**
 * Tests: helpers.js
 * Cubre utilidades de moneda, fechas, stock, búsqueda y cálculos POS.
 * APP_CONFIG se mockea para aislar los tests del entorno.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../config/app', () => ({
  APP_CONFIG: {
    locale: 'es-PE',
    currency: 'PEN',
    igvRate: 0.18,
  },
}))

import {
  formatNumber,
  formatInvoice,
  calcChange,
  calcBilletes,
  isLowStock,
  isOutOfStock,
  isExpired,
  isNearExpiry,
  daysUntil,
  isToday,
  isThisMonth,
  fuzzySearch,
  getUnitCost,
  stockDaysLeft,
  calcCartTotals,
} from '../../shared/utils/helpers'

// ═══════════════════════════════════════════════════════════════════════════════
// formatNumber
// ═══════════════════════════════════════════════════════════════════════════════
describe('formatNumber', () => {
  it('redondea a 2 decimales por defecto', () => {
    expect(formatNumber(19.9999)).toBe(20.00)
    // 1.005 en float IEEE-754 es 1.00499... → toFixed(2) → 1.00 (comportamiento esperado de la función)
    expect(formatNumber(1.004)).toBe(1.00)
    expect(formatNumber(1.006)).toBe(1.01)
  })

  it('acepta precisión personalizada', () => {
    expect(formatNumber(3.14159, 3)).toBe(3.142)
  })

  it('null/undefined → 0', () => {
    expect(formatNumber(null)).toBe(0)
    expect(formatNumber(undefined)).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// formatInvoice
// ═══════════════════════════════════════════════════════════════════════════════
describe('formatInvoice', () => {
  it('formatea número con prefijo por defecto B001', () => {
    expect(formatInvoice(1)).toBe('B001-000001')
    expect(formatInvoice(42)).toBe('B001-000042')
    expect(formatInvoice(999999)).toBe('B001-999999')
  })

  it('acepta prefijo personalizado', () => {
    expect(formatInvoice(5, 'F001')).toBe('F001-000005')
  })

  it('rellena con ceros hasta 6 dígitos', () => {
    expect(formatInvoice(1).split('-')[1]).toHaveLength(6)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// calcChange — vuelto de caja
// ═══════════════════════════════════════════════════════════════════════════════
describe('calcChange', () => {
  it('vuelto = recibido - total', () => {
    expect(calcChange(19.90, 20.00)).toBe(0.10)
  })

  it('sin vuelto si recibido < total (no negativo)', () => {
    expect(calcChange(20, 15)).toBe(0)
  })

  it('vuelto exacto cuando recibido = total', () => {
    expect(calcChange(50, 50)).toBe(0)
  })

  it('null/undefined → 0', () => {
    expect(calcChange(null, null)).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// calcBilletes — desglose de vuelto en denominaciones peruanas
// ═══════════════════════════════════════════════════════════════════════════════
describe('calcBilletes', () => {
  it('S/0.10 → una moneda de 0.10', () => {
    const result = calcBilletes(0.10)
    expect(result).toContainEqual({ denomination: 0.10, count: 1 })
  })

  it('S/371 → 1 billete de 200 + 1 de 100 + 1 de 50 + 1 de 20 + 1 de 1', () => {
    const result = calcBilletes(371)
    const map = Object.fromEntries(result.map(r => [r.denomination, r.count]))
    expect(map[200]).toBe(1)
    expect(map[100]).toBe(1)
    expect(map[50]).toBe(1)
    expect(map[20]).toBe(1)
    expect(map[1]).toBe(1)
  })

  it('S/0 → array vacío', () => {
    expect(calcBilletes(0)).toHaveLength(0)
  })

  it('la suma de denominaciones × cantidad = monto original', () => {
    const amount = 125.50
    const bills = calcBilletes(amount)
    const total = bills.reduce((a, b) => a + b.denomination * b.count, 0)
    expect(Math.round(total * 100)).toBe(Math.round(amount * 100))
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Stock helpers
// ═══════════════════════════════════════════════════════════════════════════════
describe('isLowStock', () => {
  it('stock > 0 y <= stockMin → true', () => {
    expect(isLowStock({ stock: 3, stockMin: 5 })).toBe(true)
  })

  it('stock = 0 → false (isOutOfStock, no isLowStock)', () => {
    expect(isLowStock({ stock: 0, stockMin: 5 })).toBe(false)
  })

  it('stock > stockMin → false', () => {
    expect(isLowStock({ stock: 10, stockMin: 5 })).toBe(false)
  })

  it('stock = stockMin → true (en el límite)', () => {
    expect(isLowStock({ stock: 5, stockMin: 5 })).toBe(true)
  })
})

describe('isOutOfStock', () => {
  it('stock = 0 → true', () => {
    expect(isOutOfStock({ stock: 0 })).toBe(true)
  })

  it('stock > 0 → false', () => {
    expect(isOutOfStock({ stock: 1 })).toBe(false)
  })
})

describe('isExpired', () => {
  const pastDate   = '2020-01-01'
  const futureDate = '2099-01-01'

  it('fecha de vencimiento en el pasado → true', () => {
    expect(isExpired({ expiryDate: pastDate })).toBe(true)
  })

  it('fecha de vencimiento en el futuro → false', () => {
    expect(isExpired({ expiryDate: futureDate })).toBe(false)
  })

  it('sin expiryDate → falsy (null && ... = null)', () => {
    expect(isExpired({ expiryDate: null })).toBeFalsy()
  })
})

describe('isNearExpiry', () => {
  const dayOffset = (days) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

  it('vence en 5 días → near (dentro de 30)', () => {
    expect(isNearExpiry({ expiryDate: dayOffset(5) }, 30)).toBe(true)
  })

  it('vence en 31 días → false (fuera de ventana de 30)', () => {
    expect(isNearExpiry({ expiryDate: dayOffset(31) }, 30)).toBe(false)
  })

  it('ya vencido → false (daysUntil < 0)', () => {
    expect(isNearExpiry({ expiryDate: dayOffset(-1) }, 30)).toBe(false)
  })

  it('sin expiryDate → false', () => {
    expect(isNearExpiry({ expiryDate: null }, 30)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// daysUntil
// ═══════════════════════════════════════════════════════════════════════════════
describe('daysUntil', () => {
  it('fecha mañana → 1 día', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(daysUntil(tomorrow.toISOString())).toBe(1)
  })

  it('fecha ayer → negativo', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(daysUntil(yesterday.toISOString())).toBeLessThan(0)
  })

  it('null → null', () => {
    expect(daysUntil(null)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// isToday / isThisMonth
// ═══════════════════════════════════════════════════════════════════════════════
describe('isToday', () => {
  it('fecha actual → true', () => {
    expect(isToday(new Date().toISOString())).toBe(true)
  })

  it('fecha de ayer → false', () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    expect(isToday(d.toISOString())).toBe(false)
  })
})

describe('isThisMonth', () => {
  it('fecha de este mes → true', () => {
    expect(isThisMonth(new Date().toISOString())).toBe(true)
  })

  it('fecha del año pasado → false', () => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 1)
    expect(isThisMonth(d.toISOString())).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// fuzzySearch
// ═══════════════════════════════════════════════════════════════════════════════
describe('fuzzySearch', () => {
  const items = [
    { id: 1, name: 'Arroz Costeño 5kg', barcode: '7751010012459', description: 'Arroz premium' },
    { id: 2, name: 'Aceite Primor 1L',  barcode: '7750282010052', description: 'Aceite vegetal' },
    { id: 3, name: 'Azúcar Rubia 1kg',  barcode: '7751151000013', description: 'Azúcar refinada' },
  ]

  it('sin query → retorna todos los items', () => {
    expect(fuzzySearch('', items)).toHaveLength(3)
    expect(fuzzySearch(null, items)).toHaveLength(3)
  })

  it('búsqueda por nombre parcial (case insensitive)', () => {
    const result = fuzzySearch('arroz', items)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
  })

  it('búsqueda por barcode exacto', () => {
    const result = fuzzySearch('7750282010052', items)
    expect(result[0].id).toBe(2)
  })

  it('búsqueda en description', () => {
    const result = fuzzySearch('vegetal', items)
    expect(result[0].id).toBe(2)
  })

  it('query sin coincidencia → array vacío', () => {
    expect(fuzzySearch('xyznoexiste', items)).toHaveLength(0)
  })

  it('búsqueda insensible a mayúsculas/minúsculas', () => {
    expect(fuzzySearch('ACEITE', items)).toHaveLength(1)
    expect(fuzzySearch('aceite', items)).toHaveLength(1)
  })

  it('query con espacios al inicio/fin → busca correctamente', () => {
    const result = fuzzySearch('  arroz  ', items)
    expect(result).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getUnitCost — valorización de inventario PEPS / CPP
// ═══════════════════════════════════════════════════════════════════════════════
describe('getUnitCost', () => {
  const product = { priceBuy: 8.00, costAverage: 8.50 }

  it('PEPS → usa priceBuy', () => {
    expect(getUnitCost(product, 10, 'peps')).toBe(8.00)
  })

  it('CPP → usa costAverage si existe', () => {
    expect(getUnitCost(product, 10, 'cpp')).toBe(8.50)
  })

  it('CPP sin costAverage → usa priceBuy', () => {
    const p = { priceBuy: 8.00, costAverage: 0 }
    expect(getUnitCost(p, 10, 'cpp')).toBe(8.00)
  })

  it('sin priceBuy ni costAverage → fallback 70% del precio de venta', () => {
    const p = { priceBuy: 0, costAverage: 0 }
    expect(getUnitCost(p, 10, 'peps')).toBe(7.00) // 70% de 10
  })

  it('producto null → no lanza error, usa fallback', () => {
    expect(() => getUnitCost(null, 10, 'peps')).not.toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// stockDaysLeft — proyección de días de stock
// ═══════════════════════════════════════════════════════════════════════════════
describe('stockDaysLeft', () => {
  const makeMovements = (productId, qty, daysAgo) =>
    Array.from({ length: qty }, (_, i) => ({
      productId,
      type: 'salida',
      quantity: 1,
      createdAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    }))

  it('sin salidas recientes → null (no se puede proyectar)', () => {
    expect(stockDaysLeft({ id: 'p1', stock: 10 }, [])).toBeNull()
  })

  it('proyecta días correctamente: 14 salidas en 7 días → avgPerDay=2, stock=10 → 5 días', () => {
    const movements = makeMovements('p1', 14, 1) // 14 salidas en los últimos 7 días
    const result = stockDaysLeft({ id: 'p1', stock: 10 }, movements)
    expect(result).toBe(5)
  })

  it('solo cuenta salidas del producto correcto', () => {
    const movements = [
      ...makeMovements('p1', 7, 1),  // producto correcto: 7 salidas en 7 días = 1/día
      ...makeMovements('p2', 70, 1), // otro producto: no cuenta
    ]
    const result = stockDaysLeft({ id: 'p1', stock: 30 }, movements)
    expect(result).toBe(30) // stock=30 / 1/día = 30 días
  })

  it('solo cuenta tipo=salida (no entrada)', () => {
    const movements = [
      { productId: 'p1', type: 'entrada', quantity: 100, createdAt: new Date().toISOString() },
    ]
    expect(stockDaysLeft({ id: 'p1', stock: 10 }, movements)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// calcCartTotals — IGV incluido (precio de venta incluye IGV)
// ═══════════════════════════════════════════════════════════════════════════════
describe('calcCartTotals', () => {
  it('subtotal, base, tax y total correctos con IGV 18%', () => {
    // subtotal=118 (precio con IGV incluido) → baseImpon=100 → tax=18
    const items = [{ subtotal: 118, discount: 0 }]
    const r = calcCartTotals(items, 0.18)
    expect(r.subtotal).toBe(118)
    expect(r.base).toBe(118)
    expect(r.tax).toBe(18)
    expect(r.total).toBe(118)
  })

  it('descuento se resta al base antes de calcular IGV', () => {
    const items = [{ subtotal: 118, discount: 18 }]
    const r = calcCartTotals(items, 0.18)
    expect(r.base).toBe(100)
  })

  it('múltiples items → subtotal es la suma de todos', () => {
    const items = [
      { subtotal: 50, discount: 0 },
      { subtotal: 30, discount: 0 },
    ]
    const r = calcCartTotals(items, 0.18)
    expect(r.subtotal).toBe(80)
  })

  it('carrito vacío → todos los valores en 0', () => {
    const r = calcCartTotals([], 0.18)
    expect(r.subtotal).toBe(0)
    expect(r.total).toBe(0)
    expect(r.tax).toBe(0)
  })
})
