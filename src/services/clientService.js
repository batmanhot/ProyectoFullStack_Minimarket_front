import { useStore } from '../store/index'
import { api, USE_API, ok, fail, gs, delay } from './_base'

export const clientService = {
  async getAll(search = '') {
    await delay(100)
    if (USE_API) {
      try {
        const { data } = await api.get('/clients', { params: { search } })
        if (!search) gs().setClients(data.data)
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.message || err.message || 'Error al obtener clientes')
      }
    }
    let clients = gs().clients.filter(c => c.isActive)
    if (search) {
      const q = search.toLowerCase()
      clients = clients.filter(c => c.name.toLowerCase().includes(q) || c.documentNumber.includes(q))
    }
    return ok(clients, clients.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) {
      if (navigator.onLine) {
        try {
          const { data } = await api.post('/clients', payload)
          const client = data.data
          gs().addClient(client)
          return ok(client)
        } catch (err) {
          return fail(err.response?.data?.message || err.message || 'Error al crear el cliente')
        }
      }
      useStore.getState().enqueueOfflineOp({ type: 'client.create', endpoint: '/clients', method: 'POST', payload })
      return ok(null)
    }
    const client = { ...payload, id: crypto.randomUUID(), currentDebt: 0, isActive: true, createdAt: new Date().toISOString() }
    gs().addClient(client)
    return ok(client)
  },

  async update(id, payload) {
    await delay()
    if (USE_API) {
      if (navigator.onLine) {
        try {
          const { data } = await api.put(`/clients/${id}`, payload)
          gs().updateClient(id, data.data)
          return ok(data.data)
        } catch (err) {
          if (err.response?.status !== 404) {
            return fail(err.response?.data?.message || err.message || 'Error al actualizar el cliente')
          }
          // 404 = cliente no existe en backend stub, actualizar localmente
        }
      } else {
        useStore.getState().enqueueOfflineOp({ type: 'client.update', endpoint: `/clients/${id}`, method: 'PUT', payload })
        return ok(null)
      }
    }
    gs().updateClient(id, payload)
    return ok({ id, ...payload })
  },
}
