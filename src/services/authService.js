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
      // En modo API los botones rápidos usan las credenciales del seed
      const DEMO_CREDS = {
        admin:      { username: 'admin@demo.com', password: 'admin123'   },
        gerente:    { username: 'gerente',         password: 'gerente123' },
        supervisor: { username: 'cajero',          password: 'cajero123'  },
        cajero:     { username: 'cajero',          password: 'cajero123'  },
      }
      const creds = DEMO_CREDS[role] ?? DEMO_CREDS.cajero
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
        localStorage.setItem(STORAGE_KEYS.authToken, data.token)
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
    localStorage.removeItem(STORAGE_KEYS.authToken)
    if (USE_API) await api.post('/auth/logout').catch(() => {})
    return ok(null)
  },
}
