/**
 * CampaignForm.jsx — Formulario de campaña de descuento
 * Ruta: src/features/discounts/components/CampaignForm.jsx
 *
 * Soporta los 4 tipos: campaign, promotion (NxM), volume, line.
 * Cada tipo tiene su propio sub-formulario condicional.
 */

import { useState, useMemo } from 'react'
import { useStore }         from '../../../store/index'
import { formatCurrency }   from '../../../shared/utils/helpers'
import {
  CAMPAIGN_TYPES, SCOPE_OPTIONS, DAYS_OF_WEEK,
} from '../../../shared/utils/discountEngine'
import toast from 'react-hot-toast'

const inputCls = 'w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100'
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1'

export default function CampaignForm({ campaign, categories, products, onClose }) {
  const { addDiscountCampaign, updateDiscountCampaign } = useStore()
  const editing = !!campaign?.id

  const [type,           setType]           = useState(campaign?.type           || 'campaign')
  const [name,           setName]           = useState(campaign?.name           || '')
  const [icon,           setIcon]           = useState(campaign?.icon           || '🏷️')
  const [description,    setDescription]    = useState(campaign?.description    || '')
  const [isActive,       setIsActive]       = useState(campaign?.isActive       !== false)
  const [dateFrom,       setDateFrom]       = useState(campaign?.dateFrom       || '')
  const [dateTo,         setDateTo]         = useState(campaign?.dateTo         || '')
  const [daysOfWeek,     setDaysOfWeek]     = useState(campaign?.daysOfWeek     || [])
  const [scope,          setScope]          = useState(campaign?.scope          || 'all')
  const [categoryIds,    setCategoryIds]    = useState(campaign?.categoryIds    || [])
  const [productIds,     setProductIds]     = useState(campaign?.productIds     || [])
  const [brands,         setBrands]         = useState((campaign?.brands || []).join(', '))
  const [discountPct,    setDiscountPct]    = useState(campaign?.discountPct    || '')
  const [minAmount,      setMinAmount]      = useState(campaign?.minAmount      || '')
  const [buyQty,         setBuyQty]         = useState(campaign?.buyQty         || 2)
  const [payQty,         setPayQty]         = useState(campaign?.payQty         || 1)
  const [maxPerPurchase, setMaxPerPurchase] = useState(campaign?.maxPerPurchase || 0)
  const [minQty,         setMinQty]         = useState(campaign?.minQty         || 2)
  const [discountOnNth,  setDiscountOnNth]  = useState(campaign?.discountOnNth  || 3)
  const [productSearch,  setProductSearch]  = useState('')

  const brandList = useMemo(() =>
    [...new Set(products.filter((p) => p.brand).map((p) => p.brand))].sort()
  , [products])

  const toggleDay  = (d)  => setDaysOfWeek((prev) => prev.includes(d)  ? prev.filter((x) => x !== d)  : [...prev, d])
  const toggleCat  = (id) => setCategoryIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  const toggleProd = (id) => setProductIds((prev)  => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const toggleBrand = (b) => setBrands((prev) => {
    const list = prev.split(',').map((x) => x.trim()).filter(Boolean)
    return list.includes(b) ? list.filter((x) => x !== b).join(', ') : [...list, b].join(', ')
  })

  const handleSave = () => {
    if (!name.trim()) { toast.error('Ingresa un nombre para la campaña'); return }
    if (!dateFrom)    { toast.error('Selecciona la fecha de inicio'); return }
    if (!dateTo)      { toast.error('Selecciona la fecha de término'); return }
    if (new Date(dateFrom) > new Date(dateTo)) { toast.error('La fecha de inicio debe ser antes que la de término'); return }
    if (type !== 'promotion' && !discountPct)  { toast.error('Ingresa el porcentaje de descuento'); return }

    if (type === 'volume') {
      if (!minAmount || parseFloat(minAmount) <= 0) { toast.error('Ingresa el subtotal mínimo de compra'); return }
      if (scope === 'categories' && categoryIds.length === 0) { toast.error('Selecciona al menos una categoría'); return }
      if (scope === 'brand' && !brands.trim())                { toast.error('Selecciona al menos una marca'); return }
    }
    if (type === 'promotion') {
      if (parseInt(payQty) >= parseInt(buyQty)) { toast.error('Las unidades a pagar (M) deben ser menores a las que lleva (N)'); return }
      if (parseInt(buyQty) < 2)                 { toast.error('El cliente debe llevar al menos 2 unidades'); return }
      if (productIds.length === 0)              { toast.error('La promoción NxM requiere seleccionar al menos un producto'); return }
    }
    if (type === 'line') {
      if (parseInt(discountOnNth) <= parseInt(minQty)) { toast.error('El producto con descuento (N°) debe ser mayor a la cantidad mínima'); return }
      if (parseInt(minQty) < 1) { toast.error('La cantidad mínima debe ser al menos 1'); return }
      if (scope === 'categories' && categoryIds.length === 0) { toast.error('Selecciona al menos una categoría'); return }
      if (scope === 'brand' && !brands.trim())                { toast.error('Selecciona al menos una marca'); return }
    }

    const data = {
      id:          campaign?.id || crypto.randomUUID(),
      type, name: name.trim(), icon, description: description.trim(), isActive,
      dateFrom, dateTo,
      daysOfWeek:    daysOfWeek.length > 0 ? daysOfWeek : [],
      scope:         type === 'promotion' ? 'products' : scope,
      categoryIds:   scope === 'categories' && type !== 'promotion' ? categoryIds : [],
      productIds:    (scope === 'products' || type === 'promotion') ? productIds : [],
      brands:        scope === 'brand' && type !== 'promotion' ? brands.split(',').map((b) => b.trim()).filter(Boolean) : [],
      discountPct:   type !== 'promotion' ? parseFloat(discountPct) : 0,
      minAmount:     type === 'volume'    ? parseFloat(minAmount)   : 0,
      buyQty:        type === 'promotion' ? parseInt(buyQty)        : 0,
      payQty:        type === 'promotion' ? parseInt(payQty)        : 0,
      maxPerPurchase: type === 'promotion' ? parseInt(maxPerPurchase) || 0 : 0,
      minQty:        type === 'line'      ? parseInt(minQty)        : 0,
      discountOnNth: type === 'line'      ? parseInt(discountOnNth) : 0,
      createdAt:     campaign?.createdAt  || new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
    }

    if (editing) { updateDiscountCampaign(campaign.id, data); toast.success('Campaña actualizada') }
    else         { addDiscountCampaign(data);                 toast.success('Campaña creada') }
    onClose()
  }

  // ── Selector de categorías (reutilizado en varios tipos) ──────────────────
  const CategorySelector = ({ accentColor = 'blue' }) => {
    const cls = {
      blue:   { sel: 'bg-blue-500 text-white border-blue-500',   idle: 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-blue-300'   },
      teal:   { sel: 'bg-teal-500 text-white border-teal-500',   idle: 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-teal-300'   },
      orange: { sel: 'bg-orange-500 text-white border-orange-500', idle: 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-orange-300' },
    }[accentColor]
    return (
      <div className="flex flex-wrap gap-2 p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 min-h-[44px]">
        {categories.map((c) => (
          <button key={c.id} type="button" onClick={() => toggleCat(c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${categoryIds.includes(c.id) ? cls.sel : cls.idle}`}>
            {c.name}
          </button>
        ))}
      </div>
    )
  }

  // ── Selector de marcas (reutilizado en varios tipos) ───────────────────────
  const BrandSelector = ({ accentColor = 'blue' }) => {
    const cls = {
      blue:   'bg-blue-500 text-white border-blue-500',
      teal:   'bg-teal-500 text-white border-teal-500',
      orange: 'bg-orange-500 text-white border-orange-500',
    }[accentColor]
    const idleCls = 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600'
    const selectedBrands = brands.split(',').map((x) => x.trim()).filter(Boolean)
    return (
      <div className="flex flex-wrap gap-2 p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 min-h-[44px]">
        {brandList.map((b) => (
          <button key={b} type="button" onClick={() => toggleBrand(b)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${selectedBrands.includes(b) ? cls : idleCls}`}>
            {b}
          </button>
        ))}
        {brandList.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-slate-500 p-1">Sin marcas en inventario</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Tipo de campaña */}
      <div>
        <label className={labelCls}>Tipo de descuento *</label>
        <div className="grid grid-cols-2 gap-2">
          {CAMPAIGN_TYPES.map((t) => (
            <button key={t.value} type="button" onClick={() => setType(t.value)}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${type === t.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700'}`}>
              <span className="text-2xl flex-shrink-0">{t.icon}</span>
              <div>
                <div className={`text-xs font-semibold ${type === t.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-slate-200'}`}>{t.label}</div>
                <div className="text-xs text-gray-400 dark:text-slate-500 leading-tight mt-0.5">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Nombre e ícono */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>Ícono</label>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} className={inputCls} maxLength={4}/>
        </div>
        <div className="col-span-3">
          <label className={labelCls}>Nombre de la campaña *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ej: Día de la Madre 2025"/>
        </div>
      </div>

      <div>
        <label className={labelCls}>Descripción (opcional)</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} placeholder="Descripción visible para el cajero"/>
      </div>

      {/* ── Parámetros específicos por tipo ─────────────────────────────────── */}

      {/* Tipo: campaign — solo % */}
      {type === 'campaign' && (
        <div>
          <label className={labelCls}>Porcentaje de descuento *</label>
          <div className="relative w-40">
            <input type="number" min="0.1" max="100" step="0.5" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} className={inputCls + ' pr-8'} placeholder="10"/>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-slate-500 font-bold">%</span>
          </div>
        </div>
      )}

      {/* Tipo: line — Compra X → desc. en N° */}
      {type === 'line' && (() => {
        const qty   = parseInt(minQty) || 0
        const nth   = parseInt(discountOnNth) || 0
        const pct   = parseFloat(discountPct) || 0
        const valid = qty >= 1 && nth > qty && pct > 0

        const LINE_SCOPES = [
          { value: 'all',        label: 'Todos los productos',  icon: '🛒' },
          { value: 'categories', label: 'Categoría específica', icon: '🗂️' },
          { value: 'brand',      label: 'Marca específica',     icon: '🏷️' },
        ]

        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3">
              <span className="text-xl flex-shrink-0">🏪</span>
              <p className="text-xs text-orange-700 dark:text-orange-300 leading-relaxed">
                <strong>Compra X — el N° producto con descuento.</strong>{' '}
                Ej: "Compra 3 Lácteos → el 4° tiene 50% descuento".
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Compra mínima (uds.) *</label>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setMinQty((v) => Math.max(1, parseInt(v || 1) - 1))} className="w-8 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 font-bold">−</button>
                    <input type="number" min="1" step="1" value={minQty} onChange={(e) => setMinQty(Math.max(1, parseInt(e.target.value) || 1))} className={inputCls + ' text-center font-bold'}/>
                    <button type="button" onClick={() => setMinQty((v) => parseInt(v || 1) + 1)} className="w-8 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 font-bold">+</button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>N° producto beneficiado *</label>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setDiscountOnNth((v) => Math.max(parseInt(minQty || 1) + 1, parseInt(v || 2) - 1))} className="w-8 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 font-bold">−</button>
                    <input type="number" min={parseInt(minQty || 1) + 1} step="1" value={discountOnNth} onChange={(e) => setDiscountOnNth(Math.max(parseInt(minQty || 1) + 1, parseInt(e.target.value) || 2))} className={inputCls + ' text-center font-bold'}/>
                    <button type="button" onClick={() => setDiscountOnNth((v) => parseInt(v || 2) + 1)} className="w-8 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 font-bold">+</button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Descuento aplicado *</label>
                  <div className="relative">
                    <input type="number" min="1" max="100" step="1" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} className={inputCls + ' pr-8 font-bold text-center'} placeholder="50"/>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 dark:text-slate-500">%</span>
                  </div>
                </div>
              </div>
              {valid ? (
                <div className="flex items-stretch gap-3 bg-white dark:bg-slate-800 border border-orange-200 rounded-xl overflow-hidden">
                  <div className="bg-orange-500 px-4 flex flex-col items-center justify-center text-white shrink-0">
                    <span className="text-2xl font-black">{qty}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide">uds.</span>
                    <span className="text-xl mt-1">→</span>
                    <span className="text-2xl font-black mt-1">{pct}%</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide">desc.</span>
                  </div>
                  <div className="p-3 flex-1 space-y-1.5">
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                      Compra {qty} uds. → el <strong>{nth}°</strong> con <strong className="text-orange-600">{pct}% de desc.</strong>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Si hay menos de {nth} unidades elegibles, no aplica el descuento.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  ⚠️ El N° beneficiado debe ser mayor a la cantidad mínima y el % mayor a 0.
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">¿A qué productos aplica?</p>
              <div className="grid grid-cols-3 gap-2">
                {LINE_SCOPES.map((s) => (
                  <button key={s.value} type="button" onClick={() => setScope(s.value)}
                    className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${scope === s.value ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <span className="text-xl">{s.icon}</span>
                    <span className={`text-xs font-semibold ${scope === s.value ? 'text-orange-800 dark:text-orange-300' : 'text-gray-700 dark:text-slate-200'}`}>{s.label}</span>
                  </button>
                ))}
              </div>
              {scope === 'categories' && <CategorySelector accentColor="orange"/>}
              {scope === 'brand'      && <BrandSelector accentColor="orange"/>}
            </div>
          </div>
        )
      })()}

      {/* Tipo: volume — descuento por monto mínimo */}
      {type === 'volume' && (() => {
        const amt    = parseFloat(minAmount) || 0
        const pct    = parseFloat(discountPct) || 0
        const saving = parseFloat((amt * pct / 100).toFixed(2))

        const VOLUME_SCOPES = [
          { value: 'all',        label: 'Todos los productos',    icon: '🛒' },
          { value: 'categories', label: 'Categoría específica',   icon: '🗂️' },
          { value: 'brand',      label: 'Marca específica',       icon: '🏷️' },
        ]

        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-3">
              <span className="text-xl flex-shrink-0">📦</span>
              <p className="text-xs text-teal-700 dark:text-teal-300 leading-relaxed">
                <strong>Descuento por volumen.</strong>{' '}
                Ej: "Por compras ≥ S/ 300 en Gloria → 5% de descuento".
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Subtotal mínimo (S/) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 dark:text-slate-500">S/</span>
                    <input type="number" min="1" step="10" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className={inputCls + ' pl-9 font-mono'} placeholder="300"/>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Porcentaje de descuento *</label>
                  <div className="relative">
                    <input type="number" min="0.1" max="100" step="0.5" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} className={inputCls + ' pr-9 font-mono'} placeholder="5"/>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 dark:text-slate-500">%</span>
                  </div>
                </div>
              </div>
              {amt > 0 && pct > 0 && (
                <div className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-teal-200 rounded-xl p-3">
                  <div className="w-14 h-14 flex-shrink-0 rounded-xl bg-teal-600 flex items-center justify-center text-white text-xl font-black">{pct}%</div>
                  <div>
                    <p className="text-sm font-semibold text-teal-800 dark:text-teal-300">Por compras ≥ {formatCurrency(amt)} → {pct}% de descuento</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Ahorro estimado sobre el mínimo: <strong className="text-teal-700 dark:text-teal-300">{formatCurrency(saving)}</strong></p>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">¿A qué productos aplica?</p>
              <div className="grid grid-cols-3 gap-2">
                {VOLUME_SCOPES.map((s) => (
                  <button key={s.value} type="button" onClick={() => setScope(s.value)}
                    className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${scope === s.value ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <span className="text-xl">{s.icon}</span>
                    <span className={`text-xs font-semibold ${scope === s.value ? 'text-teal-800 dark:text-teal-300' : 'text-gray-700 dark:text-slate-200'}`}>{s.label}</span>
                  </button>
                ))}
              </div>
              {scope === 'categories' && <CategorySelector accentColor="teal"/>}
              {scope === 'brand'      && <BrandSelector accentColor="teal"/>}
            </div>
          </div>
        )
      })()}

      {/* Tipo: promotion (NxM) */}
      {type === 'promotion' && (() => {
        const preview = parseInt(payQty) < parseInt(buyQty)
          ? `${buyQty}×${payQty} — por cada ${buyQty} uds., el cliente paga ${payQty} y recibe ${buyQty - payQty} gratis`
          : null

        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-3">
              <span className="text-xl flex-shrink-0">🎁</span>
              <p className="text-xs text-purple-700 dark:text-purple-300 leading-relaxed">
                <strong>Promoción NxM — solo aplica a productos específicos.</strong>{' '}
                Ej: "Inka Kola 1L — 2×1", "Sartén 24cm — 3×2".
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Lleva (N) *</label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setBuyQty((v) => Math.max(2, parseInt(v || 2) - 1))} className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700">−</button>
                    <input type="number" min="2" step="1" value={buyQty} onChange={(e) => setBuyQty(Math.max(2, parseInt(e.target.value) || 2))} className={inputCls + ' text-center font-bold text-lg'}/>
                    <button type="button" onClick={() => setBuyQty((v) => parseInt(v || 2) + 1)} className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700">+</button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Paga (M) *</label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPayQty((v) => Math.max(1, parseInt(v || 1) - 1))} className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700">−</button>
                    <input type="number" min="1" step="1" value={payQty} onChange={(e) => setPayQty(Math.max(1, parseInt(e.target.value) || 1))} className={inputCls + ' text-center font-bold text-lg'}/>
                    <button type="button" onClick={() => setPayQty((v) => Math.min(parseInt(buyQty || 2) - 1, parseInt(v || 1) + 1))} className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700">+</button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Máx. por compra</label>
                  <input type="number" min="0" step="1" value={maxPerPurchase} onChange={(e) => setMaxPerPurchase(Math.max(0, parseInt(e.target.value) || 0))} className={inputCls + ' text-center'} placeholder="0"/>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 text-center">0 = sin límite</p>
                </div>
              </div>
              {preview ? (
                <div className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-purple-200 rounded-xl p-3">
                  <div className="w-16 h-16 flex-shrink-0 rounded-xl bg-purple-600 flex flex-col items-center justify-center text-white">
                    <span className="text-2xl font-black">{buyQty}</span>
                    <span className="text-base font-bold">×</span>
                    <span className="text-2xl font-black">{payQty}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">{preview}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      Gratis por grupo: <strong>{parseInt(buyQty || 0) - parseInt(payQty || 0)}</strong>
                      {parseInt(maxPerPurchase) > 0 ? ` · Máx: ${maxPerPurchase}× por compra` : ' · Sin límite'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  ⚠️ M (paga) debe ser menor a N (lleva).
                </div>
              )}
            </div>

            {/* Selección de productos — obligatorio para NxM */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className={labelCls + ' mb-0'}>Productos incluidos *</label>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full uppercase">Requerido</span>
              </div>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar producto..." className={inputCls + ' pl-9'}/>
              </div>
              <div className="max-h-52 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded-xl divide-y divide-gray-50 dark:divide-slate-700/50">
                {products
                  .filter((p) => p.isActive)
                  .filter((p) => !productSearch.trim() || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode.includes(productSearch))
                  .map((p) => (
                    <label key={p.id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${productIds.includes(p.id) ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}>
                      <input type="checkbox" checked={productIds.includes(p.id)} onChange={() => toggleProd(p.id)} className="rounded accent-purple-600"/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-slate-100 truncate font-medium">{p.name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{p.barcode}{p.brand ? ` · ${p.brand}` : ''}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-slate-200 flex-shrink-0">{formatCurrency(p.priceSell)}</span>
                    </label>
                  ))}
              </div>
              {productIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {productIds.map((id) => {
                    const p = products.find((x) => x.id === id)
                    return p ? (
                      <span key={id} className="inline-flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full px-2 py-0.5 font-medium">
                        {p.name}
                        <button type="button" onClick={() => toggleProd(id)} className="text-purple-500 hover:text-purple-700 font-bold leading-none">×</button>
                      </span>
                    ) : null
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Alcance (scope) — solo para "campaign" sin sub-formulario propio */}
      {type === 'campaign' && (
        <div>
          <label className={labelCls}>¿A qué productos aplica? *</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {SCOPE_OPTIONS.map((s) => (
              <button key={s.value} type="button" onClick={() => setScope(s.value)}
                className={`py-2 px-3 rounded-lg border text-xs font-medium text-left transition-all ${scope === s.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                {s.label}
              </button>
            ))}
          </div>
          {scope === 'categories' && (
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Selecciona las categorías:</p>
              <CategorySelector accentColor="blue"/>
            </div>
          )}
          {scope === 'products' && (
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Selecciona los productos ({productIds.length} seleccionados):</p>
              <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded-lg">
                {products.filter((p) => p.isActive).map((p) => (
                  <label key={p.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-50 dark:border-slate-700/50 last:border-0 ${productIds.includes(p.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
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
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Marcas: {brandList.join(', ') || 'Ninguna'}</p>
              <BrandSelector accentColor="blue"/>
            </div>
          )}
        </div>
      )}

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Fecha de inicio *</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls}/>
        </div>
        <div>
          <label className={labelCls}>Fecha de término *</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls}/>
        </div>
      </div>

      {/* Días de la semana */}
      <div>
        <label className={labelCls}>Días de la semana (vacío = todos)</label>
        <div className="flex gap-2 flex-wrap">
          {DAYS_OF_WEEK.map((d) => (
            <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
              className={`w-12 h-10 rounded-lg text-xs font-semibold transition-all ${daysOfWeek.includes(d.value) ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'}`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Estado activo */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
        <button type="button" onClick={() => setIsActive(!isActive)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`}/>
        </button>
        <span className="text-sm text-gray-700 dark:text-slate-300 font-medium">
          {isActive ? 'Campaña habilitada' : 'Campaña deshabilitada'}
        </span>
      </div>

      {/* Acciones */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
          Cancelar
        </button>
        <button type="button" onClick={handleSave}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
          {editing ? 'Guardar cambios' : 'Crear campaña'}
        </button>
      </div>
    </div>
  )
}
