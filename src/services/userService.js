import { api, USE_API, ok, fail, gs, delay } from './_base'

export const userService = {
  async getAll(filters = {}) {
    await delay(100)
    if (USE_API) {
      try {
        const { data } = await api.get('/users', { params: filters })
        gs().setUsers(data.data)
        return ok(data.data, data.meta?.total)
      } catch (err) { return fail(err.message) }
    }
    let users = gs().users || []
    if (filters.search) {
      const q = filters.search.toLowerCase()
      users = users.filter(u => u.fullName?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q))
    }
    if (filters.role) users = users.filter(u => u.role === filters.role)
    return ok(users, users.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.post('/users', payload)
        gs().addUser(data.data)
        return ok(data.data)
      } catch (err) { return fail(err.message || 'Error al crear usuario') }
    }
    const user = { ...payload, id: crypto.randomUUID(), isActive: true, createdAt: new Date().toISOString() }
    gs().addUser(user)
    return ok(user)
  },

  async update(id, updates) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.put(`/users/${id}`, updates)
        gs().updateUser(id, data.data)
        return ok(data.data)
      } catch (err) { return fail(err.message || 'Error al actualizar usuario') }
    }
    gs().updateUser(id, updates)
    return ok({ id, ...updates })
  },

  async changePassword(id, oldPassword, newPassword) {
    await delay()
    if (USE_API) {
      try {
        await api.patch(`/users/${id}/password`, { oldPassword, newPassword })
        return ok({ id, passwordChanged: true })
      } catch (err) { return fail(err.message || 'Error al cambiar contraseña') }
    }
    return ok({ id, passwordChanged: true })
  },

  async toggleActive(id, isActive) {
    return this.update(id, { isActive })
  },
}
