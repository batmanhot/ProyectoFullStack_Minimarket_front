import { api, USE_API, ok, fail, gs, delay } from './_base'
import { STORAGE_KEYS } from '../config/storageKeys'
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
      const { data } = await api.post('/auth/login', { role, tenantSlug })
      localStorage.setItem(STORAGE_KEYS.authToken, data.token)
      return ok(data.user)
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
      const { data } = await api.post('/auth/login', { username, password, tenantSlug })
      localStorage.setItem(STORAGE_KEYS.authToken, data.token)
      return ok(data.user)
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
    localStorage.removeItem(STORAGE_KEYS.authToken)
    if (USE_API) await api.post('/auth/logout').catch(() => {})
    return ok(null)
  },
}
