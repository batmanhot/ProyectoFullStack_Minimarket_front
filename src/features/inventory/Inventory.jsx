import { useState, useMemo } from 'react'
import { useStore, selectLowStockProducts } from '../../store/index'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { productSchema, stockAdjustSchema } from '../../shared/schemas/index'
import { productService } from '../../services/index'
import { formatCurrency, formatDate, formatDateTime, isLowStock, isOutOfStock, isExpired, isNearExpiry, daysUntil, stockDaysLeft } from '../../shared/utils/helpers'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { StockBadge, ExpiryBadge } from '../../shared/components/ui/Badge'
import { TableSkeleton, EmptyState } from '../../shared/components/ui/Skeleton'
import Modal from '../../shared/components/ui/Modal'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import toast from 'react-hot-toast'

// ── Formulario de producto ─────────────────────────────────────────────────────
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

  const F = ({ label, name, type = 'text', required, children, colSpan }) => (
    <div className={colSpan === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required ? ' *' : ''}</label>
      {children || <input type={type} {...register(name)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>}
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name].message}</p>}
    </div>
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <F label="Nombre" name="name" required colSpan={2}/>
        <F label="Código de barras" name="barcode" required/>
        <F label="SKU / Código interno" name="sku"/>
        <F label="Marca" name="brand"/>
        <F label="Unidad de medida" name="unit" required>
          <select {...register('unit')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {['unidad','kg','g','litro','ml','metro','cm','docena','caja','paquete'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </F>
        <F label="Categoría" name="categoryId" required>
          <select {...register('categoryId')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Seleccionar...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </F>
        <F label="Proveedor" name="supplierId" required>
          <select {...register('supplierId')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Seleccionar...</option>
            {suppliers.filter(s => s.isActive !== false).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </F>
        <F label="Precio compra (S/)" name="priceBuy" type="number" required/>
        <F label="Precio venta (S/)" name="priceSell" type="number" required/>
        <F label="Stock actual" name="stock" type="number"/>
        <F label="Stock mínimo (alerta)" name="stockMin" type="number"/>
        <F label="Ubicación en almacén" name="location"/>
        <F label="Fecha de vencimiento" name="expiryDate" type="date"/>
        <F label="Descripción" name="description" colSpan={2}>
          <textarea {...register('description')} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
        </F>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
        <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          {product ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </div>
    </form>
  )
}

// ── Ajuste de stock ────────────────────────────────────────────────────────────
function StockAdjustForm({ product, currentUser, onClose }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(stockAdjustSchema),
    defaultValues: { type: 'entrada' },
  })
  const type = watch('type')

  const onSubmit = async (data) => {
    const result = await productService.adjustStock(product.id, data.quantity, data.type, data.reason, currentUser?.id)
    if (result.error) { toast.error(result.error); return }
    toast.success(`Stock ajustado: ${data.type} de ${data.quantity} unidad(es)`)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
        <span className="text-gray-500">Stock actual: </span>
        <span className="font-medium text-gray-800">{product.stock} {product.unit}</span>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Tipo de movimiento</label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: 'entrada', label: 'Entrada',  color: 'bg-green-50 border-green-300 text-green-700' },
            { value: 'salida',  label: 'Salida',   color: 'bg-red-50 border-red-300 text-red-700' },
            { value: 'ajuste', label: 'Ajuste',   color: 'bg-blue-50 border-blue-300 text-blue-700' },
            { value: 'merma',  label: 'Merma',    color: 'bg-amber-50 border-amber-300 text-amber-700' },
          ].map(t => (
            <label key={t.value} className="cursor-pointer">
              <input type="radio" {...register('type')} value={t.value} className="sr-only"/>
              <div className={`text-center py-2 text-xs font-medium border rounded-lg cursor-pointer ${type === t.value ? t.color : 'border-gray-200 text-gray-500'}`}>{t.label}</div>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad *</label>
        <input type="number" min="0.01" step="0.01" {...register('quantity')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity.message}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Motivo *</label>
        <textarea {...register('reason')} rows={2} placeholder="Ej: compra proveedor, merma por vencimiento, conteo físico..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
        {errors.reason && <p className="text-xs text-red-500 mt-1">{errors.reason.message}</p>}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
        <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Registrar</button>
      </div>
    </form>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function Inventory() {
  const { products, categories, suppliers, stockMovements, currentUser } = useStore()
  const [search, setSearch]       = useState('')
  const [categoryFilter, setCatF] = useState('')
  const [tab, setTab]             = useState('products')
  const [filters, setFilters]     = useState({ lowStock: false, nearExpiry: false })
  const [modal, setModal]         = useState(null)
  const dq = useDebounce(search, 150)
  const lowCount = useStore(s => selectLowStockProducts(s).length)

  const filtered = useMemo(() => {
    let list = products.filter(p => p.isActive)
    if (dq)                { const q = dq.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.sku?.toLowerCase().includes(q)) }
    if (categoryFilter)    list = list.filter(p => p.categoryId === categoryFilter)
    if (filters.lowStock)  list = list.filter(p => isLowStock(p) || isOutOfStock(p))
    if (filters.nearExpiry) list = list.filter(p => isNearExpiry(p, 30) || isExpired(p))
    return list
  }, [products, dq, categoryFilter, filters])

  const inventoryKPIs = useMemo(() => ({
    valorCosto: products.filter(p => p.isActive).reduce((a, p) => a + p.priceBuy * p.stock, 0),
    valorVenta: products.filter(p => p.isActive).reduce((a, p) => a + p.priceSell * p.stock, 0),
    totalProductos: products.filter(p => p.isActive).length,
  }), [products])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800">Inventario</h1>
          <p className="text-sm text-gray-400">{filtered.length} productos{lowCount > 0 && <span className="ml-2 text-red-400">· {lowCount} con alerta</span>}</p>
        </div>
        <button onClick={() => setModal({ type: 'product', data: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nuevo producto
        </button>
      </div>

      {/* KPIs de inventario */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Valor en almacén (costo)</p>
          <p className="text-lg font-medium text-gray-800">{formatCurrency(inventoryKPIs.valorCosto)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-xs text-blue-600 mb-1">Potencial de venta</p>
          <p className="text-lg font-medium text-blue-700">{formatCurrency(inventoryKPIs.valorVenta)}</p>
        </div>
        <div className="bg-teal-50 rounded-xl p-3">
          <p className="text-xs text-teal-600 mb-1">Margen potencial</p>
          <p className="text-lg font-medium text-teal-700">{formatCurrency(inventoryKPIs.valorVenta - inventoryKPIs.valorCosto)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[{ k: 'products', l: 'Productos' }, { k: 'movements', l: 'Kardex / Movimientos' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${tab === t.k ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <>
          {/* Filtros */}
          <div className="flex gap-3 flex-wrap">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código o SKU..."
              className="flex-1 min-w-48 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            <select value={categoryFilter} onChange={e => setCatF(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={() => setFilters(f => ({ ...f, lowStock: !f.lowStock }))}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${filters.lowStock ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              ⚠️ Stock bajo
            </button>
            <button onClick={() => setFilters(f => ({ ...f, nearExpiry: !f.nearExpiry }))}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${filters.nearExpiry ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              🗓️ Por vencer
            </button>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Producto','Código','Categoría','P.Compra','P.Venta','Margen','Stock','Vence','Acciones'].map(h => (
                    <th key={h} className={`text-xs font-medium text-gray-500 px-3 py-3 ${h === 'Acciones' ? 'text-center' : h.startsWith('P.') || h === 'Margen' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="py-12">
                    <EmptyState icon="📦" title="Sin productos" message="Ajusta los filtros o crea un nuevo producto."/>
                  </td></tr>
                ) : filtered.map(p => {
                  const cat    = categories.find(c => c.id === p.categoryId)
                  const margin = ((p.priceSell - p.priceBuy) / p.priceBuy * 100).toFixed(1)
                  const daysLeft = stockDaysLeft(p, stockMovements)
                  return (
                    <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${isExpired(p) ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-3">
                        <div className="text-sm font-medium text-gray-800 max-w-[180px] truncate">{p.name}</div>
                        {p.brand && <div className="text-xs text-gray-400">{p.brand}</div>}
                        {p.location && <div className="text-xs text-blue-400">📍 {p.location}</div>}
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-gray-500">{p.barcode}</td>
                      <td className="px-3 py-3"><span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">{cat?.name || '—'}</span></td>
                      <td className="px-3 py-3 text-sm text-right text-gray-600">{formatCurrency(p.priceBuy)}</td>
                      <td className="px-3 py-3 text-sm text-right font-medium text-gray-800">{formatCurrency(p.priceSell)}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={`text-xs font-medium ${parseFloat(margin) >= 30 ? 'text-green-600' : parseFloat(margin) >= 15 ? 'text-amber-600' : 'text-red-500'}`}>{margin}%</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <StockBadge product={p}/>
                        {daysLeft !== null && <div className="text-xs text-gray-400 mt-0.5">{daysLeft}d stock</div>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ExpiryBadge product={p}/>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setModal({ type: 'stock', data: p })}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold transition-colors" title="Ajustar stock">±</button>
                          <button onClick={() => setModal({ type: 'product', data: p })}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'movements' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Fecha','Producto','Tipo','Cantidad','Stock ant.','Stock nuevo','Motivo'].map(h => (
                  <th key={h} className={`text-xs font-medium text-gray-500 px-4 py-3 ${['Cantidad','Stock ant.','Stock nuevo'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stockMovements.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-300">Sin movimientos registrados aún</td></tr>
              ) : stockMovements.slice(0, 150).map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs text-gray-500">{formatDateTime(m.createdAt)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700 max-w-[180px] truncate">{m.productName}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      m.type === 'entrada' ? 'bg-green-100 text-green-700' :
                      m.type === 'salida'  ? 'bg-red-100 text-red-600' :
                      m.type === 'merma'   ? 'bg-amber-100 text-amber-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>{m.type}</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right font-medium">{m.type === 'salida' || m.type === 'merma' ? '-' : '+'}{m.quantity}</td>
                  <td className="px-4 py-2.5 text-sm text-right text-gray-500">{m.previousStock}</td>
                  <td className="px-4 py-2.5 text-sm text-right font-medium text-gray-800">{m.newStock}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[200px] truncate">{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === 'product' && (
        <Modal title={modal.data ? 'Editar producto' : 'Nuevo producto'} size="lg" onClose={() => setModal(null)}>
          <ProductForm product={modal.data} categories={categories} suppliers={suppliers} onClose={() => setModal(null)}/>
        </Modal>
      )}
      {modal?.type === 'stock' && (
        <Modal title="Ajustar stock" subtitle={modal.data.name} onClose={() => setModal(null)}>
          <StockAdjustForm product={modal.data} currentUser={currentUser} onClose={() => setModal(null)}/>
        </Modal>
      )}
    </div>
  )
}
