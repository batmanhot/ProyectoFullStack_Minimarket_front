import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore, selectCartCount } from '../../store/index'
import { saleService } from '../../services/index'
import { calcCartTotals, fuzzySearch, formatCurrency } from '../../shared/utils/helpers'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { StockBadge, ExpiryBadge } from '../../shared/components/ui/Badge'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import PaymentPanel from './components/PaymentPanel'
import SaleTicket from './components/SaleTicket'
import toast from 'react-hot-toast'
import { evaluateDiscounts } from '../../shared/utils/discountEngine'
// ── F5: LoyaltyBadge ahora vive dentro de PaymentPanel (donde es visible) ────
// import LoyaltyBadge from './components/LoyaltyBadge'  ← ya no necesario aquí
// ─────────────────────────────────────────────────────────────────────────────
// ── F2: Hold / Suspender venta ───────────────────────────────────────────────
import { useCartHold }    from './hooks/useCartHold'
import HeldCartsPanel     from './components/HeldCartsPanel'
// ────────────────────────────────────────────────────────────────────────────

export default function POS() {
  const {
    products, cart, clients, discountCampaigns, currentUser, activeCashSession, systemConfig, businessConfig,
    redeemDiscountTicket,
    addToCart, updateCartItem, removeFromCart, clearCart,
  } = useStore()

  const cartCount = useStore(selectCartCount)

  const [search, setSearch]               = useState('')
  const [showResults, setShowResults]     = useState(false)
  const [processing, setProcessing]       = useState(false)
  // ── F5: cliente seleccionado en el panel de pago (para mostrar sus puntos) ─
  const [selectedClientId, setSelectedClientId] = useState(null)
  const selectedClient = clients.find(c => c.id === selectedClientId) || null
  // ──────────────────────────────────────────────────────────────────────────

  // ── F2: Hold / Suspender ventas ─────────────────────────────────────────────
  // Permite guardar el carrito actual y empezar una nueva venta.
  // Máximo 5 slots en memoria (se pierden al recargar la página).
  const { heldCarts, holdCart, recoverCart, discardHold, canHold } = useCartHold()
  const [showHeldCarts, setShowHeldCarts] = useState(false)

  const handleHoldCart = () => {
    if (cart.length === 0) { toast('El carrito está vacío', { icon: 'ℹ️' }); return }
    if (!canHold)          { toast.error('Máximo 5 ventas en espera'); return }
    // Nombre del cliente activo como label del hold (si hay uno)
    const label = selectedClient?.name || ''
    const id    = holdCart(cart, label)
    if (id) {
      clearCart()
      setGlobalDiscount('')
      setDiscountEdit({})
      setSelectedClientId(null)
      toast.success('Venta suspendida — puedes atender otro cliente', { icon: '⏸️', duration: 2500 })
    }
  }

  const handleRecoverCart = (holdId) => {
    // recoverCart (Zustand) es SÍNCRONO — devuelve los ítems en el mismo ciclo
    // y ya eliminó el hold del store antes de retornar.
    const items = recoverCart(holdId)
    if (!items || items.length === 0) {
      toast.error('No se pudo recuperar la venta')
      return
    }

    // Restaurar carrito completo con todos los campos originales
    // (unitPrice, discount, _key, subtotal, etc.)
    const restoredItems = items.map(item => ({
      ...item,
      _key: item._key || item.productId,
      id:   crypto.randomUUID(),
    }))

    useStore.setState({ cart: restoredItems })
    setShowHeldCarts(false)

    toast.success(
      `Venta recuperada — ${restoredItems.length} producto(s) cargados al carrito`,
      { icon: '▶️', duration: 2500 }
    )
  }
  // ──────────────────────────────────────────────────────────────────────────
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

  // ── Motor de descuentos automáticos MEJORADO ────────────────────────────────
  const autoDiscountResult = (() => {
    try {
      return evaluateDiscounts(cart, products, discountCampaigns || [])
    } catch {
      return {
        itemDiscounts: cart.map(item => ({ ...item, campaignDiscount: 0, netTotal: item.subtotal, discountDetails: [] })),
        globalDiscounts: [],
        totalCampaignSaving: 0,
        summary: { byItem: 0, byGlobal: 0, total: 0 }
      }
    }
  })()

  // Merge descuentos manuales con automáticos
  const mergedCartItems = cart.map(cartItem => {
    const autoItem = autoDiscountResult.itemDiscounts.find(i => 
      (i._key === cartItem._key || i.productId === cartItem.productId)
    ) || { campaignDiscount: 0, netTotal: cartItem.subtotal, discountDetails: [] }
    
    const manualDiscount = cartItem.discount || 0
    const totalDiscount = autoItem.campaignDiscount + manualDiscount
    const netTotal = autoItem.netTotal - manualDiscount // campaña primero, luego manual
    
    return {
      ...cartItem,
      ...autoItem,
      manualDiscount,
      totalDiscount,
      netTotal: parseFloat(netTotal.toFixed(2))
    }
  })

  const totalCampaignSaving = autoDiscountResult.totalCampaignSaving
  const totalManualDiscount = mergedCartItems.reduce((a, i) => a + (i.manualDiscount || 0), 0)
  const totalItemDiscounts  = mergedCartItems.reduce((a, i) => a + i.totalDiscount, 0)
  // Regla 1: Subtotal Bruto = suma columna SUBTOTAL (unitPrice × qty, sin descuentos)
  const subtotalBruto    = parseFloat(mergedCartItems.reduce((a, i) => a + i.subtotal, 0).toFixed(2))
  // Regla 2: Descuentos Totales = suma columna DESCUENTO + dto. global + ticket
  const totalDescuentos  = parseFloat((totalItemDiscounts + globalDiscAmt + ticketDiscAmt).toFixed(2))
  // Regla 1: Total a Pagar = Subtotal Bruto - Descuentos Totales
  const totalAPagar      = parseFloat(Math.max(0, subtotalBruto - totalDescuentos).toFixed(2))
  // IGV está incluido en el precio → descomposición: Base = TotalAPagar / (1 + igvRate)
  const igvRate          = parseFloat(systemConfig?.igvRate ?? businessConfig?.igvRate ?? 0.18)
  const igvFactor        = 1 + igvRate
  const baseImponible    = parseFloat((totalAPagar / igvFactor).toFixed(2))
  const igvCalculado     = parseFloat((totalAPagar - baseImponible).toFixed(2))
  const totalFinal       = totalAPagar   // Total a Pagar ya incluye IGV

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

  useEffect(() => {
    actionsRef.current = {
      focusSearch: () => searchRef.current?.focus(),
      clearSearch: () => { setSearch(''); setShowResults(false) },
      openPayment: () => { if (cart.length > 0 && activeCashSession) setShowPayment(true) },
      promptClear: () => { if (cart.length > 0) setShowClearConfirm(true) },
    }

    const handler = (e) => {
      if (e.key==='F2')  { e.preventDefault(); actionsRef.current.focusSearch() }
      if (e.key==='Escape') actionsRef.current.clearSearch()
      if (e.key==='F8')  { e.preventDefault(); actionsRef.current.openPayment() }
      if (e.key==='Delete' && e.ctrlKey) { e.preventDefault(); actionsRef.current.promptClear() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cart.length, activeCashSession])

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

  const handleCompleteSale = useCallback(async ({ payments, clientId, change, loyaltyDiscount = 0, redeemedPoints = 0 }) => {
    setProcessing(true)
    const { getNextInvoice } = useStore.getState()
    const salePayload = {
        invoiceNumber: getNextInvoice(),
        clientId:      clientId || null,
        userId:        currentUser?.id,
        userName:      currentUser?.fullName,
        items:         mergedCartItems,   // ← FIX: contiene campaignDiscount, totalDiscount, netTotal
        subtotalBruto,
        totalDescuentos,
        total:          totalAPagar,
        baseImponible,
        igv:            igvCalculado,
        igvRate,
        discount:       totalDescuentos,
        ticketCode:     appliedTicket?.ticket?.code || null,
        ticketDiscount: appliedTicket?.discountAmt  || 0,
        payments,
        change: change || 0,
        loyaltyDiscount,
        redeemedPoints,
      }
    const result = await saleService.create(salePayload)
    setProcessing(false)
    if (result.error) { toast.error(result.error); return }
    // Canjear el ticket en el store (marcar como usado)
    if (appliedTicket?.ticket) {
      redeemDiscountTicket(appliedTicket.ticket.code, result.data?.id, totalAPagar, currentUser?.id)
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
    setSelectedClientId(null)  // F5: limpiar cliente al completar venta
    setCompletedSale(result.data)
    setShowTicket(true)
    toast.success(`Venta ${result.data.invoiceNumber} completada`, { duration: 3000, icon: '🎉' })
  }, [
    appliedTicket,
    baseImponible,
    cart,
    currentUser,
    igvCalculado,
    igvRate,
    redeemDiscountTicket,
    subtotalBruto,
    totalAPagar,
    totalDescuentos,
  ])

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

        {/* ── CARRITO ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Cabecera de columnas — fuera del scroll, siempre visible */}
          {cart.length > 0 && (
            <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 shrink-0">
              <div className="grid items-center gap-2" style={{gridTemplateColumns:'1fr 96px 88px 96px 96px 60px'}}>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide pl-1">Producto</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Cant.</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Subtotal</span>
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide text-right">Descuento</span>
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide text-right">Total</span>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Acc.</span>
              </div>
            </div>
          )}

          {/* Lista scrolleable */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <div className="text-5xl opacity-20">🛒</div>
              <p className="text-gray-400 text-sm">Busca un producto para comenzar</p>
              <p className="text-gray-300 text-xs">F2 buscar · F8 cobrar · Ctrl+Del vaciar</p>
            </div>
          ) : (
            <div className="p-3 space-y-1.5">

              {/* Filas de productos */}
              {mergedCartItems.map(item => {
                const key      = item._key || item.productId
                const ed       = discountEdit[key]
                const hasDisc  = item.totalDiscount > 0
                const hasCamp  = item.campaignDiscount > 0
                return (
                  <div key={key} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all overflow-hidden">

                    {/* Fila principal */}
                    <div className="grid items-center gap-2 px-3 py-2.5" style={{gridTemplateColumns:'1fr 96px 88px 96px 96px 60px'}}>

                      {/* 1. Producto */}
                      <div className="min-w-0 pl-1">
                        <p className="text-sm font-semibold text-gray-800 leading-tight truncate">{item.productName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatCurrency(item.unitPrice)}
                          <span className="text-gray-300"> /{item.unit || 'und'}</span>
                        </p>
                        {hasCamp && item.discountDetails?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.discountDetails.map((d, i) => (
                              <span key={i} className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full leading-none">
                                🏷️ {d.campaignName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 2. Cantidad */}
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleUpdateQty(key, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-all text-sm font-bold leading-none">
                          −
                        </button>
                        <span className="w-7 text-center text-sm font-bold text-gray-800">{item.quantity}</span>
                        <button onClick={() => handleUpdateQty(key, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 transition-all text-sm font-bold leading-none">
                          +
                        </button>
                      </div>

                      {/* 3. Subtotal */}
                      <div className="text-right">
                        <span className="text-sm text-gray-500">{formatCurrency(item.subtotal)}</span>
                      </div>

                      {/* 4. Descuento */}
                      <div className="text-right">
                        {hasDisc ? (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span className="text-sm font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 leading-tight">
                              -{formatCurrency(item.totalDiscount)}
                            </span>
                            {hasCamp && item.manualDiscount > 0 && <span className="text-[10px] text-gray-400 leading-none">campaña+manual</span>}
                            {hasCamp && !item.manualDiscount && <span className="text-[10px] text-amber-500 leading-none">campaña</span>}
                            {!hasCamp && item.manualDiscount > 0 && <span className="text-[10px] text-gray-400 leading-none">manual</span>}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-300">—</span>
                        )}
                      </div>

                      {/* 5. Total neto */}
                      <div className="text-right">
                        <span className={`text-sm font-bold ${hasDisc ? 'text-emerald-700' : 'text-gray-800'}`}>
                          {formatCurrency(item.netTotal)}
                        </span>
                        {hasDisc && (
                          <p className="text-[10px] text-gray-300 line-through leading-none mt-0.5">
                            {formatCurrency(item.subtotal)}
                          </p>
                        )}
                      </div>

                      {/* 6. Acciones */}
                      <div className="flex items-center justify-center gap-1">
                        {discountsEnabled && (
                          <button
                            onClick={() => setDiscountEdit(d => d[key]
                              ? (()=>{const n={...d};delete n[key];return n})()
                              : {...d,[key]:{value:'',pct:true}}
                            )}
                            title="Descuento manual"
                            className={`w-6 h-6 flex items-center justify-center rounded-md text-xs font-bold border transition-all ${
                              ed ? 'bg-amber-500 text-white border-amber-500' : 'text-gray-400 border-gray-200 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-300'
                            }`}>%</button>
                        )}
                        <button onClick={() => removeFromCart(key)}
                          title="Eliminar"
                          className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-all">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Panel descuento manual */}
                    {ed && discountsEnabled && (
                      <div className="mx-3 mb-2.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-amber-700 whitespace-nowrap shrink-0">Dto. manual:</span>
                          <input
                            type="number" min="0" max={item.subtotal} step="0.01"
                            value={ed.value}
                            onChange={e => setDiscountEdit(d => ({...d,[key]:{...d[key],value:e.target.value}}))}
                            className="flex-1 px-2 py-1 border border-amber-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white text-right min-w-0"
                            placeholder="0.00" autoFocus/>
                          <button
                            onClick={() => setDiscountEdit(d => ({...d,[key]:{...d[key],pct:!d[key].pct}}))}
                            className={`px-2 py-1 rounded text-xs font-semibold border shrink-0 transition-all ${ed.pct ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                            {ed.pct ? '%' : 'S/'}
                          </button>
                          <button
                            onClick={() => applyDiscount(key, item)}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 transition-colors shrink-0">
                            Aplicar
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-1.5 text-xs text-amber-600">
                          <span>Preview: <strong>-S/{(ed.pct ? item.subtotal*(parseFloat(ed.value)||0)/100 : parseFloat(ed.value)||0).toFixed(2)}</strong>
                            {ed.pct && <span className="text-amber-400 ml-1">(máx {maxDiscPct}%)</span>}
                          </span>
                          {item.manualDiscount > 0 && (
                            <button onClick={() => updateCartItem(key, {discount:0})}
                              className="text-red-400 hover:text-red-500 font-medium">Quitar</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Atajos */}
        <div className="px-4 py-2 bg-white border-t border-gray-100 flex gap-4 text-xs text-gray-300 flex-wrap">
          <span>F2 Buscar</span><span>F8 Cobrar</span><span>Ctrl+Del Vaciar</span><span>% Descuento por ítem</span>
        </div>
      </div>

      </div>

      {/* Panel derecho: totales + cobro */}
      <div className="w-80 bg-white border-l border-gray-100 flex flex-col flex-shrink-0">

  {/* ── HEADER DE LA COLUMNA ─────────────────────────────────── */}
  <div className="px-4 py-3 bg-blue-600 text-white">
    <div className="flex items-center gap-2">
      <svg className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"/>
      </svg>
      <div>
        <h2 className="text-sm font-bold tracking-wide uppercase">Resumen de Venta</h2>
        <p className="text-xs text-blue-200 mt-0.5">{cartCount} producto{cartCount !== 1 ? 's' : ''} en carrito</p>
      </div>
    </div>
  </div>

  {/* ── TOTALES ──────────────────────────────────────────────── */}
  <div className="p-4 border-b border-gray-100 space-y-3">

    {/* LÍNEA 1 — SUBTOTAL BRUTO (REQ #5) */}
    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
      <span className="text-sm text-gray-600 font-semibold">Subtotal Bruto</span>
      <span className="text-lg font-bold text-gray-800">
        {formatCurrency(subtotalBruto)}
      </span>
    </div>

    {/* LÍNEA 2 — DESGLOSE DESCUENTOS (REQ #2) */}
    <div className="rounded-xl border border-dashed border-green-200 bg-green-50 p-3 space-y-2">
      <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1">
        🏷️ Descuentos totales: -{formatCurrency(totalItemDiscounts + globalDiscAmt + autoDiscountResult.summary.byGlobal)}
      </p>

      {/* Por ítems */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-green-600 font-medium">
          <span>Por productos:</span>
          <span>-{formatCurrency(totalItemDiscounts)}</span>
        </div>
        {totalCampaignSaving > 0 && (
          <div className="flex justify-between text-xs text-green-600 pl-4">
            <span>• Campañas: {formatCurrency(autoDiscountResult.summary.byItem)}</span>
            <span>• Globales: {formatCurrency(autoDiscountResult.summary.byGlobal)}</span>
          </div>
        )}
        {totalManualDiscount > 0 && (
          <div className="flex justify-between text-xs text-amber-600 pl-4">
            <span>• Manuales: {formatCurrency(totalManualDiscount)}</span>
            <span />
          </div>
        )}
      </div>

      {/* Descuento global input */}
      {discountsEnabled && (
        <div className="flex items-center gap-2 pt-2 border-t border-green-200">
          <span className="text-xs text-green-700 whitespace-nowrap font-medium">Dto. global adicional:</span>
          <input
            type="number" min="0" step="0.50"
            value={globalDiscount}
            onChange={e => setGlobalDiscount(e.target.value)}
            className="flex-1 px-2 py-1 border border-green-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-400 text-right bg-white"
            placeholder="0.00"
          />
          {globalDiscAmt > 0 && (
            <button onClick={() => setGlobalDiscount('')}
              className="text-xs text-red-400 hover:text-red-500 font-bold px-1">✕</button>
          )}
        </div>
      )}

      {autoDiscountResult.globalDiscounts.length > 0 && (
        <div className="text-xs text-green-600 space-y-0.5 max-h-16 overflow-y-auto">
          {autoDiscountResult.globalDiscounts.map((d, i) => (
            <div key={i} className="flex items-center gap-1 truncate">
              <span>{d.icon}</span><span className="truncate">{d.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* LÍNEA 3 — TICKET DE DESCUENTO */}
    <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-3">
      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">
        🎟️ Ticket de descuento
      </p>
      {!appliedTicket ? (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <input
              value={ticketCode}
              onChange={e => { setTicketCode(e.target.value.toUpperCase()); setTicketError('') }}
              onKeyDown={e => e.key === 'Enter' && handleCheckTicket()}
              placeholder="Ingresa el código..."
              className="flex-1 px-2.5 py-2 border border-amber-300 rounded-lg text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white placeholder:normal-case"
            />
            <button
              onClick={handleCheckTicket}
              disabled={!ticketCode.trim() || cart.length === 0}
              className="px-3 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 disabled:opacity-40 whitespace-nowrap transition-colors">
              Validar
            </button>
          </div>
          {ticketError && (
            <p className="text-xs text-red-500 flex items-center gap-1">⚠️ {ticketError}</p>
          )}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-green-600 text-base">✅</span>
                <code className="font-mono font-bold text-green-700 text-xs tracking-widest">
                  {appliedTicket.ticket.code}
                </code>
              </div>
              <p className="text-xs text-green-700 font-medium">{appliedTicket.ticket.holderName}</p>
              <p className="text-xs text-green-600">
                {appliedTicket.ticket.discountType === 'pct'
                  ? `${appliedTicket.ticket.discountValue}% → -${formatCurrency(appliedTicket.discountAmt)}`
                  : `Vale S/${appliedTicket.ticket.discountValue}`}
              </p>
              {appliedTicket.ticket.campaignName && (
                <p className="text-xs text-green-500 italic">{appliedTicket.ticket.campaignName}</p>
              )}
            </div>
            <button onClick={handleRemoveTicket}
              className="text-gray-400 hover:text-red-400 flex-shrink-0 mt-0.5 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      )}
      {/* Descuento ticket aplicado */}
      {ticketDiscAmt > 0 && (
        <div className="flex justify-between text-xs font-bold text-amber-700 mt-2 pt-2 border-t border-amber-200">
          <span>🎟️ Descuento ticket</span>
          <span>-{formatCurrency(ticketDiscAmt)}</span>
        </div>
      )}
    </div>

    {/* LÍNEA 4 — BASE IMPONIBLE */}
    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
      <div>
        <p className="text-xs font-medium text-gray-600">Importe Gravado</p>
        <p className="text-xs text-gray-400">Subtotal − descuentos</p>
      </div>
      <span className="text-sm font-semibold text-gray-800">{formatCurrency(baseImponible)}</span>
    </div>

    {/* LÍNEA 5 — IGV */}
    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
      <div>
        <p className="text-xs font-medium text-gray-600">IGV {Math.round(igvRate*100)}%</p>
        <p className="text-xs text-gray-400">Base: {formatCurrency(baseImponible)}</p>
      </div>
      <span className="text-sm font-semibold text-gray-800">{formatCurrency(igvCalculado)}</span>
    </div>

    {/* LÍNEA 6 — TOTAL FINAL (REQ #2) */}
    <div className="rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 p-4 text-white shadow-2xl">
      <div className="flex justify-between items-center mb-2">
        <div>
          <p className="text-xs uppercase tracking-wider font-bold opacity-90">TOTAL A PAGAR</p>
          <p className="text-3xl font-black tracking-tight leading-tight">
            {formatCurrency(totalFinal)}
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <p className="opacity-90">+IGV</p>
            <p className="font-bold">{formatCurrency(igvCalculado)}</p>
          </div>
        </div>
      </div>
      {(totalItemDiscounts + globalDiscAmt + totalCampaignSaving) > 0 && (
        <div className="flex justify-between items-center text-xs bg-white/10 backdrop-blur-sm rounded-lg p-2">
          <span className="font-semibold flex items-center gap-1">💰 Ahorro total</span>
          <span className="font-black text-green-300 text-sm">
            -{formatCurrency(totalItemDiscounts + globalDiscAmt + totalCampaignSaving)}
          </span>
        </div>
      )}
    </div>
  </div>

  {/* LÍNEA 6 — VENTAS DEL TURNO */}
  <div className="border-b border-gray-100">
    <button
      onClick={() => setShowHistory(!showHistory)}
      className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors">
      <span>Ventas del turno ({sessionSales.length})</span>
      <span>{showHistory ? '▲' : '▼'}</span>
    </button>
    {showHistory && (
      <div className="max-h-44 overflow-y-auto px-3 pb-2 space-y-1">
        {sessionSales.length === 0
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

    {/* ── F2: Botones de hold ────────────────────────────────────────────
         "⏸️ Suspender" guarda el carrito y lo deja libre para otra venta.
         "Ventas en espera (N)" abre el panel para recuperar uno guardado. */}
    <div className="flex gap-2">
      {cart.length > 0 && (
        <button
          onClick={handleHoldCart}
          disabled={!canHold}
          title={canHold ? 'Suspender venta y atender otro cliente' : 'Máximo 5 ventas en espera'}
          className="flex-1 py-2 text-sm text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-40 flex items-center justify-center gap-1">
          ⏸️ Suspender
        </button>
      )}
      {heldCarts.length > 0 && (
        <button
          onClick={() => setShowHeldCarts(true)}
          className="flex-1 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-1">
          ▶️ En espera ({heldCarts.length})
        </button>
      )}
    </div>
    {/* ─────────────────────────────────────────────────────────────────── */}

    {cart.length > 0 && (
      <button
        onClick={() => setShowClearConfirm(true)}
        className="w-full py-2 text-sm text-gray-400 hover:text-red-400 transition-colors border border-gray-100 rounded-lg hover:border-red-100">
        Vaciar carrito
      </button>
    )}
    <button
      onClick={() => setShowPayment(true)}
      disabled={cart.length === 0}
      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
      <span>Cobrar</span>
      <span className="opacity-60 text-xs">F </span>
    </button>
  


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
              <PaymentPanel
                total={totalAPagar}
                clients={clients}
                onConfirm={handleCompleteSale}
                processing={processing}
                onClientChange={setSelectedClientId}
                onLoyaltyRedeem={() => {}}
              />
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

      {/* ── F2: Panel de ventas en espera ──────────────────────────────────
           Se abre al pulsar "▶️ En espera (N)". Muestra la cola de holds
           con label, ítems y total. Permite recuperar o descartar cada uno. */}
      {showHeldCarts && (
        <HeldCartsPanel
          heldCarts={heldCarts}
          onRecover={handleRecoverCart}
          onDiscard={(id) => { discardHold(id); if (heldCarts.length <= 1) setShowHeldCarts(false) }}
          onClose={() => setShowHeldCarts(false)}
        />
      )}
      {/* ─────────────────────────────────────────────────────────────────── */}
    </div>
  </div>
</div>
  )
}
