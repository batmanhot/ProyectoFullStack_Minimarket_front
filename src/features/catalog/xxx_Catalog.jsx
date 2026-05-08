import { useState, useMemo, useRef } from 'react'
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

// ── Preview de imagen en formulario de producto ───────────────────────────────
function ProductImagePreview({ url }) {
  const [err, setErr] = useState(false)
  if (!url || err) {
    return (
      <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-600 flex items-center justify-center bg-gray-50 dark:bg-slate-700 shrink-0">
        <span className="text-2xl opacity-30">🖼️</span>
      </div>
    )
  }
  return (
    <img
      src={url}
      alt="preview"
      onError={() => setErr(true)}
      className="w-16 h-16 rounded-xl border border-gray-200 dark:border-slate-600 object-cover shrink-0"
    />
  )
}

// ── Generador de etiquetas de precio 58mm ─────────────────────────────────────
function buildLabelHTML(products, businessConfig) {
  const labels = products.map(p => `
    <div class="label">
      <div class="biz">${(businessConfig?.name || 'MI NEGOCIO').substring(0, 22)}</div>
      <div class="name">${p.name.substring(0, 32)}</div>
      <div class="price">S/ ${p.priceSell.toFixed(2)}</div>
      <svg class="bc" data-barcode="${p.barcode}"></svg>
      <div class="sku">${p.barcode}${p.sku ? ' · ' + p.sku : ''}</div>
    </div>`
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Etiquetas</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Courier New',monospace;background:#fff;}
  .grid{display:flex;flex-wrap:wrap;gap:4px;padding:8px;}
  .label{width:56mm;border:1px solid #ccc;border-radius:3px;padding:4px 6px;text-align:center;page-break-inside:avoid;}
  .biz{font-size:7px;color:#555;margin-bottom:1px;}
  .name{font-size:9px;font-weight:bold;margin-bottom:2px;min-height:20px;display:flex;align-items:center;justify-content:center;}
  .price{font-size:20px;font-weight:900;margin:3px 0;}
  .bc{width:100%;height:30px;}
  .sku{font-size:7px;color:#777;margin-top:1px;}
  .fab{position:fixed;bottom:16px;right:16px;background:#185FA5;color:#fff;border:none;padding:10px 18px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:700;}
  @media print{.fab{display:none}@page{size:A4;margin:5mm;}}
</style></head>
<body>
<div class="grid">${labels}</div>
<button class="fab" onclick="window.print()">🖨️ Imprimir etiquetas</button>
<script>
  document.querySelectorAll('.bc').forEach(el => {
    try { JsBarcode(el, el.dataset.barcode, {format:'CODE128',width:1.2,height:30,displayValue:false,margin:0}) }
    catch(e) { el.style.display='none' }
  })
</script></body></html>`
}

export function printPriceLabels(products, businessConfig) {
  if (!products?.length) { toast.error('Selecciona al menos un producto'); return }
  const win = window.open('', '_blank', 'width=900,height=700,menubar=yes,scrollbars=yes')
  if (!win) { toast.error('Activa las ventanas emergentes para imprimir'); return }
  win.document.write(buildLabelHTML(products, businessConfig))
  win.document.close()
}

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
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: product || { unit: 'unidad', stockMin: 5, stockMax: 100, isActive: true, hasVariants: false },
  })

  const onSubmit = async (data) => {
    const result = product
      ? await productService.update(product.id, data)
      : await productService.create(data)
    if (result.error) { toast.error(result.error); return }
    toast.success(product ? 'Producto actualizado' : 'Producto creado')
    onClose()
  }

  const field = (label, name, extra = {}) => (
    <div className={extra.col2 ? 'col-span-2' : ''}>
      <label className={labelCls}>{label}{extra.required ? ' *' : ''}</label>
      {extra.children || <input type={extra.type || 'text'} step={extra.step} {...register(name)} className={inputCls}/>}
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name].message}</p>}
    </div>
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {field('Nombre del producto', 'name', { required: true, col2: true })}
        {field('Código de barras', 'barcode', { required: true })}
        {field('SKU / Código interno', 'sku')}
        {field('Marca', 'brand', {
          children: (
            <select {...register('brand')} className={inputCls}>
              <option value="">Sin marca</option>
              {brands?.filter(b => b.isActive).map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          )
        })}
        {field('Categoría', 'categoryId', {
          required: true,
          children: (
            <select {...register('categoryId')} className={inputCls}>
              <option value="">Seleccionar...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )
        })}
        {field('Proveedor', 'supplierId', {
          required: true,
          children: (
            <select {...register('supplierId')} className={inputCls}>
              <option value="">Seleccionar...</option>
              {suppliers.filter(s => s.isActive !== false).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )
        })}
        {field('Unidad de medida', 'unit', {
          required: true,
          children: (
            <select {...register('unit')} className={inputCls}>
              {['unidad','kg','g','litro','ml','metro','cm','docena','caja','paquete'].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          )
        })}
        {field('Ubicación en almacén', 'location')}
        {field('Precio de compra (S/)', 'priceBuy',  { required: true, type: 'number', step: '0.01' })}
        {field('Precio de venta (S/)',  'priceSell', { required: true, type: 'number', step: '0.01' })}
        {field('Stock actual',          'stock',     { type: 'number' })}
        {field('Stock mínimo',          'stockMin',  { type: 'number' })}
        {field('Fecha de vencimiento',  'expiryDate',{ type: 'date' })}

        {/* ── Imagen del producto ─────────────────────────────────────────── */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">
            URL de imagen del producto
          </label>
          <div className="flex gap-3 items-start">
            <input
              type="url"
              {...register('imageUrl')}
              placeholder="https://... (URL de imagen JPG, PNG o WebP)"
              className={inputCls + ' flex-1'}
            />
            {/* Preview en tiempo real */}
            <ProductImagePreview url={watch('imageUrl')}/>
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Opcional · Se muestra en el POS al buscar el producto y en la boleta
          </p>
        </div>
        {/* ──────────────────────────────────────────────────────────────────── */}
        {field('N° de serie',           'serialNumber')}
        {field('Descripción', 'description', {
          col2: true,
          children: <textarea {...register('description')} rows={2} className={inputCls + ' resize-none'}/>
        })}
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button type="submit" className={btnPrimary}>{product ? 'Guardar cambios' : 'Crear producto'}</button>
      </div>
    </form>
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
        {/* ── Etiquetas de precio 58mm ─────────────────────────────────────── */}
        <button
          onClick={() => printPriceLabels(filtered.filter(p => p.isActive), businessConfig)}
          className="px-3 py-2 text-sm border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20"
          title="Imprimir etiquetas de precio 58mm con código de barras">
          🏷️ Etiquetas
        </button>
        {/* ──────────────────────────────────────────────────────────────────── */}
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
                {['','Producto','Código','Categoría','P. Compra','P. Venta','Margen','Stock','Acciones'].map(h => (
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
                    {/* Imagen del producto */}
                    <td className="px-2 py-2 w-12">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name}
                          className="w-10 h-10 rounded-lg object-cover border border-gray-100 dark:border-slate-600"
                          onError={e => e.target.style.display='none'}/>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-lg">
                          📦
                        </div>
                      )}
                    </td>
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
    </div>
  )
}
