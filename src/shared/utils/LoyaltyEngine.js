/**
 * LoyaltyEngine.js — Motor del Programa de Puntos
 * Ruta: src/shared/utils/LoyaltyEngine.js
 *
 * REGLAS (configurables en systemConfig):
 *   pointsPerSol     = 1 punto por cada S/ 10 en compras (default)
 *   pointsValue      = S/ 0.10 por punto al canjear (default)
 *   minRedeemPoints  = mínimo 50 puntos para canjear (default)
 *   expiryDays       = los puntos vencen a los 365 días (default)
 *
 * NIVELES:
 *   Bronce   → 0–499 pts acumulados
 *   Plata    → 500–1499 pts acumulados
 *   Oro      → 1500–3999 pts acumulados
 *   Platino  → 4000+ pts acumulados
 *
 * INTEGRACIÓN:
 *   1. addPointsToClient(clientId, saleTotal) → llamar al completar una venta
 *   2. redeemPoints(clientId, pointsToRedeem) → canjear en el POS
 *   3. getClientLevel(totalAccumulated)       → para el badge del cliente
 */

const HALF_UP = (n) => Math.floor(Number(n) * 100 + 0.5) / 100

export const LOYALTY_CONFIG_DEFAULTS = {
  pointsPerSol:    1,      // 1 punto por cada S/10 gastados → 0.1 pts/sol
  pointsValue:     0.10,   // S/ 0.10 por punto al canjear
  minRedeemPoints: 50,     // mínimo para canjear
  expiryDays:      365,    // puntos vencen en 1 año
  enabled:         true,
}

export const LOYALTY_LEVELS = [
  { name: 'Bronce',  min: 0,    max: 499,   icon: '🥉', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   multiplier: 1.0 },
  { name: 'Plata',   min: 500,  max: 1499,  icon: '🥈', color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200',   multiplier: 1.2 },
  { name: 'Oro',     min: 1500, max: 3999,  icon: '🥇', color: 'text-yellow-700',  bg: 'bg-yellow-50 border-yellow-200', multiplier: 1.5 },
  { name: 'Platino', min: 4000, max: Infinity, icon: '💎', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', multiplier: 2.0 },
]

/**
 * Calcula los puntos que gana una venta.
 * @param {number} saleTotal     - Total de la venta en S/
 * @param {number} totalAccumulated - Puntos acumulados del cliente (para nivel)
 * @param {Object} config        - Configuración del programa
 */
export function calcPointsEarned(saleTotal, totalAccumulated = 0, config = LOYALTY_CONFIG_DEFAULTS) {
  if (!config.enabled || saleTotal <= 0) return 0
  const level      = getClientLevel(totalAccumulated)
  const basePoints = Math.floor(saleTotal * config.pointsPerSol / 10)
  const earned     = Math.floor(basePoints * level.multiplier)
  return earned
}

/**
 * Calcula el descuento en S/ al canjear puntos.
 * @param {number} pointsToRedeem - Puntos a canjear
 * @param {Object} config         - Configuración del programa
 */
export function calcRedemptionValue(pointsToRedeem, config = LOYALTY_CONFIG_DEFAULTS) {
  if (pointsToRedeem < config.minRedeemPoints) return 0
  return HALF_UP(pointsToRedeem * config.pointsValue)
}

/** Retorna el nivel del cliente según sus puntos acumulados totales */
export function getClientLevel(totalAccumulated = 0) {
  return LOYALTY_LEVELS.findLast((l) => totalAccumulated >= l.min) || LOYALTY_LEVELS[0]
}

/** Retorna el siguiente nivel y cuántos puntos faltan */
export function getNextLevel(totalAccumulated = 0) {
  const nextLevel = LOYALTY_LEVELS.find((l) => totalAccumulated < l.min)
  if (!nextLevel) return null
  return {
    level:       nextLevel,
    pointsNeeded: nextLevel.min - totalAccumulated,
  }
}

/**
 * Filtra puntos vencidos de la lista de transacciones del cliente.
 * Los puntos se vencen por transacción, no globalmente.
 */
export function getActivePoints(transactions = [], config = LOYALTY_CONFIG_DEFAULTS) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - config.expiryDays)
  return transactions
    .filter((t) => t.type === 'earned' && new Date(t.createdAt) >= cutoff)
    .reduce((acc, t) => acc + t.points, 0)
  - transactions
    .filter((t) => t.type === 'redeemed')
    .reduce((acc, t) => acc + t.points, 0)
}

/**
 * Genera el slice de datos de lealtad para agregar al modelo de cliente.
 * Llamar al crear un cliente nuevo.
 */
export function createLoyaltyProfile() {
  return {
    loyaltyPoints:       0,   // puntos disponibles para canjear
    loyaltyAccumulated:  0,   // total histórico (para nivel)
    loyaltyTransactions: [],  // historial de acumulación/canje
    loyaltyLevel:        'Bronce',
  }
}

/**
 * Genera el objeto de transacción al acumular puntos.
 */
export function buildEarnTransaction(points, saleId, invoiceNumber, saleTotal) {
  return {
    id:            crypto.randomUUID(),
    type:          'earned',
    points,
    saleId,
    invoiceNumber,
    saleTotal,
    createdAt:     new Date().toISOString(),
    description:   `Compra ${invoiceNumber} · S/${saleTotal}`,
  }
}

/**
 * Genera el objeto de transacción al canjear puntos.
 */
export function buildRedeemTransaction(points, discountAmount, saleId, invoiceNumber) {
  return {
    id:            crypto.randomUUID(),
    type:          'redeemed',
    points,
    discountAmount,
    saleId,
    invoiceNumber,
    createdAt:     new Date().toISOString(),
    description:   `Canje en ${invoiceNumber} · -${points} pts → S/${discountAmount} desc.`,
  }
}
