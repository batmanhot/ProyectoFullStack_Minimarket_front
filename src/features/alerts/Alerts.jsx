import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { formatDateTime } from '../../shared/utils/helpers'
import Modal from '../../shared/components/ui/Modal'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import toast from 'react-hot-toast'

const ALERT_TYPES = [
  { value: 'stock_bajo',     label: 'Stock bajo',           icon: '📦', desc: 'Cuando el stock de un producto cae al mínimo configurado' },
  { value: 'por_vencer',     label: 'Producto por vencer',  icon: '🗓️', desc: 'Cuando un producto está próximo a su fecha de vencimiento' },
  { value: 'deuda_alta',     label: 'Deuda de cliente',     icon: '💰', desc: 'Cuando un cliente supera un monto de deuda configurado' },
  { value: 'venta_alta',     label: 'Venta de alto valor',  icon: '🎯', desc: 'Cuando una venta supera un monto configurado' },
  { value: 'sin_movimiento', label: 'Sin movimiento',       icon: '⏸️', desc: 'Productos sin ventas en N días' },
  { value: 'caja_diferencia',label: 'Diferencia en caja',   icon: '🔐', desc: 'Cuando el arqueo de caja tiene una diferencia mayor a X' },
]

const PRIORITIES = [
  { value: 'alta',   label: 'Alta',   color: 'bg-red-100 text-red-600' },
  { value: 'media',  label: 'Media',  color: 'bg-amber-100 text-amber-700' },
  { value: 'baja',   label: 'Baja',   color: 'bg-blue-100 text-blue-700' },
]

function AlertForm({ rule, onClose }) {
  const { addAlertRule, updateAlertRule } = useStore()
  const [type, setType]           = useState(rule?.type || 'stock_bajo')
  const [threshold, setThreshold] = useState(rule?.threshold || '')
  const [priority, setPriority]   = useState(rule?.priority || 'media')
  const [name, setName]           = useState(rule?.name || '')
  const [active, setActive]       = useState(rule?.isActive !== false)

  const typeConfig = ALERT_TYPES.find(t => t.value === type)
  const thresholdLabel = {
    stock_bajo:     'Cantidad mínima de stock para alertar',
    por_vencer:     'Días antes del vencimiento para alertar',
    deuda_alta:     'Monto mínimo de deuda (S/) para alertar',
    venta_alta:     'Monto mínimo de venta (S/) para alertar',
    sin_movimiento: 'Días sin movimiento para alertar',
    caja_diferencia:'Diferencia máxima aceptable en caja (S/)',
  }[type]

  const handleSave = () => {
    if (!name.trim())        { toast.error('Ingresa un nombre para la alerta'); return }
    if (!threshold || isNaN(threshold)) { toast.error('Ingresa un valor de umbral válido'); return }
    const data = { type, name: name.trim(), threshold: parseFloat(threshold), priority, isActive: active }
    if (rule) { updateAlertRule(rule.id, data); toast.success('Alerta actualizada') }
    else      { addAlertRule(data);              toast.success('Alerta creada')      }
    onClose()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre de la alerta *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Stock crítico bebidas" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Tipo de alerta *</label>
        <div className="grid grid-cols-2 gap-2">
          {ALERT_TYPES.map(t => (
            <button key={t.value} onClick={() => setType(t.value)}
              className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-all ${type === t.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <span className="text-lg flex-shrink-0">{t.icon}</span>
              <div><div className={`text-xs font-medium ${type === t.value ? 'text-blue-700' : 'text-gray-700'}`}>{t.label}</div></div>
            </button>
          ))}
        </div>
        {typeConfig && <p className="text-xs text-gray-400 mt-2 italic">{typeConfig.desc}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{thresholdLabel} *</label>
        <input type="number" min="0" step="1" value={threshold} onChange={e => setThreshold(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: 5"/>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Prioridad</label>
        <div className="flex gap-2">
          {PRIORITIES.map(p => (
            <button key={p.value} onClick={() => setPriority(p.value)} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${priority === p.value ? `${p.color} border-current border-opacity-40` : 'border-gray-200 text-gray-500'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setActive(!active)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? 'bg-blue-600' : 'bg-gray-200'}`}>
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${active ? 'translate-x-4' : 'translate-x-1'}`}/>
        </button>
        <span className="text-sm text-gray-600">{active ? 'Alerta activa' : 'Alerta inactiva'}</span>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose}    className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
        <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{rule ? 'Guardar cambios' : 'Crear alerta'}</button>
      </div>
    </div>
  )
}

export default function Alerts() {
  const { alertRules, deleteAlertRule, updateAlertRule, notifications, markAllNotifsRead, clearNotifications } = useStore()
  const [modal, setModal]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [tab, setTab]       = useState('rules')

  const unread = (notifications||[]).filter(n => !n.read).length

  const priorityOrder = { alta: 0, media: 1, baja: 2 }
  const sortedRules = [...(alertRules||[])].sort((a,b) => (priorityOrder[a.priority]||1) - (priorityOrder[b.priority]||1))

  const handleToggle = (rule) => {
    updateAlertRule(rule.id, { isActive: !rule.isActive })
    toast.success(`Alerta ${rule.isActive ? 'desactivada' : 'activada'}`)
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800">Gestión de Alertas</h1>
          <p className="text-sm text-gray-400">{alertRules?.length || 0} reglas configuradas · {unread} notificaciones sin leer</p>
        </div>
        <button onClick={() => setModal({ type: 'form', data: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nueva alerta
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('rules')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${tab==='rules'?'bg-white shadow text-blue-600':'text-gray-500'}`}>Reglas ({alertRules?.length||0})</button>
        <button onClick={() => setTab('notifs')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${tab==='notifs'?'bg-white shadow text-blue-600':'text-gray-500'}`}>
          Notificaciones {unread>0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{unread}</span>}
        </button>
      </div>

      {tab === 'rules' && (
        <>
          {sortedRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="text-5xl opacity-20">🔔</div>
              <p className="text-gray-400 text-sm font-medium">No hay alertas configuradas</p>
              <p className="text-gray-300 text-xs">Crea reglas para recibir notificaciones automáticas</p>
              <button onClick={() => setModal({ type: 'form', data: null })} className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Crear primera alerta</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {sortedRules.map(rule => {
                const typeCfg = ALERT_TYPES.find(t => t.value === rule.type)
                const priCfg  = PRIORITIES.find(p => p.value === rule.priority)
                return (
                  <div key={rule.id} className={`bg-white border rounded-xl p-4 ${!rule.isActive ? 'opacity-50' : 'border-gray-100'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{typeCfg?.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-800">{rule.name}</div>
                          <div className="text-xs text-gray-400">{typeCfg?.label}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priCfg?.color}`}>{priCfg?.label}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mb-3">
                      Umbral: <span className="font-medium text-gray-700">{rule.threshold}</span>
                      {['deuda_alta','venta_alta','caja_diferencia'].includes(rule.type) ? ' S/' : ['por_vencer','sin_movimiento'].includes(rule.type) ? ' días' : ' unidades'}
                    </div>
                    <div className="flex items-center justify-between">
                      <button onClick={() => handleToggle(rule)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.isActive ? 'bg-blue-600' : 'bg-gray-200'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${rule.isActive ? 'translate-x-4' : 'translate-x-1'}`}/>
                      </button>
                      <div className="flex gap-1">
                        <button onClick={() => setModal({ type: 'form', data: rule })} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                        <button onClick={() => setDeleteTarget(rule)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'notifs' && (
        <div className="space-y-3">
          {notifications?.length > 0 && (
            <div className="flex gap-2">
              <button onClick={markAllNotifsRead}  className="px-3 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Marcar todas como leídas</button>
              <button onClick={clearNotifications} className="px-3 py-1.5 text-xs border border-red-100 text-red-500 rounded-lg hover:bg-red-50">Limpiar notificaciones</button>
            </div>
          )}
          {(!notifications || notifications.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3"><div className="text-5xl opacity-20">🔕</div><p className="text-gray-400 text-sm">Sin notificaciones</p></div>
          ) : (
            <div className="space-y-2">
              {notifications.map(n => (
                <div key={n.id} className={`bg-white border rounded-xl p-4 flex items-start gap-3 ${!n.read ? 'border-blue-100 bg-blue-50' : 'border-gray-100'}`}>
                  <span className="text-xl">{n.icon || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{n.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{n.message}</div>
                    <div className="text-xs text-gray-400 mt-1">{formatDateTime(n.createdAt)}</div>
                  </div>
                  {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5"/>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal?.type === 'form' && (
        <Modal title={modal.data ? 'Editar alerta' : 'Nueva alerta'} size="md" onClose={() => setModal(null)}>
          <AlertForm rule={modal.data} onClose={() => setModal(null)}/>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="¿Eliminar esta alerta?"
          message={`Se eliminará la regla "${deleteTarget.name}" permanentemente.`}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={() => { deleteAlertRule(deleteTarget.id); toast.success('Alerta eliminada'); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
