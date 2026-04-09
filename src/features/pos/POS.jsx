import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore, selectCartTotal, selectCartCount } from '../../store/index'
import { saleService } from '../../services/index'
import { calcCartTotals, fuzzySearch, formatCurrency } from '../../shared/utils/helpers'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { StockBadge, ExpiryBadge } from '../../shared/components/ui/Badge'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import PaymentPanel from './components/PaymentPanel'
import SaleTicket from './components/SaleTicket'
import toast from 'react-hot-toast'
import { evaluateDiscounts, isCampaignActive } from '../../shared/utils/discountEngine'

export default function POS() {
  const {
    products, cart, clients, discountCampaigns, currentUser, activeCashSession, systemConfig,
    redeemDiscountTicket,
    addToCart, updateCartItem, removeFromCart, clearCart,
  } = useStore()

  const cartTotal = useStore(selectCartTotal)
  const cartCount = useStore(selectCartCount)

  const [search, setSearch]               = useState('')
  const [showResults, setShowResults]     = useState(false)
  const [processing, setProcessing]       = useState(false)
  const [completedSale, setCompletedSale] = useState(null)
  const [showTicket, setShowTicket]       = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showPayment, setShowPayment]     = useState(false)
  const [showHistory, setShowHistory]     = useState(false)
  // Estado de descuento por ítem: { [key]: { value: string, pct: bool } }
  const [discountEdit, setDiscountEdit]   = useState({})
  const [globalDiscount, setGlobalDiscount] = useState('')
  const [ticketCode, setTicketCode]         = useState('')
  const [appliedTicket, setAppliedTicket]   = useState(null) // { ticket, discountAmt }
  const [ticketError, setTicketError]       = useState('')

  const searchRef  = useRef()
  const debouncedQ = useDebounce(search, 150)
  const totals     = calcCartTotals(cart)
  // Aplicar descuento global encima
  const globalDiscAmt = parseFloat(globalDiscount) || 0
  const finalTotal    = Math.max(0, parseFloat((totals.total - globalDiscAmt).toFixed(2)))
  const ticketDiscAmt = appliedTicket ? appliedTicket.discountAmt : 0
  const grandTotal    = Math.max(0, parseFloat((finalTotal - ticketDiscAmt).toFixed(2)))

  // ── Motor de descuentos automáticos ─────────────────────────────────────────
  const cartSubtotalRaw = totals.subtotal
  const { appliedDiscounts, modifiedCart: autoDiscountCart, totalSaving } = (() => {
    try {
      return evaluateDiscounts(cart, products, discountCampaigns || [], cartSubtotalRaw)
    } catch { return { appliedDiscounts: [], modifiedCart: cart, totalSaving: 0 } }
  })()
  const hasAutoDiscounts = appliedDiscounts.length > 0

  const activeProducts = products.filter(p => p.isActive)
  const searchResults  = debouncedQ.trim()
    ? fuzzySearch(debouncedQ, activeProducts, ['name','barcode','sku','description']).slice(0, 8)
    : []

  const { sales } = useStore()
  const sessionSales = activeCashSession
    ? sales.filter(s => s.status==='completada' && new Date(s.createdAt) >= new Date(activeCashSession.openedAt))
        .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0, 15)
    : []

  // Atajos teclado con ref pattern (fix stale closure)
  const actionsRef = useRef({})
  actionsRef.current = {
    focusSearch: () => searchRef.current?.focus(),
    clearSearch: () => { setSearch(''); setShowResults(false) },
    openPayment: () => { if (cart.length > 0 && activeCashSession) setShowPayment(true) },
    promptClear: () => { if (cart.length > 0) setShowClearConfirm(true) },
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.key==='F2')  { e.preventDefault(); actionsRef.current.focusSearch() }
      if (e.key==='Escape') actionsRef.current.clearSearch()
      if (e.key==='F8')  { e.preventDefault(); actionsRef.current.openPayment() }
      if (e.key==='Delete' && e.ctrlKey) { e.preventDefault(); actionsRef.current.promptClear() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSelectProduct = (product) => {
    if (product.stock <= 0) { toast.error(`${product.name} sin stock`); return }
    addToCart(product)
    setSearch(''); setShowResults(false)
    searchRef.current?.focus()
    toast.success(`${product.name} agregado`, { duration: 1000, icon: '✓' })
  }

  const handleUpdateQty = (key, newQty) => {
    const item    = cart.find(i => i._key===key || i.productId===key)
    const product = products.find(p => p.id===item?.productId)
    if (!product) return
    if (newQty <= 0) { removeFromCart(key); return }
    if (newQty > product.stock) { toast.error(`Stock disponible: ${product.stock}`); return }
    updateCartItem(key, { quantity: newQty })
  }

  // Aplicar descuento a un ítem del carrito
  const applyDiscount = (key, item) => {
    const ed = discountEdit[key]
    if (!ed) return
    const val = parseFloat(ed.value) || 0
    const discountAmt = ed.pct
      ? parseFloat((item.quantity * item.unitPrice * val / 100).toFixed(2))
      : val
    // Validar máximo según systemConfig
    const max = systemConfig?.maxDiscountPct ?? 50
    const pct = (discountAmt / (item.quantity * item.unitPrice)) * 100
    if (pct > max) { toast.error(`Descuento máximo permitido: ${max}%`); return }
    updateCartItem(key, { discount: discountAmt })
    setDiscountEdit(d => { const n={...d}; delete n[key]; return n })
    toast.success('Descuento aplicado', { duration: 1000 })
  }

  // Validar y pre-aplicar ticket (sin marcar como usado aún — se usa al completar la venta)
  const handleCheckTicket = () => {
    setTicketError('')
    if (!ticketCode.trim()) return
    const state = useStore.getState()
    const tickets = state.discountTickets || []
    const ticket  = tickets.find(t => t.code.toUpperCase() === ticketCode.trim().toUpperCase())
    if (!ticket) { setTicketError('Código no encontrado'); return }
    if (!ticket.isActive)  { setTicketError('Este ticket está desactivado'); return }
    if (ticket.used)        { setTicketError('Este ticket ya fue utilizado'); return }
    const now = new Date()
    if (ticket.validFrom && now < new Date(ticket.validFrom)) { setTicketError('El ticket aún no está vigente'); return }
    if (ticket.validTo && now > new Date(ticket.validTo + 'T23:59:59')) { setTicketError('El ticket ha vencido'); return }
    // Calcular descuento según el total actual
    let discountAmt = 0
    if (ticket.discountType === 'pct') {
      discountAmt = parseFloat((finalTotal * ticket.discountValue / 100).toFixed(2))
      if (ticket.maxAmount) discountAmt = Math.min(discountAmt, ticket.maxAmount)
    } else {
      discountAmt = Math.min(ticket.discountValue, finalTotal)
    }
    discountAmt = Math.max(0, parseFloat(discountAmt.toFixed(2)))
    setAppliedTicket({ ticket, discountAmt })
    toast.success(`✅ Ticket válido · Descuento: S/${discountAmt.toFixed(2)}`, { duration: 3000 })
  }

  const handleRemoveTicket = () => { setAppliedTicket(null); setTicketCode(''); setTicketError('') }

  const handleCompleteSale = useCallback(async ({ payments, clientId, change }) => {
    setProcessing(true)
    const { getNextInvoice } = useStore.getState()
    const salePayload = {
      invoiceNumber: getNextInvoice(),
      clientId:      clientId || null,
      userId:        currentUser?.id,
      userName:      currentUser?.fullName,
      items:         cart,
      ...totals,
      total:         grandTotal,
      discount:      parseFloat((totals.discount + globalDiscAmt + (appliedTicket?.discountAmt||0)).toFixed(2)),
      ticketCode:    appliedTicket?.ticket?.code || null,
      ticketDiscount:appliedTicket?.discountAmt  || 0,
      payments,
      change: change || 0,
    }
    const result = await saleService.create(salePayload)
    setProcessing(false)
    if (result.error) { toast.error(result.error); return }
    // Canjear el ticket en el store (marcar como usado)
    if (appliedTicket?.ticket) {
      redeemDiscountTicket(appliedTicket.ticket.code, result.data?.id, grandTotal, currentUser?.id)
      setAppliedTicket(null); setTicketCode(''); setTicketError('')
    }

    const afterProducts = useStore.getState().products
    const lowAfterSale  = salePayload.items
      .map(i => afterProducts.find(p => p.id===i.productId))
      .filter(p => p && p.stock<=p.stockMin)
    if (lowAfterSale.length > 0)
      toast(`⚠️ Stock bajo: ${lowAfterSale.map(p=>p.name).join(', ')}`, { duration: 5000 })

    setShowPayment(false)
    setGlobalDiscount('')
    setDiscountEdit({})
    setCompletedSale(result.data)
    setShowTicket(true)
    toast.success(`Venta ${result.data.invoiceNumber} completada`, { duration: 3000, icon: '🎉' })
  }, [cart, totals, finalTotal, globalDiscAmt, currentUser])

  const discountsEnabled = systemConfig?.allowDiscounts !== false
  const maxDiscPct = systemConfig?.maxDiscountPct ?? 50

  if (!activeCashSession) {
    return (
      <EmptyState icon="🔐" title="Caja no abierta" message="Debes aperturar la caja antes de realizar ventas."
        action={{ label: 'Ir a Caja', onClick: () => {} }}/>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* Panel izquierdo: búsqueda + carrito */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Búsqueda */}
        <div className="p-3 border-b border-gray-100 bg-white relative z-10">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input ref={searchRef} value={search}
              onChange={e => { setSearch(e.target.value); setShowResults(true) }}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              placeholder="Buscar por nombre, código o SKU... (F2)" autoFocus/>
            {search && <button onClick={() => { setSearch(''); setShowResults(false) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
          </div>

          {showResults && searchResults.length > 0 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-20">
              {searchResults.map(product => (
                <button key={product.id} onClick={() => handleSelectProduct(product)} disabled={product.stock===0}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 last:border-b-0 disabled:opacity-40">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{product.name}</div>
                    <div className="text-xs text-gray-400">{product.barcode}{product.sku ? ` · ${product.sku}` : ''}{product.location ? ` · 📍${product.location}` : ''}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-blue-600">{formatCurrency(product.priceSell)}<span className="text-xs font-normal text-gray-400"> /{product.unit}</span></div>
                    <div className="flex gap-1 justify-end mt-0.5"><StockBadge product={product}/><ExpiryBadge product={product}/></div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="text-5xl opacity-20">🛒</div>
              <p className="text-gray-400 text-sm">Busca un producto para comenzar</p>
              <p className="text-gray-300 text-xs">F2 buscar · F8 cobrar · Ctrl+Del vaciar</p>
            </div>
          ) : cart.map(item => {
            const key = item._key || item.productId
            const ed  = discountEdit[key]
            return (
              <div key={key} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{item.productName}</div>
                    <div className="text-xs text-gray-400">{formatCurrency(item.unitPrice)} /{item.unit||'u'}</div>
                  </div>
                  {/* Descuento aplicado */}
                  {item.discount > 0 && (
                    <div className="text-xs text-green-600 font-medium whitespace-nowrap">-{formatCurrency(item.discount)}</div>
                  )}
                  {/* Controles cantidad */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleUpdateQty(key, item.quantity-1)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg text-lg leading-none">−</button>
                    <button onClick={() => { const v=prompt('Cantidad:',item.quantity); if(v!==null) handleUpdateQty(key,parseFloat(v)||0) }} className="w-10 text-center text-sm font-medium text-gray-800 hover:bg-gray-100 rounded px-1 py-0.5">
                      {item.quantity}
                    </button>
                    <button onClick={() => handleUpdateQty(key, item.quantity+1)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg text-lg leading-none">+</button>
                  </div>
                  <div className="text-sm font-semibold text-gray-800 w-20 text-right">{formatCurrency(item.subtotal)}</div>
                  {/* Botón descuento por ítem */}
                  {discountsEnabled && (
                    <button onClick={() => setDiscountEdit(d => d[key] ? (()=>{const n={...d};delete n[key];return n})() : {...d, [key]:{value:'',pct:true}})}
                      className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${ed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700'}`}
                      title="Aplicar descuento">%</button>
                  )}
                  <button onClick={() => removeFromCart(key)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>

                {/* Panel de descuento por ítem (desplegable) */}
                {ed && discountsEnabled && (
                  <div className="px-3 pb-3 bg-amber-50 border-t border-amber-100">
                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-xs text-amber-700 font-medium">Descuento:</span>
                      <input type="number" min="0" step="0.01" value={ed.value} onChange={e => setDiscountEdit(d => ({...d,[key]:{...d[key],value:e.target.value}}))}
                        className="w-24 px-2 py-1 border border-amber-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white" placeholder="0"/>
                      <button onClick={() => setDiscountEdit(d => ({...d,[key]:{...d[key],pct:!d[key].pct}}))
                      } className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${ed.pct ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                        {ed.pct ? `% (máx ${maxDiscPct}%)` : 'S/'}
                      </button>
                      <button onClick={() => applyDiscount(key, item)} className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-semibold hover:bg-amber-700">Aplicar</button>
                      <button onClick={() => updateCartItem(key, {discount:0})} className="text-xs text-gray-400 hover:text-red-400">Quitar</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Atajos */}
        <div className="px-4 py-2 bg-white border-t border-gray-100 flex gap-4 text-xs text-gray-300 flex-wrap">
          <span>F2 Buscar</span><span>F8 Cobrar</span><span>Ctrl+Del Vaciar</span><span>% Descuento por ítem</span>
        </div>
      </div>

      {/* Panel derecho: totales + cobro */}
      <div className="w-80 bg-white border-l border-gray-100 flex flex-col flex-shrink-0">

        {/* Totales */}
        <div className="p-4 border-b border-gray-100 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal ({cartCount} items)</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Descuento ítems</span><span>-{formatCurrency(totals.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-500">
            <span>IGV (18%)</span><span>{formatCurrency(totals.tax)}</span>
          </div>

          {/* Descuento global */}
          {discountsEnabled && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-gray-500 whitespace-nowrap">Dto. global S/</span>
              <input type="number" min="0" step="0.50" value={globalDiscount}
                onChange={e => setGlobalDiscount(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 text-right"
                placeholder="0.00"/>
              {globalDiscAmt > 0 && <button onClick={() => setGlobalDiscount('')} className="text-xs text-red-400 hover:text-red-500">✕</button>}
            </div>
          )}
          {globalDiscAmt > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Descuento global</span><span>-{formatCurrency(globalDiscAmt)}</span>
            </div>
          )}

          {/* ── Campo de Ticket de Descuento ──────────────────────────── */}
          <div className="pt-2 border-t border-dashed border-gray-200">
            <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">🎟️ Ticket de descuento</p>
            {!appliedTicket ? (
              <div className="space-y-1">
                <div className="flex gap-1.5">
                  <input
                    value={ticketCode}
                    onChange={e => { setTicketCode(e.target.value.toUpperCase()); setTicketError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleCheckTicket()}
                    placeholder="Ingresa el código..."
                    className="flex-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50/50 placeholder:normal-case"
                  />
                  <button onClick={handleCheckTicket} disabled={!ticketCode.trim() || cart.length === 0}
                    className="px-3 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 disabled:opacity-40 whitespace-nowrap">
                    Validar
                  </button>
                </div>
                {ticketError && <p className="text-xs text-red-500 flex items-center gap-1">⚠️ {ticketError}</p>}
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-green-600 text-base">✅</span>
                      <code className="font-mono font-bold text-green-700 text-xs tracking-widest">{appliedTicket.ticket.code}</code>
                    </div>
                    <p className="text-xs text-green-700 font-medium">{appliedTicket.ticket.holderName}</p>
                    <p className="text-xs text-green-600">
                      {appliedTicket.ticket.discountType === 'pct'
                        ? `${appliedTicket.ticket.discountValue}% → -${formatCurrency(appliedTicket.discountAmt)}`
                        : `Vale S/${appliedTicket.ticket.discountValue}`}
                    </p>
                    {appliedTicket.ticket.campaignName && <p className="text-xs text-green-500 italic">{appliedTicket.ticket.campaignName}</p>}
                  </div>
                  <button onClick={handleRemoveTicket} className="text-gray-400 hover:text-red-400 flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Descuento por ticket */}
          {ticketDiscAmt > 0 && (
            <div className="flex justify-between text-sm font-medium text-green-600">
              <span>🎟️ Descuento ticket</span><span>-{formatCurrency(ticketDiscAmt)}</span>
            </div>
          )}

          <div className="flex justify-between text-xl font-bold text-gray-800 pt-2 border-t border-gray-100">
            <span>TOTAL</span><span>{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        {/* Descuentos automáticos aplicados */}
        {hasAutoDiscounts && (
          <div className="px-4 py-3 border-b border-green-100 bg-green-50">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-semibold text-green-700">🏷️ Descuentos automáticos activos</span>
            </div>
            {appliedDiscounts.map((d, i) => (
              <div key={i} className="flex justify-between text-xs text-green-700 mb-1">
                <span className="flex items-center gap-1"><span>{d.icon}</span><span className="truncate max-w-[140px]">{d.name}</span></span>
                <span className="font-semibold text-green-600 whitespace-nowrap">-{formatCurrency(d.saving)}</span>
              </div>
            ))}
            <div className="border-t border-green-200 pt-1.5 mt-1.5 flex justify-between text-xs font-bold text-green-700">
              <span>Ahorro total</span>
              <span>-{formatCurrency(totalSaving)}</span>
            </div>
          </div>
        )}

        {/* Historial turno */}
        <div className="border-b border-gray-100">
          <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors">
            <span>Ventas del turno ({sessionSales.length})</span>
            <span>{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="max-h-44 overflow-y-auto px-3 pb-2 space-y-1">
              {sessionSales.length===0
                ? <p className="text-xs text-gray-400 text-center py-3">Sin ventas aún</p>
                : sessionSales.map(s => (
                  <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-gray-600">{s.invoiceNumber}</div>
                      <div className="text-gray-400">{s.items?.length} items</div>
                    </div>
                    <span className="font-medium text-gray-800">{formatCurrency(s.total)}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="p-4 mt-auto space-y-2">
          {cart.length > 0 && (
            <button onClick={() => setShowClearConfirm(true)} className="w-full py-2 text-sm text-gray-400 hover:text-red-400 transition-colors border border-gray-100 rounded-lg hover:border-red-100">
              Vaciar carrito
            </button>
          )}
          <button onClick={() => setShowPayment(true)} disabled={cart.length===0}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
            <span>Cobrar</span><span className="opacity-60 text-xs">F8</span>
          </button>
        </div>
      </div>

      {/* Panel de pago */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40">
          <div className="bg-white h-full w-96 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Cobrar venta</h2>
              <button onClick={() => setShowPayment(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <PaymentPanel total={grandTotal} clients={clients} onConfirm={handleCompleteSale} processing={processing}/>
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <ConfirmModal title="¿Vaciar el carrito?" message="Se eliminarán todos los productos del carrito." confirmLabel="Vaciar" variant="danger"
          onConfirm={() => { clearCart(); setShowClearConfirm(false); setGlobalDiscount(''); setDiscountEdit({}) }}
          onCancel={() => setShowClearConfirm(false)}/>
      )}

      {showTicket && completedSale && (
        <SaleTicket sale={completedSale} onClose={() => { setShowTicket(false); setCompletedSale(null) }}/>
      )}
    </div>
  )
}
