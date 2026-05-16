import { api, USE_API, ok, fail, gs, delay } from './_base'

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
      const { data } = await api.post('/auth/login', { role, tenantSlug })
      localStorage.setItem('mm_token', data.token)
      return ok(data.user)
    }
    const user = gs().users.find(u => u.role === role && u.isActive)
    if (!user) return fail('Usuario no encontrado')
    // En modo mock enriquecemos el user con los campos de tenant que el
    // backend devolvería en producción dentro del JWT.
    return ok({
      ...user,
      tenantId:   `tenant_${tenantSlug}`,
      tenantSlug,
      plan:       'pro',
    })
  },

  /**
   * Login con credenciales (usuario + contraseña).
   * Este es el flujo real de producción.
   *
   * @param {string} username
   * @param {string} tenantSlug
   */
  async loginWithCredentials(username, tenantSlug = 'demo') {
    await delay(350)
    if (USE_API) {
      const { data } = await api.post('/auth/login', { username, tenantSlug })
      localStorage.setItem('mm_token', data.token)
      return ok(data.user)
    }
    const user = gs().users.find(u => u.username === username && u.isActive)
    if (!user) return fail('Usuario o contraseña incorrectos')
    return ok({
      ...user,
      tenantId:   `tenant_${tenantSlug}`,
      tenantSlug,
      plan:       'pro',
    })
  },

  async logout() {
    localStorage.removeItem('mm_token')
    if (USE_API) await api.post('/auth/logout').catch(() => {})
    return ok(null)
  },
}
