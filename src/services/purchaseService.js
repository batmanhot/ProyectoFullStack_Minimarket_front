import { useStore } from '../store/index'
import { formatNumber } from '../shared/utils/helpers'
import { api, USE_API, ok, fail, gs, delay } from './_base'

export const purchaseService = {
  async getAll() {
    if (USE_API) {
      try {
        const { data } = await api.get('/purchases')
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.message || err.message || 'Error al obtener compras')
      }
    }
    return ok(gs().purchases, gs().purchases.length)
  },

  async create(payload) {
    await delay()

    const purchase = {
      ...payload, id: crypto.randomUUID(), status: 'confirmada',
      createdAt: new Date().toISOString(),
      total: formatNumber(payload.items.reduce((a, i) => a + i.quantity * i.priceBuy, 0)),
    }

    if (USE_API) {
      if (navigator.onLine) {
        try {
          // Enviar solo los campos que el backend espera, con tipos numéricos explícitos.
          // priceBuy/quantity pueden llegar como strings desde Prisma (tipo Decimal en JSON).
          const apiPayload = {
            supplierId:   payload.supplierId   || undefined,
            supplierName: payload.supplierName || '',
            notes:        payload.notes        || '',
            items:        payload.items.map(i => ({
              productId:   i.productId,
              quantity:    Number(i.quantity),
              priceBuy:    Number(i.priceBuy),
              ...(i.batchNumber && { batchNumber: i.batchNumber }),
              ...(i.expiryDate  && { expiryDate:  i.expiryDate  }),
            })),
          }
          await api.post('/purchases', apiPayload)
        } catch (err) {
          return fail(err.message || 'Error al registrar la compra')
        }
      } else {
        useStore.getState().enqueueOfflineOp({ type: 'purchase.create', endpoint: '/purchases', method: 'POST', payload })
      }
    }

    // Actualizar stock local en todos los casos (API y demo)
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
