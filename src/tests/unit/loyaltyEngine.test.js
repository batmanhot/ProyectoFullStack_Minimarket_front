/**
 * Tests: LoyaltyEngine.js
 * Cubre políticas P1–P5: acumulación, niveles, multiplicadores,
 * canje, vencimiento y construcción de transacciones.
 */
import { describe, it, expect } from 'vitest'
import {
  getClientLevel,
  getNextLevel,
  calcPointsEarned,
  calcRedemptionValue,
  getActivePoints,
  buildLoyaltySummary,
  buildEarnTransaction,
  buildRedeemTransaction,
  buildVoidTransaction,
  createLoyaltyProfile,
  LOYALTY_LEVELS,
  LOYALTY_CONFIG_DEFAULTS,
} from '../../shared/utils/LoyaltyEngine'

const CFG = LOYALTY_CONFIG_DEFAULTS

// ═══════════════════════════════════════════════════════════════════════════════
// getClientLevel — determinación de nivel por acumulado histórico
// ═══════════════════════════════════════════════════════════════════════════════
describe('getClientLevel', () => {
  it('0 pts → Bronce', () => {
    expect(getClientLevel(0).name).toBe('Bronce')
  })

  it('499 pts → Bronce (límite superior)', () => {
    expect(getClientLevel(499).name).toBe('Bronce')
  })

  it('500 pts → Plata (límite inferior)', () => {
    expect(getClientLevel(500).name).toBe('Plata')
  })

  it('1499 pts → Plata (límite superior)', () => {
    expect(getClientLevel(1499).name).toBe('Plata')
  })

  it('1500 pts → Oro (límite inferior)', () => {
    expect(getClientLevel(1500).name).toBe('Oro')
  })

  it('3999 pts → Oro (límite superior)', () => {
    expect(getClientLevel(3999).name).toBe('Oro')
  })

  it('4000 pts → Platino (límite inferior)', () => {
    expect(getClientLevel(4000).name).toBe('Platino')
  })

  it('99999 pts → Platino (sin límite superior)', () => {
    expect(getClientLevel(99999).name).toBe('Platino')
  })

  it('sin argumento → Bronce (default 0)', () => {
    expect(getClientLevel().name).toBe('Bronce')
  })

  it('retorna el multiplicador correcto para cada nivel', () => {
    expect(getClientLevel(0).multiplier).toBe(1.0)
    expect(getClientLevel(500).multiplier).toBe(1.2)
    expect(getClientLevel(1500).multiplier).toBe(1.5)
    expect(getClientLevel(4000).multiplier).toBe(2.0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getNextLevel — siguiente nivel y puntos necesarios
// ═══════════════════════════════════════════════════════════════════════════════
describe('getNextLevel', () => {
  it('Bronce con 0 pts → siguiente Plata, necesita 500', () => {
    const next = getNextLevel(0)
    expect(next.level.name).toBe('Plata')
    expect(next.pointsNeeded).toBe(500)
  })

  it('Bronce con 300 pts → necesita 200 para Plata', () => {
    const next = getNextLevel(300)
    expect(next.pointsNeeded).toBe(200)
  })

  it('Plata con 1000 pts → siguiente Oro, necesita 500', () => {
    const next = getNextLevel(1000)
    expect(next.level.name).toBe('Oro')
    expect(next.pointsNeeded).toBe(500)
  })

  it('Platino (4000+) → null (no hay siguiente nivel)', () => {
    expect(getNextLevel(5000)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// calcPointsEarned — Política P1 + P2
// ═══════════════════════════════════════════════════════════════════════════════
describe('calcPointsEarned — P1 base + P2 multiplicador', () => {
  // P1: 1 punto base por cada S/10 pagado
  it('S/75 nivel Bronce → floor(7 × 1.0) = 7 pts', () => {
    expect(calcPointsEarned(75, 0, CFG)).toBe(7)
  })

  it('S/75 nivel Plata → floor(7 × 1.2) = floor(8.4) = 8 pts', () => {
    expect(calcPointsEarned(75, 500, CFG)).toBe(8)
  })

  it('S/75 nivel Oro → floor(7 × 1.5) = floor(10.5) = 10 pts', () => {
    expect(calcPointsEarned(75, 1500, CFG)).toBe(10)
  })

  it('S/75 nivel Platino → floor(7 × 2.0) = 14 pts', () => {
    expect(calcPointsEarned(75, 4000, CFG)).toBe(14)
  })

  it('S/9 (< S/10) → 0 pts por redondeo floor', () => {
    expect(calcPointsEarned(9.99, 0, CFG)).toBe(0)
  })

  it('S/10 exacto → 1 pt', () => {
    expect(calcPointsEarned(10, 0, CFG)).toBe(1)
  })

  it('S/0 → 0 pts', () => {
    expect(calcPointsEarned(0, 0, CFG)).toBe(0)
  })

  it('saleTotal negativo → 0 pts', () => {
    expect(calcPointsEarned(-50, 0, CFG)).toBe(0)
  })

  it('programa deshabilitado → 0 pts', () => {
    expect(calcPointsEarned(100, 0, { ...CFG, enabled: false })).toBe(0)
  })

  it('S/100 Bronce → 10 pts', () => {
    expect(calcPointsEarned(100, 0, CFG)).toBe(10)
  })

  it('S/150 Plata → floor(15 × 1.2) = floor(18) = 18 pts', () => {
    expect(calcPointsEarned(150, 500, CFG)).toBe(18)
  })

  it('los puntos ganados son siempre enteros', () => {
    const pts = calcPointsEarned(73.50, 500, CFG)
    expect(Number.isInteger(pts)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// calcRedemptionValue — Política P3
// ═══════════════════════════════════════════════════════════════════════════════
describe('calcRedemptionValue — P3 canje de puntos', () => {
  // minRedeemPoints=50, pointsValue=S/0.10, maxRedeemPct=50%

  it('49 pts → inválido (bajo el mínimo)', () => {
    const r = calcRedemptionValue(49, 100, CFG)
    expect(r.valid).toBe(false)
    expect(r.discount).toBe(0)
    expect(r.reason).toContain('50')
  })

  it('50 pts → S/5.00 de descuento (mínimo exacto)', () => {
    const r = calcRedemptionValue(50, 100, CFG)
    expect(r.valid).toBe(true)
    expect(r.discount).toBe(5.00)
  })

  it('120 pts → S/12.00 de descuento', () => {
    const r = calcRedemptionValue(120, 200, CFG)
    expect(r.valid).toBe(true)
    expect(r.discount).toBe(12.00)
  })

  it('puntos que exceden 50% del total → capped al máximo permitido', () => {
    // 1000 pts = S/100 de descuento, pero total=S/50 → máximo 50% = S/25
    const r = calcRedemptionValue(1000, 50, CFG)
    expect(r.valid).toBe(true)
    expect(r.capped).toBe(true)
    expect(r.discount).toBe(25.00)
  })

  it('descuento no supera el total de la venta', () => {
    // 200 pts = S/20, total=S/30 → 50% max = S/15
    const r = calcRedemptionValue(200, 30, CFG)
    expect(r.discount).toBeLessThanOrEqual(30)
  })

  it('retorna rawDiscount aunque esté capped', () => {
    const r = calcRedemptionValue(1000, 50, CFG)
    expect(r.rawDiscount).toBe(100.00)
    expect(r.discount).toBe(25.00)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getActivePoints — Política P4 (vencimiento por transacción)
// ═══════════════════════════════════════════════════════════════════════════════
describe('getActivePoints — P4 vencimiento', () => {
  const now   = new Date().toISOString()
  const old   = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString() // 400 días atrás

  it('sin transacciones → 0 pts', () => {
    expect(getActivePoints([], CFG)).toBe(0)
  })

  it('transacciones earned recientes → suma correcta', () => {
    const txs = [
      { type: 'earned', points: 30, createdAt: now },
      { type: 'earned', points: 20, createdAt: now },
    ]
    expect(getActivePoints(txs, CFG)).toBe(50)
  })

  it('transacción earned vencida (>365 días) → no cuenta', () => {
    const txs = [{ type: 'earned', points: 100, createdAt: old }]
    expect(getActivePoints(txs, CFG)).toBe(0)
  })

  it('earned reciente - redeemed = saldo correcto', () => {
    const txs = [
      { type: 'earned',   points: 100, createdAt: now },
      { type: 'redeemed', points: 50,  createdAt: now },
    ]
    expect(getActivePoints(txs, CFG)).toBe(50)
  })

  it('resultado nunca es negativo (redeemption > earned activos)', () => {
    const txs = [
      { type: 'earned',   points: 20, createdAt: now },
      { type: 'redeemed', points: 80, createdAt: now },
    ]
    expect(getActivePoints(txs, CFG)).toBe(0)
  })

  it('mezcla de vencidas y vigentes → solo cuenta las vigentes', () => {
    const txs = [
      { type: 'earned', points: 100, createdAt: old }, // vencida
      { type: 'earned', points: 50,  createdAt: now }, // vigente
    ]
    expect(getActivePoints(txs, CFG)).toBe(50)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// buildLoyaltySummary
// ═══════════════════════════════════════════════════════════════════════════════
describe('buildLoyaltySummary', () => {
  it('cliente nuevo → canRedeem=false, level=Bronce', () => {
    const client = {
      loyaltyPoints: 0,
      loyaltyAccumulated: 0,
      loyaltyLevel: 'Bronce',
      loyaltyTransactions: [],
    }
    const summary = buildLoyaltySummary(client, CFG)
    expect(summary.canRedeem).toBe(false)
    expect(summary.level.name).toBe('Bronce')
    expect(summary.accumulated).toBe(0)
    expect(summary.totalSavings).toBe(0)
  })

  it('cliente con 50+ puntos → canRedeem=true', () => {
    const client = {
      loyaltyPoints: 60,
      loyaltyAccumulated: 60,
      loyaltyLevel: 'Bronce',
      loyaltyTransactions: [],
    }
    const summary = buildLoyaltySummary(client, CFG)
    expect(summary.canRedeem).toBe(true)
  })

  it('totalSavings = suma de discountAmount en transacciones redeemed', () => {
    const client = {
      loyaltyPoints: 0,
      loyaltyAccumulated: 200,
      loyaltyLevel: 'Bronce',
      loyaltyTransactions: [
        { type: 'redeemed', points: 50, discountAmount: 5.00, createdAt: new Date().toISOString() },
        { type: 'redeemed', points: 100, discountAmount: 10.00, createdAt: new Date().toISOString() },
      ],
    }
    const summary = buildLoyaltySummary(client, CFG)
    expect(summary.totalSavings).toBe(15.00)
  })

  it('progressPct = 100 si está en Platino (no hay siguiente nivel)', () => {
    const client = {
      loyaltyPoints: 500,
      loyaltyAccumulated: 5000,
      loyaltyLevel: 'Platino',
      loyaltyTransactions: [],
    }
    const summary = buildLoyaltySummary(client, CFG)
    expect(summary.progressPct).toBe(100)
    expect(summary.nextLvl).toBeNull()
  })

  it('transacciones se retornan ordenadas por fecha descendente', () => {
    const now = new Date()
    const older = new Date(now - 10000).toISOString()
    const newer = now.toISOString()
    const client = {
      loyaltyPoints: 100,
      loyaltyAccumulated: 100,
      loyaltyLevel: 'Bronce',
      loyaltyTransactions: [
        { type: 'earned', points: 30, createdAt: older },
        { type: 'earned', points: 70, createdAt: newer },
      ],
    }
    const summary = buildLoyaltySummary(client, CFG)
    expect(new Date(summary.transactions[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(summary.transactions[1].createdAt).getTime()
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Constructores de transacciones
// ═══════════════════════════════════════════════════════════════════════════════
describe('buildEarnTransaction', () => {
  const level = LOYALTY_LEVELS[0] // Bronce

  it('retorna objeto con type=earned y los puntos correctos', () => {
    const tx = buildEarnTransaction(10, 'sale-1', 'B001-000001', 100, level)
    expect(tx.type).toBe('earned')
    expect(tx.points).toBe(10)
    expect(tx.saleId).toBe('sale-1')
  })

  it('tiene id único (UUID) y createdAt', () => {
    const tx = buildEarnTransaction(5, 'sale-2', 'B001-000002', 50, level)
    expect(tx.id).toBeTruthy()
    expect(tx.createdAt).toBeTruthy()
  })

  it('description incluye el número de comprobante', () => {
    const tx = buildEarnTransaction(7, 'sale-3', 'B001-000003', 75, level)
    expect(tx.description).toContain('B001-000003')
  })
})

describe('buildRedeemTransaction', () => {
  it('retorna objeto con type=redeemed y puntos negativos lógicamente correctos', () => {
    const tx = buildRedeemTransaction(50, 5.00, 'sale-1', 'B001-000001')
    expect(tx.type).toBe('redeemed')
    expect(tx.points).toBe(50)
    expect(tx.discountAmount).toBe(5.00)
  })

  it('description incluye el monto de descuento', () => {
    const tx = buildRedeemTransaction(50, 5.00, 'sale-1', 'B001-000001')
    expect(tx.description).toContain('5')
  })
})

describe('buildVoidTransaction', () => {
  it('retorna objeto con type=voided y puntos negativos', () => {
    const tx = buildVoidTransaction(10, 'sale-1', 'B001-000001', 'NC-000001')
    expect(tx.type).toBe('voided')
    expect(tx.points).toBe(-10) // P5: negativo = puntos anulados
  })

  it('description incluye el número de nota de crédito', () => {
    const tx = buildVoidTransaction(10, 'sale-1', 'B001-000001', 'NC-000001')
    expect(tx.description).toContain('NC-000001')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// createLoyaltyProfile
// ═══════════════════════════════════════════════════════════════════════════════
describe('createLoyaltyProfile', () => {
  it('retorna perfil en cero para cliente nuevo', () => {
    const profile = createLoyaltyProfile()
    expect(profile.loyaltyPoints).toBe(0)
    expect(profile.loyaltyAccumulated).toBe(0)
    expect(profile.loyaltyLevel).toBe('Bronce')
    expect(profile.loyaltyTransactions).toHaveLength(0)
  })
})
