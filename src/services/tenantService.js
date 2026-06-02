import { api, USE_API, ok, fail, delay } from './_base'
import { getAccessExpiry, BONUS_DAYS, BILLING_CYCLES } from '../config/plans'
import { PLAN_LIMITS } from '../config/planLimits'
import { STORAGE_KEYS } from '../config/storageKeys'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isoNow   = ()     => new Date().toISOString()
const toIsoDate = (date) => {
  if (!date) return null
  return date.includes('T') ? date : new Date(`${date}T00:00:00`).toISOString()
}
export const makeSlug = (name) => name.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

// ─── Persistencia mock en localStorage ───────────────────────────────────────
const KEYS = {
  tenants:         STORAGE_KEYS.mockTenants,
  accesses:        STORAGE_KEYS.mockAccesses,
  renewals:        STORAGE_KEYS.mockRenewals,
  prices:          STORAGE_KEYS.mockPrices,
  site:            STORAGE_KEYS.mockSite,
  limits:          STORAGE_KEYS.mockPlanLimits,
  alertThresholds: STORAGE_KEYS.mockAlertThresholds,
}

const _load = (key) => {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null } catch { return null }
}
const _save = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}

// ─── Fechas demo ──────────────────────────────────────────────────────────────
const START_DEMO   = '2026-05-01T00:00:00Z'
const START_TIENDA = '2026-05-15T00:00:00Z'

// ─── Tenants por defecto ──────────────────────────────────────────────────────
const DEFAULT_TENANTS = {
  demo: {
    id: 'tenant_demo', slug: 'demo',
    businessName: 'Bodega Demo', sector: 'bodega',
    ruc: '20000000001',
    ownerName: 'Administrador Demo', ownerEmail: 'demo@minimarket.app',
    phone: '999 000 001', ownerPassword: 'demo1234',
    plan: 'pro', billingCycle: 'monthly',
    accessStartDate: START_DEMO,
    accessExpiresAt: getAccessExpiry(START_DEMO, 'monthly'),
    isActive: true,
    registrationSource: 'superadmin',
    internalNotes: 'Negocio demo del sistema. Acceso siempre renovado automáticamente.',
    systemVersion: 'MiniMarket POS v1.0',
    createdAt: '2025-01-01T00:00:00Z',
  },
  'mi-tienda': {
    id: 'tenant_001', slug: 'mi-tienda',
    businessName: 'Mi Tienda', sector: 'bodega',
    ruc: '20111222333',
    ownerName: 'Juan Pérez', ownerEmail: 'juan@mitienda.com',
    phone: '987 654 321', ownerPassword: 'tienda123',
    plan: 'trial', billingCycle: 'monthly',
    accessStartDate: START_TIENDA,
    accessExpiresAt: getAccessExpiry(START_TIENDA, 'monthly'),
    isActive: true,
    registrationSource: 'self-service',
    internalNotes: 'Cliente Demo — Plan Prueba Gratuita activo 30 días por defecto.',
    systemVersion: 'MiniMarket POS v1.0',
    createdAt: '2025-03-14T00:00:00Z',
  },
}

// ─── Accesos por defecto ──────────────────────────────────────────────────────
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

// ─── Renovaciones por defecto ─────────────────────────────────────────────────
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

// ─── Precios configurables ────────────────────────────────────────────────────
const DEFAULT_PRICES = { basic: 49, pro: 99, enterprise: 199 }

// Alias exportado para compatibilidad con SuperAdmin (que lo importa por este nombre)
export { PLAN_LIMITS as DEFAULT_PLAN_LIMITS }

// ─── Umbrales de alerta ────────────────────────────────────────────────────────
export const DEFAULT_ALERT_THRESHOLDS = {
  warning:  7,
  urgent:   3,
  critical: 1,
}

// ─── Configuración del sitio / landing (v2 — campos expandidos) ───────────────
export const DEFAULT_SITE_SETTINGS = {
  // Marca
  brandName:    'MiniMarket POS',
  tagline:      'Sistema POS para retail minorista en Perú',
  description:  'Sistema de punto de venta diseñado para bodegas y minimarkets del Perú. Gestiona ventas, inventario y clientes desde un solo lugar.',
  primaryColor: '#00c896',
  logoUrl:      '',
  systemVersion: 'v1.0',
  // Contacto
  phone:        '',
  whatsapp:     '',
  email:        '',
  address:      '',
  // Redes sociales
  facebook:     '',
  instagram:    '',
  tiktok:       '',
  // Sección Hero
  heroTitle:    'Gestiona tu tienda con inteligencia',
  heroSubtitle: 'POS moderno para bodegas y minimarkets del Perú',
  heroCta:      'Empezar gratis',
  heroImage:    '',
  // SEO & Footer
  metaTitle:    'MiniMarket POS — Sistema de Punto de Venta',
  metaDesc:     'Sistema POS para retail minorista en Perú.',
  footerText:   '© 2025 MiniMarket POS. Todos los derechos reservados.',
}

// ─── Estado mutable persistido ────────────────────────────────────────────────
let _tenants         = _load(KEYS.tenants)         ?? { ...DEFAULT_TENANTS }
let _accesses        = _load(KEYS.accesses)        ?? [...DEFAULT_ACCESSES]
let _renewals        = _load(KEYS.renewals)        ?? [...DEFAULT_RENEWALS]
let _prices          = _load(KEYS.prices)          ?? { ...DEFAULT_PRICES }
let _site            = _load(KEYS.site)            ?? { ...DEFAULT_SITE_SETTINGS }
let _limits          = _load(KEYS.limits)          ?? JSON.parse(JSON.stringify(PLAN_LIMITS))
let _alertThresholds = _load(KEYS.alertThresholds) ?? { ...DEFAULT_ALERT_THRESHOLDS }

// Migrar registros existentes con campos faltantes (retrocompat)
Object.values(_tenants).forEach(t => {
  if (!t.ruc)           t.ruc           = ''
  if (!t.ownerPassword) t.ownerPassword = ''
  if (!t.internalNotes) t.internalNotes = ''
  if (!t.systemVersion) t.systemVersion = 'MiniMarket POS v1.0'
  if (!t.phone)         t.phone         = ''
  if (!t.createdAt)     t.createdAt     = t.accessStartDate ?? isoNow()
  if (!t.accessExpiresAt) t.accessExpiresAt = getAccessExpiry(t.accessStartDate ?? t.createdAt, t.billingCycle ?? 'monthly')
})

let _accessIdx  = Math.max(0, ..._accesses.map(a => parseInt(a.id.split('_')[1]) || 0)) + 1
let _renewalIdx = Math.max(0, ..._renewals.map(r => parseInt(r.id.split('_')[1]) || 0)) + 1

const _flush = () => {
  _save(KEYS.tenants,  _tenants)
  _save(KEYS.accesses, _accesses)
  _save(KEYS.renewals, _renewals)
}

// Lectura sincrónica para componentes que no pueden usar async
export const getStoredPrices           = () => _load(KEYS.prices)          ?? { ...DEFAULT_PRICES }
export const getStoredSiteSettings     = () => _load(KEYS.site)            ?? { ...DEFAULT_SITE_SETTINGS }
export const getStoredPlanLimits       = () => _load(KEYS.limits)          ?? JSON.parse(JSON.stringify(PLAN_LIMITS))
export const getStoredAlertThresholds  = () => _load(KEYS.alertThresholds) ?? { ...DEFAULT_ALERT_THRESHOLDS }

// ─── Servicio ─────────────────────────────────────────────────────────────────
export const tenantService = {

  // ── App (tenant context) ────────────────────────────────────────────────────

  async getBySlug(slug) {
    await delay(100)
    if (USE_API) {
      const { data } = await api.get(`/tenants/${slug}`)
      return ok(data)
    }
    const tenant = _tenants[slug] ?? _tenants.demo
    // Retornar el tenant tal cual está guardado, respetando accessExpiresAt de SuperAdmin
    return ok(tenant)
  },

  // ── Registro self-service ───────────────────────────────────────────────────

  async register({ businessName, sector, ownerName, ownerEmail, phone = '', password, plan = 'trial', billingCycle = 'monthly' }) {
    await delay(600)
    if (USE_API) {
      const { data } = await api.post('/tenants/register', { businessName, sector, ownerName, ownerEmail, phone, password, plan, billingCycle })
      return ok(data)
    }

    const slug            = makeSlug(businessName)
    const tenantId        = `tenant_${Date.now()}`
    const accessStartDate = isoNow()
    const accessExpiresAt = getAccessExpiry(accessStartDate, billingCycle)
    const ownerPassword   = password

    _tenants[slug] = {
      id:               tenantId,
      slug,
      businessName,
      sector,
      ruc:              '',
      ownerName,
      ownerEmail,
      phone,
      ownerPassword,
      plan,
      billingCycle,
      accessStartDate,
      accessExpiresAt,
      isActive:         true,
      registrationSource: 'self-service',
      internalNotes:    '',
      systemVersion:    'MiniMarket POS v1.0',
      createdAt:        accessStartDate,
    }

    const accessId = `access_${_accessIdx++}`
    _accesses.push({
      id: accessId, tenantId, tenantSlug: slug,
      businessName, sector, ownerName, ownerEmail, phone,
      plan, billingCycle,
      accessStartDate, accessExpiresAt,
      bonusDays: BONUS_DAYS,
      notes: 'Registro inicial self-service',
      createdBy: 'self-register', createdAt: accessStartDate,
    })

    _renewals.unshift({
      id: `renew_${_renewalIdx++}`, tenantId, businessName,
      previousPlan: null, newPlan: plan,
      billingCycle,
      accessStartDate, accessExpiresAt,
      renewedBy: 'self-register', renewedAt: accessStartDate,
      notes: 'Activación inicial — registro self-service',
    })

    _flush()
    return ok({ slug, tenantId, businessName, ownerEmail, plan, billingCycle, accessStartDate, accessExpiresAt })
  },

  async checkSlugAvailable(slug) {
    await delay(100)
    if (USE_API) {
      const { data } = await api.get(`/tenants/check-slug/${slug}`)
      return ok(data.available)
    }
    return ok(!(slug in _tenants))
  },

  async updateConfig(tenantId, config) {
    await delay(300)
    if (USE_API) {
      const { data } = await api.patch(`/tenants/${tenantId}/config`, config)
      return ok(data)
    }
    const tenant = Object.values(_tenants).find(t => t.id === tenantId)
    if (tenant) { Object.assign(tenant, config); _flush() }
    return ok({ ...config, updatedAt: isoNow() })
  },

  // ── SuperAdmin — CRUD de Negocios ───────────────────────────────────────────

  async listAll({ search = '' } = {}) {
    await delay(100)
    if (USE_API) {
      const { data } = await api.get('/admin/tenants', { params: { search } })
      return ok(data.items, data.total)
    }
    const all = Object.values(_tenants)
    const filtered = search
      ? all.filter(t =>
          t.businessName.toLowerCase().includes(search.toLowerCase()) ||
          t.slug.includes(search.toLowerCase()) ||
          (t.ruc ?? '').includes(search) ||
          (t.ownerEmail ?? '').toLowerCase().includes(search.toLowerCase())
        )
      : all
    return ok(filtered, filtered.length)
  },

  async superadminCreateTenant({
    businessName, sector = 'bodega', ownerName = '', ownerEmail = '',
    phone = '', ownerPassword = '', ruc = '',
    plan = 'trial', billingCycle = 'monthly', accessStartDate = null,
    accessExpiresAt = null, createdAt = null,
    internalNotes = '', systemVersion = 'MiniMarket POS v1.0', isActive = true,
  }) {
    await delay(300)
    if (USE_API) {
      const { data } = await api.post('/admin/tenants', {
        businessName, sector, ownerName, ownerEmail, phone, ownerPassword, ruc,
        plan, billingCycle, accessStartDate, accessExpiresAt, createdAt,
        internalNotes, systemVersion, isActive,
      })
      return ok(data)
    }

    const slug = makeSlug(businessName)
    if (_tenants[slug]) return fail(`El slug "${slug}" ya está en uso. Prueba con un nombre diferente.`)
    if (!businessName.trim()) return fail('El nombre del negocio es obligatorio')
    if (!ownerEmail.trim()) return fail('El email del propietario es obligatorio')

    const tenantId = `tenant_${Date.now()}`
    const start = toIsoDate(accessStartDate) ?? isoNow()
    const expiry = toIsoDate(accessExpiresAt) ?? getAccessExpiry(start, billingCycle)
    const created = toIsoDate(createdAt) ?? isoNow()

    _tenants[slug] = {
      id: tenantId, slug, businessName, sector, ruc,
      ownerName, ownerEmail, phone, ownerPassword,
      plan, billingCycle,
      accessStartDate: start, accessExpiresAt: expiry,
      isActive,
      registrationSource: 'superadmin',
      internalNotes, systemVersion,
      createdAt: created,
    }

    _accesses.push({
      id: `access_${_accessIdx++}`, tenantId, tenantSlug: slug,
      businessName, plan, billingCycle,
      accessStartDate: start, accessExpiresAt: expiry,
      bonusDays: BONUS_DAYS,
      notes: internalNotes || 'Creado por superadmin',
      createdBy: 'superadmin', createdAt: isoNow(),
    })

    _renewals.unshift({
      id: `renew_${_renewalIdx++}`, tenantId, businessName,
      previousPlan: null, newPlan: plan,
      accessStartDate: start, accessExpiresAt: expiry,
      renewedBy: 'superadmin', renewedAt: isoNow(),
      notes: 'Activación inicial por superadmin',
    })

    _flush()
    return ok({ ..._tenants[slug] })
  },

  async superadminUpdateTenant(tenantId, updates) {
    await delay(300)
    if (USE_API) {
      const { data } = await api.patch(`/admin/tenants/${tenantId}`, updates)
      return ok(data)
    }

    const tenant = Object.values(_tenants).find(t => t.id === tenantId)
    if (!tenant) return fail('Negocio no encontrado')

    const allowed = [
      'businessName', 'sector', 'ruc', 'ownerName', 'ownerEmail',
      'phone', 'ownerPassword', 'plan', 'billingCycle', 'isActive',
      'accessStartDate', 'accessExpiresAt', 'createdAt',
      'internalNotes', 'systemVersion',
    ]
    allowed.forEach(key => {
      if (!(key in updates)) return
      tenant[key] = ['accessStartDate', 'accessExpiresAt', 'createdAt'].includes(key)
        ? (toIsoDate(updates[key]) ?? tenant[key])
        : updates[key]
    })

    // Recalcular vencimiento si cambió la fecha inicio o el ciclo
    if (!('accessExpiresAt' in updates) && ('accessStartDate' in updates || 'billingCycle' in updates)) {
      tenant.accessExpiresAt = getAccessExpiry(tenant.accessStartDate, tenant.billingCycle)
    }

    _flush()
    return ok({ ...tenant })
  },

  async superadminDeleteTenant(tenantId) {
    await delay(300)
    if (USE_API) { await api.delete(`/admin/tenants/${tenantId}`); return ok(null) }

    const slug = Object.keys(_tenants).find(s => _tenants[s].id === tenantId)
    if (!slug) return fail('Negocio no encontrado')

    delete _tenants[slug]
    _accesses = _accesses.filter(a => a.tenantId !== tenantId)
    _renewals = _renewals.filter(r => r.tenantId !== tenantId)
    _flush()
    return ok(null)
  },

  async setActive(tenantId, isActive) {
    await delay(300)
    if (USE_API) await api.patch(`/admin/tenants/${tenantId}/status`, { isActive })
    const tenant = Object.values(_tenants).find(t => t.id === tenantId)
    if (tenant) { tenant.isActive = isActive; _flush() }
    return ok({ tenantId, isActive })
  },

  // ── SuperAdmin — Renovaciones ───────────────────────────────────────────────

  async renewAccess(tenantId, { plan, billingCycle = 'monthly', startMode = 'today', notes = '' }) {
    await delay(300)
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
    await delay(100)
    if (USE_API) {
      const { data } = await api.get('/admin/renewals', { params: { tenantId } })
      return ok(data)
    }
    const list = tenantId ? _renewals.filter(r => r.tenantId === tenantId) : [..._renewals]
    return ok(list, list.length)
  },

  // ── SuperAdmin — CRUD de Accesos ────────────────────────────────────────────

  async listAccesses({ tenantId = null, search = '' } = {}) {
    await delay(100)
    if (USE_API) {
      const { data } = await api.get('/admin/accesses', { params: { tenantId, search } })
      return ok(data)
    }
    let list = tenantId ? _accesses.filter(a => a.tenantId === tenantId) : [..._accesses]
    if (search) list = list.filter(a => a.businessName.toLowerCase().includes(search.toLowerCase()))
    return ok([...list].reverse(), list.length)
  },

  async createAccess({ tenantId, plan, billingCycle = 'monthly', accessStartDate, bonusDays = BONUS_DAYS, notes = '' }) {
    await delay(300)
    if (USE_API) {
      const { data } = await api.post('/admin/accesses', { tenantId, plan, billingCycle, accessStartDate, bonusDays, notes })
      return ok(data)
    }
    const tenant = Object.values(_tenants).find(t => t.id === tenantId)
    if (!tenant) return fail('Negocio no encontrado')

    const accessExpiresAt = getAccessExpiry(accessStartDate, billingCycle, Number(bonusDays))

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
    await delay(300)
    if (USE_API) {
      const { data } = await api.patch(`/admin/accesses/${accessId}`, { plan, billingCycle, accessStartDate, bonusDays, notes })
      return ok(data)
    }
    const access = _accesses.find(a => a.id === accessId)
    if (!access) return fail('Registro de acceso no encontrado')

    const accessExpiresAt = getAccessExpiry(accessStartDate, billingCycle, Number(bonusDays))

    Object.assign(access, { plan, billingCycle, accessStartDate, accessExpiresAt, bonusDays, notes })
    const tenant = Object.values(_tenants).find(t => t.id === access.tenantId)
    if (tenant) Object.assign(tenant, { plan, billingCycle, accessStartDate, accessExpiresAt })
    _flush()
    return ok(access)
  },

  async deleteAccess(accessId) {
    await delay(300)
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
    await delay(100)
    if (USE_API) { const { data } = await api.get('/admin/prices'); return ok(data) }
    return ok({ ..._prices })
  },

  async updatePrices(newPrices) {
    await delay(300)
    if (USE_API) { const { data } = await api.put('/admin/prices', newPrices); return ok(data) }
    Object.assign(_prices, newPrices)
    _save(KEYS.prices, _prices)
    return ok({ ..._prices })
  },

  // ── Límites por plan ────────────────────────────────────────────────────────

  async getLimits() {
    await delay(100)
    if (USE_API) { const { data } = await api.get('/admin/plan-limits'); return ok(data) }
    return ok(JSON.parse(JSON.stringify(_limits)))
  },

  async updateLimits(newLimits) {
    await delay(300)
    if (USE_API) { const { data } = await api.put('/admin/plan-limits', newLimits); return ok(data) }
    _limits = JSON.parse(JSON.stringify(newLimits))
    _save(KEYS.limits, _limits)
    return ok(JSON.parse(JSON.stringify(_limits)))
  },

  // ── Configuración del sitio ─────────────────────────────────────────────────

  async getSiteSettings() {
    await delay(100)
    if (USE_API) { const { data } = await api.get('/admin/site-settings'); return ok(data) }
    return ok({ ...DEFAULT_SITE_SETTINGS, ..._site })
  },

  async updateSiteSettings(updates) {
    await delay(300)
    if (USE_API) { const { data } = await api.put('/admin/site-settings', updates); return ok(data) }
    Object.assign(_site, updates)
    _save(KEYS.site, _site)
    return ok({ ...DEFAULT_SITE_SETTINGS, ..._site })
  },

  // ── Umbrales de alerta ──────────────────────────────────────────────────────

  async getAlertThresholds() {
    await delay(100)
    if (USE_API) { const { data } = await api.get('/admin/alert-thresholds'); return ok(data) }
    return ok({ ..._alertThresholds })
  },

  async updateAlertThresholds(thresholds) {
    await delay(300)
    if (USE_API) { const { data } = await api.put('/admin/alert-thresholds', thresholds); return ok(data) }
    if (thresholds.critical < 1 || thresholds.urgent < 1 || thresholds.warning < 1)
      return fail('Todos los umbrales deben ser al menos 1 día')
    if (!(thresholds.critical < thresholds.urgent && thresholds.urgent < thresholds.warning))
      return fail('Debe cumplirse: Crítico < Urgente < Aviso')
    Object.assign(_alertThresholds, thresholds)
    _save(KEYS.alertThresholds, _alertThresholds)
    return ok({ ..._alertThresholds })
  },

  // ── Reset del mock (solo desarrollo) ────────────────────────────────────────
  _resetMock() {
    _tenants         = JSON.parse(JSON.stringify(DEFAULT_TENANTS))
    _accesses        = JSON.parse(JSON.stringify(DEFAULT_ACCESSES))
    _renewals        = JSON.parse(JSON.stringify(DEFAULT_RENEWALS))
    _prices          = { ...DEFAULT_PRICES }
    _site            = { ...DEFAULT_SITE_SETTINGS }
    _limits          = JSON.parse(JSON.stringify(PLAN_LIMITS))
    _alertThresholds = { ...DEFAULT_ALERT_THRESHOLDS }
    _accessIdx  = DEFAULT_ACCESSES.length + 1
    _renewalIdx = DEFAULT_RENEWALS.length + 1
    _flush()
    _save(KEYS.prices,          _prices)
    _save(KEYS.site,            _site)
    _save(KEYS.limits,          _limits)
    _save(KEYS.alertThresholds, _alertThresholds)
  },
}
