import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { api, USE_API } from '../../services/_base'
import { formatCurrency } from '../../shared/utils/helpers'
import { inputCls, labelCls, btnSecondary, btnPrimary, createSafeId } from './catalog.shared'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import toast from 'react-hot-toast'

export function BatchesView({ products, suppliers }) {
  const { updateBatch } = useStore()
  const [search,       setSearch]       = useState('')
  const [selectedProd, setSelectedProd] = useState(null)
  const [modal,        setModal]        = useState(null)
  const [batchForm,    setBatchForm]    = useState({ batchNumber:'', quantity:0, priceBuy:0, expiryDate:'', notes:'' })

  const batchProducts = useMemo(() => { const q = search.toLowerCase(); return products.filter(p => p.useBatches && p.isActive && (!q || p.name.toLowerCase().includes(q) || p.barcode.includes(q))) }, [products, search])
  const prodBatches   = useMemo(() => selectedProd ? (selectedProd.batches || []).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)) : [], [selectedProd])

  const handleSaveBatch = async () => {
    if (!batchForm.batchNumber.trim()) { toast.error('El N° de lote es requerido'); return }
    if (!selectedProd) return
    let savedBatch
    if (USE_API) {
      try {
        const payload = { ...batchForm, quantity: parseFloat(batchForm.quantity)||0, priceBuy: parseFloat(batchForm.priceBuy)||0 }
        if (modal?.batch) { const { data } = await api.put(`/products/${selectedProd.id}/batches/${modal.batch.id}`, payload); savedBatch = data.data }
        else              { const { data } = await api.post(`/products/${selectedProd.id}/batches`, payload); savedBatch = data.data }
      } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar lote'); return }
    } else {
      savedBatch = { id: modal?.batch?.id || createSafeId(), ...batchForm, quantity: parseFloat(batchForm.quantity)||0, priceBuy: parseFloat(batchForm.priceBuy)||0, productId: selectedProd.id, status: 'activo', createdAt: modal?.batch?.createdAt || new Date().toISOString() }
    }
    const current = selectedProd.batches || []
    const updated = modal?.batch ? current.map(b => b.id === savedBatch.id ? savedBatch : b) : [savedBatch, ...current]
    useStore.getState().updateProduct(selectedProd.id, { batches: updated })
    setSelectedProd(prev => ({ ...prev, batches: updated }))
    toast.success(modal?.batch ? 'Lote actualizado' : 'Lote registrado')
    setModal(null); setBatchForm({ batchNumber:'', quantity:0, priceBuy:0, expiryDate:'', notes:'' })
  }

  const handleDeleteBatch = async (batchId) => {
    if (USE_API) { try { await api.delete(`/products/${selectedProd.id}/batches/${batchId}`) } catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar lote'); return } }
    const updated = (selectedProd.batches || []).filter(b => b.id !== batchId)
    useStore.getState().updateProduct(selectedProd.id, { batches: updated })
    setSelectedProd(prev => ({ ...prev, batches: updated }))
    toast.success('Lote eliminado')
  }

  const getDaysToExpiry = (date) => { if (!date) return null; return Math.ceil((new Date(date) - new Date()) / (1000*60*60*24)) }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Productos con gestión de lotes ({batchProducts.length})</p>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..." className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"/>
        </div>
        {batchProducts.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl"><div className="text-3xl mb-2">🔢</div><p className="text-sm text-gray-500 dark:text-slate-400">Sin productos con lotes activos</p><p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Activa "Gestión por lotes" al crear o editar un producto</p></div>
        ) : (
          <div className="space-y-2">
            {batchProducts.map(p => {
              const lotes = p.batches || []; const activos = lotes.filter(b => b.status === 'activo').length
              const proxVenc = lotes.some(b => { const d = getDaysToExpiry(b.expiryDate); return d !== null && d <= 30 && d >= 0 }); const isSelected = selectedProd?.id === p.id
              return (
                <button key={p.id} onClick={() => setSelectedProd(p)} className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-200 dark:hover:border-blue-800'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate max-w-[160px]">{p.name}</p>
                    <div className="flex gap-1">{proxVenc && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full font-semibold">⚠️ Vence</span>}<span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full font-semibold">{activos} lotes</span></div>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 font-mono mt-0.5">{p.barcode}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        {!selectedProd ? (
          <div className="flex items-center justify-center h-64 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl"><div className="text-center"><div className="text-4xl mb-3 opacity-20">🔢</div><p className="text-gray-400 dark:text-slate-500 text-sm">Selecciona un producto para ver sus lotes</p></div></div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedProd.imageUrl ? <img src={selectedProd.imageUrl} alt={selectedProd.name} className="w-12 h-12 rounded-lg object-cover border border-gray-100 dark:border-slate-600" onError={e => e.target.style.display='none'}/> : <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-2xl">📦</div>}
                <div><p className="font-semibold text-gray-800 dark:text-slate-100">{selectedProd.name}</p><p className="text-xs text-gray-400 dark:text-slate-500 font-mono">{selectedProd.barcode} · Stock total: {selectedProd.stock} {selectedProd.unit}</p></div>
              </div>
              <button onClick={() => { setBatchForm({ batchNumber:'', quantity:0, priceBuy:selectedProd.priceBuy||0, expiryDate:'', notes:'' }); setModal({ type:'form', batch:null }) }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700">+ Registrar lote</button>
            </div>
            {prodBatches.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl"><div className="text-3xl mb-2">📋</div><p className="text-sm text-gray-400 dark:text-slate-500">Sin lotes registrados</p><p className="text-xs text-gray-300 dark:text-slate-600 mt-1">Registra el primer lote con el botón de arriba</p></div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead><tr className="bg-gray-50 dark:bg-slate-700/50">{['N° Lote','Cantidad','P. Compra','Vencimiento','Notas','Estado','Acc.'].map(h => <th key={h} className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-3 py-2.5 text-left">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                    {prodBatches.map(b => {
                      const days = getDaysToExpiry(b.expiryDate); const expired = days !== null && days < 0; const nearExp = days !== null && days >= 0 && days <= 30
                      return (
                        <tr key={b.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700/30 ${expired ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                          <td className="px-3 py-2.5"><span className="text-sm font-mono font-semibold text-gray-800 dark:text-slate-100">{b.batchNumber}</span></td>
                          <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-slate-300">{b.quantity} {selectedProd.unit}</td>
                          <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-slate-300">{b.priceBuy > 0 ? formatCurrency(b.priceBuy) : '—'}</td>
                          <td className="px-3 py-2.5">{b.expiryDate ? (<div><span className={`text-xs font-semibold ${expired ? 'text-red-600 dark:text-red-400' : nearExp ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-slate-300'}`}>{new Date(b.expiryDate).toLocaleDateString('es-PE')}</span>{days !== null && <span className={`ml-1 text-xs ${expired ? 'text-red-500' : nearExp ? 'text-amber-500' : 'text-gray-400 dark:text-slate-500'}`}>{expired ? `(vencido hace ${Math.abs(days)}d)` : `(${days}d)`}</span>}</div>) : <span className="text-xs text-gray-400 dark:text-slate-500">—</span>}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-400 dark:text-slate-500 max-w-[120px] truncate">{b.notes || '—'}</td>
                          <td className="px-3 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${expired ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : nearExp ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>{expired ? 'Vencido' : nearExp ? 'Próx. vencer' : 'Activo'}</span></td>
                          <td className="px-3 py-2.5"><div className="flex gap-1">
                            <button onClick={() => { setBatchForm({ batchNumber:b.batchNumber, quantity:b.quantity, priceBuy:b.priceBuy, expiryDate:b.expiryDate||'', notes:b.notes||'' }); setModal({ type:'form', batch:b }) }} className="p-1 text-gray-400 hover:text-amber-600 rounded transition-colors"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                            <button onClick={() => handleDeleteBatch(b.id)} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                          </div></td>
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

      {modal?.type === 'form' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-base font-bold text-gray-800 dark:text-slate-100">{modal.batch ? '✏️ Editar lote' : '+ Registrar nuevo lote'}</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">Producto: <strong>{selectedProd?.name}</strong></p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className={labelCls}>N° de lote *</label><input value={batchForm.batchNumber} onChange={e => setBatchForm(p => ({...p, batchNumber: e.target.value}))} placeholder="Ej: LOT-2024-001, L240506..." className={inputCls}/></div>
              <div><label className={labelCls}>Cantidad</label><input type="number" min="0" step="1" value={batchForm.quantity} onChange={e => setBatchForm(p => ({...p, quantity: e.target.value}))} className={inputCls}/></div>
              <div><label className={labelCls}>Precio de compra (S/)</label><input type="number" min="0" step="1" value={batchForm.priceBuy} onChange={e => setBatchForm(p => ({...p, priceBuy: e.target.value}))} className={inputCls}/></div>
              <div className="col-span-2"><label className={labelCls}>Fecha de vencimiento</label><input type="date" value={batchForm.expiryDate} onChange={e => setBatchForm(p => ({...p, expiryDate: e.target.value}))} className={inputCls}/></div>
              <div className="col-span-2"><label className={labelCls}>Notas / Observaciones</label><textarea rows={2} value={batchForm.notes} onChange={e => setBatchForm(p => ({...p, notes: e.target.value}))} placeholder="Proveedor, condiciones de almacenamiento..." className={inputCls + ' resize-none'}/></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className={btnSecondary + ' flex-1'}>Cancelar</button>
              <button type="button" onClick={handleSaveBatch} className={btnPrimary + ' flex-1'}>{modal.batch ? 'Guardar cambios' : 'Registrar lote'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
