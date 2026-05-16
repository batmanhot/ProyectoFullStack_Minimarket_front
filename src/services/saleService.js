import { useStore } from '../store/index'
import { formatNumber } from '../shared/utils/helpers'
import { allocateStock, calcStockDisponible } from '../shared/utils/inventoryEngine'
import {
  calcPointsEarned,
  getClientLevel,
  buildEarnTransaction,
  buildRedeemTransaction,
} from '../shared/utils/LoyaltyEngine'
import { api, USE_API, ok, fail, gs, delay } from './_base'

export const saleService = {
  async getAll(filters = {}) {
    await delay()
    if (USE_API) {
      const { data } = await api.get('/sales', { params: filters })
      return ok(data.data, data.meta?.total)
    }
    let sales = gs().sales
    if (filters.status)   sales = sales.filter(s => s.status === filters.status)
    if (filters.dateFrom) sales = sales.filter(s => new Date(s.createdAt) >= new Date(filters.dateFrom))
    if (filters.dateTo)   sales = sales.filter(s => new Date(s.createdAt) <= new Date(filters.dateTo))
    if (filters.clientId) sales = sales.filter(s => s.clientId === filters.clientId)
    return ok(sales.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), sales.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) { const { data } = await api.post('/sales', payload); return ok(data.data) }

    const invoiceNumber = payload.invoiceNumber || 'VENTA'
    const enrichedItems = []

    // ── Expandir Bundles antes de procesar inventario ──────────────────────────
    const expandedItems = []
    for (const item of payload.items) {
      const freshState = useStore.getState()
      const product    = freshState.products.find(p => p.id === item.productId)
      if (product?.type === 'bundle' && (product.components || []).length > 0) {
        for (const comp of product.components) {
          const compProduct = freshState.products.find(p => p.id === comp.productId)
          expandedItems.push({
            productId:   comp.productId,
            productName: compProduct?.name || comp.productId,
            quantity:    comp.quantity * item.quantity,
            unitPrice:   0,
            unit:        compProduct?.unit || 'unidad',
            _fromBundle: item.productId,
            _bundleName: product.name,
          })
        }
        enrichedItems.push({ ...item, batchAllocations: [], stockControlUsed: 'bundle', isBundle: true })
      } else {
        expandedItems.push(item)
      }
    }

    // ── Motor de inventario FEFO/FIFO/Serie/Simple ─────────────────────────────
    for (const item of expandedItems) {
      const freshState = useStore.getState()
      const product    = freshState.products.find(p => p.id === item.productId)
      if (!product) continue

      const result = allocateStock({ product, quantity: item.quantity, invoiceNumber, userId: payload.userId })

      if (result.error) {
        console.warn('[inventoryEngine]', result.error)
        enrichedItems.push({ ...item, batchAllocations: [], stockControlUsed: product.stockControl || 'simple' })
        continue
      }

      freshState.updateProduct(item.productId, result.stockUpdate)
      freshState.addStockMovement({
        id: crypto.randomUUID(), productId: item.productId, productName: product.name,
        ...result.movement,
        userId: payload.userId, invoiceNumber,
        unitPrice:  item.unitPrice  || 0,
        totalSale:  parseFloat(((item.unitPrice || 0) * item.quantity).toFixed(2)),
        createdAt:  payload.createdAt || new Date().toISOString(),
      })

      enrichedItems.push({ ...item, batchAllocations: result.batchAllocations, stockControlUsed: product.stockControl || 'simple' })
    }

    // ── Recalcular stock de bundles al mínimo de sus componentes ──────────────
    for (const enrichedItem of enrichedItems) {
      if (!enrichedItem.isBundle) continue
      const freshState    = useStore.getState()
      const bundleProduct = freshState.products.find(p => p.id === enrichedItem.productId)
      if (!bundleProduct?.components?.length) continue
      const newBundleStock = Math.floor(
        Math.min(...bundleProduct.components.map(comp => {
          const cp = freshState.products.find(p => p.id === comp.productId)
          return cp && comp.quantity > 0 ? Math.floor(calcStockDisponible(cp) / comp.quantity) : 0
        }))
      )
      freshState.updateProduct(bundleProduct.id, { stock: newBundleStock })
    }

    payload = { ...payload, items: enrichedItems.length > 0 ? enrichedItems : payload.items }

    // ── Registrar deuda si hay pago a crédito ─────────────────────────────────
    if (payload.clientId) {
      const creditPayment = payload.payments?.find(p => p.method === 'credito')
      if (creditPayment) {
        const freshState = useStore.getState()
        const client = freshState.clients.find(c => c.id === payload.clientId)
        if (client) {
          freshState.updateClient(payload.clientId, {
            currentDebt: formatNumber((client.currentDebt || 0) + creditPayment.amount),
          })
        }
      }
    }

    const sale = { ...payload, id: crypto.randomUUID(), status: 'completada', createdAt: new Date().toISOString() }

    // ── Programa de Puntos — delegado a LoyaltyEngine ─────────────────────────
    if (payload.clientId) {
      const freshState = useStore.getState()
      const client     = freshState.clients.find(c => c.id === payload.clientId)

      if (client) {
        const accumulated    = client.loyaltyAccumulated || 0
        const redeemedPoints = Math.max(0, Math.floor(payload.redeemedPoints || 0))
        const loyaltyDiscount = Math.max(0, Number(payload.loyaltyDiscount || 0))

        let nextPoints       = client.loyaltyPoints || 0
        let nextTransactions = [...(client.loyaltyTransactions || [])]

        // Canje primero (si aplica)
        if (redeemedPoints > 0) {
          const safeRedeemed = Math.min(redeemedPoints, nextPoints)
          if (safeRedeemed > 0) {
            nextPoints = Math.max(0, nextPoints - safeRedeemed)
            nextTransactions = [
              buildRedeemTransaction(safeRedeemed, loyaltyDiscount, sale.id, sale.invoiceNumber),
              ...nextTransactions,
            ]
          }
        }

        // Acumulación usando el motor (nivel y multiplicador son responsabilidad del engine)
        const earned         = calcPointsEarned(sale.total, accumulated)
        const newAccumulated = accumulated + Math.max(0, earned)
        const newLevel       = getClientLevel(newAccumulated)

        if (earned > 0) {
          nextPoints += earned
          nextTransactions = [
            buildEarnTransaction(earned, sale.id, sale.invoiceNumber, sale.total, newLevel),
            ...nextTransactions,
          ]
        }

        freshState.updateClient(payload.clientId, {
          loyaltyPoints:       nextPoints,
          loyaltyAccumulated:  newAccumulated,
          loyaltyLevel:        newLevel.name,
          loyaltyTransactions: nextTransactions,
        })
      }
    }

    useStore.getState().addSale(sale)
    useStore.getState().clearCart()
    return ok(sale)
  },

  async cancel(id, reason, userId) {
    await delay()
    if (USE_API) {
      const { data } = await api.patch(`/sales/${id}/cancel`, { reason, userId })
      return ok(data.data)
    }
    const state = gs()
    const sale  = state.sales.find(s => s.id === id)
    if (!sale) return fail('Venta no encontrada')
    if (sale.status !== 'completada') return fail('Solo se pueden cancelar ventas completadas')

    for (const item of sale.items) {
      if (item.isBundle || item.stockControlUsed === 'bundle') continue

      const freshState = useStore.getState()
      const product    = freshState.products.find(p => p.id === item.productId)
      if (!product) continue

      const prevStock = product.stock
      let stockUpdate
      let newStock

      if (
        item.batchAllocations?.length > 0 &&
        (item.stockControlUsed === 'lote_fefo' || item.stockControlUsed === 'lote_fifo')
      ) {
        const updatedBatches = (product.batches || []).map(batch => {
          const alloc = item.batchAllocations.find(a => a.batchId === batch.id)
          if (!alloc) return batch
          const restoredQty = (batch.quantity || 0) + alloc.quantity
          return {
            ...batch,
            quantity: restoredQty,
            status: batch.status === 'agotado' && restoredQty > 0 ? 'activo' : batch.status,
          }
        })
        newStock    = updatedBatches.filter(b => b.status !== 'agotado' && b.status !== 'merma').reduce((sum, b) => sum + (b.quantity || 0), 0)
        stockUpdate = { batches: updatedBatches, stock: newStock }
      } else if (item.stockControlUsed === 'serie' && item.batchAllocations?.[0]?.batchNumber) {
        newStock    = product.stock + item.quantity
        stockUpdate = { stock: newStock, serialNumber: item.batchAllocations[0].batchNumber }
      } else {
        newStock    = product.stock + item.quantity
        stockUpdate = { stock: newStock }
      }

      freshState.updateProduct(item.productId, stockUpdate)
      freshState.addStockMovement({
        id: crypto.randomUUID(), productId: item.productId, productName: product.name,
        type: 'entrada', quantity: item.quantity,
        previousStock: prevStock, newStock,
        reason: `Cancelación ${sale.invoiceNumber}`, userId,
        createdAt: new Date().toISOString(),
      })
    }

    // Recalcular stock de bundles
    for (const item of sale.items) {
      if (!item.isBundle) continue
      const freshState    = useStore.getState()
      const bundleProduct = freshState.products.find(p => p.id === item.productId)
      if (!bundleProduct?.components?.length) continue
      const newBundleStock = Math.floor(
        Math.min(...bundleProduct.components.map(comp => {
          const cp = freshState.products.find(p => p.id === comp.productId)
          return cp && comp.quantity > 0 ? Math.floor(calcStockDisponible(cp) / comp.quantity) : 0
        }))
      )
      freshState.updateProduct(bundleProduct.id, { stock: newBundleStock })
    }

    // Revertir deuda de crédito
    if (sale.clientId) {
      const creditPayment = sale.payments?.find(p => p.method === 'credito')
      if (creditPayment) {
        const freshState = useStore.getState()
        const client = freshState.clients.find(c => c.id === sale.clientId)
        if (client) {
          freshState.updateClient(sale.clientId, {
            currentDebt: formatNumber(Math.max(0, (client.currentDebt || 0) - creditPayment.amount)),
          })
        }
      }
    }

    useStore.getState().updateSale(id, { status: 'cancelada', cancelReason: reason, cancelledAt: new Date().toISOString() })
    return ok({ id, status: 'cancelada' })
  },
}
