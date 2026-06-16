import { api, USE_API, ok, fail, gs, delay } from './_base'

export const dashboardService = {
  async getKPIs() {
    await delay(80)
    if (USE_API) {
      try {
        const { data } = await api.get('/dashboard')
        return ok(data.data)
      } catch (err) { return fail(err.message) }
    }
    // Fallback: calcula desde el store local
    const today = new Date().toDateString()
    const sales = gs().sales || []
    const todaySales = sales.filter(s => s.status === 'completada' && new Date(s.createdAt).toDateString() === today)
    return ok({
      ventas: {
        hoy: { count: todaySales.length, total: parseFloat(todaySales.reduce((s, v) => s + v.total, 0).toFixed(2)) },
        mes: { count: sales.length,       total: parseFloat(sales.filter(s => s.status === 'completada').reduce((s, v) => s + v.total, 0).toFixed(2)) },
      },
      clientes:  { total: (gs().clients || []).filter(c => c.isActive).length },
      productos: { total: (gs().products || []).filter(p => p.isActive).length },
      caja:      { activa: !!gs().activeCashSession },
      ultimasVentas: todaySales.slice(0, 5),
    })
  },
}
