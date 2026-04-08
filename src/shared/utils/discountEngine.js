/**
 * MOTOR DE DESCUENTOS
 * Evalúa todas las campañas activas y retorna:
 *  - Los descuentos que aplican al carrito actual
 *  - El carrito modificado con los descuentos ya aplicados
 *  - El ahorro total calculado
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

// ─── Aplicar un descuento porcentual simple a un ítem ─────────────────────────
function applyPctToItem(item, pct) {
  const raw  = parseFloat(((item.quantity * item.unitPrice) * (pct / 100)).toFixed(2))
  const disc = Math.min(raw, item.subtotal) // no puede superar el subtotal
  return disc
}

/**
 * MOTOR PRINCIPAL
 * @param {Array}  cartItems        — items del carrito [{productId, quantity, unitPrice, subtotal, ...}]
 * @param {Array}  products         — todos los productos del store
 * @param {Array}  campaigns        — todas las campañas del store
 * @param {number} cartSubtotal     — subtotal del carrito antes de descuentos
 * @returns {{ appliedDiscounts, modifiedCart, totalSaving }}
 */
export function evaluateDiscounts(cartItems, products, campaigns, cartSubtotal) {
  const activeCampaigns = campaigns.filter(isCampaignActive)
  if (activeCampaigns.length === 0) {
    return { appliedDiscounts: [], modifiedCart: cartItems, totalSaving: 0 }
  }

  // Clonar el carrito para no mutar el original
  let modifiedCart = cartItems.map(i => ({ ...i, campaignDiscounts: [] }))
  const appliedDiscounts = []

  for (const campaign of activeCampaigns) {

    // ── Tipo 1: CAMPAÑA — porcentaje sobre productos en scope ────────────────
    if (campaign.type === 'campaign') {
      const eligibleItems = modifiedCart.filter(item => {
        const product = products.find(p => p.id === item.productId)
        return productInScope(product, campaign)
      })
      if (eligibleItems.length === 0) continue

      let saving = 0
      modifiedCart = modifiedCart.map(item => {
        const product = products.find(p => p.id === item.productId)
        if (!productInScope(product, campaign)) return item
        const disc = applyPctToItem(item, campaign.discountPct)
        saving += disc
        return {
          ...item,
          discount: parseFloat(((item.discount || 0) + disc).toFixed(2)),
          subtotal: parseFloat((item.subtotal - disc).toFixed(2)),
          campaignDiscounts: [...(item.campaignDiscounts || []), { campaignId: campaign.id, name: campaign.name, amount: disc }],
        }
      })

      if (saving > 0) {
        appliedDiscounts.push({
          campaignId: campaign.id, type: 'campaign', name: campaign.name,
          icon: campaign.icon || '🏷️',
          description: `${campaign.discountPct}% en ${eligibleItems.length} producto(s) alcanzado(s)`,
          saving: parseFloat(saving.toFixed(2)),
        })
      }
    }

    // ── Tipo 2: PROMOCIÓN — NxM (2x1, 3x2, etc.) ──────────────────────────
    if (campaign.type === 'promotion') {
      const { buyQty, payQty } = campaign // ej. buyQty=3, payQty=2 → 3x2
      if (!buyQty || !payQty || payQty >= buyQty) continue

      modifiedCart = modifiedCart.map(item => {
        const product = products.find(p => p.id === item.productId)
        if (!productInScope(product, campaign)) return item

        const freePerGroup = buyQty - payQty
        const groups = Math.floor(item.quantity / buyQty)
        if (groups === 0) return item

        const freeUnits = groups * freePerGroup
        const disc      = parseFloat((freeUnits * item.unitPrice).toFixed(2))
        appliedDiscounts.push({
          campaignId: campaign.id, type: 'promotion', name: campaign.name,
          icon: campaign.icon || '🎁',
          description: `${buyQty}x${payQty}: ${freeUnits} unidad(es) gratis en "${item.productName}"`,
          saving: disc,
        })
        return {
          ...item,
          discount: parseFloat(((item.discount || 0) + disc).toFixed(2)),
          subtotal: parseFloat(Math.max(0, item.subtotal - disc).toFixed(2)),
          campaignDiscounts: [...(item.campaignDiscounts || []), { campaignId: campaign.id, name: campaign.name, amount: disc }],
        }
      })
    }

    // ── Tipo 3: VOLUMEN — descuento si el total supera un umbral ────────────
    if (campaign.type === 'volume') {
      if (cartSubtotal < (campaign.minAmount || 0)) continue

      // Aplicar el pct sobre los ítems en scope (o sobre todo el carrito si scope='all')
      let saving = 0
      modifiedCart = modifiedCart.map(item => {
        const product = products.find(p => p.id === item.productId)
        if (!productInScope(product, campaign)) return item
        const disc = applyPctToItem(item, campaign.discountPct)
        saving += disc
        return {
          ...item,
          discount: parseFloat(((item.discount || 0) + disc).toFixed(2)),
          subtotal: parseFloat((item.subtotal - disc).toFixed(2)),
          campaignDiscounts: [...(item.campaignDiscounts || []), { campaignId: campaign.id, name: campaign.name, amount: disc }],
        }
      })
      if (saving > 0) {
        appliedDiscounts.push({
          campaignId: campaign.id, type: 'volume', name: campaign.name,
          icon: campaign.icon || '📦',
          description: `${campaign.discountPct}% por compra mayor a ${formatCurrency(campaign.minAmount)}`,
          saving: parseFloat(saving.toFixed(2)),
        })
      }
    }

    // ── Tipo 4: LÍNEA — porcentaje por categoría o marca ────────────────────
    if (campaign.type === 'line') {
      let saving = 0
      modifiedCart = modifiedCart.map(item => {
        const product = products.find(p => p.id === item.productId)
        if (!productInScope(product, campaign)) return item
        const disc = applyPctToItem(item, campaign.discountPct)
        saving += disc
        return {
          ...item,
          discount: parseFloat(((item.discount || 0) + disc).toFixed(2)),
          subtotal: parseFloat((item.subtotal - disc).toFixed(2)),
          campaignDiscounts: [...(item.campaignDiscounts || []), { campaignId: campaign.id, name: campaign.name, amount: disc }],
        }
      })
      if (saving > 0) {
        appliedDiscounts.push({
          campaignId: campaign.id, type: 'line', name: campaign.name,
          icon: campaign.icon || '🏪',
          description: `${campaign.discountPct}% en línea "${campaign.name}"`,
          saving: parseFloat(saving.toFixed(2)),
        })
      }
    }
  }

  const totalSaving = parseFloat(appliedDiscounts.reduce((a, d) => a + d.saving, 0).toFixed(2))
  return { appliedDiscounts, modifiedCart, totalSaving }
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
