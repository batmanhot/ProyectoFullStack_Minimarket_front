import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { purchaseService } from '../../services/index'
import { formatCurrency, formatDate, formatDateTime } from '../../shared/utils/helpers'
import { exportToExcel, exportToPDF } from '../../shared/utils/export'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import Modal from '../../shared/components/ui/Modal'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import toast from 'react-hot-toast'

function NewPurchaseForm({ onClose }) {
  const { suppliers, products, currentUser } = useStore()
  const [supplierId, setSupplierId] = useState('')
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [notes, setNotes] = useState('')
  const dq = useDebounce(search, 150)

  const searchResults = useMemo(() => {
    if (!dq.trim()) return []
    const q = dq.toLowerCase()
    return products.filter(p => p.isActive && (p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.sku?.toLowerCase().includes(q))).slice(0, 6)
  }, [dq, products])

  const addItem = (product) => {
    if (items.find(i => i.productId === product.id)) { toast.error('Ya está en la lista'); return }
    setItems(prev => [...prev, { productId: product.id, productName: product.name, barcode: product.barcode, quantity: 1, priceBuy: product.priceBuy, currentStock: product.stock }])
    setSearch('')
  }
  const updateItem = (pid, field, value) => setItems(prev => prev.map(i => i.productId === pid ? { ...i, [field]: parseFloat(value) || 0 } : i))
  const removeItem = (pid) => setItems(prev => prev.filter(i => i.productId !== pid))
  const total = items.reduce((a, i) => a + i.quantity * i.priceBuy, 0)

  const handleConfirm = async () => {
    if (!supplierId) { toast.error('Selecciona un proveedor'); return }
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return }
    if (items.some(i => i.quantity <= 0 || i.priceBuy <= 0)) { toast.error('Verifica cantidades y precios'); return }
    const supplier = suppliers.find(s => s.id === supplierId)
    const result = await purchaseService.create({ supplierId, supplierName: supplier?.name || '', items, notes, userId: currentUser?.id, userName: currentUser?.fullName })
    if (result.error) { toast.error(result.error); return }
    toast.success(`Compra registrada · ${items.length} producto(s) actualizados`)
    onClose()
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Proveedor *</label>
        <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Seleccionar proveedor...</option>
          {suppliers.filter(s => s.isActive !== false).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Agregar productos</label>
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, código o SKU..." className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg z-20 overflow-hidden">
              {searchResults.map(p => (
                <button key={p.id} onClick={() => addItem(p)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{p.name}</div><div className="text-xs text-gray-400 dark:text-slate-500">{p.barcode} · Stock: {p.stock} · Costo: {formatCurrency(p.priceBuy)}</div></div>
                  <span className="text-blue-600 text-xs font-medium">+ Agregar</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {items.length > 0 && (
        <div className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">{['Producto','Stock act.','Cantidad','Precio costo','Subtotal',''].map(h => <th key={h} className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-left">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {items.map(item => (
                <tr key={item.productId}>
                  <td className="px-3 py-2.5"><div className="text-sm font-medium text-gray-800 dark:text-slate-100">{item.productName}</div><div className="text-xs text-gray-400 dark:text-slate-500">{item.barcode}</div></td>
                  <td className="px-3 py-2.5 text-center text-xs text-gray-500 dark:text-slate-400">{item.currentStock}</td>
                  <td className="px-3 py-2.5"><input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(item.productId,'quantity',e.target.value)} className="w-20 text-center px-2 py-1 border border-gray-200 dark:border-slate-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/></td>
                  <td className="px-3 py-2.5"><div className="relative w-28"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-slate-500">S/</span><input type="number" min="0.01" step="0.01" value={item.priceBuy} onChange={e => updateItem(item.productId,'priceBuy',e.target.value)} className="w-full pl-7 pr-2 py-1 border border-gray-200 dark:border-slate-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/></div></td>
                  <td className="px-3 py-2.5 text-sm font-medium text-gray-800 dark:text-slate-100">{formatCurrency(item.quantity * item.priceBuy)}</td>
                  <td className="px-3 py-2.5"><button onClick={() => removeItem(item.productId)} className="text-gray-300 hover:text-red-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-700"><span className="text-sm font-medium text-gray-600 dark:text-slate-300">TOTAL COMPRA</span><span className="text-base font-semibold text-gray-800 dark:text-slate-100">{formatCurrency(total)}</span></div>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Notas / N° de remisión</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="N° de factura del proveedor, observaciones..."/>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">Cancelar</button>
        <button onClick={handleConfirm} disabled={items.length === 0 || !supplierId} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">Confirmar entrada</button>
      </div>
    </div>
  )
}

function PurchaseDetail({ purchase }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-xs text-gray-400 dark:text-slate-500">Proveedor</p><p className="font-medium text-gray-800 dark:text-slate-100">{purchase.supplierName}</p></div>
        <div><p className="text-xs text-gray-400 dark:text-slate-500">Fecha</p><p className="text-gray-700">{formatDateTime(purchase.createdAt)}</p></div>
        <div><p className="text-xs text-gray-400 dark:text-slate-500">Registrado por</p><p className="text-gray-700">{purchase.userName || '—'}</p></div>
        <div><p className="text-xs text-gray-400 dark:text-slate-500">Estado</p><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${purchase.status === 'anulada' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{purchase.status}</span></div>
        {purchase.notes && <div className="col-span-2"><p className="text-xs text-gray-400 dark:text-slate-500">Notas</p><p className="text-gray-700">{purchase.notes}</p></div>}
      </div>
      <div className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-gray-50 dark:bg-slate-800/50"><th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Producto</th><th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Cant.</th><th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">P. Costo</th><th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Subtotal</th></tr></thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {purchase.items?.map((item, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5"><div className="text-sm text-gray-800 dark:text-slate-100">{item.productName}</div><div className="text-xs text-gray-400 dark:text-slate-500">{item.barcode}</div></td>
                <td className="px-4 py-2.5 text-right text-sm text-gray-600 dark:text-slate-300">{item.quantity}</td>
                <td className="px-4 py-2.5 text-right text-sm text-gray-600 dark:text-slate-300">{formatCurrency(item.priceBuy)}</td>
                <td className="px-4 py-2.5 text-right text-sm font-medium text-gray-800 dark:text-slate-100">{formatCurrency(item.quantity * item.priceBuy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-700"><span className="text-sm font-semibold text-gray-700">TOTAL</span><span className="text-base font-semibold text-gray-800 dark:text-slate-100">{formatCurrency(purchase.total || 0)}</span></div>
      </div>
    </div>
  )
}

export default function Purchases() {
  const { purchases, suppliers, updatePurchase, businessConfig, currentUser, addAuditLog } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [modal, setModal] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [search, setSearch] = useState('')
  const dq = useDebounce(search, 150)

  const enriched = useMemo(() =>
    purchases
      .map(p => ({ ...p, supplierName: p.supplierName || suppliers.find(s => s.id === p.supplierId)?.name || '—' }))
      .filter(p => { if (!dq) return true; const q = dq.toLowerCase(); return p.supplierName.toLowerCase().includes(q) || p.notes?.toLowerCase().includes(q) })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  , [purchases, suppliers, dq])

  const handleCancel = (p) => {
    updatePurchase(p.id, { status: 'anulada', cancelledAt: new Date().toISOString(), cancelledBy: currentUser?.id })
    toast.success('Compra anulada')
    setCancelTarget(null)
  }

  const handleExportExcel = () => {
    addAuditLog({ action: 'EXPORT', module: 'Compras', detail: `Excel: ${enriched.length} registros` })
    exportToExcel(enriched.map(p => ({ Fecha: formatDate(p.createdAt), Proveedor: p.supplierName, Productos: p.items?.length || 0, Total: p.total || 0, Estado: p.status, Notas: p.notes || '' })), 'compras')
  }

  const handleExportPDF = () => {
    addAuditLog({ action: 'EXPORT', module: 'Compras', detail: `PDF: ${enriched.length} registros` })
    exportToPDF('Listado de Compras a Proveedores', ['Fecha','Proveedor','N° Prods','Total','Estado','Notas'],
      enriched.map(p => [formatDate(p.createdAt), p.supplierName, p.items?.length || 0, formatCurrency(p.total || 0), p.status, p.notes || '']), businessConfig?.name)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Compras a proveedor</h1><p className="text-sm text-gray-400 dark:text-slate-500">{enriched.length} registros</p></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExportExcel} className="px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">📊 Excel</button>
          <button onClick={handleExportPDF}   className="px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">📄 PDF</button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Nueva entrada
          </button>
        </div>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por proveedor o notas..." className="w-full max-w-md px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>

      {enriched.length === 0 ? (
        <EmptyState icon="📦" title="Sin registros de compras" message="Registra la primera entrada de mercadería." action={{ label: 'Registrar entrada', onClick: () => setShowForm(true) }}/>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">{['Fecha','Proveedor','Por','N° Prods','Total','Estado','Notas','Acciones'].map(h => <th key={h} className={`text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3 ${['N° Prods','Total'].includes(h)?'text-right':h==='Acciones'?'text-center':'text-left'}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {enriched.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 ${p.status==='anulada'?'opacity-50':''}`}>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-300 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-gray-800 dark:text-slate-100">{p.supplierName}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{p.userName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-slate-300">{p.items?.length || 0}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-800 dark:text-slate-100">{formatCurrency(p.total || 0)}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.status==='anulada'?'bg-red-100 text-red-600':'bg-green-100 text-green-700'}`}>{p.status}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 max-w-[140px] truncate">{p.notes||'—'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setModal({ type: 'detail', data: p })} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Ver detalle">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      </button>
                      {p.status !== 'anulada' && (
                        <button onClick={() => setCancelTarget(p)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Anular">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
              <h2 className="font-semibold text-gray-800 dark:text-slate-100">Nueva entrada de mercadería</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-300"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="overflow-y-auto p-6"><NewPurchaseForm onClose={() => setShowForm(false)}/></div>
          </div>
        </div>
      )}

      {modal?.type === 'detail' && (
        <Modal title="Detalle de compra" subtitle={`${modal.data.supplierName} · ${formatDate(modal.data.createdAt)}`} onClose={() => setModal(null)}>
          <PurchaseDetail purchase={modal.data}/>
        </Modal>
      )}

      {cancelTarget && (
        <ConfirmModal title="¿Anular esta compra?" message={`Se marcará como anulada la compra a ${cancelTarget.supplierName} por ${formatCurrency(cancelTarget.total||0)}. El stock NO se revertirá automáticamente.`} confirmLabel="Anular compra" variant="danger" onConfirm={() => handleCancel(cancelTarget)} onCancel={() => setCancelTarget(null)}/>
      )}
    </div>
  )
}
