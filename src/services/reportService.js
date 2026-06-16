import { api, USE_API, ok, fail, gs, delay } from './_base'

export const reportService = {
  async getSummary(from, to) {
    await delay(100)
    if (USE_API) {
      try {
        const { data } = await api.get('/reports/summary', { params: { from, to } })
        return ok(data.data)
      } catch (err) { return fail(err.message) }
    }
    // Fallback: calcula desde el store local
    const sales = (gs().sales || []).filter(s => s.status === 'completada')
    const returns = gs().returns || []
    const purchases = gs().purchases || []
    const totalVentas = sales.reduce((s, v) => s + v.total, 0)
    const totalDev    = returns.filter(r => r.status !== 'anulada').reduce((s, r) => s + r.totalRefund, 0)
    const totalComp   = purchases.reduce((s, p) => s + p.total, 0)
    return ok({
      ventas:       { count: sales.length,    total: parseFloat(totalVentas.toFixed(2)) },
      devoluciones: { count: returns.length,  total: parseFloat(totalDev.toFixed(2)) },
      compras:      { count: purchases.length, total: parseFloat(totalComp.toFixed(2)) },
      utilidadBruta: parseFloat((totalVentas - totalComp - totalDev).toFixed(2)),
    })
  },

  async getProducts(from, to, limit = 20) {
    if (USE_API) {
      try {
        const { data } = await api.get('/reports/products', { params: { from, to, limit } })
        return ok(data.data)
      } catch (err) { return fail(err.message) }
    }
    return ok([])
  },

  async getCategories(from, to) {
    if (USE_API) {
      try {
        const { data } = await api.get('/reports/categories', { params: { from, to } })
        return ok(data.data)
      } catch (err) { return fail(err.message) }
    }
    return ok([])
  },

  async getDaily(from, to) {
    if (USE_API) {
      try {
        const { data } = await api.get('/reports/daily', { params: { from, to } })
        return ok(data.data)
      } catch (err) { return fail(err.message) }
    }
    const sales = (gs().sales || []).filter(s => s.status === 'completada')
    const byDay = sales.reduce((acc, s) => {
      const d = new Date(s.createdAt).toISOString().split('T')[0]
      if (!acc[d]) acc[d] = { date: d, count: 0, total: 0 }
      acc[d].count += 1; acc[d].total += s.total
      return acc
    }, {})
    return ok(Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)))
  },

  async getMerma(from, to) {
    if (USE_API) {
      try {
        const { data } = await api.get('/reports/merma', { params: { from, to } })
        return ok(data.data, data.meta?.total)
      } catch (err) { return fail(err.message) }
    }
    return ok([])
  },
}
