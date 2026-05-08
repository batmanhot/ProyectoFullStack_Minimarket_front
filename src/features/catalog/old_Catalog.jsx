import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { productSchema } from '../../shared/schemas/index'
import { productService } from '../../services/index'
import { formatCurrency, formatDate } from '../../shared/utils/helpers'
import { exportToExcel, exportToPDF } from '../../shared/utils/export'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { StockBadge, ExpiryBadge } from '../../shared/components/ui/Badge'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import Modal from '../../shared/components/ui/Modal'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import toast from 'react-hot-toast'

// ─── Estilos reutilizables ────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1'
const btnSecondary = 'flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700'
const btnPrimary   = 'flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700'

// ─── Color Dot ────────────────────────────────────────────────────────────────
function ColorDot({ color, size = 'sm' }) {
  const s = size === 'lg' ? 'w-5 h-5' : 'w-3 h-3'
  return <span className={`${s} rounded-full inline-block flex-shrink-0`} style={{ backgroundColor: color || '#94a3b8' }}/>
}

// ══════════════════════════════════════════════════════════════════════════════
// FORM — PRODUCTO
// ══════════════════════════════════════════════════════════════════════════════
function ProductForm({ product, categories, brands, suppliers, onClose }) {
  const { addCategory, addBrand, addSupplier } = useStore()
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: product || {
      unit: 'unidad', stockMin: 5, stockMax: 100,
      isActive: true, hasVariants: false, useBatches: false,
      imageUrl: '', brand: '', categoryId: '', supplierId: '',
    },
  })

  // Preview de imagen en tiempo real
  const imageUrl  = watch('imageUrl')
  const useBatches = watch('useBatches')
  const [imgError, setImgError] = useState(false)

  // Modales de creación rápida dentro del formulario
  const [quickModal, setQuickModal] = useState(null) // 'brand' | 'category' | 'supplier'
  const [quickName,  setQuickName]  = useState('')
  const [quickColor, setQuickColor] = useState('#3b82f6')

  const handleQuickCreate = () => {
    const name = quickName.trim()
    if (!name) { toast.error('Ingresa un nombre'); return }

    if (quickModal === 'brand') {
      const id = crypto.randomUUID()
      addBrand?.({ id, name, color: quickColor, isActive: true, createdAt: new Date().toISOString() })
      setValue('brand', name)
      toast.success(`Marca "${name}" creada`)
    } else if (quickModal === 'category') {
      const id = crypto.randomUUID()
      addCategory({ id, name, color: quickColor, description: '', isActive: true, createdAt: new Date().toISOString() })
      setValue('categoryId', id)
      toast.success(`Categoría "${name}" creada`)
    } else if (quickModal === 'supplier') {
      const id = crypto.randomUUID()
      addSupplier?.({ id, name, isActive: true, createdAt: new Date().toISOString() })
      setValue('supplierId', id)
      toast.success(`Proveedor "${name}" creado`)
    }
    setQuickModal(null)
    setQuickName('')
  }

  const onSubmit = async (data) => {
    // Asegurar que imageUrl vacío quede como string vacío (no undefined)
    const payload = { ...data, imageUrl: data.imageUrl?.trim() || '' }
    const result  = product
      ? await productService.update(product.id, payload)
      : await productService.create(payload)
    if (result.error) { toast.error(result.error); return }
    toast.success(product ? 'Producto actualizado' : 'Producto creado')
    onClose()
  }

  // Colores para creación rápida
  const QUICK_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899']

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">

          {/* Nombre */}
          <div className="col-span-2">
            <label className={labelCls}>Nombre del producto *</label>
            <input {...register('name')} className={inputCls}/>
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          {/* Barcode */}
          <div>
            <label className={labelCls}>Código de barras *</label>
            <input {...register('barcode')} className={inputCls}/>
            {errors.barcode && <p className="text-xs text-red-500 mt-1">{errors.barcode.message}</p>}
          </div>

          {/* SKU */}
          <div>
            <label className={labelCls}>SKU / Código interno</label>
            <input {...register('sku')} className={inputCls}/>
          </div>

          {/* ── MARCA con botón crear rápido ───────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Marca</label>
              <button type="button"
                onClick={() => { setQuickModal('brand'); setQuickName('') }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5">
                <span>+</span> Nueva marca
              </button>
            </div>
            <select {...register('brand')} className={inputCls}>
              <option value="">Sin marca</option>
              {brands?.filter(b => b.isActive).map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* ── CATEGORÍA con botón crear rápido ───────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Categoría *</label>
              <button type="button"
                onClick={() => { setQuickModal('category'); setQuickName('') }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5">
                <span>+</span> Nueva categoría
              </button>
            </div>
            <select {...register('categoryId')} className={inputCls}>
              <option value="">Seleccionar...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId.message}</p>}
          </div>

          {/* ── PROVEEDOR con botón crear rápido ───────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Proveedor *</label>
              <button type="button"
                onClick={() => { setQuickModal('supplier'); setQuickName('') }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5">
                <span>+</span> Nuevo proveedor
              </button>
            </div>
            <select {...register('supplierId')} className={inputCls}>
              <option value="">Seleccionar...</option>
              {suppliers.filter(s => s.isActive !== false).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.supplierId && <p className="text-xs text-red-500 mt-1">{errors.supplierId.message}</p>}
          </div>

          {/* Unidad */}
          <div>
            <label className={labelCls}>Unidad de medida *</label>
            <select {...register('unit')} className={inputCls}>
              {['unidad','kg','g','litro','ml','metro','cm','docena','caja','paquete'].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Precios */}
          <div>
            <label className={labelCls}>Precio de compra (S/) *</label>
            <input type="number" step="0.01" {...register('priceBuy')} className={inputCls}/>
            {errors.priceBuy && <p className="text-xs text-red-500 mt-1">{errors.priceBuy.message}</p>}
          </div>
          <div>
            <label className={labelCls}>Precio de venta (S/) *</label>
            <input type="number" step="0.01" {...register('priceSell')} className={inputCls}/>
            {errors.priceSell && <p className="text-xs text-red-500 mt-1">{errors.priceSell.message}</p>}
          </div>

          {/* Stock */}
          <div>
            <label className={labelCls}>Stock actual</label>
            <input type="number" {...register('stock')} className={inputCls}/>
          </div>
          <div>
            <label className={labelCls}>Stock mínimo</label>
            <input type="number" {...register('stockMin')} className={inputCls}/>
          </div>

          {/* Ubicación */}
          <div>
            <label className={labelCls}>Ubicación en almacén</label>
            <input {...register('location')} placeholder="Ej: Pasillo A, Estante 3" className={inputCls}/>
          </div>

          {/* Fecha vencimiento */}
          <div>
            <label className={labelCls}>Fecha de vencimiento</label>
            <input type="date" {...register('expiryDate')} className={inputCls}/>
          </div>

          {/* ── URL de imagen con preview en tiempo real ────────────────────── */}
          <div className="col-span-2">
            <label className={labelCls}>URL de imagen del producto</label>
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <input
                  {...register('imageUrl')}
                  onChange={e => { setValue('imageUrl', e.target.value, { shouldValidate: true }); setImgError(false) }}
                  placeholder="https://... (JPG, PNG o WebP)"
                  className={inputCls}
                />
                {errors.imageUrl && <p className="text-xs text-red-500 mt-1">{errors.imageUrl.message}</p>}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  Opcional · Se muestra en el POS al buscar y en el catálogo
                </p>
              </div>
              {/* Preview */}
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0 bg-gray-50 dark:bg-slate-700">
                {imageUrl && !imgError ? (
                  <img src={imageUrl} alt="preview"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover rounded-xl"/>
                ) : (
                  <span className="text-2xl opacity-30">🖼️</span>
                )}
              </div>
            </div>
          </div>
          {/* ────────────────────────────────────────────────────────────────── */}

          {/* ── Gestión por lotes ────────────────────────────────────────────── */}
          <div className="col-span-2">
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <button type="button"
                onClick={() => setValue('useBatches', !useBatches)}
                className={`relative inline-flex h-5 w-9 rounded-full transition-colors shrink-0 ${useBatches ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
                <span className={`inline-block h-3 w-3 mt-1 rounded-full bg-white transition-transform ${useBatches ? 'translate-x-5' : 'translate-x-1'}`}/>
              </button>
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Gestión por lotes
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Activa el control de lotes para este producto — permite registrar N° de lote, fecha de vencimiento y costo por lote
                </p>
              </div>
            </div>
          </div>
          {/* ────────────────────────────────────────────────────────────────── */}

          {/* Descripción */}
          <div className="col-span-2">
            <label className={labelCls}>Descripción</label>
            <textarea {...register('description')} rows={2} className={inputCls + ' resize-none'}/>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button type="submit" className={btnPrimary}>{product ? 'Guardar cambios' : 'Crear producto'}</button>
        </div>
      </form>

      {/* ── Modal de creación rápida ─────────────────────────────────────────── */}
      {quickModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-base font-bold text-gray-800 dark:text-slate-100">
              {quickModal === 'brand'    && '✨ Nueva marca'}
              {quickModal === 'category' && '📂 Nueva categoría'}
              {quickModal === 'supplier' && '🏭 Nuevo proveedor'}
            </h3>

            <div>
              <label className={labelCls}>Nombre *</label>
              <input
                autoFocus
                value={quickName}
                onChange={e => setQuickName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleQuickCreate()}
                placeholder={
                  quickModal === 'brand'    ? 'Ej: Nestlé, Gloria, Alicorp...' :
                  quickModal === 'category' ? 'Ej: Lácteos, Snacks...' :
                  'Ej: Distribuidora García SAC'
                }
                className={inputCls}
              />
            </div>

            {/* Color solo para marca y categoría */}
            {quickModal !== 'supplier' && (
              <div>
                <label className={labelCls}>Color de identificación</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {QUICK_COLORS.map(col => (
                    <button key={col} type="button"
                      onClick={() => setQuickColor(col)}
                      className={`w-7 h-7 rounded-full transition-all ${quickColor === col ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ background: col }}/>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button"
                onClick={() => { setQuickModal(null); setQuickName('') }}
                className={btnSecondary + ' flex-1'}>
                Cancelar
              </button>
              <button type="button"
                onClick={handleQuickCreate}
                disabled={!quickName.trim()}
                className={btnPrimary + ' flex-1'}>
                Crear y seleccionar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// FORM — CATEGORÍA
// ══════════════════════════════════════════════════════════════════════════════
const CATEGORY_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#ec4899','#84cc16','#6366f1',
]

function CategoryForm({ category, onClose }) {
  const { addCategory, updateCategory } = useStore()
  const [name, setName]               = useState(category?.name || '')
  const [description, setDescription] = useState(category?.description || '')
  const [color, setColor]             = useState(category?.color || CATEGORY_COLORS[0])
  const [error, setError]             = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (category) {
      updateCategory(category.id, { name: name.trim(), description: description.trim(), color })
      toast.success('Categoría actualizada')
    } else {
      addCategory({
        id: `cat-${crypto.randomUUID().slice(0,8)}`,
        name: name.trim(), description: description.trim(), color,
        createdAt: new Date().toISOString(),
      })
      toast.success('Categoría creada')
    }
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelCls}>Nombre *</label>
        <input value={name} onChange={e => { setName(e.target.value); setError('') }}
          className={inputCls} placeholder="Ej: Abarrotes, Bebidas..."/>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      <div>
        <label className={labelCls}>Descripción</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          rows={2} className={inputCls + ' resize-none'} placeholder="Descripción opcional..."/>
      </div>
      <div>
        <label className={labelCls}>Color identificador</label>
        <div className="flex gap-2 flex-wrap mt-1">
          {CATEGORY_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: c }}/>
          ))}
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            className="w-8 h-8 rounded-full cursor-pointer border border-gray-200 p-0.5" title="Color personalizado"/>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <ColorDot color={color} size="lg"/>
          <span>Vista previa del color seleccionado</span>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button type="submit" className={btnPrimary}>{category ? 'Guardar cambios' : 'Crear categoría'}</button>
      </div>
    </form>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// FORM — MARCA
// ══════════════════════════════════════════════════════════════════════════════
const BRAND_COLORS = [
  '#f97316','#3b82f6','#eab308','#8b5cf6','#ef4444',
  '#06b6d4','#10b981','#ec4899','#0ea5e9','#84cc16',
]

function BrandForm({ brand, onClose }) {
  const { addBrand, updateBrand } = useStore()
  const [name, setName]               = useState(brand?.name || '')
  const [description, setDescription] = useState(brand?.description || '')
  const [color, setColor]             = useState(brand?.color || BRAND_COLORS[0])
  const [error, setError]             = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (brand) {
      updateBrand(brand.id, { name: name.trim(), description: description.trim(), color })
      toast.success('Marca actualizada')
    } else {
      addBrand({
        id: `brn-${crypto.randomUUID().slice(0,8)}`,
        name: name.trim(), description: description.trim(), color,
        isActive: true, createdAt: new Date().toISOString(),
      })
      toast.success('Marca creada')
    }
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelCls}>Nombre de la marca *</label>
        <input value={name} onChange={e => { setName(e.target.value); setError('') }}
          className={inputCls} placeholder="Ej: Alicorp, Gloria, Backus..."/>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      <div>
        <label className={labelCls}>Descripción / Rubro</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          rows={2} className={inputCls + ' resize-none'} placeholder="Descripción opcional..."/>
      </div>
      <div>
        <label className={labelCls}>Color de la marca</label>
        <div className="flex gap-2 flex-wrap mt-1">
          {BRAND_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: c }}/>
          ))}
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            className="w-8 h-8 rounded-full cursor-pointer border border-gray-200 p-0.5" title="Color personalizado"/>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <ColorDot color={color} size="lg"/>
          <span>Vista previa del color seleccionado</span>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button type="submit" className={btnPrimary}>{brand ? 'Guardar cambios' : 'Crear marca'}</button>
      </div>
    </form>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// VISTA — PRODUCTOS
// ══════════════════════════════════════════════════════════════════════════════
function ProductsView({ products, categories, brands, suppliers, businessConfig, addAuditLog }) {
  const { deleteProduct } = useStore()
  const [search, setSearch]     = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [status, setStatus]     = useState('active')
  const [modal, setModal]       = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const dq = useDebounce(search, 150)

  const filtered = useMemo(() => {
    let list = products
    if (status === 'active')   list = list.filter(p => p.isActive)
    if (status === 'inactive') list = list.filter(p => !p.isActive)
    if (catFilter)   list = list.filter(p => p.categoryId === catFilter)
    if (brandFilter) list = list.filter(p => p.brand === brandFilter)
    if (dq) {
      const q = dq.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q)
      )
    }
    return list
  }, [products, status, catFilter, brandFilter, dq])

  const handleDelete = (product) => {
    deleteProduct(product.id)
    toast.success(`"${product.name}" desactivado`)
    setDeleteTarget(null)
  }

  const handleExportExcel = () => {
    addAuditLog({ action: 'EXPORT', module: 'Catálogo', detail: `Excel: ${filtered.length} productos` })
    exportToExcel(
      filtered.map(p => ({
        Nombre: p.name, Barcode: p.barcode, SKU: p.sku || '',
        Marca: p.brand || '', Categoría: categories.find(c => c.id === p.categoryId)?.name || '',
        PrecioCompra: p.priceBuy, PrecioVenta: p.priceSell, Stock: p.stock,
        StockMin: p.stockMin, Unidad: p.unit, Estado: p.isActive ? 'Activo' : 'Inactivo'
      })),
      'catalogo_productos'
    )
  }

  const inventoryValue = filtered.filter(p => p.isActive).reduce((a, p) => a + p.priceBuy * p.stock, 0)
  const saleValue      = filtered.filter(p => p.isActive).reduce((a, p) => a + p.priceSell * p.stock, 0)

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Valor en almacén</p>
          <p className="text-lg font-medium text-gray-800 dark:text-slate-100">{formatCurrency(inventoryValue)}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Potencial de venta</p>
          <p className="text-lg font-medium text-blue-700 dark:text-blue-300">{formatCurrency(saleValue)}</p>
        </div>
        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-3">
          <p className="text-xs text-teal-600 dark:text-teal-400 mb-1">Margen potencial</p>
          <p className="text-lg font-medium text-teal-700 dark:text-teal-300">{formatCurrency(saleValue - inventoryValue)}</p>
        </div>
      </div>

      {/* Filtros + acciones */}
      <div className="flex gap-2 flex-wrap items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, código, SKU o marca..."
          className="flex-1 min-w-48 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todas las marcas</option>
          {brands?.filter(b => b.isActive).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
        </select>
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          {[{k:'active',l:'Activos'},{k:'inactive',l:'Inactivos'},{k:'all',l:'Todos'}].map(t => (
            <button key={t.k} onClick={() => setStatus(t.k)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${status === t.k ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-slate-400'}`}>
              {t.l}
            </button>
          ))}
        </div>
        <button onClick={handleExportExcel}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
          📊 Excel
        </button>
        <button onClick={() => setModal({ type: 'form', data: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nuevo producto
        </button>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <EmptyState icon="📦" title="No hay productos"
          message="Ajusta los filtros o crea un nuevo producto."
          action={{ label: 'Nuevo producto', onClick: () => setModal({ type: 'form', data: null }) }}/>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                {['Producto','Código','Categoría','Proveedor','P. Compra','P. Venta','Margen','Stock','Acciones'].map(h => (
                  <th key={h} className={`text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-3 ${
                    ['P. Compra','P. Venta','Margen'].includes(h) ? 'text-right' :
                    h === 'Acciones' ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {filtered.map(p => {
                const cat    = categories.find(c => c.id === p.categoryId)
                const sup    = suppliers.find(s => s.id === p.supplierId)
                const brand  = brands?.find(b => b.name === p.brand)
                const margin = p.priceBuy > 0 ? ((p.priceSell - p.priceBuy) / p.priceBuy * 100).toFixed(1) : 0
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${!p.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-3">
                      <div className="text-sm font-medium text-gray-800 dark:text-slate-100 max-w-[180px] truncate">{p.name}</div>
                      {p.brand && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <ColorDot color={brand?.color}/>
                          <span className="text-xs text-gray-400 dark:text-slate-500">{p.brand}</span>
                        </div>
                      )}
                      {p.location && <div className="text-xs text-blue-400">📍 {p.location}</div>}
                      <div className="flex gap-1 mt-0.5"><ExpiryBadge product={p}/></div>
                    </td>
                    <td className="px-3 py-3 text-xs font-mono text-gray-500 dark:text-slate-400">
                      <div>{p.barcode}</div>
                      {p.sku && <div className="text-gray-400 dark:text-slate-500">SKU: {p.sku}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: (cat?.color || '#94a3b8') + '22', color: cat?.color || '#64748b' }}>
                        <ColorDot color={cat?.color}/>
                        {cat?.name || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 dark:text-slate-400 max-w-[120px] truncate">{sup?.name || '—'}</td>
                    <td className="px-3 py-3 text-sm text-right text-gray-600 dark:text-slate-300">{formatCurrency(p.priceBuy)}</td>
                    <td className="px-3 py-3 text-sm text-right font-medium text-gray-800 dark:text-slate-100">{formatCurrency(p.priceSell)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`text-xs font-medium ${parseFloat(margin) >= 30 ? 'text-green-600' : parseFloat(margin) >= 15 ? 'text-amber-600' : 'text-red-500'}`}>
                        {margin}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center"><StockBadge product={p}/></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setModal({ type: 'form', data: p })}
                          className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg" title="Editar">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        </button>
                        {p.isActive && (
                          <button onClick={() => setDeleteTarget(p)}
                            className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Desactivar">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
            <p className="text-xs text-gray-400 dark:text-slate-500">{filtered.length} producto{filtered.length !== 1 ? 's' : ''} mostrados</p>
          </div>
        </div>
      )}

      {modal?.type === 'form' && (
        <Modal title={modal.data ? 'Editar producto' : 'Nuevo producto'} size="lg" onClose={() => setModal(null)}>
          <ProductForm product={modal.data} categories={categories} brands={brands} suppliers={suppliers} onClose={() => setModal(null)}/>
        </Modal>
      )}
      {deleteTarget && (
        <ConfirmModal
          title="¿Desactivar este producto?"
          message={`"${deleteTarget.name}" dejará de aparecer en el POS y en el inventario activo.`}
          confirmLabel="Desactivar" variant="warning"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}/>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// VISTA — CATEGORÍAS
// ══════════════════════════════════════════════════════════════════════════════
function CategoriesView({ categories, products }) {
  const { deleteCategory } = useStore()
  const [search, setSearch]         = useState('')
  const [modal, setModal]           = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const dq = useDebounce(search, 150)

  const filtered = useMemo(() => {
    if (!dq) return categories
    const q = dq.toLowerCase()
    return categories.filter(c => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q))
  }, [categories, dq])

  const productCount = (catId) => products.filter(p => p.categoryId === catId && p.isActive).length

  const handleDelete = (cat) => {
    if (productCount(cat.id) > 0) {
      toast.error(`No se puede eliminar: tiene ${productCount(cat.id)} productos activos`)
      setDeleteTarget(null)
      return
    }
    deleteCategory(cat.id)
    toast.success(`Categoría "${cat.name}" eliminada`)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Total categorías</p>
          <p className="text-2xl font-semibold text-gray-800 dark:text-slate-100">{categories.length}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Con productos</p>
          <p className="text-2xl font-semibold text-blue-700 dark:text-blue-300">
            {categories.filter(c => productCount(c.id) > 0).length}
          </p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Sin productos</p>
          <p className="text-2xl font-semibold text-amber-700 dark:text-amber-300">
            {categories.filter(c => productCount(c.id) === 0).length}
          </p>
        </div>
      </div>

      {/* Barra de acciones */}
      <div className="flex gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar categoría..."
          className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <button onClick={() => setModal({ data: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nueva categoría
        </button>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <EmptyState icon="🗂️" title="No hay categorías"
          action={{ label: 'Nueva categoría', onClick: () => setModal({ data: null }) }}/>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                {['Color','Nombre','Descripción','Productos activos','Creada','Acciones'].map(h => (
                  <th key={h} className={`text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3 ${
                    h === 'Productos activos' ? 'text-center' :
                    h === 'Acciones' ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {filtered.map(cat => {
                const count = productCount(cat.id)
                return (
                  <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors group">
                    <td className="px-4 py-3 w-12">
                      <ColorDot color={cat.color} size="lg"/>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">{cat.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400 max-w-xs truncate">
                      {cat.description || <span className="text-gray-300 dark:text-slate-600 italic">Sin descripción</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center text-xs font-semibold px-2.5 py-1 rounded-full ${
                        count > 0 ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'}`}>
                        {count} producto{count !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500">
                      {cat.createdAt ? formatDate(cat.createdAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setModal({ data: cat })}
                          className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg" title="Editar">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        </button>
                        <button onClick={() => setDeleteTarget(cat)}
                          className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Eliminar">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
            <p className="text-xs text-gray-400 dark:text-slate-500">{filtered.length} categoría{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {modal !== null && (
        <Modal title={modal.data ? 'Editar categoría' : 'Nueva categoría'} size="sm" onClose={() => setModal(null)}>
          <CategoryForm category={modal.data} onClose={() => setModal(null)}/>
        </Modal>
      )}
      {deleteTarget && (
        <ConfirmModal
          title="¿Eliminar categoría?"
          message={productCount(deleteTarget.id) > 0
            ? `Esta categoría tiene ${productCount(deleteTarget.id)} productos activos. No puede eliminarse.`
            : `"${deleteTarget.name}" será eliminada permanentemente.`}
          confirmLabel="Eliminar" variant="danger"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}/>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// VISTA — MARCAS
// ══════════════════════════════════════════════════════════════════════════════
function BrandsView({ brands, products }) {
  const { deleteBrand, updateBrand } = useStore()
  const [search, setSearch]             = useState('')
  const [modal, setModal]               = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const dq = useDebounce(search, 150)

  const filtered = useMemo(() => {
    const list = brands || []
    if (!dq) return list
    const q = dq.toLowerCase()
    return list.filter(b => b.name.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q))
  }, [brands, dq])

  const productCount = (brandName) => products.filter(p => p.brand === brandName && p.isActive).length

  const handleDelete = (brand) => {
    if (productCount(brand.name) > 0) {
      toast.error(`No se puede eliminar: tiene ${productCount(brand.name)} productos activos`)
      setDeleteTarget(null)
      return
    }
    deleteBrand(brand.id)
    toast.success(`Marca "${brand.name}" eliminada`)
    setDeleteTarget(null)
  }

  const toggleActive = (brand) => {
    updateBrand(brand.id, { isActive: !brand.isActive })
    toast.success(`Marca "${brand.name}" ${brand.isActive ? 'desactivada' : 'activada'}`)
  }

  const activeBrands = (brands || []).filter(b => b.isActive).length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Total marcas</p>
          <p className="text-2xl font-semibold text-gray-800 dark:text-slate-100">{(brands || []).length}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
          <p className="text-xs text-green-600 dark:text-green-400 mb-1">Marcas activas</p>
          <p className="text-2xl font-semibold text-green-700 dark:text-green-300">{activeBrands}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3">
          <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Con productos</p>
          <p className="text-2xl font-semibold text-purple-700 dark:text-purple-300">
            {(brands || []).filter(b => productCount(b.name) > 0).length}
          </p>
        </div>
      </div>

      {/* Barra de acciones */}
      <div className="flex gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar marca..."
          className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <button onClick={() => setModal({ data: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nueva marca
        </button>
      </div>

      {/* Tabla de marcas */}
      {filtered.length === 0 ? (
        <EmptyState icon="🏷️" title="No hay marcas"
          action={{ label: 'Nueva marca', onClick: () => setModal({ data: null }) }}/>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                {['','Marca','Descripción','Productos','Estado','Acciones'].map(h => (
                  <th key={h} className={`text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3 ${
                    h === 'Productos' || h === 'Estado' || h === 'Acciones' ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {filtered.map(brand => {
                const count = productCount(brand.name)
                return (
                  <tr key={brand.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${!brand.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 w-10">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: brand.color || '#94a3b8' }}>
                        {brand.name.charAt(0)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-slate-100">{brand.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 max-w-xs truncate">{brand.description || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        count > 0 ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>
                        {count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${brand.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>
                        {brand.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setModal({ data: brand })}
                          className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg" title="Editar">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        </button>
                        <button onClick={() => toggleActive(brand)}
                          className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title={brand.isActive ? 'Desactivar' : 'Activar'}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={brand.isActive ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"}/></svg>
                        </button>
                        <button onClick={() => setDeleteTarget(brand)}
                          className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Eliminar">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
            <p className="text-xs text-gray-400 dark:text-slate-500">{filtered.length} marca{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {modal !== null && (
        <Modal title={modal.data ? 'Editar marca' : 'Nueva marca'} size="sm" onClose={() => setModal(null)}>
          <BrandForm brand={modal.data} onClose={() => setModal(null)}/>
        </Modal>
      )}
      {deleteTarget && (
        <ConfirmModal
          title="¿Eliminar marca?"
          message={productCount(deleteTarget.name) > 0
            ? `Esta marca tiene ${productCount(deleteTarget.name)} productos activos. No puede eliminarse.`
            : `"${deleteTarget.name}" será eliminada permanentemente.`}
          confirmLabel="Eliminar" variant="danger"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}/>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — Catalog con 3 pestañas
// ══════════════════════════════════════════════════════════════════════════════
export default function Catalog() {
  const { products, categories, brands, suppliers, businessConfig, addAuditLog } = useStore()
  const [tab, setTab] = useState('products')

  const tabs = [
    { key: 'products',   label: 'Productos',   icon: '📦', count: products.filter(p => p.isActive).length },
    { key: 'categories', label: 'Categorías',  icon: '🗂️', count: categories.length },
    { key: 'brands',     label: 'Marcas',      icon: '🏷️', count: (brands || []).filter(b => b.isActive).length },
    { key: 'batches',    label: 'Lotes',        icon: '🔢', count: products.filter(p => p.useBatches).length },
  ]

  return (
    <div className="p-6 space-y-4">
      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Catálogo</h1>
        <p className="text-sm text-gray-400 dark:text-slate-500">Gestión de productos, categorías y marcas</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-700/60 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-300'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
            }`}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              tab === t.key
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-slate-400'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Contenido por pestaña */}
      {tab === 'products' && (
        <ProductsView
          products={products}
          categories={categories}
          brands={brands || []}
          suppliers={suppliers}
          businessConfig={businessConfig}
          addAuditLog={addAuditLog}/>
      )}
      {tab === 'categories' && (
        <CategoriesView categories={categories} products={products}/>
      )}
      {tab === 'brands' && (
        <BrandsView brands={brands || []} products={products}/>
      )}
      {tab === 'batches' && (
        <BatchesView products={products} suppliers={suppliers} onEditProduct={(p) => setModal({ type: 'form', data: p })}/>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// VIEW — GESTIÓN DE LOTES
// ══════════════════════════════════════════════════════════════════════════════
function BatchesView({ products, suppliers, onEditProduct }) {
  const { addBatch, updateBatch, deleteBatch } = useStore()
  const [search,       setSearch]       = useState('')
  const [selectedProd, setSelectedProd] = useState(null)
  const [modal,        setModal]        = useState(null) // { type:'form', batch }
  const [batchForm,    setBatchForm]    = useState({ batchNumber:'', quantity:0, priceBuy:0, expiryDate:'', notes:'' })

  // Productos con gestión de lotes activada
  const batchProducts = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(p => p.useBatches && p.isActive &&
      (!q || p.name.toLowerCase().includes(q) || p.barcode.includes(q)))
  }, [products, search])

  const prodBatches = useMemo(() =>
    selectedProd ? (selectedProd.batches || []).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)) : []
  , [selectedProd])

  const handleSaveBatch = () => {
    if (!batchForm.batchNumber.trim()) { toast.error('El N° de lote es requerido'); return }
    if (!selectedProd) return

    const batch = {
      id:          modal?.batch?.id || crypto.randomUUID(),
      ...batchForm,
      quantity:    parseFloat(batchForm.quantity) || 0,
      priceBuy:    parseFloat(batchForm.priceBuy) || 0,
      productId:   selectedProd.id,
      productName: selectedProd.name,
      status:      'activo',
      createdAt:   modal?.batch?.createdAt || new Date().toISOString(),
    }

    const current = selectedProd.batches || []
    const updated  = modal?.batch
      ? current.map(b => b.id === batch.id ? batch : b)
      : [batch, ...current]

    updateBatch?.(selectedProd.id, updated)
    // También actualizar el producto directamente en el store
    useStore.getState().updateProduct(selectedProd.id, { batches: updated })
    setSelectedProd(prev => ({ ...prev, batches: updated }))
    toast.success(modal?.batch ? 'Lote actualizado' : 'Lote registrado')
    setModal(null)
    setBatchForm({ batchNumber:'', quantity:0, priceBuy:0, expiryDate:'', notes:'' })
  }

  const handleDeleteBatch = (batchId) => {
    const updated = (selectedProd.batches || []).filter(b => b.id !== batchId)
    useStore.getState().updateProduct(selectedProd.id, { batches: updated })
    setSelectedProd(prev => ({ ...prev, batches: updated }))
    toast.success('Lote eliminado')
  }

  const getDaysToExpiry = (date) => {
    if (!date) return null
    return Math.ceil((new Date(date) - new Date()) / (1000*60*60*24))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Panel izquierdo — lista de productos con lotes */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Productos con gestión de lotes ({batchProducts.length})
          </p>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"/>
        </div>

        {batchProducts.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl">
            <div className="text-3xl mb-2">🔢</div>
            <p className="text-sm text-gray-500 dark:text-slate-400">Sin productos con lotes activos</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Activa "Gestión por lotes" al crear o editar un producto
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {batchProducts.map(p => {
              const lotes    = p.batches || []
              const activos  = lotes.filter(b => b.status === 'activo').length
              const proxVenc = lotes.some(b => {
                const d = getDaysToExpiry(b.expiryDate)
                return d !== null && d <= 30 && d >= 0
              })
              const isSelected = selectedProd?.id === p.id

              return (
                <button key={p.id} onClick={() => setSelectedProd(p)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-200 dark:hover:border-blue-800'
                  }`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate max-w-[160px]">{p.name}</p>
                    <div className="flex gap-1">
                      {proxVenc && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full font-semibold">⚠️ Vence</span>}
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full font-semibold">{activos} lotes</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 font-mono mt-0.5">{p.barcode}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Panel derecho — lotes del producto seleccionado */}
      <div className="lg:col-span-2">
        {!selectedProd ? (
          <div className="flex items-center justify-center h-64 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl">
            <div className="text-center">
              <div className="text-4xl mb-3 opacity-20">🔢</div>
              <p className="text-gray-400 dark:text-slate-500 text-sm">Selecciona un producto para ver sus lotes</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header del producto */}
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedProd.imageUrl ? (
                  <img src={selectedProd.imageUrl} alt={selectedProd.name}
                    className="w-12 h-12 rounded-lg object-cover border border-gray-100 dark:border-slate-600"
                    onError={e => e.target.style.display='none'}/>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-2xl">📦</div>
                )}
                <div>
                  <p className="font-semibold text-gray-800 dark:text-slate-100">{selectedProd.name}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 font-mono">{selectedProd.barcode} · Stock total: {selectedProd.stock} {selectedProd.unit}</p>
                </div>
              </div>
              <button
                onClick={() => { setBatchForm({ batchNumber:'', quantity:0, priceBuy:selectedProd.priceBuy||0, expiryDate:'', notes:'' }); setModal({ type:'form', batch:null }) }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700">
                + Registrar lote
              </button>
            </div>

            {/* Tabla de lotes */}
            {prodBatches.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-sm text-gray-400 dark:text-slate-500">Sin lotes registrados</p>
                <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">Registra el primer lote con el botón de arriba</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-700/50">
                      {['N° Lote','Cantidad','P. Compra','Vencimiento','Notas','Estado','Acc.'].map(h => (
                        <th key={h} className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-3 py-2.5 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                    {prodBatches.map(b => {
                      const days = getDaysToExpiry(b.expiryDate)
                      const expired = days !== null && days < 0
                      const nearExp = days !== null && days >= 0 && days <= 30

                      return (
                        <tr key={b.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700/30 ${expired ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                          <td className="px-3 py-2.5">
                            <span className="text-sm font-mono font-semibold text-gray-800 dark:text-slate-100">{b.batchNumber}</span>
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-slate-300">{b.quantity} {selectedProd.unit}</td>
                          <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-slate-300">{b.priceBuy > 0 ? formatCurrency(b.priceBuy) : '—'}</td>
                          <td className="px-3 py-2.5">
                            {b.expiryDate ? (
                              <div>
                                <span className={`text-xs font-semibold ${expired ? 'text-red-600 dark:text-red-400' : nearExp ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-slate-300'}`}>
                                  {new Date(b.expiryDate).toLocaleDateString('es-PE')}
                                </span>
                                {days !== null && (
                                  <span className={`ml-1 text-xs ${expired ? 'text-red-500' : nearExp ? 'text-amber-500' : 'text-gray-400 dark:text-slate-500'}`}>
                                    {expired ? `(vencido hace ${Math.abs(days)}d)` : `(${days}d)`}
                                  </span>
                                )}
                              </div>
                            ) : <span className="text-xs text-gray-400 dark:text-slate-500">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-400 dark:text-slate-500 max-w-[120px] truncate">{b.notes || '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              expired ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                              nearExp ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                              'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            }`}>
                              {expired ? 'Vencido' : nearExp ? 'Próx. vencer' : 'Activo'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1">
                              <button onClick={() => { setBatchForm({ batchNumber:b.batchNumber, quantity:b.quantity, priceBuy:b.priceBuy, expiryDate:b.expiryDate||'', notes:b.notes||'' }); setModal({ type:'form', batch:b }) }}
                                className="p-1 text-gray-400 hover:text-amber-600 rounded transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                              </button>
                              <button onClick={() => handleDeleteBatch(b.id)}
                                className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de registro de lote */}
      {modal?.type === 'form' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-base font-bold text-gray-800 dark:text-slate-100">
              {modal.batch ? '✏️ Editar lote' : '+ Registrar nuevo lote'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">Producto: <strong>{selectedProd?.name}</strong></p>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>N° de lote *</label>
                <input value={batchForm.batchNumber}
                  onChange={e => setBatchForm(p => ({...p, batchNumber: e.target.value}))}
                  placeholder="Ej: LOT-2024-001, L240506..."
                  className={inputCls}/>
              </div>
              <div>
                <label className={labelCls}>Cantidad</label>
                <input type="number" min="0" step="0.01" value={batchForm.quantity}
                  onChange={e => setBatchForm(p => ({...p, quantity: e.target.value}))}
                  className={inputCls}/>
              </div>
              <div>
                <label className={labelCls}>Precio de compra (S/)</label>
                <input type="number" min="0" step="0.01" value={batchForm.priceBuy}
                  onChange={e => setBatchForm(p => ({...p, priceBuy: e.target.value}))}
                  className={inputCls}/>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Fecha de vencimiento</label>
                <input type="date" value={batchForm.expiryDate}
                  onChange={e => setBatchForm(p => ({...p, expiryDate: e.target.value}))}
                  className={inputCls}/>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Notas / Observaciones</label>
                <textarea rows={2} value={batchForm.notes}
                  onChange={e => setBatchForm(p => ({...p, notes: e.target.value}))}
                  placeholder="Proveedor, condiciones de almacenamiento..."
                  className={inputCls + ' resize-none'}/>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className={btnSecondary + ' flex-1'}>Cancelar</button>
              <button type="button" onClick={handleSaveBatch} className={btnPrimary + ' flex-1'}>
                {modal.batch ? 'Guardar cambios' : 'Registrar lote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
