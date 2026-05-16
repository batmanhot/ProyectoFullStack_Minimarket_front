import { useMemo } from 'react'
import { useStore } from '../../../store/index'
import { evaluateDiscounts } from '../../../shared/utils/discountEngine'
import { APP_CONFIG } from '../../../config/app'

/**
 * Centraliza todos los cálculos fiscales del POS:
 * descuentos automáticos, descuentos manuales, ticket, IGV y totales.
 *
 * Fuente única de igvRate: systemConfig.igvRate → businessConfig.igvRate → APP_CONFIG.igvRate
 *
 * @param {Array}  cart             - Ítems del carrito desde el store
 * @param {number} globalDiscAmt    - Descuento global adicional (input del cajero)
 * @param {number} ticketDiscAmt    - Descuento por ticket de vale aplicado
 */
export function usePOSTotals(cart, globalDiscAmt = 0, ticketDiscAmt = 0) {
  const { products, discountCampaigns, systemConfig, businessConfig } = useStore()

  const igvRate = parseFloat(
    systemConfig?.igvRate ?? businessConfig?.igvRate ?? APP_CONFIG.igvRate
  )

  const autoDiscountResult = useMemo(() => {
    try {
      return evaluateDiscounts(cart, products, discountCampaigns || [])
    } catch {
      return {
        itemDiscounts:       cart.map(item => ({ ...item, campaignDiscount: 0, netTotal: item.subtotal, discountDetails: [] })),
        globalDiscounts:     [],
        totalCampaignSaving: 0,
        summary:             { byItem: 0, byGlobal: 0, total: 0 },
      }
    }
  }, [cart, products, discountCampaigns])

  const mergedCartItems = useMemo(() => cart.map(cartItem => {
    const autoItem = autoDiscountResult.itemDiscounts.find(
      i => i._key === cartItem._key || i.productId === cartItem.productId
    ) || { campaignDiscount: 0, netTotal: cartItem.subtotal, discountDetails: [] }

    const manualDiscount = cartItem.discount || 0
    const totalDiscount  = autoItem.campaignDiscount + manualDiscount
    const netTotal       = parseFloat((autoItem.netTotal - manualDiscount).toFixed(2))

    return { ...cartItem, ...autoItem, manualDiscount, totalDiscount, netTotal }
  }), [cart, autoDiscountResult])

  const subtotalBruto   = parseFloat(mergedCartItems.reduce((a, i) => a + i.subtotal, 0).toFixed(2))
  const totalItemDisc   = mergedCartItems.reduce((a, i) => a + i.totalDiscount, 0)
  const totalDescuentos = parseFloat((totalItemDisc + globalDiscAmt + ticketDiscAmt).toFixed(2))
  const totalAPagar     = parseFloat(Math.max(0, subtotalBruto - totalDescuentos).toFixed(2))

  const igvFactor      = 1 + igvRate
  const baseImponible  = parseFloat((totalAPagar / igvFactor).toFixed(2))
  const igvCalculado   = parseFloat((totalAPagar - baseImponible).toFixed(2))

  return {
    // Carrito enriquecido con descuentos automáticos y manuales
    mergedCartItems,

    // Resultado del motor de descuentos automáticos
    autoDiscountResult,

    // Totales fiscales
    subtotalBruto,
    totalDescuentos,
    totalAPagar,
    baseImponible,
    igvCalculado,
    igvRate,

    // Resumen de descuentos por tipo
    totalCampaignSaving:  autoDiscountResult.totalCampaignSaving,
    totalManualDiscount:  mergedCartItems.reduce((a, i) => a + (i.manualDiscount || 0), 0),
    totalItemDiscounts:   totalItemDisc,
  }
}
