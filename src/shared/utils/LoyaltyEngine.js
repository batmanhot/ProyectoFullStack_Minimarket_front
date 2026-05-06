/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  LoyaltyEngine.js — Motor del Programa de Puntos v2                     ║
 * ║  Ruta: src/shared/utils/LoyaltyEngine.js                                ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                          ║
 * ║  POLÍTICAS DEL PROGRAMA (escritas en piedra — no modificar sin          ║
 * ║  aprobación del área comercial):                                         ║
 * ║                                                                          ║
 * ║  P1. ACUMULACIÓN                                                         ║
 * ║      • Se acumulan puntos SOLO en ventas completadas (status=completada) ║
 * ║      • Base: 1 punto por cada S/ 10.00 en el total de la venta           ║
 * ║      • Los puntos se calculan sobre el TOTAL PAGADO (ya con descuentos)  ║
 * ║      • Redondeo hacia abajo (floor) — fracción nunca genera puntos        ║
 * ║      • Los puntos se acreditan inmediatamente al confirmar la venta       ║
 * ║                                                                          ║
 * ║  P2. MULTIPLICADORES POR NIVEL                                           ║
 * ║      • Bronce  (0–499 pts acumulados)    → ×1.0 (base)                  ║
 * ║      • Plata   (500–1499 pts)            → ×1.2 (+20%)                  ║
 * ║      • Oro     (1500–3999 pts)           → ×1.5 (+50%)                  ║
 * ║      • Platino (4000+ pts)               → ×2.0 (+100%)                 ║
 * ║      • El nivel se determina por el total ACUMULADO histórico,           ║
 * ║        no por los puntos disponibles actuales                            ║
 * ║                                                                          ║
 * ║  P3. CANJE                                                               ║
 * ║      • Mínimo 50 puntos para canjear                                     ║
 * ║      • Valor de canje: S/ 0.10 por punto                                 ║
 * ║        (50 pts = S/ 5.00 de descuento)                                   ║
 * ║      • El canje se aplica sobre el total de la venta activa              ║
 * ║      • No se acumulan puntos sobre el monto descontado por canje         ║
 * ║      • El canje se descuenta del stock de puntos disponibles             ║
 * ║      • El total acumulado histórico NO disminuye al canjear              ║
 * ║                                                                          ║
 * ║  P4. VENCIMIENTO                                                         ║
 * ║      • Los puntos vencen a los 365 días desde la transacción que         ║
 * ║        los generó (por transacción, no de forma global)                  ║
 * ║      • Los puntos canjeados se descuentan de los más antiguos primero    ║
 * ║      • Los puntos vencidos NO se recuperan                               ║
 * ║                                                                          ║
 * ║  P5. DEVOLUCIONES                                                        ║
 * ║      • Si se devuelve una compra, los puntos de esa venta se anulan      ║
 * ║      • Si ya fueron canjeados, se genera deuda de puntos negativos       ║
 * ║        que se compensa con la siguiente acumulación                      ║
 * ║                                                                          ║
 * ║  P6. IDENTIFICACIÓN DEL CLIENTE                                          ║
 * ║      • El cliente DEBE estar identificado en la venta para acumular      ║
 * ║      • La búsqueda primaria es por DNI / RUC / CE                        ║
 * ║      • Alternativamente por nombre completo                              ║
 * ║      • Un cliente sin documento registrado NO puede acumular puntos      ║
 * ║                                                                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

// ─── Constantes de configuración por defecto ──────────────────────────────────
// Estas son editables desde el módulo de Configuración del sistema.
// Los valores aquí son el FALLBACK si no hay configuración guardada.
export const LOYALTY_CONFIG_DEFAULTS = {
  enabled:         true,
  pointsPerSol:    1,       // P1: puntos base por S/10
  solsPerPoint:    10,      // inverso: cada cuántos soles se gana 1 punto
  pointsValue:     0.10,    // P3: S/ por punto al canjear
  minRedeemPoints: 50,      // P3: mínimo para canjear
  maxRedeemPct:    50,      // P3: máximo % del total que se puede cubrir con puntos
  expiryDays:      365,     // P4: días hasta vencimiento de puntos
  showInPOS:       true,    // mostrar badge en panel de cobro
  programName:     'Club de Puntos',
  programDescription: 'Acumula puntos en cada compra y canjéalos como descuento',
}

// ─── Niveles del programa ─────────────────────────────────────────────────────
export const LOYALTY_LEVELS = [
  {
    name:        'Bronce',
    min:         0,
    max:         499,
    icon:        '🥉',
    color:       'text-amber-700 dark:text-amber-500',
    bg:          'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    badge:       'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    multiplier:  1.0,
    multiplierLabel: 'Base',
    perks:       ['1 pt por cada S/ 10', 'Canje desde 50 pts'],
  },
  {
    name:        'Plata',
    min:         500,
    max:         1499,
    icon:        '🥈',
    color:       'text-slate-600 dark:text-slate-300',
    bg:          'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-600',
    badge:       'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    multiplier:  1.2,
    multiplierLabel: '×1.2',
    perks:       ['1.2 pts por cada S/ 10', 'Canje desde 50 pts', 'Prioridad en atención'],
  },
  {
    name:        'Oro',
    min:         1500,
    max:         3999,
    icon:        '🥇',
    color:       'text-yellow-700 dark:text-yellow-400',
    bg:          'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    badge:       'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    multiplier:  1.5,
    multiplierLabel: '×1.5',
    perks:       ['1.5 pts por cada S/ 10', 'Canje desde 50 pts', 'Descuentos especiales'],
  },
  {
    name:        'Platino',
    min:         4000,
    max:         Infinity,
    icon:        '💎',
    color:       'text-purple-700 dark:text-purple-400',
    bg:          'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    badge:       'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    multiplier:  2.0,
    multiplierLabel: '×2.0',
    perks:       ['2 pts por cada S/ 10', 'Canje desde 50 pts', 'Beneficios exclusivos'],
  },
]

// ─── Funciones principales ────────────────────────────────────────────────────

/** Retorna el nivel del cliente por sus puntos acumulados históricos */
export function getClientLevel(totalAccumulated = 0) {
  for (let i = LOYALTY_LEVELS.length - 1; i >= 0; i--) {
    if (totalAccumulated >= LOYALTY_LEVELS[i].min) return LOYALTY_LEVELS[i]
  }
  return LOYALTY_LEVELS[0]
}

/** Retorna el próximo nivel y los puntos que faltan para alcanzarlo */
export function getNextLevel(totalAccumulated = 0) {
  const next = LOYALTY_LEVELS.find(l => totalAccumulated < l.min)
  if (!next) return null
  return { level: next, pointsNeeded: next.min - totalAccumulated }
}

/**
 * POLÍTICA P1 + P2: Calcula los puntos que gana una venta.
 *
 * Ejemplo con S/75.00 y nivel Plata (×1.2):
 *   basePoints = floor(75 / 10) = 7 pts base
 *   earned     = floor(7 × 1.2) = floor(8.4) = 8 pts
 *
 * @param {number} saleTotal        - Total pagado de la venta (después de descuentos)
 * @param {number} totalAccumulated - Puntos acumulados históricos (determina el nivel)
 * @param {Object} config           - Configuración del programa
 * @returns {number} Puntos enteros a acreditar
 */
export function calcPointsEarned(saleTotal, totalAccumulated = 0, config = LOYALTY_CONFIG_DEFAULTS) {
  if (!config.enabled || saleTotal <= 0) return 0
  const level      = getClientLevel(totalAccumulated)
  const basePoints = Math.floor(saleTotal / (config.solsPerPoint || 10))
  const earned     = Math.floor(basePoints * level.multiplier)
  return earned
}

/**
 * POLÍTICA P3: Calcula el descuento en S/ al canjear puntos.
 *
 * Ejemplo: 120 pts × S/0.10 = S/12.00 de descuento
 *
 * @param {number} pointsToRedeem - Puntos que el cliente quiere canjear
 * @param {number} saleTotal      - Total de la venta (para validar maxRedeemPct)
 * @param {Object} config         - Configuración del programa
 * @returns {{ discount: number, valid: boolean, reason?: string }}
 */
export function calcRedemptionValue(pointsToRedeem, saleTotal = 0, config = LOYALTY_CONFIG_DEFAULTS) {
  if (pointsToRedeem < config.minRedeemPoints) {
    return { discount: 0, valid: false, reason: `Mínimo ${config.minRedeemPoints} pts para canjear` }
  }
  const rawDiscount = Math.floor(pointsToRedeem * 100 + 0.5) / 100 * config.pointsValue
  const maxDiscount = saleTotal > 0 ? (saleTotal * (config.maxRedeemPct || 50)) / 100 : rawDiscount
  const discount    = Math.min(rawDiscount, maxDiscount)
  return {
    discount: parseFloat(discount.toFixed(2)),
    valid:    true,
    rawDiscount: parseFloat(rawDiscount.toFixed(2)),
    capped:   rawDiscount > maxDiscount,
  }
}

/**
 * POLÍTICA P4: Calcula los puntos activos (no vencidos y no canjeados).
 * Los puntos se vencen por transacción de acumulación individual.
 */
export function getActivePoints(transactions = [], config = LOYALTY_CONFIG_DEFAULTS) {
  const cutoff   = new Date()
  cutoff.setDate(cutoff.getDate() - (config.expiryDays || 365))

  const earnedActive = transactions
    .filter(t => t.type === 'earned' && new Date(t.createdAt) >= cutoff)
    .reduce((acc, t) => acc + (t.points || 0), 0)

  const redeemed = transactions
    .filter(t => t.type === 'redeemed')
    .reduce((acc, t) => acc + (t.points || 0), 0)

  return Math.max(0, earnedActive - redeemed)
}

/** Genera el perfil de lealtad inicial para un cliente nuevo */
export function createLoyaltyProfile() {
  return {
    loyaltyPoints:       0,
    loyaltyAccumulated:  0,
    loyaltyLevel:        'Bronce',
    loyaltyTransactions: [],
  }
}

/** Construye la transacción de acumulación (al completar venta) */
export function buildEarnTransaction(points, saleId, invoiceNumber, saleTotal, level) {
  return {
    id:            crypto.randomUUID(),
    type:          'earned',
    points,
    saleId,
    invoiceNumber,
    saleTotal,
    level:         level?.name || 'Bronce',
    multiplier:    level?.multiplier || 1.0,
    createdAt:     new Date().toISOString(),
    description:   `Compra ${invoiceNumber} · S/${saleTotal} · ${level?.multiplierLabel || '×1.0'}`,
  }
}

/** Construye la transacción de canje (al aplicar puntos en venta) */
export function buildRedeemTransaction(points, discountAmount, saleId, invoiceNumber) {
  return {
    id:             crypto.randomUUID(),
    type:           'redeemed',
    points,
    discountAmount,
    saleId,
    invoiceNumber,
    createdAt:      new Date().toISOString(),
    description:    `Canje en ${invoiceNumber} · -${points} pts → S/${discountAmount} desc.`,
  }
}

/** Construye la transacción de anulación por devolución */
export function buildVoidTransaction(points, originalSaleId, invoiceNumber, returnNcNumber) {
  return {
    id:            crypto.randomUUID(),
    type:          'voided',
    points:        -points,   // negativo = puntos anulados
    originalSaleId,
    invoiceNumber,
    returnNcNumber,
    createdAt:     new Date().toISOString(),
    description:   `Anulación por NC ${returnNcNumber} · Venta ${invoiceNumber} · -${points} pts`,
  }
}

/** Resumen completo del estado de puntos de un cliente */
export function buildLoyaltySummary(client, config = LOYALTY_CONFIG_DEFAULTS) {
  const transactions   = client.loyaltyTransactions || []
  const accumulated    = client.loyaltyAccumulated  || 0
  const available      = client.loyaltyPoints       || 0
  const level          = getClientLevel(accumulated)
  const nextLvl        = getNextLevel(accumulated)
  const progressPct    = nextLvl
    ? Math.round(((accumulated - level.min) / (nextLvl.level.min - level.min)) * 100)
    : 100

  const totalEarned    = transactions.filter(t => t.type === 'earned').reduce((a,t) => a + t.points, 0)
  const totalRedeemed  = transactions.filter(t => t.type === 'redeemed').reduce((a,t) => a + t.points, 0)
  const totalVoided    = transactions.filter(t => t.type === 'voided').reduce((a,t) => a + Math.abs(t.points), 0)
  const totalSavings   = transactions.filter(t => t.type === 'redeemed')
    .reduce((a,t) => a + (t.discountAmount || 0), 0)

  return {
    level, nextLvl, progressPct,
    accumulated, available,
    totalEarned, totalRedeemed, totalVoided,
    totalSavings: parseFloat(totalSavings.toFixed(2)),
    transactions: [...transactions].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)),
    minRedeemPoints: config.minRedeemPoints,
    canRedeem:    available >= config.minRedeemPoints,
  }
}
