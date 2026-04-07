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

function ProductForm({ product, categories, suppliers, onClose }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: product || { unit: 'unidad', stockMin: 5, stockMax: 100, isActive: true, hasVariants: false },
  })

  const onSubmit = async (data) => {
    const result = product ? await productService.update(product.id, data) : await productService.create(data)
    if (result.error) { toast.error(result.error); return }
    toast.success(product ? 'Producto actualizado' : 'Producto creado')
    onClose()
  }

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const field = (label, name, extra = {}) => (
    <div className={extra.col2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{extra.required ? ' *' : ''}</label>
      {extra.children || <input type={extra.type||'text'} step={extra.step} {...register(name)} className={inputCls}/>}
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name].message}</p>}
    </div>
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {field('Nombre del producto', 'name', { required: true, col2: true })}
        {field('Código de barras', 'barcode', { required: true })}
        {field('SKU / Código interno', 'sku')}
        {field('Marca', 'brand')}
        {field('Categoría', 'categoryId', { required: true, children: <select {...register('categoryId')} className={inputCls}><option value="">Seleccionar...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select> })}
        {field('Proveedor', 'supplierId', { required: true, children: <select {...register('supplierId')} className={inputCls}><option value="">Seleccionar...</option>{suppliers.filter(s => s.isActive !== false).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select> })}
        {field('Unidad de medida', 'unit', { required: true, children: <select {...register('unit')} className={inputCls}>{['unidad','kg','g','litro','ml','metro','cm','docena','caja','paquete'].map(u => <option key={u} value={u}>{u}</option>)}</select> })}
        {field('Ubicación en almacén', 'location')}
        {field('Precio de compra (S/)', 'priceBuy', { required: true, type: 'number', step: '0.01' })}
        {field('Precio de venta (S/)', 'priceSell', { required: true, type: 'number', step: '0.01' })}
        {field('Stock actual', 'stock', { type: 'number' })}
        {field('Stock mínimo', 'stockMin', { type: 'number' })}
        {field('Fecha de vencimiento', 'expiryDate', { type: 'date' })}
        {field('N° de serie', 'serialNumber')}
        {field('Descripción', 'description', { col2: true, children: <textarea {...register('description')} rows={2} className={inputCls + ' resize-none'}/> })}
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
        <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{product ? 'Guardar cambios' : 'Crear producto'}</button>
      </div>
    </form>
  )
}

export default function Catalog() {
  const { products, categories, suppliers, businessConfig, deleteProduct, addAuditLog } = useStore()
  const [search, setSearch]       = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [status, setStatus]       = useState('active')
  const [modal, setModal]         = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const dq = useDebounce(search, 150)

  const filtered = useMemo(() => {
    let list = products
    if (status === 'active')   list = list.filter(p => p.isActive)
    if (status === 'inactive') list = list.filter(p => !p.isActive)
    if (catFilter) list = list.filter(p => p.categoryId === catFilter)
    if (dq) {
      const q = dq.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.sku?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q))
    }
    return list
  }, [products, status, catFilter, dq])

  const handleDelete = async (product) => {
    deleteProduct(product.id)
    toast.success(`Producto "${product.name}" desactivado`)
    setDeleteTarget(null)
  }

  const handleExportExcel = () => {
    addAuditLog({ action: 'EXPORT', module: 'Catálogo', detail: `Excel: ${filtered.length} productos` })
    exportToExcel(
      filtered.map(p => ({ Nombre: p.name, Barcode: p.barcode, SKU: p.sku||'', Marca: p.brand||'', Categoría: categories.find(c=>c.id===p.categoryId)?.name||'', PrecioCompra: p.priceBuy, PrecioVenta: p.priceSell, Stock: p.stock, StockMin: p.stockMin, Unidad: p.unit, Ubicación: p.location||'', Vencimiento: p.expiryDate||'', Estado: p.isActive?'Activo':'Inactivo' })),
      'catalogo_productos'
    )
  }

  const handleExportPDF = () => {
    addAuditLog({ action: 'EXPORT', module: 'Catálogo', detail: `PDF: ${filtered.length} productos` })
    exportToPDF(
      'Catálogo de Productos',
      ['Nombre', 'Código', 'Categoría', 'P. Compra', 'P. Venta', 'Stock', 'Unidad', 'Estado'],
      filtered.map(p => [p.name, p.barcode, categories.find(c=>c.id===p.categoryId)?.name||'—', formatCurrency(p.priceBuy), formatCurrency(p.priceSell), p.stock, p.unit, p.isActive?'Activo':'Inactivo']),
      businessConfig?.name
    )
  }

  const inventoryValue = filtered.filter(p=>p.isActive).reduce((a,p) => a+p.priceBuy*p.stock, 0)
  const saleValue      = filtered.filter(p=>p.isActive).reduce((a,p) => a+p.priceSell*p.stock, 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800">Catálogo de Productos</h1>
          <p className="text-sm text-gray-400">{filtered.length} productos mostrados</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExportExcel} className="px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">📊 Excel</button>
          <button onClick={handleExportPDF}   className="px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">📄 PDF</button>
          <button onClick={() => setModal({ type: 'form', data: null })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Nuevo producto
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Valor en almacén (costo)</p><p className="text-lg font-medium text-gray-800">{formatCurrency(inventoryValue)}</p></div>
        <div className="bg-blue-50 rounded-xl p-3"><p className="text-xs text-blue-600 mb-1">Potencial de venta</p><p className="text-lg font-medium text-blue-700">{formatCurrency(saleValue)}</p></div>
        <div className="bg-teal-50 rounded-xl p-3"><p className="text-xs text-teal-600 mb-1">Margen potencial</p><p className="text-lg font-medium text-teal-700">{formatCurrency(saleValue - inventoryValue)}</p></div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, código, SKU o marca..." className="flex-1 min-w-48 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[{k:'active',l:'Activos'},{k:'inactive',l:'Inactivos'},{k:'all',l:'Todos'}].map(t => (
            <button key={t.k} onClick={() => setStatus(t.k)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${status===t.k?'bg-white shadow text-blue-600':'text-gray-500'}`}>{t.l}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="📦" title="No hay productos" message="Ajusta los filtros o crea un nuevo producto." action={{ label: 'Nuevo producto', onClick: () => setModal({ type: 'form', data: null }) }}/>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Producto','Código','Categoría','Proveedor','P. Compra','P. Venta','Margen','Stock','Acciones'].map(h => (
                  <th key={h} className={`text-xs font-medium text-gray-500 px-3 py-3 ${['P. Compra','P. Venta','Margen'].includes(h)?'text-right':h==='Acciones'?'text-center':'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => {
                const cat    = categories.find(c => c.id === p.categoryId)
                const sup    = suppliers.find(s => s.id === p.supplierId)
                const margin = p.priceBuy > 0 ? ((p.priceSell - p.priceBuy) / p.priceBuy * 100).toFixed(1) : 0
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${!p.isActive?'opacity-50':''}`}>
                    <td className="px-3 py-3">
                      <div className="text-sm font-medium text-gray-800 max-w-[180px] truncate">{p.name}</div>
                      {p.brand  && <div className="text-xs text-gray-400">{p.brand}</div>}
                      {p.location && <div className="text-xs text-blue-400">📍 {p.location}</div>}
                      <div className="flex gap-1 mt-0.5"><ExpiryBadge product={p}/></div>
                    </td>
                    <td className="px-3 py-3 text-xs font-mono text-gray-500"><div>{p.barcode}</div>{p.sku && <div className="text-gray-400">SKU: {p.sku}</div>}</td>
                    <td className="px-3 py-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{cat?.name||'—'}</span></td>
                    <td className="px-3 py-3 text-xs text-gray-500 max-w-[120px] truncate">{sup?.name||'—'}</td>
                    <td className="px-3 py-3 text-sm text-right text-gray-600">{formatCurrency(p.priceBuy)}</td>
                    <td className="px-3 py-3 text-sm text-right font-medium text-gray-800">{formatCurrency(p.priceSell)}</td>
                    <td className="px-3 py-3 text-right"><span className={`text-xs font-medium ${parseFloat(margin)>=30?'text-green-600':parseFloat(margin)>=15?'text-amber-600':'text-red-500'}`}>{margin}%</span></td>
                    <td className="px-3 py-3 text-center"><StockBadge product={p}/></td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setModal({ type: 'form', data: p })} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Editar">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        </button>
                        {p.isActive && (
                          <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Desactivar">
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
        </div>
      )}

      {modal?.type === 'form' && (
        <Modal title={modal.data ? 'Editar producto' : 'Nuevo producto'} size="lg" onClose={() => setModal(null)}>
          <ProductForm product={modal.data} categories={categories} suppliers={suppliers} onClose={() => setModal(null)}/>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="¿Desactivar este producto?"
          message={`"${deleteTarget.name}" dejará de aparecer en el POS y en el inventario activo.`}
          confirmLabel="Desactivar"
          variant="warning"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
