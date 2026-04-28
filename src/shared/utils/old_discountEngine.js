/**
 * MOTOR DE DESCUENTOS v2
 * Evalúa campañas activas y retorna resultados por ítem y globales.
 * Interfaz compatible con POS.jsx:
 *   { itemDiscounts, globalDiscounts, totalCampaignSaving, summary }
 */

import { formatCurrency } from './helpers'

// ─── ¿Campaña vigente ahora mismo? ───────────────────────────────────────────
export function isCampaignActive(campaign) {
  if (!campaign.isActive) return false
  const now  = new Date()
  const from = campaign.dateFrom ? new Date(campaign.dateFrom)            : null
  const to   = campaign.dateTo   ? new Date(campaign.dateTo + 'T23:59:59'): null
  if (from && now < from) return false
  if (to   && now > to)   return false
  if (campaign.daysOfWeek?.length > 0) {
    if (!campaign.daysOfWeek.includes(now.getDay())) return false
  }
  return true
}

// ─── ¿Producto en el scope de la campaña? ────────────────────────────────────
function productInScope(product, campaign) {
  if (!product) return false
  switch (campaign.scope) {
    case 'all':        return true
    case 'categories': return (campaign.categoryIds || []).includes(product.categoryId)
    case 'products':   return (campaign.productIds   || []).includes(product.id)
    case 'brand':      return !!product.brand && (campaign.brands || []).map(b => b.toLowerCase()).includes(product.brand.toLowerCase())
    default:           return false
  }
}

// ─── Descuento % sobre un ítem ────────────────────────────────────────────────
function pctDiscount(item, pct) {
  const raw = parseFloat(((item.quantity * item.unitPrice) * (pct / 100)).toFixed(2))
  return Math.min(raw, item.quantity * item.unitPrice)
}

/**
 * MOTOR PRINCIPAL
 * Devuelve el formato que espera POS.jsx:
 *  itemDiscounts   : por producto — campaignDiscount, netTotal, discountDetails
 *  globalDiscounts : campañas que aplican al subtotal (volume)
 *  totalCampaignSaving
 *  summary         : { byItem, byGlobal, total }
 */
export function evaluateDiscounts(cartItems, products, campaigns) {
  const active = campaigns.filter(isCampaignActive)

  // Resultado base: sin descuentos
  let itemMap = {}
  cartItems.forEach(item => {
    itemMap[item._key || item.productId] = {
      ...item,
      campaignDiscount: 0,
      netTotal:         parseFloat((item.quantity * item.unitPrice).toFixed(2)),
      discountDetails:  [],
    }
  })

  const globalDiscounts = []
  let byItem   = 0
  let byGlobal = 0

  for (const c of active) {

    // ── 1. CAMPAÑA — % por ítem en scope ───────────────────────────────────
    if (c.type === 'campaign' || c.type === 'line') {
      cartItems.forEach(item => {
        const product = products.find(p => p.id === item.productId)
        if (!productInScope(product, c)) return
        const disc = pctDiscount(item, c.discountPct)
        if (disc <= 0) return
        const key = item._key || item.productId
        itemMap[key].campaignDiscount = parseFloat((itemMap[key].campaignDiscount + disc).toFixed(2))
        itemMap[key].netTotal         = parseFloat((itemMap[key].netTotal - disc).toFixed(2))
        itemMap[key].discountDetails.push({
          campaignId:   c.id,
          campaignName: c.name,
          type:         c.type,
          icon:         c.icon || '🏷️',
          amount:       disc,
          label:        `${c.discountPct}% — ${c.name}`,
        })
        byItem = parseFloat((byItem + disc).toFixed(2))
      })
    }

    // ── 2. PROMOCIÓN NxM — SOLO PRODUCTOS ──────────────────────────────────
    if (c.type === 'promotion') {
      const buy  = parseInt(c.buyQty)  || 0
      const pay  = parseInt(c.payQty)  || 0
      const maxP = parseInt(c.maxPerPurchase) || 0  // 0 = sin límite
      if (buy < 2 || pay < 1 || pay >= buy) continue

      cartItems.forEach(item => {
        const product = products.find(p => p.id === item.productId)
        // REGLA 3: NxM SÓLO aplica a productos específicos
        if (!productInScope(product, c)) return
        if (c.scope === 'all') return  // NxM requiere scope explícito

        const freePerGroup  = buy - pay
        let   groups        = Math.floor(item.quantity / buy)
        if (maxP > 0) groups = Math.min(groups, maxP)  // límite por compra
        if (groups <= 0) return

        const freeUnits = groups * freePerGroup
        const disc      = parseFloat((freeUnits * item.unitPrice).toFixed(2))
        if (disc <= 0) return

        const key = item._key || item.productId
        itemMap[key].campaignDiscount = parseFloat((itemMap[key].campaignDiscount + disc).toFixed(2))
        itemMap[key].netTotal         = parseFloat(Math.max(0, itemMap[key].netTotal - disc).toFixed(2))
        itemMap[key].discountDetails.push({
          campaignId:   c.id,
          campaignName: c.name,
          type:         'promotion',
          icon:         c.icon || '🎁',
          amount:       disc,
          label:        `${buy}×${pay} — ${freeUnits} ud. gratis`,
          freeUnits,
          groups,
          maxPerPurchase: maxP,
        })
        byItem = parseFloat((byItem + disc).toFixed(2))
      })
    }

    // ── 3. VOLUMEN — descuento si el subtotal supera umbral ─────────────────
    if (c.type === 'volume') {
      const cartSubtotal = cartItems.reduce((a, i) => a + i.quantity * i.unitPrice, 0)
      if (cartSubtotal < (c.minAmount || 0)) continue

      let saving = 0
      cartItems.forEach(item => {
        const product = products.find(p => p.id === item.productId)
        if (!productInScope(product, c)) return
        const disc = pctDiscount(item, c.discountPct)
        if (disc <= 0) return
        const key = item._key || item.productId
        itemMap[key].campaignDiscount = parseFloat((itemMap[key].campaignDiscount + disc).toFixed(2))
        itemMap[key].netTotal         = parseFloat((itemMap[key].netTotal - disc).toFixed(2))
        itemMap[key].discountDetails.push({
          campaignId:   c.id,
          campaignName: c.name,
          type:         'volume',
          icon:         c.icon || '📦',
          amount:       disc,
          label:        `${c.discountPct}% volumen — ${c.name}`,
        })
        saving = parseFloat((saving + disc).toFixed(2))
      })

      if (saving > 0) {
        byGlobal = parseFloat((byGlobal + saving).toFixed(2))
        globalDiscounts.push({
          campaignId: c.id,
          name:       c.name,
          icon:       c.icon || '📦',
          saving,
          label:      `${c.discountPct}% en compras > ${formatCurrency(c.minAmount)}`,
        })
      }
    }
  }

  const totalCampaignSaving = parseFloat((byItem + byGlobal).toFixed(2))

  return {
    itemDiscounts:       Object.values(itemMap),
    globalDiscounts,
    totalCampaignSaving,
    summary: { byItem, byGlobal, total: totalCampaignSaving },
  }
}

// ─── Constantes de UI ────────────────────────────────────────────────────────
export const CAMPAIGN_TYPES = [
  { value: 'campaign',  label: 'Campaña',              icon: '🏷️', desc: 'Descuento % en productos específicos por temporada (Navidad, Día de la Madre...)' },
  { value: 'promotion', label: 'Promoción NxM',         icon: '🎁', desc: '2×1, 3×2 — el cliente lleva más pagando menos' },
  { value: 'volume',    label: 'Descuento por volumen', icon: '📦', desc: '% sobre la compra cuando el total supera un monto mínimo' },
  { value: 'line',      label: 'Línea de productos',   icon: '🏪', desc: '% sobre categoría o marca completa' },
]

export const SCOPE_OPTIONS = [
  { value: 'all',        label: 'Todos los productos'    },
  { value: 'categories', label: 'Categorías específicas' },
  { value: 'products',   label: 'Productos específicos'  },
  { value: 'brand',      label: 'Marca específica'       },
]

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom' }, { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' }, { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' }, { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
]

export const CAMPAIGN_TEMPLATES = [
  { name: '💜 Día de la Madre',       icon: '💜', type: 'campaign',  discountPct: 15, scope: 'all' },
  { name: '👔 Día del Padre',          icon: '👔', type: 'campaign',  discountPct: 10, scope: 'all' },
  { name: '❤️ San Valentín',           icon: '❤️', type: 'campaign',  discountPct: 12, scope: 'all' },
  { name: '🎄 Navidad',                icon: '🎄', type: 'campaign',  discountPct: 20, scope: 'all' },
  { name: '🎉 Fiestas Patrias',         icon: '🎉', type: 'campaign',  discountPct: 10, scope: 'all' },
  { name: '🛒 Cyber Monday',           icon: '🛒', type: 'campaign',  discountPct: 25, scope: 'all' },
  { name: '⚡ Flash Sale',              icon: '⚡', type: 'campaign',  discountPct: 30, scope: 'all' },
  { name: '2×1 Producto destacado',    icon: '🎁', type: 'promotion', buyQty: 2, payQty: 1, scope: 'products', maxPerPurchase: 1 },
  { name: '3×2 Temporada',             icon: '🎁', type: 'promotion', buyQty: 3, payQty: 2, scope: 'products', maxPerPurchase: 0 },
  { name: '5% compra ≥ S/100',         icon: '📦', type: 'volume',    discountPct: 5,  minAmount: 100, scope: 'all' },
  { name: '10% compra ≥ S/300',        icon: '📦', type: 'volume',    discountPct: 10, minAmount: 300, scope: 'all' },
  { name: '15% línea Bebidas',         icon: '🏪', type: 'line',      discountPct: 15, scope: 'categories' },
]
