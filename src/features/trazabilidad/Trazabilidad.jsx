import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { downloadExcel } from '../../shared/utils/export'
import toast from 'react-hot-toast'

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const fmtDT = (d) =>
  d ? new Date(d).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// ── Constantes UI ──────────────────────────────────────────────────────────────
const CTRL = {
  lote_fefo: { label: 'FEFO', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  lote_fifo: { label: 'FIFO', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  serie:     { label: 'Serie', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
}

const MVT = {
  ingreso:    { label: 'Ingreso',    icon: '↑', sign: '+', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  venta:      { label: 'Venta',      icon: '↓', sign: '-', dot: 'bg-red-500',     text: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-900/20'         },
  devolucion: { label: 'Devolución', icon: '↩', sign: '+', dot: 'bg-blue-500',    text: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/20'       },
  merma:      { label: 'Merma',      icon: '⚠', sign: '-', dot: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20'     },
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function Trazabilidad() {
  const products       = useStore(s => s.products)
  const sales          = useStore(s => s.sales)
  const mermaRecords   = useStore(s => s.mermaRecords)   || []
  const returns        = useStore(s => s.returns)        || []
  const stockMovements = useStore(s => s.stockMovements) || []

  const [search,          setSearch]          = useState('')
  const [filterCtrl,      setFilterCtrl]      = useState('all')
  const [activeTab,       setActiveTab]       = useState('producto')
  const [expandedProduct, setExpandedProduct] = useState(null)
  const [expandedBatch,   setExpandedBatch]   = useState(null)

  // Productos con control de lotes
  const batchProducts = useMemo(
    () => products.filter(p => p.isActive && (p.stockControl === 'lote_fefo' || p.stockControl === 'lote_fifo' || p.stockControl === 'serie')),
    [products]
  )

  // ── Índice de movimientos por lote ──────────────────────────────────────────
  // Clave primaria: batchId (UUID). Clave secundaria: batchNumber (fallback).
  const batchIndex = useMemo(() => {
    const byId  = {}  // batchId  → { ingresos, ventas, devoluciones, merma }
    const byNum = {}  // batchNumber → same

    const ensureId  = (id) => { if (!byId[id])   byId[id]  = { ingresos: [], ventas: [], devoluciones: [], merma: [] } }
    const ensureNum = (n)  => { if (!byNum[n])    byNum[n]  = { ingresos: [], ventas: [], devoluciones: [], merma: [] } }

    // 1. Stock movements — entradas
    for (const sm of stockMovements) {
      if (sm.type !== 'entrada') continue
      if (sm.batchAllocations?.length) {
        for (const ba of sm.batchAllocations) {
          if (!ba.batchId) continue
          ensureId(ba.batchId)
          byId[ba.batchId].ingresos.push({
            date:     sm.createdAt,
            quantity: ba.quantity,
            ref:      sm.invoiceNumber || sm.reason || 'Compra / Recepción',
            user:     sm.userName || '—',
            unitCost: ba.unitCost || sm.unitCost || 0,
          })
        }
      } else if (sm.batchId) {
        ensureId(sm.batchId)
        byId[sm.batchId].ingresos.push({
          date:     sm.createdAt,
          quantity: sm.quantity,
          ref:      sm.invoiceNumber || sm.reason || 'Compra / Recepción',
          user:     sm.userName || '—',
          unitCost: sm.unitCost || 0,
        })
      }
    }

    // 2. Ventas — batchAllocations
    for (const sale of sales) {
      if (sale.status !== 'completada' && sale.status !== 'dev-parcial' && sale.status !== 'devolucion') continue
      for (const item of (sale.items || [])) {
        for (const ba of (item.batchAllocations || [])) {
          if (!ba.batchId) continue
          ensureId(ba.batchId)
          byId[ba.batchId].ventas.push({
            date:        sale.createdAt,
            quantity:    ba.quantity,
            ref:         sale.invoiceNumber,
            user:        sale.userName || '—',
            productName: item.productName,
            unitPrice:   item.unitPrice,
            clientName:  sale.clientName || null,
          })
        }
      }
    }

    // 3. Devoluciones / NCs — índice por batchId y por batchNumber (retrocompat.)
    for (const nc of returns) {
      if (nc.status === 'anulada') continue
      for (const item of (nc.items || [])) {
        const ev = {
          date:        nc.createdAt,
          quantity:    item.quantity,
          ref:         nc.ncNumber,
          saleRef:     nc.invoiceNumber,
          user:        nc.userName || '—',
          reason:      nc.reasonLabel,
          productName: item.productName,
        }
        if (item.batchId) {
          ensureId(item.batchId)
          byId[item.batchId].devoluciones.push(ev)
        } else if (item.batchNumber) {
          ensureNum(item.batchNumber)
          byNum[item.batchNumber].devoluciones.push(ev)
        }
      }
    }

    // 4. Merma — índice por batchId y por batchNumber
    for (const mr of mermaRecords) {
      const ev = {
        date:     mr.createdAt,
        quantity: mr.quantity,
        ref:      mr.ncNumber || mr.invoiceRef || '—',
        user:     mr.userName || '—',
        reason:   mr.reason,
        unitCost: mr.unitCost || 0,
        status:   mr.status,
      }
      if (mr.batchId) {
        ensureId(mr.batchId)
        byId[mr.batchId].merma.push(ev)
      } else if (mr.batchNumber) {
        ensureNum(mr.batchNumber)
        byNum[mr.batchNumber].merma.push(ev)
      }
    }

    return { byId, byNum }
  }, [sales, returns, mermaRecords, stockMovements])

  // Obtener movimientos de un lote (fusionando byId y byNum)
  const getBatchData = (batchId, batchNumber) => {
    const a = batchIndex.byId[batchId]   || { ingresos: [], ventas: [], devoluciones: [], merma: [] }
    const b = batchIndex.byNum[batchNumber] || { ingresos: [], ventas: [], devoluciones: [], merma: [] }
    return {
      ingresos:    [...a.ingresos,    ...b.ingresos],
      ventas:      [...a.ventas,      ...b.ventas],
      devoluciones:[...a.devoluciones,...b.devoluciones],
      merma:       [...a.merma,       ...b.merma],
    }
  }

  // Timeline de un lote ordenado cronológicamente
  const getBatchTimeline = (batch) => {
    const data  = getBatchData(batch.id, batch.batchNumber)
    const events = []

    // Ingresos explícitos de stockMovements
    data.ingresos.forEach(m => events.push({ ...m, type: 'ingreso' }))

    // Si no hay ingreso explícito → ingreso implícito a partir de la fecha de creación del lote
    if (!data.ingresos.length) {
      const sold    = data.ventas.reduce((s, v) => s + v.quantity, 0)
      const ret     = data.devoluciones.reduce((s, v) => s + v.quantity, 0)
      const mermaQ  = data.merma.reduce((s, v) => s + v.quantity, 0)
      const initQty = batch.quantity + sold - ret + mermaQ
      events.push({
        type:     'ingreso',
        date:     batch.createdAt || new Date().toISOString(),
        quantity: Math.max(initQty, batch.quantity),
        ref:      'Creación de lote',
        user:     '—',
        unitCost: batch.priceBuy || 0,
        implicit: true,
      })
    }

    data.ventas.forEach(m       => events.push({ ...m, type: 'venta'      }))
    data.devoluciones.forEach(m => events.push({ ...m, type: 'devolucion' }))
    data.merma.forEach(m        => events.push({ ...m, type: 'merma'      }))

    return events.sort((a, b) => new Date(a.date) - new Date(b.date))
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = new Date()
    let totalBatches = 0, activeBatches = 0, expiredBatches = 0, totalMovements = 0

    for (const p of batchProducts) {
      for (const b of (p.batches || [])) {
        totalBatches++
        const isExp = b.expiryDate && new Date(b.expiryDate) < today
        if (b.status !== 'agotado' && b.status !== 'merma') {
          activeBatches++
          if (isExp) expiredBatches++
        }
        const data = getBatchData(b.id, b.batchNumber)
        totalMovements += data.ventas.length + data.devoluciones.length + data.merma.length
      }
    }
    return { products: batchProducts.length, totalBatches, activeBatches, expiredBatches, totalMovements }
  }, [batchProducts, batchIndex]) // eslint-disable-line

  // ── Productos filtrados ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return batchProducts.filter(p => {
      if (filterCtrl !== 'all' && p.stockControl !== filterCtrl) return false
      if (q && !p.name.toLowerCase().includes(q) && !(p.barcode || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [batchProducts, search, filterCtrl])

  // ── Lista plana de lotes (tab "Por Lote") ──────────────────────────────────
  const allBatches = useMemo(() => {
    const today = new Date()
    const list  = []

    for (const p of batchProducts) {
      for (const b of (p.batches || [])) {
        const data       = getBatchData(b.id, b.batchNumber)
        const totalSold  = data.ventas.reduce((s, v) => s + v.quantity, 0)
        const totalRet   = data.devoluciones.reduce((s, v) => s + v.quantity, 0)
        const totalMerma = data.merma.reduce((s, v) => s + v.quantity, 0)
        const totalIng   = data.ingresos.reduce((s, v) => s + v.quantity, 0) ||
          Math.max(b.quantity + totalSold - totalRet + totalMerma, b.quantity)
        const isExp   = b.expiryDate && new Date(b.expiryDate) < today
        const daysLeft = b.expiryDate
          ? Math.ceil((new Date(b.expiryDate) - today) / 86400000)
          : null

        list.push({
          ...b,
          productName: p.name,
          barcode:     p.barcode,
          unit:        p.unit || 'u',
          stockControl: p.stockControl,
          totalIng,
          totalSold,
          totalRet,
          totalMerma,
          currentQty: b.quantity,
          isExpired:  isExp,
          daysLeft,
        })
      }
    }

    return list.sort((a, b) => {
      if (a.expiryDate && b.expiryDate) return new Date(a.expiryDate) - new Date(b.expiryDate)
      if (a.expiryDate) return -1
      if (b.expiryDate) return 1
      return a.productName.localeCompare(b.productName)
    })
  }, [batchProducts, batchIndex]) // eslint-disable-line

  // ── Export Excel ───────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = []

    for (const p of batchProducts) {
      for (const b of (p.batches || [])) {
        const tl = getBatchTimeline(b)
        for (const m of tl) {
          rows.push({
            Fecha:        fmtDT(m.date),
            Tipo:         MVT[m.type]?.label || m.type,
            Producto:     p.name,
            'Cód/Barcode': p.barcode || p.sku || '—',
            Lote:         b.batchNumber || b.id?.slice(0, 8),
            Vencimiento:  fmt(b.expiryDate),
            Cantidad:     (MVT[m.type]?.sign || '') + m.quantity,
            Referencia:   m.ref || '—',
            'Ref. Venta': m.saleRef || '—',
            'Motivo/Razón': m.reason || '—',
            Responsable:  m.user !== '—' ? m.user : '—',
            'Costo Unit.': m.unitCost ? `S/ ${parseFloat(m.unitCost).toFixed(2)}` : '—',
          })
        }
      }
    }

    if (!rows.length) { toast.error('No hay datos de lotes para exportar'); return }
    downloadExcel(rows, 'Trazabilidad_Lotes')
    toast.success(`${rows.length} movimientos exportados`, { duration: 3000 })
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  const BatchStatusBadge = ({ batch }) => {
    const today = new Date()
    const isExp = batch.expiryDate && new Date(batch.expiryDate) < today
    if (batch.status === 'merma')   return <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 rounded font-medium">Merma</span>
    if (batch.status === 'agotado') return <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded font-medium">Agotado</span>
    if (isExp)                      return <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded font-medium">Vencido</span>
    return <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded font-medium">Activo</span>
  }

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">
            🧬 Trazabilidad de Lotes
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Ciclo de vida completo: ingresos · ventas · devoluciones · merma
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
          </svg>
          Exportar Excel
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Productos c/lotes',   value: stats.products,       icon: '📦', cls: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' },
          { label: 'Lotes registrados',   value: stats.totalBatches,   icon: '🏷️', cls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'         },
          { label: 'Lotes activos',        value: stats.activeBatches,  icon: '✅', cls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
          { label: 'Lotes vencidos',       value: stats.expiredBatches, icon: '⚠️', cls: stats.expiredBatches > 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-400' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.cls}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-base leading-none">{s.icon}</span>
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400">{s.label}</span>
            </div>
            <div className="text-3xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto o código de barras..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterCtrl}
          onChange={e => setFilterCtrl(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">Todos los controles</option>
          <option value="lote_fefo">FEFO (por vencimiento)</option>
          <option value="lote_fifo">FIFO (por entrada)</option>
          <option value="serie">Series</option>
        </select>
        {(search || filterCtrl !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFilterCtrl('all') }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Limpiar
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {[
          { key: 'producto', label: '📦 Por Producto' },
          { key: 'lote',     label: '🏷️ Por Lote'     },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Por Producto ───────────────────────────────────────────────── */}
      {activeTab === 'producto' && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-3">🧬</div>
              <p className="font-semibold text-gray-600 dark:text-slate-300">No hay productos con control de lotes</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                Configura el tipo de stock en el Catálogo (FEFO, FIFO o Serie)
              </p>
            </div>
          ) : (
            filtered.map(product => {
              const isExpanded = expandedProduct === product.id
              const batches    = product.batches || []
              const today      = new Date()
              const ctrl       = CTRL[product.stockControl]

              return (
                <div key={product.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

                  {/* Product row */}
                  <button
                    onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-300 text-sm flex-shrink-0">
                        {product.name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-gray-800 dark:text-slate-100">{product.name}</span>
                          {ctrl && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ctrl.cls}`}>{ctrl.label}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                          {product.barcode && <span className="font-mono">{product.barcode}</span>}
                          <span>{batches.length} lote{batches.length !== 1 ? 's' : ''}</span>
                          <span>Stock: <strong className="text-gray-600 dark:text-slate-300">{product.stock}</strong> {product.unit || ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <div className="hidden sm:flex items-center gap-1.5 text-xs">
                        {batches.filter(b => b.status !== 'agotado' && b.status !== 'merma' && !(b.expiryDate && new Date(b.expiryDate) < today)).length > 0 && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full font-medium">
                            {batches.filter(b => b.status !== 'agotado' && b.status !== 'merma' && !(b.expiryDate && new Date(b.expiryDate) < today)).length} activos
                          </span>
                        )}
                        {batches.filter(b => b.expiryDate && new Date(b.expiryDate) < today).length > 0 && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full font-medium">
                            {batches.filter(b => b.expiryDate && new Date(b.expiryDate) < today).length} vencidos
                          </span>
                        )}
                      </div>
                      <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                  </button>

                  {/* Batch list */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                      {batches.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-gray-400">
                          No hay lotes registrados para este producto
                        </div>
                      ) : batches.map(batch => {
                        const bKey       = `${product.id}:${batch.id}`
                        const isBatchExp = expandedBatch === bKey
                        const data       = getBatchData(batch.id, batch.batchNumber)
                        const timeline   = getBatchTimeline(batch)
                        const isExp      = batch.expiryDate && new Date(batch.expiryDate) < today
                        const daysLeft   = batch.expiryDate
                          ? Math.ceil((new Date(batch.expiryDate) - today) / 86400000)
                          : null
                        const totSold    = data.ventas.reduce((s, v) => s + v.quantity, 0)
                        const totRet     = data.devoluciones.reduce((s, v) => s + v.quantity, 0)
                        const totMerma   = data.merma.reduce((s, v) => s + v.quantity, 0)

                        const dotColor =
                          batch.status === 'merma'   ? 'bg-orange-400' :
                          batch.status === 'agotado' ? 'bg-gray-400' :
                          isExp                      ? 'bg-red-500' :
                          'bg-emerald-500'

                        return (
                          <div key={batch.id}>
                            {/* Batch header */}
                            <button
                              onClick={() => setExpandedBatch(isBatchExp ? null : bKey)}
                              className="w-full flex items-center justify-between px-5 py-3 pl-16 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`}/>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-sm font-mono font-semibold text-gray-800 dark:text-slate-200">
                                      {batch.batchNumber || batch.id?.slice(0, 8)}
                                    </span>
                                    <BatchStatusBadge batch={batch}/>
                                    {!isExp && daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && (
                                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded font-medium">
                                        Vence en {daysLeft}d
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-gray-400">
                                    {batch.expiryDate && <span>Vence: <strong className="text-gray-600 dark:text-slate-300">{fmt(batch.expiryDate)}</strong></span>}
                                    <span>Qty: <strong className="text-gray-600 dark:text-slate-300">{batch.quantity}</strong> {product.unit || ''}</span>
                                    {batch.priceBuy != null && <span>Costo: S/{parseFloat(batch.priceBuy).toFixed(2)}</span>}
                                    <span>{fmt(batch.createdAt)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                                <div className="hidden sm:flex items-center gap-1.5 text-xs">
                                  {totSold > 0 && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded font-medium">
                                      -{totSold} vendido
                                    </span>
                                  )}
                                  {totRet > 0 && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded font-medium">
                                      +{totRet} devuelto
                                    </span>
                                  )}
                                  {totMerma > 0 && (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded font-medium">
                                      -{totMerma} merma
                                    </span>
                                  )}
                                  {!totSold && !totRet && !totMerma && (
                                    <span className="text-gray-400 italic text-xs">Sin movimientos</span>
                                  )}
                                </div>
                                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isBatchExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                                </svg>
                              </div>
                            </button>

                            {/* Timeline */}
                            {isBatchExp && (
                              <div className="pl-20 pr-5 pb-5 pt-3 bg-gray-50 dark:bg-gray-800/30">
                                {timeline.length === 0 ? (
                                  <p className="text-sm text-gray-400 py-4 text-center">Sin movimientos registrados</p>
                                ) : (
                                  <div className="relative">
                                    <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-700"/>
                                    <div className="space-y-3">
                                      {timeline.map((m, idx) => {
                                        const mt = MVT[m.type]
                                        return (
                                          <div key={idx} className="flex items-start gap-3 pl-10 relative">
                                            <div className={`absolute left-1.5 top-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${mt.dot} border-2 border-white dark:border-gray-800 flex-shrink-0 z-10`}>
                                              {mt.icon}
                                            </div>
                                            <div className={`flex-1 rounded-xl p-3 ${mt.bg}`}>
                                              <div className="flex items-start justify-between gap-2">
                                                <div>
                                                  <span className={`text-xs font-bold uppercase tracking-wide ${mt.text}`}>
                                                    {mt.label}
                                                    {m.implicit ? ' (estimado)' : ''}
                                                  </span>
                                                  <span className="text-xs text-gray-400 ml-2">{fmtDT(m.date)}</span>
                                                </div>
                                                <span className={`text-sm font-bold flex-shrink-0 ${mt.text}`}>
                                                  {mt.sign}{m.quantity} {product.unit || 'u'}
                                                </span>
                                              </div>
                                              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                {m.ref && m.ref !== '—' && (
                                                  <span>Ref: <strong className="text-gray-700 dark:text-gray-300">{m.ref}</strong></span>
                                                )}
                                                {m.saleRef && (
                                                  <span>Boleta: <strong className="text-gray-700 dark:text-gray-300">{m.saleRef}</strong></span>
                                                )}
                                                {m.clientName && (
                                                  <span>Cliente: {m.clientName}</span>
                                                )}
                                                {m.reason && (
                                                  <span>Motivo: {m.reason}</span>
                                                )}
                                                {m.user && m.user !== '—' && (
                                                  <span>Por: {m.user}</span>
                                                )}
                                                {m.unitCost > 0 && (
                                                  <span>Costo: S/{parseFloat(m.unitCost).toFixed(2)}</span>
                                                )}
                                                {m.unitPrice > 0 && (
                                                  <span>P.Venta: S/{parseFloat(m.unitPrice).toFixed(2)}</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── TAB: Por Lote ──────────────────────────────────────────────────── */}
      {activeTab === 'lote' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  {['Lote', 'Producto', 'Control', 'Ingresado', 'Vendido', 'Devuelto', 'Merma', 'Stock Actual', 'Vencimiento', 'Estado'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide ${['Ingresado','Vendido','Devuelto','Merma','Stock Actual'].includes(h) ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {allBatches.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-16 text-gray-400">
                      <div className="text-4xl mb-2">🏷️</div>
                      <p>No hay lotes registrados</p>
                    </td>
                  </tr>
                ) : allBatches.map(b => {
                  const ctrl = CTRL[b.stockControl]
                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${b.isExpired ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-800 dark:text-slate-200 whitespace-nowrap">
                        {b.batchNumber || b.id?.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800 dark:text-slate-200">{b.productName}</div>
                        {b.barcode && <div className="text-xs text-gray-400 font-mono">{b.barcode}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {ctrl && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ctrl.cls}`}>{ctrl.label}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                        {b.totalIng > 0 ? b.totalIng : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">
                        {b.totalSold > 0 ? b.totalSold : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600 dark:text-blue-400">
                        {b.totalRet > 0 ? b.totalRet : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                        {b.totalMerma > 0 ? b.totalMerma : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-gray-800 dark:text-slate-200">{b.currentQty}</span>
                        <span className="text-xs text-gray-400 ml-1">{b.unit}</span>
                      </td>
                      <td className="px-4 py-3">
                        {b.expiryDate ? (
                          <div>
                            <div className={`text-sm font-medium ${
                              b.isExpired        ? 'text-red-600 dark:text-red-400' :
                              b.daysLeft <= 30   ? 'text-amber-600 dark:text-amber-400' :
                              'text-gray-700 dark:text-gray-300'
                            }`}>
                              {fmt(b.expiryDate)}
                            </div>
                            <div className="text-xs text-gray-400">
                              {b.isExpired
                                ? `Venció hace ${Math.abs(b.daysLeft)}d`
                                : `${b.daysLeft}d restantes`}
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          b.status === 'merma'   ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                          b.status === 'agotado' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                          b.isExpired            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>
                          {b.status === 'merma' ? 'Merma' : b.status === 'agotado' ? 'Agotado' : b.isExpired ? 'Vencido' : 'Activo'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {allBatches.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 flex justify-between">
              <span>{allBatches.length} lotes en total</span>
              <span>
                Vendido total: <strong>{allBatches.reduce((s, b) => s + b.totalSold, 0)}</strong> u &nbsp;·&nbsp;
                Merma total: <strong>{allBatches.reduce((s, b) => s + b.totalMerma, 0)}</strong> u
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
