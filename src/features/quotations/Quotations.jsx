/**
 * Quotations.jsx — Cotizaciones y Pedidos Preventa
 * Ruta: src/features/quotations/Quotations.jsx
 *
 * FLUJO:
 *  1. Crear cotización → seleccionar cliente, agregar productos, nota
 *  2. Estados: borrador → enviada → aprobada → convertida / rechazada / vencida
 *  3. Convertir a venta → abre POS con los ítems pre-cargados
 *  4. Historial de cotizaciones con filtros
 */

import { useState, useMemo } from 'react'
import { useStore }          from '../../store/index'
import { formatCurrency, formatDate, formatDateTime } from '../../shared/utils/helpers'
import { useDebounce }       from '../../shared/hooks/useDebounce'
import toast                 from 'react-hot-toast'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const Q_STATUS = {
  borrador:   { label: 'Borrador',    color: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'           },
  enviada:    { label: 'Enviada',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'          },
  aprobada:   { label: 'Aprobada',    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'      },
  convertida: { label: 'Convertida',  color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'  },
  rechazada:  { label: 'Rechazada',   color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'              },
  vencida:    { label: 'Vencida',     color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'      },
}

let QN = parseInt(localStorage.getItem('pos_quote_num') || '1', 10)
const nextQN = () => {
  QN++
  localStorage.setItem('pos_quote_num', String(QN))
  return `COT-${String(QN).padStart(6, '0')}`
}

// ─── Formulario de cotización ─────────────────────────────────────────────────
function QuotationForm({ quotation, onClose, onSave }) {
  const { products, clients, currentUser } = useStore()
  const [clientId,   setClientId]  = useState(quotation?.clientId  || '')
  const [items,      setItems]     = useState(quotation?.items      || [])
  const [note,       setNote]      = useState(quotation?.note       || '')
  const [validDays,  setValidDays] = useState(quotation?.validDays  || 7)
  const [search,     setSearch]    = useState('')
  const dq = useDebounce(search, 150)

  const searchResults = useMemo(() => {
    if (!dq.trim()) return []
    const q = dq.toLowerCase()
    return products.filter(p => p.isActive && (
      p.name.toLowerCase().includes(q) || p.barcode.includes(dq)
    )).slice(0, 6)
  }, [dq, products])

  const addItem = (product) => {
    if (items.find(i => i.productId === product.id)) { toast.error('Ya está en la lista'); return }
    setItems(prev => [...prev, {
      productId: product.id, productName: product.name,
      barcode: product.barcode, unit: product.unit,
      quantity: 1, unitPrice: product.priceSell,
      discount: 0,
    }])
    setSearch('')
  }

  const updateItem = (idx, field, val) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: parseFloat(val) || 0 } : item))

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  const total    = items.reduce((a, i) => a + i.quantity * i.unitPrice * (1 - i.discount / 100), 0)
  const client   = clients.find(c => c.id === clientId)
  const expiresAt = new Date(Date.now() + validDays * 86400000).toISOString()

  const handleSave = (status = 'borrador') => {
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return }
    const q = {
      id:            quotation?.id || crypto.randomUUID(),
      number:        quotation?.number || nextQN(),
      clientId,
      clientName:    client?.name || 'Sin cliente',
      items,
      note,
      validDays,
      expiresAt,
      total:         parseFloat(total.toFixed(2)),
      status,
      userId:        currentUser?.id,
      userName:      currentUser?.fullName,
      createdAt:     quotation?.createdAt || new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
    }
    onSave(q)
    onClose()
  }

  return (
    <div className="space-y-4">
      {/* Cliente y validez */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Cliente</label>
          <select value={clientId} onChange={e => setClientId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Sin cliente / Prospect</option>
            {clients.filter(c => c.isActive).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
            Válida por (días)
          </label>
          <select value={validDays} onChange={e => setValidDays(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[1, 3, 7, 15, 30, 60].map(d => (
              <option key={d} value={d}>{d} día{d > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Búsqueda de productos */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
          Agregar productos
        </label>
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl z-20 overflow-hidden">
              {searchResults.map(p => (
                <button key={p.id} onMouseDown={() => addItem(p)}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-50 dark:border-slate-700/50 last:border-0 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{p.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{p.barcode} · Stock: {p.stock}</p>
                  </div>
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(p.priceSell)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla de ítems */}
      {items.length > 0 && (
        <div className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                {['Producto', 'Cant.', 'P. Unit.', 'Dto.%', 'Subtotal', ''].map(h => (
                  <th key={h} className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {items.map((item, idx) => {
                const subtotal = parseFloat((item.quantity * item.unitPrice * (1 - item.discount / 100)).toFixed(2))
                return (
                  <tr key={idx}>
                    <td className="px-3 py-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{item.productName}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{item.unit}</p>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0.01" step="0.01" value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                        className="w-16 text-center px-2 py-1 border border-gray-200 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="0.01" value={item.unitPrice}
                        onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                        className="w-20 text-right px-2 py-1 border border-gray-200 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" max="100" step="1" value={item.discount}
                        onChange={e => updateItem(idx, 'discount', e.target.value)}
                        className="w-14 text-center px-2 py-1 border border-gray-200 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-slate-100">
                      {formatCurrency(subtotal)}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeItem(idx)}
                        className="text-gray-300 dark:text-slate-600 hover:text-red-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-700">
            <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">TOTAL COTIZACIÓN</span>
            <span className="text-base font-bold text-gray-800 dark:text-slate-100">{formatCurrency(total)}</span>
          </div>
        </div>
      )}

      {/* Nota */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Nota / Condiciones</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
          placeholder="Condiciones de pago, entrega, observaciones..."
          className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm resize-none dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
      </div>

      {/* Acciones */}
      <div className="flex gap-2 pt-2">
        <button onClick={onClose}
          className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
          Cancelar
        </button>
        <button onClick={() => handleSave('borrador')}
          className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-600">
          Guardar borrador
        </button>
        <button onClick={() => handleSave('enviada')}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Enviar cotización
        </button>
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Quotations() {
  const { products, clients, currentUser, addToCart, clearCart } = useStore()

  // Cotizaciones en localStorage (sin backend aún)
  const [quotations, setQuotations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_quotations') || '[]') } catch { return [] }
  })

  const saveQuotations = (list) => {
    setQuotations(list)
    localStorage.setItem('pos_quotations', JSON.stringify(list))
  }

  const [modal,      setModal]      = useState(null)
  const [search,     setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('todas')
  const dq = useDebounce(search, 150)

  const filtered = useMemo(() => {
    let list = quotations
    if (dq.trim()) {
      const q = dq.toLowerCase()
      list = list.filter(qt =>
        qt.number?.toLowerCase().includes(q) ||
        qt.clientName?.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'todas') list = list.filter(qt => qt.status === statusFilter)
    return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [quotations, dq, statusFilter])

  // KPIs
  const kpis = useMemo(() => ({
    total:      quotations.length,
    pendientes: quotations.filter(q => ['borrador','enviada','aprobada'].includes(q.status)).length,
    convertidas:quotations.filter(q => q.status === 'convertida').length,
    monto:      quotations.filter(q => ['enviada','aprobada'].includes(q.status))
                  .reduce((a, q) => a + q.total, 0),
  }), [quotations])

  const handleSave = (q) => {
    const existing = quotations.findIndex(x => x.id === q.id)
    const updated  = existing >= 0
      ? quotations.map(x => x.id === q.id ? q : x)
      : [q, ...quotations]
    saveQuotations(updated)
    toast.success(`Cotización ${q.number} ${q.status === 'borrador' ? 'guardada' : 'enviada'}`)
  }

  const handleStatusChange = (id, status) => {
    saveQuotations(quotations.map(q => q.id === id ? { ...q, status, updatedAt: new Date().toISOString() } : q))
    toast.success(`Estado actualizado: ${Q_STATUS[status].label}`)
  }

  const handleConvertToSale = (q) => {
    // Pre-cargar los ítems de la cotización en el carrito del POS
    clearCart()
    q.items.forEach(item => {
      const product = products.find(p => p.id === item.productId)
      if (product) {
        addToCart({ ...product, quantity: item.quantity })
      }
    })
    handleStatusChange(q.id, 'convertida')
    toast.success(`Cotización ${q.number} lista en el POS — ve a Punto de Venta para completar la venta`, { duration: 5000 })
  }

  const handleDelete = (id) => {
    saveQuotations(quotations.filter(q => q.id !== id))
    toast.success('Cotización eliminada')
  }

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Cotizaciones</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">
            Pedidos preventa · {quotations.length} total
          </p>
        </div>
        <button onClick={() => setModal({ type: 'form', data: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Nueva cotización
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total',          value: kpis.total,                       color: 'text-gray-800 dark:text-slate-100' },
          { label: 'Pendientes',     value: kpis.pendientes,                  color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Convertidas',    value: kpis.convertidas,                 color: 'text-green-600 dark:text-green-400' },
          { label: 'Monto pendiente',value: formatCurrency(kpis.monto),       color: 'text-blue-600 dark:text-blue-400' },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-semibold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por N° o cliente..."
          className="flex-1 min-w-48 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          {[{ k:'todas', l:'Todas' }, ...Object.entries(Q_STATUS).map(([k,v]) => ({ k, l: v.label }))].map(f => (
            <button key={f.k} onClick={() => setStatusFilter(f.k)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                statusFilter === f.k ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400'
              }`}>{f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl">
          <div className="text-5xl mb-3 opacity-20">📋</div>
          <p className="text-gray-400 dark:text-slate-500 font-medium">
            {quotations.length === 0 ? 'No hay cotizaciones aún' : 'Sin resultados para este filtro'}
          </p>
          {quotations.length === 0 && (
            <button onClick={() => setModal({ type: 'form', data: null })}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              Crear primera cotización
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                {['N° Cotización','Cliente','Productos','Total','Válida hasta','Estado','Acciones'].map(h => (
                  <th key={h} className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-2.5 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {filtered.map(q => {
                const isExpired = new Date(q.expiresAt) < new Date() && !['convertida','rechazada','vencida'].includes(q.status)
                const status    = isExpired ? 'vencida' : q.status
                const st        = Q_STATUS[status] || Q_STATUS.borrador

                return (
                  <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-mono font-semibold text-gray-800 dark:text-slate-100">{q.number}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{formatDate(q.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{q.clientName}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300">
                      {q.items?.length} ítem{q.items?.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-slate-100">
                      {formatCurrency(q.total)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                      {formatDate(q.expiresAt)}
                      {isExpired && <span className="ml-1 text-amber-500">· vencida</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Editar */}
                        {['borrador','enviada'].includes(q.status) && (
                          <button onClick={() => setModal({ type: 'form', data: q })}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Editar">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                          </button>
                        )}
                        {/* Aprobar */}
                        {q.status === 'enviada' && (
                          <button onClick={() => handleStatusChange(q.id, 'aprobada')}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors" title="Marcar aprobada">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          </button>
                        )}
                        {/* Convertir a venta */}
                        {['enviada','aprobada'].includes(q.status) && (
                          <button onClick={() => handleConvertToSale(q)}
                            className="px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors" title="Convertir a venta">
                            → Venta
                          </button>
                        )}
                        {/* Rechazar */}
                        {['borrador','enviada','aprobada'].includes(q.status) && (
                          <button onClick={() => handleStatusChange(q.id, 'rechazada')}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Rechazar">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        )}
                        {/* Eliminar */}
                        {['borrador','rechazada','vencida'].includes(q.status) && (
                          <button onClick={() => handleDelete(q.id)}
                            className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-red-400 rounded-lg transition-colors" title="Eliminar">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
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

      {/* Modal */}
      {modal?.type === 'form' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
              <h2 className="text-base font-bold text-gray-800 dark:text-slate-100">
                {modal.data ? `Editar ${modal.data.number}` : 'Nueva cotización'}
              </h2>
              <button onClick={() => setModal(null)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-xl">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-5">
              <QuotationForm quotation={modal.data} onClose={() => setModal(null)} onSave={handleSave}/>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
