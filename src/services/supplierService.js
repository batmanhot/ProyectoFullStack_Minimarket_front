import { api, USE_API, ok, fail, gs, delay } from './_base'

export const supplierService = {
  async getAll(search = '') {
    await delay(180)
    if (USE_API) {
      try {
        const { data } = await api.get('/suppliers', { params: { search } })
        if (!search) gs().setSuppliers(data.data)
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al obtener proveedores')
      }
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
    if (USE_API) {
      try {
        const { data } = await api.post('/suppliers', payload)
        gs().addSupplier(data.data)
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al crear proveedor')
      }
    }
    const supplier = { ...payload, id: crypto.randomUUID(), isActive: true, createdAt: new Date().toISOString() }
    gs().addSupplier(supplier)
    return ok(supplier)
  },

  async update(id, payload) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.put(`/suppliers/${id}`, payload)
        gs().updateSupplier(id, data.data)
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al actualizar proveedor')
      }
    }
    gs().updateSupplier(id, payload)
    return ok({ id, ...payload })
  },
}
