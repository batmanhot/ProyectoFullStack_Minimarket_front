import { createContext, useContext } from 'react'

export const TenantContext = createContext(null)

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) throw new Error('useTenant debe usarse dentro de <TenantProvider>')
  return context
}

export function useTenantSafe() {
  return useContext(TenantContext)
}
