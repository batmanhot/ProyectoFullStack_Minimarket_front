import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { tenantService } from '../services/tenantService'
import { isPlanActive, trialDaysLeft, getAccessStatus } from '../config/plans'
import { useStore } from '../store/index'
import { TenantContext } from './tenantContext.shared'

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
  const [loading, setLoading] = useState(() => Boolean(tenantSlug))
  const [error, setError]     = useState(null)
  const updateBusinessConfig  = useStore(s => s.updateBusinessConfig)
  const currentUser           = useStore(s => s.currentUser)

  useEffect(() => {
    if (!tenantSlug) return undefined

    let cancelled = false

    const isAuthenticatedTenant = currentUser?.tenantId && currentUser.tenantSlug === tenantSlug
    const tenantRequest = isAuthenticatedTenant
      ? tenantService.getCurrent()
      : tenantService.getBySlug(tenantSlug)

    tenantRequest.then((result) => {
      if (cancelled) return
      if (result.data) {
        setTenant(result.data)
        // Propagar nombre real del negocio a todo el store (Sidebar, tickets, etiquetas, recibos)
        const t = result.data
        updateBusinessConfig({
          name:    t.businessName ?? '',
          ruc:     t.ruc         ?? '',
          phone:   t.phone       ?? '',
          email:   t.ownerEmail  ?? '',
          sector:  t.sector      ?? 'bodega',
        })
      } else {
        setError(result.error ?? 'Negocio no encontrado')
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [tenantSlug, currentUser?.tenantId, currentUser?.tenantSlug, updateBusinessConfig])

  const plan         = tenant?.plan ?? 'trial'
  const planActive   = isPlanActive(plan, tenant?.accessExpiresAt)
  const daysLeft     = trialDaysLeft(tenant?.accessExpiresAt)
  const accessStatus = getAccessStatus(tenant?.accessExpiresAt, tenant?.isActive ?? true)

  return (
    <TenantContext.Provider value={{
      tenant, tenantSlug, plan, planActive, daysLeft, accessStatus, loading, error,
    }}>
      {children}
    </TenantContext.Provider>
  )
}
