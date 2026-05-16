// Definición de planes SaaS, ciclos de facturación y utilidades de acceso.

/** Días de bonus agregados en cada activación / renovación */
export const BONUS_DAYS = 3

// ─── Ciclos de facturación ────────────────────────────────────────────────────
export const BILLING_CYCLES = {
  monthly: {
    id: 'monthly', label: 'Mensual', shortLabel: '1 mes',
    days: 30, months: 1, discountPct: 0,
  },
  quarterly: {
    id: 'quarterly', label: 'Trimestral', shortLabel: '3 meses',
    days: 90, months: 3, discountPct: 10,
  },
  semiannual: {
    id: 'semiannual', label: 'Semestral', shortLabel: '6 meses',
    days: 180, months: 6, discountPct: 15,
  },
  annual: {
    id: 'annual', label: 'Anual', shortLabel: '12 meses',
    days: 365, months: 12, discountPct: 20,
  },
}

export const CYCLE_ORDER = ['monthly', 'quarterly', 'semiannual', 'annual']

// ─── Planes ───────────────────────────────────────────────────────────────────
export const PLANS = {
  // Módulos de infraestructura presentes en TODOS los planes.
  // El rol gate se encarga de quién puede acceder a cada uno dentro de su plan.
  // dashboard / users / settings son siempre necesarios para operar el sistema.

  trial: {
    id: 'trial', label: 'Prueba gratuita',
    description: 'Conoce el sistema sin compromiso',
    price: 0,
    features: [
      'dashboard', 'pos', 'catalog', 'inventory',
      'clients', 'cash', 'reports', 'quotations', 'returns',
      'users', 'settings', 'about',
    ],
    limits:    { products: 100, users: 1, exportData: false, multiCash: false },
    availableRoles: ['admin'],
    badge: null,
  },
  basic: {
    id: 'basic', label: 'Básico',
    description: 'Para negocios que comienzan',
    price: 49,
    features: [
      'dashboard', 'pos', 'catalog', 'inventory',
      'clients', 'cash', 'reports', 'suppliers', 'purchases', 'returns', 'quotations',
      'users', 'settings', 'about',
    ],
    limits:    { products: 500, users: 3, exportData: true, multiCash: false },
    availableRoles: ['admin', 'cajero'],
    badge: null,
  },
  pro: {
    id: 'pro', label: 'Profesional',
    description: 'Para negocios en crecimiento',
    price: 99,
    features: [
      'dashboard', 'pos', 'catalog', 'inventory',
      'clients', 'cash', 'reports', 'suppliers', 'purchases', 'returns', 'quotations',
      'discounts', 'tickets', 'loyalty', 'merma', 'trazabilidad', 'audit', 'alerts',
      'users', 'settings', 'about',
    ],
    limits:    { products: 2000, users: 10, exportData: true, multiCash: true },
    availableRoles: ['admin', 'gerente', 'supervisor', 'cajero'],
    badge: 'Más popular',
  },
  enterprise: {
    id: 'enterprise', label: 'Empresarial',
    description: 'Sin límites para grandes operaciones',
    price: 199,
    features: 'all',
    limits:    { products: null, users: null, exportData: true, multiCash: true },
    availableRoles: ['admin', 'gerente', 'supervisor', 'cajero'],
    badge: null,
  },
}

export const PLAN_ORDER = ['trial', 'basic', 'pro', 'enterprise']

// ─── Utilidades de precio ─────────────────────────────────────────────────────

/**
 * Precio mensual del plan con descuento según el ciclo.
 * trial siempre es 0.
 */
export const getPlanPrice = (planId, billingCycle = 'monthly') => {
  const base = PLANS[planId]?.price ?? 0
  if (base === 0) return 0
  const discount = BILLING_CYCLES[billingCycle]?.discountPct ?? 0
  return Math.round(base * (1 - discount / 100))
}

/**
 * Total a pagar por el ciclo completo.
 * Ej: plan Pro + trimestral = S/89 × 3 = S/267
 */
export const getTotalPrice = (planId, billingCycle = 'monthly') => {
  const monthly = getPlanPrice(planId, billingCycle)
  const months  = BILLING_CYCLES[billingCycle]?.months ?? 1
  return monthly * months
}

// ─── Utilidades de fechas de acceso ──────────────────────────────────────────

/**
 * Calcula la fecha de vencimiento de acceso.
 * Fórmula: startDate + días del ciclo + BONUS_DAYS
 *
 * @param {string|Date} startDate
 * @param {string} billingCycle — clave de BILLING_CYCLES (default: 'monthly')
 */
export const getAccessExpiry = (startDate, billingCycle = 'monthly') => {
  const cycleDays = BILLING_CYCLES[billingCycle]?.days ?? 30
  const d = new Date(startDate)
  d.setDate(d.getDate() + cycleDays + BONUS_DAYS)
  return d.toISOString()
}

/**
 * Días hasta el vencimiento (negativo = ya venció).
 */
export const daysUntilExpiry = (accessExpiresAt) => {
  if (!accessExpiresAt) return null
  return Math.ceil((new Date(accessExpiresAt) - new Date()) / (1000 * 60 * 60 * 24))
}

/**
 * Estado de acceso calculado.
 * @returns {'active'|'expiring'|'expired'|'suspended'}
 */
export const getAccessStatus = (accessExpiresAt, isActive) => {
  if (!isActive) return 'suspended'
  if (!accessExpiresAt) return 'active'
  const days = daysUntilExpiry(accessExpiresAt)
  if (days < 0)  return 'expired'
  if (days <= 7) return 'expiring'
  return 'active'
}

/** Configuración visual por estado de acceso */
export const ACCESS_STATUS_CONFIG = {
  active:    { label: 'Activo',     bg: '#f0fdf4', color: '#16a34a' },
  expiring:  { label: 'Por vencer', bg: '#fef3c7', color: '#d97706' },
  expired:   { label: 'Vencido',    bg: '#fef2f2', color: '#dc2626' },
  suspended: { label: 'Suspendido', bg: '#f1f5f9', color: '#64748b' },
}

// ─── Permisos de plan ─────────────────────────────────────────────────────────

/** ¿El plan activo permite usar esta feature? */
export const canUsePlan = (plan, feature) => {
  const cfg = PLANS[plan]
  if (!cfg) return false
  if (cfg.features === 'all') return true
  return cfg.features.includes(feature)
}

export const getPlanLimit = (plan, limitKey) =>
  PLANS[plan]?.limits?.[limitKey] ?? null

/** Roles disponibles para asignar a usuarios según el plan */
export const getPlanAvailableRoles = (plan) =>
  PLANS[plan]?.availableRoles ?? ['admin']

/** ¿El plan permite usar este rol? */
export const isPlanRoleAllowed = (plan, role) =>
  getPlanAvailableRoles(plan).includes(role)

/** Primer plan que incluye un módulo dado (para el mensaje de upgrade) */
export const getMinPlanForFeature = (feature) =>
  PLAN_ORDER.find(planId => canUsePlan(planId, feature)) ?? 'enterprise'

/** ¿El acceso está vigente? */
export const isPlanActive = (plan, accessExpiresAt) => {
  if (!accessExpiresAt) return true
  return new Date(accessExpiresAt) > new Date()
}

/** Días restantes de acceso */
export const trialDaysLeft = (accessExpiresAt) => {
  if (!accessExpiresAt) return null
  return Math.max(0, Math.ceil((new Date(accessExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
}
