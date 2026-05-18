/**
 * usePlanGate — doble verificación de acceso: plan del tenant + rol del usuario.
 *
 * Capa 1 (plan):  ¿el plan activo del negocio incluye este módulo?
 * Capa 2 (rol):   ¿el rol del usuario actual tiene permiso sobre este módulo?
 *
 * Uso:
 *   const { allowed, reason, planAllows, roleAllows } = usePlanGate('discounts')
 *
 * reason:
 *   'upgrade'    → módulo no incluido en el plan actual (necesita upgrade)
 *   'permission' → plan ok pero el rol no tiene acceso
 *   null         → acceso completo
 */

import { useTenantSafe }         from '../../context/TenantContext'
import { useStore }              from '../../store/index'
import { canUsePlan, PLANS, getMinPlanForFeature } from '../../config/plans'
import { ROLES }                 from '../../config/app'
import { getStoredPlanLimits }   from '../../services/tenantService'

export const usePlanGate = (page) => {
  const tenantCtx  = useTenantSafe()
  const plan       = tenantCtx?.plan ?? 'trial'
  const planActive = tenantCtx?.planActive ?? true
  const currentUser = useStore(s => s.currentUser)
  const role       = currentUser?.role ?? 'cajero'

  const planAllows = planActive && canUsePlan(plan, page)
  const roleAllows = (ROLES[role]?.pages ?? []).includes(page)

  const allowed = planAllows && roleAllows

  let reason = null
  if (!planAllows) reason = 'upgrade'
  else if (!roleAllows) reason = 'permission'

  return {
    allowed,
    planAllows,
    roleAllows,
    reason,
    plan,
    role,
    minPlan: planAllows ? null : getMinPlanForFeature(page),
  }
}

/**
 * Variante para verificar acceso sin un page específico —
 * útil para chequear límites (maxProducts, maxUsers, etc.)
 *
 * Merge: overrides del superadmin (localStorage) > defaults de plans.js
 * Los cambios del superadmin se aplican en el próximo render/navegación.
 */
export const usePlanLimits = () => {
  const tenantCtx = useTenantSafe()
  const plan      = tenantCtx?.plan ?? 'trial'
  const cfg       = PLANS[plan]
  const stored    = getStoredPlanLimits()
  const override  = stored[plan] ?? {}

  const maxProducts = override.products  !== undefined ? override.products  : (cfg?.limits?.products  ?? 100)
  const maxUsers    = override.users     !== undefined ? override.users     : (cfg?.limits?.users     ?? 1)

  return {
    plan,
    maxProducts,
    maxUsers,
    exportData:     cfg?.limits?.exportData ?? false,
    multiCash:      cfg?.limits?.multiCash  ?? false,
    availableRoles: cfg?.availableRoles    ?? ['admin'],
  }
}
