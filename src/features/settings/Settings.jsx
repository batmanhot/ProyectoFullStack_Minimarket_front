import { useState, useRef } from 'react'
import { useStore } from '../../store/index'
import { useTenantSafe } from '../../context/TenantContext'
import { SECTORS } from '../../config/app'
import { STORAGE_KEYS } from '../../config/storageKeys'
import { locationService, notificationService } from '../../services/index'
import { USE_API } from '../../services/_base'
import toast from 'react-hot-toast'

// ─── Primitivos UI ───────────────────────────────────────────────────────────

const Section = ({ title, children }) => (
  <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-5 space-y-4">
    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700 pb-3">{title}</h3>
    {children}
  </div>
)

const Field = ({ label, sub, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-4">
    <div className="sm:flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-700 dark:text-slate-200">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
    <div className="w-full sm:w-auto sm:flex-shrink-0">{children}</div>
  </div>
)

const Toggle = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'}`}>
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`}/>
  </button>
)

const Input = ({ value, onChange, type='text', step, min, max, suffix, className }) => (
  <div className="flex items-center gap-1">
    <input type={type} value={value}
      onChange={e => onChange(type==='number' ? parseFloat(e.target.value)||0 : e.target.value)}
      step={step} min={min} max={max}
      className={`px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 dark:bg-slate-700 dark:text-slate-100 ${className||''}`}/>
    {suffix && <span className="text-xs text-gray-400 dark:text-slate-500">{suffix}</span>}
  </div>
)

// ─── Método de valorización de inventario ────────────────────────────────────

const COST_METHOD_SECTOR_DEFAULT = {
  bodega:      'peps', panaderia:  'peps', carniceria: 'peps', farmacia: 'peps',
  ferreteria:  'peps', repuestos:  'peps',
  boutique:    'cpp',  libreria:   'cpp',  regalos:    'cpp',
  electronica: 'cpp',  optica:     'cpp',  otro:       'cpp',
}

const COST_METHODS = [
  {
    id:    'peps',
    label: 'PEPS — Primero en Entrar, Primero en Salir',
    icon:  '🕐',
    desc:  'El costo de la salida se toma del lote/compra más antigua. Se alinea perfectamente con las estrategias FEFO y FIFO.',
    ideal: 'Bodega, farmacia, panadería, carnicería, ferretería, repuestos',
    color: 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  },
  {
    id:    'cpp',
    label: 'CPP — Costo Promedio Ponderado',
    icon:  '⚖️',
    desc:  'El costo unitario es el promedio de todas las unidades en stock, ponderado por cantidad. Se recalcula en cada compra.',
    ideal: 'Boutique, librería, electrónica, óptica, tiendas sin control de lotes',
    color: 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
]

function CostMethodSection({ sys, setSys, sector }) {
  const current    = sys.costMethod || 'peps'
  const suggested  = COST_METHOD_SECTOR_DEFAULT[sector] ?? 'peps'
  const isSuggested = current === suggested

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-slate-700 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">💰 Método de valorización de inventario</h3>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            Define cómo se calcula el costo de los productos cuando salen del almacén. Afecta los reportes de rentabilidad y el costo de ventas (COGS).
          </p>
        </div>
        {!isSuggested && (
          <button onClick={() => setSys({ ...sys, costMethod: suggested })}
            className="flex-shrink-0 text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 whitespace-nowrap">
            Usar sugerido
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-300">
        <span>💡</span>
        <span>
          Para tu sector <strong>({sector || 'no configurado'})</strong>, el método recomendado es{' '}
          <strong>{suggested === 'peps' ? 'PEPS' : 'CPP'}</strong>.
          {isSuggested ? ' ✓ Actualmente estás usando el método correcto.' : ' Considera cambiarlo.'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {COST_METHODS.map(m => {
          const isActive = current === m.id
          return (
            <button key={m.id} onClick={() => setSys({ ...sys, costMethod: m.id })}
              className={`text-left rounded-xl border-2 p-4 transition-all ${isActive ? m.color : 'border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{m.icon}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isActive ? m.badge : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                  {isActive ? 'Activo' : 'Inactivo'}
                </span>
                {m.id === suggested && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Recomendado</span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-800 dark:text-slate-100 mb-1">{m.label}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{m.desc}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500"><span className="font-medium">Ideal para:</span> {m.ideal}</p>
            </button>
          )
        })}
      </div>
      <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-700 rounded-lg text-xs text-gray-500 dark:text-slate-400">
        <span className="flex-shrink-0 mt-0.5">🇵🇪</span>
        <span>
          <strong className="text-gray-600 dark:text-slate-300">SUNAT:</strong> Ambos métodos (PEPS y CPP) están aceptados para efectos del Impuesto a la Renta.
          El método UEPS (LIFO) está <strong>prohibido en Perú</strong> desde 1994 y no está disponible.
          Una vez declarado el método ante SUNAT, debe aplicarse consistentemente en el ejercicio.
        </span>
      </div>
    </div>
  )
}

// ─── Gestión de Ubicaciones ──────────────────────────────────────────────────
function LocationsPanel() {
  const { locations, addLocation, updateLocation, deleteLocation } = useStore()
  const [newName, setNewName]   = useState('')
  const [newDesc, setNewDesc]   = useState('')
  const [newType, setNewType]   = useState('almacen')
  const [editId, setEditId]     = useState(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editType, setEditType] = useState('almacen')
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)
  const inputRef                = useRef(null)

  const TIPOS = [
    { value: 'almacen',   label: 'Almacén',   icon: '🏭' },
    { value: 'gondola',   label: 'Góndola',   icon: '🛒' },
    { value: 'mostrador', label: 'Mostrador', icon: '🪟' },
    { value: 'bodega',    label: 'Bodega',    icon: '📦' },
    { value: 'otro',      label: 'Otro',      icon: '📍' },
  ]
  const tipoIcon  = (t) => TIPOS.find(x => x.value === t)?.icon  || '📍'
  const tipoLabel = (t) => TIPOS.find(x => x.value === t)?.label || t

  const handleAdd = async () => {
    setError('')
    if (!newName.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    if (USE_API) {
      const r = await locationService.create({ name: newName.trim(), description: newDesc.trim(), type: newType })
      setSaving(false)
      if (r.error) { setError(r.error); return }
      toast.success(`Ubicación "${newName.trim()}" creada`)
    } else {
      const result = addLocation({ name: newName.trim(), description: newDesc.trim(), type: newType })
      setSaving(false)
      if (result.error) { setError(result.error); return }
      toast.success(`Ubicación "${result.location?.name}" creada`)
    }
    setNewName(''); setNewDesc(''); setNewType('almacen')
  }

  const handleUpdate = async () => {
    setError('')
    if (!editName.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    if (USE_API) {
      const r = await locationService.update(editId, { name: editName.trim(), description: editDesc.trim(), type: editType })
      setSaving(false)
      if (r.error) { setError(r.error); return }
      toast.success('Ubicación actualizada')
    } else {
      const result = updateLocation(editId, { name: editName.trim(), description: editDesc.trim(), type: editType })
      setSaving(false)
      if (result.error) { setError(result.error); return }
      toast.success('Ubicación actualizada')
    }
    setEditId(null)
  }

  const handleDelete = async (loc) => {
    setError('')
    if (USE_API) {
      const r = await locationService.remove(loc.id)
      if (r.error) { setError(r.error); return }
      toast.success(`Ubicación "${loc.name}" eliminada`)
    } else {
      const result = deleteLocation(loc.id)
      if (result.error) { setError(result.error); return }
      toast.success(`Ubicación "${loc.name}" eliminada`)
    }
  }

  const handleToggleActive = async (loc) => {
    if (USE_API) {
      const r = await locationService.update(loc.id, { isActive: !loc.isActive })
      if (r.error) { setError(r.error); return }
    } else {
      updateLocation(loc.id, { isActive: !loc.isActive })
    }
    toast.success(loc.isActive ? `"${loc.name}" desactivada` : `"${loc.name}" reactivada`)
  }

  const startEdit = (loc) => {
    setEditId(loc.id); setEditName(loc.name); setEditDesc(loc.description || ''); setEditType(loc.type || 'almacen'); setError('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const active   = locations.filter(l => l.isActive !== false)
  const inactive = locations.filter(l => l.isActive === false)
  const inputCls = 'px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100'

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-300">
        <span className="text-base flex-shrink-0">🏗️</span>
        <span>
          Define las <strong>ubicaciones físicas</strong> de tu negocio: almacenes, góndolas, mostradores, bodegas, salas de exhibición, etc.
          Luego asigna cada producto a una ubicación desde el <strong>Catálogo</strong> y realiza <strong>transferencias de stock</strong> entre ellas desde el módulo de Inventario.
          {USE_API && <span className="ml-1 text-blue-500 dark:text-blue-400">· Sincronizado con el backend ✓</span>}
        </span>
      </div>

      {locations.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {TIPOS.slice(0, 3).map(t => {
            const count = active.filter(l => l.type === t.value).length
            return (
              <div key={t.value} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 text-center">
                <p className="text-xl">{t.icon}</p>
                <p className="text-lg font-bold text-gray-800 dark:text-slate-100 mt-1">{count}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{t.label}{count !== 1 ? 's' : ''}</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700 pb-3">Nueva ubicación</h3>
        <div className="flex gap-3 flex-wrap">
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Nombre (ej: Almacén Principal, Góndola A)" className={`${inputCls} flex-1 min-w-40`}/>
          <select value={newType} onChange={e => setNewType(e.target.value)} className={`${inputCls} min-w-32`}>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
          </select>
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descripción opcional" className={`${inputCls} flex-1 min-w-40`}/>
          <button onClick={handleAdd} disabled={!newName.trim() || saving}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? 'Guardando…' : 'Agregar'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      {active.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
              Ubicaciones activas <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">{active.length}</span>
            </h3>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-700">
            {active.map(loc => (
              <div key={loc.id} className="px-5 py-3">
                {editId === loc.id ? (
                  <div className="flex gap-3 flex-wrap items-center">
                    <input ref={inputRef} value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUpdate()} className={`${inputCls} flex-1 min-w-32`}/>
                    <select value={editType} onChange={e => setEditType(e.target.value)} className={`${inputCls} min-w-28`}>
                      {TIPOS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                    </select>
                    <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descripción" className={`${inputCls} flex-1 min-w-32`}/>
                    <div className="flex gap-2">
                      <button onClick={handleUpdate} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40">{saving ? 'Guardando…' : 'Guardar'}</button>
                      <button onClick={() => { setEditId(null); setError('') }} className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400 transition-colors">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{tipoIcon(loc.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{loc.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">{tipoLabel(loc.type)}</span>
                      </div>
                      {loc.description && <p className="text-xs text-gray-400 dark:text-slate-500">{loc.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleToggleActive(loc)} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Desactivar</button>
                      <button onClick={() => startEdit(loc)} className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">Editar</button>
                      <button onClick={() => handleDelete(loc)} className="text-xs px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Eliminar</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden opacity-60">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400">Inactivas <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">{inactive.length}</span></h3>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-700">
            {inactive.map(loc => (
              <div key={loc.id} className="px-5 py-3 flex items-center gap-3">
                <span className="text-lg opacity-40">{tipoIcon(loc.type)}</span>
                <div className="flex-1"><p className="text-sm text-gray-400 dark:text-slate-500 line-through">{loc.name}</p></div>
                <button onClick={() => handleToggleActive(loc)} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Reactivar</button>
                <button onClick={() => handleDelete(loc)} className="text-xs px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 transition-colors">Eliminar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {locations.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">
          <div className="text-4xl mb-3">🏗️</div>
          <p className="text-sm font-medium">Sin ubicaciones configuradas</p>
          <p className="text-xs mt-1">Agrega la primera para organizar tu inventario por almacén, góndola o mostrador</p>
        </div>
      )}
    </div>
  )
}

// ─── Panel de Notificaciones por Email ───────────────────────────────────────
function NotificationsPanel() {
  const { businessConfig } = useStore()
  const [emailTo,     setEmailTo]     = useState(businessConfig?.email || '')
  const [sending,     setSending]     = useState(false)
  const [sendingType, setSendingType] = useState(null)
  const [smtpOk,      setSmtpOk]      = useState(null)
  const [lastResult,  setLastResult]  = useState(null)

  const handleTest = async () => {
    if (!emailTo.trim()) { toast.error('Ingresa un email de destino'); return }
    setSending(true); setSendingType('test'); setSmtpOk(null); setLastResult(null)
    const r = await notificationService.sendTest(emailTo.trim())
    setSending(false); setSendingType(null)
    if (r.error) {
      setSmtpOk(false); setLastResult(r.error); toast.error(r.error, { duration: 7000 })
    } else {
      setSmtpOk(true)
      setLastResult(r.data?.demo ? 'Modo demo — en producción se enviará el email real.' : 'Email de prueba enviado correctamente.')
      toast.success('✅ Email de prueba enviado')
    }
  }

  const handleSummary = async () => {
    if (!emailTo.trim()) { toast.error('Ingresa un email de destino'); return }
    setSending(true); setSendingType('summary'); setLastResult(null)
    const r = await notificationService.sendDailySummary(emailTo.trim())
    setSending(false); setSendingType(null)
    if (r.error) { setLastResult(r.error); toast.error(r.error, { duration: 6000 }) }
    else if (!r.data?.sent) { setLastResult('Sin alertas activas en este momento — el resumen no se envía si no hay alertas.'); toast('ℹ️ Sin alertas activas') }
    else { setLastResult(`Resumen enviado a ${r.data.to} · ${r.data.alertCount} alerta(s).`); toast.success(`📊 Resumen enviado — ${r.data.alertCount} alerta(s)`) }
  }

  const Spinner = () => <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300">
        <span className="text-base flex-shrink-0">⚙️</span>
        <div className="space-y-1">
          <p><strong>Configuración SMTP requerida en el servidor:</strong> Para que los emails funcionen en producción, el archivo <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded font-mono">.env</code> del backend debe tener configuradas las variables SMTP.</p>
          <div className="font-mono bg-amber-100 dark:bg-amber-900/40 rounded-lg px-3 py-2 text-[11px] space-y-0.5">
            <p>SMTP_HOST=smtp.gmail.com</p><p>SMTP_PORT=587</p><p>SMTP_USER=tu@email.com</p><p>SMTP_PASS=tu_app_password</p>
          </div>
          <p className="text-amber-500 dark:text-amber-400">En modo demo (sin backend), los emails se simulan en consola sin envío real.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700 pb-3">📧 Email de notificaciones</h3>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-56">
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Email de destino</label>
            <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="admin@tunegocio.com"
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"/>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Este email recibirá las alertas y el resumen diario</p>
          </div>
          <button onClick={handleTest} disabled={sending || !emailTo.trim()}
            className="px-4 py-2 text-sm font-medium border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-40 flex items-center gap-2 shrink-0">
            {sending && sendingType === 'test' ? <><Spinner/>Enviando…</> : <>✉️ Enviar email de prueba</>}
          </button>
        </div>
        {smtpOk !== null && (
          <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs ${smtpOk ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'}`}>
            <span className="shrink-0">{smtpOk ? '✅' : '❌'}</span><span>{lastResult}</span>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700 pb-3">🔔 Tipos de alerta disponibles</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 p-4 border border-gray-100 dark:border-slate-700 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">📊</span>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-slate-100">Resumen diario de alertas</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Email con todas las alertas activas agrupadas por severidad: stock bajo/sin stock, lotes próximos a vencer, créditos excedidos. Se envía solo si hay alertas.</p>
              </div>
            </div>
            <button onClick={handleSummary} disabled={sending || !emailTo.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1.5 shrink-0">
              {sending && sendingType === 'summary' ? <><Spinner/>Enviando…</> : <>📤 Enviar ahora</>}
            </button>
          </div>
          <div className="flex items-center justify-between gap-4 p-4 border border-gray-100 dark:border-slate-700 rounded-xl opacity-70">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">🔴</span>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-slate-100">Alerta automática de stock crítico</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Se dispara automáticamente cuando un producto alcanza stock cero. Requiere job programado (BullMQ/cron) en el backend.</p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 shrink-0 whitespace-nowrap">F7 — Próx.</span>
          </div>
          <div className="flex items-center justify-between gap-4 p-4 border border-gray-100 dark:border-slate-700 rounded-xl opacity-70">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">🕐</span>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-slate-100">Lotes próximos a vencer</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Alerta cuando un lote alcanza el umbral de días configurado (actualmente 30 días). Incluida en el resumen diario.</p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 shrink-0 whitespace-nowrap">En resumen diario ✓</span>
          </div>
        </div>
        {lastResult && sendingType === null && smtpOk === null && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            <span>ℹ️</span><span>{lastResult}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Panel de Correlativos ────────────────────────────────────────────────────
const SERIES = [
  { prefix: 'T001',  label: 'Ticket',             icon: '🎫', color: 'gray'   },
  { prefix: 'B001',  label: 'Boleta Electrónica',  icon: '📄', color: 'sky'    },
  { prefix: 'F001',  label: 'Factura Electrónica', icon: '🧾', color: 'indigo' },
  { prefix: 'NC001', label: 'Nota de Crédito',     icon: '↩️', color: 'violet' },
]

function Correlativos() {
  const { invoiceCounters = {}, nextInvoice = 1, setInvoiceCounter } = useStore()
  const [drafts, setDrafts] = useState({})
  const [saved,  setSaved]  = useState({})

  const currentFor = (prefix) => invoiceCounters[prefix] != null ? invoiceCounters[prefix] : nextInvoice

  const handleApply = (prefix) => {
    const raw = drafts[prefix]
    if (!raw) return
    const val = parseInt(raw, 10)
    if (isNaN(val) || val < 1) { toast.error('El número debe ser mayor a 0'); return }
    if (val < currentFor(prefix)) { toast.error(`No puedes retroceder el correlativo — el mínimo permitido es ${currentFor(prefix)}`); return }
    setInvoiceCounter(prefix, val)
    setDrafts(d => ({ ...d, [prefix]: '' }))
    setSaved(s => ({ ...s, [prefix]: true }))
    toast.success(`Correlativo ${prefix} actualizado — próximo: ${prefix}-${String(val).padStart(6, '0')}`)
    setTimeout(() => setSaved(s => ({ ...s, [prefix]: false })), 2500)
  }

  const clsBadge = {
    gray:   'bg-gray-100   dark:bg-gray-700     text-gray-600   dark:text-gray-300',
    sky:    'bg-sky-100    dark:bg-sky-900/30    text-sky-700    dark:text-sky-300',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
        <span className="text-base shrink-0">⚠️</span>
        <div>
          <p className="font-semibold mb-0.5">El correlativo solo puede avanzar, nunca retroceder</p>
          <p className="text-xs">SUNAT no permite reutilizar números ya emitidos. Si ingresas un número menor al actual, el sistema lo rechazará.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SERIES.map(({ prefix, label, icon, color }) => {
          const current = currentFor(prefix)
          const preview = prefix + '-' + String(current).padStart(6, '0')
          const draft   = drafts[prefix] || ''
          const isSaved = saved[prefix]
          return (
            <div key={prefix} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{label}</p>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full font-semibold ${clsBadge[color]}`}>{prefix}</span>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Próximo comprobante</p>
                <p className="text-base font-mono font-bold text-gray-800 dark:text-slate-100">{preview}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Correlativo interno: {current}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-2">Establecer nuevo inicio desde:</p>
                <div className="flex items-center gap-2">
                  <input type="number" min={current} step="1" value={draft}
                    onChange={e => setDrafts(d => ({ ...d, [prefix]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleApply(prefix)}
                    placeholder={String(current)}
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"/>
                  <button onClick={() => handleApply(prefix)} disabled={!draft}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 ${isSaved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                    {isSaved ? '✓ Aplicado' : 'Aplicar'}
                  </button>
                </div>
                {draft && parseInt(draft) > 0 && parseInt(draft) >= current && (
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-1.5 font-mono">Vista previa: {prefix}-{String(parseInt(draft)).padStart(6, '0')}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-300">
        <span className="shrink-0">ℹ️</span>
        <p>Usa esta configuración al <strong>migrar desde otro sistema</strong> o para continuar una serie existente. Por ejemplo, si tu última boleta emitida fue <strong>B001-000250</strong>, establece el inicio en <strong>251</strong>.</p>
      </div>
    </div>
  )
}

// ─── Tab: Datos del Negocio ──────────────────────────────────────────────────
function BusinessTab({ biz, setBiz, sys }) {
  const [logoError, setLogoError] = useState(false)
  const inputCls = 'px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100'

  const sector      = biz.sector || 'bodega'
  const recommended = COST_METHOD_SECTOR_DEFAULT[sector] ?? 'peps'
  const current     = sys.costMethod || 'peps'
  const match       = recommended === current
  const recLabel    = recommended === 'peps' ? 'PEPS' : 'CPP'
  const curLabel    = current     === 'peps' ? 'PEPS' : 'CPP'

  return (
    <Section title="🏪 Datos del negocio">
      <Field label="Nombre del negocio" sub="Aparece en tickets y reportes">
        <input value={biz.name||''} onChange={e => setBiz({...biz, name: e.target.value})} className={`${inputCls} w-full sm:w-48`}/>
      </Field>
      <Field label="RUC" sub="Número de contribuyente">
        <input value={biz.ruc||''} onChange={e => setBiz({...biz, ruc: e.target.value})} className={`${inputCls} w-full sm:w-40`}/>
      </Field>
      <Field label="Dirección" sub="Dirección del local">
        <input value={biz.address||''} onChange={e => setBiz({...biz, address: e.target.value})} className={`${inputCls} w-full sm:w-56`}/>
      </Field>
      <Field label="Teléfono" sub="Número de contacto">
        <input value={biz.phone||''} onChange={e => setBiz({...biz, phone: e.target.value})} className={`${inputCls} w-full sm:w-40`}/>
      </Field>
      <Field label="Correo del negocio" sub="Se usará para notificaciones y alertas del sistema">
        <input value={biz.email||''} onChange={e => setBiz({...biz, email: e.target.value})} type="email" placeholder="contacto@minegocio.com"
          className={`${inputCls} w-full sm:w-64`}/>
      </Field>
      <div>
        <Field label="Logo del negocio" sub="URL de imagen para tickets, reportes y encabezados">
          <input value={biz.logoUrl||''} onChange={e => { setBiz({...biz, logoUrl: e.target.value}); setLogoError(false) }} placeholder="https://..."
            className={`${inputCls} w-full sm:w-64`}/>
        </Field>
        {biz.logoUrl && !logoError && (
          <div className="mt-3 flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl">
            <img src={biz.logoUrl} alt="Logo preview" className="h-14 w-auto max-w-32 object-contain" onError={() => setLogoError(true)}/>
            <div className="text-xs text-gray-500 dark:text-slate-400"><p className="font-medium text-gray-700 dark:text-slate-300 mb-0.5">Vista previa del logo</p><p>Se aplicará en las boletas y reportes al guardar</p></div>
          </div>
        )}
        {logoError && biz.logoUrl && <p className="mt-1.5 text-xs text-red-500">⚠️ No se puede cargar la imagen — verifica la URL</p>}
      </div>
      <Field label="Rubro del negocio" sub="Tipo de negocio para el demo">
        <select value={biz.sector||'bodega'} onChange={e => setBiz({...biz, sector: e.target.value}) } className={inputCls}>
          {SECTORS.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
        </select>
      </Field>
      <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-xs border ${match ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'}`}>
        <span className="flex-shrink-0 text-sm mt-0.5">{match ? '✅' : '⚠️'}</span>
        <span>
          {match
            ? <>El método de valorización activo (<strong>{curLabel}</strong>) es el correcto para el rubro seleccionado.</>
            : <>Para el rubro <strong>{SECTORS.find(s => s.value === sector)?.label || sector}</strong> se recomienda el método <strong>{recLabel}</strong>, pero actualmente tienes configurado <strong>{curLabel}</strong>. Ve a la pestaña <strong>📦 Inventario</strong> para ajustarlo.</>
          }
        </span>
      </div>
      <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-600 dark:text-slate-300 mb-3">Vista previa — encabezado del ticket</p>
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-4 font-mono text-xs text-center text-gray-700 space-y-1" style={{ colorScheme: 'light' }}>
          {biz.logoUrl && !logoError && <div className="flex justify-center mb-2"><img src={biz.logoUrl} alt="Logo" className="max-h-16 w-auto object-contain" onError={() => setLogoError(true)}/></div>}
          <div className="font-bold text-sm">{biz.name || 'MI NEGOCIO'}</div>
          {biz.ruc     && <div>RUC: {biz.ruc}</div>}
          {biz.address && <div>{biz.address}</div>}
          {biz.phone   && <div>Tel: {biz.phone}</div>}
          <div className="border-t border-dashed border-gray-300 pt-1 mt-1">{sys.ticketFooter || '¡Gracias por su compra!'}</div>
        </div>
      </div>
    </Section>
  )
}

// ─── Tab: Fiscal ─────────────────────────────────────────────────────────────
function FiscalTab({ sys, setSys }) {
  return (
    <Section title="💰 Configuración fiscal y comercial">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-400">
        ℹ️ El cambio de IGV se aplica a <strong>todas las ventas nuevas</strong> desde el momento en que guardas. Las ventas ya registradas conservan el IGV con el que fueron emitidas.
      </div>
      <Field label="Tasa IGV" sub="Porcentaje de impuesto (Perú: 18% · Chile: 19% · Colombia: 19%)">
        <Input type="number" value={Math.round((sys.igvRate||0.18)*100*100)/100} onChange={v => setSys({...sys, igvRate: v/100})} step="0.5" min="0" max="50" suffix="%"/>
      </Field>
      <Field label="Prefijo de boleta" sub="Prefijo para el número de comprobante (ej: B001)">
        <input value={sys.invoicePrefix||'B001'} onChange={e => setSys({...sys, invoicePrefix: e.target.value})}
          className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-24 dark:bg-slate-700 dark:text-slate-100"/>
      </Field>
      <Field label="Moneda" sub="Símbolo de moneda en pantalla">
        <input value={sys.currencySymbol||'S/'} onChange={e => setSys({...sys, currencySymbol: e.target.value})}
          className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-20 dark:bg-slate-700 dark:text-slate-100"/>
      </Field>
      <Field label="Descuentos habilitados" sub="Permite aplicar descuentos en el POS">
        <Toggle value={sys.allowDiscounts !== false} onChange={v => setSys({...sys, allowDiscounts: v})}/>
      </Field>
      {sys.allowDiscounts !== false && (
        <Field label="Descuento máximo permitido" sub="Porcentaje máximo que puede aplicar un cajero">
          <Input type="number" value={sys.maxDiscountPct||50} onChange={v => setSys({...sys, maxDiscountPct: v})} min="0" max="100" suffix="%"/>
        </Field>
      )}
    </Section>
  )
}

// ─── Tab: Inventario ─────────────────────────────────────────────────────────
function InventoryTab({ sys, setSys, sector }) {
  return (
    <div className="space-y-4">
      <Section title="📦 Inventario y stock">
        <Field label="Stock mínimo por defecto" sub="Valor inicial de stockMin para nuevos productos">
          <Input type="number" value={sys.lowStockDefault||5} onChange={v => setSys({...sys, lowStockDefault: v})} min="0"/>
        </Field>
        <Field label="Alertas de stock habilitadas" sub="Muestra alertas cuando el stock cae al mínimo">
          <Toggle value={sys.stockAlertEnabled !== false} onChange={v => setSys({...sys, stockAlertEnabled: v})}/>
        </Field>
        <Field label="Días de alerta por vencimiento" sub="Días antes del vencimiento para mostrar alerta">
          <Input type="number" value={sys.expiryAlertDays||30} onChange={v => setSys({...sys, expiryAlertDays: v})} min="1" suffix="días"/>
        </Field>
        <Field label="Permitir stock negativo" sub="Permite vender aunque el stock llegue a cero">
          <Toggle value={sys.allowNegativeStock === true} onChange={v => setSys({...sys, allowNegativeStock: v})}/>
        </Field>
      </Section>
      <CostMethodSection sys={sys} setSys={setSys} sector={sector} />
    </div>
  )
}

// ─── Tab: POS / Caja ─────────────────────────────────────────────────────────
function POSTab({ sys, setSys }) {
  return (
    <>
      <Section title="🖥️ Punto de venta y caja">
        <Field label="Requerir caja abierta para vender" sub="Bloquea el POS si la caja no está aperturada">
          <Toggle value={sys.requireCashToSell !== false} onChange={v => setSys({...sys, requireCashToSell: v})}/>
        </Field>
        <Field label="Imprimir ticket automáticamente" sub="Abre ventana de impresión al completar la venta">
          <Toggle value={sys.printAutomatically === true} onChange={v => setSys({...sys, printAutomatically: v})}/>
        </Field>
        <Field label="Pie del ticket" sub="Texto que aparece al final de cada boleta">
          <input value={sys.ticketFooter||''} onChange={e => setSys({...sys, ticketFooter: e.target.value})} placeholder="¡Gracias por su compra!"
            className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64 dark:bg-slate-700 dark:text-slate-100"/>
        </Field>
      </Section>
      <Section title="🚀 Modo de operación">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400 mb-4">
          ⚠️ <strong>Modo Demo</strong>: muestra botones de acceso rápido en el login para facilitar presentaciones y pruebas. Desactívalo cuando el sistema esté en producción con usuarios y contraseñas reales configurados.
        </div>
        <Field label="Modo demo activo" sub="Muestra accesos rápidos por rol en la pantalla de login — desactiva en producción">
          <Toggle value={sys.demoMode !== false} onChange={v => setSys({...sys, demoMode: v})}/>
        </Field>
        {sys.demoMode !== false && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-xs text-blue-700 dark:text-blue-400">
            <p className="font-semibold mb-2">Credenciales del demo:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[['admin','admin123'],['cajero1','cajero123'],['cajero2','cajero123'],['supervisor','super123'],['gerente','gerente123']].map(([u,p]) => (
                <div key={u} className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-blue-100 dark:border-blue-900">
                  <span className="font-mono font-bold">{u}</span><span className="text-blue-400 mx-1">/</span><span className="font-mono">{p}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>
    </>
  )
}

// ─── Tab: Auditoría ──────────────────────────────────────────────────────────
function AuditTab({ sys, setSys }) {
  return (
    <Section title="🔍 Auditoría y seguridad">
      <Field label="Auditoría habilitada" sub="Registra todas las operaciones del sistema con trazabilidad completa">
        <Toggle value={sys.auditEnabled !== false} onChange={v => setSys({...sys, auditEnabled: v})}/>
      </Field>
      <Field label="Zona horaria" sub="Para cálculos de fechas y reportes">
        <select value={sys.timeZone||'America/Lima'} onChange={e => setSys({...sys, timeZone: e.target.value})}
          className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100">
          <option value="America/Lima">Lima (UTC-5)</option>
          <option value="America/Bogota">Bogotá (UTC-5)</option>
          <option value="America/Santiago">Santiago (UTC-4/-3)</option>
          <option value="America/Buenos_Aires">Buenos Aires (UTC-3)</option>
          <option value="America/Mexico_City">Ciudad de México (UTC-6/-5)</option>
        </select>
      </Field>
    </Section>
  )
}

// ─── Tab: Backup ─────────────────────────────────────────────────────────────
function BackupPanel({ tenantSlug, igvRate }) {
  const { loadDemoData, clearUserData } = useStore()
  const storeKey = `${STORAGE_KEYS.storePrefix}${tenantSlug}`
  const isDemo   = tenantSlug === 'demo'
  const [loadingDemo,  setLoadingDemo]  = useState(false)
  const [clearingData, setClearingData] = useState(false)

  const Spinner = () => (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  )

  const handleBackup = () => {
    try {
      const storeData = localStorage.getItem(storeKey)
      if (!storeData) { toast.error('No hay datos para respaldar en este negocio'); return }
      const backupObj = {
        _meta: { version: 2, tenant: tenantSlug, exportedAt: new Date().toISOString() },
        store: JSON.parse(storeData),
        quotations: JSON.parse(localStorage.getItem('pos_quotations') || '[]'),
      }
      const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `minimarket-backup-${tenantSlug}-${new Date().toISOString().split('T')[0]}.json`; a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup descargado correctamente')
    } catch { toast.error('Error al generar el backup') }
  }

  const handleRestore = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw    = ev.target?.result
        const parsed = JSON.parse(raw)
        const REQUIRED_KEYS = ['products','sales','clients','categories']
        let storeObj, quotationsArr
        if (parsed?._meta?.version >= 2 && parsed.store) { storeObj = parsed.store; quotationsArr = parsed.quotations || [] }
        else { storeObj = parsed; quotationsArr = null }
        const hasRequiredKeys = storeObj?.state && REQUIRED_KEYS.some(k => k in storeObj.state)
        if (!hasRequiredKeys) { toast.error('El archivo no es un backup válido de MiniMarket POS — verifica que sea el archivo correcto', { duration: 7000 }); return }
        localStorage.setItem(storeKey, JSON.stringify(storeObj))
        if (quotationsArr !== null) localStorage.setItem('pos_quotations', JSON.stringify(quotationsArr))
        toast.success(`✅ Restore completado para "${tenantSlug}" — recargando en 3 segundos...`, { duration: 8000 })
        setTimeout(() => window.location.reload(), 3000)
      } catch { toast.error('Error al leer el archivo de backup — verifica que el archivo no esté corrupto') }
    }
    reader.readAsText(file); e.target.value = ''
  }

  const handleClearData = () => {
    const answer = window.prompt('⚠️ Esta acción eliminará TODOS los productos, ventas, clientes y demás datos registrados.\n\nEscribe LIMPIAR para confirmar:')
    if (answer !== 'LIMPIAR') { if (answer !== null) toast.error('Texto incorrecto — escribe exactamente: LIMPIAR'); return }
    setClearingData(true)
    try { clearUserData(); toast.success('✅ Datos eliminados — el sistema quedó en blanco listo para tu información', { duration: 6000 }) }
    catch { toast.error('Error al limpiar los datos') }
    finally { setClearingData(false) }
  }

  return (
    <div className="space-y-4">
      {/* Backup */}
      <div className="rounded-xl overflow-hidden border border-blue-200 dark:border-blue-900">
        <div className="bg-blue-600 px-5 py-3 flex items-center gap-2">
          <span className="text-white text-base">💾</span>
          <span className="text-white text-sm font-bold tracking-wide">Copia de seguridad completa</span>
          <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-medium">{tenantSlug}</span>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 p-5 space-y-4">
          <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
            Descarga un archivo <strong>.json</strong> con <strong>todos</strong> los datos del negocio <strong>{tenantSlug}</strong>. Guárdalo antes de hacer cambios importantes, limpiar datos de demo o migrar a otro equipo.
          </p>
          <div className="flex justify-end">
            <button onClick={handleBackup} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Descargar backup — {tenantSlug}
            </button>
          </div>
        </div>
      </div>

      {/* Restore */}
      <div className="rounded-xl overflow-hidden border border-amber-200 dark:border-amber-900">
        <div className="bg-amber-500 px-5 py-3 flex items-center gap-2">
          <span className="text-white text-base">📂</span>
          <span className="text-white text-sm font-bold tracking-wide">Restaurar datos</span>
          <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-medium">Reemplaza todo</span>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/30 p-5 space-y-3">
          <div className="flex items-start gap-2 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            <span className="text-base leading-none">⚠️</span>
            <span><strong>Atención:</strong> Restaurar reemplaza <strong>todos los datos actuales</strong> de <strong>{tenantSlug}</strong>. Esta acción no se puede deshacer. La página se recargará automáticamente al finalizar.</span>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">Selecciona el archivo <strong>.json</strong> generado con "Descargar backup" para el negocio <strong>{tenantSlug}</strong>.</p>
          <div className="flex justify-end">
            <label className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"/></svg>
              Seleccionar archivo .json
              <input type="file" accept=".json" className="hidden" onChange={handleRestore}/>
            </label>
          </div>
        </div>
      </div>

      {/* Demo */}
      <div className="rounded-xl overflow-hidden border border-indigo-200 dark:border-indigo-900">
        <div className="bg-indigo-600 px-5 py-3 flex items-center gap-2">
          <span className="text-white text-base">🎯</span>
          <span className="text-white text-sm font-bold tracking-wide">Cargar datos demo completos</span>
          <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-medium">Para presentaciones</span>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-950/30 p-5 space-y-3">
          <p className="text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed">
            Inyecta el <strong>conjunto completo de datos demo</strong>: catálogo de productos, clientes, proveedores, marcas, categorías y <strong>30 días de ventas históricas</strong>. El IGV se ajusta al configurado en este negocio ({Math.round((igvRate ?? 0.18) * 100)}%). La configuración del negocio y el usuario activo no cambian.
          </p>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-indigo-600 dark:text-indigo-400">⚠️ Los productos, clientes y ventas actuales serán reemplazados por los datos demo.</p>
            <button onClick={async () => {
              setLoadingDemo(true)
              try { loadDemoData?.(); toast.success('✅ Datos demo cargados — Dashboard y Reportes ya tienen información completa', { duration: 5000 }) }
              catch { toast.error('Error al cargar demo') }
              finally { setLoadingDemo(false) }
            }} disabled={loadingDemo}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0">
              {loadingDemo ? <><Spinner/>Cargando...</> : <>🚀 Cargar demo completo</>}
            </button>
          </div>
        </div>
      </div>

      {/* Limpiar — solo modo demo */}
      {isDemo && (
        <div className="rounded-xl overflow-hidden border border-red-200 dark:border-red-900">
          <div className="bg-red-600 px-5 py-3 flex items-center gap-2">
            <span className="text-white text-base">🧹</span>
            <span className="text-white text-sm font-bold tracking-wide">Limpiar todos los datos</span>
            <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-semibold">Solo modo DEMO</span>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 p-5 space-y-4">
            <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">Elimina <strong>toda la información operativa</strong> registrada en el sistema para que puedas ingresar tu propia data desde cero.</p>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-red-500 dark:text-red-400">⚠️ <strong>Irreversible.</strong> Deberás escribir <code className="px-1 py-0.5 bg-red-100 dark:bg-red-900/50 rounded font-mono">LIMPIAR</code> para confirmar.</p>
              <button onClick={handleClearData} disabled={clearingData}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0">
                {clearingData ? <><Spinner/>Limpiando...</> : <>🧹 Limpiar todos los datos</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
const TABS = [
  { key: 'business',      label: '🏪 Negocio'       },
  { key: 'fiscal',        label: '💰 Fiscal'         },
  { key: 'correlativos',  label: '🧾 Correlativos'   },
  { key: 'inventory',     label: '📦 Inventario'     },
  { key: 'locations',     label: '📍 Ubicaciones'    },
  { key: 'notifications', label: '📧 Notificaciones' },
  { key: 'pos',           label: '🖥️ POS / Caja'    },
  { key: 'audit',         label: '🔍 Auditoría'      },
  { key: 'backup',        label: '💾 Backup'         },
]

export default function Settings() {
  const { businessConfig, systemConfig, updateBusinessConfig, updateSystemConfig } = useStore()
  const tenantCtx  = useTenantSafe()
  const tenantSlug = tenantCtx?.tenantSlug ?? 'demo'

  const [biz,       setBiz]       = useState({ ...businessConfig })
  const [sys,       setSys]       = useState({ costMethod: 'peps', ...systemConfig })
  const [saved,     setSaved]     = useState(false)
  const [activeTab, setActiveTab] = useState('business')

  const handleSave = () => {
    updateBusinessConfig(biz)
    updateSystemConfig({ ...sys, igvRate: parseFloat(sys.igvRate) || 0.18 })
    setSaved(true)
    toast.success('Configuración guardada — el IGV y el logo se aplican de inmediato')
    setTimeout(() => setSaved(false), 2500)
  }

  const saveBtnCls = `rounded-lg text-sm font-medium transition-all ${saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Configuración del sistema</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">Variables globales que afectan todo el sistema</p>
        </div>
        <button onClick={handleSave} className={`px-5 py-2 ${saveBtnCls}`}>
          {saved ? '✓ Guardado' : 'Guardar configuración'}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-2 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'business'      && <BusinessTab biz={biz} setBiz={setBiz} sys={sys} />}
      {activeTab === 'fiscal'        && <FiscalTab sys={sys} setSys={setSys} />}
      {activeTab === 'correlativos'  && <Correlativos />}
      {activeTab === 'inventory'     && <InventoryTab sys={sys} setSys={setSys} sector={biz.sector} />}
      {activeTab === 'locations'     && <LocationsPanel />}
      {activeTab === 'notifications' && <Section title="📧 Alertas por email"><NotificationsPanel /></Section>}
      {activeTab === 'pos'           && <POSTab sys={sys} setSys={setSys} />}
      {activeTab === 'audit'         && <AuditTab sys={sys} setSys={setSys} />}
      {activeTab === 'backup'        && <BackupPanel tenantSlug={tenantSlug} igvRate={sys.igvRate} />}

      <div className="flex justify-end">
        <button onClick={handleSave} className={`px-6 py-2.5 ${saveBtnCls}`}>
          {saved ? '✓ Configuración guardada' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  )
}
