import { api, USE_API, ok, fail, gs, delay } from './_base'

const _try = async (fn) => { try { return await fn() } catch (_) { return null } }

export const brandService = {
  async getAll(search = '') {
    await delay(100)
    if (USE_API) {
      const res = await _try(async () => {
        const { data } = await api.get('/brands', { params: search ? { search } : {} })
        if (!search) gs().setBrands(data.data)
        return ok(data.data, data.meta?.total)
      })
      if (res) return res
    }
    let brands = (gs().brands || []).filter(b => b.isActive !== false)
    if (search) brands = brands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    return ok(brands, brands.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.post('/brands', payload)
        gs().addBrand(data.data)
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al crear marca')
      }
    }
    const brand = { ...payload, id: payload.slug || crypto.randomUUID(), isActive: true, createdAt: new Date().toISOString() }
    gs().addBrand(brand)
    return ok(brand)
  },

  async update(slug, updates) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.put(`/brands/${slug}`, updates)
        gs().updateBrand(slug, data.data)
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al actualizar marca')
      }
    }
    gs().updateBrand(slug, updates)
    return ok({ id: slug, ...updates })
  },

  async remove(slug) {
    await delay()
    if (USE_API) {
      try {
        await api.delete(`/brands/${slug}`)
        gs().deleteBrand(slug)
        return ok({ slug, deleted: true })
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al eliminar marca')
      }
    }
    gs().deleteBrand(slug)
    return ok({ slug, deleted: true })
  },
}
