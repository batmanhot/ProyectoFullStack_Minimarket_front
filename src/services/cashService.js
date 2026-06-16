import { useStore } from '../store/index'
import { formatNumber } from '../shared/utils/helpers'
import { api, USE_API, ok, fail, gs, delay } from './_base'

export const cashService = {
  // Sincroniza el estado de caja desde el backend al montar el componente.
  // Evita desincronía cuando se limpia el localStorage con una sesión aún abierta.
  async syncStatus() {
    if (!USE_API) return
    try {
      const { data } = await api.get('/cash/active')
      const session = data.data
      if (session) {
        useStore.getState().openCashSession(session)
      } else {
        // No hay sesión abierta en el backend — asegurarse que el store lo refleje
        const state = useStore.getState()
        if (state.activeCashSession) state.closeCashSession({ ...state.activeCashSession, status: 'cerrada' })
      }
    } catch (_) {}
  },

  async open(payload) {
    await delay()
    if (USE_API) {
      if (navigator.onLine) {
        try {
          const { data } = await api.post('/cash/open', payload)
          const session = data.data
          useStore.getState().openCashSession(session)
          return ok(session)
        } catch (err) {
          return fail(err.response?.data?.message || err.message || 'Error al aperturar caja')
        }
      }
      useStore.getState().enqueueOfflineOp({ type: 'cash.open', endpoint: '/cash/open', method: 'POST', payload })
      return ok(null)
    }
    const state = gs()
    if (state.activeCashSession) return fail('Ya existe una caja abierta')
    const session = { ...payload, id: crypto.randomUUID(), status: 'abierta', openedAt: new Date().toISOString() }
    state.openCashSession(session)
    return ok(session)
  },

  async close(id, payload) {
    await delay()
    if (USE_API) {
      if (navigator.onLine) {
        try {
          const { data } = await api.post(`/cash/${id}/close`, payload)
          const closedSession = data.data
          useStore.getState().closeCashSession(closedSession)
          return ok(closedSession)
        } catch (err) {
          return fail(err.response?.data?.message || err.message || 'Error al cerrar caja')
        }
      }
      useStore.getState().enqueueOfflineOp({ type: 'cash.close', endpoint: `/cash/${id}/close`, method: 'POST', payload })
      return ok(null)
    }
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
