/**
 * MOTOR DE DESCUENTOS MEJORADO
 * Evalúa campañas activas y retorna:
 *  - Descuentos por ítem (manteniendo subtotal bruto)
 *  - Descuentos globales (para campañas no específicas de productos)
 *  - Detalle completo para UI y registro de ventas
 */

import { formatCurrency } from './helpers'

// ─── Verificar si una campaña está vigente ahora mismo ────────────────────────
export function isCampaignActive(campaign) {
  if (!campaign.isActive) return false

  const now      = new Date()
  const dateFrom = campaign.dateFrom ? new Date(campaign.dateFrom) : null
  const dateTo   = campaign.dateTo   ? new Date(campaign.dateTo + 'T23:59:59') : null

  if (dateFrom && now < dateFrom) return false
  if (dateTo   && now > dateTo)   return false

  // Restricción por días de la semana (1=Dom … 7=Sáb, siguiendo ISO)
  if (campaign.daysOfWeek && campaign.daysOfWeek.length > 0) {
    // daysOfWeek: array de números 0-6 (0=Dom, 1=Lun … 6=Sáb)
    const todayDow = now.getDay() // 0=Dom
    if (!campaign.daysOfWeek.includes(todayDow)) return false
  }

  return true
}

// ─── Evalúa si un producto pertenece al alcance de la campaña ─────────────────
function productInScope(product, campaign) {
  if (!product) return false

  // Scope: 'all' | 'categories' | 'products' | 'brand'
  switch (campaign.scope) {
    case 'all':        return true
    case 'categories': return (campaign.categoryIds || []).includes(product.categoryId)
    case 'products':   return (campaign.productIds   || []).includes(product.id)
    case 'brand':      return product.brand && (campaign.brands || []).map(b=>b.toLowerCase()).includes(product.brand.toLowerCase())
    default:           return false
  }
}

/**
 * Aplica descuento % o monto fijo a un ítem
 * @param {Object} item - {quantity, unitPrice, subtotal}
 * @param {number|string} discountValue - % o monto fijo
 * @param {boolean} isPct - true=%, false=monto fijo
 * @returns {number} monto del descuento
 */
function applyDiscountToItem(item, discountValue, isPct = true) {
  const value = parseFloat(discountValue) || 0
  let disc
  
  if (isPct) {
    disc = parseFloat((item.subtotal * (value / 100)).toFixed(2))
  } else {
    disc = Math.min(value, item.subtotal)
  }
  
  return Math.max(0, parseFloat(disc.toFixed(2)))
}

/**
 * MOTOR PRINCIPAL MEJORADO
 * @param {Array}  cartItems - [{productId, quantity, unitPrice, subtotal (BRUTO), discount:0, ...}]
 * @param {Array}  products - todos los productos
 * @param {Array}  campaigns - todas las campañas
 * @returns {{
 *   itemDiscounts: [{...item, campaignDiscount, netTotal, discountDetails:[]}],
 *   globalDiscounts: [], 
 *   totalCampaignSaving: number,
 *   summary: {byItem: number, byGlobal: number, total: number}
 * }}
 */
export function evaluateDiscounts(cartItems, products, campaigns) {
  const activeCampaigns = campaigns.filter(isCampaignActive)
  if (activeCampaigns.length === 0) {
    return {
      itemDiscounts: cartItems.map(item => ({
        ...item,
        campaignDiscount: 0,
        netTotal: item.subtotal,
        discountDetails: []
      })),
      globalDiscounts: [],
      totalCampaignSaving: 0,
      summary: { byItem: 0, byGlobal: 0, total: 0 }
    }
  }

  // NO mutar items originales - retornar nueva estructura
  const itemDiscounts = cartItems.map(item => ({
    ...item,
    campaignDiscount: 0,
    netTotal: item.subtotal,
    discountDetails: []
  }))

  const appliedDiscounts = { byItem: [], byGlobal: [] }
  let totalItemSaving = 0
  let totalGlobalSaving = 0

  for (const campaign of activeCampaigns) {

    // ── CAMPAÑAS QUE APLIQUE A PRODUCTOS (TODOS LOS TIPOS) ──────────────────
    let itemSaving = 0
    itemDiscounts.forEach(item => {
      const product = products.find(p => p.id === item.productId)
      if (!product || !productInScope(product, campaign)) return
      
      const disc = applyDiscountToItem(item, campaign.discountPct || campaign.discountAmount, campaign.discountPct !== undefined)
      if (disc > 0) {
        item.campaignDiscount += disc
        item.netTotal = parseFloat((item.subtotal - disc).toFixed(2))
        item.discountDetails.push({
          campaignId: campaign.id,
          name: campaign.name || 'Campaña activa',
          amount: disc,
          type: campaign.discountPct !== undefined ? '%' : 'S/',
          value: campaign.discountPct || campaign.discountAmount,
          description: campaign.description
        })
        itemSaving += disc
      }
    })
    
    if (itemSaving > 0) {
      totalItemSaving += itemSaving
      appliedDiscounts.byItem.push({
        campaignId: campaign.id,
        type: campaign.type,
        name: campaign.name || 'Campaña',
        icon: campaign.icon || '🎯',
        description: `Productos: S/${itemSaving.toFixed(2)}`,
        saving: itemSaving
      })
    }

    // ── OTRAS CAMPAÑAS (NO productos específicos) → APLICAR AL SUBTOTAL ──────
    // Regla #4: si NO especifica "productos", aplicar al SUBTOTAL
    const isProductSpecific = campaign.scope === 'products' && campaign.productIds?.length > 0
    if (!isProductSpecific) {
      // Calcular descuento sobre SUBTOTAL bruto
      const discountValue = campaign.discountPct !== undefined ? campaign.discountPct : campaign.discountAmount
      const isPct = campaign.discountPct !== undefined
      const discOnSubtotal = applyDiscountToItem({ subtotal: cartItems.reduce((a,i)=>a+i.subtotal,0) }, discountValue, isPct)
      
      if (discOnSubtotal > 0) {
        totalGlobalSaving += discOnSubtotal
        appliedDiscounts.byGlobal.push({
          campaignId: campaign.id,
          type: campaign.type,
          name: campaign.name,
          icon: campaign.icon || '🏷️',
          description: `${isPct ? `${discountValue}%` : `S/${discountValue}`} sobre subtotal`,
          saving: discOnSubtotal
        })
      }
    }

    // ── PROMOCIONES Y VOLUMEN (manejar como arriba)
    if (['promotion', 'volume', 'line'].includes(campaign.type)) {
      // Lógica similar a campañas no-específicas
      const discountValue = campaign.discountPct !== undefined ? campaign.discountPct : campaign.discountAmount
      const isPct = campaign.discountPct !== undefined
      const discOnSubtotal = applyDiscountToItem({ subtotal: cartItems.reduce((a,i)=>a+i.subtotal,0) }, discountValue, isPct)
      
      if (discOnSubtotal > 0) {
        totalGlobalSaving += discOnSubtotal
        appliedDiscounts.byGlobal.push({
          campaignId: campaign.id,
          type: campaign.type,
          name: campaign.name,
          icon: campaign.icon || '📦',
          description: `${isPct ? `${discountValue}%` : `S/${discountValue}`} ${campaign.type}`,
          saving: discOnSubtotal
        })
      }
    }

  }

  const totalCampaignSaving = totalItemSaving + totalGlobalSaving

  return {
    itemDiscounts,
    globalDiscounts: appliedDiscounts.byGlobal,
    totalCampaignSaving,
    summary: {
      byItem: totalItemSaving,
      byGlobal: totalGlobalSaving,
      total: totalCampaignSaving
    }
  }
}

// ─── Helpers para la UI ───────────────────────────────────────────────────────
export const CAMPAIGN_TYPES = [
  { value: 'campaign',  label: 'Campaña',              icon: '🏷️', desc: 'Descuento % en productos específicos por fecha (Día de la Madre, Navidad, etc.)' },
  { value: 'promotion', label: 'Promoción NxM',         icon: '🎁', desc: '2x1, 3x2 — el cliente lleva más y paga menos' },
  { value: 'volume',    label: 'Descuento por volumen', icon: '📦', desc: '% sobre la compra si el total supera un monto mínimo' },
  { value: 'line',      label: 'Línea de productos',   icon: '🏪', desc: '% por categoría o marca de producto' },
]

export const SCOPE_OPTIONS = [
  { value: 'all',        label: 'Todos los productos'  },
  { value: 'categories', label: 'Categorías específicas' },
  { value: 'products',   label: 'Productos específicos'  },
  { value: 'brand',      label: 'Marca específica'      },
]

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
]

export const CAMPAIGN_TEMPLATES = [
  { name: '💜 Día de la Madre',      icon: '💜', type: 'campaign',  discountPct: 15, scope: 'all' },
  { name: '👔 Día del Padre',         icon: '👔', type: 'campaign',  discountPct: 10, scope: 'all' },
  { name: '❤️ San Valentín',          icon: '❤️', type: 'campaign',  discountPct: 12, scope: 'all' },
  { name: '🎄 Navidad',               icon: '🎄', type: 'campaign',  discountPct: 20, scope: 'all' },
  { name: '🎵 Día Canción Criolla',   icon: '🎵', type: 'campaign',  discountPct: 10, scope: 'all' },
  { name: '🎉 Fiestas Patrias',        icon: '🎉', type: 'campaign',  discountPct: 10, scope: 'all' },
  { name: '🛒 Cyber Monday',          icon: '🛒', type: 'campaign',  discountPct: 25, scope: 'all' },
  { name: '⚡ Flash Sale',             icon: '⚡', type: 'campaign',  discountPct: 30, scope: 'all' },
  { name: '2x1 Producto destacado',   icon: '🎁', type: 'promotion', buyQty: 2, payQty: 1, scope: 'products' },
  { name: '3x2 Temporada',            icon: '🎁', type: 'promotion', buyQty: 3, payQty: 2, scope: 'all' },
  { name: '5% compra ≥ S/100',        icon: '📦', type: 'volume',    discountPct: 5, minAmount: 100, scope: 'all' },
  { name: '10% compra ≥ S/300',       icon: '📦', type: 'volume',    discountPct: 10, minAmount: 300, scope: 'all' },
]
