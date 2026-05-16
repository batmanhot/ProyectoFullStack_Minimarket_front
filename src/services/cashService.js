import { formatNumber } from '../shared/utils/helpers'
import { api, USE_API, ok, fail, gs, delay } from './_base'

export const cashService = {
  async open(payload) {
    await delay()
    if (USE_API) { const { data } = await api.post('/cash/open', payload); return ok(data.data) }
    const state = gs()
    if (state.activeCashSession) return fail('Ya existe una caja abierta')
    const session = { ...payload, id: crypto.randomUUID(), status: 'abierta', openedAt: new Date().toISOString() }
    state.openCashSession(session)
    return ok(session)
  },

  async close(id, payload) {
    await delay()
    if (USE_API) { const { data } = await api.post(`/cash/${id}/close`, payload); return ok(data.data) }
    const state = gs()
    if (!state.activeCashSession) return fail('No hay caja abierta')
    const session = state.activeCashSession

    const sessionSales = state.sales.filter(s =>
      s.status === 'completada' && new Date(s.createdAt) >= new Date(session.openedAt)
    )
    const cashTotal = sessionSales.reduce((acc, s) => {
      const cashAmt = s.payments?.filter(p => p.method === 'efectivo').reduce((a, p) => a + p.amount, 0) || s.total
      return acc + cashAmt
    }, 0)

    const sessionDebtPayments = (state.debtPayments || []).filter(p =>
      new Date(p.createdAt) >= new Date(session.openedAt)
    )
    const debtCashTotal      = sessionDebtPayments.filter(p => p.method === 'efectivo').reduce((a, p) => a + (p.amount || 0), 0)
    const totalDebtCollected = sessionDebtPayments.reduce((a, p) => a + (p.amount || 0), 0)

    const expectedAmount = formatNumber(session.openingAmount + cashTotal + debtCashTotal)
    const difference     = formatNumber(payload.countedAmount - expectedAmount)

    const closedSession = {
      ...session, closingAmount: payload.countedAmount, expectedAmount, difference,
      status: 'cerrada', notes: payload.notes || '', closedAt: new Date().toISOString(),
      salesCount:         sessionSales.length,
      totalSales:         formatNumber(sessionSales.reduce((a, s) => a + s.total, 0)),
      totalDebtCollected: formatNumber(totalDebtCollected),
      debtPaymentsCount:  sessionDebtPayments.length,
    }
    state.closeCashSession(closedSession)
    return ok(closedSession)
  },
}
