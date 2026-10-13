import { api, USE_API, ok, fail, gs, delay } from './_base'
import { tenantService } from './tenantService'

export const authService = {
  /**
   * Login por rol (demo rápido) o por credenciales reales.
   * En modo API el backend devuelve:
   *   { token, user: { id, fullName, role, tenantId, tenantSlug, plan, ... } }
   *
   * @param {string} role        — rol para login demo
   * @param {string} tenantSlug  — slug del workspace activo (desde la URL)
   */
  async login(role, tenantSlug = 'demo') {
    await delay(350)
    if (USE_API) {
      // El tenant efímero E2E se habilita únicamente en el proceso que
      // Playwright inicia con VITE_E2E=true. Nunca existe en un build normal.
      const isE2ETenant = import.meta.env.VITE_E2E === 'true' && tenantSlug === 'e2e'
      if (tenantSlug !== 'demo' && !isE2ETenant) {
        return fail('El acceso rápido solo está disponible para el entorno demo')
      }
      // Las credenciales demo se inyectan solo en .env.development. No deben
      // existir como literales en el bundle de producción.
      const DEMO_CREDS = {
        admin:      { username: import.meta.env.VITE_DEMO_ADMIN_USER,   password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD },
        gerente:    { username: import.meta.env.VITE_DEMO_MANAGER_USER, password: import.meta.env.VITE_DEMO_MANAGER_PASSWORD },
        supervisor: { username: import.meta.env.VITE_DEMO_CASHIER_USER, password: import.meta.env.VITE_DEMO_CASHIER_PASSWORD },
        cajero:     { username: import.meta.env.VITE_DEMO_CASHIER_USER, password: import.meta.env.VITE_DEMO_CASHIER_PASSWORD },
      }
      const creds = DEMO_CREDS[role] ?? DEMO_CREDS.cajero
      if (!creds.username || !creds.password) {
        return fail('Las credenciales demo no están configuradas para este entorno')
      }
      return this.loginWithCredentials(creds.username, creds.password, tenantSlug)
    }
    const user = gs().users.find(u => u.role === role && u.isActive)
    if (!user) return fail('Usuario no encontrado')
    const tenantResult = await tenantService.getBySlug(tenantSlug)
    const plan = tenantResult.data?.plan ?? 'trial'
    return ok({
      ...user,
      tenantId:   `tenant_${tenantSlug}`,
      tenantSlug,
      plan,
    })
  },

  /**
   * Login con credenciales (usuario + contraseña).
   * Este es el flujo real de producción.
   *
   * @param {string} username
   * @param {string} password
   * @param {string} tenantSlug
   */
  async loginWithCredentials(username, password, tenantSlug = 'demo') {
    await delay(350)
    if (USE_API) {
      try {
        const { data } = await api.post('/auth/login', { username, password, tenantSlug })
        return ok(data.user)
      } catch (err) {
        return fail(err.response?.data?.message || err.message || 'No se pudo conectar con el servidor')
      }
    }
    const user = gs().users.find(u => u.username === username && u.isActive)
    if (!user) return fail('Usuario o contraseña incorrectos')
    if (user.password && user.password !== password) return fail('Usuario o contraseña incorrectos')
    const tenantResult = await tenantService.getBySlug(tenantSlug)
    const plan = tenantResult.data?.plan ?? 'trial'
    return ok({
      ...user,
      tenantId:   `tenant_${tenantSlug}`,
      tenantSlug,
      plan,
    })
  },

  async logout() {
    if (USE_API) await api.post('/auth/logout').catch(() => {})
    return ok(null)
  },
}
