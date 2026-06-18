import { api, USE_API, ok, fail, gs, delay } from './_base'

// La BD devuelve validFrom/validTo como ISO DateTime; el componente espera "YYYY-MM-DD"
function normalizeTicket(t) {
  if (!t) return t
  return {
    ...t,
    validFrom: t.validFrom ? String(t.validFrom).slice(0, 10) : '',
    validTo:   t.validTo   ? String(t.validTo).slice(0, 10)   : '',
  }
}

export const discountTicketService = {
  async getAll(filters = {}) {
    await delay(150)
    if (USE_API) {
      const noFilter = filters.used === undefined && filters.isActive === undefined
      try {
        const { data } = await api.get('/tickets', { params: filters })
        const tickets = (data.data || []).map(normalizeTicket)
        if (noFilter) gs().setDiscountTickets(tickets)
        return ok(tickets, data.meta?.total)
      } catch (err) {
        // En modo API, limpiar datos obsoletos del localStorage aunque falle la petición
        if (noFilter) gs().setDiscountTickets([])
        return fail(err.response?.data?.error || err.message || 'Error al obtener tickets')
      }
    }
    let tickets = gs().discountTickets || []
    if (filters.used     !== undefined) tickets = tickets.filter(t => t.used     === filters.used)
    if (filters.isActive !== undefined) tickets = tickets.filter(t => t.isActive === filters.isActive)
    return ok(tickets, tickets.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.post('/tickets', payload)
        const ticket = normalizeTicket(data.data)
        gs().addDiscountTicket(ticket)
        return ok(ticket)
      } catch (err) {
        return fail(err.response?.data?.error || err.response?.data?.details || err.message || 'Error al crear ticket')
      }
    }
    const ticket = { ...payload, id: crypto.randomUUID(), used: false, createdAt: new Date().toISOString() }
    gs().addDiscountTicket(ticket)
    return ok(ticket)
  },

  async update(id, updates) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.put(`/tickets/${id}`, updates)
        const ticket = normalizeTicket(data.data)
        gs().updateDiscountTicket(id, ticket)
        return ok(ticket)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al actualizar ticket')
      }
    }
    gs().updateDiscountTicket(id, updates)
    return ok({ id, ...updates })
  },

  async remove(id) {
    await delay()
    if (USE_API) {
      try {
        await api.delete(`/tickets/${id}`)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al eliminar ticket')
      }
    }
    gs().deleteDiscountTicket(id)
    return ok({ id, deleted: true })
  },

  async validate(code) {
    await delay(100)
    if (USE_API) {
      try {
        const { data } = await api.get(`/tickets/validate/${code}`)
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Código no válido')
      }
    }
    const ticket = (gs().discountTickets || []).find(
      t => t.code?.toUpperCase() === code?.toUpperCase()
    )
    if (!ticket)          return fail('Código no encontrado')
    if (!ticket.isActive) return fail('Ticket desactivado')
    if (ticket.used)      return fail('Ticket ya fue utilizado')
    const now = new Date()
    if (ticket.validFrom && now < new Date(ticket.validFrom))             return fail('Ticket aún no vigente')
    if (ticket.validTo   && now > new Date(ticket.validTo + 'T23:59:59')) return fail('Ticket vencido')
    return ok(ticket)
  },

  async redeem(code, saleId, saleTotal, userId) {
    await delay()
    if (USE_API) {
      try {
        await api.post(`/tickets/${code}/redeem`, { saleId, saleTotal, userId })
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al redimir ticket')
      }
    }
    gs().redeemDiscountTicket(code, saleId, saleTotal, userId)
    return ok({ code, saleId, redeemed: true })
  },
}
