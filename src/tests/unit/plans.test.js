/**
 * Tests: config/plans.js
 * Cubre precios, fechas de acceso, estados y permisos de plan.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  BONUS_DAYS,
  BILLING_CYCLES,
  PLANS,
  getPlanPrice,
  getTotalPrice,
  getAccessExpiry,
  daysUntilExpiry,
  getAccessStatus,
  isPlanActive,
  trialDaysLeft,
  canUsePlan,
  getPlanAvailableRoles,
  isPlanRoleAllowed,
  getMinPlanForFeature,
} from '../../config/plans'

// ─── Helpers de fecha ─────────────────────────────────────────────────────────
const futureDate = (days) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}
const pastDate = (days) => futureDate(-days)

// ═══════════════════════════════════════════════════════════════════════════════
// getPlanPrice — precio mensual con descuento por ciclo
// ═══════════════════════════════════════════════════════════════════════════════
describe('getPlanPrice', () => {
  it('trial siempre es 0 sin importar el ciclo', () => {
    expect(getPlanPrice('trial', 'monthly')).toBe(0)
    expect(getPlanPrice('trial', 'annual')).toBe(0)
  })

  it('basic mensual no tiene descuento → S/49', () => {
    expect(getPlanPrice('basic', 'monthly')).toBe(49)
  })

  it('pro trimestral → 10% descuento → S/89', () => {
    expect(getPlanPrice('pro', 'quarterly')).toBe(89)  // 99 * 0.90 = 89.1 → 89
  })

  it('enterprise semestral → 15% descuento → S/169', () => {
    expect(getPlanPrice('enterprise', 'semiannual')).toBe(169)  // 199 * 0.85 = 169.15 → 169
  })

  it('plan desconocido → 0', () => {
    expect(getPlanPrice('nonexistent', 'monthly')).toBe(0)
  })

  it('ciclo desconocido → sin descuento (0%)', () => {
    expect(getPlanPrice('pro', 'unknown')).toBe(99)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getTotalPrice — total del ciclo completo
// ═══════════════════════════════════════════════════════════════════════════════
describe('getTotalPrice', () => {
  it('pro mensual → S/99 × 1 = S/99', () => {
    expect(getTotalPrice('pro', 'monthly')).toBe(99)
  })

  it('pro trimestral → S/89 × 3 = S/267', () => {
    expect(getTotalPrice('pro', 'quarterly')).toBe(267)
  })

  it('basic anual → 20% desc → S/39 × 12 = S/468', () => {
    expect(getTotalPrice('basic', 'annual')).toBe(468)  // 49*0.80=39.2→39, 39*12=468
  })

  it('trial → siempre S/0', () => {
    expect(getTotalPrice('trial', 'annual')).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getAccessExpiry — fecha de vencimiento de acceso
// ═══════════════════════════════════════════════════════════════════════════════
describe('getAccessExpiry', () => {
  it('mensual (30 días) + BONUS_DAYS desde hoy', () => {
    const start = new Date().toISOString()
    const expiry = new Date(getAccessExpiry(start, 'monthly'))
    const expected = new Date(start)
    expected.setDate(expected.getDate() + 30 + BONUS_DAYS)
    expect(expiry.toDateString()).toBe(expected.toDateString())
  })

  it('anual (365 días) + bonusDays custom', () => {
    const start = '2026-01-01T00:00:00.000Z'
    const expiry = new Date(getAccessExpiry(start, 'annual', 0))
    expect(expiry.getUTCFullYear()).toBe(2027)
  })

  it('sin ciclo → default 30 días', () => {
    const start = new Date().toISOString()
    const expiry = new Date(getAccessExpiry(start))
    const diff = Math.round((expiry - new Date()) / (1000 * 60 * 60 * 24))
    expect(diff).toBeCloseTo(30 + BONUS_DAYS, 0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// daysUntilExpiry — días hasta el vencimiento
// ═══════════════════════════════════════════════════════════════════════════════
describe('daysUntilExpiry', () => {
  it('null → null', () => {
    expect(daysUntilExpiry(null)).toBeNull()
  })

  it('fecha futura en 10 días → ≈10', () => {
    expect(daysUntilExpiry(futureDate(10))).toBe(10)
  })

  it('fecha pasada 5 días → negativo', () => {
    expect(daysUntilExpiry(pastDate(5))).toBeLessThan(0)
  })

  it('vence hoy (en pocas horas) → 0 o 1', () => {
    const soon = new Date()
    soon.setHours(soon.getHours() + 2)
    const days = daysUntilExpiry(soon.toISOString())
    expect(days).toBeGreaterThanOrEqual(0)
    expect(days).toBeLessThanOrEqual(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getAccessStatus — estado calculado del acceso
// ═══════════════════════════════════════════════════════════════════════════════
describe('getAccessStatus', () => {
  it('isActive=false → suspended (sin importar la fecha)', () => {
    expect(getAccessStatus(futureDate(30), false)).toBe('suspended')
    expect(getAccessStatus(pastDate(30), false)).toBe('suspended')
  })

  it('sin fecha de expiración → active', () => {
    expect(getAccessStatus(null, true)).toBe('active')
    expect(getAccessStatus(undefined, true)).toBe('active')
  })

  it('fecha en 30 días → active', () => {
    expect(getAccessStatus(futureDate(30), true)).toBe('active')
  })

  it('fecha en 5 días → expiring (≤7)', () => {
    expect(getAccessStatus(futureDate(5), true)).toBe('expiring')
  })

  it('fecha en 7 días exactos → expiring', () => {
    expect(getAccessStatus(futureDate(7), true)).toBe('expiring')
  })

  it('fecha vencida → expired', () => {
    expect(getAccessStatus(pastDate(1), true)).toBe('expired')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// isPlanActive — ¿acceso vigente?
// ═══════════════════════════════════════════════════════════════════════════════
describe('isPlanActive', () => {
  it('sin fecha de expiración → true', () => {
    expect(isPlanActive('basic', null)).toBe(true)
  })

  it('fecha futura → true', () => {
    expect(isPlanActive('pro', futureDate(10))).toBe(true)
  })

  it('fecha pasada → false', () => {
    expect(isPlanActive('pro', pastDate(1))).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// trialDaysLeft — días restantes (mínimo 0)
// ═══════════════════════════════════════════════════════════════════════════════
describe('trialDaysLeft', () => {
  it('null → null', () => {
    expect(trialDaysLeft(null)).toBeNull()
  })

  it('fecha futura en 15 días → 15', () => {
    expect(trialDaysLeft(futureDate(15))).toBe(15)
  })

  it('fecha ya vencida → 0 (nunca negativo)', () => {
    expect(trialDaysLeft(pastDate(5))).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// canUsePlan — acceso a features por plan
// ═══════════════════════════════════════════════════════════════════════════════
describe('canUsePlan', () => {
  it('enterprise → todas las features (features === "all")', () => {
    expect(canUsePlan('enterprise', 'discounts')).toBe(true)
    expect(canUsePlan('enterprise', 'cualquier-cosa')).toBe(true)
  })

  it('trial incluye pos y dashboard', () => {
    expect(canUsePlan('trial', 'pos')).toBe(true)
    expect(canUsePlan('trial', 'dashboard')).toBe(true)
  })

  it('trial NO incluye discounts ni loyalty', () => {
    expect(canUsePlan('trial', 'discounts')).toBe(false)
    expect(canUsePlan('trial', 'loyalty')).toBe(false)
  })

  it('pro incluye audit y alerts', () => {
    expect(canUsePlan('pro', 'audit')).toBe(true)
    expect(canUsePlan('pro', 'alerts')).toBe(true)
  })

  it('basic NO incluye audit ni loyalty', () => {
    expect(canUsePlan('basic', 'audit')).toBe(false)
    expect(canUsePlan('basic', 'loyalty')).toBe(false)
  })

  it('plan desconocido → false', () => {
    expect(canUsePlan('nonexistent', 'pos')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getPlanAvailableRoles / isPlanRoleAllowed
// ═══════════════════════════════════════════════════════════════════════════════
describe('getPlanAvailableRoles', () => {
  it('trial solo tiene admin', () => {
    expect(getPlanAvailableRoles('trial')).toEqual(['admin'])
  })

  it('pro incluye admin, gerente, supervisor, cajero', () => {
    const roles = getPlanAvailableRoles('pro')
    expect(roles).toContain('admin')
    expect(roles).toContain('gerente')
    expect(roles).toContain('supervisor')
    expect(roles).toContain('cajero')
  })

  it('plan desconocido → fallback ["admin"]', () => {
    expect(getPlanAvailableRoles('unknown')).toEqual(['admin'])
  })
})

describe('isPlanRoleAllowed', () => {
  it('trial + admin → true', () => {
    expect(isPlanRoleAllowed('trial', 'admin')).toBe(true)
  })

  it('trial + cajero → false', () => {
    expect(isPlanRoleAllowed('trial', 'cajero')).toBe(false)
  })

  it('pro + supervisor → true', () => {
    expect(isPlanRoleAllowed('pro', 'supervisor')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getMinPlanForFeature — plan mínimo que incluye una feature
// ═══════════════════════════════════════════════════════════════════════════════
describe('getMinPlanForFeature', () => {
  it('pos está en trial (el más básico)', () => {
    expect(getMinPlanForFeature('pos')).toBe('trial')
  })

  it('discounts solo está en pro o superior', () => {
    const plan = getMinPlanForFeature('discounts')
    expect(['pro', 'enterprise']).toContain(plan)
  })

  it('feature inexistente → enterprise (fallback)', () => {
    expect(getMinPlanForFeature('feature-que-no-existe')).toBe('enterprise')
  })
})
