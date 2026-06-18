import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { productService } from '../../services/index'
import { formatCurrency } from '../../shared/utils/helpers'
import { exportToExcel } from '../../shared/utils/export'
import { ExcelButton, ImportButton } from '../../shared/components/ui/ExportButtons'
import ExcelImportModal from '../../shared/components/ui/ExcelImportModal'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { usePlanLimits } from '../../shared/hooks/usePlanGate'
import { StockBadge, ExpiryBadge } from '../../shared/components/ui/Badge'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import Modal from '../../shared/components/ui/Modal'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import { ProductForm } from './ProductForm'
import { PriceLabelsModal } from './PriceLabels'
import { ColorDot } from './catalog.shared'
import toast from 'react-hot-toast'

export function ProductsView({ products, categories, brands, suppliers, businessConfig, addAuditLog }) {
  const { deleteProduct } = useStore()
  const { maxProducts }   = usePlanLimits()
  const atProductLimit    = maxProducts !== null && products.length >= maxProducts
  const [search, setSearch]             = useState('')
  const [catFilter, setCatFilter]       = useState('')
  const [brandFilter, setBrandFilter]   = useState('')
  const [status, setStatus]             = useState('active')
  const [modal, setModal]               = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [importOpen, setImportOpen]     = useState(false)
  const [labelsModal, setLabelsModal]   = useState(null)
  const dq = useDebounce(search, 150)

  const handleNewProduct = () => {
    if (atProductLimit) { toast.error(`Tu plan permite máximo ${maxProducts} producto${maxProducts !== 1 ? 's' : ''}. Actualiza tu plan para agregar más.`, { duration: 6000 }); return }
    setModal({ type: 'form', data: null })
  }

  const filtered = useMemo(() => {
    let list = products
    if (status === 'active')   list = list.filter(p => p.isActive)
    if (status === 'inactive') list = list.filter(p => !p.isActive)
    if (catFilter)   list = list.filter(p => p.categoryId === catFilter)
    if (brandFilter) list = list.filter(p => p.brand === brandFilter)
    if (dq) { const q = dq.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.sku?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q)) }
    return list
  }, [products, status, catFilter, brandFilter, dq])

  const handleDelete = async (product) => {
    const result = await productService.remove(product.id)
    if (result?.error) { toast.error(result.error); return }
    toast.success(`"${product.name}" desactivado`); setDeleteTarget(null)
  }

  const handleExportExcel = () => {
    addAuditLog({ action: 'EXPORT', module: 'Catálogo', detail: `Excel: ${filtered.length} productos` })
    exportToExcel(filtered.map(p => ({ Nombre: p.name, Barcode: p.barcode, SKU: p.sku || '', Marca: p.brand || '', Categoría: categories.find(c => c.id === p.categoryId)?.name || '', PrecioCompra: p.priceBuy, PrecioVenta: p.priceSell, Stock: p.stock, StockMin: p.stockMin, Unidad: p.unit, Estado: p.isActive ? 'Activo' : 'Inactivo' })), 'catalogo_productos')
  }

  const inventoryValue = filtered.filter(p => p.isActive).reduce((a, p) => a + p.priceBuy * p.stock, 0)
  const saleValue      = filtered.filter(p => p.isActive).reduce((a, p) => a + p.priceSell * p.stock, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-2 sm:p-3"><p className="text-xs text-gray-500 dark:text-slate-400 mb-1 leading-tight">Valor en almacén</p><p className="text-xs sm:text-lg font-semibold sm:font-medium text-gray-800 dark:text-slate-100 truncate">{formatCurrency(inventoryValue)}</p></div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-2 sm:p-3"><p className="text-xs text-blue-600 dark:text-blue-400 mb-1 leading-tight">Potencial de venta</p><p className="text-xs sm:text-lg font-semibold sm:font-medium text-blue-700 dark:text-blue-300 truncate">{formatCurrency(saleValue)}</p></div>
        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-2 sm:p-3"><p className="text-xs text-teal-600 dark:text-teal-400 mb-1 leading-tight">Margen potencial</p><p className="text-xs sm:text-lg font-semibold sm:font-medium text-teal-700 dark:text-teal-300 truncate">{formatCurrency(saleValue - inventoryValue)}</p></div>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, código, SKU o marca..." className="flex-1 min-w-48 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Todas las categorías</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Todas las marcas</option>{brands?.filter(b => b.isActive).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}</select>
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">{[{k:'active',l:'Activos'},{k:'inactive',l:'Inactivos'},{k:'all',l:'Todos'}].map(t => <button key={t.k} onClick={() => setStatus(t.k)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${status === t.k ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-slate-400'}`}>{t.l}</button>)}</div>
        <ImportButton onClick={() => setImportOpen(true)} label="Importar Excel" />
        <ExcelButton onClick={handleExportExcel} />
        <button onClick={() => { const prods = filtered.filter(p => p.isActive); if (!prods.length) { toast.error('No hay productos para imprimir'); return }; setLabelsModal(prods) }} className="px-3 py-2 text-sm border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">🏷️ Etiquetas</button>
        {maxProducts !== null && <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${atProductLimit ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>{products.length}/{maxProducts} productos</span>}
        <button onClick={handleNewProduct} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${atProductLimit ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          {atProductLimit ? 'Límite alcanzado' : 'Nuevo producto'}
        </button>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon="📦" title="No hay productos" message="Ajusta los filtros o crea un nuevo producto." action={{ label: 'Nuevo producto', onClick: handleNewProduct }}/>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                {['Producto','Código','Categoría','Proveedor','P. Compra','P. Venta','Margen','Stock','Acciones'].map(h => (
                  <th key={h} className={`text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-3 ${['P. Compra','P. Venta','Margen'].includes(h) ? 'text-right' : h === 'Acciones' ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {filtered.map(p => {
                const cat = categories.find(c => c.id === p.categoryId); const sup = suppliers.find(s => s.id === p.supplierId); const brand = brands?.find(b => b.name === p.brand); const margin = p.priceBuy > 0 ? ((p.priceSell - p.priceBuy) / p.priceBuy * 100).toFixed(1) : 0
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${!p.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-3">
                      <div className="text-sm font-medium text-gray-800 dark:text-slate-100 max-w-[180px] truncate">{p.name}</div>
                      {p.brand && <div className="flex items-center gap-1 mt-0.5"><ColorDot color={brand?.color}/><span className="text-xs text-gray-400 dark:text-slate-500">{p.brand}</span></div>}
                      {p.location && <div className="text-xs text-blue-400">📍 {p.location}</div>}
                      <div className="flex gap-1 mt-0.5"><ExpiryBadge product={p}/></div>
                    </td>
                    <td className="px-3 py-3 text-xs font-mono text-gray-500 dark:text-slate-400"><div>{p.barcode}</div>{p.sku && <div className="text-gray-400 dark:text-slate-500">SKU: {p.sku}</div>}</td>
                    <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: (cat?.color || '#94a3b8') + '22', color: cat?.color || '#64748b' }}><ColorDot color={cat?.color}/>{cat?.name || '—'}</span></td>
                    <td className="px-3 py-3 text-xs text-gray-500 dark:text-slate-400 max-w-[120px] truncate">{sup?.name || '—'}</td>
                    <td className="px-3 py-3 text-sm text-right text-gray-600 dark:text-slate-300">{formatCurrency(p.priceBuy)}</td>
                    <td className="px-3 py-3 text-sm text-right font-medium text-gray-800 dark:text-slate-100">{formatCurrency(p.priceSell)}</td>
                    <td className="px-3 py-3 text-right"><span className={`text-xs font-medium ${parseFloat(margin) >= 30 ? 'text-green-600' : parseFloat(margin) >= 15 ? 'text-amber-600' : 'text-red-500'}`}>{margin}%</span></td>
                    <td className="px-3 py-3 text-center"><StockBadge product={p}/></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setModal({ type: 'form', data: p })} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                        <button onClick={() => setLabelsModal([p])} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"><span className="text-xs">🏷️</span></button>
                        {p.isActive && <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50"><p className="text-xs text-gray-400 dark:text-slate-500">{filtered.length} producto{filtered.length !== 1 ? 's' : ''} mostrados</p></div>
        </div>
      )}
      {modal?.type === 'form' && <Modal title={modal.data ? 'Editar producto' : 'Nuevo producto'} size="lg" onClose={() => setModal(null)}><ProductForm product={modal.data} onClose={() => setModal(null)}/></Modal>}
      {deleteTarget && <ConfirmModal title="¿Desactivar este producto?" message={`"${deleteTarget.name}" dejará de aparecer en el POS y en el inventario activo.`} confirmLabel="Desactivar" variant="warning" onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)}/>}
      {importOpen && <ExcelImportModal entityType="products" onClose={() => setImportOpen(false)} />}
      {labelsModal && <PriceLabelsModal products={labelsModal} businessConfig={businessConfig} onClose={() => setLabelsModal(null)} />}
    </div>
  )
}
