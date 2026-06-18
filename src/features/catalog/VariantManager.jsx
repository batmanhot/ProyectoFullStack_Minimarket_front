import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/index'
import { api, USE_API } from '../../services/_base'
import { createSafeId } from './catalog.shared'
import toast from 'react-hot-toast'

const VARIANT_ATTR_PRESETS = ['Talla', 'Color', 'Tamaño', 'Sabor', 'Modelo', 'Material']

export function VariantManager({ productId }) {
  const { productVariants, addVariant, updateVariant, deleteVariant } = useStore()
  const variants   = productVariants.filter(v => v.productId === productId)
  const blankForm  = () => ({ id: null, barcode: '', sku: '', stock: 0, stockMin: 2, priceSell: '', attrs: [{ key: 'Talla', value: '' }] })
  const [form, setForm]           = useState(null)
  const [lastFocusIdx, setLastFocusIdx] = useState(null)
  const valueInputsRef = useRef([])

  useEffect(() => {
    if (lastFocusIdx !== null && valueInputsRef.current[lastFocusIdx]) {
      valueInputsRef.current[lastFocusIdx].focus()
      setLastFocusIdx(null)
    }
  }, [lastFocusIdx])

  const openEdit = (v) => setForm({ id: v.id, barcode: v.barcode, sku: v.sku || '', stock: v.stock, stockMin: v.stockMin ?? 2, priceSell: v.priceSell ?? '', attrs: Object.entries(v.attributes || {}).map(([key, value]) => ({ key, value })) })
  const setField = (field, value) => setForm(f => ({ ...f, [field]: value }))
  const setAttr  = (idx, field, value) => setForm(f => { const attrs = [...f.attrs]; attrs[idx] = { ...attrs[idx], [field]: value }; return { ...f, attrs } })

  const handleSave = async () => {
    if (!form.barcode.trim()) { toast.error('El código de barras es requerido'); return }
    const incomplete = form.attrs.filter(a => a.key.trim() && !a.value.trim())
    if (incomplete.length > 0) {
      toast.error(`Completa el valor de: ${incomplete.map(a => a.key).join(', ')}`, { duration: 3500 })
      const idx = form.attrs.findIndex(a => a.key.trim() && !a.value.trim())
      if (idx >= 0 && valueInputsRef.current[idx]) valueInputsRef.current[idx].focus()
      return
    }
    const attributes = Object.fromEntries(form.attrs.filter(a => a.key.trim() && a.value.trim()).map(a => [a.key.trim(), a.value.trim()]))
    const payload = { productId, barcode: form.barcode.trim(), sku: form.sku.trim(), stock: parseInt(form.stock)||0, stockMin: parseInt(form.stockMin)||2, priceSell: form.priceSell !== '' ? parseFloat(form.priceSell) : null, attributes }
    if (USE_API) {
      try {
        if (form.id) { const { data } = await api.put(`/products/${productId}/variants/${form.id}`, payload); updateVariant(form.id, data.data) }
        else         { const { data } = await api.post(`/products/${productId}/variants`, payload); addVariant(data.data) }
      } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar variante'); return }
    } else {
      if (form.id) updateVariant(form.id, payload)
      else addVariant({ id: createSafeId(), ...payload, createdAt: new Date().toISOString() })
    }
    toast.success(form.id ? 'Variante actualizada' : 'Variante agregada')
    setForm(null)
  }

  const inCls = 'w-full px-2.5 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-400'

  return (
    <div className="mt-3 border-2 border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden">
      <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-purple-800 dark:text-purple-300">Variantes de este producto</p>
          <p className="text-xs text-purple-600 dark:text-purple-400">{variants.length === 0 ? 'Sin variantes registradas' : `${variants.length} variante${variants.length !== 1 ? 's' : ''}`}</p>
        </div>
        {!form && <button type="button" onClick={() => setForm(blankForm())} className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 flex items-center gap-1.5"><span>+</span> Nueva variante</button>}
      </div>
      {variants.length > 0 && !form && (
        <div className="divide-y divide-purple-100 dark:divide-purple-900/40">
          {variants.map(v => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{Object.values(v.attributes || {}).join(' · ') || '(sin atributos)'}</p>
                <p className="text-xs text-gray-400">{v.barcode}{v.sku ? ` · ${v.sku}` : ''} · Stock: <span className={v.stock <= 0 ? 'text-red-500 font-semibold' : 'text-gray-500'}>{v.stock}</span>{v.priceSell ? ` · S/${Number(v.priceSell).toFixed(2)}` : ''}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button type="button" onClick={() => openEdit(v)} className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                </button>
                <button type="button" onClick={async () => {
                  if (USE_API) { try { await api.delete(`/products/${productId}/variants/${v.id}`) } catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar'); return } }
                  deleteVariant(v.id); toast.success('Variante eliminada')
                }} className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {variants.length === 0 && !form && <div className="px-4 py-5 text-center text-xs text-purple-400 bg-white dark:bg-slate-800">Sin variantes — haz clic en "Nueva variante" para agregar tallas, colores, etc.</div>}
      {form && (
        <div className="bg-white dark:bg-slate-800 p-4 space-y-3 border-t border-purple-100 dark:border-purple-900/40">
          <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide">{form.id ? 'Editar variante' : 'Nueva variante'}</p>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1 font-medium">Atributos (talla, color…)</p>
            <p className="text-xs text-purple-500 dark:text-purple-400 mb-2">Haz clic en un tipo y escribe su valor en el campo que aparece →</p>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {VARIANT_ATTR_PRESETS.map(key => {
                const exists = form.attrs.some(a => a.key === key)
                return (
                  <button key={key} type="button" disabled={exists}
                    onClick={() => { const nextIdx = form.attrs.length; setForm(f => ({ ...f, attrs: [...f.attrs, { key, value: '' }] })); setLastFocusIdx(nextIdx) }}
                    className={`px-2.5 py-1 rounded-full text-xs border font-medium transition-colors ${exists ? 'border-purple-400 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 cursor-default' : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-600'}`}>
                    {exists ? '✓ ' : '+ '}{key}
                  </button>
                )
              })}
            </div>
            <div className="space-y-2">
              {form.attrs.map((attr, idx) => {
                const isPreset = VARIANT_ATTR_PRESETS.includes(attr.key)
                const missingVal = attr.key.trim() && !attr.value.trim()
                const valuePlaceholder = attr.key === 'Talla' ? 'Ej: XS, S, M, L, XL' : attr.key === 'Color' ? 'Ej: Rojo, Azul, Negro' : attr.key === 'Tamaño' ? 'Ej: Pequeño, Grande' : attr.key === 'Sabor' ? 'Ej: Vainilla, Chocolate' : attr.key === 'Modelo' ? 'Ej: Clásico, Sport' : attr.key === 'Material' ? 'Ej: Algodón, Poliéster' : 'Escribe el valor...'
                return (
                  <div key={idx} className="flex items-center gap-2">
                    {isPreset ? (
                      <span className="inline-flex items-center px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold shrink-0 whitespace-nowrap border border-purple-200 dark:border-purple-700">{attr.key}</span>
                    ) : (
                      <input value={attr.key} onChange={e => setAttr(idx, 'key', e.target.value)} placeholder="Tipo (ej: Sabor)" className="w-28 shrink-0 px-2.5 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-400"/>
                    )}
                    <span className="text-gray-300 shrink-0 text-sm">→</span>
                    <input ref={el => { valueInputsRef.current[idx] = el }} value={attr.value} onChange={e => setAttr(idx, 'value', e.target.value)} placeholder={valuePlaceholder}
                      className={`flex-1 ${inCls} ${missingVal ? 'border-red-300 ring-1 ring-red-300' : ''}`}/>
                    <button type="button" onClick={() => setForm(f => { const a = f.attrs.filter((_,i) => i !== idx); return { ...f, attrs: a.length ? a : [{ key: 'Talla', value: '' }] } })} className="p-1 text-gray-300 hover:text-red-400 transition-colors shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                )
              })}
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, attrs: [...f.attrs, { key: '', value: '' }] }))} className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:underline">+ Agregar atributo personalizado</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block font-medium">Código de barras *</label><input value={form.barcode} onChange={e => setField('barcode', e.target.value)} className={inCls}/></div>
            <div><label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block font-medium">SKU interno</label><input value={form.sku} onChange={e => setField('sku', e.target.value)} className={inCls}/></div>
            <div><label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block font-medium">Stock</label><input type="number" min="0" value={form.stock} onChange={e => setField('stock', e.target.value)} className={inCls}/></div>
            <div><label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block font-medium">Precio venta (S/)</label><input type="number" min="0" step="0.01" value={form.priceSell} onChange={e => setField('priceSell', e.target.value)} placeholder="Del producto padre" className={inCls}/></div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setForm(null)} className="flex-1 py-2 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-xs hover:bg-gray-50 dark:hover:bg-slate-700">Cancelar</button>
            <button type="button" onClick={handleSave} className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700">{form.id ? 'Guardar cambios' : 'Agregar variante'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
