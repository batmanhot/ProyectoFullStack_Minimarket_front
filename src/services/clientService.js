import { useStore } from '../store/index'
import { api, USE_API, ok, gs, delay } from './_base'

export const clientService = {
  async getAll(search = '') {
    await delay(100)
    if (USE_API) { const { data } = await api.get('/clients', { params: { search } }); return ok(data.data) }
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
        const { data } = await api.post('/clients', payload)
        return ok(data.data)
      }
      useStore.getState().enqueueOfflineOp({ type: 'client.create', endpoint: '/clients', method: 'POST', payload })
    }
    const client = { ...payload, id: crypto.randomUUID(), currentDebt: 0, isActive: true, createdAt: new Date().toISOString() }
    gs().addClient(client)
    return ok(client)
  },

  async update(id, payload) {
    await delay()
    if (USE_API) {
      if (navigator.onLine) {
        const { data } = await api.put(`/clients/${id}`, payload)
        return ok(data.data)
      }
      useStore.getState().enqueueOfflineOp({ type: 'client.update', endpoint: `/clients/${id}`, method: 'PUT', payload })
    }
    gs().updateClient(id, payload)
    return ok({ id, ...payload })
  },
}
