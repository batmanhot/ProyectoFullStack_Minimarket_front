import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { purchaseService } from '../../services/index'
import { formatCurrency, formatDate } from '../../shared/utils/helpers'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import toast from 'react-hot-toast'

function NewPurchaseForm({ onClose }) {
  const { suppliers, products, categories, currentUser } = useStore()
  const [supplierId, setSupplierId] = useState('')
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [notes, setNotes] = useState('')
  const dq = useDebounce(search, 150)

  const searchResults = useMemo(() => {
    if (!dq.trim()) return []
    const q = dq.toLowerCase()
    return products.filter(p => p.isActive && (
      p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.sku?.toLowerCase().includes(q)
    )).slice(0, 6)
  }, [dq, products])

  const addItem = (product) => {
    if (items.find(i => i.productId === product.id)) {
      toast.error('Ya está en la lista')
      return
    }
    setItems(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      barcode: product.barcode,
      quantity: 1,
      priceBuy: product.priceBuy,
      currentStock: product.stock,
    }])
    setSearch('')
  }

  const updateItem = (productId, field, value) =>
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, [field]: parseFloat(value) || 0 } : i))

  const removeItem = (productId) => setItems(prev => prev.filter(i => i.productId !== productId))

  const total = items.reduce((a, i) => a + i.quantity * i.priceBuy, 0)

  const handleConfirm = async () => {
    if (!supplierId) { toast.error('Selecciona un proveedor'); return }
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return }
    const hasInvalid = items.some(i => i.quantity <= 0 || i.priceBuy <= 0)
    if (hasInvalid) { toast.error('Verifica cantidades y precios'); return }

    const supplier = suppliers.find(s => s.id === supplierId)
    const result = await purchaseService.create({
      supplierId,
      supplierName: supplier?.name || '',
      items,
      notes,
      userId: currentUser?.id,
      userName: currentUser?.fullName,
    })
    if (result.error) { toast.error(result.error); return }
    toast.success(`Compra registrada — stock actualizado en ${items.length} producto(s)`)
    onClose()
  }

  return (
    <div className="space-y-5">
      {/* Proveedor */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor *</label>
        <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Seleccionar proveedor...</option>
          {suppliers.filter(s => s.isActive !== false).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Búsqueda de productos */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Agregar productos</label>
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código o SKU..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
              {searchResults.map(p => (
                <button key={p.id} onClick={() => addItem(p)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.barcode} · Stock: {p.stock} · Último costo: {formatCurrency(p.priceBuy)}</div>
                  </div>
                  <span className="text-blue-600 text-xs font-medium">+ Agregar</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lista de items */}
      {items.length > 0 && (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Producto</th>
                <th className="text-center text-xs font-medium text-gray-500 px-3 py-2">Stock actual</th>
                <th className="text-center text-xs font-medium text-gray-500 px-3 py-2">Cantidad</th>
                <th className="text-center text-xs font-medium text-gray-500 px-3 py-2">Precio costo</th>
                <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">Subtotal</th>
                <th className="px-3 py-2"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(item => (
                <tr key={item.productId}>
                  <td className="px-3 py-2.5">
                    <div className="text-sm font-medium text-gray-800">{item.productName}</div>
                    <div className="text-xs text-gray-400">{item.barcode}</div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-xs text-gray-500">{item.currentStock}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <input type="number" min="0.01" step="0.01" value={item.quantity}
                      onChange={e => updateItem(item.productId, 'quantity', e.target.value)}
                      className="w-20 text-center px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="relative w-28 mx-auto">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">S/</span>
                      <input type="number" min="0.01" step="0.01" value={item.priceBuy}
                        onChange={e => updateItem(item.productId, 'priceBuy', e.target.value)}
                        className="w-full pl-7 pr-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800">
                    {formatCurrency(item.quantity * item.priceBuy)}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => removeItem(item.productId)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
            <span className="text-sm font-medium text-gray-600">TOTAL COMPRA</span>
            <span className="text-base font-semibold text-gray-800">{formatCurrency(total)}</span>
          </div>
        </div>
      )}

      {/* Notas */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notas / N° de remisión</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Número de factura del proveedor, observaciones..."/>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
        <button onClick={handleConfirm} disabled={items.length === 0 || !supplierId}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
          Confirmar entrada de mercadería
        </button>
      </div>
    </div>
  )
}

export default function Purchases() {
  const { purchases, suppliers } = useStore()
  const [showForm, setShowForm] = useState(false)

  const enriched = useMemo(() =>
    purchases.map(p => ({
      ...p,
      supplierName: p.supplierName || suppliers.find(s => s.id === p.supplierId)?.name || '—'
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  , [purchases, suppliers])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-800">Compras a proveedor</h1>
          <p className="text-sm text-gray-400">{enriched.length} registros</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nueva entrada
        </button>
      </div>

      {enriched.length === 0 ? (
        <EmptyState icon="📦" title="Sin registros de compras"
          message="Registra la primera entrada de mercadería para actualizar el stock automáticamente."
          action={{ label: 'Registrar entrada', onClick: () => setShowForm(true) }}/>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Fecha</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Proveedor</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Productos</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Total</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {enriched.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDate(p.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">{p.supplierName}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{p.items?.length || 0}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-800">{formatCurrency(p.total || 0)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-semibold text-gray-800">Nueva entrada de mercadería</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <NewPurchaseForm onClose={() => setShowForm(false)}/>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
