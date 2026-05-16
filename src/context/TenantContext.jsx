import { createContext, useContext, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { tenantService } from '../services/tenantService'
import { isPlanActive, trialDaysLeft } from '../config/plans'

const TenantContext = createContext(null)

/**
 * Proveedor de contexto de tenant.
 * Debe envolver el layout de la app de cada negocio
 * (se renderiza dentro de <Route path="/app/:tenantSlug/*">).
 *
 * Expone:
 *   tenant        — datos del negocio del backend
 *   tenantSlug    — slug de la URL (:tenantSlug)
 *   plan          — plan activo del tenant
 *   planActive    — boolean: ¿el plan está vigente?
 *   daysLeft      — días restantes de trial (null si no aplica)
 *   loading       — true mientras resuelve el tenant
 *   error         — mensaje de error si el tenant no existe
 */
export function TenantProvider({ children }) {
  const { tenantSlug } = useParams()
  const [tenant, setTenant]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!tenantSlug) { setLoading(false); return }

    let cancelled = false
    setLoading(true)
    setError(null)

    tenantService.getBySlug(tenantSlug).then((result) => {
      if (cancelled) return
      if (result.data) setTenant(result.data)
      else setError(result.error ?? 'Negocio no encontrado')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [tenantSlug])

  const plan      = tenant?.plan ?? 'trial'
  const planActive = isPlanActive(plan, tenant?.trialEndsAt)
  const daysLeft   = trialDaysLeft(tenant?.trialEndsAt)

  return (
    <TenantContext.Provider value={{
      tenant, tenantSlug, plan, planActive, daysLeft, loading, error,
    }}>
      {children}
    </TenantContext.Provider>
  )
}

/** Hook con validación — úsalo dentro de TenantProvider */
export const useTenant = () => {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant debe usarse dentro de <TenantProvider>')
  return ctx
}

/** Hook seguro — devuelve null si está fuera del provider (para componentes compartidos) */
export const useTenantSafe = () => useContext(TenantContext)
