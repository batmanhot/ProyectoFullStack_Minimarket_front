// Constantes y utilidades compartidas entre los componentes del módulo Catálogo.
// Importar desde aquí evita duplicar estilos y helpers en cada archivo.

// ── Estilos Tailwind reutilizables ───────────────────────────────────────────
export const inputCls     = 'w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
export const labelCls     = 'block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1'
export const btnSecondary = 'flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700'
export const btnPrimary   = 'flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700'

// ── Paletas de colores ────────────────────────────────────────────────────────
export const CATEGORY_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#84cc16','#6366f1']
export const BRAND_COLORS    = ['#f97316','#3b82f6','#eab308','#8b5cf6','#ef4444','#06b6d4','#10b981','#ec4899','#0ea5e9','#84cc16']

// ── Generador de IDs locales (fallback sin crypto.randomUUID) ─────────────────
export function createSafeId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ── Punto de color para categorías y marcas ───────────────────────────────────
export function ColorDot({ color, size = 'sm' }) {
  const s = size === 'lg' ? 'w-5 h-5' : 'w-3 h-3'
  return <span className={`${s} rounded-full inline-block flex-shrink-0`} style={{ backgroundColor: color || '#94a3b8' }}/>
}
