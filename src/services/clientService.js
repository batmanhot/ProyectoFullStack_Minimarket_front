import { api, USE_API, ok, gs, delay } from './_base'

export const clientService = {
  async getAll(search = '') {
    await delay(180)
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
    if (USE_API) { const { data } = await api.post('/clients', payload); return ok(data.data) }
    const client = { ...payload, id: crypto.randomUUID(), currentDebt: 0, isActive: true, createdAt: new Date().toISOString() }
    gs().addClient(client)
    return ok(client)
  },

  async update(id, payload) {
    await delay()
    if (USE_API) { const { data } = await api.put(`/clients/${id}`, payload); return ok(data.data) }
    gs().updateClient(id, payload)
    return ok({ id, ...payload })
  },
}
