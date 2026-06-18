import { api, USE_API, ok, fail, gs, delay } from './_base'

// La BD guarda 'discount'/'validFrom'/'validTo', el frontend usa 'discountPct'/'dateFrom'/'dateTo'
function normalizeCampaign(c) {
  if (!c) return c
  return {
    ...c,
    discountPct: c.discountPct ?? c.discount ?? 0,
    dateFrom:    c.dateFrom || (c.validFrom ? String(c.validFrom).slice(0, 10) : ''),
    dateTo:      c.dateTo   || (c.validTo   ? String(c.validTo).slice(0, 10)   : ''),
  }
}

export const discountCampaignService = {
  async getAll(filters = {}) {
    await delay(150)
    if (USE_API) {
      const noFilter = !filters.type && filters.isActive === undefined
      try {
        const { data } = await api.get('/campaigns', { params: filters })
        const campaigns = (data.data || []).map(normalizeCampaign)
        if (noFilter) gs().setDiscountCampaigns(campaigns)
        return ok(campaigns, data.meta?.total)
      } catch (err) {
        if (noFilter) gs().setDiscountCampaigns([])
        return fail(err.response?.data?.error || err.message || 'Error al obtener campañas')
      }
    }
    let campaigns = gs().discountCampaigns || []
    if (filters.type)                campaigns = campaigns.filter(c => c.type === filters.type)
    if (filters.isActive !== undefined) campaigns = campaigns.filter(c => c.isActive === filters.isActive)
    return ok(campaigns.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), campaigns.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.post('/campaigns', payload)
        const campaign = normalizeCampaign(data.data)
        gs().addDiscountCampaign(campaign)
        return ok(campaign)
      } catch (err) {
        return fail(err.response?.data?.error || err.response?.data?.details || err.message || 'Error al crear campaña')
      }
    }
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
    if (USE_API) {
      try {
        const { data } = await api.put(`/campaigns/${id}`, updates)
        const campaign = normalizeCampaign(data.data)
        gs().updateDiscountCampaign(id, campaign)
        return ok(campaign)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al actualizar campaña')
      }
    }
    const patch = { ...updates, updatedAt: new Date().toISOString() }
    gs().updateDiscountCampaign(id, patch)
    return ok({ id, ...patch })
  },

  async toggle(id, isActive) {
    await delay(150)
    if (USE_API) {
      try {
        const { data } = await api.patch(`/campaigns/${id}/toggle`, { isActive })
        gs().updateDiscountCampaign(id, { isActive: data.data.isActive, updatedAt: new Date().toISOString() })
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al cambiar estado de campaña')
      }
    }
    gs().updateDiscountCampaign(id, { isActive, updatedAt: new Date().toISOString() })
    return ok({ id, isActive })
  },

  async remove(id) {
    await delay()
    if (USE_API) {
      try {
        await api.delete(`/campaigns/${id}`)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al eliminar campaña')
      }
    }
    gs().deleteDiscountCampaign(id)
    return ok({ id, deleted: true })
  },
}
