import { useState, useMemo } from 'react'
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

  if (!campaign.isActive) return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">Inactiva</span>
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
  const [buyQty,         setBuyQty]         = useState(campaign?.buyQty         || 2)
  const [payQty,         setPayQty]         = useState(campaign?.payQty         || 1)
  const [maxPerPurchase, setMaxPerPurchase] = useState(campaign?.maxPerPurchase  || 0)
  const [productSearch,  setProductSearch]  = useState('')

  const typeCfg = CAMPAIGN_TYPES.find(t => t.value === type)

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
    if (type === 'volume') {
      if (!minAmount || parseFloat(minAmount) <= 0) { toast.error('Ingresa el subtotal mínimo de compra'); return }
      if (scope === 'categories' && categoryIds.length === 0) { toast.error('Selecciona al menos una categoría'); return }
      if (scope === 'brand'      && !brands.trim())           { toast.error('Selecciona al menos una marca'); return }
    }
    if (type === 'promotion') {
      if (parseInt(payQty) >= parseInt(buyQty)) { toast.error('Las unidades a pagar (M) deben ser menores a las que lleva (N)'); return }
      if (parseInt(buyQty) < 2) { toast.error('El cliente debe llevar al menos 2 unidades'); return }
      if (productIds.length === 0) { toast.error('La promoción NxM requiere seleccionar al menos un producto'); return }
    }
    if (type !== 'promotion') {
      if (scope === 'categories' && categoryIds.length === 0) { toast.error('Selecciona al menos una categoría'); return }
      if (scope === 'products'   && productIds.length === 0)  { toast.error('Selecciona al menos un producto'); return }
      if (scope === 'brand'      && !brands.trim())           { toast.error('Ingresa al menos una marca'); return }
    }

    const data = {
      id:          campaign?.id || crypto.randomUUID(),
      type, name: name.trim(), icon, description: description.trim(), isActive,
      dateFrom, dateTo,
      daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : [],
      // NxM siempre scope products
      scope:       type === 'promotion' ? 'products' : scope,
      categoryIds: scope === 'categories' && type !== 'promotion' ? categoryIds : [],
      productIds:  (scope === 'products' || type === 'promotion') ? productIds : [],
      brands:      scope === 'brand' && type !== 'promotion' ? brands.split(',').map(b=>b.trim()).filter(Boolean) : [],
      discountPct: type !== 'promotion' ? parseFloat(discountPct) : 0,
      minAmount:   type === 'volume'    ? parseFloat(minAmount)   : 0,
      buyQty:      type === 'promotion' ? parseInt(buyQty)        : 0,
      payQty:      type === 'promotion' ? parseInt(payQty)        : 0,
      maxPerPurchase: type === 'promotion' ? parseInt(maxPerPurchase) || 0 : 0,
      createdAt:   campaign?.createdAt || new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    }

    if (editing) { updateDiscountCampaign(campaign.id, data); toast.success('Campaña actualizada') }
    else         { addDiscountCampaign(data);                 toast.success('Campaña creada') }
    onClose()
  }

  const inputCls = "w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelCls = "block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1"

  return (
    <div className="space-y-5">

      {/* Tipo de campaña */}
      <div>
        <label className={labelCls}>Tipo de descuento *</label>
        <div className="grid grid-cols-2 gap-2">
          {CAMPAIGN_TYPES.map(t => (
            <button key={t.value} type="button" onClick={() => setType(t.value)}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${type===t.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700'}`}>
              <span className="text-2xl flex-shrink-0">{t.icon}</span>
              <div>
                <div className={`text-xs font-semibold ${type===t.value?'text-blue-700':'text-gray-700'}`}>{t.label}</div>
                <div className="text-xs text-gray-400 dark:text-slate-500 leading-tight mt-0.5">{t.desc}</div>
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
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-slate-500 font-bold">%</span>
          </div>
        </div>
      )}

      {type === 'volume' && (() => {
        // ── Vista previa del descuento por volumen ────────────────────────────
        const amt  = parseFloat(minAmount)  || 0
        const pct  = parseFloat(discountPct) || 0
        const saving = parseFloat((amt * pct / 100).toFixed(2))

        // Filtro activo para el volume
        const VOLUME_SCOPES = [
          { value: 'all',        label: 'Todos los productos',    icon: '🛒', desc: 'Aplica a cualquier producto en el carrito' },
          { value: 'categories', label: 'Categoría específica',   icon: '🗂️', desc: 'Solo productos de las categorías elegidas' },
          { value: 'brand',      label: 'Marca específica',       icon: '🏷️', desc: 'Solo productos de las marcas elegidas' },
        ]

        return (
          <div className="space-y-4">

            {/* Banner informativo */}
            <div className="flex items-start gap-3 bg-teal-50 border border-teal-200 rounded-xl p-3">
              <span className="text-xl flex-shrink-0">📦</span>
              <div>
                <p className="text-sm font-semibold text-teal-800">Descuento por volumen de compra</p>
                <p className="text-xs text-teal-600 mt-0.5 leading-relaxed">
                  Se activa automáticamente cuando el Subtotal Bruto del carrito supera el importe mínimo configurado.
                  Ej: <em>"Por compras ≥ S/ 300 en Gloria → 5% de descuento"</em>
                </p>
              </div>
            </div>

            {/* Parámetros: monto + porcentaje */}
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Condición del descuento</p>

              <div className="grid grid-cols-2 gap-4">
                {/* Subtotal mínimo */}
                <div>
                  <label className={labelCls}>Subtotal Bruto mínimo (S/) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 dark:text-slate-500 pointer-events-none">S/</span>
                    <input
                      type="number" min="1" step="10"
                      value={minAmount}
                      onChange={e => setMinAmount(e.target.value)}
                      className={inputCls + ' pl-9 font-mono'}
                      placeholder="300"/>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">Importe mínimo antes de descuentos</p>
                </div>

                {/* Porcentaje */}
                <div>
                  <label className={labelCls}>Porcentaje de descuento *</label>
                  <div className="relative">
                    <input
                      type="number" min="0.1" max="100" step="0.5"
                      value={discountPct}
                      onChange={e => setDiscountPct(e.target.value)}
                      className={inputCls + ' pr-9 font-mono'}
                      placeholder="5"/>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 dark:text-slate-500 pointer-events-none">%</span>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">Se aplica sobre el subtotal bruto</p>
                </div>
              </div>

              {/* Preview en tiempo real */}
              {amt > 0 && pct > 0 ? (
                <div className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-teal-200 rounded-xl p-3 mt-1">
                  <div className="w-14 h-14 flex-shrink-0 rounded-xl bg-teal-600 flex flex-col items-center justify-center text-white">
                    <span className="text-xl font-black leading-none">{pct}%</span>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold text-teal-800 dark:text-teal-300">
                      Por compras ≥ {formatCurrency(amt)} → {pct}% de descuento
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-slate-400">
                      <span>💰 Ahorro estimado sobre el mínimo: <strong className="text-teal-700 dark:text-teal-300">{formatCurrency(saving)}</strong></span>
                      <span>🧾 Cliente pagaría: <strong>{formatCurrency(amt - saving)}</strong></span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  <span>⚠️</span>
                  <span>Ingresa el monto mínimo y el porcentaje para ver la vista previa</span>
                </div>
              )}
            </div>

            {/* Filtro: alcance del descuento */}
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">¿A qué productos aplica?</p>

              <div className="grid grid-cols-3 gap-2">
                {VOLUME_SCOPES.map(s => (
                  <button key={s.value} type="button" onClick={() => setScope(s.value)}
                    className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${
                      scope === s.value
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                        : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700'
                    }`}>
                    <span className="text-xl">{s.icon}</span>
                    <span className={`text-xs font-semibold leading-tight ${scope === s.value ? 'text-teal-800 dark:text-teal-300' : 'text-gray-700 dark:text-slate-200'}`}>{s.label}</span>
                    <span className="text-[11px] text-gray-400 dark:text-slate-500 leading-tight">{s.desc}</span>
                  </button>
                ))}
              </div>

              {/* Selector de categorías */}
              {scope === 'categories' && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Selecciona las categorías que activan el descuento:</p>
                  <div className="flex flex-wrap gap-2 p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 min-h-[44px]">
                    {categories.map(c => (
                      <button key={c.id} type="button" onClick={() => toggleCat(c.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          categoryIds.includes(c.id)
                            ? 'bg-teal-500 text-white border-teal-500'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-teal-300'
                        }`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                  {categoryIds.length > 0 && (
                    <p className="text-xs text-teal-600 mt-1.5">✓ {categoryIds.length} categoría{categoryIds.length !== 1 ? 's' : ''} seleccionada{categoryIds.length !== 1 ? 's' : ''}</p>
                  )}
                </div>
              )}

              {/* Selector de marcas */}
              {scope === 'brand' && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
                    Marcas disponibles en el inventario:
                    <span className="ml-1 text-gray-400">{brandList.length > 0 ? brandList.join(' · ') : 'Ninguna registrada'}</span>
                  </p>
                  <div className="flex flex-wrap gap-2 p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 min-h-[44px]">
                    {brandList.map(b => (
                      <button key={b} type="button"
                        onClick={() => setBrands(prev => {
                          const list = prev.split(',').map(x=>x.trim()).filter(Boolean)
                          return list.includes(b) ? list.filter(x=>x!==b).join(', ') : [...list, b].join(', ')
                        })}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          brands.split(',').map(x=>x.trim()).includes(b)
                            ? 'bg-teal-500 text-white border-teal-500'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-teal-300'
                        }`}>
                        {b}
                      </button>
                    ))}
                    {brandList.length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 p-1">
                        No hay marcas registradas en el inventario.
                      </p>
                    )}
                  </div>
                  {brands.trim() && (
                    <p className="text-xs text-teal-600 mt-1.5">✓ Marcas seleccionadas: <strong>{brands}</strong></p>
                  )}
                </div>
              )}

              {scope === 'all' && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2">
                  <span>ℹ️</span>
                  <span>El descuento se aplicará sobre todos los productos del carrito cuando el subtotal supere {amt > 0 ? formatCurrency(amt) : 'el monto configurado'}.</span>
                </div>
              )}
            </div>

            {/* Ejemplo dinámico con los datos ingresados */}
            {amt > 0 && pct > 0 && (
              <div className="border border-dashed border-teal-300 rounded-xl p-3 text-xs text-teal-700 dark:text-teal-300 space-y-1">
                <p className="font-semibold">📋 Ejemplo de aplicación:</p>
                <p>
                  {scope === 'all' && `"Por la compra de ${formatCurrency(amt)} o más en cualquier producto, el cliente recibe un ${pct}% de descuento."`}
                  {scope === 'categories' && categoryIds.length > 0 && `"Por la compra de ${formatCurrency(amt)} o más en ${categoryIds.map(id => categories.find(c=>c.id===id)?.name).filter(Boolean).join(', ')}, el cliente recibe un ${pct}% de descuento."`}
                  {scope === 'categories' && categoryIds.length === 0 && '"Selecciona las categorías para ver el ejemplo."'}
                  {scope === 'brand' && brands.trim() && `"Por la compra de ${formatCurrency(amt)} o más en la marca ${brands}, el cliente recibe un ${pct}% de descuento."`}
                  {scope === 'brand' && !brands.trim() && '"Selecciona las marcas para ver el ejemplo."'}
                </p>
              </div>
            )}
          </div>
        )
      })()}

      {type === 'promotion' && (() => {
        // ── REGLA 1-5: Formulario NxM especializado ──────────────────────────
        const previewLabel = (buyQty && payQty && parseInt(payQty) < parseInt(buyQty))
          ? `${buyQty}×${payQty} — por cada ${buyQty} unidades, el cliente paga ${payQty} y recibe ${buyQty - payQty} gratis`
          : null

        return (
          <div className="space-y-4">
            {/* Banner explicativo */}
            <div className="flex items-start gap-3 bg-purple-50 border border-purple-200 rounded-xl p-3">
              <span className="text-xl flex-shrink-0">🎁</span>
              <div>
                <p className="text-sm font-semibold text-purple-800">Promoción NxM — solo aplica a productos específicos</p>
                <p className="text-xs text-purple-600 mt-0.5 leading-relaxed">
                  Define cuántas unidades lleva el cliente y cuántas paga. Esta promoción siempre se vincula a un producto del inventario.
                  Ej: <strong>Inka Kola 1L — 2×1</strong>, <strong>Sartén 24cm — 3×1</strong>.
                </p>
              </div>
            </div>

            {/* Configuración NxM */}
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Configuración de la promoción</p>

              <div className="grid grid-cols-3 gap-3">
                {/* Lleva */}
                <div>
                  <label className={labelCls}>Unidades que lleva (N) *</label>
                  <div className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => setBuyQty(v => Math.max(2, parseInt(v || 2) - 1))}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 text-lg font-bold">−</button>
                    <input type="number" min="2" step="1" value={buyQty}
                      onChange={e => setBuyQty(Math.max(2, parseInt(e.target.value) || 2))}
                      className={inputCls + ' text-center font-bold text-lg w-full'}/>
                    <button type="button"
                      onClick={() => setBuyQty(v => parseInt(v || 2) + 1)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 text-lg font-bold">+</button>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 text-center">Ej: 2 para 2×1 · 3 para 3×2</p>
                </div>

                {/* Paga */}
                <div>
                  <label className={labelCls}>Unidades que paga (M) *</label>
                  <div className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => setPayQty(v => Math.max(1, parseInt(v || 1) - 1))}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 text-lg font-bold">−</button>
                    <input type="number" min="1" step="1" value={payQty}
                      onChange={e => setPayQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className={inputCls + ' text-center font-bold text-lg w-full'}/>
                    <button type="button"
                      onClick={() => setPayQty(v => Math.min(parseInt(buyQty || 2) - 1, parseInt(v || 1) + 1))}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 text-lg font-bold">+</button>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 text-center">Ej: 1 para 2×1 · 2 para 3×2</p>
                </div>

                {/* Máx. por compra */}
                <div>
                  <label className={labelCls}>Máx. veces por compra</label>
                  <input type="number" min="0" step="1" value={maxPerPurchase}
                    onChange={e => setMaxPerPurchase(Math.max(0, parseInt(e.target.value) || 0))}
                    className={inputCls + ' text-center'}
                    placeholder="0"/>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 text-center">0 = sin límite</p>
                </div>
              </div>

              {/* Vista previa de la fórmula */}
              {previewLabel ? (
                <div className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-purple-200 rounded-xl p-3">
                  <div className="w-16 h-16 flex-shrink-0 rounded-xl bg-purple-600 flex flex-col items-center justify-center text-white">
                    <span className="text-2xl font-black leading-none">{buyQty}</span>
                    <span className="text-base font-bold leading-none">×</span>
                    <span className="text-2xl font-black leading-none">{payQty}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">{previewLabel}</p>
                    <div className="flex gap-4 mt-1.5 text-xs text-gray-500 dark:text-slate-400">
                      <span>🎁 Gratis por grupo: <strong>{parseInt(buyQty || 0) - parseInt(payQty || 0)}</strong></span>
                      {parseInt(maxPerPurchase) > 0 && <span>🔒 Máx.: <strong>{maxPerPurchase}× por compra</strong></span>}
                      {parseInt(maxPerPurchase) === 0 && <span>♾️ Sin límite de usos</span>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  <span>⚠️</span>
                  <span>Las unidades que paga deben ser menores a las que lleva (M &lt; N)</span>
                </div>
              )}
            </div>

            {/* REGLA 3: Scope obligatorio — solo productos */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className={labelCls + ' mb-0'}>Productos incluidos en la promoción *</p>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full uppercase tracking-wide">Requerido</span>
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                <span>⚠️</span>
                <span>La promoción NxM aplica <strong>únicamente a productos específicos</strong> del inventario. Debes seleccionar al menos uno.</span>
              </div>
              {/* Buscador de productos */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Buscar producto por nombre o código..."
                  className={inputCls + ' pl-9 text-sm'}/>
              </div>
              {/* Lista de selección */}
              <div className="max-h-52 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded-xl divide-y divide-gray-50 dark:divide-slate-700/50">
                {products
                  .filter(p => p.isActive)
                  .filter(p => !productSearch.trim() || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode.includes(productSearch))
                  .map(p => (
                    <label key={p.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${productIds.includes(p.id) ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}>
                      <input type="checkbox" checked={productIds.includes(p.id)} onChange={() => toggleProd(p.id)}
                        className="rounded accent-purple-600"/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-slate-100 truncate font-medium">{p.name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{p.barcode}{p.brand ? ` · ${p.brand}` : ''}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">{formatCurrency(p.priceSell)}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{p.unit}</p>
                      </div>
                    </label>
                  ))
                }
              </div>
              {/* Chips de seleccionados */}
              {productIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-gray-500 dark:text-slate-400 py-1">Seleccionados ({productIds.length}):</span>
                  {productIds.map(id => {
                    const p = products.find(x => x.id === id)
                    return p ? (
                      <span key={id} className="inline-flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full px-2 py-0.5 font-medium">
                        {p.name}
                        <button type="button" onClick={() => toggleProd(id)} className="text-purple-500 hover:text-purple-700 leading-none font-bold">×</button>
                      </span>
                    ) : null
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Alcance (scope) — oculto en NxM y volume (tienen su propio selector integrado) */}
      {type !== 'promotion' && type !== 'volume' && (
      <div>
        <label className={labelCls}>¿A qué productos aplica? *</label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {SCOPE_OPTIONS.map(s => (
            <button key={s.value} type="button" onClick={() => setScope(s.value)}
              className={`py-2 px-3 rounded-lg border text-xs font-medium text-left transition-all ${scope===s.value?'border-blue-500 bg-blue-50 text-blue-700':'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {scope === 'categories' && (
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Selecciona las categorías:</p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 dark:border-slate-600 rounded-lg">
              {categories.map(c => (
                <button key={c.id} type="button" onClick={() => toggleCat(c.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${categoryIds.includes(c.id)?'bg-blue-500 text-white':'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {scope === 'products' && (
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Selecciona los productos ({productIds.length} seleccionados):</p>
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded-lg">
              {products.filter(p=>p.isActive).map(p => (
                <label key={p.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 border-b border-gray-50 last:border-0 ${productIds.includes(p.id)?'bg-blue-50':''}`}>
                  <input type="checkbox" checked={productIds.includes(p.id)} onChange={() => toggleProd(p.id)} className="rounded"/>
                  <span className="text-sm text-gray-800 dark:text-slate-100 flex-1 min-w-0 truncate">{p.name}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">{formatCurrency(p.priceSell)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {scope === 'brand' && (
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Marcas disponibles: {brandList.join(', ') || 'Ninguna registrada'}</p>
            <input value={brands} onChange={e => setBrands(e.target.value)} className={inputCls} placeholder="Ej: Nike, Adidas, Alicorp (separadas por coma)"/>
          </div>
        )}
      </div>
      )}

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
              className={`w-12 h-10 rounded-lg text-xs font-semibold transition-all ${daysOfWeek.includes(d.value)?'bg-blue-500 text-white':'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200'}`}>
              {d.label}
            </button>
          ))}
        </div>
        {daysOfWeek.length > 0 && (
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Solo aplica los: {daysOfWeek.map(d => DAYS_OF_WEEK.find(x=>x.value===d)?.label).join(', ')}
          </p>
        )}
      </div>

      {/* Estado */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
        <button type="button" onClick={() => setIsActive(!isActive)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive?'bg-blue-600':'bg-gray-300'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive?'translate-x-6':'translate-x-1'}`}/>
        </button>
        <span className="text-sm text-gray-700 font-medium">{isActive ? 'Campaña habilitada' : 'Campaña deshabilitada'}</span>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">Cancelar</button>
        <button type="button" onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
          {editing ? 'Guardar cambios' : 'Crear campaña'}
        </button>
      </div>
    </div>
  )
}

// ─── Card de campaña ──────────────────────────────────────────────────────────
function CampaignCard({ campaign, categories, products, onEdit, onToggle, onDelete }) {
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
            <div className="space-y-1">
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-3xl font-black text-teal-600">{campaign.discountPct}%</span>
                <span className="text-xs text-gray-500 dark:text-slate-400">descuento</span>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2.5 py-1 font-medium">
                <span>≥</span>
                <span className="font-bold">{formatCurrency(campaign.minAmount)}</span>
                <span>en subtotal</span>
              </div>
            </div>
          ) : (
            <span className="text-3xl font-black text-blue-600">{campaign.discountPct}%</span>
          )}
          {campaign.type !== 'volume' && <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">de descuento</div>}
        </div>

        {/* Detalles */}
        <div className="space-y-1.5 text-xs text-gray-600 dark:text-slate-300">
          <div className="flex justify-between">
            <span className="text-gray-400 dark:text-slate-500">Vigencia</span>
            <span>{formatDate(campaign.dateFrom)} — {formatDate(campaign.dateTo)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 dark:text-slate-500">Aplica a</span>
            <span className="text-right max-w-[60%] truncate">
              {campaign.type === 'promotion'
                ? `${campaign.productIds?.length || 0} producto(s)`
                : campaign.scope === 'all'        ? 'Todos los productos'
                : campaign.scope === 'categories' ? catNames.join(', ') || 'Categorías sel.'
                : campaign.scope === 'brand'      ? campaign.brands?.join(', ') || 'Marcas sel.'
                : `${campaign.productIds?.length || 0} producto(s)`}
            </span>
          </div>
          {/* Volume: ejemplo descriptivo */}
          {campaign.type === 'volume' && (
            <div className="text-[11px] text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 rounded-lg px-2 py-1.5 leading-relaxed">
              {campaign.scope === 'all'
                ? `Por compras ≥ ${formatCurrency(campaign.minAmount)} → ${campaign.discountPct}% de descuento`
                : campaign.scope === 'categories'
                  ? `Por compras ≥ ${formatCurrency(campaign.minAmount)} en ${catNames.join(', ') || 'categorías sel.'} → ${campaign.discountPct}%`
                  : `Por compras ≥ ${formatCurrency(campaign.minAmount)} en ${campaign.brands?.join(', ') || 'marcas sel.'} → ${campaign.discountPct}%`}
            </div>
          )}
          {campaign.type === 'promotion' && parseInt(campaign.maxPerPurchase) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-slate-500">Límite por compra</span>
              <span className="text-purple-600 font-medium">{campaign.maxPerPurchase}× máx.</span>
            </div>
          )}
          {campaign.type === 'promotion' && (campaign.productIds?.length || 0) > 0 && (
            <div className="pt-0.5">
              <p className="text-gray-400 dark:text-slate-500 mb-1">Productos:</p>
              <div className="flex flex-wrap gap-1">
                {(campaign.productIds || []).slice(0, 3).map(id => {
                  const prod = products?.find(p => p.id === id)
                  return prod ? (
                    <span key={id} className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full">{prod.name}</span>
                  ) : null
                })}
                {(campaign.productIds?.length || 0) > 3 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">+{campaign.productIds.length - 3} más</span>
                )}
              </div>
            </div>
          )}
          {campaign.daysOfWeek?.length > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-slate-500">Días</span>
              <span>{campaign.daysOfWeek.map(d => DAYS_OF_WEEK.find(x=>x.value===d)?.label).join(', ')}</span>
            </div>
          )}
          {campaign.description && <p className="text-gray-400 dark:text-slate-500 italic">{campaign.description}</p>}
        </div>

        {/* Acciones */}
        <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
          <button onClick={() => onToggle(campaign)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${campaign.isActive ? 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
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
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Gestión de Descuentos</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">Campañas, promociones y descuentos automáticos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTemplates(true)}
            className="px-4 py-2 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 flex items-center gap-2">
            ⚡ Usar plantilla
          </button>
          <button onClick={() => setModal({ type: 'form', data: null })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Nueva campaña
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Total campañas</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{kpis.total}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-600 mb-1">🟢 Activas ahora</p>
          <p className="text-2xl font-bold text-green-700">{kpis.active}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600 mb-1">📅 Programadas</p>
          <p className="text-2xl font-bold text-blue-700">{kpis.scheduled}</p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">⏰ Vencidas</p>
          <p className="text-2xl font-bold text-gray-500 dark:text-slate-400">{kpis.expired}</p>
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
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          <button onClick={()=>setFilterType('all')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType==='all'?'bg-white shadow text-blue-600':'text-gray-500'}`}>Todos</button>
          {CAMPAIGN_TYPES.map(t => (
            <button key={t.value} onClick={()=>setFilterType(t.value)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType===t.value?'bg-white shadow text-blue-600':'text-gray-500'}`}>{t.icon} {t.label}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
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
            <CampaignCard key={c.id} campaign={c} categories={categories} products={products}
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
              <h2 className="font-semibold text-gray-800 dark:text-slate-100">⚡ Plantillas de campañas</h2>
              <button onClick={() => setShowTemplates(false)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-300">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Selecciona una plantilla y personaliza las fechas y el alcance.</p>
              <div className="grid grid-cols-2 gap-3">
                {CAMPAIGN_TEMPLATES.map((tpl, i) => {
                  const typeCfg = CAMPAIGN_TYPES.find(t => t.value === tpl.type)
                  return (
                    <button key={i} onClick={() => handleTemplate(tpl)}
                      className="flex items-start gap-3 p-4 border border-gray-200 dark:border-slate-600 rounded-xl hover:border-blue-300 hover:bg-blue-50 text-left transition-all">
                      <span className="text-2xl">{tpl.icon}</span>
                      <div>
                        <div className="text-sm font-semibold text-gray-800 dark:text-slate-100">{tpl.name}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{typeCfg?.label} · {tpl.type !== 'promotion' ? `${tpl.discountPct}% descuento` : `${tpl.buyQty}×${tpl.payQty}`}</div>
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
    </div>
  )
}
