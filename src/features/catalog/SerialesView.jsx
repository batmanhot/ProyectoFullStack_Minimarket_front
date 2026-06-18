import { useState, useMemo, useEffect } from 'react'
import { serialService } from '../../services/index'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import toast from 'react-hot-toast'

const statusColor = { disponible: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', vendido: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', reservado: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dado_baja: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' }
const statusLabel = { disponible: 'Disponible', vendido: 'Vendido', reservado: 'Reservado', dado_baja: 'Dado de baja' }

export function SerialesView({ products }) {
  const [search,        setSearch]        = useState('')
  const [selectedProd,  setSelectedProd]  = useState(null)
  const [seriales,      setSeriales]      = useState([])
  const [loadingList,   setLoadingList]   = useState(false)
  const [filterStatus,  setFilterStatus]  = useState('todos')
  const [showAddModal,  setShowAddModal]  = useState(false)
  const [bulkInput,     setBulkInput]     = useState('')
  const [savingBulk,    setSavingBulk]    = useState(false)
  const [confirmDel,    setConfirmDel]    = useState(null)

  const serieProducts = useMemo(() => { const q = search.toLowerCase(); return products.filter(p => p.stockControl === 'serie' && p.isActive && (!q || p.name.toLowerCase().includes(q) || p.barcode.includes(q))) }, [products, search])

  useEffect(() => { if (!selectedProd && serieProducts.length > 0) setSelectedProd(serieProducts[0]) }, [serieProducts, selectedProd])

  // Carga inicial al cambiar de producto
  useEffect(() => {
    if (!selectedProd) return
    setLoadingList(true)
    serialService.getByProduct(selectedProd.id).then(r => { if (r.ok) setSeriales(r.data) }).finally(() => setLoadingList(false))
  }, [selectedProd])

  // Reacciona cuando el store actualiza los seriales (ej: al completar o anular una venta)
  const prodActualSeriales = products.find(p => p.id === selectedProd?.id)?.serials
  useEffect(() => {
    if (!selectedProd || !prodActualSeriales) return
    setSeriales(prodActualSeriales)
  }, [prodActualSeriales])

  const reloadSeriales = async () => {
    if (!selectedProd) return
    setLoadingList(true)
    const r = await serialService.getByProduct(selectedProd.id)
    if (r.ok) setSeriales(r.data)
    setLoadingList(false)
  }

  const filtered = useMemo(() => filterStatus === 'todos' ? seriales : seriales.filter(s => s.status === filterStatus), [seriales, filterStatus])
  const summary  = useMemo(() => ({ disponible: seriales.filter(s => s.status === 'disponible').length, vendido: seriales.filter(s => s.status === 'vendido').length, dado_baja: seriales.filter(s => s.status === 'dado_baja').length, reservado: seriales.filter(s => s.status === 'reservado').length }), [seriales])

  const handleBulkSave = async () => {
    const lines = bulkInput.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) { toast.error('Ingresa al menos un número de serie'); return }
    if (!selectedProd) return
    setSavingBulk(true)
    const r = await serialService.createBatch(selectedProd.id, lines.map(sn => ({ serialNumber: sn, notes: '' })))
    setSavingBulk(false)
    if (r.error) { toast.error(r.error); return }
    toast.success(`${r.data.created} serial(es) registrado(s)`)
    setBulkInput(''); setShowAddModal(false); await reloadSeriales()
  }

  const handlePatchStatus = async (serial, newStatus) => {
    const r = await serialService.patchStatus(selectedProd.id, serial.id, newStatus)
    if (r.error) { toast.error(r.error); return }
    toast.success(`Serial marcado como "${newStatus}"`); await reloadSeriales()
  }

  const handleDelete = async (serial) => {
    const r = await serialService.remove(selectedProd.id, serial.id)
    if (r.error) { toast.error(r.error); return }
    toast.success('Serial eliminado'); setConfirmDel(null); await reloadSeriales()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Productos con N° de serie ({serieProducts.length})</p>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..." className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"/>
        </div>
        {serieProducts.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl"><div className="text-3xl mb-2">🔑</div><p className="text-sm text-gray-500 dark:text-slate-400">Sin productos con control por serie</p><p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Selecciona "Por serie" en la estrategia de inventario del producto</p></div>
        ) : (
          <div className="space-y-2">
            {serieProducts.map(p => {
              const isSelected = selectedProd?.id === p.id
              return (
                <button key={p.id} onClick={() => setSelectedProd(p)} className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-200 dark:hover:border-purple-800'}`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium truncate max-w-[160px] ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-gray-800 dark:text-slate-100'}`}>{p.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full font-semibold shrink-0">{p.stock} disp.</span>
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
          <div className="flex items-center justify-center h-64 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl"><div className="text-center"><div className="text-4xl mb-3 opacity-20">🔑</div><p className="text-gray-400 dark:text-slate-500 text-sm">Selecciona un producto para ver sus seriales</p></div></div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xl shrink-0">🔑</div>
                <div className="min-w-0"><p className="font-semibold text-gray-800 dark:text-slate-100 truncate">{selectedProd.name}</p><p className="text-xs text-gray-400 dark:text-slate-500 font-mono">{selectedProd.barcode}</p></div>
              </div>
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 shrink-0">+ Registrar seriales</button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'todos',      label: 'Total',         val: seriales.length,    color: 'bg-gray-50 dark:bg-slate-800/60 text-gray-700 dark:text-slate-300' },
                { key: 'disponible', label: 'Disponibles',   val: summary.disponible, color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' },
                { key: 'vendido',    label: 'Vendidos',      val: summary.vendido,    color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' },
                { key: 'dado_baja',  label: 'Dados de baja', val: summary.dado_baja,  color: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' },
              ].map(({ key, label, val, color }) => (
                <button key={key} onClick={() => setFilterStatus(key)} className={`rounded-xl p-3 text-center border-2 transition-all ${color} ${filterStatus === key ? 'border-current' : 'border-transparent'}`}>
                  <p className="text-xl font-black leading-none">{val}</p>
                  <p className="text-xs mt-1 opacity-80">{label}</p>
                </button>
              ))}
            </div>

            {loadingList ? (
              <div className="text-center py-12 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl"><p className="text-sm text-gray-400 dark:text-slate-500">Cargando seriales...</p></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-sm text-gray-400 dark:text-slate-500">{filterStatus === 'todos' ? 'Sin seriales registrados' : `Sin seriales en estado "${statusLabel[filterStatus]}"`}</p>
                {filterStatus === 'todos' && <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">Registra los N° de serie de cada unidad física con el botón de arriba</p>}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[540px]">
                  <thead><tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">{['N° de serie', 'Estado', 'Comprobante', 'Fecha venta', 'Notas', 'Acc.'].map(h => <th key={h} className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-3 py-2.5 text-left">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                    {filtered.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-3 py-2.5"><span className="font-mono text-sm font-semibold text-gray-800 dark:text-slate-100">{s.serialNumber}</span></td>
                        <td className="px-3 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[s.status] || 'bg-gray-100 text-gray-500'}`}>{statusLabel[s.status] || s.status}</span></td>
                        <td className="px-3 py-2.5 text-xs font-mono text-gray-500 dark:text-slate-400">{s.invoiceNumber || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-400 dark:text-slate-500">{s.soldAt ? new Date(s.soldAt).toLocaleDateString('es-PE') : '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-400 dark:text-slate-500 max-w-[120px] truncate">{s.notes || '—'}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            {(s.status === 'disponible' || s.status === 'reservado') && (
                              <button onClick={() => handlePatchStatus(s, 'dado_baja')} title="Dar de baja" className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                              </button>
                            )}
                            {s.status === 'dado_baja' && (
                              <button onClick={() => handlePatchStatus(s, 'disponible')} title="Restituir a disponible" className="p-1 text-gray-400 hover:text-green-600 rounded transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                              </button>
                            )}
                            {s.status !== 'vendido' && (
                              <button onClick={() => setConfirmDel(s)} title="Eliminar" className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                <div className="px-4 py-2 border-t border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50"><p className="text-xs text-gray-400 dark:text-slate-500">{filtered.length} serial(es) mostrado(s)</p></div>
              </div>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <div><h3 className="text-base font-bold text-gray-800 dark:text-slate-100">🔑 Registrar números de serie</h3><p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Producto: <strong>{selectedProd?.name}</strong></p></div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Números de serie (uno por línea)</label>
              <textarea rows={8} value={bulkInput} onChange={e => setBulkInput(e.target.value)} placeholder={'SN-SAM55-001\nSN-SAM55-002\nSN-SAM55-003\n...'} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none dark:bg-slate-700 dark:text-slate-100" autoFocus/>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{bulkInput.split('\n').filter(l => l.trim()).length} serial(es) a registrar</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowAddModal(false); setBulkInput('') }} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700">Cancelar</button>
              <button onClick={handleBulkSave} disabled={savingBulk || !bulkInput.trim()} className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-40">{savingBulk ? 'Registrando...' : 'Registrar seriales'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDel && (
        <ConfirmModal title="¿Eliminar este serial?" message={`El serial "${confirmDel.serialNumber}" será eliminado permanentemente.`} confirmLabel="Eliminar" variant="danger" onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)}/>
      )}
    </div>
  )
}
