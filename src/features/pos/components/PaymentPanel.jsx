/**
 * PaymentPanel.jsx — Panel de Cobro v3 (rediseño completo)
 * Ruta: src/features/pos/components/PaymentPanel.jsx
 *
 * MEJORAS vs v2:
 *  1. Flujo reducido de 8 pasos → 3 (pago simple en efectivo)
 *  2. Barra de progreso visual: "S/X pagado de S/Y" — pago mixto explícito
 *  3. Monto precargado automáticamente con el pendiente restante
 *  4. Métodos de pago en 1 fila compacta (4 principales + "Más")
 *  5. Pagos confirmados apilados en tarjetas verdes removibles
 *  6. Botón "Confirmar" activo SOLO cuando el total está cubierto
 *  7. LoyaltyBadge integrado con chip de descuento aplicado
 *  8. Pago crédito con validación de límite en tiempo real
 *  9. QR para Yape/Plin con código de operación
 * 10. Desglose de vuelto con denominaciones (calcBilletes)
 */

import { useState, useEffect, useRef } from 'react'
import { PAYMENT_METHODS, BILLETES_PEN } from '../../../config/app'
import { formatCurrency, calcBilletes } from '../../../shared/utils/helpers'
import toast from 'react-hot-toast'
import LoyaltyBadge from './LoyaltyBadge'
import { getClientLevel } from '../../../shared/utils/LoyaltyEngine'

// ─── Métodos principales (fila compacta) y secundarios (panel expandible) ─────
const MAIN_METHODS   = ['efectivo', 'yape', 'tarjeta', 'credito']
const HALF_UP = (n) => Math.floor(Number(n) * 100 + 0.5) / 100

export default function PaymentPanel({
  total,
  clients,
  onConfirm,
  processing,
  onClientChange,
  onLoyaltyRedeem,
}) {
  // ─── Estado ────────────────────────────────────────────────────────────────
  const [payments,          setPayments]          = useState([])
  const [currentMethod,     setCurrentMethod]     = useState('efectivo')
  const [currentAmount,     setCurrentAmount]     = useState('')
  const [currentRef,        setCurrentRef]        = useState('')
  const [clientId,          setClientId]          = useState(null)
  const [clientSearch,      setClientSearch]      = useState('')
  const [dniSearch,         setDniSearch]         = useState('')
  const [showClientDrop,    setShowClientDrop]    = useState(false)
  const [dniError,          setDniError]          = useState('')
  const [loyaltyDiscount,   setLoyaltyDiscount]   = useState(0)
  const [redeemedPoints,    setRedeemedPoints]    = useState(0)
  const [showMoreMethods,   setShowMoreMethods]   = useState(false)
  const amountRef = useRef(null)

  // ─── Derivados ──────────────────────────────────────────────────────────────
  const effectiveTotal = HALF_UP(Math.max(0, total - loyaltyDiscount))
  const paid           = HALF_UP(payments.reduce((a, p) => a + p.amount, 0))
  const remaining      = HALF_UP(Math.max(0, effectiveTotal - paid))
  const change         = paid > effectiveTotal ? HALF_UP(paid - effectiveTotal) : 0
  const progressPct    = effectiveTotal > 0 ? Math.min(100, Math.round((paid / effectiveTotal) * 100)) : 100
  const isComplete     = effectiveTotal <= 0 || paid >= effectiveTotal
  const isZeroTotal    = effectiveTotal <= 0

  const selectedClient   = clients.find(c => c.id === clientId) || null
  const creditAvailable  = selectedClient
    ? HALF_UP((selectedClient.creditLimit || 0) - (selectedClient.currentDebt || 0))
    : 0

  const methodConfig     = PAYMENT_METHODS.find(m => m.value === currentMethod)
  const filteredClients  = clients.filter(c =>
    clientSearch.trim().length >= 2 && (
      c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.documentNumber?.includes(clientSearch)
    )
  ).slice(0, 8)

  // Búsqueda exacta por DNI/RUC
  const handleDniSearch = () => {
    const q = dniSearch.trim()
    if (!q) return
    const found = clients.find(c =>
      c.documentNumber === q ||
      c.documentNumber?.replace(/\s/g,'') === q.replace(/\s/g,'')
    )
    if (found) {
      handleSelectClient(found)
      setDniError('')
    } else {
      setDniError(`No se encontró cliente con documento ${q}`)
    }
  }

  const mainMethods = PAYMENT_METHODS.filter(m => MAIN_METHODS.includes(m.value))
  const moreMethods = PAYMENT_METHODS.filter(m => !MAIN_METHODS.includes(m.value))

  // Precargar monto pendiente cuando se cambia de método
  useEffect(() => {
    if (remaining > 0) {
      setCurrentAmount(remaining.toFixed(2))
      setTimeout(() => amountRef.current?.select(), 50)
    } else {
      setCurrentAmount('')
    }
  }, [currentMethod, remaining])

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectClient = (c) => {
    setClientId(c.id)
    setClientSearch(c.name)
    setDniSearch(c.documentNumber || '')
    setDniError('')
    setShowClientDrop(false)
    onClientChange?.(c.id)
  }

  const handleClearClient = () => {
    setClientId(null)
    setClientSearch('')
    setDniSearch('')
    setDniError('')
    setLoyaltyDiscount(0)
    setRedeemedPoints(0)
    onClientChange?.(null)
  }

  const addPayment = () => {
    const amount = HALF_UP(parseFloat(currentAmount) || 0)
    if (amount <= 0)              { toast.error('Ingresa un monto válido'); return }
    if (isComplete)               { toast('El total ya está cubierto', { icon: 'ℹ️' }); return }
    if (currentMethod === 'credito') {
      if (!clientId)              { toast.error('Selecciona un cliente para crédito'); return }
      if (amount > creditAvailable) { toast.error(`Crédito disponible: ${formatCurrency(creditAvailable)}`); return }
    }
    if (methodConfig?.requiresRef && !currentRef.trim()) {
      toast.error(`Ingresa el ${methodConfig.refLabel}`); return
    }
    setPayments(prev => [...prev, { method: currentMethod, amount, reference: currentRef }])
    setCurrentRef('')
    setShowMoreMethods(false)
  }

  const removePayment = (idx) => setPayments(prev => prev.filter((_, i) => i !== idx))

  const handleQuick = (v) => setCurrentAmount(v.toFixed(2))

  const handleConfirm = () => {
    if (!isComplete) { toast.error(`Falta ${formatCurrency(remaining)} por cobrar`); return }
    if (isZeroTotal) {
      onConfirm({
        payments: payments.length > 0 ? payments
          : [{ method: 'ticket', amount: 0, reference: 'Cobertura total por ticket/puntos' }],
        clientId,
        change: 0,
        loyaltyDiscount,
        redeemedPoints,
      })
      return
    }
    onConfirm({ payments, clientId, change, loyaltyDiscount, redeemedPoints })
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter') addPayment() }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-slate-800">

      {/* ══ 1. CLIENTE ══════════════════════════════════════════════════════ */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-slate-700">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">
          Cliente (opcional)
        </p>

        {selectedClient ? (
          <div>
            {/* Cliente activo */}
            <div className="flex items-center gap-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5 mb-2">
              <div className="w-8 h-8 bg-blue-200 dark:bg-blue-800 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-200 shrink-0">
                {selectedClient.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">
                  {selectedClient.name}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {selectedClient.loyaltyLevel || 'Bronce'} · {(selectedClient.loyaltyPoints || 0).toLocaleString()} pts
                  {selectedClient.creditLimit > 0 && ` · Crédito: ${formatCurrency(creditAvailable)}`}
                </p>
              </div>
              <button onClick={handleClearClient}
                className="text-gray-400 hover:text-red-400 transition-colors text-sm font-bold px-1">
                ✕
              </button>
            </div>

            {/* Loyalty Badge */}
            <LoyaltyBadge
              client={selectedClient}
              saleTotal={effectiveTotal}
              onRedeem={(pts, discount) => {
                setRedeemedPoints(pts || 0)
                setLoyaltyDiscount(discount || 0)
                onLoyaltyRedeem?.(selectedClient.id, pts, discount)
                toast.success(`🎁 ${pts} pts canjeados → -${formatCurrency(discount)}`, { duration: 2500 })
              }}
            />

            {/* Chip de descuento por puntos */}
            {loyaltyDiscount > 0 && (
              <div className="mt-2 flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-1.5">
                <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">🎁 Canje de puntos</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    -{formatCurrency(loyaltyDiscount)}
                  </span>
                  <button
                    onClick={() => { setLoyaltyDiscount(0); setRedeemedPoints(0) }}
                    className="text-gray-400 hover:text-red-400 text-xs font-bold">✕</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            {/* ── Búsqueda PRIMARIA: por DNI / RUC / CE ─────────────────── */}
            <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
              Buscar por DNI / RUC / CE
            </p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={dniSearch}
                onChange={e => { setDniSearch(e.target.value); setDniError('') }}
                onKeyDown={e => e.key === 'Enter' && handleDniSearch()}
                placeholder="Ej: 12345678"
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                maxLength={15}
                autoFocus
              />
              <button onClick={handleDniSearch}
                className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors">
                Buscar
              </button>
            </div>
            {dniError && (
              <p className="text-xs text-red-500 dark:text-red-400 mb-2">⚠️ {dniError}</p>
            )}

            {/* ── Búsqueda ALTERNATIVA: por nombre ──────────────────────── */}
            <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
              O buscar por nombre
            </p>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true) }}
                onFocus={() => setShowClientDrop(true)}
                onBlur={() => setTimeout(() => setShowClientDrop(false), 180)}
                placeholder="Escribe el nombre..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
              />
              {showClientDrop && filteredClients.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl z-30 overflow-hidden max-h-56 overflow-y-auto">
                  <div className="px-3 py-1.5 border-b border-gray-100 dark:border-slate-700 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                    {filteredClients.length} resultado(s) — haz clic para seleccionar
                  </div>
                  {filteredClients.map(c => {
                    const lvl = getClientLevel(c.loyaltyAccumulated || 0)
                    return (
                      <button key={c.id} onMouseDown={() => handleSelectClient(c)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 border-b border-gray-50 dark:border-slate-700/50 last:border-0 text-left transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-slate-300 shrink-0">
                            {c.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{c.name}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500 font-mono">
                              {c.documentType} {c.documentNumber}
                              {(c.loyaltyPoints || 0) > 0 && ` · ${c.loyaltyPoints} pts`}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${lvl.badge}`}>
                          {lvl.icon} {lvl.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══ 2. TOTAL + PROGRESO DE PAGO MIXTO ═══════════════════════════════ */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">

        {/* Total y subtotal */}
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm font-semibold text-gray-600 dark:text-slate-400">Total a cobrar</span>
          <div className="text-right">
            <span className="text-xl font-black text-gray-900 dark:text-slate-100">
              {formatCurrency(effectiveTotal)}
            </span>
            {loyaltyDiscount > 0 && (
              <p className="text-xs text-gray-400 line-through leading-none">{formatCurrency(total)}</p>
            )}
          </div>
        </div>

        {/* Barra de progreso de pago mixto */}
        <div className="relative h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
              isComplete ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className={`font-medium ${paid > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
            {paid > 0 ? `${formatCurrency(paid)} pagado` : 'Sin pagos aún'}
          </span>
          {remaining > 0 && (
            <span className="text-gray-500 dark:text-slate-400">
              Pendiente: <span className="font-semibold text-gray-700 dark:text-slate-300">{formatCurrency(remaining)}</span>
            </span>
          )}
          {isComplete && paid > 0 && !isZeroTotal && (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Cubierto</span>
          )}
        </div>

        {/* Pagos confirmados apilados */}
        {payments.length > 0 && (
          <div className="mt-2 space-y-1">
            {payments.map((p, i) => {
              const m = PAYMENT_METHODS.find(m => m.value === p.method)
              return (
                <div key={i} className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-1.5">
                  <span className="text-sm">{m?.icon}</span>
                  <span className="flex-1 text-xs font-medium text-emerald-800 dark:text-emerald-300 truncate">
                    {m?.label}{p.reference ? ` — ${p.reference}` : ''}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(p.amount)}
                  </span>
                  <button onClick={() => removePayment(i)}
                    className="text-emerald-400 hover:text-red-400 transition-colors text-xs font-bold ml-1">
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Vuelto */}
        {change > 0 && (
          <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
            <div className="flex justify-between text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">
              <span>💵 Vuelto</span>
              <span>{formatCurrency(change)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {calcBilletes(change).map((b, i) => (
                <span key={i} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                  {b.count}×S/{b.denomination}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Cobertura por ticket/puntos */}
        {isZeroTotal && (
          <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            ✓ Total cubierto por ticket / canje de puntos
          </div>
        )}
      </div>

      {/* ══ 3. AGREGAR MÉTODO DE PAGO ════════════════════════════════════════ */}
      {!isZeroTotal && (
        <div className="px-4 py-3 flex-1 overflow-y-auto">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">
            {isComplete ? 'Pago completo ✓' : 'Agregar pago'}
          </p>

          {/* Fila compacta de métodos principales */}
          <div className="flex gap-2 mb-3">
            {mainMethods.map(pm => (
              <button key={pm.value} onClick={() => { setCurrentMethod(pm.value); setShowMoreMethods(false) }}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl border text-[10px] font-semibold transition-all ${
                  currentMethod === pm.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}>
                <span className="text-base leading-none">{pm.icon}</span>
                <span className="leading-tight mt-0.5">{pm.label}</span>
              </button>
            ))}
            {/* Botón "Más métodos" */}
            <button
              onClick={() => setShowMoreMethods(v => !v)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl border text-[10px] font-semibold transition-all ${
                showMoreMethods
                  ? 'border-gray-400 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200'
                  : 'border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-500 hover:border-gray-300'
              }`}>
              <span className="text-base leading-none">···</span>
              <span className="leading-tight mt-0.5">Más</span>
            </button>
          </div>

          {/* Panel de métodos secundarios (expandible) */}
          {showMoreMethods && (
            <div className="grid grid-cols-4 gap-2 mb-3 p-2 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
              {moreMethods.map(pm => (
                <button key={pm.value} onClick={() => { setCurrentMethod(pm.value); setShowMoreMethods(false) }}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border text-[10px] font-semibold transition-all ${
                    currentMethod === pm.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
                  }`}>
                  <span className="text-sm leading-none">{pm.icon}</span>
                  <span className="text-center leading-tight mt-0.5">{pm.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* QR para Yape / Plin */}
          {(currentMethod === 'yape' || currentMethod === 'plin') && (
            <div className="mb-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 flex items-center gap-3">
              <div className="w-14 h-14 bg-gray-200 dark:bg-slate-600 rounded-xl flex items-center justify-center text-2xl shrink-0">
                {currentMethod === 'yape' ? '💜' : '💙'}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">
                  Mostrar QR al cliente
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  Ingresa el código de operación abajo para confirmar
                </p>
              </div>
            </div>
          )}

          {/* Referencia (Yape, transferencia, etc.) */}
          {methodConfig?.requiresRef && (
            <input
              value={currentRef}
              onChange={e => setCurrentRef(e.target.value)}
              placeholder={methodConfig.refLabel}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 mb-2"
            />
          )}

          {/* Crédito: info de límite disponible */}
          {currentMethod === 'credito' && selectedClient && (
            <div className="mb-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400">
              Crédito disponible: <strong>{formatCurrency(creditAvailable)}</strong>
            </div>
          )}
          {currentMethod === 'credito' && !selectedClient && (
            <div className="mb-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400">
              ⚠ Selecciona un cliente para pago a crédito
            </div>
          )}

          {/* Campo de monto + botón agregar */}
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-slate-500 font-medium">S/</span>
              <input
                ref={amountRef}
                type="number"
                min="0"
                step="0.50"
                value={currentAmount}
                onChange={e => setCurrentAmount(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                placeholder={remaining > 0 ? remaining.toFixed(2) : '0.00'}
              />
            </div>
            <button
              onClick={addPayment}
              disabled={isComplete}
              className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              + Agregar
            </button>
          </div>

          {/* Botones rápidos */}
          {currentMethod === 'efectivo' && (
            <div className="grid grid-cols-5 gap-1.5">
              <button
                onClick={() => handleQuick(remaining)}
                className="col-span-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors font-medium">
                Exacto
              </button>
              {BILLETES_PEN.filter(b => b >= Math.ceil(remaining)).slice(0, 3).map(b => (
                <button key={b} onClick={() => handleQuick(b)}
                  className="py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                  S/{b}
                </button>
              ))}
            </div>
          )}
          {currentMethod === 'yape' || currentMethod === 'plin' ? (
            <div className="flex gap-1.5 mt-0">
              <button onClick={() => handleQuick(remaining)}
                className="flex-1 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors font-medium">
                Exacto ({formatCurrency(remaining)})
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* ══ 4. BOTÓN CONFIRMAR ═══════════════════════════════════════════════ */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
        {/* Indicador de estado antes de confirmar */}
        {!isComplete && !isZeroTotal && (
          <div className="flex items-center justify-between text-xs mb-2 px-1">
            <span className="text-gray-500 dark:text-slate-400">
              {payments.length === 0 ? 'Agrega al menos un método de pago' : `Pendiente: ${formatCurrency(remaining)}`}
            </span>
            <span className="text-gray-400 font-medium">{progressPct}%</span>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={processing || !isComplete}
          className={`w-full font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm ${
            isComplete && !processing
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 dark:shadow-none'
              : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
          }`}>
          {processing ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Procesando...
            </>
          ) : (
            <>
              {isComplete
                ? <span className="text-base leading-none">✅</span>
                : <span className="text-base leading-none">🔒</span>
              }
              <span>
                {isComplete ? 'Confirmar venta' : `Pendiente ${formatCurrency(remaining)}`}
              </span>
              {isComplete && <span className="opacity-60 text-xs">F8</span>}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
