/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  MOTOR DE DESCUENTOS v4 — UNIDADES CANDIDATAS + JERARQUÍA ESTRICTA     ║
 * ║  Ruta: src/shared/utils/discountEngine.js                               ║
 * ║                                                                          ║
 * ║  AXIOMAS INAMOVIBLES:                                                   ║
 * ║  1. Cantidad Q → Q "espacios" (unidades candidatas) por línea           ║
 * ║  2. Módulo para posiciones beneficiarias — residuo muere en la línea    ║
 * ║  3. Jerarquía ESTRICTA con exclusión Top-Down:                          ║
 * ║     N1 Línea → N2 Agrupado → N3 Global                                 ║
 * ║     Si aplica nivel superior, el inferior NO evalúa ese ítem            ║
 * ║  4. "El mayor descuento gana" DENTRO de cada nivel                      ║
 * ║  5. Aritmética Decimal HALF_UP a 2 dec. en cada paso intermedio         ║
 * ║  6. appliedDiscounts[] por ítem: registro auditable de cada aplicación  ║
 * ║  7. Devolución rompe condición → anular y recalcular a precio base      ║
 * ║                                                                          ║
 * ║  DEPENDENCIA: npm install decimal.js                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

// ─── ARITMÉTICA DECIMAL HALF_UP ───────────────────────────────────────────────
// Implementación propia sin dependencias externas para evitar conflictos ESM.
// Cumple el requerimiento contable de redondeo simétrico HALF_UP a 2 decimales.
// Nunca usar Math.round() nativo: 1.005 → 1.00 (error float conocido).
// Esta implementación mueve el decimal antes de redondear para evitarlo.

function dec(n) {
  const v = Number(n)
  if (!isFinite(v)) return 0
  // HALF_UP: multiplicar × 100, redondear con floor(x + 0.5), dividir / 100
  const factor = 100
  return Math.floor(v * factor + 0.5) / factor
}
function decAdd(a, b) { return dec(dec(a) + dec(b)) }
function decSub(a, b) { return dec(dec(a) - dec(b)) }
function decMul(a, b) {
  // Multiplicación con precisión: evitar error float 0.1 × 0.2 = 0.020000000000000004
  const scale = 1e10
  return dec(Math.round(Number(a) * scale) * Math.round(Number(b) * scale) / (scale * scale))
}
function decPct(base, pct) { return dec(decMul(base, pct) / 100 ) }

// ─── PALETA DE COLORES POR CAMPAÑA ───────────────────────────────────────────
const PROMO_COLORS = [
  '#3B82F6','#8B5CF6','#EC4899','#14B8A6',
  '#F97316','#22C55E','#EAB308','#6366F1',
]
const _colorCache = {}
let   _colorIdx   = 0
function getPromoColor(campaignId) {
  if (!_colorCache[campaignId]) {
    _colorCache[campaignId] = PROMO_COLORS[_colorIdx % PROMO_COLORS.length]
    _colorIdx++
  }
  return _colorCache[campaignId]
}

// ─────────────────────────────────────────────────────────────────────────────
// VIGENCIA DE CAMPAÑA
// ─────────────────────────────────────────────────────────────────────────────
export function isCampaignActive(campaign) {
  if (!campaign?.isActive) return false
  const now  = new Date()
  const from = campaign.dateFrom ? new Date(campaign.dateFrom)              : null
  const to   = campaign.dateTo   ? new Date(campaign.dateTo + 'T23:59:59') : null
  if (from && now < from) return false
  if (to   && now > to)   return false
  if (campaign.daysOfWeek?.length > 0) {
    if (!campaign.daysOfWeek.includes(now.getDay())) return false
  }
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE — ¿El producto pertenece a la canasta de esta campaña?
// ─────────────────────────────────────────────────────────────────────────────
function productInScope(product, campaign) {
  if (!product) return false
  switch (campaign.scope) {
    case 'all':
      return true
    case 'categories':
      return (campaign.categoryIds || []).includes(product.categoryId)
    case 'products':
      return (campaign.productIds || []).includes(product.id)
    case 'brand':
      return !!product.brand &&
        (campaign.brands || [])
          .map(b => b.toLowerCase())
          .includes(product.brand.toLowerCase())
    default:
      return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ALGORITMO DE UNIDADES CANDIDATAS (núcleo del motor v4)
//
// Para una línea con cantidad Q y una campaña dada:
//   1. Desglosa Q espacios numerados 1..Q
//   2. Marca las posiciones beneficiarias según la regla
//   3. apps_posibles = Q // N_beneficiario   (división entera)
//   4. apps_reales   = min(apps_posibles, max_veces)
//   5. Si scope=all → max_veces = Infinity
//   6. El residuo (Q % N) muere en la línea — nunca se transfiere
//
// Retorna: {
//   discountTotal       : number (total descontado en la línea)
//   appliedDiscounts    : Array — una entrada por aplicación (auditable)
//   beneficiaryPositions: Array<number> — posiciones de unidades con desc.
// }
// ─────────────────────────────────────────────────────────────────────────────
function calcUnitCandidates(quantity, unitPrice, campaign) {
  const type     = campaign.type
  const maxVeces = campaign.scope === 'all'
    ? Infinity
    : (parseInt(campaign.maxVeces || campaign.maxPerPurchase) || Infinity)

  const appliedDiscounts    = []
  let   discountTotal       = 0

  // ── Tipo 1: Campaña temporal — % en cada unidad elegible ─────────────────
  if (type === 'campaign') {
    const pct      = parseFloat(campaign.discountPct) || 0
    const discUnit = decPct(unitPrice, pct)
    if (pct <= 0 || discUnit <= 0) return _emptyUnitResult()

    const apps = maxVeces === Infinity ? quantity : Math.min(quantity, maxVeces)

    for (let u = 1; u <= apps; u++) {
      appliedDiscounts.push({
        unitPosition: u,
        type:         'campaign',
        pct,
        amount:       discUnit,
        motivo:       `${pct}% "${campaign.name}" — unidad ${u}`,
        campaignId:   campaign.id,
        campaignName: campaign.name,
        icon:         campaign.icon || '🏷️',
        promoColor:   getPromoColor(campaign.id),
      })
      discountTotal = decAdd(discountTotal, discUnit)
    }
  }

  // ── Tipo 2: NxM — posición beneficiaria = ciclo × buy ────────────────────
  // NxM no aplica a scope 'all' (requiere producto, categoría o marca)
  if (type === 'promotion' && campaign.scope !== 'all') {
    const buy          = parseInt(campaign.buyQty)  || 0
    const pay          = parseInt(campaign.payQty)  || 0
    const freePerGroup = buy - pay
    if (buy < 2 || pay < 1 || pay >= buy || freePerGroup <= 0) return _emptyUnitResult()

    // apps_posibles = Q // buy   (cantidad de ciclos completos)
    const appsPosibles = Math.floor(quantity / buy)
    const appsReales   = maxVeces === Infinity ? appsPosibles : Math.min(appsPosibles, maxVeces)
    const discUnit     = decMul(unitPrice, freePerGroup)

    for (let cycle = 1; cycle <= appsReales; cycle++) {
      const pos = cycle * buy  // La N-ésima unidad del ciclo
      appliedDiscounts.push({
        unitPosition: pos,
        type:         'promotion',
        buyQty:       buy,
        payQty:       pay,
        freeUnits:    freePerGroup,
        amount:       discUnit,
        motivo:       `${buy}×${pay} — desc. en u.${pos} (ciclo ${cycle}/${appsReales})`,
        campaignId:   campaign.id,
        campaignName: campaign.name,
        icon:         campaign.icon || '🎁',
        promoColor:   getPromoColor(campaign.id),
      })
      discountTotal = decAdd(discountTotal, discUnit)
    }
    // El residuo (quantity % buy) muere aquí — no se transfiere
  }

  // ── Tipo 5: Compra X → desc. en N (Posicion_Beneficiaria) ─────────────────
  // minQty     = X mínimo para activar la regla
  // discountOnNth = N beneficiario (cada N unidades, la N-ésima tiene desc.)
  // discountPct   = %
  // maxVeces   = límite de aplicaciones (Inf si scope=all)
  if (type === 'line') {
    const minQty = parseInt(campaign.minQty)        || 0
    const posB   = parseInt(campaign.discountOnNth) || 0
    const pct    = parseFloat(campaign.discountPct) || 0
    if (minQty < 1 || posB < 1 || pct <= 0) return _emptyUnitResult()
    if (quantity < minQty) return _emptyUnitResult()  // no alcanza el mínimo

    // apps_posibles = Q // posB
    const appsPosibles = Math.floor(quantity / posB)
    const appsReales   = maxVeces === Infinity ? appsPosibles : Math.min(appsPosibles, maxVeces)
    const discUnit     = decPct(unitPrice, pct)

    for (let app = 1; app <= appsReales; app++) {
      const pos = app * posB
      appliedDiscounts.push({
        unitPosition: pos,
        type:         'line',
        minQty,
        posB,
        pct,
        amount:       discUnit,
        motivo:       `${pct}% desc. en u.${pos} — ${app} de ${appsReales === Infinity ? '∞' : appsReales} vez/ces`,
        campaignId:   campaign.id,
        campaignName: campaign.name,
        icon:         campaign.icon || '🏪',
        promoColor:   getPromoColor(campaign.id),
        appIndex:     app,
        maxVeces:     appsReales,
      })
      discountTotal = decAdd(discountTotal, discUnit)
    }
    // El residuo (quantity % posB) muere aquí — no se transfiere
  }

  return {
    discountTotal:       dec(discountTotal),
    appliedDiscounts,
    beneficiaryPositions: appliedDiscounts.map(a => a.unitPosition),
  }
}

function _emptyUnitResult() {
  return { discountTotal: 0, appliedDiscounts: [], beneficiaryPositions: [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// DESCUENTO DE VOLUMEN (Nivel 3 — Global)
// Se aplica sobre el subtotal neto de los ítems sin descuentos previos
// ─────────────────────────────────────────────────────────────────────────────
function calcVolumeDiscount(bucketItems, campaign) {
  const minAmount  = parseFloat(campaign.minAmount) || 0
  const pct        = parseFloat(campaign.discountPct) || 0
  const color      = getPromoColor(campaign.id)

  const netSubtotal = bucketItems.reduce((a, i) => decAdd(a, dec(i.quantity * i.unitPrice)), 0)
  if (netSubtotal < minAmount) return null

  let totalSaving = 0
  const perItem   = bucketItems.map(item => {
    const itemNet = dec(item.quantity * item.unitPrice)
    const disc    = decPct(itemNet, pct)
    totalSaving   = decAdd(totalSaving, disc)
    return {
      _key: item._key || item.productId,
      disc,
      detail: {
        campaignId:   campaign.id,
        campaignName: campaign.name,
        type:         'volume',
        icon:         campaign.icon || '📦',
        amount:       disc,
        motivo:       `${pct}% volumen ≥ S/${minAmount} — ${campaign.name}`,
        promoColor:   color,
        promoGroupId: campaign.id,
      },
      appliedEntry: {
        unitPosition: 'global',
        type:         'volume',
        amount:       disc,
        motivo:       `${pct}% volumen ≥ S/${minAmount} — ${campaign.name}`,
        campaignId:   campaign.id,
        campaignName: campaign.name,
      },
    }
  })

  return {
    perItem,
    totalSaving: dec(totalSaving),
    summary: {
      campaignId: campaign.id,
      name:       campaign.name,
      icon:       campaign.icon || '📦',
      color,
      saving:     dec(totalSaving),
      label:      `${pct}% en compras ≥ S/${minAmount}`,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR PRINCIPAL — evaluateDiscounts
//
// JERARQUÍA ESTRICTA Top-Down con exclusión:
//
//   N1 — Descuentos de Línea (scope: products | all)
//        Tipos: campaign, promotion, line
//        → "El mayor descuento gana" entre campañas N1
//
//   N2 — Descuentos Agrupados (scope: categories | brand)
//        Tipos: campaign, promotion, line
//        → Solo evalúa ítems sin descuento N1
//        → "El mayor descuento gana" entre campañas N2
//
//   N3 — Descuentos Globales (type: volume)
//        → Solo evalúa ítems sin descuento N1 ni N2
//
// ─────────────────────────────────────────────────────────────────────────────
export function evaluateDiscounts(cartItems, products, campaigns) {
  if (!cartItems?.length) return _emptyResult([])

  const active = (campaigns || []).filter(isCampaignActive)
  if (!active.length) return { ..._emptyResult(cartItems), engineStatus: 'no_active_campaigns' }

  // Clasificar campañas por nivel
  const n1 = active.filter(c => c.type !== 'volume' && (c.scope === 'products' || c.scope === 'all'))
  const n2 = active.filter(c => c.type !== 'volume' && (c.scope === 'categories' || c.scope === 'brand'))
  const n3 = active.filter(c => c.type === 'volume')

  // Mapa base — todos los ítems sin descuento
  const itemMap = {}
  cartItems.forEach(item => {
    const key = item._key || item.productId
    itemMap[key] = {
      ...item,
      campaignDiscount:     0,
      netTotal:             dec(item.quantity * item.unitPrice),
      appliedDiscounts:     [],
      discountDetails:      [],
      promoGroupId:         null,
      promoColor:           null,
      discountLevel:        null,   // 1|2|3 — qué nivel aplicó
      discountBlocked:      false,  // campo desc. manual deshabilitado
      beneficiaryPositions: [],     // posiciones de unidades con desc.
    }
  })

  const globalDiscounts = []
  const groupSaving     = {}
  let   byItem          = 0
  let   byGlobal        = 0

  // ══ NIVEL 1 — Línea ════════════════════════════════════════════════════════
  for (const item of cartItems) {
    const key     = item._key || item.productId
    const product = products.find(p => p.id === item.productId)
    if (!product) continue

    let bestDisc     = 0
    let bestResult   = null
    let bestCampaign = null

    for (const c of n1) {
      if (!productInScope(product, c)) continue
      const result = calcUnitCandidates(item.quantity, item.unitPrice, c)
      if (result.discountTotal > bestDisc) {
        bestDisc     = result.discountTotal
        bestResult   = result
        bestCampaign = c
      }
    }

    if (bestResult && bestDisc > 0) {
      _applyToMap(itemMap[key], bestResult, bestCampaign, 1)
      byItem = decAdd(byItem, bestDisc)
      _accGroup(groupSaving, bestCampaign, bestDisc)
    }
  }

  // ══ NIVEL 2 — Agrupado ═════════════════════════════════════════════════════
  for (const item of cartItems) {
    const key = item._key || item.productId
    if (itemMap[key].discountLevel === 1) continue  // excluido por N1

    const product = products.find(p => p.id === item.productId)
    if (!product) continue

    let bestDisc     = 0
    let bestResult   = null
    let bestCampaign = null

    for (const c of n2) {
      if (!productInScope(product, c)) continue
      const result = calcUnitCandidates(item.quantity, item.unitPrice, c)
      if (result.discountTotal > bestDisc) {
        bestDisc     = result.discountTotal
        bestResult   = result
        bestCampaign = c
      }
    }

    if (bestResult && bestDisc > 0) {
      _applyToMap(itemMap[key], bestResult, bestCampaign, 2)
      byItem = decAdd(byItem, bestDisc)
      _accGroup(groupSaving, bestCampaign, bestDisc)
    }
  }

  // ══ NIVEL 3 — Global (volume) ══════════════════════════════════════════════
  for (const c of n3) {
    const bucketN3 = cartItems.filter(item => {
      const key     = item._key || item.productId
      const product = products.find(p => p.id === item.productId)
      return itemMap[key].discountLevel === null && productInScope(product, c)
    })
    if (!bucketN3.length) continue

    const volResult = calcVolumeDiscount(bucketN3, c)
    if (!volResult) continue

    for (const lr of volResult.perItem) {
      const current = itemMap[lr._key]
      if (!current || lr.disc <= 0) continue
      current.campaignDiscount = decAdd(current.campaignDiscount, lr.disc)
      current.netTotal         = decSub(current.netTotal, lr.disc)
      current.discountLevel    = 3
      current.discountBlocked  = true
      current.promoGroupId     = c.id
      current.promoColor       = getPromoColor(c.id)
      if (lr.detail)       current.discountDetails.push(lr.detail)
      if (lr.appliedEntry) current.appliedDiscounts.push(lr.appliedEntry)
      byGlobal = decAdd(byGlobal, lr.disc)
    }

    if (volResult.totalSaving > 0) {
      globalDiscounts.push(volResult.summary)
      _accGroup(groupSaving, c, volResult.totalSaving)
    }
  }

  // Marcar discountBlocked en todos los que tienen descuento automático
  for (const key of Object.keys(itemMap)) {
    if (itemMap[key].campaignDiscount > 0) itemMap[key].discountBlocked = true
  }

  const groupSummary       = Object.values(groupSaving).filter(g => g.saving > 0).sort((a, b) => b.saving - a.saving)
  const totalCampaignSaving = decAdd(byItem, byGlobal)

  return {
    itemDiscounts: Object.values(itemMap),
    globalDiscounts,
    totalCampaignSaving,
    groupSummary,
    engineStatus: 'active',
    summary: { byItem: dec(byItem), byGlobal: dec(byGlobal), total: totalCampaignSaving },
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────
function _applyToMap(current, result, campaign, level) {
  current.campaignDiscount     = dec(result.discountTotal)
  current.netTotal             = decSub(current.netTotal, result.discountTotal)
  current.appliedDiscounts     = result.appliedDiscounts
  current.beneficiaryPositions = result.beneficiaryPositions
  current.discountLevel        = level
  current.discountBlocked      = true
  current.promoGroupId         = campaign.id
  current.promoColor           = getPromoColor(campaign.id)

  if (result.appliedDiscounts.length > 0) {
    const first   = result.appliedDiscounts[0]
    const maxV    = campaign.scope === 'all' ? '∞' : (campaign.maxVeces || campaign.maxPerPurchase || '∞')
    current.discountDetails = [{
      campaignId:   campaign.id,
      campaignName: campaign.name,
      type:         campaign.type,
      icon:         campaign.icon || '🏷️',
      amount:       current.campaignDiscount,
      label:        _badgeLabel(result.appliedDiscounts, campaign),
      motivo:       first.motivo,
      promoColor:   getPromoColor(campaign.id),
      promoGroupId: campaign.id,
      appSummary:   `Aplicado ${result.appliedDiscounts.length} de ${maxV} vez/ces`,
    }]
  }
}

function _badgeLabel(applied, campaign) {
  if (!applied.length) return campaign.name
  const first = applied[0]
  if (campaign.type === 'campaign')   return `${first.pct}% — ${campaign.name}`
  if (campaign.type === 'promotion')  return `${campaign.buyQty}×${campaign.payQty} — u.${first.unitPosition} gratis`
  if (campaign.type === 'line')       return `${first.pct}% en u.${first.unitPosition} (${applied.length} vez/ces)`
  return campaign.name
}

function _accGroup(groupSaving, campaign, saving) {
  if (!campaign?.id) return
  if (!groupSaving[campaign.id]) {
    groupSaving[campaign.id] = {
      campaignId: campaign.id,
      name:       campaign.name,
      icon:       campaign.icon || '🏷️',
      color:      getPromoColor(campaign.id),
      saving:     0,
    }
  }
  groupSaving[campaign.id].saving = decAdd(groupSaving[campaign.id].saving, saving)
}

function _emptyResult(cartItems) {
  return {
    itemDiscounts: (cartItems || []).map(item => ({
      ...item,
      campaignDiscount:     0,
      netTotal:             dec(item.quantity * item.unitPrice),
      appliedDiscounts:     [],
      discountDetails:      [],
      promoGroupId:         null,
      promoColor:           null,
      discountLevel:        null,
      discountBlocked:      false,
      beneficiaryPositions: [],
    })),
    globalDiscounts:     [],
    totalCampaignSaving: 0,
    groupSummary:        [],
    engineStatus:        'no_active_campaigns',
    summary:             { byItem: 0, byGlobal: 0, total: 0 },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICACIÓN DE CONDICIÓN (para módulo de Devoluciones)
// ─────────────────────────────────────────────────────────────────────────────
export function checkActivationCondition(cartItems, products, campaign) {
  if (!isCampaignActive(campaign)) return { active: false, reason: 'Campaña fuera de período' }

  const bucket     = cartItems.filter(item => productInScope(products.find(p => p.id === item.productId), campaign))
  const totalUnits = bucket.reduce((a, i) => a + i.quantity, 0)

  if (campaign.type === 'promotion') {
    const buy = parseInt(campaign.buyQty) || 0
    if (totalUnits < buy) return { active: false, reason: `Se necesitan ≥${buy} uds. Hay ${totalUnits}.` }
  }
  if (campaign.type === 'line') {
    const minQty = parseInt(campaign.minQty) || 0
    if (totalUnits < minQty) return { active: false, reason: `Se necesitan ≥${minQty} uds. Hay ${totalUnits}.` }
  }
  if (campaign.type === 'volume') {
    const minAmount = parseFloat(campaign.minAmount) || 0
    const subtotal  = bucket.reduce((a, i) => decAdd(a, dec(i.quantity * i.unitPrice)), 0)
    if (subtotal < minAmount) return { active: false, reason: `Subtotal S/${subtotal} < S/${minAmount}.` }
  }
  return { active: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DE UI
// ─────────────────────────────────────────────────────────────────────────────
export const CAMPAIGN_TYPES = [
  { value:'campaign',  label:'Campaña temporal',     icon:'🏷️', nivel:'N1/N2', desc:'% en cada unidad elegible del período.',              fields:['discountPct','scope','dateFrom','dateTo','daysOfWeek'] },
  { value:'promotion', label:'Promoción NxM',         icon:'🎁', nivel:'N1/N2', desc:'La unidad en posición N de cada ciclo sale con desc.', fields:['buyQty','payQty','maxPerPurchase','scope'], note:'No aplica a scope "Todos".' },
  { value:'volume',    label:'Descuento por volumen', icon:'📦', nivel:'N3',    desc:'% cuando subtotal supera un monto mínimo.',            fields:['discountPct','minAmount','scope'] },
  { value:'line',      label:'Compra X → desc. en N°',icon:'🏪', nivel:'N1/N2', desc:'Al acumular X uds., la posición N recibe Y%.',         fields:['minQty','discountOnNth','discountPct','maxVeces','scope'], note:'Si scope="Todos", Max_Veces=∞.' },
]

export const SCOPE_OPTIONS = [
  { value:'all',        label:'Todos los productos',    nivel:1 },
  { value:'categories', label:'Categorías específicas', nivel:2 },
  { value:'products',   label:'Productos específicos',  nivel:1 },
  { value:'brand',      label:'Marca específica',        nivel:2 },
]

export const DAYS_OF_WEEK = [
  { value:0, label:'Dom' },{ value:1, label:'Lun' },{ value:2, label:'Mar' },
  { value:3, label:'Mié' },{ value:4, label:'Jue' },{ value:5, label:'Vie' },
  { value:6, label:'Sáb' },
]

export const CAMPAIGN_TEMPLATES = [
  { name:'💜 Día de la Madre',        icon:'💜', type:'campaign',   discountPct:15, scope:'all' },
  { name:'🎄 Navidad',                 icon:'🎄', type:'campaign',   discountPct:20, scope:'all' },
  { name:'🛒 Cyber Monday',            icon:'🛒', type:'campaign',   discountPct:25, scope:'all' },
  { name:'2×1 Producto destacado',     icon:'🎁', type:'promotion',  buyQty:2, payQty:1, scope:'products', maxPerPurchase:1 },
  { name:'3×2 Temporada',              icon:'🎁', type:'promotion',  buyQty:3, payQty:2, scope:'products', maxPerPurchase:0 },
  { name:'5% compra ≥ S/100',          icon:'📦', type:'volume',     discountPct:5,  minAmount:100, scope:'all' },
  { name:'10% compra ≥ S/300',         icon:'📦', type:'volume',     discountPct:10, minAmount:300, scope:'all' },
  { name:'Compra 3 Lácteos, 4to 50%', icon:'🏪', type:'line', discountPct:50, minQty:3,  discountOnNth:4,  maxVeces:1, scope:'categories' },
  { name:'Compra 10 unds. → 10% c/u', icon:'🏪', type:'line', discountPct:10, minQty:10, discountOnNth:10, scope:'all' },
]
