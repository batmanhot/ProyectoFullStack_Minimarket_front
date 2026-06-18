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
            <div className="flex flex-col gap-4 py-2">

              {/* Estado vacío */}
              <div className="flex flex-col items-center gap-2 text-center py-4">
                <CheckCircle size={38} className="text-green-400" />
                <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Todo sincronizado</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">No hay operaciones pendientes.</p>
              </div>

              {/* ── Panel informativo: Sincronización offline-first ── */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-hidden">

                {/* Cabecera */}
                <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-700/50">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isOnline ? 'bg-green-600' : 'bg-amber-500'}`}>
                    {isOnline
                      ? <Wifi size={14} className="text-white" />
                      : <WifiOff size={14} className="text-white" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">Sincronización offline-first</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">Operación continua sin internet</p>
                  </div>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    isOnline ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'
                  }`}>
                    {isOnline ? 'EN LÍNEA' : 'OFFLINE'}
                  </span>
                </div>

                {/* Cuerpo */}
                <div className="px-4 py-3 space-y-3">

                  {/* Definición */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Sistema que permite al POS <span className="font-semibold">seguir operando con normalidad</span> aunque
                    se corte la conexión a internet. Todas las ventas, cancelaciones y movimientos de caja
                    se guardan localmente y se <span className="font-semibold">envían al servidor en cuanto la conexión se restablece</span>,
                    de forma automática y sin pérdida de datos.
                  </p>

                  {/* Pasos */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Cómo funciona</p>

                    {[
                      {
                        n: '1',
                        color: 'bg-slate-600 dark:bg-slate-500',
                        txt: <>Al detectar <span className="font-semibold">pérdida de conexión</span>, el sistema activa el modo offline automáticamente. El cajero <span className="font-semibold">no nota ninguna interrupción</span> en el flujo de ventas.</>,
                      },
                      {
                        n: '2',
                        color: 'bg-slate-600 dark:bg-slate-500',
                        txt: <>Cada operación (venta, cancelación, apertura/cierre de caja) se <span className="font-semibold">encola localmente</span> en el navegador con todos sus datos completos.</>,
                      },
                      {
                        n: '3',
                        color: 'bg-green-600',
                        txt: <>Al <span className="font-semibold">recuperar internet</span>, el sistema detecta la reconexión y envía automáticamente todas las operaciones encoladas al servidor en un solo lote.</>,
                      },
                      {
                        n: '4',
                        color: 'bg-slate-600 dark:bg-slate-500',
                        txt: <>El servidor aplica <span className="font-semibold">resolución de conflictos</span>: si una venta ya existe (misma ID), la ignora sin error. Si detecta inconsistencias, las marca como conflicto para revisión manual.</>,
                      },
                      {
                        n: '5',
                        color: 'bg-slate-600 dark:bg-slate-500',
                        txt: <>También puedes disparar la sincronización <span className="font-semibold">manualmente</span> en cualquier momento usando el botón "Sincronizar" de abajo, mientras haya conexión disponible.</>,
                      },
                    ].map(({ n, color, txt }) => (
                      <div key={n} className="flex items-start gap-2">
                        <span className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${color}`}>{n}</span>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{txt}</p>
                      </div>
                    ))}
                  </div>

                  {/* Operaciones soportadas */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Operaciones que se sincronizan</p>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { icon: '🖥️', label: 'Ventas' },
                        { icon: '❌', label: 'Cancelaciones' },
                        { icon: '↩️', label: 'Devoluciones / NC' },
                        { icon: '💰', label: 'Apertura de caja' },
                        { icon: '🔒', label: 'Cierre de caja' },
                        { icon: '🚫', label: 'Anulación de NC' },
                      ].map(({ icon, label }) => (
                        <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className="text-sm leading-none">{icon}</span>
                          <span>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { val: '3',  unit: 'reintentos',  color: 'text-slate-700 dark:text-slate-200' },
                      { val: '1',  unit: 'lote batch',  color: 'text-slate-700 dark:text-slate-200' },
                      { val: '0',  unit: 'pérd. datos', color: 'text-green-600 dark:text-green-400' },
                    ].map(({ val, unit, color }) => (
                      <div key={unit} className="rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-2 text-center">
                        <p className={`text-lg font-black leading-none ${color}`}>{val}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">{unit}</p>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
              {/* ── Fin panel ── */}

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
