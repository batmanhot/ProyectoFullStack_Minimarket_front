import { useState } from 'react'
import { PAYMENT_METHODS, BILLETES_PEN } from '../../../config/app'
import { formatCurrency, calcChange, calcBilletes } from '../../../shared/utils/helpers'
import toast from 'react-hot-toast'

export default function PaymentPanel({ total, clients, onConfirm, processing }) {
  const [payments, setPayments] = useState([])
  const [currentMethod, setCurrentMethod] = useState('efectivo')
  const [currentAmount, setCurrentAmount] = useState('')
  const [currentRef, setCurrentRef] = useState('')
  const [clientId, setClientId] = useState(null)
  const [clientSearch, setClientSearch] = useState('')
  const [showClientSearch, setShowClientSearch] = useState(false)

  const paid      = parseFloat(payments.reduce((a, p) => a + p.amount, 0).toFixed(2))
  const remaining = parseFloat((total - paid).toFixed(2))
  const change    = remaining < 0 ? Math.abs(remaining) : 0
  const isComplete = paid >= total

  const methodConfig = PAYMENT_METHODS.find(m => m.value === currentMethod)
  const filteredClients = clients.filter(c =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.documentNumber.includes(clientSearch)
  ).slice(0, 6)

  const selectedClient = clients.find(c => c.id === clientId)
  const creditAvailable = selectedClient
    ? parseFloat(((selectedClient.creditLimit || 0) - (selectedClient.currentDebt || 0)).toFixed(2))
    : 0

  const addPayment = () => {
    const amount = parseFloat(currentAmount)
    if (!amount || amount <= 0) { toast.error('Ingresa un monto válido'); return }
    if (currentMethod === 'credito') {
      if (!clientId) { toast.error('Selecciona un cliente para pago a crédito'); return }
      if (amount > creditAvailable) { toast.error(`Crédito disponible: ${formatCurrency(creditAvailable)}`); return }
    }
    if (methodConfig?.requiresRef && !currentRef.trim()) {
      toast.error(`Ingresa el ${methodConfig.refLabel}`); return
    }
    setPayments(prev => [...prev, { method: currentMethod, amount, reference: currentRef }])
    setCurrentAmount('')
    setCurrentRef('')
  }

  const removePayment = (idx) => setPayments(prev => prev.filter((_, i) => i !== idx))

  const handleConfirm = () => {
    if (!isComplete) { toast.error(`Falta ${formatCurrency(remaining)} por cobrar`); return }
    onConfirm({ payments, clientId, change })
  }

  const quickAmount = (v) => setCurrentAmount(v.toFixed(2))

  return (
    <div className="flex flex-col h-full">
      {/* Cliente */}
      <div className="p-3 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Cliente (opcional)</p>
        {selectedClient ? (
          <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
            <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-semibold text-blue-700">{selectedClient.name[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-800 truncate">{selectedClient.name}</div>
              {selectedClient.creditLimit > 0 && (
                <div className="text-xs text-blue-600">Crédito disp: {formatCurrency(creditAvailable)}</div>
              )}
            </div>
            <button onClick={() => { setClientId(null); setClientSearch('') }} className="text-gray-400 hover:text-red-400 text-xs">✕</button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={clientSearch}
              onChange={e => { setClientSearch(e.target.value); setShowClientSearch(true) }}
              onFocus={() => setShowClientSearch(true)}
              onBlur={() => setTimeout(() => setShowClientSearch(false), 200)}
              placeholder="Buscar cliente..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showClientSearch && filteredClients.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
                {filteredClients.map(c => (
                  <button key={c.id} onMouseDown={() => { setClientId(c.id); setClientSearch(c.name); setShowClientSearch(false) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0">
                    <div className="font-medium text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-400">{c.documentType} {c.documentNumber}{c.creditLimit > 0 ? ` · Crédito: ${formatCurrency(creditAvailable)}` : ''}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Total y pagos agregados */}
      <div className="p-3 border-b border-gray-100">
        <div className="flex justify-between text-sm font-semibold text-gray-800 mb-2">
          <span>Total a cobrar</span>
          <span>{formatCurrency(total)}</span>
        </div>
        {payments.map((p, i) => {
          const m = PAYMENT_METHODS.find(m => m.value === p.method)
          return (
            <div key={i} className="flex items-center gap-2 text-xs py-1">
              <span>{m?.icon}</span>
              <span className="flex-1 text-gray-600">{m?.label}{p.reference ? ` — ${p.reference}` : ''}</span>
              <span className="font-medium text-gray-800">{formatCurrency(p.amount)}</span>
              <button onClick={() => removePayment(i)} className="text-gray-300 hover:text-red-400">✕</button>
            </div>
          )
        })}
        {paid > 0 && (
          <div className={`flex justify-between text-sm font-medium mt-2 pt-2 border-t border-gray-100 ${isComplete ? 'text-green-600' : 'text-red-500'}`}>
            <span>{isComplete ? (change > 0 ? 'Vuelto' : '✓ Cobrado') : 'Pendiente'}</span>
            <span>{isComplete ? (change > 0 ? formatCurrency(change) : '') : formatCurrency(remaining)}</span>
          </div>
        )}
        {/* Desglose vuelto */}
        {change > 0 && (
          <div className="mt-1 text-xs text-gray-400">
            {calcBilletes(change).map((b, i) => (
              <span key={i} className="mr-2">{b.count}×S/{b.denomination}</span>
            ))}
          </div>
        )}
      </div>

      {/* Selector de método */}
      <div className="p-3 border-b border-gray-100 flex-1 overflow-y-auto">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Agregar pago</p>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {PAYMENT_METHODS.map(pm => (
            <button key={pm.value} onClick={() => setCurrentMethod(pm.value)}
              className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border text-xs font-medium transition-all ${currentMethod === pm.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              <span className="text-base">{pm.icon}</span>
              <span className="text-center leading-tight">{pm.label}</span>
            </button>
          ))}
        </div>

        {/* Monto */}
        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">S/</span>
            <input type="number" value={currentAmount} onChange={e => setCurrentAmount(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={remaining > 0 ? remaining.toFixed(2) : '0.00'} min="0" step="0.50" />
          </div>
          <button onClick={addPayment} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium">
            + Agregar
          </button>
        </div>

        {/* Referencia */}
        {methodConfig?.requiresRef && (
          <input value={currentRef} onChange={e => setCurrentRef(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            placeholder={methodConfig.refLabel} />
        )}

        {/* Botones rápidos (efectivo) */}
        {currentMethod === 'efectivo' && (
          <div className="grid grid-cols-5 gap-1.5">
            <button onClick={() => quickAmount(remaining)} className="py-1 text-xs border border-gray-200 rounded text-gray-600 hover:bg-gray-50 col-span-2">
              Exacto
            </button>
            {BILLETES_PEN.filter(b => b >= total).slice(0, 3).map(b => (
              <button key={b} onClick={() => quickAmount(b)} className="py-1 text-xs border border-gray-200 rounded text-gray-600 hover:bg-gray-50">
                S/{b}
              </button>
            ))}
          </div>
        )}

        {/* QR display Yape/Plin */}
        {(currentMethod === 'yape' || currentMethod === 'plin') && (
          <div className="mt-2 bg-gray-50 rounded-lg p-3 text-center">
            <div className="w-20 h-20 bg-gray-200 rounded-lg mx-auto mb-2 flex items-center justify-center text-2xl">
              {currentMethod === 'yape' ? '💜' : '💙'}
            </div>
            <p className="text-xs text-gray-500">Mostrar QR al cliente</p>
            <p className="text-xs text-gray-400">Luego ingresar el código de operación arriba</p>
          </div>
        )}
      </div>

      {/* Botón cobrar */}
      <div className="p-3">
        <button onClick={handleConfirm} disabled={processing || !isComplete}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
          {processing ? (
            <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Procesando...</>
          ) : (
            <><span>Confirmar venta</span><span className="opacity-60 text-xs">F8</span></>
          )}
        </button>
      </div>
    </div>
  )
}
