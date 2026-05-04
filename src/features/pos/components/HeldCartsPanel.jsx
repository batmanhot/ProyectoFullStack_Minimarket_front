/**
 * HeldCartsPanel.jsx — Panel de carritos en espera
 * Ruta: src/features/pos/components/HeldCartsPanel.jsx
 *
 * Muestra la cola de ventas suspendidas con:
 *  - Label del cliente / número de venta
 *  - Cantidad de ítems y total estimado
 *  - Tiempo en espera
 *  - Botones: Recuperar | Descartar
 */

import { formatCurrency } from '../../../shared/utils/helpers'

function timeAgo(isoDate) {
  const secs = Math.floor((Date.now() - new Date(isoDate)) / 1000)
  if (secs < 60)  return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}min`
  return `${Math.floor(secs / 3600)}h`
}

export default function HeldCartsPanel({ heldCarts, onRecover, onDiscard, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <div>
            <h2 className="font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
              ⏸️ Ventas en espera
            </h2>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              {heldCarts.length} de 5 slots usados
            </p>
          </div>
          <button onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Lista */}
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {heldCarts.length === 0 ? (
            <div className="text-center py-10 text-gray-300 dark:text-slate-600">
              <div className="text-4xl mb-2">⏸️</div>
              <p className="text-sm">No hay ventas en espera</p>
            </div>
          ) : (
            heldCarts.map((hold) => {
              const total     = hold.items.reduce((a, i) => a + (i.netTotal ?? i.unitPrice * i.quantity), 0)
              const unitCount = hold.items.reduce((a, i) => a + (i.quantity ?? 1), 0)

              return (
                <div key={hold.id}
                  className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">
                      {hold.label}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-slate-400">
                      <span>📦 {hold.items.length} prod · {unitCount} uds.</span>
                      <span>⏱️ hace {timeAgo(hold.createdAt)}</span>
                    </div>
                    {/* Mini preview de ítems */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {hold.items.slice(0, 3).map((item, i) => (
                        <span key={i} className="text-[10px] bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-md">
                          {item.productName?.split(' ').slice(0, 2).join(' ')}
                        </span>
                      ))}
                      {hold.items.length > 3 && (
                        <span className="text-[10px] text-amber-500">+{hold.items.length - 3} más</span>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="text-right shrink-0">
                    <p className="text-base font-black text-amber-700 dark:text-amber-400">
                      {formatCurrency(total)}
                    </p>
                  </div>

                  {/* Acciones */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={() => onRecover(hold.id)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                      Recuperar
                    </button>
                    <button onClick={() => onDiscard(hold.id)}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs font-medium rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors">
                      Descartar
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 text-center">
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Las ventas en espera se pierden al cerrar la aplicación
          </p>
        </div>
      </div>
    </div>
  )
}
