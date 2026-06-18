import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { POS_RULES } from '../../config/businessRules'
import { usePOSBroadcast, buildCartForDisplay } from './POSBroadcast'
import { useStore, selectCartCount } from '../../store/index'
import { fuzzySearch, formatCurrency } from '../../shared/utils/helpers'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { StockBadge, ExpiryBadge } from '../../shared/components/ui/Badge'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
const PaymentPanel = lazy(() => import('./components/PaymentPanel'))
const SaleTicket   = lazy(() => import('./components/SaleTicket'))
import toast from 'react-hot-toast'
import { calcStockDisponible } from '../../shared/utils/inventoryEngine'
import { useCartHold }     from './hooks/useCartHold'
import { useStockReserve } from './hooks/useStockReserve'
import { serialService }   from '../../services/index'
import { usePOSDiscount }  from './hooks/usePOSDiscount'
import { usePOSSale }      from './hooks/usePOSSale'
const HeldCartsPanel = lazy(() => import('./components/HeldCartsPanel'))
import { usePOSTotals } from './hooks/usePOSTotals'

function playBeep({ freq = 1800, duration = 0.08, volume = 0.35 } = {}) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
    osc.onended = () => ctx.close()
  } catch (_) {}
}

function VariantSelectorModal({ product, variants, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-purple-600 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">{product.name}</h3>
            <p className="text-xs text-purple-200 mt-0.5">Selecciona una variante para agregar al carrito</p>
          </div>
          <button onClick={onClose} className="text-purple-200 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-80 overflow-y-auto">
          {variants.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              Sin variantes registradas para este producto.<br/>
              <span className="text-xs">Ve al Catálogo → edita el producto → Variantes.</span>
            </div>
          ) : variants.map((v, idx) => {
            const label = Object.values(v.attributes || {}).join(' · ') || '(sin atributos)'
            const price = v.priceSell || product.priceSell
            const outOfStock = (v.stock ?? 0) <= 0
            return (
              <button key={v.id || idx} onClick={(e) => { e.stopPropagation(); if (!outOfStock) onSelect(v) }} disabled={outOfStock}
                className={`w-full flex items-center justify-between px-5 py-3 text-left transition-colors ${outOfStock ? 'opacity-40 cursor-not-allowed bg-gray-50 dark:bg-slate-800/50' : 'hover:bg-purple-50 dark:hover:bg-purple-900/20'}`}>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {v.barcode}{v.sku ? ` · ${v.sku}` : ''}
                    {' · '}Stock: <span className={outOfStock ? 'text-red-500 font-semibold' : 'text-gray-500'}>{v.stock}</span>
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(price)}</p>
                  {outOfStock && <p className="text-xs text-red-500 font-medium">Sin stock</p>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function POS({ onNavigate }) {
  const {
    products, productVariants, cart, clients, currentUser, activeCashSession, systemConfig, businessConfig,
    addToCart, updateCartItem, removeFromCart, clearCart, restoreCart,
  } = useStore()

  const cartCount = useStore(selectCartCount)

  const [search, setSearch]                         = useState('')
  const [showResults, setShowResults]               = useState(false)
  const [variantSelectProduct, _setVariantSelectProduct] = useState(null)
  const variantSelectProductRef = useRef(null)
  const setVariantSelectProduct = (p) => {
    variantSelectProductRef.current = p
    _setVariantSelectProduct(p)
  }
  const [serialSelectProduct, setSerialSelectProduct] = useState(null)
  const [serialSelectList,    setSerialSelectList]    = useState([])
  const [serialSelectLoading, setSerialSelectLoading] = useState(false)

  const [selectedClientId, setSelectedClientId] = useState(null)
  const selectedClient = clients.find(c => c.id === selectedClientId) || null

  const { heldCarts, holdCart, recoverCart, discardHold, canHold } = useCartHold()
  // Reserva multi-caja: bloquea stock virtualmente mientras el cajero arma la venta
  const { releaseReserve, stockConflicts, hasConflicts } = useStockReserve(cart)
  const [showHeldCarts, setShowHeldCarts] = useState(false)

  const handleHoldCart = () => {
    if (cart.length === 0) { toast('El carrito está vacío', { icon: 'ℹ️' }); return }
    if (!canHold)          { toast.error(`Máximo ${POS_RULES.MAX_HELD_CARTS} ventas en espera`); return }
    const label = selectedClient?.name || ''
    const id    = holdCart(cart, label)
    if (id) {
      clearCart()
      resetDiscount()
      setSelectedClientId(null)
      toast.success('Venta suspendida — puedes atender otro cliente', { icon: '⏸️', duration: 2500 })
    }
  }

  const handleRecoverCart = (holdId) => {
    const items = recoverCart(holdId)
    if (!items || items.length === 0) { toast.error('No se pudo recuperar la venta'); return }
    restoreCart(items)
    setShowHeldCarts(false)
    toast.success(`Venta recuperada — ${items.length} producto(s) cargados al carrito`, { icon: '▶️', duration: 2500 })
  }

  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showPayment, setShowPayment]     = useState(false)
  const showPaymentRef = useRef(false)
  showPaymentRef.current = showPayment
  const [showHistory, setShowHistory] = useState(false)

  const searchRef  = useRef()
  const debouncedQ = useDebounce(search, 150)

  // ── Descuentos: estado y lógica extraídos al hook ────────────────────────
  const {
    discountEdit,
    globalDiscount,  setGlobalDiscount,
    ticketCode,      setTicketCode,
    appliedTicket,   ticketError,
    discountsEnabled, maxDiscPct,
    globalDiscountAmt, ticketDiscAmt,
    toggleDiscountEdit, applyDiscount,
    setDiscountValue, toggleDiscountType,
    handleCheckTicket, handleRemoveTicket,
    resetDiscount,
  } = usePOSDiscount(updateCartItem)

  const globalDiscAmt = globalDiscountAmt

  const {
    mergedCartItems, autoDiscountResult,
    subtotalBruto, totalDescuentos, totalAPagar,
    baseImponible, igvCalculado, igvRate,
    totalCampaignSaving, totalManualDiscount, totalItemDiscounts,
  } = usePOSTotals(cart, globalDiscAmt, ticketDiscAmt)

  const totalFinal   = totalAPagar
  // Total antes del ticket (usado para calcular descuento del ticket al validar)
  const preSaleTotal = Math.max(0, parseFloat((subtotalBruto - globalDiscAmt).toFixed(2)))

  // ── Refs de pantalla cliente y broadcast ─────────────────────────────────
  // Deben declararse ANTES de usePOSSale porque broadcast se pasa como argumento
  const actionsRef        = useRef({})
  const cartSnapshotRef   = useRef([])
  const businessConfigRef = useRef(businessConfig)

  const { broadcast, openDisplay } = usePOSBroadcast({ cartSnapshotRef, businessConfigRef })

  // ── Venta: flujo de completar y ticket de comprobante ────────────────────
  const { processing, completedSale, showTicket, handleCompleteSale, closeTicket } = usePOSSale({
    mergedCartItems, subtotalBruto, totalDescuentos, totalAPagar,
    baseImponible, igvCalculado, igvRate,
    appliedTicket, releaseReserve, resetDiscount, broadcast,
  })

  const activeProducts = products.filter(p => p.isActive)
  const searchResults  = debouncedQ.trim()
    ? (() => {
        const prodResults = fuzzySearch(debouncedQ, activeProducts, ['name','barcode','sku','description'])
        const variantResults = []
        if (productVariants?.length > 0) {
          const q = debouncedQ.toLowerCase()
          productVariants.forEach(v => {
            if (v.barcode?.includes(debouncedQ) || v.sku?.toLowerCase().includes(q)) {
              const parent = activeProducts.find(p => p.id === v.productId)
              if (parent && !prodResults.find(r => r.id === parent.id)) {
                variantResults.push({ ...parent, _variant: v, name: `${parent.name} (${Object.values(v.attributes||{}).join(' · ')})`, barcode: v.barcode || parent.barcode, stock: v.stock ?? parent.stock, priceSell: v.priceSell || parent.priceSell })
              }
            }
          })
        }
        return [...prodResults, ...variantResults].slice(0, POS_RULES.SEARCH_MAX_RESULTS)
      })()
    : []

  const [saleNote, setSaleNote] = useState('')
  useEffect(() => {
    const pending = localStorage.getItem('pos_pending_note')
    if (pending) { localStorage.removeItem('pos_pending_note'); setSaleNote(pending) }
  }, [])

  const { sales } = useStore()
  const sessionSales = activeCashSession
    ? sales.filter(s => s.status==='completada' && new Date(s.createdAt) >= new Date(activeCashSession.openedAt))
        .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0, 15)
    : []

  useEffect(() => { cartSnapshotRef.current = buildCartForDisplay(mergedCartItems, products) }, [mergedCartItems, products])
  useEffect(() => { businessConfigRef.current = businessConfig }, [businessConfig])

  useEffect(() => {
    actionsRef.current = {
      focusSearch: () => searchRef.current?.focus(),
      clearSearch: () => { setSearch(''); setShowResults(false) },
      openPayment: () => { if (cart.length > 0 && activeCashSession && !hasConflicts) { setVariantSelectProduct(null); setShowPayment(true) } },
      promptClear: () => { if (cart.length > 0) setShowClearConfirm(true) },
    }
    const handler = (e) => {
      if (e.key==='F2')  { e.preventDefault(); actionsRef.current.focusSearch() }
      if (e.key==='Escape') actionsRef.current.clearSearch()
      if (e.key==='F8')  { e.preventDefault(); if (!showPaymentRef.current) actionsRef.current.openPayment() }
      if (e.key==='Delete' && e.ctrlKey) { e.preventDefault(); actionsRef.current.promptClear() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cart.length, activeCashSession, hasConflicts])

  useEffect(() => {
    broadcast('CART_UPDATE', { cart: buildCartForDisplay(mergedCartItems, products), businessConfig })
  }, [mergedCartItems]) // eslint-disable-line react-hooks/exhaustive-deps

  const getAvailableStock = (product) => {
    if (product.type !== 'bundle' || !product.components?.length) return calcStockDisponible(product)
    return Math.floor(Math.min(...product.components.map(comp => {
      const cp = products.find(p => p.id === comp.productId)
      return cp && comp.quantity > 0 ? Math.floor(calcStockDisponible(cp) / comp.quantity) : 0
    })))
  }

  const handleSelectProduct = async (product) => {
    if (product.hasVariants && !product._variant) {
      const variants = productVariants.filter(v => v.productId === product.id)
      if (variants.length > 0) { setVariantSelectProduct(product); setSearch(''); setShowResults(false); return }
    }

    // Productos SERIE → mostrar modal de selección de serial
    if (product.stockControl === 'serie') {
      setSearch(''); setShowResults(false)
      setSerialSelectLoading(true)
      setSerialSelectProduct(product)
      const r = await serialService.getByProduct(product.id)
      const disponibles = r.ok ? r.data.filter(s => s.status === 'disponible') : []
      setSerialSelectList(disponibles)
      setSerialSelectLoading(false)
      return
    }

    const available = getAvailableStock(product)
    if (available <= 0) { toast.error(`${product.name} sin stock`); return }
    addToCart(product, 1, product._variant?.id || null)
    playBeep()
    setSearch(''); setShowResults(false)
    searchRef.current?.focus()
    toast.success(`${product.name} agregado`, { duration: 1000, icon: '✓' })
  }

  const handleSelectSerial = useCallback((serial) => {
    const product = serialSelectProduct
    if (!product || !serial) return
    // Evitar duplicar el mismo serial en el carrito
    const alreadyInCart = useStore.getState().cart.some(i => i.selectedSerial === serial.serialNumber)
    if (alreadyInCart) { toast.error(`El serial ${serial.serialNumber} ya está en el carrito`); return }
    addToCart(product, 1, serial.id, { selectedSerial: serial.serialNumber, stockControl: 'serie' })
    setSerialSelectProduct(null)
    setSerialSelectList([])
    playBeep()
    searchRef.current?.focus()
    toast.success(`${product.name} · ${serial.serialNumber} agregado`, { duration: 1500, icon: '🔑' })
  }, [serialSelectProduct, addToCart]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectVariant = useCallback((variant) => {
    const product = variantSelectProductRef.current
    if (!product || !variant) return
    setVariantSelectProduct(null)
    const attrLabel = Object.values(variant.attributes || {}).join(' · ')
    const enriched = { ...product, _variant: variant, name: attrLabel ? `${product.name} (${attrLabel})` : product.name, barcode: variant.barcode || product.barcode || '', stock: variant.stock ?? product.stock, priceSell: variant.priceSell || product.priceSell }
    if ((variant.stock ?? 0) <= 0) { toast.error('Sin stock para esta variante'); return }
    addToCart(enriched, 1, variant.id)
    playBeep()
    searchRef.current?.focus()
    toast.success(`${enriched.name} agregado`, { duration: 1200, icon: '✓' })
  }, [addToCart]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdateQty = (key, newQty) => {
    const item    = cart.find(i => i._key === key)
    const product = products.find(p => p.id === item?.productId)
    if (!product) return
    if (newQty <= 0) { removeFromCart(key); return }
    const available = getAvailableStock(product)
    if (newQty > available) { toast.error(`Stock disponible: ${available}`); return }
    updateCartItem(key, { quantity: newQty })
  }

  const onCompleteSale = useCallback(async (paymentData) => {
    const ok = await handleCompleteSale({ ...paymentData, note: saleNote.trim() || null })
    if (ok) {
      setShowPayment(false); setVariantSelectProduct(null)
      setSearch(''); setShowResults(false)
      setSelectedClientId(null); setSaleNote('')
    }
  }, [handleCompleteSale, saleNote])

  if (!activeCashSession) {
    return <EmptyState icon="🔐" title="Caja no abierta" message="Debes aperturar la caja antes de realizar ventas." action={{ label: 'Ir a Caja', onClick: () => onNavigate?.('cash') }}/>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Búsqueda */}
        <div className="p-3 border-b border-gray-100 bg-white relative z-10">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input ref={searchRef} value={search}
              onChange={e => { setSearch(e.target.value); setShowResults(true) }}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  const q = search.trim().toLowerCase()
                  const exact = searchResults.find(p => p.barcode?.toLowerCase() === q || p.sku?.toLowerCase() === q)
                  const target = exact ?? (searchResults.length === 1 ? searchResults[0] : null)
                  if (target) { e.preventDefault(); handleSelectProduct(target) }
                }
              }}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              placeholder="Buscar por nombre, código o SKU... (F2)" autoFocus/>
            {search && <button onClick={() => { setSearch(''); setShowResults(false) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
          </div>
          {showResults && searchResults.length > 0 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-20">
              {searchResults.map(product => (
                <button key={product.id} onClick={() => handleSelectProduct(product)} disabled={getAvailableStock(product) === 0}
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
        <div className="flex-1 flex flex-col overflow-hidden">
          {cart.length > 0 && (
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 shrink-0">
              <div className="grid items-center gap-2" style={{gridTemplateColumns:'1fr 108px 110px 52px'}}>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide pl-1">Producto</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Cant.</span>
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide text-right">Total</span>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Acc.</span>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto scrollbar-thin">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-5 py-6 overflow-y-auto">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="text-5xl opacity-20">🛒</div>
                <p className="text-gray-400 text-sm">Busca un producto para comenzar</p>
                <p className="text-gray-300 text-xs">F2 buscar · F8 cobrar · Ctrl+Del vaciar</p>
              </div>
              <div className="w-full rounded-xl border border-blue-100 bg-blue-50/60 overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-blue-100 bg-blue-100/60">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 10c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.249-8.25-3.286z"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-blue-800 leading-tight">Reserva de stock multi-caja</p>
                    <p className="text-[10px] text-blue-500 leading-tight mt-0.5">Protección activa de inventario</p>
                  </div>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white shrink-0">ACTIVO</span>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Sistema que <span className="font-semibold">bloquea virtualmente el stock</span> mientras un cajero está armando una venta, evitando que otro cajero simultáneo venda las mismas unidades y genere inventario negativo.
                  </p>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">Cómo funciona</p>
                    {[
                      { n: '1', txt: <>Al agregar productos, se crea una <span className="font-semibold">reserva temporal</span> en la base de datos con vigencia de <span className="font-semibold">10 minutos</span>.</> },
                      { n: '2', txt: <>El stock real <span className="font-semibold">no se descuenta</span> hasta confirmar la venta. El disponible = stock real − reservas activas de otros cajeros.</> },
                      { n: '3', txt: <>Si otro cajero intenta reservar el mismo ítem sin stock disponible, recibe un <span className="font-semibold">aviso de conflicto</span> antes de cobrar.</> },
                      { n: '4', txt: <>Al confirmar o cancelar, la reserva se <span className="font-semibold">libera automáticamente</span>. Las inactivas expiran solas a los 10 min.</> },
                    ].map(({ n, txt }) => (
                      <div key={n} className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
                        <p className="text-xs text-blue-700 leading-relaxed">{txt}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[{ val: '10', unit: 'min TTL', color: 'text-blue-700' }, { val: '∞', unit: 'cajeros', color: 'text-blue-700' }, { val: '0', unit: 'stock neg.', color: 'text-green-600' }].map(({ val, unit, color }) => (
                      <div key={unit} className="rounded-lg bg-white border border-blue-100 px-2 py-2 text-center">
                        <p className={`text-lg font-black leading-none ${color}`}>{val}</p>
                        <p className="text-[10px] text-blue-400 mt-0.5 leading-tight">{unit}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-1.5">
              {mergedCartItems.map(item => {
                const key         = item._key || item.productId
                const ed          = discountEdit[key]
                const hasDisc     = item.totalDiscount > 0
                const hasCamp     = item.campaignDiscount > 0
                const hasConflict = stockConflicts.includes(item.productId)
                return (
                  <div key={key} className={`rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${
                    hasConflict ? 'bg-red-50/40 border-red-200 hover:border-red-300' :
                    hasDisc ? 'bg-amber-50/30 border-amber-100 hover:border-amber-200' : 'bg-white border-gray-100 hover:border-blue-100'
                  }`}>
                    <div className="grid items-center gap-2 px-4 py-3" style={{gridTemplateColumns:'1fr 108px 110px 52px'}}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-base font-semibold text-gray-900 leading-tight truncate">{item.productName}</p>
                          {item.selectedSerial && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 border border-violet-200 rounded-full leading-none shrink-0">
                              🔑 {item.selectedSerial}
                            </span>
                          )}
                          {hasConflict && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 border border-red-200 rounded-full leading-none shrink-0">
                              ⚠ Sin stock disponible
                            </span>
                          )}
                        </div>
                        {item.type === 'bundle' && item.components?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {item.components.map((c, ci) => (
                              <span key={ci} className="text-[10px] text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 leading-none">
                                {c._name || c.name || c.productId} ×{c.quantity}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-400">{formatCurrency(item.unitPrice)}<span className="text-gray-300">/{item.unit || 'und'}</span></span>
                          {hasDisc && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full leading-none">
                              🏷️ -{formatCurrency(item.totalDiscount)}
                              {hasCamp && !item.manualDiscount && ' campaña'}
                              {!hasCamp && item.manualDiscount > 0 && ' manual'}
                              {hasCamp && item.manualDiscount > 0 && ' campaña+manual'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => handleUpdateQty(key, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-all text-base font-bold leading-none">−</button>
                        <span className="w-8 text-center text-base font-bold text-gray-900">{item.quantity}</span>
                        <button onClick={() => handleUpdateQty(key, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 transition-all text-base font-bold leading-none">+</button>
                      </div>
                      <div className="text-right">
                        <span className={`text-base font-bold ${hasDisc ? 'text-emerald-700' : 'text-gray-900'}`}>{formatCurrency(item.netTotal)}</span>
                        {hasDisc && <p className="text-xs text-gray-300 line-through leading-none mt-0.5">{formatCurrency(item.subtotal)}</p>}
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        {discountsEnabled && (
                          <button onClick={() => toggleDiscountEdit(key)} title="Descuento manual"
                            className={`w-6 h-6 flex items-center justify-center rounded-md text-xs font-bold border transition-all ${ed ? 'bg-amber-500 text-white border-amber-500' : 'text-gray-400 border-gray-200 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-300'}`}>%</button>
                        )}
                        <button onClick={() => removeFromCart(key)} title="Eliminar" className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-all">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                    </div>
                    {ed && discountsEnabled && (
                      <div className="mx-3 mb-2.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-amber-700 whitespace-nowrap shrink-0">Dto. manual:</span>
                          <input type="number" min="0" max={item.subtotal} step="1" value={ed.value}
                            onChange={e => setDiscountValue(key, e.target.value)}
                            className="flex-1 px-2 py-1 border border-amber-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white text-right min-w-0"
                            placeholder="0.00" autoFocus/>
                          <button onClick={() => toggleDiscountType(key)}
                            className={`px-2 py-1 rounded text-xs font-semibold border shrink-0 transition-all ${ed.pct ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                            {ed.pct ? '%' : 'S/'}
                          </button>
                          <button onClick={() => applyDiscount(key, item)} className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 transition-colors shrink-0">Aplicar</button>
                        </div>
                        <div className="flex items-center justify-between mt-1.5 text-xs text-amber-600">
                          <span>Preview: <strong>-S/{(ed.pct ? item.subtotal*(parseFloat(ed.value)||0)/100 : parseFloat(ed.value)||0).toFixed(2)}</strong>
                            {ed.pct && <span className="text-amber-400 ml-1">(máx {maxDiscPct}%)</span>}
                          </span>
                          {item.manualDiscount > 0 && <button onClick={() => updateCartItem(key, {discount:0})} className="text-red-400 hover:text-red-500 font-medium">Quitar</button>}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          </div>

          <div className="px-4 py-2 bg-white border-t border-gray-100 flex gap-4 text-xs text-gray-300 flex-wrap">
            <span>F2 Buscar</span><span>F8 Cobrar</span><span>Ctrl+Del Vaciar</span><span>% Descuento por ítem</span>
          </div>
        </div>
      </div>

      {/* Panel derecho */}
      <div className="w-80 bg-white border-l border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-4 py-3 bg-blue-600 text-white flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-wide uppercase">Resumen de Venta</h2>
            <p className="text-xs text-blue-200 mt-0.5">{cartCount} producto{cartCount !== 1 ? 's' : ''} en carrito</p>
          </div>
          {cartCount > 0 && <span className="text-2xl font-black text-white/90 tabular-nums">{formatCurrency(totalFinal)}</span>}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4 pb-3 space-y-3 border-b border-gray-100">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Subtotal bruto</span>
              <span className="text-sm font-semibold text-gray-700">{formatCurrency(subtotalBruto)}</span>
            </div>
            {(totalItemDiscounts + globalDiscAmt + autoDiscountResult.summary.byGlobal) > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-green-600">🏷️ Descuentos</span>
                  <span className="text-sm font-bold text-green-600">-{formatCurrency(totalItemDiscounts + globalDiscAmt + autoDiscountResult.summary.byGlobal)}</span>
                </div>
                {totalCampaignSaving > 0 && (
                  <div className="flex justify-between text-xs text-green-500 pl-4">
                    <span>Campañas: -{formatCurrency(autoDiscountResult.summary.byItem)}</span>
                    {autoDiscountResult.summary.byGlobal > 0 && <span>Global: -{formatCurrency(autoDiscountResult.summary.byGlobal)}</span>}
                  </div>
                )}
                {totalManualDiscount > 0 && <div className="flex justify-between text-xs text-amber-600 pl-4"><span>Manuales: -{formatCurrency(totalManualDiscount)}</span></div>}
                {autoDiscountResult.globalDiscounts.length > 0 && (
                  <div className="text-xs text-green-500 space-y-0.5 pl-4">
                    {autoDiscountResult.globalDiscounts.map((d, i) => <div key={i} className="flex items-center gap-1 truncate"><span>{d.icon}</span><span className="truncate">{d.name}</span></div>)}
                  </div>
                )}
              </div>
            )}
            {discountsEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">Dto. global S/:</span>
                <input type="number" min="0" step="1" value={globalDiscount} onChange={e => setGlobalDiscount(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 text-right bg-gray-50" placeholder="0.00"/>
                {globalDiscAmt > 0 && <button onClick={() => setGlobalDiscount('')} className="text-xs text-red-400 hover:text-red-500 font-bold px-1 shrink-0">✕</button>}
              </div>
            )}
            <div className="space-y-1.5">
              <span className="text-xs text-gray-400 font-medium">🎟️ Ticket de descuento:</span>
              {!appliedTicket ? (
                <div className="space-y-1">
                  <div className="flex gap-1.5">
                    <input value={ticketCode} onChange={e => setTicketCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCheckTicket(preSaleTotal)}
                      placeholder="Código del ticket..." className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-amber-400 bg-gray-50 placeholder:normal-case"/>
                    <button onClick={() => handleCheckTicket(preSaleTotal)} disabled={!ticketCode.trim() || cart.length === 0}
                      className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 disabled:opacity-40 whitespace-nowrap transition-colors">Validar</button>
                  </div>
                  {ticketError && <p className="text-xs text-red-500 flex items-center gap-1">⚠️ {ticketError}</p>}
                </div>
              ) : (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5"><span className="text-green-600 text-sm">✅</span><code className="font-mono font-bold text-green-700 text-xs tracking-widest truncate">{appliedTicket.ticket.code}</code></div>
                    <p className="text-xs text-green-600 mt-0.5">{appliedTicket.ticket.discountType === 'pct' ? `${appliedTicket.ticket.discountValue}% → -${formatCurrency(appliedTicket.discountAmt)}` : `Vale S/${appliedTicket.ticket.discountValue}`}</p>
                  </div>
                  <button onClick={handleRemoveTicket} className="text-gray-400 hover:text-red-400 shrink-0 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
                </div>
              )}
              {ticketDiscAmt > 0 && <div className="flex justify-between text-xs font-bold text-amber-700"><span>Descuento ticket</span><span>-{formatCurrency(ticketDiscAmt)}</span></div>}
            </div>
          </div>

          <div className="px-4 py-2.5 border-b border-gray-100 space-y-1">
            <div className="flex justify-between items-center"><span className="text-xs text-gray-400">Base imponible</span><span className="text-xs text-gray-400 tabular-nums">{formatCurrency(baseImponible)}</span></div>
            <div className="flex justify-between items-center"><span className="text-xs text-gray-400">IGV {Math.round(igvRate*100)}%</span><span className="text-xs text-gray-400 tabular-nums">{formatCurrency(igvCalculado)}</span></div>
          </div>

          <div className="bg-emerald-600 px-4 py-5">
            <p className="text-xs font-bold text-emerald-200 uppercase tracking-widest mb-1">TOTAL A PAGAR</p>
            <div className="flex items-end justify-between gap-2">
              <p className="text-4xl font-black text-white tracking-tight leading-none tabular-nums">{formatCurrency(totalFinal)}</p>
              <div className="text-right shrink-0 pb-0.5"><p className="text-xs text-emerald-300">incl. IGV</p><p className="text-sm font-bold text-emerald-100 tabular-nums">{formatCurrency(igvCalculado)}</p></div>
            </div>
            {(totalItemDiscounts + globalDiscAmt + totalCampaignSaving) > 0 && (
              <div className="flex justify-between items-center text-xs bg-emerald-700/60 rounded-lg px-3 py-1.5 mt-3">
                <span className="font-semibold text-emerald-100">💰 Ahorro total</span>
                <span className="font-black text-white tabular-nums">-{formatCurrency(totalItemDiscounts + globalDiscAmt + totalCampaignSaving)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100">
          <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-400 hover:bg-gray-50 transition-colors">
            <span>Ventas del turno ({sessionSales.length})</span><span className="text-gray-300">{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="max-h-36 overflow-y-auto px-3 pb-2 space-y-1">
              {sessionSales.length === 0 ? <p className="text-xs text-gray-400 text-center py-3">Sin ventas aún</p>
                : sessionSales.map(s => (
                  <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0 text-xs">
                    <div className="flex-1 min-w-0"><div className="font-mono text-gray-600">{s.invoiceNumber}</div><div className="text-gray-400">{s.items?.length} items</div></div>
                    <span className="font-medium text-gray-700 tabular-nums">{formatCurrency(s.total)}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        <div className="p-3 space-y-2 border-t border-gray-100">
          <div className="flex gap-2">
            {cart.length > 0 && (
              <button onClick={handleHoldCart} disabled={!canHold} title={canHold ? 'Suspender venta y atender otro cliente' : 'Máximo 5 ventas en espera'}
                className="flex-1 py-2 text-xs text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-40 flex items-center justify-center gap-1">⏸️ Suspender</button>
            )}
            {heldCarts.length > 0 && (
              <button onClick={() => setShowHeldCarts(true)} className="flex-1 py-2 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-1">▶️ En espera ({heldCarts.length})</button>
            )}
          </div>
          <div className="flex gap-2">
            {cart.length > 0 && (
              <button onClick={() => setShowClearConfirm(true)} className="py-2 px-3 text-xs text-gray-400 hover:text-red-400 transition-colors border border-gray-100 rounded-lg hover:border-red-100 shrink-0">🗑️ Vaciar</button>
            )}
            <input value={saleNote} onChange={e => setSaleNote(e.target.value)} placeholder="📝 Nota de venta..." maxLength={200}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-0"/>
          </div>

          {/* Aviso de conflictos de stock */}
          {hasConflicts && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-red-500 text-sm shrink-0">⚠</span>
              <p className="text-xs text-red-600 leading-tight">Hay productos sin stock disponible. Retíralos del carrito para poder cobrar.</p>
            </div>
          )}

          <button onClick={() => { setVariantSelectProduct(null); setShowPayment(true) }}
            disabled={cart.length === 0 || hasConflicts}
            title={hasConflicts ? 'Resuelve los conflictos de stock antes de cobrar' : ''}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm shadow-blue-300">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/>
            </svg>
            <span className="text-base">Cobrar</span>
            <span className="opacity-60 text-xs font-normal">F8</span>
          </button>
          <button onClick={openDisplay} title="Abrir pantalla del cliente" className="text-gray-300 hover:text-gray-500 transition-colors text-sm">📺</button>

          {showPayment && (
            <Suspense fallback={null}>
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white w-full max-w-lg max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-gray-800">Cobrar venta</h2>
                        <p className="text-xs text-gray-400">Total: <span className="font-semibold text-gray-700">{formatCurrency(totalAPagar)}</span></p>
                      </div>
                    </div>
                    <button onClick={() => setShowPayment(false)} title="Cerrar (Esc)" className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <PaymentPanel total={totalAPagar} clients={clients} onConfirm={onCompleteSale} processing={processing} onClientChange={setSelectedClientId} onLoyaltyRedeem={() => {}}/>
                  </div>
                </div>
              </div>
            </Suspense>
          )}

          {showClearConfirm && (
            <ConfirmModal title="¿Vaciar el carrito?" message="Se eliminarán todos los productos del carrito." confirmLabel="Vaciar" variant="danger"
              onConfirm={() => { clearCart(); releaseReserve(); resetDiscount(); setShowClearConfirm(false); setVariantSelectProduct(null) }}
              onCancel={() => setShowClearConfirm(false)}/>
          )}

          {showTicket && completedSale && (
            <Suspense fallback={null}>
              <SaleTicket sale={completedSale} onClose={closeTicket}/>
            </Suspense>
          )}

          {showHeldCarts && (
            <Suspense fallback={null}>
              <HeldCartsPanel heldCarts={heldCarts} onRecover={handleRecoverCart}
                onDiscard={(id) => { discardHold(id); if (heldCarts.length <= 1) setShowHeldCarts(false) }}
                onClose={() => setShowHeldCarts(false)}/>
            </Suspense>
          )}
        </div>
      </div>

      {variantSelectProduct && (
        <VariantSelectorModal key={variantSelectProduct.id} product={variantSelectProduct}
          variants={productVariants.filter(v => v.productId === variantSelectProduct.id)}
          onSelect={handleSelectVariant} onClose={() => setVariantSelectProduct(null)}/>
      )}

      {serialSelectProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-800 dark:text-slate-100">🔑 Seleccionar N° de serie</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{serialSelectProduct.name}</p>
              </div>
              <button onClick={() => { setSerialSelectProduct(null); setSerialSelectList([]) }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-3">
              {serialSelectLoading ? (
                <div className="text-center py-10 text-sm text-gray-400 dark:text-slate-500">Cargando seriales disponibles...</div>
              ) : serialSelectList.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-3xl mb-2">🔒</div>
                  <p className="text-sm text-gray-500 dark:text-slate-400 font-semibold">Sin seriales disponibles</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Registra seriales en Catálogo → Seriales</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {serialSelectList.map(serial => (
                    <button key={serial.id} onClick={() => handleSelectSerial(serial)}
                      className="w-full text-left p-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-gray-800 dark:text-slate-100 group-hover:text-purple-700 dark:group-hover:text-purple-300">
                          {serial.serialNumber}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full font-semibold">
                          Disponible
                        </span>
                      </div>
                      {serial.notes && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 truncate">{serial.notes}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-gray-100 dark:border-slate-700 shrink-0">
              <p className="text-xs text-center text-gray-400 dark:text-slate-500">
                {serialSelectList.length} serial(es) disponible(s)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
