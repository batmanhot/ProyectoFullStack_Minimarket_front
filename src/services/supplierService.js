import { api, USE_API, ok, gs, delay } from './_base'

export const supplierService = {
  async getAll(search = '') {
    await delay(180)
    if (USE_API) { const { data } = await api.get('/suppliers', { params: { search } }); return ok(data.data) }
    let suppliers = gs().suppliers.filter(s => s.isActive !== false)
    if (search) {
      const q = search.toLowerCase()
      suppliers = suppliers.filter(s => s.name.toLowerCase().includes(q))
    }
    return ok(suppliers, suppliers.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) { const { data } = await api.post('/suppliers', payload); return ok(data.data) }
    const supplier = { ...payload, id: crypto.randomUUID(), isActive: true, createdAt: new Date().toISOString() }
    gs().addSupplier(supplier)
    return ok(supplier)
  },

  async update(id, payload) {
    await delay()
    if (USE_API) { const { data } = await api.put(`/suppliers/${id}`, payload); return ok(data.data) }
    gs().updateSupplier(id, payload)
    return ok({ id, ...payload })
  },
}
