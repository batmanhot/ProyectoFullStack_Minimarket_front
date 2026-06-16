import { api, USE_API, ok, fail, gs, delay } from './_base'

export const auditService = {
  async getAll(filters = {}) {
    await delay(100)
    if (USE_API) {
      try {
        const { data } = await api.get('/audit', { params: filters })
        return ok(data.data, data.meta?.total)
      } catch (err) { return fail(err.message) }
    }
    let logs = gs().auditLog || []
    if (filters.search) {
      const q = filters.search.toLowerCase()
      logs = logs.filter(l => l.detail?.toLowerCase().includes(q) || l.userName?.toLowerCase().includes(q))
    }
    if (filters.action) logs = logs.filter(l => l.action === filters.action)
    return ok(logs, logs.length)
  },

  async log(action, entity, entityId = '', detail = '') {
    if (USE_API) {
      try {
        await api.post('/audit', { action, entity, entityId: String(entityId), detail })
      } catch (_) {}
    }
  },
}
