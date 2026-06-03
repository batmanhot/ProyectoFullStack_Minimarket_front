/**
 * Tests: discountEngine.js
 *
 * Cubre los 4 tipos de campaña, jerarquía N1→N2→N3,
 * aritmética HALF_UP y vigencia de campañas.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  isCampaignActive,
  evaluateDiscounts,
  checkActivationCondition,
} from '../../shared/utils/discountEngine'

// ─── Fixtures base ────────────────────────────────────────────────────────────
// Usa fecha LOCAL para que coincida con como isCampaignActive parsea las fechas
// (sin sufijo Z → hora local). toISOString() devuelve UTC, lo que causa falsos
// negativos cuando UTC y hora local difieren de día (ej: UTC-5 después de 19:00).
const localDate = (d) => {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
const today = () => localDate(new Date())
const dayOffset = (days) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return localDate(d)
}

const PRODUCTS = [
  { id: 'prd-001', categoryId: 'cat-001', brand: 'Costeño', priceSell: 19.90, isActive: true },
  { id: 'prd-002', categoryId: 'cat-001', brand: 'Primor',  priceSell: 9.50,  isActive: true },
  { id: 'prd-011', categoryId: 'cat-002', brand: 'InkaKola', priceSell: 2.50, isActive: true },
  { id: 'prd-021', categoryId: 'cat-003', brand: 'Gloria',  priceSell: 5.20,  isActive: true },
]

const makeCampaign = (overrides = {}) => ({
  id: 'camp-1',
  name: 'Test Campaign',
  type: 'campaign',
  scope: 'all',
  isActive: true,
  discountPct: 10,
  dateFrom: null,
  dateTo: null,
  daysOfWeek: [],
  ...overrides,
})

const makeCart = (items) =>
  items.map(({ productId, quantity, unitPrice }) => ({
    _key: productId,
    productId,
    quantity,
    unitPrice,
  }))

// ═══════════════════════════════════════════════════════════════════════════════
// isCampaignActive
// ═══════════════════════════════════════════════════════════════════════════════
describe('isCampaignActive', () => {
  it('retorna false si isActive=false', () => {
    expect(isCampaignActive(makeCampaign({ isActive: false }))).toBe(false)
  })

  it('retorna false si campaign es null/undefined', () => {
    expect(isCampaignActive(null)).toBe(false)
    expect(isCampaignActive(undefined)).toBe(false)
  })

  it('retorna true si isActive=true y sin fechas ni días', () => {
    expect(isCampaignActive(makeCampaign())).toBe(true)
  })

  it('retorna true si la fecha actual está dentro del rango', () => {
    const camp = makeCampaign({ dateFrom: dayOffset(-5), dateTo: dayOffset(5) })
    expect(isCampaignActive(camp)).toBe(true)
  })

  it('retorna false si la fecha actual es anterior a dateFrom', () => {
    const camp = makeCampaign({ dateFrom: dayOffset(1), dateTo: dayOffset(10) })
    expect(isCampaignActive(camp)).toBe(false)
  })

  it('retorna false si la fecha actual es posterior a dateTo', () => {
    const camp = makeCampaign({ dateFrom: dayOffset(-10), dateTo: dayOffset(-1) })
    expect(isCampaignActive(camp)).toBe(false)
  })

  it('retorna false si hoy no está en daysOfWeek', () => {
    // Busca un día de semana que NO sea hoy
    const todayDow = new Date().getDay()
    const otherDay = (todayDow + 1) % 7
    const camp = makeCampaign({ daysOfWeek: [otherDay] })
    expect(isCampaignActive(camp)).toBe(false)
  })

  it('retorna true si hoy está en daysOfWeek', () => {
    const todayDow = new Date().getDay()
    const camp = makeCampaign({ daysOfWeek: [todayDow] })
    expect(isCampaignActive(camp)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// evaluateDiscounts — carrito vacío y sin campañas
// ═══════════════════════════════════════════════════════════════════════════════
describe('evaluateDiscounts — carrito vacío / sin campañas', () => {
  it('carrito vacío → totalCampaignSaving=0', () => {
    const result = evaluateDiscounts([], PRODUCTS, [makeCampaign()])
    expect(result.totalCampaignSaving).toBe(0)
    expect(result.itemDiscounts).toHaveLength(0)
  })

  it('sin campañas activas → engineStatus no_active_campaigns', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 1, unitPrice: 19.90 }])
    const result = evaluateDiscounts(cart, PRODUCTS, [])
    expect(result.engineStatus).toBe('no_active_campaigns')
    expect(result.totalCampaignSaving).toBe(0)
  })

  it('campaña inactiva → no aplica descuento', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 2, unitPrice: 19.90 }])
    const camp = makeCampaign({ isActive: false })
    const result = evaluateDiscounts(cart, PRODUCTS, [camp])
    expect(result.totalCampaignSaving).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Tipo: campaign — % en cada unidad
// ═══════════════════════════════════════════════════════════════════════════════
describe('evaluateDiscounts — tipo campaign (% por unidad)', () => {
  it('10% en 1 unidad de S/19.90 → ahorro S/1.99', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 1, unitPrice: 19.90 }])
    const camp = makeCampaign({ discountPct: 10, scope: 'all' })
    const result = evaluateDiscounts(cart, PRODUCTS, [camp])

    expect(result.totalCampaignSaving).toBe(1.99)
    expect(result.engineStatus).toBe('active')
  })

  it('10% en 3 unidades de S/19.90 → ahorro S/5.97', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 3, unitPrice: 19.90 }])
    const camp = makeCampaign({ discountPct: 10, scope: 'all' })
    const result = evaluateDiscounts(cart, PRODUCTS, [camp])

    expect(result.totalCampaignSaving).toBe(5.97)
  })

  it('scope=products aplica solo al producto de la lista', () => {
    const cart = makeCart([
      { productId: 'prd-001', quantity: 1, unitPrice: 19.90 },
      { productId: 'prd-011', quantity: 1, unitPrice: 2.50 },
    ])
    const camp = makeCampaign({ scope: 'products', productIds: ['prd-001'], discountPct: 10 })
    const result = evaluateDiscounts(cart, PRODUCTS, [camp])

    const item001 = result.itemDiscounts.find(i => i.productId === 'prd-001')
    const item011 = result.itemDiscounts.find(i => i.productId === 'prd-011')
    expect(item001.campaignDiscount).toBe(1.99)
    expect(item011.campaignDiscount).toBe(0)
  })

  it('scope=categories aplica solo a productos de esa categoría (N2)', () => {
    const cart = makeCart([
      { productId: 'prd-001', quantity: 1, unitPrice: 19.90 }, // cat-001
      { productId: 'prd-011', quantity: 1, unitPrice: 2.50 },  // cat-002
    ])
    // Campaña N2: categoría cat-001
    const camp = makeCampaign({ scope: 'categories', categoryIds: ['cat-001'], discountPct: 20 })
    const result = evaluateDiscounts(cart, PRODUCTS, [camp])

    const item001 = result.itemDiscounts.find(i => i.productId === 'prd-001')
    const item011 = result.itemDiscounts.find(i => i.productId === 'prd-011')
    expect(item001.campaignDiscount).toBeGreaterThan(0)
    expect(item011.campaignDiscount).toBe(0)
  })

  it('el descuento mayor gana entre dos campañas del mismo nivel', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 1, unitPrice: 19.90 }])
    const campA = makeCampaign({ id: 'camp-a', discountPct: 10, scope: 'all' })
    const campB = makeCampaign({ id: 'camp-b', discountPct: 20, scope: 'all' })
    const result = evaluateDiscounts(cart, PRODUCTS, [campA, campB])

    // 20% de 19.90 = 3.98
    expect(result.totalCampaignSaving).toBe(3.98)
  })

  it('items reciben discountBlocked=true cuando hay descuento automático', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 1, unitPrice: 19.90 }])
    const camp = makeCampaign({ discountPct: 10 })
    const result = evaluateDiscounts(cart, PRODUCTS, [camp])

    const item = result.itemDiscounts[0]
    expect(item.discountBlocked).toBe(true)
  })

  it('netTotal del ítem es correcto después del descuento', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 2, unitPrice: 19.90 }])
    const camp = makeCampaign({ discountPct: 10 })
    const result = evaluateDiscounts(cart, PRODUCTS, [camp])

    const item = result.itemDiscounts[0]
    // Subtotal bruto: 39.80 — descuento: 3.98 → netTotal: 35.82
    expect(item.netTotal).toBe(35.82)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Tipo: promotion — NxM (2×1, 3×2)
// ═══════════════════════════════════════════════════════════════════════════════
describe('evaluateDiscounts — tipo promotion (NxM)', () => {
  const makePromo = (overrides = {}) => makeCampaign({
    type: 'promotion',
    scope: 'products',
    productIds: ['prd-001'],
    buyQty: 2,
    payQty: 1,
    discountPct: undefined,
    ...overrides,
  })

  it('2×1 con 2 unidades → descuento igual al precio de 1 unidad', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 2, unitPrice: 19.90 }])
    const result = evaluateDiscounts(cart, PRODUCTS, [makePromo()])
    // 1 unidad gratis = S/19.90
    expect(result.totalCampaignSaving).toBe(19.90)
  })

  it('2×1 con 1 unidad → no aplica (no completa ciclo)', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 1, unitPrice: 19.90 }])
    const result = evaluateDiscounts(cart, PRODUCTS, [makePromo()])
    expect(result.totalCampaignSaving).toBe(0)
  })

  it('2×1 con 4 unidades → 2 ciclos → 2 unidades gratis', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 4, unitPrice: 10.00 }])
    const result = evaluateDiscounts(cart, PRODUCTS, [makePromo()])
    expect(result.totalCampaignSaving).toBe(20.00)
  })

  it('2×1 con 3 unidades → 1 ciclo completo + 1 residuo', () => {
    // 3 uds → 1 ciclo (2 uds), 1 residuo → 1 unidad gratis
    const cart = makeCart([{ productId: 'prd-001', quantity: 3, unitPrice: 10.00 }])
    const result = evaluateDiscounts(cart, PRODUCTS, [makePromo()])
    expect(result.totalCampaignSaving).toBe(10.00)
  })

  it('3×2 con 6 unidades → 2 ciclos → 2 unidades gratis', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 6, unitPrice: 10.00 }])
    const promo = makePromo({ buyQty: 3, payQty: 2 })
    const result = evaluateDiscounts(cart, PRODUCTS, [promo])
    expect(result.totalCampaignSaving).toBe(20.00)
  })

  it('NxM no aplica con scope=all', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 2, unitPrice: 19.90 }])
    const promo = makePromo({ scope: 'all' })
    const result = evaluateDiscounts(cart, PRODUCTS, [promo])
    // scope=all es inválido para promotion → no aplica
    expect(result.totalCampaignSaving).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Tipo: line — Compra X → descuento en la unidad N
// ═══════════════════════════════════════════════════════════════════════════════
describe('evaluateDiscounts — tipo line (compra X → desc. en u.N)', () => {
  const makeLine = (overrides = {}) => makeCampaign({
    type: 'line',
    scope: 'products',
    productIds: ['prd-001'],
    minQty: 3,
    discountOnNth: 3,
    discountPct: 50,
    ...overrides,
  })

  it('compra 3, desc 50% en u.3 → ahorro 50% del precio de 1 unidad', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 3, unitPrice: 10.00 }])
    const result = evaluateDiscounts(cart, PRODUCTS, [makeLine()])
    expect(result.totalCampaignSaving).toBe(5.00)
  })

  it('compra 2 con minQty=3 → no alcanza el mínimo → sin descuento', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 2, unitPrice: 10.00 }])
    const result = evaluateDiscounts(cart, PRODUCTS, [makeLine()])
    expect(result.totalCampaignSaving).toBe(0)
  })

  it('compra 6 con discountOnNth=3 → 2 aplicaciones', () => {
    // Posiciones 3 y 6 reciben descuento
    const cart = makeCart([{ productId: 'prd-001', quantity: 6, unitPrice: 10.00 }])
    const result = evaluateDiscounts(cart, PRODUCTS, [makeLine()])
    expect(result.totalCampaignSaving).toBe(10.00) // 5.00 × 2 aplicaciones
  })

  it('scope=all → maxVeces=Infinity (sin límite de aplicaciones)', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 9, unitPrice: 10.00 }])
    const camp = makeLine({ scope: 'all', maxVeces: 1 })
    const result = evaluateDiscounts(cart, PRODUCTS, [camp])
    // scope=all ignora maxVeces → 3 aplicaciones (u.3, u.6, u.9)
    expect(result.totalCampaignSaving).toBe(15.00)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Tipo: volume — descuento global por subtotal
// ═══════════════════════════════════════════════════════════════════════════════
describe('evaluateDiscounts — tipo volume (descuento global)', () => {
  const makeVolume = (overrides = {}) => makeCampaign({
    type: 'volume',
    scope: 'all',
    discountPct: 10,
    minAmount: 100,
    ...overrides,
  })

  it('subtotal < minAmount → no aplica descuento global', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 1, unitPrice: 19.90 }])
    const result = evaluateDiscounts(cart, PRODUCTS, [makeVolume()])
    expect(result.totalCampaignSaving).toBe(0)
  })

  it('subtotal >= minAmount → aplica % sobre el subtotal neto', () => {
    // 6 × 19.90 = 119.40 > 100 → 10% = 11.94
    const cart = makeCart([{ productId: 'prd-001', quantity: 6, unitPrice: 19.90 }])
    const result = evaluateDiscounts(cart, PRODUCTS, [makeVolume()])
    expect(result.totalCampaignSaving).toBe(11.94)
  })

  it('ítem con descuento N1 queda excluido del descuento volume (N3)', () => {
    const cart = makeCart([
      { productId: 'prd-001', quantity: 6, unitPrice: 19.90 }, // recibe N1
      { productId: 'prd-011', quantity: 5, unitPrice: 2.50 },  // va a N3
    ])
    const campN1 = makeCampaign({
      id: 'camp-n1', type: 'campaign', scope: 'products',
      productIds: ['prd-001'], discountPct: 10,
    })
    const campN3 = makeVolume({ id: 'camp-n3', minAmount: 10 })
    const result = evaluateDiscounts(cart, PRODUCTS, [campN1, campN3])

    const item001 = result.itemDiscounts.find(i => i.productId === 'prd-001')
    const item011 = result.itemDiscounts.find(i => i.productId === 'prd-011')

    // prd-001 recibió N1 → no debe recibir N3 adicional
    expect(item001.discountLevel).toBe(1)
    // prd-011 sin N1 → recibe N3
    expect(item011.discountLevel).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Jerarquía N1 → N2 → N3
// ═══════════════════════════════════════════════════════════════════════════════
describe('evaluateDiscounts — jerarquía estricta N1 > N2 > N3', () => {
  it('ítem con descuento N1 NO recibe N2 (exclusión top-down)', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 1, unitPrice: 19.90 }])
    const campN1 = makeCampaign({
      id: 'camp-n1', scope: 'products', productIds: ['prd-001'], discountPct: 10,
    })
    const campN2 = makeCampaign({
      id: 'camp-n2', scope: 'categories', categoryIds: ['cat-001'], discountPct: 30,
    })
    const result = evaluateDiscounts(cart, PRODUCTS, [campN1, campN2])

    const item = result.itemDiscounts[0]
    expect(item.discountLevel).toBe(1)
    // Sólo aplica 10% (N1), no el 30% (N2)
    expect(item.campaignDiscount).toBe(1.99)
  })

  it('summary.byItem y summary.byGlobal se calculan por separado', () => {
    const cart = makeCart([
      { productId: 'prd-001', quantity: 1, unitPrice: 10.00 }, // N1
      { productId: 'prd-011', quantity: 10, unitPrice: 5.00 }, // N3
    ])
    const campN1 = makeCampaign({ id: 'n1', scope: 'products', productIds: ['prd-001'], discountPct: 10 })
    const campN3 = makeCampaign({ id: 'n3', type: 'volume', scope: 'all', discountPct: 5, minAmount: 50 })
    const result = evaluateDiscounts(cart, PRODUCTS, [campN1, campN3])

    expect(result.summary.byItem).toBeGreaterThan(0)
    expect(result.summary.byGlobal).toBeGreaterThanOrEqual(0)
    expect(result.summary.total).toBe(
      parseFloat((result.summary.byItem + result.summary.byGlobal).toFixed(2))
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// checkActivationCondition
// ═══════════════════════════════════════════════════════════════════════════════
describe('checkActivationCondition', () => {
  it('campaña inactiva → active: false', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 5, unitPrice: 10 }])
    const camp = makeCampaign({ isActive: false, type: 'promotion', buyQty: 2, scope: 'all' })
    const r = checkActivationCondition(cart, PRODUCTS, camp)
    expect(r.active).toBe(false)
  })

  it('promotion: unidades suficientes → active: true', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 3, unitPrice: 10 }])
    const camp = makeCampaign({ type: 'promotion', buyQty: 2, scope: 'all' })
    const r = checkActivationCondition(cart, PRODUCTS, camp)
    expect(r.active).toBe(true)
  })

  it('promotion: unidades insuficientes → active: false con reason', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 1, unitPrice: 10 }])
    const camp = makeCampaign({ type: 'promotion', buyQty: 2, scope: 'all' })
    const r = checkActivationCondition(cart, PRODUCTS, camp)
    expect(r.active).toBe(false)
    expect(r.reason).toContain('2')
  })

  it('line: cantidad suficiente → active: true', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 5, unitPrice: 10 }])
    const camp = makeCampaign({ type: 'line', minQty: 3, scope: 'all' })
    const r = checkActivationCondition(cart, PRODUCTS, camp)
    expect(r.active).toBe(true)
  })

  it('volume: subtotal suficiente → active: true', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 11, unitPrice: 10 }])
    const camp = makeCampaign({ type: 'volume', minAmount: 100, scope: 'all' })
    const r = checkActivationCondition(cart, PRODUCTS, camp)
    expect(r.active).toBe(true)
  })

  it('volume: subtotal insuficiente → active: false con reason', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 2, unitPrice: 10 }])
    const camp = makeCampaign({ type: 'volume', minAmount: 100, scope: 'all' })
    const r = checkActivationCondition(cart, PRODUCTS, camp)
    expect(r.active).toBe(false)
    expect(r.reason).toContain('100')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Aritmética HALF_UP
// ═══════════════════════════════════════════════════════════════════════════════
describe('aritmética HALF_UP — redondeo contable', () => {
  it('10% de S/19.95 → S/2.00 (no S/1.99 por float)', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 1, unitPrice: 19.95 }])
    const camp = makeCampaign({ discountPct: 10 })
    const result = evaluateDiscounts(cart, PRODUCTS, [camp])
    // 10% de 19.95 = 1.995 → HALF_UP → 2.00
    expect(result.totalCampaignSaving).toBe(2.00)
  })

  it('acumulación de descuentos no produce error de punto flotante', () => {
    const cart = makeCart([{ productId: 'prd-001', quantity: 10, unitPrice: 0.10 }])
    const camp = makeCampaign({ discountPct: 10 })
    const result = evaluateDiscounts(cart, PRODUCTS, [camp])
    // 10 × 0.10 × 10% = 0.10 (sin error float 0.10000000000000001)
    expect(result.totalCampaignSaving).toBe(0.10)
  })
})
