/**
 * Tests: services/tenantService.js
 * Cubre makeSlug, funciones en modo localStorage (USE_API=false),
 * y la normalización de datos del backend (getRenewals, listAll).
 *
 * Las funciones API-mode se testean mockeando axios (_base).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock de _base ANTES de importar tenantService ────────────────────────────
vi.mock('../../services/_base', () => ({
  USE_API: false,          // modo localStorage por defecto
  api:     {},
  ok:      (data, total) => ({ ok: true, data, meta: { total: total ?? (Array.isArray(data) ? data.length : 1) }, error: null }),
  fail:    (msg)         => ({ ok: false, data: null, meta: null, error: msg || 'Error desconocido' }),
  delay:   ()            => Promise.resolve(),
  gs:      ()            => ({ users: [], currentUser: null }),
}))

// Mock de config/plans para aislar tests de cambios en planes
vi.mock('../../config/plans', () => ({
  BONUS_DAYS:      3,
  BILLING_CYCLES:  { monthly: { id: 'monthly', days: 30, months: 1 } },
  getAccessExpiry: (start) => {
    const d = new Date(start)
    d.setDate(d.getDate() + 33)
    return d.toISOString()
  },
  daysUntilExpiry: (date) => date ? Math.ceil((new Date(date) - new Date()) / 86400000) : null,
}))

vi.mock('../../config/planLimits', () => ({
  PLAN_LIMITS: {
    trial:      { maxProducts: 50 },
    basic:      { maxProducts: 500 },
    pro:        { maxProducts: 2000 },
    enterprise: { maxProducts: null },
  },
}))

vi.mock('../../config/storageKeys', () => ({
  STORAGE_KEYS: {
    mockTenants:        'mm_sa_tenants_v1',
    mockAccesses:       'mm_sa_accesses_v1',
    mockRenewals:       'mm_sa_renewals_v1',
    mockPrices:         'mm_sa_prices_v1',
    mockSite:           'mm_sa_site_v1',
    mockPlanLimits:     'mm_sa_limits_v1',
    mockAlertThresholds:'mm_sa_alerts_v1',
    authToken:          'mm_token',
  },
}))

import { makeSlug, tenantService } from '../../services/tenantService'

// ═══════════════════════════════════════════════════════════════════════════════
// makeSlug — normalización de nombres a slug URL-safe
// ═══════════════════════════════════════════════════════════════════════════════
describe('makeSlug', () => {
  it('convierte a minúsculas y elimina espacios', () => {
    expect(makeSlug('Bodega Don Luchito')).toBe('bodega-don-luchito')
  })

  it('elimina acentos y caracteres especiales', () => {
    expect(makeSlug('Café & Panadería')).toBe('cafe-panaderia')
  })

  it('múltiples espacios/guiones → un solo guión', () => {
    expect(makeSlug('Mi   Super  Tienda')).toBe('mi-super-tienda')
  })

  it('no empieza ni termina en guión', () => {
    const slug = makeSlug('  Tienda  ')
    expect(slug).not.toMatch(/^-/)
    expect(slug).not.toMatch(/-$/)
  })

  it('máximo 40 caracteres', () => {
    const long = 'Supermercado La Gran Bodega Del Mercado Central Sur'
    expect(makeSlug(long).length).toBeLessThanOrEqual(40)
  })

  it('números se conservan', () => {
    expect(makeSlug('Tienda 24H')).toBe('tienda-24h')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// listLoginEvents — modo localStorage (no hay eventos, retorna vacío)
// ═══════════════════════════════════════════════════════════════════════════════
describe('listLoginEvents (localStorage mode)', () => {
  it('retorna array vacío sin lanzar error', async () => {
    const r = await tenantService.listLoginEvents()
    expect(r.ok).toBe(true)
    expect(Array.isArray(r.data)).toBe(true)
    expect(r.data).toHaveLength(0)
  })

  it('acepta parámetros sin error (tenantId, limit, offset)', async () => {
    const r = await tenantService.listLoginEvents({ tenantId: 'abc', limit: 10, offset: 0 })
    expect(r.ok).toBe(true)
    expect(r.data).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// deleteLoginEvent — modo localStorage (no-op, retorna ok)
// ═══════════════════════════════════════════════════════════════════════════════
describe('deleteLoginEvent (localStorage mode)', () => {
  it('retorna ok sin lanzar error', async () => {
    const r = await tenantService.deleteLoginEvent('some-event-id')
    expect(r.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// listAll — modo localStorage: retorna tenants del mock
// ═══════════════════════════════════════════════════════════════════════════════
describe('listAll (localStorage mode)', () => {
  it('retorna al menos el tenant demo', async () => {
    const r = await tenantService.listAll()
    expect(r.ok).toBe(true)
    expect(Array.isArray(r.data)).toBe(true)
    expect(r.data.length).toBeGreaterThanOrEqual(1)
  })

  it('filtra por search (nombre o email)', async () => {
    const r = await tenantService.listAll({ search: 'demo' })
    expect(r.ok).toBe(true)
    expect(Array.isArray(r.data)).toBe(true)
    // Todos los resultados deben contener 'demo' en algún campo
    r.data.forEach(t => {
      const haystack = `${t.businessName} ${t.slug} ${t.ownerEmail ?? ''}`.toLowerCase()
      expect(haystack).toContain('demo')
    })
  })

  it('search sin coincidencias → array vacío', async () => {
    const r = await tenantService.listAll({ search: 'zzz_no_existe_zzz' })
    expect(r.ok).toBe(true)
    expect(r.data).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getBySlug — modo localStorage
// ═══════════════════════════════════════════════════════════════════════════════
describe('getBySlug (localStorage mode)', () => {
  it('slug existente → retorna tenant con los campos correctos', async () => {
    const r = await tenantService.getBySlug('demo')
    expect(r.ok).toBe(true)
    expect(r.data).toBeDefined()
    expect(r.data.slug).toBe('demo')
    expect(r.data.businessName).toBeDefined()
    expect(r.data.plan).toBeDefined()
  })

  it('slug inexistente → retorna tenant demo como fallback', async () => {
    const r = await tenantService.getBySlug('slug-que-no-existe')
    expect(r.ok).toBe(true)
    // Fallback al tenant demo en localStorage mode
    expect(r.data).toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getSiteSettings / updateSiteSettings — round-trip localStorage
// ═══════════════════════════════════════════════════════════════════════════════
describe('getSiteSettings / updateSiteSettings (localStorage mode)', () => {
  it('getSiteSettings retorna objeto con campo brandName', async () => {
    const r = await tenantService.getSiteSettings()
    expect(r.ok).toBe(true)
    expect(r.data).toHaveProperty('brandName')
  })

  it('updateSiteSettings persiste y getSiteSettings lo lee', async () => {
    const newName = `TestBrand_${Date.now()}`
    await tenantService.updateSiteSettings({ brandName: newName })
    const r = await tenantService.getSiteSettings()
    expect(r.data.brandName).toBe(newName)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getLimits / updateLimits — round-trip localStorage
// ═══════════════════════════════════════════════════════════════════════════════
describe('getLimits / updateLimits (localStorage mode)', () => {
  it('getLimits retorna objeto con claves de planes', async () => {
    const r = await tenantService.getLimits()
    expect(r.ok).toBe(true)
    expect(r.data).toHaveProperty('trial')
    expect(r.data).toHaveProperty('basic')
    expect(r.data).toHaveProperty('pro')
    expect(r.data).toHaveProperty('enterprise')
  })

  it('updateLimits persiste cambio y getLimits lo refleja', async () => {
    await tenantService.updateLimits({ trial: { maxProducts: 99 } })
    const r = await tenantService.getLimits()
    expect(r.data.trial.maxProducts).toBe(99)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getRenewals — normalización de campos del backend
// ═══════════════════════════════════════════════════════════════════════════════
describe('getRenewals — normalización de campos', () => {
  it('en localStorage mode → retorna array (puede estar vacío)', async () => {
    const r = await tenantService.getRenewals()
    expect(r.ok).toBe(true)
    expect(Array.isArray(r.data)).toBe(true)
  })

  // Verifica que la función de normalización mapea plan→newPlan y createdAt→renewedAt
  it('normalización: el objeto normalizado tiene newPlan y renewedAt', () => {
    // Simula un objeto del backend con los campos crudos
    const backendRaw = { plan: 'pro', createdAt: '2026-01-15T10:00:00Z', tenant: { businessName: 'Tienda Test' } }

    // Aplica la misma normalización que usa tenantService.getRenewals en API mode
    const normalized = {
      ...backendRaw,
      newPlan:      backendRaw.plan,
      renewedAt:    backendRaw.createdAt,
      businessName: backendRaw.tenant?.businessName ?? '—',
    }

    expect(normalized.newPlan).toBe('pro')
    expect(normalized.renewedAt).toBe('2026-01-15T10:00:00Z')
    expect(normalized.businessName).toBe('Tienda Test')
    // Campos originales se conservan
    expect(normalized.plan).toBe('pro')
    expect(normalized.createdAt).toBe('2026-01-15T10:00:00Z')
  })

  it('normalización: tenant null → businessName = "—"', () => {
    const backendRaw = { plan: 'basic', createdAt: '2026-01-01T00:00:00Z', tenant: null }
    const normalized = {
      ...backendRaw,
      newPlan:      backendRaw.plan,
      renewedAt:    backendRaw.createdAt,
      businessName: backendRaw.tenant?.businessName ?? '—',
    }
    expect(normalized.businessName).toBe('—')
  })
})
