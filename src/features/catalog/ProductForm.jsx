import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { productSchema } from '../../shared/schemas/index'
import { useStore } from '../../store/index'
import { productService } from '../../services/index'
import { inputCls, labelCls, btnSecondary, btnPrimary, createSafeId } from './catalog.shared'
import toast from 'react-hot-toast'

export function ProductForm({ product, onClose }) {
  const { categories, brands, suppliers, products: allProducts, addCategory, addBrand, addSupplier, locations } = useStore()
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: product ? {
      ...product,
      stockControl: product.stockControl || 'simple',
      type: (product.type === 'normal' ? 'simple' : product.type) || 'simple',
      useBatches: product.useBatches ?? false,
      components: (product.components || []).map(comp => {
        const p = allProducts.find(pr => pr.id === comp.productId)
        return { ...comp, _name: p?.name ?? comp._name ?? comp.productId, _barcode: p?.barcode ?? comp._barcode ?? '', _unit: p?.unit ?? comp._unit ?? 'u', _priceSell: p?.priceSell ?? comp._priceSell ?? 0 }
      }),
      imageUrl: product.imageUrl || '',
      brand: product.brandId || product.brand || '',
    } : { unit: 'unidad', stockMin: 5, stockMax: 100, isActive: true, hasVariants: false, useBatches: false, imageUrl: '', stockControl: 'simple', type: 'simple', components: [], brand: '', categoryId: '', supplierId: '' },
  })

  const [productId]     = useState(() => product?.id ?? createSafeId())
  const imageUrl        = watch('imageUrl')
  const useBatches      = watch('useBatches')
  const hasVariants     = watch('hasVariants') ?? false
  const productType     = watch('type') || 'simple'
  const [imgError, setImgError]         = useState(false)
  const [bundleSearch, setBundleSearch] = useState('')
  const [bundleResults, setBundleResults] = useState([])
  const [quickModal, setQuickModal]     = useState(null)
  const [quickName,  setQuickName]      = useState('')
  const [quickColor, setQuickColor]     = useState('#3b82f6')

  const QUICK_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899']

  const handleQuickCreate = () => {
    const name = quickName.trim()
    if (!name) { toast.error('Ingresa un nombre'); return }
    if (quickModal === 'brand')    { const id = crypto.randomUUID(); addBrand?.({ id, name, color: quickColor, isActive: true, createdAt: new Date().toISOString() }); setValue('brand', name); toast.success(`Marca "${name}" creada`) }
    else if (quickModal === 'category') { const id = crypto.randomUUID(); addCategory({ id, name, color: quickColor, description: '', isActive: true, createdAt: new Date().toISOString() }); setValue('categoryId', id); toast.success(`Categoría "${name}" creada`) }
    else if (quickModal === 'supplier') { const id = crypto.randomUUID(); addSupplier?.({ id, name, isActive: true, createdAt: new Date().toISOString() }); setValue('supplierId', id); toast.success(`Proveedor "${name}" creado`) }
    setQuickModal(null); setQuickName('')
  }

  const onSubmit = async (data) => {
    const payload = { ...data, imageUrl: data.imageUrl?.trim() || '' }
    const result = product ? await productService.update(product.id, payload) : await productService.create({ id: productId, ...payload })
    if (result.error) { toast.error(result.error); return }
    toast.success(product ? 'Producto actualizado' : 'Producto creado')
    onClose()
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2"><label className={labelCls}>Nombre del producto *</label><input {...register('name')} className={inputCls}/>{errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}</div>
          <div><label className={labelCls}>Código de barras *</label><input {...register('barcode')} className={inputCls}/>{errors.barcode && <p className="text-xs text-red-500 mt-1">{errors.barcode.message}</p>}</div>
          <div><label className={labelCls}>SKU / Código interno</label><input {...register('sku')} className={inputCls}/></div>
          <div>
            <div className="flex items-center justify-between mb-1"><label className={labelCls}>Marca</label><button type="button" onClick={() => { setQuickModal('brand'); setQuickName('') }} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Nueva marca</button></div>
            <select {...register('brand')} className={inputCls}><option value="">Sin marca</option>{brands?.filter(b => b.isActive).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}</select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1"><label className={labelCls}>Categoría *</label><button type="button" onClick={() => { setQuickModal('category'); setQuickName('') }} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Nueva categoría</button></div>
            <select {...register('categoryId')} className={inputCls}><option value="">Seleccionar...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId.message}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1"><label className={labelCls}>Proveedor *</label><button type="button" onClick={() => { setQuickModal('supplier'); setQuickName('') }} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Nuevo proveedor</button></div>
            <select {...register('supplierId')} className={inputCls}><option value="">Seleccionar...</option>{suppliers.filter(s => s.isActive !== false).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            {errors.supplierId && <p className="text-xs text-red-500 mt-1">{errors.supplierId.message}</p>}
          </div>
          <div><label className={labelCls}>Unidad de medida *</label><select {...register('unit')} className={inputCls}>{['unidad','kg','g','litro','ml','metro','cm','docena','caja','paquete'].map(u => <option key={u} value={u}>{u}</option>)}</select></div>
          <div><label className={labelCls}>Precio de compra (S/) *</label><input type="number" step="1" min="0" {...register('priceBuy')} className={inputCls}/>{errors.priceBuy && <p className="text-xs text-red-500 mt-1">{errors.priceBuy.message}</p>}</div>
          <div><label className={labelCls}>Precio de venta (S/) *</label><input type="number" step="1" min="0" {...register('priceSell')} className={inputCls}/>{errors.priceSell && <p className="text-xs text-red-500 mt-1">{errors.priceSell.message}</p>}</div>
          <div><label className={labelCls}>Stock actual</label><input type="number" step="1" min="0" {...register('stock')} className={inputCls}/></div>
          <div><label className={labelCls}>Stock mínimo</label><input type="number" step="1" min="0" {...register('stockMin')} className={inputCls}/></div>
          <div>
            <label className={labelCls}>Ubicación en almacén</label>
            {locations.filter(l => l.isActive).length > 0 ? (
              <select {...register('location')} className={inputCls}><option value="">— Sin ubicación —</option>{locations.filter(l => l.isActive).map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select>
            ) : (
              <div className="flex gap-2 items-center"><input {...register('location')} placeholder="Ej: Almacén, Góndola A" className={inputCls}/><span className="text-xs text-amber-500 whitespace-nowrap">Configura ubicaciones en Ajustes → Ubicaciones</span></div>
            )}
          </div>
          <div><label className={labelCls}>Fecha de vencimiento</label><input type="date" {...register('expiryDate')} className={inputCls}/></div>
          <div className="col-span-2">
            <label className={labelCls}>URL de imagen del producto</label>
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <input {...register('imageUrl')} onChange={e => { setValue('imageUrl', e.target.value, { shouldValidate: true }); setImgError(false) }} placeholder="https://... (JPG, PNG o WebP)" className={inputCls}/>
                {errors.imageUrl && <p className="text-xs text-red-500 mt-1">{errors.imageUrl.message}</p>}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Opcional · Se muestra en el POS al buscar y en el catálogo</p>
              </div>
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0 bg-gray-50 dark:bg-slate-700">
                {imageUrl && !imgError ? <img src={imageUrl} alt="preview" onError={() => setImgError(true)} className="w-full h-full object-cover rounded-xl"/> : <span className="text-2xl opacity-30">🖼️</span>}
              </div>
            </div>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Estrategia de control de inventario *</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[
                { value: 'simple',    icon: '📦', label: 'Simple',     desc: 'Stock manual. Sin lotes. Para ropa, plásticos, librería, artículos de bazar.' },
                { value: 'lote_fefo', icon: '🕐', label: 'Lotes FEFO', desc: 'Vence primero → sale primero. Para alimentos, medicamentos, cosméticos, panadería.' },
                { value: 'lote_fifo', icon: '📥', label: 'Lotes FIFO', desc: 'Entró primero → sale primero. Para ferretería, repuestos, ropa con lotes.' },
                { value: 'serie',     icon: '🔢', label: 'Por serie',   desc: 'Cada unidad con N° de serie único. Para electrónica, óptica, equipos.' },
              ].map(opt => {
                const sel = (watch('stockControl') || 'simple') === opt.value
                const selColor = { simple: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20', lote_fefo: 'border-green-500 bg-green-50 dark:bg-green-900/20', lote_fifo: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20', serie: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' }[opt.value]
                return (
                  <button key={opt.value} type="button" onClick={() => { setValue('stockControl', opt.value); setValue('useBatches', opt.value === 'lote_fefo' || opt.value === 'lote_fifo') }}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${sel ? selColor : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{opt.icon}</span>
                      <span className={`text-sm font-semibold ${sel ? 'text-gray-800 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}>{opt.label}</span>
                      {sel && <span className="ml-auto w-2 h-2 rounded-full bg-current"/>}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 leading-snug">{opt.desc}</p>
                  </button>
                )
              })}
            </div>
            <input type="hidden" {...register('stockControl')}/>
            {errors.stockControl && <p className="text-xs text-red-500 mt-1">{errors.stockControl.message}</p>}
            {['lote_fefo','lote_fifo'].includes(watch('stockControl')) && !useBatches && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <span>⚠️</span><span>Para usar esta estrategia debes activar también <strong>Gestión por lotes</strong> abajo y registrar los lotes en el módulo de Catálogo → pestaña Lotes.</span>
              </div>
            )}
          </div>
          {watch('stockControl') === 'serie' && (
            <div className="col-span-2">
              {product?.serials?.length > 0 ? (
                <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl">
                  <span className="text-xl shrink-0">🔑</span>
                  <div>
                    <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                      {product.serials.filter(s => s.status === 'disponible').length} serial(es) disponible(s) registrado(s)
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                      Los N° de serie se gestionan desde <strong>Catálogo → Seriales</strong>. El stock se calcula automáticamente según los seriales disponibles.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <label className={labelCls}>Número de serie 🔢</label>
                  <input {...register('serialNumber')} placeholder="Ej: SN-SAM55-001-2024" className={inputCls}/>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    Para gestionar <strong>múltiples seriales</strong> de este producto, usa <strong>Catálogo → Seriales</strong> una vez guardado.
                  </p>
                </>
              )}
            </div>
          )}
          <div className="col-span-2">
            <label className={labelCls}>Tipo de producto</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[
                { value: 'simple', icon: '📦', label: 'Producto simple', desc: 'Unidad individual con su propio stock. La gran mayoría de los productos.' },
                { value: 'bundle', icon: '🎁', label: 'Bundle / Kit',    desc: 'Paquete compuesto. Al vender descuenta stock de cada componente automáticamente.' },
              ].map(opt => {
                const sel = productType === opt.value
                return (
                  <button key={opt.value} type="button" onClick={() => setValue('type', opt.value)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${sel ? (opt.value === 'bundle' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20') : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{opt.icon}</span>
                      <span className={`text-sm font-semibold ${sel ? 'text-gray-800 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}>{opt.label}</span>
                      {sel && <span className="ml-auto w-2 h-2 rounded-full bg-current"/>}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 leading-snug">{opt.desc}</p>
                  </button>
                )
              })}
            </div>
            <input type="hidden" {...register('type')}/>
            {errors.type && <p className="text-xs text-red-500 mt-1">{errors.type.message}</p>}
          </div>
          {productType === 'bundle' && (
            <div className="col-span-2">
              <div className="border-2 border-orange-200 dark:border-orange-800 rounded-xl p-4 space-y-3 bg-orange-50/50 dark:bg-orange-900/10">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎁</span>
                  <div>
                    <p className="text-sm font-bold text-orange-800 dark:text-orange-300">Componentes del Bundle</p>
                    <p className="text-xs text-orange-600 dark:text-orange-400">Al vender este bundle se descuenta el stock de cada componente. Stock del bundle = min(stock de todos los componentes).</p>
                  </div>
                </div>
                <div className="relative">
                  <input value={bundleSearch} onChange={e => {
                    const q = e.target.value; setBundleSearch(q)
                    if (q.trim().length < 2) { setBundleResults([]); return }
                    const ql = q.toLowerCase(); const currentComps = watch('components') || []
                    setBundleResults((useStore.getState().products || []).filter(p => p.isActive && p.type !== 'bundle' && !currentComps.find(c => c.productId === p.id) && (p.name.toLowerCase().includes(ql) || p.barcode.includes(q))).slice(0, 6))
                  }} placeholder="Buscar producto componente por nombre o código..." className={inputCls}/>
                  {bundleResults.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl z-20 overflow-hidden">
                      {bundleResults.map(p => (
                        <button key={p.id} type="button" onMouseDown={() => { const current = watch('components') || []; setValue('components', [...current, { productId: p.id, quantity: 1, _name: p.name, _barcode: p.barcode, _unit: p.unit, _priceSell: p.priceSell }]); setBundleSearch(''); setBundleResults([]) }}
                          className="w-full text-left px-3 py-2.5 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center justify-between border-b border-gray-50 dark:border-slate-700/50 last:border-0">
                          <div><p className="text-sm font-medium text-gray-800 dark:text-slate-100">{p.name}</p><p className="text-xs text-gray-400">{p.barcode} · Stock: {p.stock} {p.unit}</p></div>
                          <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold ml-2">+ Agregar</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {(watch('components') || []).length === 0 ? (
                  <div className="text-center py-3 text-xs text-orange-400">Sin componentes — busca los productos que forman este bundle</div>
                ) : (
                  <div className="space-y-2">
                    {(watch('components') || []).map((comp, idx) => (
                      <div key={comp.productId} className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2">
                        <span>📦</span>
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{comp._name || comp.productId}</p><p className="text-xs text-gray-400">{comp._barcode} · S/{Number(comp._priceSell||0).toFixed(2)}</p></div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-gray-500">Cant.:</span>
                          <input type="number" min="1" step="1" value={comp.quantity} onChange={e => { const c = [...(watch('components')||[])]; c[idx] = { ...c[idx], quantity: parseFloat(e.target.value)||1 }; setValue('components', c) }}
                            className="w-16 text-center px-2 py-1 border border-gray-200 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400"/>
                          <span className="text-xs text-gray-400">{comp._unit||'u'}</span>
                        </div>
                        <button type="button" onClick={() => setValue('components', (watch('components')||[]).filter((_,i)=>i!==idx))} className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-orange-700 dark:text-orange-400 px-2">Al escanear <strong>{watch('barcode')||'—'}</strong> en el POS se descuenta automáticamente el stock de los {(watch('components')||[]).length} componentes.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="col-span-2">
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <button type="button" onClick={() => { const next = !useBatches; setValue('useBatches', next); const sc = watch('stockControl') || 'simple'; if (next && sc !== 'lote_fefo' && sc !== 'lote_fifo') setValue('stockControl', 'lote_fefo'); if (!next && (sc === 'lote_fefo' || sc === 'lote_fifo')) setValue('stockControl', 'simple') }}
                className={`relative inline-flex h-5 w-9 rounded-full transition-colors shrink-0 ${useBatches ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
                <span className={`inline-block h-3 w-3 mt-1 rounded-full bg-white transition-transform ${useBatches ? 'translate-x-5' : 'translate-x-1'}`}/>
              </button>
              <div><p className="text-sm font-medium text-blue-800 dark:text-blue-300">Gestión por lotes</p><p className="text-xs text-blue-600 dark:text-blue-400">Activa el control de lotes para este producto — permite registrar N° de lote, fecha de vencimiento y costo por lote</p></div>
            </div>
          </div>
          <div className="col-span-2">
            <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
              <button type="button" onClick={() => setValue('hasVariants', !hasVariants)}
                className={`relative inline-flex h-5 w-9 rounded-full transition-colors shrink-0 ${hasVariants ? 'bg-purple-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
                <span className={`inline-block h-3 w-3 mt-1 rounded-full bg-white transition-transform ${hasVariants ? 'translate-x-5' : 'translate-x-1'}`}/>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-purple-800 dark:text-purple-300">Variantes de producto</p>
                <p className="text-xs text-purple-600 dark:text-purple-400">{hasVariants ? 'Activo — guarda el producto y gestiona tallas/colores desde la pestaña 🎨 Variantes' : 'Activa para gestionar tallas, colores u otros atributos con stock y código de barras propios'}</p>
              </div>
            </div>
          </div>
          <div className="col-span-2"><label className={labelCls}>Descripción</label><textarea {...register('description')} rows={2} className={inputCls + ' resize-none'}/></div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button type="submit" className={btnPrimary}>{product ? 'Guardar cambios' : 'Crear producto'}</button>
        </div>
      </form>
      {quickModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-base font-bold text-gray-800 dark:text-slate-100">{quickModal === 'brand' && '✨ Nueva marca'}{quickModal === 'category' && '📂 Nueva categoría'}{quickModal === 'supplier' && '🏭 Nuevo proveedor'}</h3>
            <div><label className={labelCls}>Nombre *</label><input autoFocus value={quickName} onChange={e => setQuickName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleQuickCreate()} placeholder={quickModal === 'brand' ? 'Ej: Nestlé, Gloria, Alicorp...' : quickModal === 'category' ? 'Ej: Lácteos, Snacks...' : 'Ej: Distribuidora García SAC'} className={inputCls}/></div>
            {quickModal !== 'supplier' && (
              <div><label className={labelCls}>Color de identificación</label><div className="flex gap-2 flex-wrap mt-1">{QUICK_COLORS.map(col => <button key={col} type="button" onClick={() => setQuickColor(col)} className={`w-7 h-7 rounded-full transition-all ${quickColor === col ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`} style={{ background: col }}/>)}</div></div>
            )}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setQuickModal(null); setQuickName('') }} className={btnSecondary + ' flex-1'}>Cancelar</button>
              <button type="button" onClick={handleQuickCreate} disabled={!quickName.trim()} className={btnPrimary + ' flex-1'}>Crear y seleccionar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
