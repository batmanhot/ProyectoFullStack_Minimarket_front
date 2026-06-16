import { useStore } from '../store/index'
import { api, USE_API, ok, fail, gs, delay } from './_base'

export const returnService = {
  async create(payload) {
    await delay()

    const creditNote = {
      ...payload,
      id:        payload.id        || crypto.randomUUID(),
      status:    payload.status    || 'completada',
      createdAt: payload.createdAt || new Date().toISOString(),
    }

    if (USE_API) {
      if (navigator.onLine) {
        try {
          await api.post('/returns', payload)
        } catch (err) {
          return fail(err.response?.data?.message || err.message || 'Error al registrar la devolución')
        }
      } else {
        useStore.getState().enqueueOfflineOp({ type: 'return.create', endpoint: '/returns', method: 'POST', payload })
      }
    }

    // Aplicar efectos locales en todos los casos (API y demo)
    const state = gs()
    state.addReturn(creditNote)

    for (const item of payload.items || []) {
      const freshState = useStore.getState()
      const product    = freshState.products.find(p => p.id === item.productId)
      if (!product) continue
      const newStock = product.stock + item.quantity
      freshState.updateProduct(item.productId, { stock: newStock })
      freshState.addStockMovement({
        id: crypto.randomUUID(), productId: item.productId, productName: item.productName,
        type: 'entrada', quantity: item.quantity,
        previousStock: product.stock, newStock,
        reason: `Devolución NC ${creditNote.ncNumber}`,
        userId: payload.userId, createdAt: creditNote.createdAt,
      })
    }

    if (payload.saleId) {
      const freshState   = useStore.getState()
      const originalSale = freshState.sales.find(s => s.id === payload.saleId)
      const allReturns   = freshState.returns || []

      if (originalSale) {
        // Ítems facturables = sin componentes expandidos de bundles
        const billableItems = (originalSale.items || []).filter(i => !i.fromBundle && !i._fromBundle)
        const allNcItems    = [
          ...allReturns.filter(r => r.saleId === payload.saleId && r.status !== 'anulada'),
          creditNote,
        ].flatMap(r => r.items)

        const isFullyReturned = billableItems.every(bItem => {
          if (bItem.isBundle) {
            // Bundle: totalmente devuelto si todos sus componentes están devueltos
            const compSaleItems = (originalSale.items || []).filter(
              si => si.fromBundle === bItem.productId || si._fromBundle === bItem.productId
            )
            return compSaleItems.every(csi => {
              const returned = allNcItems
                .filter(ri => ri.saleItemId === csi.id || ri.productId === csi.productId)
                .reduce((acc, ri) => acc + (ri.quantity || 0), 0)
              return returned >= csi.quantity
            })
          }
          const returned = allNcItems
            .filter(ri => ri.saleItemId === bItem.id || ri.productId === bItem.productId)
            .reduce((acc, ri) => acc + (ri.quantity || 0), 0)
          return returned >= bItem.quantity
        })

        freshState.updateSale(payload.saleId, {
          status: isFullyReturned ? 'devolucion' : 'dev-parcial',
        })
      }
    }

    return ok(creditNote)
  },

  async getAll(filters = {}) {
    await delay(180)
    if (USE_API) {
      try {
        const { data } = await api.get('/returns', { params: filters })
        const noFilter = !filters.status && !filters.saleId && !filters.dateFrom && !filters.dateTo
        if (noFilter) gs().setReturns(data.data)
        return ok(data.data, data.meta?.total)
      } catch (err) {
        return fail(err.response?.data?.message || err.message || 'Error al obtener devoluciones')
      }
    }
    let returns = gs().returns || []
    if (filters.status)   returns = returns.filter(r => r.status === filters.status)
    if (filters.saleId)   returns = returns.filter(r => r.saleId === filters.saleId)
    if (filters.dateFrom) returns = returns.filter(r => new Date(r.createdAt) >= new Date(filters.dateFrom))
    if (filters.dateTo)   returns = returns.filter(r => new Date(r.createdAt) <= new Date(filters.dateTo + 'T23:59:59'))
    return ok(returns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), returns.length)
  },

  async getById(id) {
    await delay(100)
    if (USE_API) {
      try {
        const { data } = await api.get(`/returns/${id}`)
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.message || err.message || 'Nota de Crédito no encontrada')
      }
    }
    const nc = (gs().returns || []).find(r => r.id === id)
    return nc ? ok(nc) : fail('Nota de Crédito no encontrada')
  },

  async anular(id, motivo, userId) {
    await delay()

    const nc = (gs().returns || []).find(r => r.id === id)
    if (!nc)                     return fail('Nota de Crédito no encontrada')
    if (nc.status === 'anulada') return fail('Esta NC ya fue anulada')

    if (USE_API) {
      if (navigator.onLine) {
        try {
          await api.patch(`/returns/${id}/anular`, { motivo, userId })
        } catch (err) {
          return fail(err.response?.data?.message || err.message || 'Error al anular la devolución')
        }
      } else {
        useStore.getState().enqueueOfflineOp({ type: 'return.anular', endpoint: `/returns/${id}/anular`, method: 'PATCH', payload: { motivo, userId } })
      }
    }

    // Revertir efectos locales en todos los casos
    for (const item of nc.items || []) {
      const freshState = useStore.getState()
      const product    = freshState.products.find(p => p.id === item.productId)
      if (!product) continue
      freshState.updateProduct(item.productId, { stock: Math.max(0, product.stock - item.quantity) })
    }

    if (nc.saleId) {
      const freshState = useStore.getState()
      const sale       = freshState.sales.find(s => s.id === nc.saleId)
      if (sale && (sale.status === 'devolucion' || sale.status === 'dev-parcial')) {
        freshState.updateSale(nc.saleId, { status: 'completada' })
      }
    }

    gs().anularReturn(id, motivo)
    return ok({ id, status: 'anulada' })
  },
}
