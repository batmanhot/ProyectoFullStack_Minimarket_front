import { useState, useMemo } from 'react'
import DiscountTickets from './DiscountTickets'
import { useStore } from '../../store/index'
import { formatCurrency, formatDate } from '../../shared/utils/helpers'
import {
  CAMPAIGN_TYPES, SCOPE_OPTIONS, DAYS_OF_WEEK,
  CAMPAIGN_TEMPLATES, isCampaignActive
} from '../../shared/utils/discountEngine'
import Modal from '../../shared/components/ui/Modal'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import toast from 'react-hot-toast'

// ─── Badge de estado de campaña ───────────────────────────────────────────────
function StatusBadge({ campaign }) {
  const now  = new Date()
  const from = campaign.dateFrom ? new Date(campaign.dateFrom) : null
  const to   = campaign.dateTo   ? new Date(campaign.dateTo + 'T23:59:59') : null
  const active = isCampaignActive(campaign)

  if (!campaign.isActive) return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">Inactiva</span>
  if (from && now < from)  return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-600">Programada</span>
  if (to   && now > to)    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-500">Vencida</span>
  if (active)              return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 flex items-center gap-1 w-fit"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block"/>Activa</span>
  return                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-600">Fuera de horario</span>
}

// ─── Formulario de campaña ─────────────────────────────────────────────────────
function CampaignForm({ campaign, categories, products, onClose }) {
  const { addDiscountCampaign, updateDiscountCampaign } = useStore()
  const editing = !!campaign

  // Campos del formulario
  const [type,        setType]        = useState(campaign?.type        || 'campaign')
  const [name,        setName]        = useState(campaign?.name        || '')
  const [icon,        setIcon]        = useState(campaign?.icon        || '🏷️')
  const [description, setDescription]= useState(campaign?.description || '')
  const [isActive,    setIsActive]    = useState(campaign?.isActive    !== false)
  const [dateFrom,    setDateFrom]    = useState(campaign?.dateFrom    || '')
  const [dateTo,      setDateTo]      = useState(campaign?.dateTo      || '')
  const [daysOfWeek,  setDaysOfWeek]  = useState(campaign?.daysOfWeek || [])
  const [scope,       setScope]       = useState(campaign?.scope       || 'all')
  const [categoryIds, setCategoryIds] = useState(campaign?.categoryIds || [])
  const [productIds,  setProductIds]  = useState(campaign?.productIds  || [])
  const [brands,      setBrands]      = useState((campaign?.brands || []).join(', '))
  // Tipo campaign / line / volume
  const [discountPct, setDiscountPct] = useState(campaign?.discountPct || '')
  // Tipo volume
  const [minAmount,   setMinAmount]   = useState(campaign?.minAmount   || '')
  // Tipo promotion NxM
  const [buyQty,          setBuyQty]      = useState(campaign?.buyQty      || 2)
  const [payQty,          setPayQty]      = useState(campaign?.payQty      || 1)
  const [maxUsesPerSale,  setMaxUsesPerSale] = useState(campaign?.maxUsesPerSale || 2)

  // typeCfg no usado - mantener para futuras expansiones
  // const typeCfg = CAMPAIGN_TYPES.find(t => t.value === type)

  const toggleDay = (d) => setDaysOfWeek(prev => prev.includes(d) ? prev.filter(x => x!==d) : [...prev, d])
  const toggleCat = (id) => setCategoryIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id])
  const toggleProd = (id) => setProductIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id])

  const brandList = useMemo(() => [...new Set(products.filter(p=>p.brand).map(p=>p.brand))].sort(), [products])

  const handleSave = () => {
    if (!name.trim())  { toast.error('Ingresa un nombre para la campaña'); return }
    if (!dateFrom)     { toast.error('Selecciona la fecha de inicio'); return }
    if (!dateTo)       { toast.error('Selecciona la fecha de término'); return }
    if (new Date(dateFrom) > new Date(dateTo)) { toast.error('La fecha de inicio debe ser antes que la de término'); return }
    if (type !== 'promotion' && !discountPct) { toast.error('Ingresa el porcentaje de descuento'); return }
    if (type === 'volume' && !minAmount) { toast.error('Ingresa el monto mínimo de compra'); return }
    if (type === 'promotion' && payQty >= buyQty) { toast.error('Las unidades a pagar deben ser menores a las que lleva'); return }
    if (type === 'promotion' && maxUsesPerSale < 1) { toast.error('Máx. usos por compra debe ser al menos 1'); return }
    if (scope === 'categories' && categoryIds.length === 0) { toast.error('Selecciona al menos una categoría'); return }
    if (scope === 'products' && productIds.length === 0) { toast.error('Selecciona al menos un producto'); return }
    if (scope === 'brand' && !brands.trim()) { toast.error('Ingresa al menos una marca'); return }

    const data = {
      id:          campaign?.id || crypto.randomUUID(),
      type, name: name.trim(), icon, description: description.trim(), isActive,
      dateFrom, dateTo,
      daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : [],
      scope,
      categoryIds: scope === 'categories' ? categoryIds : [],
      productIds:  scope === 'products'   ? productIds  : [],
      brands:      scope === 'brand'      ? brands.split(',').map(b=>b.trim()).filter(Boolean) : [],
      discountPct: type !== 'promotion'   ? parseFloat(discountPct) : 0,
      minAmount:   type === 'volume'      ? parseFloat(minAmount)   : 0,
      buyQty:          type === 'promotion'   ? parseInt(buyQty)        : 0,
      payQty:          type === 'promotion'   ? parseInt(payQty)        : 0,
      maxUsesPerSale:  type === 'promotion'   ? parseInt(maxUsesPerSale): 0,
      createdAt:       campaign?.createdAt || new Date().toISOString(),
      updatedAt:       new Date().toISOString(),
    }

    if (editing) { updateDiscountCampaign(campaign.id, data); toast.success('Campaña actualizada') }
    else         { addDiscountCampaign(data);                 toast.success('Campaña creada') }
    onClose()
  }

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelCls = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="space-y-5">

      {/* Tipo de campaña */}
      <div>
        <label className={labelCls}>Tipo de descuento *</label>
        <div className="grid grid-cols-2 gap-2">
          {CAMPAIGN_TYPES.map(t => (
            <button key={t.value} type="button" onClick={() => setType(t.value)}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${type===t.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
              <span className="text-2xl flex-shrink-0">{t.icon}</span>
              <div>
                <div className={`text-xs font-semibold ${type===t.value?'text-blue-700':'text-gray-700'}`}>{t.label}</div>
                <div className="text-xs text-gray-400 leading-tight mt-0.5">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Nombre e icono */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>Ícono</label>
          <input value={icon} onChange={e => setIcon(e.target.value)} className={inputCls} maxLength={4}/>
        </div>
        <div className="col-span-3">
          <label className={labelCls}>Nombre de la campaña *</label>
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Ej: Día de la Madre 2025"/>
        </div>
      </div>

      <div>
        <label className={labelCls}>Descripción (opcional)</label>
        <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls} placeholder="Descripción visible para el cajero"/>
      </div>

      {/* Parámetros según tipo */}
      {(type === 'campaign' || type === 'line') && (
        <div>
          <label className={labelCls}>Porcentaje de descuento *</label>
          <div className="relative w-40">
            <input type="number" min="0.1" max="100" step="0.5" value={discountPct} onChange={e => setDiscountPct(e.target.value)} className={inputCls + ' pr-8'} placeholder="10"/>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">%</span>
          </div>
        </div>
      )}

      {type === 'volume' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Monto mínimo de compra *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">S/</span>
              <input type="number" min="1" step="10" value={minAmount} onChange={e => setMinAmount(e.target.value)} className={inputCls + ' pl-8'} placeholder="300"/>
            </div>
          </div>
          <div>
            <label className={labelCls}>Descuento a aplicar *</label>
            <div className="relative">
              <input type="number" min="0.1" max="100" step="0.5" value={discountPct} onChange={e => setDiscountPct(e.target.value)} className={inputCls + ' pr-8'} placeholder="5"/>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">%</span>
            </div>
          </div>
        </div>
      )}

      {type === 'promotion' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>El cliente lleva (unidades) *</label>
            <input type="number" min="2" step="1" value={buyQty} onChange={e => setBuyQty(e.target.value)} className={inputCls} placeholder="2"/>
            <p className="text-xs text-gray-400 mt-1">Ej: 2 (para 2x1) o 3 (para 3x2)</p>
          </div>
          <div>
            <label className={labelCls}>El cliente paga (unidades) *</label>
            <input type="number" min="1" step="1" value={payQty} onChange={e => setPayQty(e.target.value)} className={inputCls} placeholder="1"/>
            <p className="text-xs text-gray-400 mt-1">Ej: 1 (para 2x1) o 2 (para 3x2)</p>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Máx. veces por compra *</label>
            <input type="number" min="1" step="1" value={maxUsesPerSale} onChange={e => setMaxUsesPerSale(e.target.value)} className={inputCls} placeholder="2"/>
            <p className="text-xs text-gray-400 mt-1">Esta promoción se puede aplicar máximo X veces en una sola compra</p>
          </div>
          <div className="col-span-2 bg-blue-50 rounded-xl p-3">
            <p className="text-sm text-blue-700 font-medium">Vista previa: {buyQty}x{payQty} — por cada {buyQty} unidades, el cliente paga solo {payQty} ({buyQty-payQty} gratis). Máx. {maxUsesPerSale} aplicaciones por compra.</p>
          </div>
        </div>
      )}

      {/* Alcance (scope) */}
      <div>
        <label className={labelCls}>¿A qué productos aplica? *</label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {SCOPE_OPTIONS.map(s => {
            const isPromotion = type === 'promotion'
            const isDisabled = isPromotion && s.value !== 'products'
            return (
              <button key={s.value} type="button" 
                onClick={!isDisabled ? () => setScope(s.value) : undefined}
                disabled={isDisabled}
                className={`py-2 px-3 rounded-lg border text-xs font-medium text-left transition-all ${
                  isDisabled 
                    ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-50' 
                    : scope===s.value 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                title={isDisabled ? 'Para promociones NxM solo aplica a productos específicos' : ''}>
                {s.label}
              </button>
            )
          })}
        </div>

        {scope === 'categories' && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Selecciona las categorías:</p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
              {categories.map(c => (
                <button key={c.id} type="button" onClick={() => toggleCat(c.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${categoryIds.includes(c.id)?'bg-blue-500 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {scope === 'products' && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Selecciona los productos ({productIds.length} seleccionados):</p>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
              {products.filter(p=>p.isActive).map(p => (
                <label key={p.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0 ${productIds.includes(p.id)?'bg-blue-50':''}`}>
                  <input type="checkbox" checked={productIds.includes(p.id)} onChange={() => toggleProd(p.id)} className="rounded"/>
                  <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{p.name}</span>
                  <span className="text-xs text-gray-400">{formatCurrency(p.priceSell)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {scope === 'brand' && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Marcas disponibles: {brandList.join(', ') || 'Ninguna registrada'}</p>
            <input value={brands} onChange={e => setBrands(e.target.value)} className={inputCls} placeholder="Ej: Nike, Adidas, Alicorp (separadas por coma)"/>
          </div>
        )}
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Fecha de inicio *</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls}/>
        </div>
        <div>
          <label className={labelCls}>Fecha de término *</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls}/>
        </div>
      </div>

      {/* Días de la semana (opcional) */}
      <div>
        <label className={labelCls}>Días específicos de la semana (opcional — vacío = todos los días)</label>
        <div className="flex gap-2 flex-wrap">
          {DAYS_OF_WEEK.map(d => (
            <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
              className={`w-12 h-10 rounded-lg text-xs font-semibold transition-all ${daysOfWeek.includes(d.value)?'bg-blue-500 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {d.label}
            </button>
          ))}
        </div>
        {daysOfWeek.length > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            Solo aplica los: {daysOfWeek.map(d => DAYS_OF_WEEK.find(x=>x.value===d)?.label).join(', ')}
          </p>
        )}
      </div>

      {/* Estado */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
        <button type="button" onClick={() => setIsActive(!isActive)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive?'bg-blue-600':'bg-gray-300'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive?'translate-x-6':'translate-x-1'}`}/>
        </button>
        <span className="text-sm text-gray-700 font-medium">{isActive ? 'Campaña habilitada' : 'Campaña deshabilitada'}</span>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
        <button type="button" onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
          {editing ? 'Guardar cambios' : 'Crear campaña'}
        </button>
      </div>
    </div>
  )
}

// ─── Card de campaña ──────────────────────────────────────────────────────────
function CampaignCard({ campaign, categories, onEdit, onToggle, onDelete }) {
  const typeCfg  = CAMPAIGN_TYPES.find(t => t.value === campaign.type)
  const catNames = (campaign.categoryIds || []).map(id => categories.find(c=>c.id===id)?.name).filter(Boolean)
  const active   = isCampaignActive(campaign)

  const typeColors = {
    campaign:  'from-blue-500 to-blue-600',
    promotion: 'from-purple-500 to-purple-600',
    volume:    'from-teal-500 to-teal-600',
    line:      'from-orange-500 to-orange-600',
  }

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${active ? 'border-green-200' : 'border-gray-200'}`}>
      {/* Header con gradiente */}
      <div className={`bg-gradient-to-r ${typeColors[campaign.type] || 'from-gray-500 to-gray-600'} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{campaign.icon || typeCfg?.icon}</span>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">{campaign.name}</div>
            <div className="text-white/60 text-xs">{typeCfg?.label}</div>
          </div>
        </div>
        <StatusBadge campaign={campaign}/>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2">
        {/* Resumen del descuento */}
        <div className="text-center py-2">
          {campaign.type === 'promotion' ? (
            <span className="text-3xl font-black text-purple-600">{campaign.buyQty}×{campaign.payQty}</span>
          ) : campaign.type === 'volume' ? (
            <div>
              <span className="text-3xl font-black text-teal-600">{campaign.discountPct}%</span>
              <span className="text-xs text-gray-500 block">en compras &gt; {formatCurrency(campaign.minAmount)}</span>
            </div>
          ) : (
            <span className="text-3xl font-black text-blue-600">{campaign.discountPct}%</span>
          )}
          <div className="text-xs text-gray-500 mt-1">de descuento</div>
        </div>

        {/* Detalles */}
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex justify-between">
            <span className="text-gray-400">Vigencia</span>
            <span>{formatDate(campaign.dateFrom)} — {formatDate(campaign.dateTo)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Aplica a</span>
            <span className="text-right max-w-[60%] truncate">
              {campaign.scope === 'all'        ? 'Todos los productos' :
               campaign.scope === 'categories' ? catNames.join(', ') || 'Categorías sel.' :
               campaign.scope === 'brand'      ? campaign.brands?.join(', ') || 'Marcas sel.' :
               `${campaign.productIds?.length || 0} producto(s)`}
            </span>
          </div>
          {campaign.daysOfWeek?.length > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Días</span>
              <span>{campaign.daysOfWeek.map(d => DAYS_OF_WEEK.find(x=>x.value===d)?.label).join(', ')}</span>
            </div>
          )}
          {campaign.description && <p className="text-gray-400 italic">{campaign.description}</p>}
        </div>

        {/* Acciones */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button onClick={() => onToggle(campaign)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${campaign.isActive ? 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
            {campaign.isActive ? 'Desactivar' : 'Activar'}
          </button>
          <button onClick={() => onEdit(campaign)}
            className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
            Editar
          </button>
          <button onClick={() => onDelete(campaign)}
            className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-500 rounded-lg hover:bg-red-100">
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Discounts() {
  const { discountCampaigns = [], categories, products, updateDiscountCampaign, deleteDiscountCampaign } = useStore()
  const [modal, setModal]          = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showTemplates, setShowTemplates] = useState(false)
  const [activeTab, setActiveTab]         = useState('campaigns') // 'campaigns' | 'tickets'

  // KPIs
  const kpis = useMemo(() => ({
    total:      discountCampaigns.length,
    active:     discountCampaigns.filter(isCampaignActive).length,
    scheduled:  discountCampaigns.filter(c => c.isActive && c.dateFrom && new Date(c.dateFrom) > new Date()).length,
    expired:    discountCampaigns.filter(c => c.dateTo && new Date(c.dateTo + 'T23:59:59') < new Date()).length,
  }), [discountCampaigns])

  const filtered = useMemo(() => {
    let list = [...discountCampaigns].sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0))
    if (filterType !== 'all')    list = list.filter(c => c.type === filterType)
    if (filterStatus === 'active')   list = list.filter(isCampaignActive)
    if (filterStatus === 'inactive') list = list.filter(c => !isCampaignActive(c))
    return list
  }, [discountCampaigns, filterType, filterStatus])

  const handleToggle = (campaign) => {
    updateDiscountCampaign(campaign.id, { isActive: !campaign.isActive })
    toast.success(campaign.isActive ? 'Campaña desactivada' : 'Campaña activada')
  }

  const handleDelete = (campaign) => {
    deleteDiscountCampaign(campaign.id)
    toast.success('Campaña eliminada')
    setDeleteTarget(null)
  }

  const handleTemplate = (tpl) => {
    setModal({ type: 'form', data: {
      ...tpl,
      id: null, name: tpl.name,
      dateFrom: '', dateTo: '',
      daysOfWeek: [],
      categoryIds: [], productIds: [], brands: [],
      isActive: true,
    }})
    setShowTemplates(false)
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800">Gestión de Descuentos</h1>
          <p className="text-sm text-gray-400">Campañas, promociones y descuentos automáticos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTemplates(true)}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
            ⚡ Usar plantilla
          </button>
          <button onClick={() => setModal({ type: 'form', data: null })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Nueva campaña
          </button>
        </div>
      </div>

      {/* ── Tabs principales: Campañas | Tickets ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab('campaigns')}
          className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab==='campaigns'?'bg-white shadow text-blue-600':'text-gray-500 hover:text-gray-700'}`}>
          🏷️ Campañas y Promociones
        </button>
        <button onClick={() => setActiveTab('tickets')}
          className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${activeTab==='tickets'?'bg-white shadow text-blue-600':'text-gray-500 hover:text-gray-700'}`}>
          🎟️ Tickets de Descuento
        </button>
      </div>

      {/* ── Contenido según tab activo ── */}
      {activeTab === 'tickets' && <DiscountTickets/>}
      {activeTab === 'campaigns' && <>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total campañas</p>
          <p className="text-2xl font-bold text-gray-800">{kpis.total}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-600 mb-1">🟢 Activas ahora</p>
          <p className="text-2xl font-bold text-green-700">{kpis.active}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600 mb-1">📅 Programadas</p>
          <p className="text-2xl font-bold text-blue-700">{kpis.scheduled}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">⏰ Vencidas</p>
          <p className="text-2xl font-bold text-gray-500">{kpis.expired}</p>
        </div>
      </div>

      {/* Info de integración con el POS */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl flex-shrink-0">💡</span>
        <div>
          <p className="text-sm font-semibold text-blue-800">Aplicación automática en el POS</p>
          <p className="text-xs text-blue-600 mt-0.5">Las campañas activas se aplican automáticamente al agregar productos al carrito. El cajero verá los descuentos calculados antes de cobrar. Se pueden combinar múltiples descuentos activos.</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={()=>setFilterType('all')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType==='all'?'bg-white shadow text-blue-600':'text-gray-500'}`}>Todos</button>
          {CAMPAIGN_TYPES.map(t => (
            <button key={t.value} onClick={()=>setFilterType(t.value)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType===t.value?'bg-white shadow text-blue-600':'text-gray-500'}`}>{t.icon} {t.label}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[{k:'all',l:'Todos'},{k:'active',l:'Activas'},{k:'inactive',l:'Inactivas'}].map(f => (
            <button key={f.k} onClick={()=>setFilterStatus(f.k)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterStatus===f.k?'bg-white shadow text-blue-600':'text-gray-500'}`}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* Grid de campañas */}
      {filtered.length === 0 ? (
        <EmptyState icon="🏷️" title="Sin campañas de descuento"
          message="Crea tu primera campaña o usa una de las plantillas predefinidas."
          action={{ label: 'Nueva campaña', onClick: () => setModal({ type: 'form', data: null }) }}/>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <CampaignCard key={c.id} campaign={c} categories={categories}
              onEdit={(c) => setModal({ type: 'form', data: c })}
              onToggle={handleToggle}
              onDelete={(c) => setDeleteTarget(c)}/>
          ))}
        </div>
      )}

      {/* Modal formulario */}
      {modal?.type === 'form' && (
        <Modal title={modal.data?.id ? 'Editar campaña' : 'Nueva campaña de descuento'} size="lg" onClose={() => setModal(null)}>
          <CampaignForm campaign={modal.data?.id ? modal.data : null} categories={categories} products={products} onClose={() => setModal(null)}/>
        </Modal>
      )}

      {/* Modal plantillas */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">⚡ Plantillas de campañas</h2>
              <button onClick={() => setShowTemplates(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <p className="text-sm text-gray-500 mb-4">Selecciona una plantilla y personaliza las fechas y el alcance.</p>
              <div className="grid grid-cols-2 gap-3">
                {CAMPAIGN_TEMPLATES.map((tpl, i) => {
                  const typeCfg = CAMPAIGN_TYPES.find(t => t.value === tpl.type)
                  return (
                    <button key={i} onClick={() => handleTemplate(tpl)}
                      className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 text-left transition-all">
                      <span className="text-2xl">{tpl.icon}</span>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{tpl.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{typeCfg?.label} · {tpl.type !== 'promotion' ? `${tpl.discountPct}% descuento` : `${tpl.buyQty}×${tpl.payQty}`}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm eliminar */}
      {deleteTarget && (
        <ConfirmModal
          title="¿Eliminar campaña?"
          message={`Se eliminará permanentemente "${deleteTarget.name}". Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar" variant="danger"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}/>
      )}
      </> /* fin tab campañas */}
    </div>
  )
}
