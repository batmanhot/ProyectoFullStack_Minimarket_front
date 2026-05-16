import { useStore } from '../store/index'
import { formatNumber } from '../shared/utils/helpers'
import { api, USE_API, ok, gs, delay } from './_base'

export const purchaseService = {
  async getAll() {
    if (USE_API) { const { data } = await api.get('/purchases'); return ok(data.data) }
    return ok(gs().purchases, gs().purchases.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) { const { data } = await api.post('/purchases', payload); return ok(data.data) }

    const purchase = {
      ...payload, id: crypto.randomUUID(), status: 'confirmada',
      createdAt: new Date().toISOString(),
      total: formatNumber(payload.items.reduce((a, i) => a + i.quantity * i.priceBuy, 0)),
    }

    for (const item of payload.items) {
      const freshState = useStore.getState()
      const product    = freshState.products.find(p => p.id === item.productId)
      if (!product) continue
      const prevStock = product.stock
      const newStock  = prevStock + item.quantity
      freshState.updateProduct(item.productId, { stock: newStock, priceBuy: item.priceBuy })
      freshState.addStockMovement({
        id: crypto.randomUUID(), productId: item.productId, productName: product.name,
        type: 'entrada', quantity: item.quantity,
        previousStock: prevStock, newStock,
        reason: `Compra proveedor: ${payload.supplierName || ''}`,
        userId: payload.userId, createdAt: new Date().toISOString(),
      })
    }

    useStore.getState().addPurchase(purchase)
    return ok(purchase)
  },
}
