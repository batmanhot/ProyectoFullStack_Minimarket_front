import { api, USE_API, ok, fail, gs, delay } from './_base'

const _try = async (fn) => { try { return await fn() } catch (_) { return null } }

export const categoryService = {
  async getAll(search = '') {
    await delay(100)
    if (USE_API) {
      const res = await _try(async () => {
        const { data } = await api.get('/categories', { params: search ? { search } : {} })
        if (!search) gs().setCategories(data.data)
        return ok(data.data, data.meta?.total)
      })
      if (res) return res
    }
    let cats = (gs().categories || []).filter(c => c.isActive !== false)
    if (search) cats = cats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    return ok(cats, cats.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.post('/categories', payload)
        gs().addCategory(data.data)
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al crear categoría')
      }
    }
    const cat = { ...payload, id: payload.slug || crypto.randomUUID(), isActive: true, createdAt: new Date().toISOString() }
    gs().addCategory(cat)
    return ok(cat)
  },

  async update(slug, updates) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.put(`/categories/${slug}`, updates)
        gs().updateCategory(slug, data.data)
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al actualizar categoría')
      }
    }
    gs().updateCategory(slug, updates)
    return ok({ id: slug, ...updates })
  },

  async remove(slug) {
    await delay()
    if (USE_API) {
      try {
        await api.delete(`/categories/${slug}`)
        gs().deleteCategory(slug)
        return ok({ slug, deleted: true })
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al eliminar categoría')
      }
    }
    gs().deleteCategory(slug)
    return ok({ slug, deleted: true })
  },
}
