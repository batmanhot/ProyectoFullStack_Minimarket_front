import { api, USE_API, ok, fail, gs, delay } from './_base'

export const mermaService = {
  async getAll(filters = {}) {
    await delay(100)
    if (USE_API) {
      try {
        const { data } = await api.get('/merma', { params: filters })
        gs().setMermaRecords(data.data)
        return ok(data.data, data.meta?.total)
      } catch (err) { return fail(err.message) }
    }
    let records = gs().mermaRecords || []
    if (filters.status) records = records.filter(r => r.status === filters.status)
    if (filters.search) {
      const q = filters.search.toLowerCase()
      records = records.filter(r => r.productName?.toLowerCase().includes(q))
    }
    return ok(records, records.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.post('/merma', payload)
        gs().addMermaRecord(data.data)
        return ok(data.data)
      } catch (err) { return fail(err.message || 'Error al registrar merma') }
    }
    const record = { ...payload, id: crypto.randomUUID(), status: 'en_merma', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    gs().addMermaRecord(record)
    return ok(record)
  },

  async updateStatus(id, status) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.patch(`/merma/${id}/status`, { status })
        gs().updateMermaRecord(id, data.data)
        return ok(data.data)
      } catch (err) { return fail(err.message || 'Error al actualizar estado') }
    }
    gs().updateMermaRecord(id, { status })
    return ok({ id, status })
  },
}
