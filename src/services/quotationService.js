import { api, USE_API, ok, fail, delay } from './_base'

const LS_KEY = 'pos_quotations'
const lsGet  = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] } }
const lsSet  = (list) => localStorage.setItem(LS_KEY, JSON.stringify(list))

export const quotationService = {
  async getAll(filters = {}) {
    await delay(100)
    if (USE_API) {
      try {
        const { data } = await api.get('/quotations', { params: filters })
        return ok(data.data, data.meta?.total)
      } catch (err) { return fail(err.message) }
    }
    let list = lsGet()
    if (filters.status) list = list.filter(q => q.status === filters.status)
    if (filters.search) {
      const s = filters.search.toLowerCase()
      list = list.filter(q => q.number?.includes(s) || q.clientName?.toLowerCase().includes(s))
    }
    return ok(list, list.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.post('/quotations', payload)
        return ok(data.data)
      } catch (err) { return fail(err.message || 'Error al crear cotización') }
    }
    const q = { ...payload, id: crypto.randomUUID(), status: payload.status || 'borrador', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    lsSet([q, ...lsGet()])
    return ok(q)
  },

  async update(id, updates) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.put(`/quotations/${id}`, updates)
        return ok(data.data)
      } catch (err) { return fail(err.message || 'Error al actualizar cotización') }
    }
    const list = lsGet()
    const updated = list.map(q => q.id === id ? { ...q, ...updates, updatedAt: new Date().toISOString() } : q)
    lsSet(updated)
    return ok(updated.find(q => q.id === id))
  },

  async changeStatus(id, status) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.patch(`/quotations/${id}/status`, { status })
        return ok(data.data)
      } catch (err) { return fail(err.message || 'Error al cambiar estado') }
    }
    return this.update(id, { status })
  },

  async remove(id) {
    await delay()
    if (USE_API) {
      try {
        await api.delete(`/quotations/${id}`)
        return ok({ id, deleted: true })
      } catch (err) { return fail(err.message || 'Error al eliminar cotización') }
    }
    lsSet(lsGet().filter(q => q.id !== id))
    return ok({ id, deleted: true })
  },
}
