/**
 * Merma.jsx — Módulo de Almacén de Merma
 * Ruta: src/features/merma/Merma.jsx
 *
 * ARCHIVO NUEVO — No modifica ningún archivo existente.
 * Integración: agregar en App.jsx como lazy import + ruta 'merma' en PAGES.
 * Agregar en Sidebar bajo INVENTARIO: { key: 'merma', label: 'Merma', icon: '⚠️' }
 *
 * FUNCIONALIDAD:
 *  - Registrar productos en merma (vencidos, dañados, rotos)
 *  - Listado del almacén de merma con estado y motivo
 *  - Flujo de devolución al proveedor
 *  - Estadísticas de pérdida valorizada
 */

import { useState, useMemo } from 'react'
import { useStore }          from '../../store/index'
import { formatCurrency, formatDate } from '../../shared/utils/helpers'
import { useDebounce }       from '../../shared/hooks/useDebounce'
import { allocateMerma }     from '../../shared/utils/inventoryEngine'
import toast                 from 'react-hot-toast'

// ─── Motivos de merma ─────────────────────────────────────────────────────────
const MERMA_REASONS = [
  { value: 'vencido',   label: 'Producto vencido / caducado',      icon: '📅' },
  { value: 'danado',    label: 'Producto dañado / roto',           icon: '💔' },
  { value: 'rotura',    label: 'Rotura en almacén / manipulación', icon: '🏚️' },
  { value: 'hurto',     label: 'Hurto / pérdida',                  icon: '🔍' },
  { value: 'calidad',   label: 'Rechazo de calidad',               icon: '❌' },
  { value: 'devolucion',label: 'Devolución de cliente defectuosa', icon: '↩️' },
  { value: 'otro',      label: 'Otro motivo',                      icon: '📝' },
]

// ─── Estados en el flujo de merma ─────────────────────────────────────────────
const MERMA_STATUS = {
  en_merma:        { label: 'En almacén merma', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'         },
  en_devolucion:   { label: 'En devolución',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  devuelto:        { label: 'Devuelto',         color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'     },
  repuesto:        { label: 'Repuesto',         color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  dado_de_baja:    { label: 'Dado de baja',     color: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400'      },
}

// ─── Formulario de registro de merma ─────────────────────────────────────────
function MermaForm({ onClose }) {
  const { products, suppliers, currentUser, updateProduct, addStockMovement, addMermaRecord } = useStore()
  const [productId,  setProductId]  = useState('')
  const [batchId,    setBatchId]    = useState('')
  const [quantity,   setQuantity]   = useState(1)
  const [reasonKey,  setReasonKey]  = useState('vencido')
  const [reasonNote, setReasonNote] = useState('')
  const [search,     setSearch]     = useState('')
  const dq = useDebounce(search, 150)

  const searchResults = useMemo(() => {
    if (!dq.trim()) return []
    const q = dq.toLowerCase()
    return products
      .filter(p => p.isActive && (p.name.toLowerCase().includes(q) || p.barcode.includes(dq)))
      .slice(0, 6)
  }, [dq, products])

  const selectedProduct = products.find(p => p.id === productId)
  const availBatches    = (selectedProduct?.batches || [])
    .filter(b => b.status !== 'agotado' && b.status !== 'merma' && (b.quantity || 0) > 0)

  const handleSubmit = () => {
    if (!productId) { toast.error('Selecciona un producto'); return }
    if (quantity <= 0) { toast.error('La cantidad debe ser mayor a 0'); return }
    if (!reasonKey) { toast.error('Selecciona un motivo'); return }

    const product = products.find(p => p.id === productId)
    if (!product) return

    const reasonLabel = MERMA_REASONS.find(r => r.value === reasonKey)?.label || reasonKey
    const fullReason  = reasonNote.trim() ? `${reasonLabel} — ${reasonNote.trim()}` : reasonLabel

    const result = allocateMerma({
      product,
      quantity:    parseFloat(quantity),
      reason:      fullReason,
      batchId:     batchId || null,
      userId:      currentUser?.id,
    })

    if (result.error) { toast.error(result.error); return }

    // Actualizar stock del producto
    updateProduct(productId, result.stockUpdate)

    // Registrar movimiento de stock
    addStockMovement({
      id:          (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`),
      productId,
      productName: product.name,
      ...result.movement,
      userId:      currentUser?.id,
      userName:    currentUser?.fullName,
      createdAt:   new Date().toISOString(),
    })

    // Guardar registro en el almacén de merma
    addMermaRecord?.({
      ...result.mermaRecord,
      supplierId:   product.supplierId || null,
      supplierName: null, // se resuelve al devolver
      userId:       currentUser?.id,
      userName:     currentUser?.fullName,
      unitCost:     product.priceBuy || 0,
      totalLoss:    parseFloat(((product.priceBuy || 0) * parseFloat(quantity)).toFixed(2)),
    })

    toast.success(`${quantity} ${product.unit || 'u'} de "${product.name}" registradas en merma`)
    onClose()
  }

  const cls = 'w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 dark:bg-slate-700 dark:text-slate-100'

  return (
    <div className="space-y-4">
      {/* Buscar producto */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Producto *</label>
        {!selectedProduct ? (
          <div className="relative">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o código de barras..."
              className={cls}/>
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl z-20 overflow-hidden">
                {searchResults.map(p => (
                  <button key={p.id} onMouseDown={() => { setProductId(p.id); setSearch('') }}
                    className="w-full text-left px-3 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-between border-b border-gray-50 dark:border-slate-700/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{p.name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {p.barcode} · {p.stockControl || 'simple'} · Stock: {p.stock} {p.unit}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{selectedProduct.name}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Estrategia: <strong>{selectedProduct.stockControl || 'simple'}</strong>
                {' · '}Stock disponible: <strong>{selectedProduct.stock} {selectedProduct.unit}</strong>
              </p>
            </div>
            <button onClick={() => { setProductId(''); setBatchId(''); setQuantity(1) }}
              className="text-gray-400 hover:text-red-500 ml-3 text-xs underline">
              Cambiar
            </button>
          </div>
        )}
      </div>

      {/* Selección de lote (si el producto usa lotes) */}
      {selectedProduct && (selectedProduct.stockControl === 'lote_fefo' || selectedProduct.stockControl === 'lote_fifo') && availBatches.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Lote afectado</label>
          <select value={batchId} onChange={e => setBatchId(e.target.value)} className={cls}>
            <option value="">Seleccionar lote (opcional — el motor elige si no seleccionas)</option>
            {availBatches.map(b => (
              <option key={b.id} value={b.id}>
                Lote {b.batchNumber} · {b.quantity} {selectedProduct.unit}
                {b.expiryDate ? ` · Vence: ${b.expiryDate}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Cantidad y motivo */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Cantidad *</label>
          <input type="number" min="0.01" step="0.01" value={quantity}
            onChange={e => setQuantity(e.target.value)}
            className={cls}/>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Motivo *</label>
          <select value={reasonKey} onChange={e => setReasonKey(e.target.value)} className={cls}>
            {MERMA_REASONS.map(r => (
              <option key={r.value} value={r.value}>{r.icon} {r.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Observaciones adicionales</label>
        <textarea value={reasonNote} onChange={e => setReasonNote(e.target.value)} rows={2}
          placeholder="Detalle adicional del motivo..."
          className={cls + ' resize-none'}/>
      </div>

      {/* Estimado de pérdida */}
      {selectedProduct && quantity > 0 && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex justify-between text-sm">
            <span className="text-red-700 dark:text-red-400 font-medium">Pérdida estimada:</span>
            <span className="text-red-700 dark:text-red-400 font-bold">
              {formatCurrency((selectedProduct.priceBuy || 0) * parseFloat(quantity || 0))}
            </span>
          </div>
          <p className="text-xs text-red-500 mt-0.5">
            {parseFloat(quantity || 0)} {selectedProduct.unit} × {formatCurrency(selectedProduct.priceBuy || 0)} costo unit.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={onClose}
          className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
          Cancelar
        </button>
        <button onClick={handleSubmit}
          className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
          ⚠️ Registrar merma
        </button>
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Merma() {
  const { mermaRecords = [], suppliers, updateMermaRecord, currentUser } = useStore()
  const [search,      setSearch]      = useState('')
  const [statusFilter,setStatusFilter]= useState('todas')
  const [modal,       setModal]       = useState(null)
  const dq = useDebounce(search, 150)

  const filtered = useMemo(() => {
    let list = mermaRecords
    if (dq.trim()) {
      const q = dq.toLowerCase()
      list = list.filter(r => r.productName?.toLowerCase().includes(q) || r.batchNumber?.includes(dq))
    }
    if (statusFilter !== 'todas') list = list.filter(r => r.status === statusFilter)
    return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [mermaRecords, dq, statusFilter])

  // KPIs
  const kpis = useMemo(() => ({
    total:       mermaRecords.length,
    enAlmacen:   mermaRecords.filter(r => r.status === 'en_merma').length,
    totalLoss:   mermaRecords.reduce((a, r) => a + (r.totalLoss || 0), 0),
    enDevolucion:mermaRecords.filter(r => r.status === 'en_devolucion').length,
  }), [mermaRecords])

  const handleUpdateStatus = (id, status) => {
    updateMermaRecord?.(id, { status, updatedAt: new Date().toISOString() })
    toast.success(`Estado actualizado: ${MERMA_STATUS[status]?.label}`)
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">⚠️ Almacén de Merma</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">
            Productos vencidos, dañados o con fallas · {mermaRecords.length} registros
          </p>
        </div>
        <button onClick={() => setModal({ type: 'form' })}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Registrar merma
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total registros',  value: kpis.total,                        color: 'text-gray-800 dark:text-slate-100' },
          { label: 'En almacén',       value: kpis.enAlmacen,                    color: 'text-red-600 dark:text-red-400'   },
          { label: 'En devolución',    value: kpis.enDevolucion,                 color: 'text-amber-600 dark:text-amber-400'},
          { label: 'Pérdida total',    value: formatCurrency(kpis.totalLoss),    color: 'text-red-700 dark:text-red-400'   },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por producto o N° de lote..."
          className="flex-1 min-w-48 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-400"/>
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1 flex-wrap">
          {[{ k:'todas', l:'Todas' }, ...Object.entries(MERMA_STATUS).map(([k,v]) => ({ k, l: v.label }))].map(f => (
            <button key={f.k} onClick={() => setStatusFilter(f.k)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                statusFilter === f.k ? 'bg-white dark:bg-slate-600 shadow text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'
              }`}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl">
          <div className="text-5xl mb-3 opacity-20">⚠️</div>
          <p className="text-gray-400 dark:text-slate-500 font-medium">
            {mermaRecords.length === 0 ? 'Sin registros de merma' : 'Sin resultados para este filtro'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                  {['Producto','Lote','Cantidad','Motivo','Pérdida','Fecha','Estado','Acciones'].map(h => (
                    <th key={h} className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-2.5 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {filtered.map(r => {
                  const st = MERMA_STATUS[r.status] || MERMA_STATUS.en_merma
                  const rm = MERMA_REASONS.find(x => r.reason?.includes(x.label))
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{r.productName}</p>
                        {r.expiryDate && (
                          <p className="text-xs text-red-400">Vence: {r.expiryDate}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-slate-400">
                        {r.batchNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400">
                        {r.quantity}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 max-w-[180px] truncate">
                        {r.reason}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400">
                        -{formatCurrency(r.totalLoss || 0)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {r.status === 'en_merma' && (
                            <button
                              onClick={() => handleUpdateStatus(r.id, 'en_devolucion')}
                              className="px-2 py-1 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 whitespace-nowrap"
                              title="Iniciar devolución al proveedor">
                              📦 Devolver
                            </button>
                          )}
                          {r.status === 'en_devolucion' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(r.id, 'devuelto')}
                                className="px-2 py-1 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600">
                                ✓ Devuelto
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(r.id, 'repuesto')}
                                className="px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600">
                                🔄 Repuesto
                              </button>
                            </>
                          )}
                          {(r.status === 'en_merma' || r.status === 'en_devolucion') && (
                            <button
                              onClick={() => handleUpdateStatus(r.id, 'dado_de_baja')}
                              className="px-2 py-1 bg-gray-400 text-white text-xs font-semibold rounded-lg hover:bg-gray-500">
                              Dar de baja
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
        </div>
      )}

      {/* Modal de registro */}
      {modal?.type === 'form' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
              <div>
                <h2 className="text-base font-bold text-gray-800 dark:text-slate-100">⚠️ Registrar en Merma</h2>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">El stock se descontará del producto automáticamente</p>
              </div>
              <button onClick={() => setModal(null)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-xl">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="p-5">
              <MermaForm onClose={() => setModal(null)}/>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
