import { api, USE_API, ok, fail, delay } from './_base'
import { getAccessExpiry, BONUS_DAYS, BILLING_CYCLES } from '../config/plans'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isoNow   = ()          => new Date().toISOString()
const makeSlug = (name)      => name.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

// ─── Persistencia mock en localStorage ───────────────────────────────────────
// El mock debe sobrevivir a page-reloads para que el registro self-service
// aparezca en el SuperAdmin aunque el usuario cambie de URL.

const KEYS = {
  tenants:  'mm_mock_tenants_v1',
  accesses: 'mm_mock_accesses_v1',
  renewals: 'mm_mock_renewals_v1',
  prices:   'mm_mock_prices_v1',
  site:     'mm_mock_site_v1',
}

const _load = (key) => {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null } catch { return null }
}
const _save = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}

// ─── Datos default (solo cuando localStorage está vacío) ──────────────────────
const START_DEMO   = '2025-04-12T00:00:00Z'
const START_TIENDA = '2025-03-14T00:00:00Z'

const DEFAULT_TENANTS = {
  demo: {
    id: 'tenant_demo', slug: 'demo',
    businessName: 'Bodega Demo', sector: 'bodega',
    ownerName: 'Administrador Demo', ownerEmail: 'demo@minimarket.app', phone: '999000001',
    plan: 'pro', billingCycle: 'monthly',
    accessStartDate: START_DEMO,
    accessExpiresAt: getAccessExpiry(START_DEMO, 'monthly'),
    isActive: true, createdAt: '2025-01-01T00:00:00Z',
  },
  'mi-tienda': {
    id: 'tenant_001', slug: 'mi-tienda',
    businessName: 'Mi Tienda', sector: 'bodega',
    ownerName: 'Juan Pérez', ownerEmail: 'juan@mitienda.com', phone: '987654321',
    plan: 'trial', billingCycle: 'monthly',
    accessStartDate: START_TIENDA,
    accessExpiresAt: getAccessExpiry(START_TIENDA, 'monthly'),
    isActive: true, createdAt: '2025-03-14T00:00:00Z',
  },
}

const DEFAULT_ACCESSES = [
  {
    id: 'access_001', tenantId: 'tenant_demo', tenantSlug: 'demo',
    businessName: 'Bodega Demo', plan: 'pro',
    accessStartDate: START_DEMO, accessExpiresAt: getAccessExpiry(START_DEMO),
    bonusDays: BONUS_DAYS, notes: 'Acceso demo inicial',
    createdBy: 'superadmin', createdAt: START_DEMO,
  },
  {
    id: 'access_002', tenantId: 'tenant_001', tenantSlug: 'mi-tienda',
    businessName: 'Mi Tienda', plan: 'trial',
    accessStartDate: START_TIENDA, accessExpiresAt: getAccessExpiry(START_TIENDA),
    bonusDays: BONUS_DAYS, notes: 'Registro inicial self-service',
    createdBy: 'self-register', createdAt: START_TIENDA,
  },
]

const DEFAULT_RENEWALS = [
  {
    id: 'renew_001', tenantId: 'tenant_demo', businessName: 'Bodega Demo',
    previousPlan: null, newPlan: 'pro',
    accessStartDate: START_DEMO, accessExpiresAt: getAccessExpiry(START_DEMO),
    renewedBy: 'superadmin', renewedAt: START_DEMO, notes: 'Activación inicial demo',
  },
  {
    id: 'renew_002', tenantId: 'tenant_001', businessName: 'Mi Tienda',
    previousPlan: null, newPlan: 'trial',
    accessStartDate: START_TIENDA, accessExpiresAt: getAccessExpiry(START_TIENDA),
    renewedBy: 'self-register', renewedAt: START_TIENDA, notes: 'Registro self-service',
  },
]

// ─── Precios configurables (editables desde SuperAdmin) ──────────────────────
const DEFAULT_PRICES = { basic: 49, pro: 99, enterprise: 199 }

// ─── Configuración del sitio/landing (editable desde SuperAdmin) ──────────────
export const DEFAULT_SITE_SETTINGS = {
  brandName:   'MiniMarket POS',
  tagline:     'Sistema POS para retail minorista en Perú',
  phone:       '',
  whatsapp:    '',
  email:       '',
  address:     '',
  facebook:    '',
  instagram:   '',
  tiktok:      '',
}

// ─── Estado mutable persistido ────────────────────────────────────────────────
// Se lee de localStorage al cargar el módulo; los default solo aplican la primera vez.
let _tenants  = _load(KEYS.tenants)  ?? { ...DEFAULT_TENANTS }
let _accesses = _load(KEYS.accesses) ?? [...DEFAULT_ACCESSES]
let _renewals = _load(KEYS.renewals) ?? [...DEFAULT_RENEWALS]
let _prices   = _load(KEYS.prices)   ?? { ...DEFAULT_PRICES }
let _site     = _load(KEYS.site)     ?? { ...DEFAULT_SITE_SETTINGS }

// Contadores derivados de los datos existentes para evitar IDs duplicados
let _accessIdx  = Math.max(0, ..._accesses.map(a => parseInt(a.id.split('_')[1]) || 0)) + 1
let _renewalIdx = Math.max(0, ..._renewals.map(r => parseInt(r.id.split('_')[1]) || 0)) + 1

const _flush = () => {
  _save(KEYS.tenants,  _tenants)
  _save(KEYS.accesses, _accesses)
  _save(KEYS.renewals, _renewals)
}

// Lectura sincrónica para Landing (no async)
export const getStoredPrices        = () => _load(KEYS.prices) ?? { ...DEFAULT_PRICES }
export const getStoredSiteSettings  = () => _load(KEYS.site)   ?? { ...DEFAULT_SITE_SETTINGS }

// ─── Servicio ─────────────────────────────────────────────────────────────────
export const tenantService = {

  // ── App (tenant context) ────────────────────────────────────────────────────

  async getBySlug(slug) {
    await delay(120)
    if (USE_API) {
      const { data } = await api.get(`/tenants/${slug}`)
      return ok(data)
    }
    // Busca por slug exacto; si no existe devuelve demo como fallback
    const tenant = _tenants[slug] ?? _tenants.demo
    return ok(tenant)
  },

  // ── Registro self-service ───────────────────────────────────────────────────

  async register({ businessName, sector, ownerName, ownerEmail, phone = '', password, plan = 'trial', billingCycle = 'monthly' }) {
    await delay(900)
    if (USE_API) {
      const { data } = await api.post('/tenants/register', { businessName, sector, ownerName, ownerEmail, phone, password, plan, billingCycle })
      return ok(data)
    }

    const slug            = makeSlug(businessName)
    const tenantId        = `tenant_${Date.now()}`
    const accessStartDate = isoNow()
    const accessExpiresAt = getAccessExpiry(accessStartDate, billingCycle)

    // Persiste en mock para que SuperAdmin lo vea en cualquier página/reload
    _tenants[slug] = {
      id: tenantId, slug, businessName, sector,
      ownerName, ownerEmail, phone, plan, billingCycle,
      accessStartDate, accessExpiresAt,
      isActive: true, createdAt: accessStartDate,
    }

    const accessId  = `access_${_accessIdx++}`
    const renewalId = `renew_${_renewalIdx++}`

    _accesses.push({
      id: accessId, tenantId, tenantSlug: slug, businessName, plan,
      accessStartDate, accessExpiresAt,
      bonusDays: BONUS_DAYS, notes: 'Registro inicial self-service',
      createdBy: 'self-register', createdAt: accessStartDate,
    })
    _renewals.unshift({
      id: renewalId, tenantId, businessName, previousPlan: null, newPlan: plan,
      accessStartDate, accessExpiresAt,
      renewedBy: 'self-register', renewedAt: accessStartDate, notes: 'Registro self-service',
    })

    _flush()
    return ok({ slug, tenantId, plan, accessStartDate, accessExpiresAt })
  },

  async checkSlugAvailable(slug) {
    await delay(280)
    if (USE_API) {
      const { data } = await api.get(`/tenants/check-slug/${slug}`)
      return ok(data.available)
    }
    return ok(!(slug in _tenants))
  },

  async updateConfig(tenantId, config) {
    await delay(400)
    if (USE_API) {
      const { data } = await api.patch(`/tenants/${tenantId}/config`, config)
      return ok(data)
    }
    const tenant = Object.values(_tenants).find(t => t.id === tenantId)
    if (tenant) { Object.assign(tenant, config); _flush() }
    return ok({ ...config, updatedAt: isoNow() })
  },

  // ── SuperAdmin — Negocios ───────────────────────────────────────────────────

  async listAll({ search = '' } = {}) {
    await delay(200)
    if (USE_API) {
      const { data } = await api.get('/admin/tenants', { params: { search } })
      return ok(data.items, data.total)
    }
    const all = Object.values(_tenants)
    const filtered = search
      ? all.filter(t =>
          t.businessName.toLowerCase().includes(search.toLowerCase()) ||
          t.slug.includes(search.toLowerCase())
        )
      : all
    return ok(filtered, filtered.length)
  },

  async setActive(tenantId, isActive) {
    await delay(280)
    if (USE_API) await api.patch(`/admin/tenants/${tenantId}/status`, { isActive })
    const tenant = Object.values(_tenants).find(t => t.id === tenantId)
    if (tenant) { tenant.isActive = isActive; _flush() }
    return ok({ tenantId, isActive })
  },

  // ── SuperAdmin — Renovaciones ───────────────────────────────────────────────

  async renewAccess(tenantId, { plan, billingCycle = 'monthly', startMode = 'today', notes = '' }) {
    await delay(500)
    if (USE_API) {
      const { data } = await api.post(`/admin/tenants/${tenantId}/renew`, { plan, billingCycle, startMode, notes })
      return ok(data)
    }
    const tenant = Object.values(_tenants).find(t => t.id === tenantId)
    if (!tenant) return fail('Negocio no encontrado')

    const previousPlan    = tenant.plan
    const baseDate        = startMode === 'from_expiry' && tenant.accessExpiresAt && new Date(tenant.accessExpiresAt) > new Date()
      ? tenant.accessExpiresAt : isoNow()
    const accessStartDate = baseDate
    const accessExpiresAt = getAccessExpiry(accessStartDate, billingCycle)

    Object.assign(tenant, { plan, billingCycle, accessStartDate, accessExpiresAt, isActive: true })

    _accesses.push({
      id: `access_${_accessIdx++}`, tenantId, tenantSlug: tenant.slug,
      businessName: tenant.businessName, plan, billingCycle,
      accessStartDate, accessExpiresAt,
      bonusDays: BONUS_DAYS, notes,
      createdBy: 'superadmin', createdAt: isoNow(),
    })
    _renewals.unshift({
      id: `renew_${_renewalIdx++}`,
      tenantId, businessName: tenant.businessName,
      previousPlan, newPlan: plan,
      accessStartDate, accessExpiresAt,
      renewedBy: 'superadmin', renewedAt: isoNow(), notes,
    })

    _flush()
    return ok({ tenantId, plan, accessStartDate, accessExpiresAt })
  },

  async getRenewals({ tenantId = null } = {}) {
    await delay(180)
    if (USE_API) {
      const { data } = await api.get('/admin/renewals', { params: { tenantId } })
      return ok(data)
    }
    const list = tenantId ? _renewals.filter(r => r.tenantId === tenantId) : [..._renewals]
    return ok(list, list.length)
  },

  // ── SuperAdmin — CRUD de Accesos ────────────────────────────────────────────

  async listAccesses({ tenantId = null, search = '' } = {}) {
    await delay(180)
    if (USE_API) {
      const { data } = await api.get('/admin/accesses', { params: { tenantId, search } })
      return ok(data)
    }
    let list = tenantId ? _accesses.filter(a => a.tenantId === tenantId) : [..._accesses]
    if (search) list = list.filter(a => a.businessName.toLowerCase().includes(search.toLowerCase()))
    return ok([...list].reverse(), list.length)
  },

  async createAccess({ tenantId, plan, billingCycle = 'monthly', accessStartDate, bonusDays = BONUS_DAYS, notes = '' }) {
    await delay(400)
    if (USE_API) {
      const { data } = await api.post('/admin/accesses', { tenantId, plan, billingCycle, accessStartDate, bonusDays, notes })
      return ok(data)
    }
    const tenant = Object.values(_tenants).find(t => t.id === tenantId)
    if (!tenant) return fail('Negocio no encontrado')

    const cycleDays = BILLING_CYCLES[billingCycle]?.days ?? 30
    const d = new Date(accessStartDate)
    d.setDate(d.getDate() + cycleDays + Number(bonusDays))
    const accessExpiresAt = d.toISOString()

    const newAccess = {
      id: `access_${_accessIdx++}`, tenantId, tenantSlug: tenant.slug,
      businessName: tenant.businessName, plan, billingCycle,
      accessStartDate, accessExpiresAt,
      bonusDays, notes, createdBy: 'superadmin', createdAt: isoNow(),
    }
    _accesses.push(newAccess)
    Object.assign(tenant, { plan, billingCycle, accessStartDate, accessExpiresAt, isActive: true })
    _flush()
    return ok(newAccess)
  },

  async updateAccess(accessId, { plan, billingCycle = 'monthly', accessStartDate, bonusDays = BONUS_DAYS, notes }) {
    await delay(400)
    if (USE_API) {
      const { data } = await api.patch(`/admin/accesses/${accessId}`, { plan, billingCycle, accessStartDate, bonusDays, notes })
      return ok(data)
    }
    const access = _accesses.find(a => a.id === accessId)
    if (!access) return fail('Registro de acceso no encontrado')

    const cycleDays = BILLING_CYCLES[billingCycle]?.days ?? 30
    const d = new Date(accessStartDate)
    d.setDate(d.getDate() + cycleDays + Number(bonusDays))
    const accessExpiresAt = d.toISOString()

    Object.assign(access, { plan, billingCycle, accessStartDate, accessExpiresAt, bonusDays, notes })
    const tenant = Object.values(_tenants).find(t => t.id === access.tenantId)
    if (tenant) Object.assign(tenant, { plan, billingCycle, accessStartDate, accessExpiresAt })
    _flush()
    return ok(access)
  },

  async deleteAccess(accessId) {
    await delay(280)
    if (USE_API) { await api.delete(`/admin/accesses/${accessId}`); return ok(null) }
    const idx = _accesses.findIndex(a => a.id === accessId)
    if (idx === -1) return fail('Registro no encontrado')
    _accesses.splice(idx, 1)
    _flush()
    return ok(null)
  },

  async getTenantOptions() {
    await delay(100)
    if (USE_API) {
      const { data } = await api.get('/admin/tenants?limit=200')
      return ok(data.items)
    }
    return ok(Object.values(_tenants).map(t => ({ id: t.id, slug: t.slug, label: t.businessName })))
  },

  // ── Precios configurables ───────────────────────────────────────────────────

  async getPrices() {
    await delay(50)
    if (USE_API) {
      const { data } = await api.get('/admin/prices')
      return ok(data)
    }
    return ok({ ..._prices })
  },

  async updatePrices(newPrices) {
    await delay(180)
    if (USE_API) {
      const { data } = await api.put('/admin/prices', newPrices)
      return ok(data)
    }
    Object.assign(_prices, newPrices)
    _save(KEYS.prices, _prices)
    return ok({ ..._prices })
  },

  // ── Configuración del sitio ─────────────────────────────────────────────────

  async getSiteSettings() {
    await delay(50)
    if (USE_API) {
      const { data } = await api.get('/admin/site-settings')
      return ok(data)
    }
    return ok({ ..._site })
  },

  async updateSiteSettings(updates) {
    await delay(180)
    if (USE_API) {
      const { data } = await api.put('/admin/site-settings', updates)
      return ok(data)
    }
    Object.assign(_site, updates)
    _save(KEYS.site, _site)
    return ok({ ..._site })
  },

  // ── Utilidad: reset del mock (solo desarrollo) ────────────────────────────
  _resetMock() {
    _tenants  = { ...DEFAULT_TENANTS }
    _accesses = [...DEFAULT_ACCESSES]
    _renewals = [...DEFAULT_RENEWALS]
    _prices   = { ...DEFAULT_PRICES }
    _site     = { ...DEFAULT_SITE_SETTINGS }
    _accessIdx  = DEFAULT_ACCESSES.length + 1
    _renewalIdx = DEFAULT_RENEWALS.length + 1
    _flush()
    _save(KEYS.prices, _prices)
    _save(KEYS.site,   _site)
  },
}
