import { api, USE_API, ok, gs, delay } from './_base'

export const discountCampaignService = {
  async getAll(filters = {}) {
    await delay(150)
    if (USE_API) {
      const { data } = await api.get('/campaigns', { params: filters })
      return ok(data.data, data.meta?.total)
    }
    let campaigns = gs().discountCampaigns || []
    if (filters.type)                campaigns = campaigns.filter(c => c.type === filters.type)
    if (filters.isActive !== undefined) campaigns = campaigns.filter(c => c.isActive === filters.isActive)
    return ok(campaigns.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), campaigns.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) { const { data } = await api.post('/campaigns', payload); return ok(data.data) }
    const campaign = {
      ...payload,
      id:        payload.id        || crypto.randomUUID(),
      createdAt: payload.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    gs().addDiscountCampaign(campaign)
    return ok(campaign)
  },

  async update(id, updates) {
    await delay()
    if (USE_API) { const { data } = await api.put(`/campaigns/${id}`, updates); return ok(data.data) }
    gs().updateDiscountCampaign(id, { ...updates, updatedAt: new Date().toISOString() })
    return ok({ id, ...updates })
  },

  async toggle(id, isActive) {
    await delay(150)
    if (USE_API) { const { data } = await api.patch(`/campaigns/${id}/toggle`, { isActive }); return ok(data.data) }
    gs().updateDiscountCampaign(id, { isActive, updatedAt: new Date().toISOString() })
    return ok({ id, isActive })
  },

  async remove(id) {
    await delay()
    if (USE_API) { await api.delete(`/campaigns/${id}`); return ok({ id, deleted: true }) }
    gs().deleteDiscountCampaign(id)
    return ok({ id, deleted: true })
  },
}
