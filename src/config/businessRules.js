/**
 * Reglas de negocio centralizadas del sistema POS Minimarket.
 *
 * IMPORTANTE: Cualquier cambio en estas constantes debe replicarse en
 * back/minimarket-api/src/config/businessRules.js para mantener
 * la coherencia entre frontend y backend.
 */

// ── Programa de lealtad ───────────────────────────────────────────────────────
export const LOYALTY = {
  // Puntos acumulados históricos para alcanzar cada nivel — DEBEN coincidir
  // con back/minimarket-api/src/config/businessRules.js LOYALTY.LEVEL_*
  LEVEL_PLATINO:  4000,
  LEVEL_ORO:      1500,
  LEVEL_PLATA:     500,

  // Multiplicadores de puntos por nivel (base = floor(total / POINTS_DIVISOR))
  RATE_PLATINO: 2.0,
  RATE_ORO:     1.5,
  RATE_PLATA:   1.2,
  RATE_BRONCE:  1.0,
  // Alias para compatibilidad con código existente
  RATE_HIGH:  2.0,
  RATE_MID:   1.5,
  RATE_BASE:  1.0,

  // Divisor del total de venta para calcular puntos base
  POINTS_DIVISOR: 10,

  // Nombres de niveles (deben coincidir con el enum del backend)
  LEVELS: {
    PLATINO: 'platino',
    ORO:     'oro',
    PLATA:   'plata',
    BRONCE:  'bronce',
  },
}

// ── Inventario / Alertas ──────────────────────────────────────────────────────
export const INVENTORY = {
  // Días restantes para considerar un producto como "próximo a vencer"
  EXPIRY_WARNING_DAYS: 30,

  // Días sin movimiento para considerar un producto como "sin rotación"
  NO_MOVEMENT_DAYS: 30,
}

// ── Cotizaciones ──────────────────────────────────────────────────────────────
export const QUOTATION = {
  DEFAULT_VALID_DAYS: 7,
}

// ── POS ───────────────────────────────────────────────────────────────────────
export const POS_RULES = {
  // Descuento máximo por ítem (fallback si no hay config de sistema)
  DEFAULT_MAX_DISCOUNT_PCT: 50,

  // Máximo de ventas en espera simultáneas por caja
  MAX_HELD_CARTS: 5,

  // Resultados máximos en buscador del POS
  SEARCH_MAX_RESULTS: 8,
}

// ── Reserva de stock (multi-caja) ─────────────────────────────────────────────
export const STOCK_RESERVE = {
  // Renovar la reserva a los 8 min (TTL del backend es 10 min)
  RENEW_MS: 8 * 60 * 1000,
}

// ── Sincronización offline ────────────────────────────────────────────────────
export const SYNC = {
  MAX_RETRIES:    3,
  BATCH_SIZE:     1,
}

// ── Control de stock ──────────────────────────────────────────────────────────
export const STOCK_CONTROL = {
  SIMPLE:     'simple',
  BATCH_FEFO: 'lote_fefo',
  BATCH_FIFO: 'lote_fifo',
  SERIAL:     'serie',
}

// ── Tipos de producto ─────────────────────────────────────────────────────────
// El frontend usa 'simple', el backend almacena 'normal'.
// productService.js hace la conversión al normalizar la respuesta del backend.
export const PRODUCT_TYPE = {
  SIMPLE:  'simple',   // nombre en frontend
  NORMAL:  'normal',   // nombre en backend (BD)
  BUNDLE:  'bundle',
  SERVICE: 'service',
}

// ── Estados de serial ─────────────────────────────────────────────────────────
export const SERIAL_STATUS = {
  AVAILABLE: 'disponible',
  SOLD:      'vendido',
  INACTIVE:  'dado_baja',
}

// ── Estados de lote ───────────────────────────────────────────────────────────
export const BATCH_STATUS = {
  ACTIVE:    'activo',
  EXHAUSTED: 'agotado',
  EXPIRED:   'vencido',
}
