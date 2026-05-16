import { api, USE_API, ok, fail, gs, delay } from './_base'

export const discountTicketService = {
  async getAll(filters = {}) {
    await delay(150)
    if (USE_API) {
      const { data } = await api.get('/tickets', { params: filters })
      return ok(data.data, data.meta?.total)
    }
    let tickets = gs().discountTickets || []
    if (filters.used     !== undefined) tickets = tickets.filter(t => t.used     === filters.used)
    if (filters.isActive !== undefined) tickets = tickets.filter(t => t.isActive === filters.isActive)
    return ok(tickets, tickets.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) { const { data } = await api.post('/tickets', payload); return ok(data.data) }
    const ticket = { ...payload, id: crypto.randomUUID(), used: false, createdAt: new Date().toISOString() }
    gs().addDiscountTicket(ticket)
    return ok(ticket)
  },

  async update(id, updates) {
    await delay()
    if (USE_API) { const { data } = await api.put(`/tickets/${id}`, updates); return ok(data.data) }
    gs().updateDiscountTicket(id, updates)
    return ok({ id, ...updates })
  },

  async remove(id) {
    await delay()
    if (USE_API) { await api.delete(`/tickets/${id}`); return ok({ id, deleted: true }) }
    gs().deleteDiscountTicket(id)
    return ok({ id, deleted: true })
  },

  async validate(code) {
    await delay(100)
    if (USE_API) {
      const { data } = await api.get(`/tickets/validate/${code}`)
      return ok(data.data)
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
      const { data } = await api.post(`/tickets/${code}/redeem`, { saleId, saleTotal, userId })
      return ok(data.data)
    }
    gs().redeemDiscountTicket(code, saleId, saleTotal, userId)
    return ok({ code, saleId, redeemed: true })
  },
}
