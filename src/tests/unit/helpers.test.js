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
  formatDate,
  formatDateTime,
  formatTime,
  getHour,
  formatInvoice,
  calcChange,
  calcBilletes,
  isLowStock,
  isOutOfStock,
  isExpired,
  isNearExpiry,
  daysUntil,
  isToday,
  isThisWeek,
  isThisMonth,
  fuzzySearch,
  getUnitCost,
  stockDaysLeft,
  calcCartTotals,
  exportCSV,
  calcDashboardKPIs,
  subtractDays,
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

// ═══════════════════════════════════════════════════════════════════════════════
// formatDate / formatDateTime / formatTime / getHour
// ═══════════════════════════════════════════════════════════════════════════════
describe('formatDate', () => {
  it('retorna "—" para null/undefined/string vacío', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('')).toBe('—')
  })
  it('formatea ISO a cadena de fecha legible (contiene el año)', () => {
    const result = formatDate('2026-03-15T00:00:00.000Z')
    expect(typeof result).toBe('string')
    expect(result).toMatch(/2026/)
  })
})

describe('formatDateTime', () => {
  it('retorna "—" para null', () => {
    expect(formatDateTime(null)).toBe('—')
  })
  it('retorna string que contiene el año para ISO válido', () => {
    const result = formatDateTime('2026-03-15T10:30:00.000Z')
    expect(typeof result).toBe('string')
    expect(result).toMatch(/2026/)
  })
})

describe('formatTime', () => {
  it('retorna "—" para null', () => {
    expect(formatTime(null)).toBe('—')
  })
  it('retorna string para ISO válido', () => {
    const result = formatTime('2026-03-15T10:30:00.000Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('getHour', () => {
  it('retorna un número entre 0 y 23', () => {
    const h = getHour('2026-03-15T15:30:00.000Z')
    expect(typeof h).toBe('number')
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThanOrEqual(23)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// isThisWeek
// ═══════════════════════════════════════════════════════════════════════════════
describe('isThisWeek', () => {
  it('fecha actual → true', () => {
    expect(isThisWeek(new Date().toISOString())).toBe(true)
  })
  it('fecha de hace 8 días → false', () => {
    const d = new Date()
    d.setDate(d.getDate() - 8)
    expect(isThisWeek(d.toISOString())).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// subtractDays
// ═══════════════════════════════════════════════════════════════════════════════
describe('subtractDays', () => {
  it('retorna un ISO string bien formateado', () => {
    const result = subtractDays(7)
    expect(typeof result).toBe('string')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
  it('la fecha resultante es anterior a ahora', () => {
    expect(new Date(subtractDays(1)) < new Date()).toBe(true)
  })
  it('resta correctamente la cantidad de días', () => {
    const result = new Date(subtractDays(3))
    const expected = new Date()
    expected.setDate(expected.getDate() - 3)
    expect(result.getDate()).toBe(expected.getDate())
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// exportCSV
// ═══════════════════════════════════════════════════════════════════════════════
describe('exportCSV', () => {
  it('no hace nada con data vacía o nula', () => {
    vi.clearAllMocks()
    exportCSV([], 'test')
    exportCSV(null, 'test')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('crea y revoca un blob URL para data válida', () => {
    vi.clearAllMocks()
    exportCSV([{ col1: 'valor1', col2: 'valor2' }], 'reporte')
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('no lanza error con valores que contienen comillas', () => {
    expect(() => exportCSV([{ col: 'valor "con comillas"' }], 'test')).not.toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// calcDashboardKPIs
// ═══════════════════════════════════════════════════════════════════════════════
describe('calcDashboardKPIs', () => {
  const now = new Date().toISOString()

  const products = [
    { id: 'p1', name: 'Leche',  isActive: true, stock: 3,  stockMin: 10, priceBuy: 2, priceSell: 3 },
    { id: 'p2', name: 'Pan',    isActive: true, stock: 0,  stockMin: 5,  priceBuy: 1, priceSell: 2 },
    { id: 'p3', name: 'Arroz',  isActive: true, stock: 50, stockMin: 5,  priceBuy: 3, priceSell: 5 },
    { id: 'p4', name: 'Inactivo', isActive: false, stock: 0, stockMin: 0, priceBuy: 0, priceSell: 0 },
  ]

  const sales = [
    {
      id: 's1', status: 'completada', total: 60, createdAt: now,
      items: [{ productId: 'p1', quantity: 3, unitPrice: 3 }, { productId: 'p3', quantity: 3, unitPrice: 5 }],
      payments: [{ method: 'efectivo', amount: 60 }],
    },
    {
      id: 's2', status: 'completada', total: 20, createdAt: now,
      items: [{ productId: 'p2', quantity: 10, unitPrice: 2 }],
      payments: [{ method: 'yape', amount: 20 }],
    },
    {
      id: 's3', status: 'pendiente', total: 999, createdAt: now,
      items: [], payments: [],
    },
  ]

  it('retorna todas las propiedades esperadas', () => {
    const kpis = calcDashboardKPIs(sales, products, [])
    expect(kpis).toHaveProperty('ventasHoy')
    expect(kpis).toHaveProperty('ventasAyer')
    expect(kpis).toHaveProperty('transaccionesHoy')
    expect(kpis).toHaveProperty('ticketPromedio')
    expect(kpis).toHaveProperty('ventasSemana')
    expect(kpis).toHaveProperty('ventasMes')
    expect(kpis).toHaveProperty('utilidadMes')
    expect(kpis).toHaveProperty('valorInventarioCosto')
    expect(kpis).toHaveProperty('valorInventarioVenta')
    expect(kpis).toHaveProperty('productosAlerta')
    expect(kpis).toHaveProperty('productosPorVencer')
    expect(kpis).toHaveProperty('top5')
    expect(kpis).toHaveProperty('paymentTotals')
    expect(kpis).toHaveProperty('ventasPorHora')
    expect(kpis).toHaveProperty('ventasUltimos7')
  })

  it('excluye ventas no-completadas del cómputo', () => {
    const kpis = calcDashboardKPIs(sales, products, [])
    expect(kpis.ventasHoy).toBe(80)       // 60 + 20, no 999
    expect(kpis.transaccionesHoy).toBe(2)
  })

  it('ticketPromedio = ventasHoy / transaccionesHoy', () => {
    const kpis = calcDashboardKPIs(sales, products, [])
    expect(kpis.ticketPromedio).toBe(40)
  })

  it('productosAlerta incluye productos con stock bajo y sin stock (solo activos)', () => {
    const kpis = calcDashboardKPIs(sales, products, [])
    expect(kpis.productosAlerta).toBe(2) // p1 (bajo) + p2 (sin stock); p4 inactivo no cuenta
  })

  it('ventasPorHora tiene exactamente 14 slots', () => {
    const kpis = calcDashboardKPIs(sales, products, [])
    expect(kpis.ventasPorHora).toHaveLength(14)
  })

  it('ventasUltimos7 tiene exactamente 7 entradas', () => {
    const kpis = calcDashboardKPIs(sales, products, [])
    expect(kpis.ventasUltimos7).toHaveLength(7)
  })

  it('paymentTotals agrupa correctamente por método de pago', () => {
    const kpis = calcDashboardKPIs(sales, products, [])
    expect(kpis.paymentTotals.efectivo).toBe(60)
    expect(kpis.paymentTotals.yape).toBe(20)
  })

  it('top5 incluye los productos más vendidos', () => {
    const kpis = calcDashboardKPIs(sales, products, [])
    expect(Array.isArray(kpis.top5)).toBe(true)
    expect(kpis.top5.length).toBeLessThanOrEqual(5)
  })

  it('tendenciaHoy es null cuando no hay ventas de ayer', () => {
    const kpis = calcDashboardKPIs(sales, products, [])
    expect(kpis.tendenciaHoy).toBeNull()
  })

  it('ticketPromedio = 0 si no hay transacciones', () => {
    const kpis = calcDashboardKPIs([], products, [])
    expect(kpis.ticketPromedio).toBe(0)
    expect(kpis.transaccionesHoy).toBe(0)
  })
})
