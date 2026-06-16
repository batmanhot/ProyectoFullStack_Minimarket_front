import { api, USE_API, ok, gs, delay } from './_base'

const _tryApi = async (fn) => {
  try { return await fn() } catch (_) { return null }
}

export const supplierService = {
  async getAll(search = '') {
    await delay(180)
    if (USE_API) {
      const res = await _tryApi(async () => {
        const { data } = await api.get('/suppliers', { params: { search } })
        if (!search) gs().setSuppliers(data.data)
        return ok(data.data)
      })
      if (res) return res
    }
    let suppliers = gs().suppliers.filter(s => s.isActive !== false)
    if (search) {
      const q = search.toLowerCase()
      suppliers = suppliers.filter(s => s.name.toLowerCase().includes(q))
    }
    return ok(suppliers, suppliers.length)
  },

  async create(payload) {
    await delay()
    const supplier = { ...payload, id: crypto.randomUUID(), isActive: true, createdAt: new Date().toISOString() }
    if (USE_API) await _tryApi(() => api.post('/suppliers', supplier))
    gs().addSupplier(supplier)
    return ok(supplier)
  },

  async update(id, payload) {
    await delay()
    if (USE_API) await _tryApi(() => api.put(`/suppliers/${id}`, payload))
    gs().updateSupplier(id, payload)
    return ok({ id, ...payload })
  },
}
