/**
 * Returns.jsx — Módulo de Devoluciones v2 (rediseñado)
 * Ruta: src/features/returns/Returns.jsx
 *
 * Cambios vs v1:
 *  - Layout 2 columnas: proceso (izq) + panel resumen sticky (der)
 *  - KPIs expandidos con tendencia y monto total histórico
 *  - Buscador con resultados rápidos de ventas recientes
 *  - Tabla de ítems más espaciosa y clara
 *  - Panel derecho sticky con desglose en tiempo real
 *  - Historial rediseñado con cards y mejor tipografía
 *  - Estados visuales más expresivos por cada paso del flujo
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useStore } from '../../store/index'
import { returnService, clientService, productService, serialService } from '../../services/index'
import { api, USE_API } from '../../services/_base'
import { formatCurrency, formatDate, formatDateTime } from '../../shared/utils/helpers'
import { calcStockDisponible } from '../../shared/utils/inventoryEngine'
import toast from 'react-hot-toast'
import CreditNoteModal from './components/CreditNoteModal'

// ─── Constantes ───────────────────────────────────────────────────────────────
const RETURN_REASONS = [
  { value: 'defectuoso',   label: 'Producto defectuoso',    short: 'Defectuoso',  icon: '⚠️',  color: 'amber' },
  { value: 'vencido',      label: 'Producto vencido',        short: 'Vencido',     icon: '📅',  color: 'red'   },
  { value: 'equivocado',   label: 'Cobro / producto errado', short: 'Error cobro', icon: '🔄',  color: 'blue'  },
  { value: 'insatisfecho', label: 'Cliente insatisfecho',    short: 'Insatisfecho',icon: '😞',  color: 'gray'  },
  { value: 'incompleto',   label: 'Producto incompleto',     short: 'Incompleto',  icon: '📦',  color: 'orange'},
  { value: 'otro',         label: 'Otro motivo',             short: 'Otro',        icon: '📝',  color: 'gray'  },
]

const REASON_COLORS = {
  amber:  { sel: 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',  idle: 'border-gray-200 dark:border-slate-600 hover:border-amber-200 hover:bg-amber-50/40' },
  red:    { sel: 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',            idle: 'border-gray-200 dark:border-slate-600 hover:border-red-200 hover:bg-red-50/40'    },
  blue:   { sel: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',       idle: 'border-gray-200 dark:border-slate-600 hover:border-blue-200 hover:bg-blue-50/40'  },
  orange: { sel: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300', idle: 'border-gray-200 dark:border-slate-600 hover:border-orange-200 hover:bg-orange-50/40' },
  gray:   { sel: 'border-gray-400 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200',       idle: 'border-gray-200 dark:border-slate-600 hover:border-gray-300 hover:bg-gray-50'     },
}

const HALF_UP = (n) => Math.floor(Number(n) * 100 + 0.5) / 100

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcItemNetUnitPrice(item) {
  if (item.netTotal != null && item.quantity > 0) {
    return HALF_UP(item.netTotal / item.quantity)
  }
  const gross    = item.quantity * item.unitPrice
  const discount = item.totalDiscount != null
    ? item.totalDiscount
    : (item.discount || 0) + (item.campaignDiscount || 0)
  return HALF_UP(Math.max(0, gross - discount) / item.quantity)
}

function getReturnableQty(item, existingReturns, saleId) {
  const already = (existingReturns || [])
    .filter(r => r.status !== 'anulada' && r.saleId === saleId)
    .flatMap(r => r.items)
    .filter(ri => {
      // Variante: identificar por variantId para no contaminar otras variantes del mismo producto
      if (item.variantId && ri.variantId) return ri.variantId === item.variantId
      if (item.variantId || ri.variantId)  return false  // uno tiene variante y el otro no → son distintos
      // Sin variante: identificar por id de línea o por productId
      return ri.saleItemId === item.id || ri.productId === item.productId
    })
    .reduce((acc, ri) => acc + ri.quantity, 0)
  return Math.max(0, item.quantity - already)
}

/**
 * Restaura el stock de un producto respetando su estrategia de control de inventario.
 * Equivalente a lo que hace saleService.cancel() pero para devoluciones parciales.
 *
 * @param {Object}   product      - Producto fresco del store
 * @param {number}   qty          - Unidades a restaurar
 * @param {string|null} batchId   - ID del lote (para lote_fefo / lote_fifo)
 * @param {string|null} batchNum  - Número de lote / número de serie (para serie)
 * @param {Function} updateProduct - Acción del store
 */
async function _restoreProductStock(product, qty, batchId, batchNum, updateProduct) {
  const ctrl = product.stockControl || 'simple'

  if ((ctrl === 'lote_fefo' || ctrl === 'lote_fifo') && batchId) {
    // Restaurar cantidad exacta en el lote específico
    const updatedBatches = (product.batches || []).map(batch => {
      if (batch.id !== batchId) return batch
      const restored = (batch.quantity || 0) + qty
      return {
        ...batch,
        quantity: restored,
        status: batch.status === 'agotado' && restored > 0 ? 'activo' : batch.status,
      }
    })
    const newStock = updatedBatches
      .filter(b => b.status !== 'agotado' && b.status !== 'merma')
      .reduce((sum, b) => sum + (b.quantity || 0), 0)
    updateProduct(product.id, { batches: updatedBatches, stock: newStock })

  } else if (ctrl === 'serie' && batchNum) {
    // Restaurar el serial en la tabla de seriales (lo marca como disponible y recalcula stock)
    await serialService.markAvailable(product.id, batchNum)

  } else {
    // Simple (o lote sin batchId conocido): incrementar stock directo
    updateProduct(product.id, { stock: product.stock + qty })
  }
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    completada:    { label: 'Completada',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    pendiente:     { label: 'Pendiente',     cls: 'bg-amber-100 text-amber-700' },
    cancelada:     { label: 'Cancelada',     cls: 'bg-red-100 text-red-600' },
    devolucion:    { label: 'Dev. total',    cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
    'dev-parcial': { label: 'Dev. parcial',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  }
  const c = cfg[status] || { label: status, cls: 'bg-gray-100 text-gray-500' }
  return <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${c.cls}`}>{c.label}</span>
}

function StepDot({ n, active, done }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
      done   ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200' :
      active ? 'bg-violet-600 text-white shadow-sm shadow-violet-200' :
               'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-slate-400'
    }`}>
      {done ? (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      ) : n}
    </div>
  )
}

function KpiCard({ label, value, sub, color = 'gray', icon }) {
  const colors = {
    purple: 'from-violet-500/10 to-purple-500/5 border-violet-200 dark:border-violet-800',
    red:    'from-red-500/10 to-rose-500/5 border-red-200 dark:border-red-800',
    green:  'from-emerald-500/10 to-green-500/5 border-emerald-200 dark:border-emerald-800',
    gray:   'from-gray-500/10 to-slate-500/5 border-gray-200 dark:border-slate-700',
    blue:   'from-blue-500/10 to-sky-500/5 border-blue-200 dark:border-blue-800',
  }
  const textColors = {
    purple: 'text-violet-700 dark:text-violet-300',
    red:    'text-red-600 dark:text-red-400',
    green:  'text-emerald-700 dark:text-emerald-400',
    gray:   'text-gray-700 dark:text-slate-300',
    blue:   'text-blue-700 dark:text-blue-300',
  }
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${colors[color]} p-4 sm:p-5 flex flex-col gap-1 overflow-hidden min-w-0`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide leading-tight">{label}</span>
        <span className="text-lg shrink-0 ml-1">{icon}</span>
      </div>
      <p className={`text-xl sm:text-3xl font-black tracking-tight truncate ${textColors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Returns() {
  const {
    sales, clients, products,
    returns: existingReturns = [],
    addReturn, updateSale, updateProduct, addAuditLog,
    businessConfig, systemConfig, currentUser,
  } = useStore()

  useEffect(() => {
    if (USE_API) {
      returnService.getAll()
      clientService.getAll()
      productService.getAll()
    }
  }, [])

  const [step, setStep]             = useState('search')
  const [query, setQuery]           = useState('')
  const [foundSale, setFoundSale]   = useState(null)
  const [selected, setSelected]     = useState({})
  const [reason, setReason]         = useState('')
  const [reasonNote, setReasonNote] = useState('')
  const [creditNote, setCreditNote] = useState(null)
  const [showNC, setShowNC]         = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all')
  const [showRecent, setShowRecent] = useState(false)

  // Ventas recientes con comprobante emitido (para búsqueda rápida)
  // Incluye 'devolucion' para permitir consultar comprobantes ya devueltos
  const RETURNABLE_STATUSES = new Set(['completada', 'dev-parcial', 'devolucion'])
  const recentSales = useMemo(() =>
    [...sales]
      .filter(s => RETURNABLE_STATUSES.has(s.status))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8)
  , [sales])

  // Ventas filtradas por query
  const searchSuggestions = useMemo(() => {
    if (!query.trim() || query.trim().length < 2) return []
    const q = query.trim().toUpperCase()
    return sales
      .filter(s =>
        RETURNABLE_STATUSES.has(s.status) &&
        (s.invoiceNumber?.toUpperCase().includes(q) ||
         clients.find(c => c.id === s.clientId)?.name?.toUpperCase().includes(q))
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
  }, [query, sales, clients])

  // KPIs
  const kpis = useMemo(() => {
    const all    = existingReturns || []
    const active = all.filter(r => r.status !== 'anulada')
    const today  = new Date().toDateString()
    const todayR = active.filter(r => new Date(r.createdAt).toDateString() === today)
    const totalAmt  = HALF_UP(active.reduce((a, r) => a + r.totalRefund, 0))
    const todayAmt  = HALF_UP(todayR.reduce((a, r) => a + r.totalRefund, 0))
    return { total: all.length, todayCount: todayR.length, totalAmt, todayAmt }
  }, [existingReturns])

  const returnHistory = useMemo(() => {
    let list = [...(existingReturns || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    if (historyFilter === 'today') {
      const today = new Date().toDateString()
      list = list.filter(r => new Date(r.createdAt).toDateString() === today)
    }
    return list
  }, [existingReturns, historyFilter])

  // Items de la venta: productos simples tal cual; bundles se expanden en sus
  // componentes con precio prorrateado según el peso relativo de cada componente.
  const selectedItems = useMemo(() => {
    if (!foundSale) return []
    const allItems      = foundSale.items || []
    const bundleParents = allItems.filter(i => i.isBundle)
    const regularItems  = allItems.filter(i => !i._fromBundle && !i.fromBundle && !i.isBundle)
    const result        = []

    // ── Productos simples ──────────────────────────────────────────────────────
    regularItems.forEach(item => {
      result.push({
        ...item,
        returnableQty:      getReturnableQty(item, existingReturns, foundSale.id),
        selectedQty:        selected[item.id] || 0,
        netUnitPrice:       calcItemNetUnitPrice(item),
        _isBundleComponent: false,
      })
    })

    // ── Bundles → expandir a componentes con precio prorrateado ───────────────
    bundleParents.forEach(bundleItem => {
      const bundleProduct = products.find(p => p.id === bundleItem.productId)
      const componentDefs = bundleProduct?.components || bundleItem.components || []
      const compSaleItems = allItems.filter(
        si => si._fromBundle === bundleItem.productId || si.fromBundle === bundleItem.productId
      )

      if (compSaleItems.length === 0 && componentDefs.length === 0) {
        // Sin datos de componentes → tratar el bundle como ítem simple
        result.push({
          ...bundleItem,
          returnableQty:      getReturnableQty(bundleItem, existingReturns, foundSale.id),
          selectedQty:        selected[bundleItem.id] || 0,
          netUnitPrice:       calcItemNetUnitPrice(bundleItem),
          _isBundleComponent: false,
        })
        return
      }

      // Peso total del bundle = Σ(priceSell_comp × qty_comp_por_bundle)
      const totalWeight = componentDefs.reduce((sum, c) => {
        const ps  = c._priceSell ?? c.priceSell ?? 0
        const qty = c.quantity   ?? 1
        return sum + ps * qty
      }, 0)

      compSaleItems.forEach(compSaleItem => {
        const compDef      = componentDefs.find(c => c.productId === compSaleItem.productId)
        const priceSell    = compDef?._priceSell ?? compDef?.priceSell ?? 0
        const qtyPerBundle = compDef?.quantity   ?? 1
        const compWeight   = priceSell * qtyPerBundle

        // Proporción de este componente dentro del bundle
        const proportion = totalWeight > 0
          ? compWeight / totalWeight
          : 1 / Math.max(compSaleItems.length, 1)

        // Monto total a devolver por este componente = precio_bundle × cant_bundle × proporción
        const totalForComp      = bundleItem.unitPrice * bundleItem.quantity * proportion
        const proratedUnitPrice = compSaleItem.quantity > 0
          ? HALF_UP(totalForComp / compSaleItem.quantity)
          : 0

        result.push({
          ...compSaleItem,
          netUnitPrice:       proratedUnitPrice,
          unitPrice:          proratedUnitPrice,
          _isBundleComponent: true,
          _bundleId:          bundleItem.productId,
          _bundleName:        bundleItem.productName,
          _bundleUnitPrice:   bundleItem.unitPrice,
          _bundleQty:         bundleItem.quantity,
          _priceSell:         priceSell,
          _qtyPerBundle:      qtyPerBundle,
          _compWeight:        compWeight,
          _totalWeight:       totalWeight,
          _proportion:        proportion,
          returnableQty:      getReturnableQty(compSaleItem, existingReturns, foundSale.id),
          selectedQty:        selected[compSaleItem.id] || 0,
        })
      })
    })

    return result
  }, [foundSale, selected, existingReturns, products])

  const totalRefund = useMemo(() =>
    HALF_UP(selectedItems.reduce((acc, item) =>
      acc + item.netUnitPrice * (selected[item.id] || 0), 0
    )), [selectedItems, selected]
  )

  // Agrupa selectedItems para el render: un grupo por bundle + items regulares sueltos
  const groupedItems = useMemo(() => {
    const groups      = []
    const seenBundles = new Set()
    for (const item of selectedItems) {
      if (!item._isBundleComponent) {
        groups.push({ type: 'item', item })
      } else if (!seenBundles.has(item._bundleId)) {
        seenBundles.add(item._bundleId)
        groups.push({
          type:            'bundle',
          bundleId:        item._bundleId,
          bundleName:      item._bundleName,
          bundleUnitPrice: item._bundleUnitPrice,
          bundleQty:       item._bundleQty,
          components:      selectedItems.filter(i => i._bundleId === item._bundleId),
        })
      }
    }
    return groups
  }, [selectedItems])

  const handleSelectWholeKit = useCallback((components) => {
    setSelected(prev => {
      const updates = { ...prev }
      components.forEach(c => { updates[c.id] = c.returnableQty })
      return updates
    })
  }, [])

  const handleClearKit = useCallback((components) => {
    setSelected(prev => {
      const updates = { ...prev }
      components.forEach(c => { updates[c.id] = 0 })
      return updates
    })
  }, [])

  const hasSelection = Object.values(selected).some(q => q > 0)
  const selectedCount = Object.values(selected).reduce((a, q) => a + (q || 0), 0)

  // Búsqueda
  const handleSelectSale = useCallback((sale) => {
    if (sale.status === 'cancelada') { toast.error('Venta cancelada — no permite devoluciones'); return }
    if (sale.status === 'devolucion') { toast.error('Esta venta ya fue devuelta completamente'); return }
    setFoundSale(sale)
    setSelected({})
    setReason('')
    setReasonNote('')
    setStep('review')
    setQuery(sale.invoiceNumber)
    setShowRecent(false)
  }, [])

  const handleSearch = useCallback(() => {
    const q = query.trim().toUpperCase()
    if (!q) { toast.error('Ingresa el N° de boleta o nombre del cliente'); return }
    let sale = sales.find(s => s.invoiceNumber?.toUpperCase() === q)
    if (!sale) {
      const client = clients.find(c =>
        c.name?.toLowerCase().includes(q.toLowerCase()) ||
        c.ruc?.includes(q) || c.dni?.includes(q)
      )
      if (client) {
        sale = [...sales]
          .filter(s => s.clientId === client.id && (s.status === 'completada' || s.status === 'dev-parcial'))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      }
    }
    if (!sale) { toast.error('Venta no encontrada. Verifica el número de boleta.'); return }
    handleSelectSale(sale)
  }, [query, sales, clients, handleSelectSale])

  const handleQtyChange = useCallback((itemId, qty, max) => {
    const v = Math.max(0, Math.min(parseInt(qty) || 0, max))
    setSelected(prev => ({ ...prev, [itemId]: v }))
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!hasSelection) { toast.error('Selecciona al menos un producto'); return }
    if (!reason)       { toast.error('Selecciona el motivo de devolución'); return }

    const now     = new Date().toISOString()
    const ncItems = selectedItems
      .filter(i => (selected[i.id] || 0) > 0)
      .map(i => {
        const saleItem   = foundSale.items?.find(si => si.id === i.id)
        const firstBatch = saleItem?.batchAllocations?.[0] ?? null
        return {
          saleItemId:         i.id,
          productId:          i.productId,
          variantId:          i.variantId || null,
          productName:        i._isBundleComponent
                                ? `${i.productName} (Kit: ${i._bundleName})`
                                : i.productName,
          barcode:            i.barcode,
          quantity:           selected[i.id],
          unitPrice:          i.unitPrice,
          netUnitPrice:       i.netUnitPrice,
          discount:           i.discount || 0,
          _isBundleComponent: i._isBundleComponent || false,
          _bundleId:          i._bundleId || null,
          _bundleName:        i._bundleName || null,
          totalRefund:  HALF_UP(i.netUnitPrice * selected[i.id]),
          unit:         i.unit || 'unidad',
          batchId:      firstBatch?.batchId     ?? null,
          batchNumber:  firstBatch?.batchNumber ?? null,
          expiryDate:   firstBatch?.expiryDate  ?? null,
        }
      })

    const igvRate       = parseFloat(systemConfig?.igvRate ?? businessConfig?.igvRate ?? 0.18)
    const baseImponible = HALF_UP(totalRefund / (1 + igvRate))
    const igv           = HALF_UP(totalRefund - baseImponible)
    const ncNumber      = useStore.getState().getNextInvoice('NC001')

    // NC va a SUNAT solo si el comprobante origen era boleta o factura (no ticket)
    const originalTipo  = foundSale.tipoComprobante || 'boleta'
    const ncSunatStatus = originalTipo === 'ticket' ? null : 'pendiente'

    const nc = {
      id: crypto.randomUUID(), ncNumber,
      saleId: foundSale.id, invoiceNumber: foundSale.invoiceNumber,
      tipoComprobante: 'nc',
      clientId: foundSale.clientId,
      clientName: clients.find(c => c.id === foundSale.clientId)?.name || null,
      userId: currentUser?.id,
      userName: currentUser?.fullName || currentUser?.username,
      reason, reasonLabel: RETURN_REASONS.find(r => r.value === reason)?.label || reason,
      reasonNote: reasonNote.trim(),
      items: ncItems, totalRefund, baseImponible, igv, igvRate,
      status: 'completada', sunatStatus: ncSunatStatus, createdAt: now,
    }

    // Persistir en backend (debe ir antes de actualizar el store local)
    if (USE_API && navigator.onLine) {
      try {
        // Payload limpio: solo campos que el backend acepta, nulls → ''
        const apiPayload = {
          saleId:          nc.saleId,
          invoiceNumber:   nc.invoiceNumber || '',
          tipoComprobante: nc.tipoComprobante || 'nc',
          clientId:        nc.clientId || undefined,
          clientName:      nc.clientName || '',
          reason:          nc.reason,
          reasonLabel:     nc.reasonLabel || '',
          reasonNote:      nc.reasonNote  || '',
          totalRefund:     nc.totalRefund,
          igvRate:         nc.igvRate,
          items: ncItems.map(i => ({
            saleItemId:   i.saleItemId   || undefined,
            productId:    i.productId,
            productName:  i.productName  || '',
            barcode:      i.barcode      || '',
            quantity:     i.quantity,
            unitPrice:    i.unitPrice    ?? 0,
            netUnitPrice: i.netUnitPrice ?? 0,
            discount:     i.discount     ?? 0,
            totalRefund:  i.totalRefund  ?? 0,
            unit:         i.unit         || 'unidad',
            batchId:      i.batchId      || '',
            batchNumber:  i.batchNumber  || '',
            expiryDate:   i.expiryDate   || '',
          })),
        }
        await api.post('/returns', apiPayload)
      } catch (err) {
        toast.error(`NC generada localmente — no pudo sincronizarse: ${err.response?.data?.message || err.message}`)
      }
    }

    addReturn(nc)

    for (const ncItem of ncItems) {
      const product = products.find(p => p.id === ncItem.productId)
      if (!product) continue

      if (ncItem._isBundleComponent) {
        // Componente de bundle devuelto individualmente → restaurar stock del componente
        await _restoreProductStock(product, ncItem.quantity, ncItem.batchId, ncItem.batchNumber, updateProduct)

      } else if (product.type === 'bundle') {
        // Bundle completo devuelto (ruta antigua) → restaurar todos sus componentes
        for (const comp of (product.components || [])) {
          const { products: freshProducts } = useStore.getState()
          const cp = freshProducts.find(p => p.id === comp.productId)
          if (!cp) continue
          const compSaleItem = foundSale.items?.find(
            si => (si._fromBundle === ncItem.productId || si.fromBundle === ncItem.productId) && si.productId === comp.productId
          )
          const compBatchId  = compSaleItem?.batchAllocations?.[0]?.batchId     ?? null
          const compBatchNum = compSaleItem?.batchAllocations?.[0]?.batchNumber  ?? null
          const restoreQty   = comp.quantity * ncItem.quantity
          await _restoreProductStock(cp, restoreQty, compBatchId, compBatchNum, updateProduct)
        }

      } else if (ncItem.variantId) {
        // Producto con variante → restaurar stock en la variante (updateVariant sincroniza el padre)
        const freshState = useStore.getState()
        const variant    = freshState.productVariants?.find(v => v.id === ncItem.variantId)
        if (variant) {
          const prevStock = variant.stock ?? 0
          const newStock  = prevStock + ncItem.quantity
          freshState.updateVariant(ncItem.variantId, { stock: newStock })
          freshState.addStockMovement({
            id: crypto.randomUUID(),
            productId:    ncItem.productId,
            productName:  ncItem.productName,
            variantId:    ncItem.variantId,
            type:         'entrada',
            quantity:     ncItem.quantity,
            previousStock: prevStock,
            newStock,
            reason:       `Devolución NC ${nc.ncNumber}`,
            userId:       currentUser?.id,
            createdAt:    now,
          })
        }

      } else {
        // Producto regular → respetar la estrategia de control de inventario
        await _restoreProductStock(product, ncItem.quantity, ncItem.batchId, ncItem.batchNumber, updateProduct)
      }
    }

    // Recalcular stock de cada bundle afectado por la devolución de componentes
    const affectedBundleIds = [...new Set(ncItems.filter(i => i._isBundleComponent).map(i => i._bundleId).filter(Boolean))]
    affectedBundleIds.forEach(bundleId => {
      const { products: freshProds } = useStore.getState()
      const freshBundle = freshProds.find(p => p.id === bundleId)
      if (!freshBundle?.components?.length) return
      const newBundleStock = Math.floor(
        Math.min(...freshBundle.components.map(comp => {
          const cp = freshProds.find(p => p.id === comp.productId)
          return cp && comp.quantity > 0
            ? Math.floor(calcStockDisponible(cp) / comp.quantity)
            : 0
        }))
      )
      updateProduct(bundleId, { stock: newBundleStock })
    })

    // Determinar si la venta quedó completamente devuelta:
    // comparar cada ítem seleccionable (expandido) contra las devoluciones acumuladas.
    const allNcItems = [
      ...(existingReturns || []).filter(r => r.saleId === foundSale.id && r.status !== 'anulada'),
      nc,
    ].flatMap(r => r.items)

    const isFullyReturned = selectedItems.every(item => {
      const returned = allNcItems
        .filter(ri => ri.saleItemId === item.id || ri.productId === item.productId)
        .reduce((acc, ri) => acc + (ri.quantity || 0), 0)
      return returned >= item.quantity
    })

    updateSale(foundSale.id, {
      status: isFullyReturned ? 'devolucion' : 'dev-parcial',
    })

    addAuditLog({
      action: 'CREATE', module: 'Devoluciones',
      detail: `NC ${ncNumber} — ${foundSale.invoiceNumber} — S/${totalRefund} — ${nc.reasonLabel}`,
      entityId: nc.id,
    })

    setCreditNote(nc)
    setStep('done')
    setShowNC(true)
    toast.success(`Nota de Crédito ${ncNumber} generada`, { duration: 4000, icon: '✅' })
  }, [
    hasSelection, reason, reasonNote, selectedItems, selected, totalRefund,
    foundSale, existingReturns, clients, currentUser, systemConfig, businessConfig,
    products, addReturn, updateSale, updateProduct, addAuditLog,
  ])

  const handleReset = () => {
    setStep('search'); setQuery(''); setFoundSale(null)
    setSelected({}); setReason(''); setReasonNote('')
    setCreditNote(null); setShowNC(false)
  }

  const isFlowActive = step !== 'search' || !!foundSale

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-6 space-y-5 sm:space-y-6">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-xl">↩️</div>
          <div>
            <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Devoluciones</h1>
            <p className="text-sm text-gray-400 dark:text-slate-500">Gestión de devoluciones y emisión de Notas de Crédito</p>
          </div>
        </div>
        {step === 'done' && creditNote && (
          <div className="flex gap-2">
            <button onClick={() => setShowNC(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors">
              🖨️ Imprimir NC
            </button>
            <button onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
              + Nueva devolución
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="NCs hoy"         value={kpis.todayCount}               icon="📋" color="purple"
          sub={kpis.todayCount === 0 ? 'Sin devoluciones hoy' : `${kpis.todayCount} emitida${kpis.todayCount > 1 ? 's' : ''}`}/>
        <KpiCard label="Reembolsado hoy" value={formatCurrency(kpis.todayAmt)} icon="💸" color="red"
          sub="Precio neto pagado"/>
        <KpiCard label="Total histórico" value={kpis.total}                    icon="📂" color="blue"
          sub="Notas de crédito emitidas"/>
        <KpiCard label="Monto total"     value={formatCurrency(kpis.totalAmt)} icon="🔢" color="green"
          sub="Acumulado reembolsado"/>
      </div>

      {/* ── CONTENIDO ──────────────────────────────────────────────────────── */}
      <div className={`flex gap-6 ${isFlowActive ? 'items-start' : ''}`}>

          {/* ════════════════════════════════════════════════════════════════
              COLUMNA IZQUIERDA — Flujo del proceso
          ════════════════════════════════════════════════════════════════ */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* ─── PASO 1: BUSCAR VENTA ─────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
              {/* Título del paso */}
              <div className={`px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3 ${
                step !== 'search' ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-white dark:bg-slate-800'
              }`}>
                <StepDot n="1" active={step === 'search'} done={step !== 'search'}/>
                <div>
                  <h2 className="text-sm font-bold text-gray-800 dark:text-slate-100">Identificar venta</h2>
                  <p className="text-xs text-gray-400 dark:text-slate-500">El cliente debe presentar el ticket de compra original</p>
                </div>
              </div>

              <div className="p-6">
                {/* Buscador */}
                <div className="relative">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                      </svg>
                      <input
                        value={query}
                        onChange={e => { setQuery(e.target.value); setShowRecent(true) }}
                        onFocus={() => setShowRecent(true)}
                        onKeyDown={e => { if (e.key === 'Enter') { setShowRecent(false); handleSearch() } if (e.key === 'Escape') setShowRecent(false) }}
                        placeholder="N° boleta (B001-000001) o nombre del cliente..."
                        className="w-full pl-11 pr-4 py-3 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-gray-50 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 transition-all"
                      />
                      {query && (
                        <button onClick={() => { setQuery(''); setShowRecent(false) }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 hover:text-gray-600 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    <button onClick={() => { setShowRecent(false); handleSearch() }}
                      className="px-6 py-3 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 active:bg-violet-800 transition-colors flex items-center gap-2 shadow-sm shadow-violet-200 dark:shadow-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                      </svg>
                      Buscar
                    </button>
                  </div>

                  {/* Dropdown de sugerencias */}
                  {showRecent && (searchSuggestions.length > 0 || (!query && recentSales.length > 0)) && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                          {query ? 'Coincidencias' : 'Ventas recientes'}
                        </span>
                        <button onClick={() => setShowRecent(false)} className="text-xs text-gray-400 hover:text-gray-600">Cerrar</button>
                      </div>
                      {(query ? searchSuggestions : recentSales).map(sale => {
                        const client = clients.find(c => c.id === sale.clientId)
                        return (
                          <button key={sale.id} onClick={() => handleSelectSale(sale)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors text-left border-b border-gray-50 dark:border-slate-700/50 last:border-0">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-sm">🧾</div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-violet-600 dark:text-violet-400 font-mono">{sale.invoiceNumber}</p>
                                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                                  {client?.name || 'Consumidor final'} · {formatDate(sale.createdAt)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <StatusBadge status={sale.status}/>
                              <span className="text-sm font-bold text-gray-700 dark:text-slate-300">{formatCurrency(sale.total)}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Venta encontrada */}
                {foundSale && (
                  <div className="mt-4 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-900/10 overflow-hidden">
                    <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-violet-700 dark:text-violet-300 text-base">{foundSale.invoiceNumber}</span>
                          <StatusBadge status={foundSale.status}/>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-slate-400">{formatDateTime(foundSale.createdAt)}</p>
                        <p className="text-sm text-gray-700 dark:text-slate-300">
                          <span className="text-gray-400">Cliente: </span>
                          <strong>{clients.find(c => c.id === foundSale.clientId)?.name || 'Consumidor final'}</strong>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-xs text-gray-400 dark:text-slate-500">Total pagado</p>
                        <p className="text-lg sm:text-2xl font-black text-violet-700 dark:text-violet-300 truncate">{formatCurrency(foundSale.total)}</p>
                        <p className="text-xs text-gray-400">{foundSale.items?.length} producto(s) · {foundSale.items?.reduce((a,i)=>a+i.quantity,0)} unidades</p>
                      </div>
                    </div>
                    {/* Mini productos */}
                    <div className="border-t border-violet-200/60 dark:border-violet-800/60 px-5 py-3 bg-white/50 dark:bg-slate-900/20 flex flex-wrap gap-2">
                      {foundSale.items?.filter(i => !i._fromBundle && !i.fromBundle).map((item, idx) => (
                        <span key={idx} className="text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 text-gray-600 dark:text-slate-400">
                          {item.quantity}× {item.productName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── PASO 2: SELECCIÓN DE ÍTEMS ─────────────────────────── */}
            {(step === 'review' || step === 'done') && foundSale && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className={`px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3 ${
                  step === 'done' ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''
                }`}>
                  <StepDot n="2" active={step === 'review'} done={step === 'done'}/>
                  <div>
                    <h2 className="text-sm font-bold text-gray-800 dark:text-slate-100">Seleccionar productos a devolver</h2>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Indica cuántas unidades de cada producto se devuelven</p>
                  </div>
                </div>

                <div className="p-6">
                  {/* Aviso bundles con prorrateo */}
                  {selectedItems.some(i => i._isBundleComponent) && (
                    <div className="mb-4 flex items-start gap-3 p-3.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-xs text-orange-700 dark:text-orange-300">
                      <span className="text-base shrink-0">🎁</span>
                      <div>
                        <p className="font-semibold mb-1">Kit detectado — devolución por componente con prorrateo</p>
                        <p className="mb-1">El monto a reembolsar por cada componente se calcula según su <strong>peso relativo</strong> dentro del precio del kit:</p>
                        <p className="font-mono bg-orange-100/60 dark:bg-orange-900/40 rounded px-2 py-1 text-[10px] leading-relaxed">
                          Precio/u = Precio kit × (PVP_comp × cant_comp ÷ Σ PVP×cant de todos) ÷ cant_comp
                        </p>
                        <p className="mt-1">El stock de cada componente devuelto se restaura individualmente. Si está dañado y no puede reingresarse, regístralo en <strong>Merma</strong> después.</p>
                      </div>
                    </div>
                  )}

                  {/* Cabecera columnas */}
                  <div className="grid gap-4 px-4 py-2.5 mb-3 rounded-xl bg-gray-50 dark:bg-slate-700/40 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide"
                    style={{ gridTemplateColumns: '1fr 100px 70px 70px 100px' }}>
                    <span>Producto</span>
                    <span className="text-right">Precio / ud.</span>
                    <span className="text-center">Comprado</span>
                    <span className="text-center">Disponible</span>
                    <span className="text-center">A devolver</span>
                  </div>

                  <div className="space-y-3">
                    {groupedItems.map(group => {
                      if (group.type === 'item') {
                        const item            = group.item
                        const qty             = selected[item.id] || 0
                        const isSelected      = qty > 0
                        const isFullyReturned = item.returnableQty === 0
                        const hasDiscount     = (item.discount || item.campaignDiscount || item.totalDiscount) > 0
                        return (
                          <div key={item.id}
                            className={`grid gap-4 items-center px-4 py-3.5 rounded-xl border transition-all ${
                              isFullyReturned ? 'border-gray-100 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-700/10 opacity-60' :
                              isSelected      ? 'border-violet-200 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-900/10 shadow-sm' :
                                                'border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 bg-gray-50/40 dark:bg-slate-700/20'
                            }`}
                            style={{ gridTemplateColumns: '1fr 100px 70px 70px 100px' }}>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 leading-tight">{item.productName}</p>
                              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{item.barcode} · {item.unit}</p>
                              {hasDiscount && <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-md font-medium">🏷️ Con descuento</span>}
                              {isFullyReturned && <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md font-medium">✓ Ya devuelto</span>}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-700 dark:text-slate-200">{formatCurrency(item.netUnitPrice)}</p>
                              {hasDiscount && <p className="text-xs text-gray-400 line-through">{formatCurrency(item.unitPrice)}</p>}
                            </div>
                            <div className="text-center"><span className="text-sm font-semibold text-gray-600 dark:text-slate-300">{item.quantity}</span></div>
                            <div className="text-center">
                              <span className={`text-sm font-bold ${item.returnableQty === 0 ? 'text-gray-300 dark:text-slate-600' : item.returnableQty < item.quantity ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-slate-300'}`}>{item.returnableQty}</span>
                            </div>
                            <div className="flex items-center justify-center gap-1">
                              {item.returnableQty > 0 ? (
                                <>
                                  <button onClick={() => handleQtyChange(item.id, qty - 1, item.returnableQty)} className={`w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${qty > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200' : 'bg-gray-100 dark:bg-slate-600 text-gray-400 dark:text-slate-500'}`}>−</button>
                                  <span className={`w-8 text-center text-sm font-black select-none ${qty > 0 ? 'text-violet-700 dark:text-violet-300' : 'text-gray-400 dark:text-slate-500'}`}>{qty}</span>
                                  <button onClick={() => handleQtyChange(item.id, qty + 1, item.returnableQty)} disabled={qty >= item.returnableQty} className={`w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${qty < item.returnableQty ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200' : 'bg-gray-100 dark:bg-slate-600 text-gray-300 dark:text-slate-600 cursor-not-allowed'}`}>+</button>
                                </>
                              ) : (
                                <span className="text-xs text-gray-300 dark:text-slate-600 italic font-medium">N/D</span>
                              )}
                            </div>
                          </div>
                        )
                      }

                      // ── Grupo Bundle ─────────────────────────────────────────────
                      const { bundleId, bundleName, bundleUnitPrice, bundleQty, components } = group
                      const allAvailable    = components.some(c => c.returnableQty > 0)
                      const kitSelected     = components.every(c => c.returnableQty === 0 || (selected[c.id] || 0) >= c.returnableQty)
                      const anyCompSelected = components.some(c => (selected[c.id] || 0) > 0)

                      return (
                        <div key={bundleId} className="rounded-xl border border-orange-200 dark:border-orange-800 overflow-hidden">
                          {/* Cabecera del bundle */}
                          <div className="flex items-center justify-between px-4 py-2.5 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-800/60">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">🎁</span>
                              <div className="min-w-0">
                                <span className="text-sm font-bold text-orange-800 dark:text-orange-300 truncate">{bundleName}</span>
                                <span className="ml-2 text-xs text-orange-500 dark:text-orange-400">
                                  {bundleQty > 1 ? `${bundleQty}× ` : ''}{formatCurrency(bundleUnitPrice)} c/u
                                </span>
                              </div>
                            </div>
                            {allAvailable && (
                              <div className="flex gap-2 shrink-0">
                                {anyCompSelected && (
                                  <button onClick={() => handleClearKit(components)}
                                    className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                                    Limpiar
                                  </button>
                                )}
                                <button onClick={() => handleSelectWholeKit(components)}
                                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                                    kitSelected
                                      ? 'bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-200'
                                      : 'bg-orange-600 text-white hover:bg-orange-700'
                                  }`}>
                                  {kitSelected ? '✓ Kit completo' : 'Devolver kit completo'}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Componentes */}
                          <div className="divide-y divide-orange-50 dark:divide-orange-900/20">
                            {components.map(item => {
                              const qty             = selected[item.id] || 0
                              const isSelected      = qty > 0
                              const isFullyReturned = item.returnableQty === 0
                              const pct = item._totalWeight > 0
                                ? ((item._compWeight / item._totalWeight) * 100).toFixed(1)
                                : (100 / Math.max(components.length, 1)).toFixed(1)
                              const formula = item._totalWeight > 0
                                ? `${formatCurrency(item._bundleUnitPrice)} × (${formatCurrency(item._priceSell)} × ${item._qtyPerBundle}u = ${formatCurrency(item._compWeight)} ÷ total ${formatCurrency(item._totalWeight)}) = ${pct}% → ${formatCurrency(item.netUnitPrice)}/u`
                                : `Distribución equitativa (${pct}%) → ${formatCurrency(item.netUnitPrice)}/u`

                              return (
                                <div key={item.id}
                                  className={`grid gap-4 items-start px-4 py-3 transition-all ${
                                    isFullyReturned ? 'opacity-50 bg-gray-50/30 dark:bg-slate-700/10' :
                                    isSelected      ? 'bg-violet-50/40 dark:bg-violet-900/10' :
                                                      'bg-white dark:bg-slate-800/60 hover:bg-orange-50/30 dark:hover:bg-orange-900/10'
                                  }`}
                                  style={{ gridTemplateColumns: '1fr 100px 70px 70px 100px' }}>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs text-orange-400 shrink-0">↳</span>
                                      <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 leading-tight truncate">{item.productName}</p>
                                    </div>
                                    <p className="text-[10px] text-orange-500 dark:text-orange-400 mt-0.5 leading-relaxed pl-4 break-words">
                                      Prorrateo: {formula}
                                    </p>
                                    {isFullyReturned && <span className="inline-flex items-center gap-1 mt-1 ml-4 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md font-medium">✓ Ya devuelto</span>}
                                  </div>
                                  <div className="text-right pt-0.5">
                                    <p className="text-sm font-bold text-orange-700 dark:text-orange-300">{formatCurrency(item.netUnitPrice)}</p>
                                    <p className="text-[10px] text-gray-400 dark:text-slate-500">prorrateado</p>
                                  </div>
                                  <div className="text-center pt-1">
                                    <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">{item.quantity}</span>
                                    <p className="text-[10px] text-gray-400">{item.unit}</p>
                                  </div>
                                  <div className="text-center pt-1">
                                    <span className={`text-sm font-bold ${item.returnableQty === 0 ? 'text-gray-300 dark:text-slate-600' : item.returnableQty < item.quantity ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-slate-300'}`}>{item.returnableQty}</span>
                                  </div>
                                  <div className="flex items-center justify-center gap-1 pt-0.5">
                                    {item.returnableQty > 0 ? (
                                      <>
                                        <button onClick={() => handleQtyChange(item.id, qty - 1, item.returnableQty)} className={`w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${qty > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200' : 'bg-gray-100 dark:bg-slate-600 text-gray-400 dark:text-slate-500'}`}>−</button>
                                        <span className={`w-8 text-center text-sm font-black select-none ${qty > 0 ? 'text-violet-700 dark:text-violet-300' : 'text-gray-400 dark:text-slate-500'}`}>{qty}</span>
                                        <button onClick={() => handleQtyChange(item.id, qty + 1, item.returnableQty)} disabled={qty >= item.returnableQty} className={`w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${qty < item.returnableQty ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200' : 'bg-gray-100 dark:bg-slate-600 text-gray-300 dark:text-slate-600 cursor-not-allowed'}`}>+</button>
                                      </>
                                    ) : (
                                      <span className="text-xs text-gray-300 dark:text-slate-600 italic font-medium">N/D</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ─── PASO 3: MOTIVO ─────────────────────────────────────── */}
            {step === 'review' && foundSale && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
                  <StepDot n="3" active={step === 'review'} done={false}/>
                  <div>
                    <h2 className="text-sm font-bold text-gray-800 dark:text-slate-100">Motivo de devolución</h2>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Selecciona el motivo que aplica</p>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    {RETURN_REASONS.map(r => {
                      const c = REASON_COLORS[r.color]
                      const isSelected = reason === r.value
                      return (
                        <button key={r.value} onClick={() => setReason(r.value)}
                          className={`flex flex-col items-start gap-2 px-4 py-3.5 rounded-xl border text-left transition-all ${
                            isSelected ? c.sel : `${c.idle} text-gray-600 dark:text-slate-400`
                          }`}>
                          <span className="text-xl">{r.icon}</span>
                          <span className="text-xs font-semibold leading-tight">{r.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {reason === 'otro' && (
                    <textarea
                      value={reasonNote}
                      onChange={e => setReasonNote(e.target.value)}
                      placeholder="Describe el motivo específico..."
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 mb-4"
                    />
                  )}

                  <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300">
                    <span className="text-base shrink-0">📋</span>
                    <p><strong>Nota de Crédito Electrónica:</strong> Este documento anula parcial o totalmente la boleta original y queda registrado en el sistema de auditoría.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ─── PASO 4: CONFIRMACIÓN EXITOSA ───────────────────────── */}
            {step === 'done' && creditNote && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center text-white text-xl shadow-lg shadow-emerald-200 dark:shadow-none">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-emerald-800 dark:text-emerald-300 text-base">Nota de Crédito emitida con éxito</h3>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{creditNote.ncNumber} · Reembolso: {formatCurrency(creditNote.totalRefund)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowNC(true)}
                      className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors">
                      🖨️ Imprimir NC
                    </button>
                    <button onClick={handleReset}
                      className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                      Nueva
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              COLUMNA DERECHA — Panel resumen sticky (solo cuando hay flujo activo)
          ════════════════════════════════════════════════════════════════ */}
          {isFlowActive && (
            <div className="w-72 shrink-0 hidden lg:block">
              <div className="sticky top-6 space-y-4">

                {/* Resumen de la devolución */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-violet-50 dark:bg-violet-900/20">
                    <h3 className="text-sm font-bold text-violet-800 dark:text-violet-300">Resumen de devolución</h3>
                  </div>
                  <div className="p-5 space-y-4">

                    {/* Boleta de referencia */}
                    {foundSale && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Boleta origen</p>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-bold text-violet-600 dark:text-violet-400">{foundSale.invoiceNumber}</span>
                          <span className="text-sm text-gray-600 dark:text-slate-300">{formatCurrency(foundSale.total)}</span>
                        </div>
                        <p className="text-xs text-gray-400">{formatDate(foundSale.createdAt)}</p>
                      </div>
                    )}

                    {/* Ítems seleccionados */}
                    {hasSelection && (
                      <div className="space-y-1.5 pt-3 border-t border-gray-100 dark:border-slate-700">
                        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Productos a devolver</p>
                        {selectedItems.filter(i => (selected[i.id] || 0) > 0).map(item => (
                          <div key={item.id} className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-700 dark:text-slate-300 leading-tight truncate">{item.productName}</p>
                              <p className="text-[10px] text-gray-400">{selected[item.id]} u × {formatCurrency(item.netUnitPrice)}</p>
                            </div>
                            <span className="text-xs font-bold text-gray-700 dark:text-slate-300 shrink-0">
                              {formatCurrency(HALF_UP(item.netUnitPrice * selected[item.id]))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Motivo */}
                    {reason && (
                      <div className="pt-3 border-t border-gray-100 dark:border-slate-700">
                        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Motivo</p>
                        <div className="flex items-center gap-1.5">
                          <span>{RETURN_REASONS.find(r => r.value === reason)?.icon}</span>
                          <span className="text-xs text-gray-700 dark:text-slate-300">{RETURN_REASONS.find(r => r.value === reason)?.label}</span>
                        </div>
                      </div>
                    )}

                    {/* Total a reembolsar */}
                    <div className={`pt-4 border-t-2 ${hasSelection ? 'border-violet-200 dark:border-violet-700' : 'border-gray-100 dark:border-slate-700'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-600 dark:text-slate-400">Total a reembolsar</span>
                        <span className={`text-xl font-black ${hasSelection ? 'text-violet-700 dark:text-violet-300' : 'text-gray-300 dark:text-slate-600'}`}>
                          {hasSelection ? formatCurrency(totalRefund) : '—'}
                        </span>
                      </div>
                      {hasSelection && (
                        <p className="text-[10px] text-gray-400">Sobre precio neto pagado · {selectedCount} unidad{selectedCount > 1 ? 'es' : ''}</p>
                      )}
                    </div>

                    {/* Botón de confirmar */}
                    {step === 'review' && (
                      <button onClick={handleConfirm}
                        disabled={!hasSelection || !reason}
                        className="w-full py-3 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 active:bg-violet-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-violet-200 dark:shadow-none flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Generar Nota de Crédito
                      </button>
                    )}

                    {/* Checklist de validación */}
                    {step === 'review' && (
                      <div className="space-y-1.5 pt-1">
                        {[
                          { ok: !!foundSale,    label: 'Venta identificada' },
                          { ok: hasSelection,   label: `Productos seleccionados${hasSelection ? ` (${selectedCount})` : ''}` },
                          { ok: !!reason,       label: 'Motivo indicado' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${item.ok ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-600'}`}>
                              {item.ok && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                            </div>
                            <span className={`text-xs ${item.ok ? 'text-gray-600 dark:text-slate-300' : 'text-gray-400 dark:text-slate-500'}`}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón cancelar */}
                {step === 'review' && (
                  <button onClick={handleReset}
                    className="w-full py-2.5 text-sm text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                    Cancelar devolución
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ══ HISTORIAL DE NOTAS DE CRÉDITO ════════════════════════════════ */}
        <div className="mt-8 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-base">📋</div>
              <div>
                <h2 className="text-sm font-bold text-gray-800 dark:text-slate-100">Historial de Notas de Crédito</h2>
                <p className="text-xs text-gray-400 dark:text-slate-500">{returnHistory.length} registro{returnHistory.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {[{ val: 'all', label: 'Todas' }, { val: 'today', label: 'Hoy' }].map(f => (
                <button key={f.val} onClick={() => setHistoryFilter(f.val)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    historyFilter === f.val
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {returnHistory.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-5xl opacity-10 mb-4">📋</div>
              <p className="text-gray-400 dark:text-slate-500 text-sm font-medium">
                Sin notas de crédito {historyFilter === 'today' ? 'hoy' : 'registradas'}
              </p>
              <p className="text-gray-300 dark:text-slate-600 text-xs mt-1">Las NCs generadas aparecerán aquí</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700/40 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                    <th className="px-6 py-3.5 text-left">NC N°</th>
                    <th className="px-4 py-3.5 text-left">Boleta origen</th>
                    <th className="px-4 py-3.5 text-left">Motivo</th>
                    <th className="px-4 py-3.5 text-left">Cajero</th>
                    <th className="px-4 py-3.5 text-left">Fecha</th>
                    <th className="px-4 py-3.5 text-left">Productos</th>
                    <th className="px-6 py-3.5 text-right">Reembolso</th>
                    <th className="px-4 py-3.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/60">
                  {returnHistory.map(r => (
                    <tr key={r.id} className="hover:bg-violet-50/40 dark:hover:bg-violet-900/10 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-bold text-violet-600 dark:text-violet-400">{r.ncNumber}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-sm text-gray-600 dark:text-slate-300">{r.invoiceNumber}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{RETURN_REASONS.find(x => x.value === r.reason)?.icon || '📝'}</span>
                          <span className="text-xs text-gray-600 dark:text-slate-300">{r.reasonLabel}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-slate-300">{r.userName}</td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-gray-600 dark:text-slate-300">{formatDate(r.createdAt)}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{new Date(r.createdAt).toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' })}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {r.items?.slice(0, 2).map((item, idx) => (
                            <span key={idx} className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-medium">
                              {item.quantity}× {item.productName?.split(' ').slice(0,2).join(' ')}
                            </span>
                          ))}
                          {(r.items?.length || 0) > 2 && (
                            <span className="text-[10px] text-gray-400">+{r.items.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-base font-black text-red-600 dark:text-red-400">-{formatCurrency(r.totalRefund)}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button onClick={() => { setCreditNote(r); setShowNC(true) }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors border border-violet-200 dark:border-violet-800">
                          🖨️ Ver / Imprimir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {/* ── MODAL NC ───────────────────────────────────────────────────────── */}
      {showNC && creditNote && (
        <CreditNoteModal
          creditNote={creditNote}
          businessConfig={businessConfig}
          onClose={() => setShowNC(false)}
        />
      )}
    </div>
  )
}
