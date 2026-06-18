/**
 * usePOSSale
 * Centraliza la lógica de completar una venta en el POS:
 *  - Construye el payload completo hacia saleService.create
 *  - Coordina la liberación de reservas de stock
 *  - Gestiona el estado de procesamiento
 *  - Alerta por stock bajo tras la venta
 *
 * Extrae el handleCompleteSale que antes vivía directamente en POS.jsx para que el
 * componente solo coordine UI, no el flujo de negocio de la venta.
 */
import { useState, useCallback } from 'react'
import { useStore } from '../../../store/index'
import { saleService } from '../../../services/index'
import toast from 'react-hot-toast'

/**
 * @param {Object} deps - Dependencias del contexto del POS
 * @param {Array}    deps.mergedCartItems   - Ítems del carrito con descuentos aplicados
 * @param {number}   deps.subtotalBruto     - Subtotal antes de descuentos
 * @param {number}   deps.totalDescuentos   - Total de descuentos aplicados
 * @param {number}   deps.totalAPagar       - Total final a pagar
 * @param {number}   deps.baseImponible     - Base imponible para IGV
 * @param {number}   deps.igvCalculado      - Monto de IGV
 * @param {number}   deps.igvRate           - Tasa de IGV
 * @param {Object}   deps.appliedTicket     - Ticket de descuento aplicado (si hay)
 * @param {Function} deps.releaseReserve    - Liberar reserva de stock multi-caja
 * @param {Function} deps.resetDiscount     - Limpiar estado de descuentos
 * @param {Function} deps.broadcast         - Emitir evento a pantalla del cliente
 */
export function usePOSSale({
  mergedCartItems,
  subtotalBruto, totalDescuentos, totalAPagar,
  baseImponible, igvCalculado, igvRate,
  appliedTicket,
  releaseReserve,
  resetDiscount,
  broadcast,
}) {
  const { currentUser, redeemDiscountTicket } = useStore()
  const [processing, setProcessing]     = useState(false)
  const [completedSale, setCompletedSale] = useState(null)
  const [showTicket, setShowTicket]       = useState(false)

  const handleCompleteSale = useCallback(async ({
    payments,
    clientId,
    change,
    loyaltyDiscount  = 0,
    redeemedPoints   = 0,
    tipoComprobante  = 'boleta',
  }) => {
    setProcessing(true)

    const { getNextInvoice } = useStore.getState()
    const invoicePrefix = tipoComprobante === 'ticket' ? 'T001'
                        : tipoComprobante === 'factura' ? 'F001'
                        : 'B001'

    const salePayload = {
      invoiceNumber:   getNextInvoice(invoicePrefix),
      clientId:        clientId || null,
      userId:          currentUser?.id,
      userName:        currentUser?.fullName,
      items:           mergedCartItems,
      subtotalBruto,
      totalDescuentos,
      total:           totalAPagar,
      baseImponible,
      igv:             igvCalculado,
      igvRate,
      discount:        totalDescuentos,
      ticketCode:      appliedTicket?.ticket?.code || null,
      ticketDiscount:  appliedTicket?.discountAmt  || 0,
      payments,
      change:          change || 0,
      loyaltyDiscount,
      redeemedPoints,
      tipoComprobante,
      sunatStatus:     tipoComprobante === 'ticket' ? null : 'pendiente',
    }

    const result = await saleService.create(salePayload)
    setProcessing(false)

    if (result.error) {
      toast.error(result.error)
      return false
    }

    await releaseReserve()

    if (appliedTicket?.ticket) {
      redeemDiscountTicket(appliedTicket.ticket.code, result.data?.id, totalAPagar, currentUser?.id)
    }

    // Alertar si algún producto quedó con stock bajo tras la venta
    const afterProducts = useStore.getState().products
    const lowAfterSale  = salePayload.items
      .map(i => afterProducts.find(p => p.id === i.productId))
      .filter(p => p && p.stock <= p.stockMin)
    if (lowAfterSale.length > 0) {
      toast(`⚠️ Stock bajo: ${lowAfterSale.map(p => p.name).join(', ')}`, { duration: 5000 })
    }

    resetDiscount()
    setCompletedSale(result.data)
    setShowTicket(true)
    toast.success(`Venta ${result.data.invoiceNumber} completada`, { duration: 3000, icon: '🎉' })
    broadcast('SALE_COMPLETE', {
      sale: {
        invoiceNumber: result.data.invoiceNumber,
        total:         result.data.total,
        change:        result.data.change || 0,
      },
    })

    return true
  }, [
    appliedTicket, baseImponible, broadcast, currentUser,
    igvCalculado, igvRate, mergedCartItems,
    redeemDiscountTicket, releaseReserve, resetDiscount,
    subtotalBruto, totalAPagar, totalDescuentos,
  ])

  const closeTicket = useCallback(() => {
    setShowTicket(false)
    setCompletedSale(null)
  }, [])

  return {
    processing,
    completedSale,
    showTicket,
    handleCompleteSale,
    closeTicket,
  }
}
