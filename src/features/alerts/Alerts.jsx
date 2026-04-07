import { useState, useMemo, useEffect } from 'react'
import { useStore } from '../../store/index'
import { formatCurrency, formatDateTime, formatDate, daysUntil } from '../../shared/utils/helpers'
import Modal from '../../shared/components/ui/Modal'
import toast from 'react-hot-toast'

// ─── Tipos de alerta con su lógica de detección ──────────────────────────────
const ALERT_DEFS = [
  { type: 'stock_bajo',      icon: '📦', label: 'Stock bajo',             severity: 'alta',  color: { bg: 'bg-red-50',     border: 'border-red-200',    badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500'    } },
  { type: 'sin_stock',       icon: '🚫', label: 'Sin stock',              severity: 'alta',  color: { bg: 'bg-red-100',    border: 'border-red-300',    badge: 'bg-red-200 text-red-800',    dot: 'bg-red-600'    } },
  { type: 'por_vencer',      icon: '🗓️', label: 'Próximo a vencer',       severity: 'media', color: { bg: 'bg-amber-50',   border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700',dot: 'bg-amber-500'  } },
  { type: 'producto_vencido',icon: '⛔', label: 'Producto vencido',       severity: 'alta',  color: { bg: 'bg-red-50',     border: 'border-red-200',    badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500'    } },
  { type: 'deuda_alta',      icon: '💰', label: 'Deuda de cliente',       severity: 'media', color: { bg: 'bg-orange-50',  border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' } },
  { type: 'sin_movimiento',  icon: '⏸️', label: 'Sin movimiento 30 días', severity: 'baja',  color: { bg: 'bg-blue-50',    border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',  dot: 'bg-blue-500'   } },
  { type: 'caja_diferencia', icon: '🔐', label: 'Diferencia en caja',     severity: 'alta',  color: { bg: 'bg-purple-50',  border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' } },
  { type: 'venta_alta',      icon: '🎯', label: 'Venta de alto valor',    severity: 'info',  color: { bg: 'bg-teal-50',    border: 'border-teal-200',   badge: 'bg-teal-100 text-teal-700',  dot: 'bg-teal-500'   } },
]

const SEVERITY_ORDER = { alta: 0, media: 1, baja: 2, info: 3 }
const STATUS_CONFIG = {
  activa:     { label: 'Activa',      bg: 'bg-red-100 text-red-700',      icon: '🔴' },
  en_proceso: { label: 'En proceso',  bg: 'bg-amber-100 text-amber-700',  icon: '🟡' },
  subsanada:  { label: 'Subsanada',   bg: 'bg-green-100 text-green-700',  icon: '✅' },
}

// ─── Genera alertas automáticas a partir del estado del sistema ────────────────
function detectAlerts(products, clients, sales, cashSessions, systemConfig) {
  const alerts = []
  const id = (type, entityId) => `${type}::${entityId}`

  // 1. Stock bajo y sin stock
  products.filter(p => p.isActive).forEach(p => {
    if (p.stock === 0) {
      alerts.push({ id: id('sin_stock', p.id), type: 'sin_stock', entityId: p.id,
        title: `Sin stock: ${p.name}`, message: `El producto "${p.name}" no tiene unidades disponibles. Realizar pedido al proveedor.`,
        action: 'Ir a Compras para registrar entrada de mercadería o ajustar stock en Inventario.',
        createdAt: new Date().toISOString() })
    } else if (p.stock <= p.stockMin) {
      alerts.push({ id: id('stock_bajo', p.id), type: 'stock_bajo', entityId: p.id,
        title: `Stock bajo: ${p.name}`, message: `Stock actual: ${p.stock} ${p.unit} (mínimo: ${p.stockMin}). Necesita reabastecimiento.`,
        action: 'Ir a Compras → Nueva entrada de mercadería para reponer stock.',
        createdAt: new Date().toISOString() })
    }
  })

  // 2. Vencimiento
  products.filter(p => p.isActive && p.expiryDate).forEach(p => {
    const days = daysUntil(p.expiryDate)
    if (days !== null && days < 0) {
      alerts.push({ id: id('producto_vencido', p.id), type: 'producto_vencido', entityId: p.id,
        title: `Producto vencido: ${p.name}`, message: `Venció hace ${Math.abs(days)} día(s). No debe venderse. Retirar de la exhibición.`,
        action: 'Ir a Inventario → Ajustar stock con tipo "Merma" para registrar la baja del producto.',
        createdAt: new Date().toISOString() })
    } else if (days !== null && days <= (systemConfig?.expiryAlertDays || 30)) {
      alerts.push({ id: id('por_vencer', p.id), type: 'por_vencer', entityId: p.id,
        title: `Por vencer: ${p.name}`, message: `Vence en ${days} día(s) (${formatDate(p.expiryDate)}). Stock: ${p.stock} unidades.`,
        action: 'Considerar descuento especial para acelerar la venta, o planificar la disposición final.',
        createdAt: new Date().toISOString() })
    }
  })

  // 3. Deuda de clientes
  clients.filter(c => c.isActive && (c.currentDebt || 0) > 0).forEach(c => {
    const limitPct = c.creditLimit > 0 ? ((c.currentDebt / c.creditLimit) * 100).toFixed(0) : 100
    alerts.push({ id: id('deuda_alta', c.id), type: 'deuda_alta', entityId: c.id,
      title: `Deuda pendiente: ${c.name}`, message: `Deuda: ${formatCurrency(c.currentDebt)}${c.creditLimit > 0 ? ` (${limitPct}% del límite ${formatCurrency(c.creditLimit)})` : ''}. Teléfono: ${c.phone || 'no registrado'}.`,
      action: 'Ir a Clientes → botón de pago (💳) para registrar el cobro y generar el recibo de pago.',
      createdAt: new Date().toISOString() })
  })

  // 4. Sin movimiento > 30 días
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)
  const movIds = new Set(sales.filter(s => new Date(s.createdAt) >= cutoff).flatMap(s => s.items?.map(i => i.productId) || []))
  const noMov  = products.filter(p => p.isActive && p.stock > 0 && !movIds.has(p.id))
  if (noMov.length > 0) {
    const capitalInmov = noMov.reduce((a, p) => a + p.priceBuy * p.stock, 0)
    alerts.push({ id: 'sin_movimiento::global', type: 'sin_movimiento', entityId: 'global',
      title: `${noMov.length} producto(s) sin movimiento 30 días`, message: `Capital inmovilizado: ${formatCurrency(capitalInmov)}. Productos: ${noMov.slice(0,3).map(p=>p.name).join(', ')}${noMov.length > 3 ? ` y ${noMov.length-3} más.` : '.'}`,
      action: 'Ir a Reportes → pestaña "Sin movimiento" para ver el listado completo. Evaluar liquidación o promociones.',
      createdAt: new Date().toISOString() })
  }

  // 5. Diferencia en caja (últimos 5 cierres)
  cashSessions.slice(0, 5).forEach(s => {
    if (Math.abs(s.difference || 0) > 1) {
      const tipo = (s.difference || 0) > 0 ? 'sobrante' : 'faltante'
      alerts.push({ id: id('caja_diferencia', s.id), type: 'caja_diferencia', entityId: s.id,
        title: `Diferencia en caja: ${tipo} de ${formatCurrency(Math.abs(s.difference))}`, message: `Cierre del ${formatDate(s.closedAt || s.openedAt)} por ${s.userName || '—'}. Diferencia: ${formatCurrency(s.difference)}.`,
        action: 'Revisar el historial de ventas del turno en Caja → Ver detalle del cierre. Comunicar al supervisor.',
        createdAt: s.closedAt || s.openedAt })
    }
  })

  return alerts.sort((a, b) => {
    const defA = ALERT_DEFS.find(d => d.type === a.type)
    const defB = ALERT_DEFS.find(d => d.type === b.type)
    return (SEVERITY_ORDER[defA?.severity] ?? 9) - (SEVERITY_ORDER[defB?.severity] ?? 9)
  })
}

// ─── Formulario de seguimiento ─────────────────────────────────────────────────
function TrackingForm({ alert, tracking, onSave, onClose }) {
  const def = ALERT_DEFS.find(d => d.type === alert.type)
  const existing = tracking[alert.id] || {}
  const [status, setStatus] = useState(existing.status || 'activa')
  const [note, setNote]     = useState('')
  const [history]           = useState(existing.history || [])

  const handleSave = () => {
    const newEntry = { status, note: note.trim(), timestamp: new Date().toISOString() }
    onSave(alert.id, { status, history: [...history, ...(note.trim() ? [newEntry] : [{ ...newEntry, note: null }])] })
    toast.success(`Alerta marcada como: ${STATUS_CONFIG[status]?.label}`)
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-xl p-4 border ${def?.color.bg} ${def?.color.border}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">{def?.icon}</span>
          <div className="flex-1">
            <div className="font-semibold text-gray-800 text-sm">{alert.title}</div>
            <div className="text-xs text-gray-600 mt-1 leading-relaxed">{alert.message}</div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-blue-700 mb-1">💡 Acción recomendada</p>
        <p className="text-sm text-blue-800 leading-relaxed">{alert.action}</p>
      </div>

      {history.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Historial de seguimiento</p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {history.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span>{STATUS_CONFIG[h.status]?.icon || '•'}</span>
                <div className="flex-1">
                  <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${STATUS_CONFIG[h.status]?.bg}`}>{STATUS_CONFIG[h.status]?.label}</span>
                  {h.note && <span className="text-gray-600 ml-2">{h.note}</span>}
                  <div className="text-gray-400 mt-0.5">{formatDateTime(h.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Actualizar estado</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setStatus(key)}
              className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${status === key ? cfg.bg + ' border-current shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
          placeholder="Nota de seguimiento (opcional)..."
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
      </div>

      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
        <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">Guardar seguimiento</button>
      </div>
    </div>
  )
}

// ─── Página principal de Alertas ──────────────────────────────────────────────
export default function Alerts() {
  const { products, clients, sales, cashSessions, systemConfig } = useStore()
  const [tracking, setTracking]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_alert_tracking') || '{}') } catch { return {} }
  })
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [filterStatus, setFilterStatus]   = useState('todas')
  const [filterType, setFilterType]       = useState('todas')

  // Guardar tracking en localStorage
  useEffect(() => {
    localStorage.setItem('pos_alert_tracking', JSON.stringify(tracking))
  }, [tracking])

  const allAlerts = useMemo(() =>
    detectAlerts(products, clients, sales, cashSessions, systemConfig)
  , [products, clients, sales, cashSessions, systemConfig])

  const enriched = useMemo(() => allAlerts.map(a => ({
    ...a,
    status:  tracking[a.id]?.status  || 'activa',
    history: tracking[a.id]?.history || [],
  })), [allAlerts, tracking])

  const filtered = useMemo(() => enriched.filter(a => {
    if (filterStatus !== 'todas' && a.status !== filterStatus) return false
    if (filterType   !== 'todas' && a.type   !== filterType)   return false
    return true
  }), [enriched, filterStatus, filterType])

  const counts = useMemo(() => ({
    total:      enriched.length,
    activas:    enriched.filter(a => a.status === 'activa').length,
    en_proceso: enriched.filter(a => a.status === 'en_proceso').length,
    subsanadas: enriched.filter(a => a.status === 'subsanada').length,
    altas:      enriched.filter(a => ALERT_DEFS.find(d=>d.type===a.type)?.severity === 'alta' && a.status === 'activa').length,
  }), [enriched])

  const handleSaveTracking = (alertId, data) => {
    setTracking(prev => ({ ...prev, [alertId]: data }))
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800">Alertas automáticas del sistema</h1>
          <p className="text-sm text-gray-400">Detectadas en tiempo real · {counts.activas} activas · {counts.subsanadas} subsanadas</p>
        </div>
        <button onClick={() => setTracking({})} className="text-xs text-gray-400 hover:text-red-500 px-3 py-1.5 border border-gray-200 rounded-lg hover:border-red-200">
          Limpiar seguimientos
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
          <p className="text-xs text-red-600 mb-1">🔴 Prioridad Alta</p>
          <p className="text-2xl font-bold text-red-700">{counts.altas}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
          <p className="text-xs text-amber-600 mb-1">🟡 En proceso</p>
          <p className="text-2xl font-bold text-amber-700">{counts.en_proceso}</p>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">📋 Total detectadas</p>
          <p className="text-2xl font-bold text-gray-700">{counts.total}</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
          <p className="text-xs text-orange-600 mb-1">🔴 Activas</p>
          <p className="text-2xl font-bold text-orange-700">{counts.activas}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-3">
          <p className="text-xs text-green-600 mb-1">✅ Subsanadas</p>
          <p className="text-2xl font-bold text-green-700">{counts.subsanadas}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[{k:'todas',l:'Todas'},{k:'activa',l:'Activas'},{k:'en_proceso',l:'En proceso'},{k:'subsanada',l:'Subsanadas'}].map(f => (
            <button key={f.k} onClick={() => setFilterStatus(f.k)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterStatus===f.k?'bg-white shadow text-blue-600':'text-gray-500'}`}>{f.l}</button>
          ))}
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="todas">Todos los tipos</option>
          {ALERT_DEFS.map(d => <option key={d.type} value={d.type}>{d.icon} {d.label}</option>)}
        </select>
      </div>

      {/* Lista de alertas */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="text-6xl">🎉</div>
          <p className="text-lg font-medium text-gray-600">¡Sin alertas activas!</p>
          <p className="text-sm text-gray-400">El sistema no detectó problemas en este momento</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(alert => {
            const def  = ALERT_DEFS.find(d => d.type === alert.type)
            const stat = STATUS_CONFIG[alert.status]
            const isSubsanada = alert.status === 'subsanada'
            return (
              <div
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                  isSubsanada
                    ? 'bg-green-50 border-green-200 opacity-75'
                    : `${def?.color.bg} ${def?.color.border}`
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icono + dot de severidad */}
                  <div className="relative flex-shrink-0">
                    <span className="text-2xl">{isSubsanada ? '✅' : def?.icon}</span>
                    {!isSubsanada && (
                      <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${def?.color.dot}`}/>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="font-semibold text-gray-800 text-sm">{alert.title}</div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${def?.color.badge}`}>{def?.label}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stat?.bg}`}>{stat?.icon} {stat?.label}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">{alert.message}</p>

                    {/* Acción recomendada */}
                    {!isSubsanada && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-xs">💡</span>
                        <p className="text-xs text-gray-500 italic">{alert.action}</p>
                      </div>
                    )}

                    {/* Último seguimiento */}
                    {alert.history.length > 0 && (
                      <div className="mt-2 text-xs text-gray-400">
                        Último seguimiento: {formatDateTime(alert.history[alert.history.length-1].timestamp)}
                        {alert.history[alert.history.length-1].note && ` · "${alert.history[alert.history.length-1].note}"`}
                      </div>
                    )}
                  </div>

                  {/* Flecha */}
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de seguimiento */}
      {selectedAlert && (
        <Modal
          title="Seguimiento de alerta"
          subtitle={`${ALERT_DEFS.find(d=>d.type===selectedAlert.type)?.label} · ${STATUS_CONFIG[tracking[selectedAlert.id]?.status || 'activa']?.label}`}
          onClose={() => setSelectedAlert(null)}
        >
          <TrackingForm
            alert={selectedAlert}
            tracking={tracking}
            onSave={handleSaveTracking}
            onClose={() => setSelectedAlert(null)}
          />
        </Modal>
      )}
    </div>
  )
}
