import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { formatCurrency, formatDate, formatDateTime } from '../../shared/utils/helpers'
import Modal from '../../shared/components/ui/Modal'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import toast from 'react-hot-toast'

// ─── Paleta de colores por tipo ───────────────────────────────────────────────
const TYPE_CFG = {
  pct:   { label: 'Porcentaje',     icon: '%',   color: 'bg-blue-600',   light: 'bg-blue-50 text-blue-700 border-blue-200' },
  fixed: { label: 'Monto fijo',     icon: 'S/',  color: 'bg-teal-600',   light: 'bg-teal-50 text-teal-700 border-teal-200' },
}

// ─── Badge de estado del ticket ───────────────────────────────────────────────
function TicketStatusBadge({ ticket }) {
  if (!ticket.isActive) return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500">Inactivo</span>
  if (ticket.used)      return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-600">Canjeado</span>
  const now = new Date()
  if (ticket.validFrom && now < new Date(ticket.validFrom)) return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-600">Programado</span>
  if (ticket.validTo   && now > new Date(ticket.validTo + 'T23:59:59')) return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-600">Vencido</span>
  return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 flex items-center gap-1 w-fit"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block"/>Vigente</span>
}

// ─── Generar código alfanumérico único ────────────────────────────────────────
function genCode(prefix = 'DSC') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = prefix + '-'
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// ══════════════════════════════════════════════════════════════════════════════
// FORMULARIO DE TICKET
// ══════════════════════════════════════════════════════════════════════════════
function TicketForm({ ticket, onClose }) {
  const { addDiscountTicket, updateDiscountTicket } = useStore()
  const editing = !!ticket

  const [code,          setCode]         = useState(ticket?.code         || genCode())
  const [holderName,    setHolderName]   = useState(ticket?.holderName   || '')
  const [holderDoc,     setHolderDoc]    = useState(ticket?.holderDoc    || '')
  const [campaignName,  setCampaignName] = useState(ticket?.campaignName || '')
  const [discountType,  setDiscountType] = useState(ticket?.discountType || 'pct')
  const [discountValue, setDiscountValue]= useState(ticket?.discountValue || '')
  const [maxAmount,     setMaxAmount]    = useState(ticket?.maxAmount     || '')
  const [validFrom,     setValidFrom]    = useState(ticket?.validFrom     || '')
  const [validTo,       setValidTo]      = useState(ticket?.validTo       || '')
  const [notes,         setNotes]        = useState(ticket?.notes         || '')
  const [isActive,      setIsActive]     = useState(ticket?.isActive      !== false)
  const [errors,        setErrors]       = useState({})

  const inputCls = "w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelCls = "block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1"

  const validate = () => {
    const e = {}
    if (!code.trim())          e.code = 'El código es obligatorio'
    if (!holderName.trim())    e.holderName = 'Ingresa el nombre del beneficiario'
    if (!discountValue || parseFloat(discountValue) <= 0) e.discountValue = 'Ingresa el valor del descuento'
    if (discountType === 'pct' && parseFloat(discountValue) > 100) e.discountValue = 'El porcentaje no puede superar 100%'
    if (!validFrom)            e.validFrom = 'Fecha de inicio requerida'
    if (!validTo)              e.validTo   = 'Fecha de término requerida'
    if (validFrom && validTo && new Date(validFrom) > new Date(validTo)) e.validTo = 'La fecha de término debe ser posterior al inicio'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    const data = {
      id:            ticket?.id || crypto.randomUUID(),
      code:          code.trim().toUpperCase(),
      holderName:    holderName.trim(),
      holderDoc:     holderDoc.trim(),
      campaignName:  campaignName.trim(),
      discountType,
      discountValue: parseFloat(discountValue),
      maxAmount:     maxAmount ? parseFloat(maxAmount) : null,
      validFrom,
      validTo,
      notes:         notes.trim(),
      isActive,
      used:          ticket?.used || false,
      usedAt:        ticket?.usedAt || null,
      usedInSale:    ticket?.usedInSale || null,
      usedByUser:    ticket?.usedByUser || null,
      createdAt:     ticket?.createdAt || new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
    }

    if (editing) {
      updateDiscountTicket(ticket.id, data)
      toast.success('Ticket actualizado')
    } else {
      addDiscountTicket(data)
      toast.success(`Ticket ${data.code} creado`)
    }
    onClose()
  }

  const pctVal   = discountType === 'pct'   ? parseFloat(discountValue) || 0 : 0
  const fixedVal = discountType === 'fixed' ? parseFloat(discountValue) || 0 : 0
  const maxAmt   = maxAmount ? parseFloat(maxAmount) : null

  return (
    <div className="space-y-5">

      {/* Código + estado */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Código del ticket *</label>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setErrors(ev => ({...ev, code: undefined})) }}
              className={inputCls + ' font-mono tracking-widest uppercase ' + (errors.code ? 'border-red-400' : '')}
              placeholder="DSC-XXXXXXXX"
              disabled={editing && ticket.used}
            />
            {!editing && (
              <button type="button" onClick={() => setCode(genCode())}
                className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700 whitespace-nowrap shrink-0">
                🔀 Generar
              </button>
            )}
          </div>
          {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code}</p>}
        </div>
        <div>
          <label className={labelCls}>Estado</label>
          <button type="button" onClick={() => setIsActive(!isActive)} disabled={editing && ticket.used}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-semibold transition-all ${
              isActive ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-slate-800/50 dark:border-slate-600'
            }`}>
            <span>{isActive ? '✓' : '○'}</span>
            {isActive ? 'Activo' : 'Inactivo'}
          </button>
        </div>
      </div>

      {/* Beneficiario */}
      <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Datos del beneficiario</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Nombre completo *</label>
            <input value={holderName} onChange={e => { setHolderName(e.target.value); setErrors(ev => ({...ev, holderName: undefined})) }}
              className={inputCls + (errors.holderName ? ' border-red-400' : '')}
              placeholder="Ej: María García López"/>
            {errors.holderName && <p className="text-xs text-red-500 mt-1">{errors.holderName}</p>}
          </div>
          <div>
            <label className={labelCls}>DNI / RUC (opcional)</label>
            <input value={holderDoc} onChange={e => setHolderDoc(e.target.value)}
              className={inputCls} placeholder="DNI o RUC"/>
          </div>
          <div>
            <label className={labelCls}>Campaña / Motivo</label>
            <input value={campaignName} onChange={e => setCampaignName(e.target.value)}
              className={inputCls} placeholder="Ej: Día de la Madre 2025"/>
          </div>
        </div>
      </div>

      {/* Tipo y valor de descuento */}
      <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Configuración del descuento</p>

        {/* Selector tipo */}
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(TYPE_CFG).map(([val, cfg]) => (
            <button key={val} type="button" onClick={() => setDiscountType(val)}
              className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                discountType === val
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-black shrink-0 ${cfg.color}`}>
                {cfg.icon}
              </div>
              <div>
                <p className={`text-xs font-semibold ${discountType === val ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-slate-200'}`}>{cfg.label}</p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500">
                  {val === 'pct' ? 'Descuento en % sobre el total' : 'Descuento en soles fijos'}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Valor del descuento */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>
              {discountType === 'pct' ? 'Porcentaje de descuento *' : 'Monto a descontar (S/) *'}
            </label>
            <div className="relative">
              {discountType === 'fixed' && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 dark:text-slate-500 pointer-events-none">S/</span>
              )}
              <input
                type="number" min="0.01" step={discountType === 'pct' ? '1' : '0.50'}
                value={discountValue}
                onChange={e => { setDiscountValue(e.target.value); setErrors(ev => ({...ev, discountValue: undefined})) }}
                className={inputCls + ' font-mono ' + (discountType === 'pct' ? 'pr-8' : 'pl-8') + (errors.discountValue ? ' border-red-400' : '')}
                placeholder={discountType === 'pct' ? '10' : '20.00'}
              />
              {discountType === 'pct' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 dark:text-slate-500 pointer-events-none">%</span>
              )}
            </div>
            {errors.discountValue && <p className="text-xs text-red-500 mt-1">{errors.discountValue}</p>}
          </div>
          {discountType === 'pct' && (
            <div>
              <label className={labelCls}>Monto máximo a descontar (S/)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 dark:text-slate-500 pointer-events-none">S/</span>
                <input type="number" min="0.01" step="0.50" value={maxAmount}
                  onChange={e => setMaxAmount(e.target.value)}
                  className={inputCls + ' pl-8 font-mono'}
                  placeholder="Sin límite"/>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">Opcional — tope máximo del descuento</p>
            </div>
          )}
        </div>

        {/* Preview */}
        {parseFloat(discountValue) > 0 && (
          <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-blue-200 rounded-xl p-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 ${TYPE_CFG[discountType].color}`}>
              {discountType === 'pct' ? `${discountValue}%` : `S/${discountValue}`}
            </div>
            <div className="text-xs text-gray-600 dark:text-slate-300 space-y-0.5">
              {discountType === 'pct' ? (
                <>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">
                    {pctVal}% de descuento sobre el total
                    {maxAmt ? ` (máx. S/ ${maxAmt.toFixed(2)})` : ''}
                  </p>
                  <p className="text-gray-400 dark:text-slate-500">Ej: venta de S/ 200 → ahorro de S/ {(200 * pctVal / 100).toFixed(2)}{maxAmt && 200 * pctVal / 100 > maxAmt ? ` (tope: S/ ${maxAmt.toFixed(2)})` : ''}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-teal-700 dark:text-teal-300">Descuento fijo de S/ {parseFloat(discountValue).toFixed(2)}</p>
                  <p className="text-gray-400 dark:text-slate-500">Se descuentan exactamente S/ {fixedVal.toFixed(2)} del total</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Vigencia */}
      <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Período de vigencia</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Válido desde *</label>
            <input type="date" value={validFrom}
              onChange={e => { setValidFrom(e.target.value); setErrors(ev => ({...ev, validFrom: undefined})) }}
              className={inputCls + (errors.validFrom ? ' border-red-400' : '')}/>
            {errors.validFrom && <p className="text-xs text-red-500 mt-1">{errors.validFrom}</p>}
          </div>
          <div>
            <label className={labelCls}>Válido hasta *</label>
            <input type="date" value={validTo}
              onChange={e => { setValidTo(e.target.value); setErrors(ev => ({...ev, validTo: undefined})) }}
              className={inputCls + (errors.validTo ? ' border-red-400' : '')}/>
            {errors.validTo && <p className="text-xs text-red-500 mt-1">{errors.validTo}</p>}
          </div>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className={labelCls}>Notas internas (opcional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className={inputCls + ' resize-none'}
          placeholder="Observaciones para uso interno del equipo..."/>
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
          Cancelar
        </button>
        <button type="button" onClick={handleSave}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
          {editing ? 'Guardar cambios' : 'Crear ticket'}
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CARD de ticket
// ══════════════════════════════════════════════════════════════════════════════
function TicketCard({ ticket, onEdit, onToggle, onDelete }) {
  const cfg = TYPE_CFG[ticket.discountType] || TYPE_CFG.pct

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow ${ticket.used ? 'border-gray-200 opacity-75' : ticket.isActive ? 'border-green-200' : 'border-gray-200'}`}>

      {/* Franja superior de color */}
      <div className={`h-1.5 ${ticket.used ? 'bg-red-400' : ticket.isActive ? 'bg-green-400' : 'bg-gray-300'}`}/>

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 ${cfg.color}`}>
              {ticket.discountType === 'pct' ? `${ticket.discountValue}%` : 'S/'}
            </div>
            <div className="min-w-0">
              <code className="font-mono font-bold text-gray-800 dark:text-slate-100 text-sm tracking-wider block">
                {ticket.code}
              </code>
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{ticket.holderName}</p>
            </div>
          </div>
          <TicketStatusBadge ticket={ticket}/>
        </div>

        {/* Descuento destacado */}
        <div className={`rounded-xl px-3 py-2 border text-center ${cfg.light}`}>
          <p className="text-lg font-black">
            {ticket.discountType === 'pct'
              ? `${ticket.discountValue}% de descuento`
              : `S/ ${ticket.discountValue.toFixed(2)} de descuento`}
          </p>
          {ticket.discountType === 'pct' && ticket.maxAmount && (
            <p className="text-[11px] opacity-70">máx. S/ {ticket.maxAmount.toFixed(2)}</p>
          )}
        </div>

        {/* Detalles */}
        <div className="space-y-1 text-xs text-gray-500 dark:text-slate-400">
          {ticket.holderDoc && (
            <div className="flex justify-between">
              <span>Documento</span>
              <span className="font-medium">{ticket.holderDoc}</span>
            </div>
          )}
          {ticket.campaignName && (
            <div className="flex justify-between">
              <span>Campaña</span>
              <span className="font-medium truncate max-w-[55%] text-right">{ticket.campaignName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Vigencia</span>
            <span className="font-medium">{formatDate(ticket.validFrom)} — {formatDate(ticket.validTo)}</span>
          </div>
          {ticket.used && ticket.usedAt && (
            <div className="flex justify-between text-red-500">
              <span>Canjeado</span>
              <span className="font-medium">{formatDate(ticket.usedAt)}</span>
            </div>
          )}
          {ticket.notes && (
            <p className="italic text-gray-400 dark:text-slate-500 pt-0.5">{ticket.notes}</p>
          )}
        </div>

        {/* Acciones */}
        <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-slate-700">
          {!ticket.used && (
            <button onClick={() => onToggle(ticket)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                ticket.isActive
                  ? 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}>
              {ticket.isActive ? 'Desactivar' : 'Activar'}
            </button>
          )}
          {!ticket.used && (
            <button onClick={() => onEdit(ticket)}
              className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300">
              Editar
            </button>
          )}
          <button onClick={() => onDelete(ticket)}
            className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-500 rounded-lg hover:bg-red-100 dark:bg-red-900/20">
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function Tickets() {
  const { discountTickets = [], deleteDiscountTicket, updateDiscountTicket, addAuditLog } = useStore()
  const [modal, setModal]               = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('all')   // all | active | used | expired
  const [filterType, setFilterType]     = useState('all')   // all | pct | fixed

  // ── KPIs ──
  const now = new Date()
  const kpis = useMemo(() => {
    const vigentes  = discountTickets.filter(t => t.isActive && !t.used && (!t.validTo || now <= new Date(t.validTo + 'T23:59:59')))
    const canjeados = discountTickets.filter(t => t.used)
    const vencidos  = discountTickets.filter(t => !t.used && t.validTo && now > new Date(t.validTo + 'T23:59:59'))
    const totalSaved = canjeados.reduce((a, t) => {
      // Estimamos ahorro promedio sobre S/ 200 base para pct, o el valor fijo
      return a + (t.discountType === 'fixed' ? t.discountValue : 0)
    }, 0)
    return { total: discountTickets.length, vigentes: vigentes.length, canjeados: canjeados.length, vencidos: vencidos.length, totalSaved }
  }, [discountTickets])

  // ── Filtrado ──
  const filtered = useMemo(() => {
    let list = [...discountTickets].sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0))

    if (filterType !== 'all') list = list.filter(t => t.discountType === filterType)

    if (filterStatus === 'active')  list = list.filter(t => t.isActive && !t.used && (!t.validTo || now <= new Date(t.validTo+'T23:59:59')))
    if (filterStatus === 'used')    list = list.filter(t => t.used)
    if (filterStatus === 'expired') list = list.filter(t => !t.used && t.validTo && now > new Date(t.validTo+'T23:59:59'))
    if (filterStatus === 'inactive')list = list.filter(t => !t.isActive && !t.used)

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.code.toLowerCase().includes(q) ||
        t.holderName.toLowerCase().includes(q) ||
        t.holderDoc?.includes(q) ||
        t.campaignName?.toLowerCase().includes(q)
      )
    }
    return list
  }, [discountTickets, filterStatus, filterType, search])

  const handleToggle = (t) => {
    updateDiscountTicket(t.id, { isActive: !t.isActive })
    toast.success(t.isActive ? 'Ticket desactivado' : 'Ticket activado')
  }
  const handleDelete = (t) => {
    deleteDiscountTicket(t.id)
    addAuditLog({ action:'DELETE', module:'Tickets', detail:`Ticket eliminado: ${t.code}`, entityId:t.id })
    toast.success('Ticket eliminado')
    setDeleteTarget(null)
  }

  return (
    <div className="p-6 space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Tickets de Descuento</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">Genera y gestiona cupones de descuento personalizados para clientes</p>
        </div>
        <button onClick={() => setModal({ data: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nuevo ticket
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Total tickets</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{kpis.total}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
          <p className="text-xs text-green-600 dark:text-green-400 mb-1">🟢 Vigentes</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{kpis.vigentes}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
          <p className="text-xs text-red-500 dark:text-red-400 mb-1">✅ Canjeados</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-300">{kpis.canjeados}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">⏰ Vencidos</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{kpis.vencidos}</p>
        </div>
      </div>

      {/* Banner informativo */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl flex-shrink-0">🎟️</span>
        <div>
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Uso en el Punto de Venta</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 leading-relaxed">
            En el POS, el cajero puede ingresar el código del ticket en el campo <strong>"Ticket de descuento"</strong> antes de cobrar.
            El sistema valida automáticamente la vigencia, el estado y aplica el descuento sobre el total. Cada ticket solo puede usarse <strong>una vez</strong>.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por código, nombre, DNI o campaña..."
          className="flex-1 min-w-52 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>

        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          {[
            {k:'all',     l:'Todos'},
            {k:'active',  l:'Vigentes'},
            {k:'used',    l:'Canjeados'},
            {k:'expired', l:'Vencidos'},
            {k:'inactive',l:'Inactivos'},
          ].map(f => (
            <button key={f.k} onClick={() => setFilterStatus(f.k)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterStatus===f.k ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-slate-400'}`}>
              {f.l}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          {[{k:'all',l:'Todos'},{k:'pct',l:'%'},{k:'fixed',l:'S/'}].map(f => (
            <button key={f.k} onClick={() => setFilterType(f.k)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType===f.k ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-slate-400'}`}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de tickets */}
      {filtered.length === 0 ? (
        discountTickets.length === 0
          ? <EmptyState icon="🎟️" title="Sin tickets de descuento"
              message="Crea el primer ticket para que los cajeros puedan aplicarlo en el POS."
              action={{ label: 'Crear ticket', onClick: () => setModal({ data: null }) }}/>
          : <EmptyState icon="🔍" title="Sin resultados" message="Ajusta los filtros de búsqueda."/>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <TicketCard key={t.id} ticket={t}
              onEdit={t => setModal({ data: t })}
              onToggle={handleToggle}
              onDelete={t => setDeleteTarget(t)}/>
          ))}
        </div>
      )}

      {/* Modal formulario */}
      {modal !== null && (
        <Modal
          title={modal.data ? 'Editar ticket' : 'Nuevo ticket de descuento'}
          size="md"
          onClose={() => setModal(null)}>
          <TicketForm ticket={modal.data} onClose={() => setModal(null)}/>
        </Modal>
      )}

      {/* Confirm eliminar */}
      {deleteTarget && (
        <ConfirmModal
          title="¿Eliminar ticket?"
          message={`El ticket "${deleteTarget.code}" (${deleteTarget.holderName}) será eliminado permanentemente.`}
          confirmLabel="Eliminar" variant="danger"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}/>
      )}
    </div>
  )
}
