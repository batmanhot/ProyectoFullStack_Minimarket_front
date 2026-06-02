import { useStore } from '../../../store/index'
import { syncQueue } from '../../utils/syncQueue'
import { formatDateTime } from '../../utils/helpers'
import { X, RefreshCw, Trash2, CheckCircle, AlertTriangle, Clock, Wifi, WifiOff } from 'lucide-react'

// ── Etiquetas legibles por tipo de operación ──────────────────────────────────
const TYPE_LABEL = {
  'sale.create':      { label: 'Venta',                 icon: '🖥️' },
  'sale.cancel':      { label: 'Cancelación de venta',  icon: '❌' },
  'return.create':    { label: 'Devolución / NC',        icon: '↩️' },
  'return.anular':    { label: 'Anulación de NC',        icon: '🚫' },
  'cash.open':        { label: 'Apertura de caja',       icon: '💰' },
  'cash.close':       { label: 'Cierre de caja',         icon: '🔒' },
  'client.create':    { label: 'Nuevo cliente',          icon: '👤' },
  'client.update':    { label: 'Actualización cliente',  icon: '✏️' },
  'purchase.create':  { label: 'Compra',                 icon: '🛍️' },
}

const STATUS_CFG = {
  pending:  { label: 'Pendiente',  bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-200 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-400',  Icon: Clock },
  syncing:  { label: 'Enviando…',  bg: 'bg-blue-50 dark:bg-blue-900/20',    border: 'border-blue-200 dark:border-blue-700',   text: 'text-blue-700 dark:text-blue-400',    Icon: RefreshCw },
  conflict: { label: 'Conflicto',  bg: 'bg-red-50 dark:bg-red-900/20',      border: 'border-red-200 dark:border-red-700',     text: 'text-red-600 dark:text-red-400',      Icon: AlertTriangle },
  error:    { label: 'Error red',  bg: 'bg-red-50 dark:bg-red-900/20',      border: 'border-red-200 dark:border-red-700',     text: 'text-red-600 dark:text-red-400',      Icon: AlertTriangle },
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export default function SyncQueuePanel({ onClose }) {
  const { offlineQueue, clearResolvedOps, removeOfflineOp, isSyncing } = useStore()
  const isOnline = navigator.onLine

  const pending   = offlineQueue.filter(op => op.status === 'pending').length
  const syncing   = offlineQueue.filter(op => op.status === 'syncing').length
  const conflicts = offlineQueue.filter(op => op.status === 'conflict').length
  const errors    = offlineQueue.filter(op => op.status === 'error').length
  const hasResolved = conflicts > 0 || errors > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isOnline ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
              {isOnline
                ? <Wifi size={18} className="text-green-600 dark:text-green-400" />
                : <WifiOff size={18} className="text-amber-600 dark:text-amber-400" />
              }
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-slate-100">Cola de sincronización</h2>
              <p className="text-xs text-gray-400 dark:text-slate-400">
                {isOnline ? 'Conectado' : 'Sin conexión'} · {offlineQueue.length} operación(es) en cola
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-slate-700 border-b border-gray-100 dark:border-slate-700">
          {[
            { label: 'Pendientes', count: pending + syncing, color: 'text-amber-600 dark:text-amber-400' },
            { label: 'Enviando',   count: syncing,           color: 'text-blue-600 dark:text-blue-400'   },
            { label: 'Conflictos', count: conflicts,         color: 'text-red-600 dark:text-red-400'     },
            { label: 'Errores',    count: errors,            color: 'text-red-500 dark:text-red-400'     },
          ].map(({ label, count, color }) => (
            <div key={label} className="py-3 px-2 text-center">
              <div className={`text-lg font-black ${color}`}>{count}</div>
              <div className="text-xs text-gray-400 dark:text-slate-500">{label}</div>
            </div>
          ))}
        </div>

        {/* ── Lista ──────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {offlineQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
              <CheckCircle size={42} className="text-green-400" />
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Todo sincronizado</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">No hay operaciones pendientes.</p>
            </div>
          ) : (
            offlineQueue.map(op => {
              const typeCfg   = TYPE_LABEL[op.type] ?? { label: op.type, icon: '⚙️' }
              const statusCfg = STATUS_CFG[op.status] ?? STATUS_CFG.pending
              const { Icon: StatusIcon } = statusCfg
              return (
                <div key={op.id} className={`flex items-start gap-3 p-3 rounded-xl border ${statusCfg.bg} ${statusCfg.border}`}>
                  <span className="text-lg leading-none mt-0.5 flex-shrink-0">{typeCfg.icon}</span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-700 dark:text-slate-200">{typeCfg.label}</span>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${statusCfg.text}`}>
                        <StatusIcon size={10} className={op.status === 'syncing' ? 'animate-spin' : ''} />
                        {statusCfg.label}
                      </span>
                      {op.attempts > 0 && (
                        <span className="text-xs text-gray-400 dark:text-slate-500">· intento {op.attempts}/3</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">{formatDateTime(op.createdAt)}</div>
                    {op.error && (
                      <div className={`mt-1.5 text-xs rounded px-2 py-1 ${statusCfg.text} bg-white/60 dark:bg-black/20`} title={op.error}>
                        {op.error}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => removeOfflineOp(op.id)}
                    title="Descartar esta operación"
                    className="flex-shrink-0 mt-0.5 text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors p-0.5 rounded"
                  >
                    <X size={13} />
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* ── Acciones ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-gray-100 dark:border-slate-700">
          {hasResolved && (
            <button
              onClick={clearResolvedOps}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Trash2 size={13} />
              Limpiar conflictos/errores
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {!isOnline && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <WifiOff size={12} /> Sin conexión
              </span>
            )}
            <button
              onClick={() => syncQueue({ silent: false })}
              disabled={!isOnline || (pending + syncing) === 0 || isSyncing}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Sincronizando…' : `Sincronizar (${pending})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
