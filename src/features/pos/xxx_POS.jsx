/**
 * POS.jsx — Punto de Venta v4
 * Ruta: src/features/pos/POS.jsx
 *
 * CAMBIOS vs v3 (Parte 2 de ajustes):
 *  1. CANTIDAD: bloqueada — solo se cambia via +/- o eliminación de línea
 *  2. DESCUENTO: bloqueado cuando hay descuento automático (discountBlocked)
 *  3. BADGE específico por ítem con posiciones beneficiarias y appSummary
 *  4. Cintillo de promos activas hoy en la parte superior
 *  5. Semáforo del motor (activo / sin campañas)
 *  6. Feedback visual: fila verde cuando activó regla
 *  7. addToCart vuelve al modo Q acumulativo (el motor trabaja con quantity)
 */

import { useBarcodeScanner } from '../../shared/hooks/useBarcodeScanner'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore, selectCartCount } from '../../store/index'
import { saleService } from '../../services/index'
import { fuzzySearch, formatCurrency } from '../../shared/utils/helpers'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { StockBadge, ExpiryBadge } from '../../shared/components/ui/Badge'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import PaymentPanel from './components/PaymentPanel'
import SaleTicket from './components/SaleTicket'
import toast from 'react-hot-toast'
import { evaluateDiscounts, isCampaignActive } from '../../shared/utils/discountEngine'


// ─── Helper local — HALF_UP a 2 decimales (sin float nativo) ─────────────────
const dec2 = (n) => {
  const v = Number(n ?? 0)
  if (!isFinite(v)) return 0
  return Math.floor(v * 100 + 0.5) / 100
}



export default function POS() {
  const {
    products, cart, clients, discountCampaigns, currentUser,
    activeCashSession, systemConfig, businessConfig,
    redeemDiscountTicket,
    addToCart, updateCartItem, removeFromCart, clearCart,
  } = useStore()

  const cartCount = useStore(selectCartCount)

  const [search, setSearch]             = useState('')
  const [showResults, setShowResults]   = useState(false)
  const [processing, setProcessing]     = useState(false)
  const [completedSale, setCompletedSale] = useState(null)
  const [showTicket, setShowTicket]     = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showPayment, setShowPayment]   = useState(false)
  const [showHistory, setShowHistory]   = useState(false)
  const [discountEdit, setDiscountEdit] = useState({})
  const [globalDiscount, setGlobalDiscount] = useState('')
  const [ticketCode, setTicketCode]     = useState('')
  const [appliedTicket, setAppliedTicket] = useState(null)
  const [ticketError, setTicketError]   = useState('')

  const searchRef  = useRef()
  const debouncedQ = useDebounce(search, 150)

  // ── Campañas activas hoy (para cintillo y semáforo) ───────────────────────
  const activeCampaigns = (discountCampaigns || []).filter(isCampaignActive)

  // ── Motor de descuentos v4 ────────────────────────────────────────────────
  const autoDiscountResult = (() => {
    try {
      return evaluateDiscounts(cart, products, discountCampaigns || [])
    } catch {
      return {
        itemDiscounts:       cart.map(i => ({ ...i, campaignDiscount:0, netTotal: dec2(i.quantity*i.unitPrice), appliedDiscounts:[], discountDetails:[], promoGroupId:null, promoColor:null, discountLevel:null, discountBlocked:false, beneficiaryPositions:[] })),
        globalDiscounts:     [],
        totalCampaignSaving: 0,
        groupSummary:        [],
        engineStatus:        'error',
        summary:             { byItem:0, byGlobal:0, total:0 },
      }
    }
  })()

  const engineStatus = autoDiscountResult.engineStatus

  // Merge: descuentos automáticos + descuentos manuales (solo si no bloqueado)
  const mergedCartItems = cart.map(cartItem => {
    const key      = cartItem._key || cartItem.productId
    const autoItem = autoDiscountResult.itemDiscounts.find(i => i._key === key || i.productId === cartItem.productId)
                  || { campaignDiscount:0, netTotal: dec2(cartItem.quantity*cartItem.unitPrice), appliedDiscounts:[], discountDetails:[], promoGroupId:null, promoColor:null, discountLevel:null, discountBlocked:false, beneficiaryPositions:[] }

    // Si hay descuento automático, el manual se ignora (bloqueo de campo)
    const manualDiscount = autoItem.discountBlocked ? 0 : (cartItem.discount || 0)
    const totalDiscount  = dec2(autoItem.campaignDiscount + manualDiscount)
    const netTotal       = dec2(Math.max(0, autoItem.netTotal - manualDiscount))

    return { ...cartItem, ...autoItem, manualDiscount, totalDiscount, netTotal }
  })

  // Cálculos fiscales SUNAT
  const subtotalBruto   = dec2(mergedCartItems.reduce((a, i) => a + dec2(i.quantity * i.unitPrice), 0))
  const totalItemDisc   = dec2(mergedCartItems.reduce((a, i) => a + i.totalDiscount, 0))
  const globalDiscAmt   = parseFloat(globalDiscount) || 0
  const ticketDiscAmt   = appliedTicket ? appliedTicket.discountAmt : 0
  const totalDescuentos = dec2(totalItemDisc + globalDiscAmt + ticketDiscAmt)
  const totalAPagar     = dec2(Math.max(0, subtotalBruto - totalDescuentos))
  const igvRate         = parseFloat(systemConfig?.igvRate ?? businessConfig?.igvRate ?? 0.18)
  const igvFactor       = 1 + igvRate
  const baseImponible   = dec2(totalAPagar / igvFactor)
  const igvCalculado    = dec2(totalAPagar - baseImponible)
  const totalFinal      = totalAPagar
  const finalTotal      = Math.max(0, dec2(totalAPagar))

  const activeProducts = products.filter(p => p.isActive)
  const searchResults  = debouncedQ.trim()
    ? fuzzySearch(debouncedQ, activeProducts, ['name','barcode','sku','description']).slice(0,8)
    : []

  const { sales } = useStore()
  const sessionSales = activeCashSession
    ? sales.filter(s => s.status==='completada' && new Date(s.createdAt) >= new Date(activeCashSession.openedAt))
        .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,15)
    : []

  // Atajos de teclado
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
    const inCartQty = cart.filter(i => i.productId === product.id).reduce((a,i) => a+i.quantity, 0)
    if (inCartQty >= product.stock) { toast.error(`Stock disponible: ${product.stock}`); return }
    addToCart(product)
    setSearch(''); setShowResults(false)
    searchRef.current?.focus()
    toast.success(`${product.name} agregado`, { duration:800, icon:'✓' })
  }

  // +/- de cantidad: ÚNICO punto de edición (campo cantidad bloqueado para escritura directa)
  const handleUpdateQty = (key, newQty) => {
    const item    = cart.find(i => i._key===key || i.productId===key)
    const product = products.find(p => p.id===item?.productId)
    if (!product) return
    if (newQty <= 0) { removeFromCart(key); return }
    if (newQty > product.stock) { toast.error(`Stock disponible: ${product.stock}`); return }
    updateCartItem(key, { quantity: newQty, subtotal: dec2(newQty * item.unitPrice) })
  }

  // Descuento manual (solo disponible si !discountBlocked)
  const applyDiscount = (key, item) => {
    const ed = discountEdit[key]
    if (!ed) return
    const val = parseFloat(ed.value) || 0
    const discountAmt = ed.pct ? dec2(item.quantity * item.unitPrice * val / 100) : val
    const max = systemConfig?.maxDiscountPct ?? 50
    const pct = (discountAmt / dec2(item.quantity * item.unitPrice)) * 100
    if (pct > max) { toast.error(`Descuento máximo permitido: ${max}%`); return }
    updateCartItem(key, { discount: discountAmt })
    setDiscountEdit(d => { const n={...d}; delete n[key]; return n })
    toast.success('Descuento aplicado', { duration:1000 })
  }

  const handleCheckTicket = () => {
    setTicketError('')
    if (!ticketCode.trim()) return
    const state   = useStore.getState()
    const tickets = state.discountTickets || []
    const ticket  = tickets.find(t => t.code.toUpperCase() === ticketCode.trim().toUpperCase())
    if (!ticket)         { setTicketError('Código no encontrado'); return }
    if (!ticket.isActive){ setTicketError('Ticket desactivado'); return }
    if (ticket.used)     { setTicketError('Ticket ya utilizado'); return }
    const now = new Date()
    if (ticket.validFrom && now < new Date(ticket.validFrom))             { setTicketError('Ticket aún no vigente'); return }
    if (ticket.validTo   && now > new Date(ticket.validTo + 'T23:59:59')){ setTicketError('Ticket vencido'); return }
    let discountAmt = ticket.discountType === 'pct'
      ? dec2(finalTotal * ticket.discountValue / 100)
      : Math.min(ticket.discountValue, finalTotal)
    if (ticket.maxAmount) discountAmt = Math.min(discountAmt, ticket.maxAmount)
    discountAmt = Math.max(0, dec2(discountAmt))
    setAppliedTicket({ ticket, discountAmt })
    toast.success(`Ticket válido · Descuento: S/${discountAmt.toFixed(2)}`, { duration:3000 })
  }

  const handleRemoveTicket = () => { setAppliedTicket(null); setTicketCode(''); setTicketError('') }

  const handleCompleteSale = useCallback(async ({ payments, clientId, change }) => {
    setProcessing(true)
    const { getNextInvoice } = useStore.getState()

    const itemsWithDiscount = mergedCartItems.map(item => ({
      ...item,
      discount:         item.totalDiscount || 0,
      campaignDiscount: item.campaignDiscount || 0,
      manualDiscount:   item.manualDiscount || 0,
      netTotal:         item.netTotal,
      appliedDiscounts: item.appliedDiscounts || [],
      discountDetails:  item.discountDetails || [],
      beneficiaryPositions: item.beneficiaryPositions || [],
    }))

    const salePayload = {
      invoiceNumber:  getNextInvoice(),
      clientId:       clientId || null,
      userId:         currentUser?.id,
      userName:       currentUser?.fullName,
      items:          itemsWithDiscount,
      subtotalBruto,
      totalDescuentos,
      total:          totalAPagar,
      baseImponible,
      igv:            igvCalculado,
      igvRate,
      discount:       totalDescuentos,
      ticketCode:     appliedTicket?.ticket?.code || null,
      ticketDiscount: appliedTicket?.discountAmt  || 0,
      groupSummary:   autoDiscountResult.groupSummary || [],
      payments,
      change:         change || 0,
    }

    const result = await saleService.create(salePayload)
    setProcessing(false)
    if (result.error) { toast.error(result.error); return }

    if (appliedTicket?.ticket) {
      redeemDiscountTicket(appliedTicket.ticket.code, result.data?.id, totalAPagar, currentUser?.id)
      setAppliedTicket(null); setTicketCode(''); setTicketError('')
    }

    setShowPayment(false)
    setGlobalDiscount('')
    setDiscountEdit({})
    setCompletedSale(result.data)
    setShowTicket(true)
    toast.success(`Venta ${result.data.invoiceNumber} completada`, { duration:3000, icon:'🎉' })
  }, [
    appliedTicket, autoDiscountResult.groupSummary,
    baseImponible, mergedCartItems, currentUser,
    igvCalculado, igvRate, redeemDiscountTicket,
    subtotalBruto, totalAPagar, totalDescuentos,
  ])

  const discountsEnabled = systemConfig?.allowDiscounts !== false
  const maxDiscPct       = systemConfig?.maxDiscountPct ?? 50

  if (!activeCashSession) {
    return (
      <EmptyState icon="🔐" title="Caja no abierta" message="Debes aperturar la caja antes de realizar ventas."
        action={{ label:'Ir a Caja', onClick:()=>{} }}/>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ═══════════════════════════════════════════════════════════════════════
          PANEL IZQUIERDO — Búsqueda + Carrito
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Cintillo de promos activas + semáforo del motor ────────────────
            Punto 14b y 14c del requerimiento: indicador de día de promo y
            semáforo del estado del motor                                    */}
        <div className="px-3 py-1.5 bg-white border-b border-gray-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            {/* Semáforo del motor */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={`w-2 h-2 rounded-full ${engineStatus === 'active' ? 'bg-green-500' : 'bg-red-400'}`}
                title={engineStatus === 'active' ? 'Motor activo' : 'Sin campañas activas'}/>
              <span className="text-[10px] text-gray-400 font-medium hidden sm:inline">
                {engineStatus === 'active' ? 'Motor activo' : 'Sin campañas'}
              </span>
            </div>

            {/* Cintillo de promos activas */}
            {activeCampaigns.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="text-[10px] text-gray-400 shrink-0">Hoy:</span>
                <div className="flex gap-1 overflow-x-auto scrollbar-none">
                  {activeCampaigns.slice(0,4).map(c => (
                    <span key={c.id}
                      className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0"
                      style={{ backgroundColor:'#f0fdf4', color:'#166534', border:'1px solid #bbf7d0' }}>
                      {c.icon} {c.name}
                    </span>
                  ))}
                  {activeCampaigns.length > 4 && (
                    <span className="text-[10px] text-gray-400 shrink-0">+{activeCampaigns.length-4} más</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <span className="text-[10px] text-gray-300 shrink-0">F2 · F8 · Ctrl+Del</span>
        </div>

        {/* ── Buscador ──────────────────────────────────────────────────────── */}
        <div className="p-3 border-b border-gray-100 bg-white relative z-10">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input ref={searchRef} value={search}
              onChange={e => { setSearch(e.target.value); setShowResults(true) }}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              placeholder="Buscar por nombre, código o SKU... (F2)" autoFocus/>
            {search && (
              <button onClick={() => { setSearch(''); setShowResults(false) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {showResults && searchResults.length > 0 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-20">
              {searchResults.map(product => {
                const inCart  = cart.filter(i => i.productId === product.id).reduce((a,i) => a+i.quantity, 0)
                const left    = product.stock - inCart
                return (
                  <button key={product.id} onClick={() => handleSelectProduct(product)}
                    disabled={left <= 0}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 last:border-b-0 disabled:opacity-40">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{product.name}</div>
                      <div className="text-xs text-gray-400">
                        {product.barcode}
                        {inCart > 0 && <span className="text-blue-500 ml-1">· {inCart} en carrito</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-blue-600">
                        {formatCurrency(product.priceSell)}<span className="text-xs font-normal text-gray-400"> /{product.unit}</span>
                      </div>
                      <div className="flex gap-1 justify-end mt-0.5">
                        <StockBadge product={{ ...product, stock: left }}/>
                        <ExpiryBadge product={product}/>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── CARRITO ───────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Cabecera columnas */}
          {cart.length > 0 && (
            <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 shrink-0">
              <div className="grid items-center gap-2" style={{gridTemplateColumns:'1fr 100px 88px 96px 96px 52px'}}>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide pl-1">Producto</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
                  Cant. <span className="text-gray-300 font-normal">(bloq.)</span>
                </span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Subtotal</span>
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide text-right">Descuento</span>
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide text-right">Neto</span>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Acc.</span>
              </div>
            </div>
          )}

          {/* Lista scrolleable */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <div className="text-5xl opacity-20">🛒</div>
                <p className="text-gray-400 text-sm">Escanea o busca un producto para comenzar</p>
                <p className="text-gray-300 text-xs">El motor evaluará las reglas de descuento automáticamente</p>
              </div>
            ) : (
              <div className="p-3 space-y-1.5">
                {mergedCartItems.map(item => {
                  const key           = item._key || item.productId
                  const ed            = discountEdit[key]
                  const hasDisc       = item.totalDiscount > 0
                  const hasCamp       = item.campaignDiscount > 0
                  const isBlocked     = item.discountBlocked
                  const promoColor    = item.promoColor || null
                  const detail        = item.discountDetails?.[0]
                  const appSummary    = detail?.appSummary
                  const badgeLabel    = detail?.label
                  const positions     = item.beneficiaryPositions || []

                  return (
                    <div key={key}
                      className={`bg-white rounded-xl border shadow-sm transition-all overflow-hidden ${
                        hasCamp ? 'ring-1 ring-inset' : 'hover:shadow-md hover:border-gray-200'
                      }`}
                      style={{
                        borderLeftColor:  promoColor || undefined,
                        borderLeftWidth:  promoColor ? 3 : 1,
                        // Fila brilla verde cuando activó una regla
                        boxShadow: hasCamp ? `0 0 0 1px ${promoColor || '#22c55e'}40, 0 1px 4px ${promoColor || '#22c55e'}20` : undefined,
                      }}>

                      {/* Fila principal */}
                      <div className="grid items-center gap-2 px-3 py-2.5"
                        style={{gridTemplateColumns:'1fr 100px 88px 96px 96px 52px'}}>

                        {/* 1. Producto + badges */}
                        <div className="min-w-0 pl-1">
                          <p className="text-sm font-semibold text-gray-800 leading-tight truncate">
                            {item.productName}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatCurrency(item.unitPrice)}<span className="text-gray-300"> /{item.unit||'und'}</span>
                          </p>

                          {/* BADGE específico con posiciones beneficiarias (punto 15) */}
                          {hasCamp && badgeLabel && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                                style={{
                                  backgroundColor: promoColor ? `${promoColor}15` : '#f0fdf4',
                                  color:           promoColor || '#166534',
                                  border:          `1px solid ${promoColor ? `${promoColor}35` : '#bbf7d0'}`,
                                }}>
                                {detail?.icon} {badgeLabel}
                              </span>
                              {positions.length > 0 && (
                                <span className="text-[10px] text-gray-400 px-1 py-0.5">
                                  uds. con desc: {positions.join(', ')}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Resumen de aplicación para el cajero */}
                          {appSummary && (
                            <p className="text-[10px] text-gray-400 mt-0.5 italic">{appSummary}</p>
                          )}
                        </div>

                        {/* 2. Cantidad — bloqueada para escritura directa (punto 15) */}
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleUpdateQty(key, item.quantity - 1)}
                            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-all text-sm font-bold leading-none">
                            −
                          </button>
                          {/* Número bloqueado — solo visual, no editable */}
                          <span className="w-7 text-center text-sm font-bold text-gray-800 select-none cursor-not-allowed"
                            title="Usa los botones − + para modificar la cantidad">
                            {item.quantity}
                          </span>
                          <button onClick={() => handleUpdateQty(key, item.quantity + 1)}
                            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 transition-all text-sm font-bold leading-none">
                            +
                          </button>
                        </div>

                        {/* 3. Subtotal */}
                        <div className="text-right">
                          <span className="text-sm text-gray-500">{formatCurrency(dec2(item.quantity*item.unitPrice))}</span>
                        </div>

                        {/* 4. Descuento — bloqueado si hay descuento automático (punto 12 y 14a) */}
                        <div className="text-right">
                          {hasDisc ? (
                            <div className="inline-flex flex-col items-end gap-0.5">
                              <span className={`text-sm font-semibold px-1.5 py-0.5 rounded leading-tight border ${
                                isBlocked
                                  ? 'text-green-700 bg-green-50 border-green-200'
                                  : 'text-amber-600 bg-amber-50 border-amber-200'
                              }`}>
                                -{formatCurrency(item.totalDiscount)}
                              </span>
                              {isBlocked
                                ? <span className="text-[10px] text-green-600 leading-none">auto</span>
                                : <span className="text-[10px] text-gray-400 leading-none">manual</span>
                              }
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
                              {formatCurrency(dec2(item.quantity*item.unitPrice))}
                            </p>
                          )}
                        </div>

                        {/* 6. Acciones */}
                        <div className="flex items-center justify-center gap-1">
                          {/* Botón % solo si NO está bloqueado por descuento automático */}
                          {discountsEnabled && !isBlocked && (
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
                          {/* Icono de bloqueo cuando hay descuento auto */}
                          {isBlocked && (
                            <div title={`Descuento automático — nivel ${item.discountLevel}`}
                              className="w-6 h-6 flex items-center justify-center rounded-md bg-green-50 border border-green-200">
                              <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                              </svg>
                            </div>
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

                      {/* Panel descuento manual — solo si no bloqueado */}
                      {ed && discountsEnabled && !isBlocked && (
                        <div className="mx-3 mb-2.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-amber-700 whitespace-nowrap shrink-0">Dto. manual:</span>
                            <input
                              type="number" min="0" max={dec2(item.quantity*item.unitPrice)} step="0.01"
                              value={ed.value}
                              onChange={e => setDiscountEdit(d => ({...d,[key]:{...d[key],value:e.target.value}}))}
                              className="flex-1 px-2 py-1 border border-amber-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white text-right min-w-0"
                              placeholder="0.00" autoFocus/>
                            <button
                              onClick={() => setDiscountEdit(d => ({...d,[key]:{...d[key],pct:!d[key].pct}}))}
                              className={`px-2 py-1 rounded text-xs font-semibold border shrink-0 transition-all ${ed.pct ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                              {ed.pct ? '%' : 'S/'}
                            </button>
                            <button onClick={() => applyDiscount(key, item)}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 transition-colors shrink-0">
                              Aplicar
                            </button>
                          </div>
                          <div className="flex items-center justify-between mt-1.5 text-xs text-amber-600">
                            <span>Preview: <strong>-S/{(ed.pct ? dec2(item.quantity*item.unitPrice)*(parseFloat(ed.value)||0)/100 : parseFloat(ed.value)||0).toFixed(2)}</strong>
                              {ed.pct && <span className="text-amber-400 ml-1">(máx {maxDiscPct}%)</span>}
                            </span>
                            {item.manualDiscount > 0 && (
                              <button onClick={() => updateCartItem(key, {discount:0})}
                                className="text-red-400 hover:text-red-500 font-medium">Quitar</button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Mensaje de bloqueo cuando hay descuento automático */}
                      {isBlocked && (
                        <div className="mx-3 mb-2 px-2 py-1 bg-green-50 border border-green-100 rounded text-[10px] text-green-700 flex items-center gap-1">
                          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          </svg>
                          Descuento automático aplicado — campo bloqueado por regla de negocio
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Atajos */}
          <div className="px-4 py-1.5 bg-white border-t border-gray-100 flex gap-4 text-[10px] text-gray-300">
            <span>F2 Buscar</span><span>F8 Cobrar</span><span>Ctrl+Del Vaciar</span>
            <span>+/- Cantidad</span><span>🔒 Desc. auto = campo bloqueado</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          PANEL DERECHO — Totales + Cobro
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="w-80 bg-white border-l border-gray-100 flex flex-col flex-shrink-0">

        {/* Header */}
        <div className="px-4 py-3 bg-blue-600 text-white">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            <div>
              <h2 className="text-sm font-bold tracking-wide uppercase">Resumen de Venta</h2>
              <p className="text-xs text-blue-200 mt-0.5">{cartCount} producto{cartCount!==1?'s':''} · {mergedCartItems.reduce((a,i)=>a+i.quantity,0)} unidades</p>
            </div>
          </div>
        </div>

        {/* Totales */}
        <div className="p-4 border-b border-gray-100 space-y-3 overflow-y-auto flex-1">

          {/* Subtotal bruto */}
          <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-sm text-gray-600 font-semibold">Subtotal Bruto</span>
            <span className="text-lg font-bold text-gray-800">{formatCurrency(subtotalBruto)}</span>
          </div>

          {/* Descuentos */}
          <div className="rounded-xl border border-dashed border-green-200 bg-green-50 p-3 space-y-2">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide flex items-center gap-1">
              🏷️ Descuentos: -{formatCurrency(totalItemDisc + globalDiscAmt)}
            </p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-green-600 font-medium">
                <span>Por productos:</span><span>-{formatCurrency(totalItemDisc)}</span>
              </div>
              {autoDiscountResult.summary.byItem > 0 && (
                <div className="flex justify-between text-xs text-green-600 pl-3">
                  <span>• Campañas auto (N1/N2)</span><span>-{formatCurrency(autoDiscountResult.summary.byItem)}</span>
                </div>
              )}
              {autoDiscountResult.summary.byGlobal > 0 && (
                <div className="flex justify-between text-xs text-green-600 pl-3">
                  <span>• Volumen (N3)</span><span>-{formatCurrency(autoDiscountResult.summary.byGlobal)}</span>
                </div>
              )}
            </div>

            {/* Ahorro por promoción (groupSummary) */}
            {autoDiscountResult.groupSummary?.length > 0 && (
              <div className="pt-2 border-t border-green-200 space-y-1">
                <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide">Ahorro por promoción:</p>
                {autoDiscountResult.groupSummary.map(group => (
                  <div key={group.campaignId} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-green-700">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:group.color}}/>
                      {group.icon} {group.name}
                    </span>
                    <span className="font-bold text-green-700">-{formatCurrency(group.saving)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Descuento global adicional */}
            {discountsEnabled && (
              <div className="flex items-center gap-2 pt-2 border-t border-green-200">
                <span className="text-xs text-green-700 whitespace-nowrap font-medium">Dto. global:</span>
                <input type="number" min="0" step="0.50" value={globalDiscount}
                  onChange={e => setGlobalDiscount(e.target.value)}
                  className="flex-1 px-2 py-1 border border-green-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-400 text-right bg-white"
                  placeholder="0.00"/>
                {globalDiscAmt > 0 && (
                  <button onClick={() => setGlobalDiscount('')}
                    className="text-xs text-red-400 hover:text-red-500 font-bold px-1">✕</button>
                )}
              </div>
            )}
          </div>

          {/* Ticket de descuento */}
          <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-3">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">🎟️ Ticket de descuento</p>
            {!appliedTicket ? (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <input value={ticketCode}
                    onChange={e => { setTicketCode(e.target.value.toUpperCase()); setTicketError('') }}
                    onKeyDown={e => e.key==='Enter' && handleCheckTicket()}
                    placeholder="Ingresa el código..."
                    className="flex-1 px-2.5 py-2 border border-amber-300 rounded-lg text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white placeholder:normal-case"/>
                  <button onClick={handleCheckTicket} disabled={!ticketCode.trim() || cart.length===0}
                    className="px-3 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 disabled:opacity-40 whitespace-nowrap">
                    Validar
                  </button>
                </div>
                {ticketError && <p className="text-xs text-red-500">⚠️ {ticketError}</p>}
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <code className="font-mono font-bold text-green-700 text-xs tracking-widest">{appliedTicket.ticket.code}</code>
                    <p className="text-xs text-green-700 font-medium mt-0.5">{appliedTicket.ticket.holderName}</p>
                    <p className="text-xs text-green-600">
                      {appliedTicket.ticket.discountType==='pct'
                        ? `${appliedTicket.ticket.discountValue}% → -${formatCurrency(appliedTicket.discountAmt)}`
                        : `Vale S/${appliedTicket.ticket.discountValue}`}
                    </p>
                  </div>
                  <button onClick={handleRemoveTicket} className="text-gray-400 hover:text-red-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
            {ticketDiscAmt > 0 && (
              <div className="flex justify-between text-xs font-bold text-amber-700 mt-2 pt-2 border-t border-amber-200">
                <span>🎟️ Descuento ticket</span><span>-{formatCurrency(ticketDiscAmt)}</span>
              </div>
            )}
          </div>

          {/* Base imponible e IGV */}
          <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
            <div><p className="text-xs font-medium text-gray-600">Op. Gravada</p><p className="text-xs text-gray-400">Subtotal − descuentos</p></div>
            <span className="text-sm font-semibold text-gray-800">{formatCurrency(baseImponible)}</span>
          </div>
          <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
            <div><p className="text-xs font-medium text-gray-600">I.G.V. {Math.round(igvRate*100)}%</p><p className="text-xs text-gray-400">Incluido en precio</p></div>
            <span className="text-sm font-semibold text-gray-800">{formatCurrency(igvCalculado)}</span>
          </div>

          {/* Total final */}
          <div className="rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 p-4 text-white shadow-2xl">
            <div className="flex justify-between items-center mb-2">
              <div>
                <p className="text-xs uppercase tracking-wider font-bold opacity-90">TOTAL A PAGAR</p>
                <p className="text-3xl font-black tracking-tight leading-tight">{formatCurrency(totalFinal)}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm text-right">
                <p className="opacity-90 text-xs">IGV incl.</p>
                <p className="font-bold">{formatCurrency(igvCalculado)}</p>
              </div>
            </div>
            {(totalItemDisc + globalDiscAmt) > 0 && (
              <div className="flex justify-between items-center text-xs bg-white/10 backdrop-blur-sm rounded-lg p-2">
                <span className="font-semibold">💰 Ahorro total</span>
                <span className="font-black text-green-300 text-sm">-{formatCurrency(totalItemDisc + globalDiscAmt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Ventas del turno */}
        <div className="border-b border-gray-100">
          <button onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors">
            <span>Ventas del turno ({sessionSales.length})</span>
            <span>{showHistory?'▲':'▼'}</span>
          </button>
          {showHistory && (
            <div className="max-h-44 overflow-y-auto px-3 pb-2 space-y-1">
              {sessionSales.length===0
                ? <p className="text-xs text-gray-400 text-center py-3">Sin ventas aún</p>
                : sessionSales.map(s => (
                  <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-gray-600">{s.invoiceNumber}</div>
                      <div className="text-gray-400">{s.items?.length} ítems</div>
                    </div>
                    <span className="font-medium text-gray-800">{formatCurrency(s.total)}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="p-4 space-y-2">
          {cart.length > 0 && (
            <button onClick={() => setShowClearConfirm(true)}
              className="w-full py-2 text-sm text-gray-400 hover:text-red-400 transition-colors border border-gray-100 rounded-lg hover:border-red-100">
              Vaciar carrito
            </button>
          )}
          <button onClick={() => setShowPayment(true)} disabled={cart.length===0}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
            <span>Cobrar</span><span className="opacity-60 text-xs">F8</span>
          </button>
        </div>
      </div>

      {/* ── Modales ──────────────────────────────────────────────────────────── */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40">
          <div className="bg-white h-full w-96 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Cobrar venta</h2>
              <button onClick={() => setShowPayment(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <PaymentPanel total={totalAPagar} clients={clients} onConfirm={handleCompleteSale} processing={processing}/>
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
