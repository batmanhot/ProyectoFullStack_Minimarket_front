import { useState, useMemo, useRef } from 'react'
import { useStore } from '../../store/index'
import { formatCurrency, formatDate, formatDateTime } from '../../shared/utils/helpers'
import { exportToExcel } from '../../shared/utils/export'
import Modal from '../../shared/components/ui/Modal'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import { useDebounce } from '../../shared/hooks/useDebounce'
import toast from 'react-hot-toast'

// ─── Generador de código único alfanumérico ───────────────────────────────────
function generateCode(prefix = 'TKT') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin O,I,1,0 para evitar confusión
  const rand  = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${prefix}-${rand.slice(0, 4)}-${rand.slice(4)}`
}

// ─── Badge de estado del ticket ──────────────────────────────────────────────
function TicketStatusBadge({ ticket }) {
  const now     = new Date()
  const validTo = ticket.validTo ? new Date(ticket.validTo + 'T23:59:59') : null
  const validFrom = ticket.validFrom ? new Date(ticket.validFrom) : null

  if (ticket.used)                              return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-600">✓ Canjeado</span>
  if (!ticket.isActive)                         return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-600">Inactivo</span>
  if (validTo && now > validTo)                 return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-600">Vencido</span>
  if (validFrom && now < validFrom)             return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-600">Programado</span>
  return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 flex items-center gap-1 w-fit"><span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"/>Disponible</span>
}

// ─── Impresión del ticket físico ──────────────────────────────────────────────
function printTicket(ticket, businessConfig) {
  const discLabel = ticket.discountType === 'pct'
    ? `${ticket.discountValue}% de descuento${ticket.maxAmount ? ` (máx. ${formatCurrency(ticket.maxAmount)})` : ''}`
    : `Vale por ${formatCurrency(ticket.discountValue)}`

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ticket ${ticket.code}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',monospace; background:#fff; color:#000; }
  .ticket {
    width: 80mm; margin: 0 auto; padding: 6mm;
    border: 2px dashed #000;
  }
  .logo { text-align:center; font-size:13px; font-weight:bold; letter-spacing:2px; margin-bottom:3mm; }
  .hr   { border:none; border-top:1px dashed #000; margin:3mm 0; }
  .center { text-align:center; }
  .code { text-align:center; font-size:20px; font-weight:900; letter-spacing:4px; margin:4mm 0; background:#000; color:#fff; padding:2mm 4mm; border-radius:2mm; }
  .discount-box { text-align:center; background:#f5f5f5; border:2px solid #000; padding:3mm; margin:3mm 0; border-radius:2mm; }
  .discount-value { font-size:22px; font-weight:900; margin:1mm 0; }
  .field { display:flex; justify-content:space-between; font-size:9px; margin:0.8mm 0; }
  .conditions { font-size:8px; color:#555; margin-top:2mm; line-height:1.5; }
  .footer { text-align:center; font-size:8px; color:#888; margin-top:3mm; }
  @media print { body{margin:0;} @page{size:80mm auto;margin:2mm;} }
</style>
</head><body>
<div class="ticket">
  <div class="logo">${(businessConfig?.name || 'MI NEGOCIO').toUpperCase()}</div>
  ${businessConfig?.ruc ? `<div class="center" style="font-size:9px">RUC: ${businessConfig.ruc}</div>` : ''}
  <hr class="hr">
  <div class="center" style="font-size:10px; font-weight:bold;">TICKET DE DESCUENTO</div>
  <div class="code">${ticket.code}</div>
  <div class="discount-box">
    <div style="font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#555;">Valor del descuento</div>
    <div class="discount-value">${ticket.discountType === 'pct' ? `${ticket.discountValue}%` : formatCurrency(ticket.discountValue)}</div>
    <div style="font-size:9px;">${ticket.discountType === 'pct' ? 'Sobre el total de la compra' : 'Descuento en soles'}</div>
    ${ticket.maxAmount ? `<div style="font-size:8px; color:#666;">Máximo: ${formatCurrency(ticket.maxAmount)}</div>` : ''}
  </div>
  <hr class="hr">
  <div class="field"><span>Titular:</span><span style="font-weight:bold; max-width:55mm; text-align:right;">${ticket.holderName}</span></div>
  ${ticket.holderDoc  ? `<div class="field"><span>${ticket.holderDocType || 'Doc'}:</span><span>${ticket.holderDoc}</span></div>` : ''}
  ${ticket.holderPhone? `<div class="field"><span>Teléfono:</span><span>${ticket.holderPhone}</span></div>` : ''}
  <div class="field"><span>Vigente desde:</span><span>${formatDate(ticket.validFrom)}</span></div>
  <div class="field"><span>Válido hasta:</span><span>${formatDate(ticket.validTo)}</span></div>
  <div class="field"><span>Campaña:</span><span>${ticket.campaignName || '—'}</span></div>
  <hr class="hr">
  <div class="conditions">
    • Válido para una sola compra · No acumulable<br>
    • Al portador · No genera vuelto ni saldo<br>
    • Aplica sobre el total de la compra<br>
    ${ticket.notes ? `• ${ticket.notes}` : ''}
  </div>
  <hr class="hr">
  <div class="footer">Presentar este ticket al cajero antes de pagar<br>${businessConfig?.address || ''}<br>Tel: ${businessConfig?.phone || ''}</div>
</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`

  const win = window.open('', '_blank', 'width=380,height=650,left=100,top=50')
  if (!win) { toast.error('Activa las ventanas emergentes para imprimir'); return }
  win.document.write(html)
  win.document.close()
}

// ─── Formulario de creación de ticket ────────────────────────────────────────
function TicketForm({ ticket, onClose }) {
  const { addDiscountTicket, updateDiscountTicket, businessConfig } = useStore()
  const editing = !!ticket?.id

  const [holderType,    setHolderType]    = useState(ticket?.holderType    || 'persona')
  const [holderName,    setHolderName]    = useState(ticket?.holderName    || '')
  const [holderDocType, setHolderDocType] = useState(ticket?.holderDocType || 'DNI')
  const [holderDoc,     setHolderDoc]     = useState(ticket?.holderDoc     || '')
  const [holderPhone,   setHolderPhone]   = useState(ticket?.holderPhone   || '')
  const [holderEmail,   setHolderEmail]   = useState(ticket?.holderEmail   || '')
  const [discountType,  setDiscountType]  = useState(ticket?.discountType  || 'pct')
  const [discountValue, setDiscountValue] = useState(ticket?.discountValue || '')
  const [maxAmount,     setMaxAmount]     = useState(ticket?.maxAmount     || '')
  const [validFrom,     setValidFrom]     = useState(ticket?.validFrom     || new Date().toISOString().split('T')[0])
  const [validTo,       setValidTo]       = useState(ticket?.validTo       || '')
  const [campaignName,  setCampaignName]  = useState(ticket?.campaignName  || '')
  const [notes,         setNotes]         = useState(ticket?.notes         || '')
  const [quantity,      setQuantity]      = useState(1) // cantidad a generar en batch
  const [customCode,    setCustomCode]    = useState(ticket?.code          || '')
  const [autoCode,      setAutoCode]      = useState(!ticket?.id)
  const [prefix,        setPrefix]        = useState('TKT')

  const previewCode = autoCode ? generateCode(prefix) : customCode

  const handleSave = () => {
    if (!holderName.trim())   { toast.error('Ingresa el nombre del titular'); return }
    if (!discountValue)        { toast.error('Ingresa el valor del descuento'); return }
    if (parseFloat(discountValue) <= 0) { toast.error('El descuento debe ser mayor a 0'); return }
    if (discountType === 'pct' && parseFloat(discountValue) > 100) { toast.error('El porcentaje no puede superar 100%'); return }
    if (!validFrom)            { toast.error('Ingresa la fecha de inicio de vigencia'); return }
    if (!validTo)              { toast.error('Ingresa la fecha de término de vigencia'); return }
    if (new Date(validFrom) > new Date(validTo)) { toast.error('La fecha de inicio debe ser anterior al término'); return }
    if (!autoCode && !customCode.trim()) { toast.error('Ingresa un código o usa el código automático'); return }

    const base = {
      holderType, holderName: holderName.trim(), holderDocType, holderDoc: holderDoc.trim(),
      holderPhone: holderPhone.trim(), holderEmail: holderEmail.trim(),
      discountType, discountValue: parseFloat(discountValue),
      maxAmount: maxAmount ? parseFloat(maxAmount) : null,
      validFrom, validTo, campaignName: campaignName.trim(), notes: notes.trim(),
      isActive: true, used: false, usedAt: null, usedInSale: null,
      usedByUserId: null, discountApplied: null,
      createdAt: new Date().toISOString(),
    }

    if (editing) {
      updateDiscountTicket(ticket.id, { ...base, code: customCode })
      toast.success('Ticket actualizado')
      onClose()
      return
    }

    // Generar 1 o más tickets en batch
    const count = Math.max(1, Math.min(parseInt(quantity) || 1, 50))
    const generated = []
    for (let i = 0; i < count; i++) {
      const t = { ...base, id: crypto.randomUUID(), code: count === 1 && !autoCode ? customCode : generateCode(prefix) }
      generated.push(t)
    }
    generated.forEach(t => addDiscountTicket(t))
    toast.success(`${count} ticket(s) generado(s)`)
    onClose()
  }

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="space-y-5">

      {/* Titular */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex gap-2 mb-2">
          {[{v:'persona',l:'👤 Persona'},{ v:'empresa',l:'🏢 Empresa'}].map(o => (
            <button key={o.v} onClick={() => setHolderType(o.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${holderType===o.v?'bg-blue-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
              {o.l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={lbl}>{holderType==='empresa'?'Razón social *':'Nombre y apellidos *'}</label>
            <input value={holderName} onChange={e=>setHolderName(e.target.value)} className={inp} placeholder={holderType==='empresa'?'Empresa S.A.C.':'Juan Pérez García'}/>
          </div>
          <div>
            <label className={lbl}>Tipo documento</label>
            <select value={holderDocType} onChange={e=>setHolderDocType(e.target.value)} className={inp}>
              {(holderType==='empresa' ? ['RUC'] : ['DNI','CE','Pasaporte']).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Número documento</label>
            <input value={holderDoc} onChange={e=>setHolderDoc(e.target.value)} className={inp} placeholder="12345678"/>
          </div>
          <div>
            <label className={lbl}>Teléfono</label>
            <input value={holderPhone} onChange={e=>setHolderPhone(e.target.value)} className={inp} placeholder="999 999 999"/>
          </div>
          <div>
            <label className={lbl}>Email</label>
            <input type="email" value={holderEmail} onChange={e=>setHolderEmail(e.target.value)} className={inp} placeholder="correo@ejemplo.com"/>
          </div>
        </div>
      </div>

      {/* Descuento */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Valor del descuento</p>
        <div className="flex gap-2">
          {[{v:'pct',l:'Porcentaje (%)'},{ v:'amount',l:'Monto fijo (S/)'}].map(o => (
            <button key={o.v} onClick={() => setDiscountType(o.v)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${discountType===o.v?'bg-green-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
              {o.l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>{discountType==='pct'?'Porcentaje *':'Monto en soles *'}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">{discountType==='pct'?'%':'S/'}</span>
              <input type="number" min="0.01" step={discountType==='pct'?'1':'0.50'} value={discountValue} onChange={e=>setDiscountValue(e.target.value)} className={inp+' pl-8'} placeholder={discountType==='pct'?'10':'50.00'}/>
            </div>
          </div>
          {discountType==='pct' && (
            <div>
              <label className={lbl}>Descuento máximo (S/) — opcional</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">S/</span>
                <input type="number" min="0" step="0.50" value={maxAmount} onChange={e=>setMaxAmount(e.target.value)} className={inp+' pl-8'} placeholder="Sin límite"/>
              </div>
            </div>
          )}
        </div>

        {/* Vista previa del valor */}
        {discountValue && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
            <p className="text-xs text-green-600 mb-1">El titular obtendrá:</p>
            <p className="text-2xl font-black text-green-700">
              {discountType==='pct' ? `${discountValue}% de descuento` : formatCurrency(parseFloat(discountValue)||0)}
            </p>
            {discountType==='pct' && maxAmount && (
              <p className="text-xs text-green-500 mt-1">Hasta un máximo de {formatCurrency(parseFloat(maxAmount)||0)}</p>
            )}
            <p className="text-xs text-green-500 mt-1">sobre el total de la compra · uso único · al portador</p>
          </div>
        )}
      </div>

      {/* Vigencia y campaña */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Válido desde *</label>
          <input type="date" value={validFrom} onChange={e=>setValidFrom(e.target.value)} className={inp}/>
        </div>
        <div>
          <label className={lbl}>Válido hasta *</label>
          <input type="date" value={validTo} onChange={e=>setValidTo(e.target.value)} className={inp}/>
        </div>
        <div className="col-span-2">
          <label className={lbl}>Campaña / Motivo (opcional)</label>
          <input value={campaignName} onChange={e=>setCampaignName(e.target.value)} className={inp} placeholder="Ej: Navidad 2025, Canasta Diciembre, Sorteo Día del Padre..."/>
        </div>
      </div>

      {/* Código */}
      {!editing && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Código del ticket</p>
          <div className="flex gap-2">
            <button onClick={() => setAutoCode(true)}  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${autoCode?'bg-blue-600 text-white':'bg-white border border-gray-200 text-gray-600'}`}>🤖 Automático</button>
            <button onClick={() => setAutoCode(false)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${!autoCode?'bg-blue-600 text-white':'bg-white border border-gray-200 text-gray-600'}`}>✏️ Personalizado</button>
          </div>
          {autoCode ? (
            <div className="flex gap-2 items-center">
              <div>
                <label className={lbl}>Prefijo</label>
                <input value={prefix} onChange={e=>setPrefix(e.target.value.toUpperCase().slice(0,5))} className="w-20 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" maxLength={5}/>
              </div>
              <div className="flex-1">
                <label className={lbl}>Ejemplo de código generado</label>
                <div className="px-3 py-2 bg-white border border-dashed border-blue-300 rounded-lg font-mono text-sm text-blue-700 text-center font-bold tracking-widest">{generateCode(prefix)}</div>
              </div>
            </div>
          ) : (
            <div>
              <label className={lbl}>Código personalizado</label>
              <input value={customCode} onChange={e=>setCustomCode(e.target.value.toUpperCase())} className={inp+' font-mono tracking-widest uppercase'} placeholder="NAVIDAD-2025" maxLength={30}/>
            </div>
          )}
          {autoCode && !editing && (
            <div>
              <label className={lbl}>Cantidad de tickets a generar (máx. 50)</label>
              <input type="number" min="1" max="50" value={quantity} onChange={e=>setQuantity(e.target.value)} className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              {parseInt(quantity) > 1 && <p className="text-xs text-gray-400 mt-1">Se generarán {quantity} tickets con códigos únicos para el mismo titular</p>}
            </div>
          )}
        </div>
      )}

      {/* Condiciones */}
      <div>
        <label className={lbl}>Condiciones adicionales (aparecerán en el ticket impreso)</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} className={inp+' resize-none'} placeholder="Ej: Aplica solo en compras mayores a S/50, no válido en productos de panadería..."/>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
        <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
          {editing ? 'Guardar cambios' : `Generar ${parseInt(quantity)>1?quantity+' tickets':'ticket'}`}
        </button>
      </div>
    </div>
  )
}

// ─── Panel de gestión de tickets ─────────────────────────────────────────────
export default function DiscountTickets() {
  const { discountTickets = [], updateDiscountTicket, businessConfig, addAuditLog } = useStore()
  const [modal, setModal]           = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const dq = useDebounce(search, 150)

  // KPIs
  const kpis = useMemo(() => {
    const now = new Date()
    return {
      total:     discountTickets.length,
      available: discountTickets.filter(t => {
        if (!t.isActive||t.used) return false
        if (t.validTo && now > new Date(t.validTo+'T23:59:59')) return false
        if (t.validFrom && now < new Date(t.validFrom)) return false
        return true
      }).length,
      used:    discountTickets.filter(t => t.used).length,
      expired: discountTickets.filter(t => !t.used && t.validTo && now > new Date(t.validTo+'T23:59:59')).length,
    }
  }, [discountTickets])

  const filtered = useMemo(() => {
    let list = [...discountTickets].sort((a,b) => new Date(b.createdAt||0)-new Date(a.createdAt||0))
    if (dq) {
      const q = dq.toLowerCase()
      list = list.filter(t => t.code.toLowerCase().includes(q) || t.holderName.toLowerCase().includes(q) || t.holderDoc?.includes(q) || t.campaignName?.toLowerCase().includes(q))
    }
    const now = new Date()
    if (filterStatus === 'available') list = list.filter(t => t.isActive && !t.used && (!t.validTo || now <= new Date(t.validTo+'T23:59:59')) && (!t.validFrom || now >= new Date(t.validFrom)))
    if (filterStatus === 'used')      list = list.filter(t => t.used)
    if (filterStatus === 'expired')   list = list.filter(t => !t.used && t.validTo && now > new Date(t.validTo+'T23:59:59'))
    return list
  }, [discountTickets, dq, filterStatus])

  const handleExport = () => {
    addAuditLog({ action:'EXPORT', module:'Tickets Descuento', detail:`Excel: ${filtered.length} tickets` })
    exportToExcel(
      filtered.map(t => ({
        Código: t.code, Titular: t.holderName, Tipo: t.holderType,
        Documento: `${t.holderDocType||''} ${t.holderDoc||''}`.trim(),
        Teléfono: t.holderPhone||'', Campaña: t.campaignName||'',
        'Tipo Descuento': t.discountType==='pct'?'Porcentaje':'Monto fijo',
        Valor: t.discountType==='pct'?`${t.discountValue}%`:t.discountValue,
        'Máximo S/': t.maxAmount||'',
        'Válido desde': t.validFrom, 'Válido hasta': t.validTo,
        Estado: t.used?'Canjeado':!t.isActive?'Inactivo':'Disponible',
        'Fecha canje': t.usedAt ? formatDateTime(t.usedAt) : '',
        'Desc. aplicado': t.discountApplied||'',
      })),
      'tickets_descuento'
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Tickets de Descuento</h2>
          <p className="text-sm text-gray-400">Vales de descuento personalizados — uso único al portador</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50">📊 Excel</button>
          <button onClick={() => setModal({ type: 'form', data: null })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Nuevo ticket
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl">🎟️</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">¿Cómo funcionan los tickets?</p>
          <p className="text-xs text-amber-700 mt-0.5">El cajero ingresa el código en el POS al momento del pago. El sistema verifica la vigencia, aplica el descuento al total de la compra y marca el ticket como utilizado. <strong>Un solo uso, no genera vuelto ni saldo.</strong></p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-xl p-4"><p className="text-xs text-gray-500 mb-1">Total tickets</p><p className="text-2xl font-bold text-gray-800">{kpis.total}</p></div>
        <div className="bg-green-50 rounded-xl p-4"><p className="text-xs text-green-600 mb-1">🟢 Disponibles</p><p className="text-2xl font-bold text-green-700">{kpis.available}</p></div>
        <div className="bg-gray-100 rounded-xl p-4"><p className="text-xs text-gray-500 mb-1">✓ Canjeados</p><p className="text-2xl font-bold text-gray-600">{kpis.used}</p></div>
        <div className="bg-orange-50 rounded-xl p-4"><p className="text-xs text-orange-600 mb-1">⏰ Vencidos</p><p className="text-2xl font-bold text-orange-600">{kpis.expired}</p></div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por código, titular, campaña..."
          className="flex-1 min-w-48 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[{k:'all',l:'Todos'},{k:'available',l:'Disponibles'},{k:'used',l:'Canjeados'},{k:'expired',l:'Vencidos'}].map(f => (
            <button key={f.k} onClick={()=>setFilterStatus(f.k)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${filterStatus===f.k?'bg-white shadow text-blue-600':'text-gray-500'}`}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <EmptyState icon="🎟️" title="Sin tickets registrados" message="Genera el primer ticket de descuento para un cliente o campaña."
          action={{ label: 'Nuevo ticket', onClick: () => setModal({ type: 'form', data: null }) }}/>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Código','Titular','Descuento','Campaña','Vigencia','Estado','Acciones'].map(h => (
                  <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3 ${h==='Acciones'?'text-center':'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(t => (
                <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${t.used?'opacity-60':''}`}>
                  {/* Código */}
                  <td className="px-4 py-3">
                    <code className="font-mono font-bold text-blue-700 text-sm tracking-widest bg-blue-50 px-2 py-0.5 rounded">{t.code}</code>
                  </td>
                  {/* Titular */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{t.holderType==='empresa'?'🏢':'👤'}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-800">{t.holderName}</div>
                        {t.holderDoc && <div className="text-xs text-gray-400">{t.holderDocType} {t.holderDoc}</div>}
                      </div>
                    </div>
                  </td>
                  {/* Descuento */}
                  <td className="px-4 py-3">
                    <span className={`text-base font-black ${t.discountType==='pct'?'text-purple-600':'text-green-600'}`}>
                      {t.discountType==='pct' ? `${t.discountValue}%` : formatCurrency(t.discountValue)}
                    </span>
                    {t.maxAmount && <div className="text-xs text-gray-400">máx. {formatCurrency(t.maxAmount)}</div>}
                    {t.used && t.discountApplied && <div className="text-xs text-gray-500">Aplicado: {formatCurrency(t.discountApplied)}</div>}
                  </td>
                  {/* Campaña */}
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[130px] truncate">{t.campaignName || '—'}</td>
                  {/* Vigencia */}
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-600">{formatDate(t.validFrom)}</div>
                    <div className="text-xs text-gray-400">hasta {formatDate(t.validTo)}</div>
                    {t.used && <div className="text-xs text-gray-400 mt-0.5">Canjeado: {formatDate(t.usedAt)}</div>}
                  </td>
                  {/* Estado */}
                  <td className="px-4 py-3"><TicketStatusBadge ticket={t}/></td>
                  {/* Acciones */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {/* Imprimir */}
                      <button onClick={() => printTicket(t, businessConfig)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Imprimir ticket">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                      </button>
                      {/* Editar — solo si no está usado */}
                      {!t.used && (
                        <button onClick={() => setModal({ type:'form', data:t })} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Editar">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        </button>
                      )}
                      {/* Activar / Desactivar */}
                      {!t.used && (
                        <button onClick={() => { updateDiscountTicket(t.id, { isActive: !t.isActive }); toast.success(t.isActive?'Ticket desactivado':'Ticket activado') }}
                          className={`p-1.5 rounded-lg ${t.isActive?'text-gray-400 hover:text-red-500 hover:bg-red-50':'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                          title={t.isActive?'Desactivar':'Activar'}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.isActive?'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636':'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'}/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal form */}
      {modal?.type === 'form' && (
        <Modal title={modal.data?.id ? 'Editar ticket' : 'Nuevo ticket de descuento'} size="lg" onClose={() => setModal(null)}>
          <TicketForm ticket={modal.data?.id ? modal.data : null} onClose={() => setModal(null)}/>
        </Modal>
      )}
    </div>
  )
}
