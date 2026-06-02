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
    if (USE_API) {
      if (navigator.onLine) {
        const { data } = await api.post('/sales', payload)
        return ok(data.data)
      }
      useStore.getState().enqueueOfflineOp({ type: 'sale.create', endpoint: '/sales', method: 'POST', payload })
      // Cae al bloque local para reflejar el stock en pantalla inmediatamente
    }

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

    // ── Motor de inventario FEFO/FIFO/Serie/Simple + Variantes ──────────────────
    for (const item of expandedItems) {
      const freshState = useStore.getState()
      const product    = freshState.products.find(p => p.id === item.productId)
      if (!product) continue

      // Ítem vendido como variante con stock propio registrado
      const hasRegisteredVariants = item.variantId &&
        freshState.productVariants.some(v => v.productId === item.productId)

      if (hasRegisteredVariants) {
        const variant = freshState.productVariants.find(v => v.id === item.variantId)
        if (!variant) {
          enrichedItems.push({ ...item, batchAllocations: [], stockControlUsed: 'simple' })
          continue
        }
        const prevStock = variant.stock ?? 0
        const newStock  = Math.max(0, prevStock - item.quantity)
        freshState.updateVariant(item.variantId, { stock: newStock })
        freshState.addStockMovement({
          id: crypto.randomUUID(), productId: item.productId, productName: item.productName,
          variantId: item.variantId,
          type: 'salida', quantity: item.quantity,
          previousStock: prevStock, newStock,
          reason: `Venta ${invoiceNumber}`,
          userId: payload.userId, invoiceNumber,
          unitPrice: item.unitPrice  || 0,
          totalSale: parseFloat(((item.unitPrice || 0) * item.quantity).toFixed(2)),
          createdAt: payload.createdAt || new Date().toISOString(),
        })
        enrichedItems.push({ ...item, batchAllocations: [], stockControlUsed: 'simple' })
        continue
      }

      // Producto normal o con hasVariants=true pero sin variantes registradas aún
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

    // Enriquecer con datos del cliente para el comprobante
    const saleClientEnrich = (() => {
      if (!payload.clientId) return {}
      const c = useStore.getState().clients.find(cl => cl.id === payload.clientId)
      if (!c) return {}
      return {
        clientName:     c.name,
        clientDocument: `${c.documentType} ${c.documentNumber}`,
      }
    })()

    const sale = { ...payload, ...saleClientEnrich, id: crypto.randomUUID(), status: 'completada', createdAt: new Date().toISOString() }

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
      if (navigator.onLine) {
        const { data } = await api.patch(`/sales/${id}/cancel`, { reason, userId })
        return ok(data.data)
      }
      useStore.getState().enqueueOfflineOp({ type: 'sale.cancel', endpoint: `/sales/${id}/cancel`, method: 'PATCH', payload: { reason, userId } })
      // Cae al bloque local para reflejar el cambio de estado en pantalla inmediatamente
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

      // Restaurar stock de variante si la venta original fue de una variante registrada
      const hasRegisteredVariants = item.variantId &&
        freshState.productVariants.some(v => v.productId === item.productId)

      if (hasRegisteredVariants) {
        const variant = freshState.productVariants.find(v => v.id === item.variantId)
        if (!variant) continue
        const prevStock = variant.stock ?? 0
        const newStock  = prevStock + item.quantity
        freshState.updateVariant(item.variantId, { stock: newStock })
        freshState.addStockMovement({
          id: crypto.randomUUID(), productId: item.productId, productName: product.name,
          variantId: item.variantId,
          type: 'entrada', quantity: item.quantity,
          previousStock: prevStock, newStock,
          reason: `Cancelación ${sale.invoiceNumber}`, userId,
          createdAt: new Date().toISOString(),
        })
        continue
      }

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

    // ── Generar NC de anulación para boletas y facturas (no tickets) ──────────
    const tipo = sale.tipoComprobante
    if (tipo !== 'ticket') {
      const freshState  = useStore.getState()
      const ncNumber    = freshState.getNextInvoice('NC001')
      const now         = new Date().toISOString()
      const igvRate     = parseFloat(sale.igvRate ?? 0.18)
      const totalRefund = sale.total
      const HALF_UP     = n => Math.floor(Number(n) * 100 + 0.5) / 100
      const baseImponible = HALF_UP(totalRefund / (1 + igvRate))
      const igv           = HALF_UP(totalRefund - baseImponible)

      // Solo ítems facturables (excluir componentes internos de bundles)
      const billableItems = sale.items.filter(i => !i._fromBundle)
      const ncItems = billableItems.map(item => {
        const netUnit = item.netTotal != null && item.quantity > 0
          ? HALF_UP(item.netTotal / item.quantity)
          : (() => {
              const gross    = item.quantity * (item.unitPrice || 0)
              const discount = item.totalDiscount != null
                ? item.totalDiscount
                : (item.discount || 0) + (item.campaignDiscount || 0)
              return HALF_UP(Math.max(0, gross - discount) / item.quantity)
            })()
        const firstBatch = item.batchAllocations?.[0] ?? null
        return {
          saleItemId:   item.id,
          productId:    item.productId,
          variantId:    item.variantId    || null,
          productName:  item.productName,
          barcode:      item.barcode      || '',
          quantity:     item.quantity,
          unitPrice:    item.unitPrice    || 0,
          netUnitPrice: netUnit,
          discount:     item.discount     || 0,
          totalRefund:  HALF_UP(netUnit * item.quantity),
          unit:         item.unit         || 'unidad',
          batchId:      firstBatch?.batchId     ?? null,
          batchNumber:  firstBatch?.batchNumber ?? null,
          expiryDate:   firstBatch?.expiryDate  ?? null,
        }
      })

      const currentUser = freshState.currentUser
      freshState.addReturn({
        id:              crypto.randomUUID(),
        ncNumber,
        saleId:          sale.id,
        invoiceNumber:   sale.invoiceNumber,
        tipoComprobante: 'nc',
        clientId:        sale.clientId    || null,
        clientName:      sale.clientName  || null,
        userId:          userId,
        userName:        currentUser?.fullName || currentUser?.username || null,
        reason:          'anulacion',
        reasonLabel:     'Anulación de comprobante',
        reasonNote:      reason,
        items:           ncItems,
        totalRefund,
        baseImponible,
        igv,
        igvRate,
        status:          'completada',
        sunatStatus:     'pendiente',
        createdAt:       now,
      })
    }

    useStore.getState().updateSale(id, { status: 'cancelada', cancelReason: reason, cancelledAt: new Date().toISOString() })
    return ok({ id, status: 'cancelada' })
  },
}
