import { useState, useMemo } from 'react'
import { useStore, selectLowStockProducts } from '../../store/index'
import { useForm } from 'react-hook-form'
import Stocktaking from './Stocktaking'
import { zodResolver } from '@hookform/resolvers/zod'
import { stockAdjustSchema } from '../../shared/schemas/index'
import { productService } from '../../services/index'
import { formatCurrency, formatDate, formatDateTime, isLowStock, isOutOfStock, isExpired, isNearExpiry, stockDaysLeft, getUnitCost } from '../../shared/utils/helpers'
import { exportToExcel, exportToPDF } from '../../shared/utils/export'
import { ExcelButton, PDFButton } from '../../shared/components/ui/ExportButtons'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { StockBadge, ExpiryBadge } from '../../shared/components/ui/Badge'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import Modal from '../../shared/components/ui/Modal'
import toast from 'react-hot-toast'

// ── Ajuste de stock ────────────────────────────────────────────────────────────
function StockAdjustForm({ product, currentUser, onClose }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(stockAdjustSchema), defaultValues: { type: 'entrada' },
  })
  const type = watch('type')

  const onSubmit = async (data) => {
    const result = await productService.adjustStock(product.id, data.quantity, data.type, data.reason, currentUser?.id)
    if (result.error) { toast.error(result.error); return }
    toast.success(`Stock ajustado: ${data.type} de ${data.quantity} ${product.unit || 'u.'}`)
    onClose()
  }

  const tipos = [
    { value: 'entrada', label: 'Entrada',  color: 'bg-green-50 border-green-300 text-green-700' },
    { value: 'salida',  label: 'Salida',   color: 'bg-red-50 border-red-300 text-red-700' },
    { value: 'ajuste',  label: 'Ajuste',   color: 'bg-blue-50 border-blue-300 text-blue-700' },
    { value: 'merma',   label: 'Merma',    color: 'bg-amber-50 border-amber-300 text-amber-700' },
  ]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg px-4 py-3 text-sm">
        <span className="text-gray-500 dark:text-slate-400">Stock actual: </span>
        <span className="font-medium text-gray-800 dark:text-slate-100">{product.stock} {product.unit}</span>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-2">Tipo de movimiento</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {tipos.map(t => (
            <label key={t.value} className="cursor-pointer">
              <input type="radio" {...register('type')} value={t.value} className="sr-only"/>
              <div className={`text-center py-2 text-xs font-medium border rounded-lg cursor-pointer transition-colors ${type === t.value ? t.color : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700'}`}>{t.label}</div>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Cantidad *</label>
        <input type="number" min="0.01" step="0.01" {...register('quantity')} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity.message}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Motivo *</label>
        <textarea {...register('reason')} rows={2} placeholder="Ej: compra proveedor, merma, conteo físico..." className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
        {errors.reason && <p className="text-xs text-red-500 mt-1">{errors.reason.message}</p>}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">Cancelar</button>
        <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Registrar</button>
      </div>
    </form>
  )
}

// ── Kardex por producto — con valorización ────────────────────────────────────
function ProductKardex({ product, movements, onClose, systemConfig }) {
  const costMethod = systemConfig?.costMethod || 'peps'
  const refCost = getUnitCost(product, product.priceSell || 0, costMethod)
  const productMovements = movements
    .filter(m => m.productId === product.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  let saldoStock = 0
  let saldoValor = 0
  const movimientosValorizados = productMovements.map(m => {
    const esEntrada  = m.type === 'entrada'
    const unitCost   = m.unitCost ?? product.priceBuy ?? 0
    const totalValue = m.totalValue ?? parseFloat((unitCost * m.quantity).toFixed(2))
    saldoStock += esEntrada ? m.quantity : -m.quantity
    saldoValor += esEntrada ? totalValue : -totalValue
    return {
      ...m, unitCost, totalValue,
      saldoStock: parseFloat(saldoStock.toFixed(2)),
      saldoValor: parseFloat(saldoValor.toFixed(2)),
      esEntrada,
    }
  }).reverse()

  const totales = productMovements.reduce((acc, m) => {
    const v = m.totalValue ?? (m.unitCost ?? product.priceBuy ?? 0) * m.quantity
    if      (m.type === 'entrada') { acc.entradas += m.quantity; acc.valorEntradas += v }
    else if (m.type === 'salida')  { acc.salidas  += m.quantity; acc.valorSalidas  += v }
    else if (m.type === 'merma')   { acc.merma    += m.quantity; acc.valorMerma    += v }
    return acc
  }, { entradas: 0, salidas: 0, merma: 0, valorEntradas: 0, valorSalidas: 0, valorMerma: 0 })

  const valorInventario = parseFloat((product.stock * refCost).toFixed(2))
  const hasCost = (m) => m.unitCost != null && m.unitCost > 0

  // Formato de fecha compacto: línea 1 = DD/MM/AA, línea 2 = HH:MM
  const fmtFechaCorta = (iso) => {
    const d = new Date(iso)
    const fecha = d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' })
    const hora  = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    return { fecha, hora }
  }

  // Formato de cantidad: sin decimales si es entero
  const fmtQty = (n) => Number.isInteger(n) ? String(n) : n.toFixed(2)

  const TYPE_STYLE = {
    entrada: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    salida:  'bg-red-100   text-red-600   dark:bg-red-900/30   dark:text-red-400',
    merma:   'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    ajuste:  'bg-blue-100  text-blue-600  dark:bg-blue-900/30  dark:text-blue-400',
  }

  // Anchos mínimos garantizados por columna (en px)
  const COL = {
    fecha:      { minWidth: 88  },
    tipo:       { minWidth: 72  },
    cantidad:   { minWidth: 80  },
    costoUnit:  { minWidth: 96  },
    valorMov:   { minWidth: 96  },
    stock:      { minWidth: 100 },
    saldoValor: { minWidth: 100 },
    motivo:     { minWidth: 160 },
  }

  return (
    <div className="space-y-4">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Stock actual</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{fmtQty(product.stock)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{product.unit}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
          <p className="text-xs text-blue-500 dark:text-blue-400 mb-1">Valor en inventario</p>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(valorInventario)}</p>
          <p className="text-xs text-blue-400 dark:text-blue-500">@ {formatCurrency(refCost)}/u · {costMethod === 'cpp' ? 'CPP' : 'PEPS'}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
          <p className="text-xs text-green-500 mb-1">Entradas valorizadas</p>
          <p className="text-xl font-bold text-green-700 dark:text-green-400">+{fmtQty(totales.entradas)}</p>
          <p className="text-xs text-green-500">{formatCurrency(totales.valorEntradas)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
          <p className="text-xs text-red-500 mb-1">Salidas valorizadas</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">−{fmtQty(totales.salidas)}</p>
          <p className="text-xs text-red-400">{formatCurrency(totales.valorSalidas)}</p>
        </div>
      </div>

      {/* Aviso sin costo histórico */}
      {movimientosValorizados.some(m => !hasCost(m)) && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400">
          <span>⚠️</span>
          <span>Algunos movimientos anteriores no tienen costo registrado. Se usa el costo actual como referencia.</span>
        </div>
      )}

      {productMovements.length === 0 ? (
        <EmptyState icon="📋" title="Sin movimientos" message="Este producto no tiene movimientos registrados."/>
      ) : (
        /* overflow-x-auto → scroll horizontal en pantallas pequeñas */
        <div className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full" style={{ minWidth: '820px' }}>
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                <th style={COL.fecha}     className="text-xs font-semibold text-gray-500 dark:text-slate-400 px-3 py-2.5 uppercase tracking-wide text-left">Fecha</th>
                <th style={COL.tipo}      className="text-xs font-semibold text-gray-500 dark:text-slate-400 px-3 py-2.5 uppercase tracking-wide text-left">Tipo</th>
                <th style={COL.cantidad}  className="text-xs font-semibold text-gray-500 dark:text-slate-400 px-3 py-2.5 uppercase tracking-wide text-right">Cantidad</th>
                <th style={COL.costoUnit} className="text-xs font-semibold text-gray-500 dark:text-slate-400 px-3 py-2.5 uppercase tracking-wide text-right">Costo unit.</th>
                <th style={COL.valorMov}  className="text-xs font-semibold text-gray-500 dark:text-slate-400 px-3 py-2.5 uppercase tracking-wide text-right">Valor mov.</th>
                <th style={COL.stock}     className="text-xs font-semibold text-gray-500 dark:text-slate-400 px-3 py-2.5 uppercase tracking-wide text-center">Stock ant. → nvo.</th>
                <th style={COL.saldoValor}className="text-xs font-semibold text-gray-500 dark:text-slate-400 px-3 py-2.5 uppercase tracking-wide text-right">Saldo valor</th>
                <th style={COL.motivo}    className="text-xs font-semibold text-gray-500 dark:text-slate-400 px-3 py-2.5 uppercase tracking-wide text-left">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {movimientosValorizados.map(m => {
                const { fecha, hora } = fmtFechaCorta(m.createdAt)
                return (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">

                    {/* Fecha compacta en 2 líneas */}
                    <td className="px-3 py-2.5 whitespace-nowrap" style={COL.fecha}>
                      <span className="text-xs text-gray-700 dark:text-slate-300 font-medium">{fecha}</span>
                      <br/>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500">{hora}</span>
                    </td>

                    {/* Tipo */}
                    <td className="px-3 py-2.5" style={COL.tipo}>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${TYPE_STYLE[m.type] || TYPE_STYLE.ajuste}`}>
                        {m.type}
                      </span>
                    </td>

                    {/* Cantidad */}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap" style={COL.cantidad}>
                      <span className={`text-sm font-semibold ${m.esEntrada ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {m.esEntrada ? '+' : '−'}{fmtQty(m.quantity)}
                      </span>
                    </td>

                    {/* Costo unit. */}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap" style={COL.costoUnit}>
                      {m.unitCost > 0
                        ? <span className="text-sm text-gray-700 dark:text-slate-300">{formatCurrency(m.unitCost)}</span>
                        : <span className="text-gray-300 dark:text-slate-600 text-xs">—</span>
                      }
                    </td>

                    {/* Valor mov. */}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap" style={COL.valorMov}>
                      <span className={`text-sm font-semibold ${m.esEntrada ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {m.esEntrada ? '+' : '−'}{formatCurrency(m.totalValue)}
                      </span>
                    </td>

                    {/* Stock ant. → nvo. (columna fusionada) */}
                    <td className="px-3 py-2.5 text-center whitespace-nowrap" style={COL.stock}>
                      <span className="text-sm text-gray-400 dark:text-slate-500">{fmtQty(m.previousStock ?? 0)}</span>
                      <span className="text-xs text-gray-300 dark:text-slate-600 mx-1.5">→</span>
                      <span className={`text-sm font-semibold ${m.esEntrada ? 'text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-slate-100'}`}>
                        {fmtQty(m.newStock ?? 0)}
                      </span>
                    </td>

                    {/* Saldo valor */}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap" style={COL.saldoValor}>
                      <span className={`text-sm font-semibold ${m.saldoValor >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>
                        {formatCurrency(m.saldoValor)}
                      </span>
                    </td>

                    {/* Motivo */}
                    <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-slate-400" style={{ ...COL.motivo, maxWidth: '240px' }}>
                      <span className="block truncate">{m.reason}</span>
                      {m.invoiceNumber && (
                        <span className="font-mono text-gray-400 dark:text-slate-500 text-[10px]">{m.invoiceNumber}</span>
                      )}
                    </td>

                  </tr>
                )
              })}
            </tbody>

            {/* Totales */}
            <tfoot>
              <tr className="bg-gray-50 dark:bg-slate-800/50 border-t-2 border-gray-200 dark:border-slate-700">
                <td colSpan={2} className="px-3 py-3 text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide">
                  TOTALES
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="text-xs text-green-600 dark:text-green-400 font-semibold">+{fmtQty(totales.entradas)}</div>
                  <div className="text-xs text-red-500 dark:text-red-400 font-semibold">−{fmtQty(totales.salidas)}</div>
                </td>
                <td className="px-3 py-3"/>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <span className="text-sm font-bold text-gray-800 dark:text-slate-100">
                    {formatCurrency(totales.valorEntradas - totales.valorSalidas - totales.valorMerma)}
                  </span>
                </td>
                <td className="px-3 py-3"/>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(valorInventario)}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-gray-400 dark:text-slate-500">
                  Valor inventario actual
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function Inventory() {
  const { products, categories, suppliers, stockMovements, currentUser, businessConfig, systemConfig, addAuditLog, locations } = useStore()
  const [search, setSearch]       = useState('')
  const [categoryFilter, setCatF] = useState('')
  const [tab, setTab]             = useState('products')
  const [view, setView]           = useState('main')
  const [filters, setFilters]     = useState({ lowStock: false, nearExpiry: false })
  const [modal, setModal]         = useState(null)
  const dq = useDebounce(search, 150)
  const lowCount = useStore(s => selectLowStockProducts(s).length)
   
  const filtered = useMemo(() => {
    let list = products.filter(p => p.isActive)
    if (dq)              { const q = dq.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.sku?.toLowerCase().includes(q)) }
    if (categoryFilter)  list = list.filter(p => p.categoryId === categoryFilter)
    if (filters.lowStock)  list = list.filter(p => isLowStock(p) || isOutOfStock(p))
    if (filters.nearExpiry) list = list.filter(p => isNearExpiry(p, 30) || isExpired(p))
    return list
  }, [products, dq, categoryFilter, filters])

  const inventoryKPIs = useMemo(() => ({
    valorCosto: products.filter(p => p.isActive).reduce((a, p) => a + p.priceBuy * p.stock, 0),
    valorVenta: products.filter(p => p.isActive).reduce((a, p) => a + p.priceSell * p.stock, 0),
  }), [products])

  const handleExportExcel = () => {
    addAuditLog({ action: 'EXPORT', module: 'Inventario', detail: `Excel: ${filtered.length} productos` })
    exportToExcel(
      filtered.map(p => ({
        Nombre: p.name, Código: p.barcode, SKU: p.sku||'', Categoría: categories.find(c=>c.id===p.categoryId)?.name||'',
        PrecioCompra: p.priceBuy, PrecioVenta: p.priceSell, Margen: `${((p.priceSell-p.priceBuy)/p.priceBuy*100).toFixed(1)}%`,
        Stock: p.stock, StockMin: p.stockMin, Unidad: p.unit, Ubicación: p.location||'', Vencimiento: p.expiryDate||'',
      })),
      'inventario'
    )
  }

  const handleExportPDF = () => {
    addAuditLog({ action: 'EXPORT', module: 'Inventario', detail: `PDF: ${filtered.length} productos` })
    exportToPDF(
      'Reporte de Inventario',
      ['Nombre','Código','Categoría','P. Compra','P. Venta','Margen','Stock','Unidad'],
      filtered.map(p => [
        p.name, p.barcode, categories.find(c=>c.id===p.categoryId)?.name||'—',
        formatCurrency(p.priceBuy), formatCurrency(p.priceSell),
        `${((p.priceSell-p.priceBuy)/p.priceBuy*100).toFixed(1)}%`, p.stock, p.unit
      ]),
      businessConfig?.name
    )
  }
  
  // Cuando el cajero pulsa "Inventario físico", muestra Stocktaking
  // Al terminar, Stocktaking llama a onBack() y vuelve aquí
  if (view === 'stocktaking') {
    return <Stocktaking onBack={() => setView('main')} />
  }


  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Inventario</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">{filtered.length} productos{lowCount > 0 && <span className="ml-2 text-red-400">· {lowCount} con alerta</span>}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExcelButton onClick={handleExportExcel} />
          <PDFButton   onClick={handleExportPDF} />
          {/* ← AGREGAR ESTE BOTÓN */}
          <button onClick={() => setView('stocktaking')} 
            className="px-3 py-2 text-sm border border-blue-200 dark:border-blue-800
                       text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50
                       dark:hover:bg-blue-900/20 font-medium">
            📋 Inventario físico
          </button>

        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-2 sm:p-3"><p className="text-xs text-gray-500 dark:text-slate-400 mb-1 leading-tight">Valor en almacén (costo)</p><p className="text-xs sm:text-lg font-semibold sm:font-medium text-gray-800 dark:text-slate-100 truncate">{formatCurrency(inventoryKPIs.valorCosto)}</p></div>
        <div className="bg-blue-50 rounded-xl p-2 sm:p-3"><p className="text-xs text-blue-600 mb-1 leading-tight">Potencial de venta</p><p className="text-xs sm:text-lg font-semibold sm:font-medium text-blue-700 truncate">{formatCurrency(inventoryKPIs.valorVenta)}</p></div>
        <div className="bg-teal-50 rounded-xl p-2 sm:p-3"><p className="text-xs text-teal-600 mb-1 leading-tight">Margen potencial</p><p className="text-xs sm:text-lg font-semibold sm:font-medium text-teal-700 truncate">{formatCurrency(inventoryKPIs.valorVenta - inventoryKPIs.valorCosto)}</p></div>
      </div>

      {/* Tabs — FIX: etiqueta correcta "Movimientos" sin "Kardex" */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1 w-fit">
        {[{ k: 'products', l: 'Productos' }, { k: 'movements', l: 'Movimientos' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${tab === t.k ? 'bg-white shadow text-blue-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <>
          {/* Filtros */}
          <div className="flex gap-3 flex-wrap">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, código o SKU..." className="flex-1 min-w-48 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            <select value={categoryFilter} onChange={e => setCatF(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={() => setFilters(f => ({ ...f, lowStock: !f.lowStock }))} className={`px-3 py-2 text-sm rounded-lg border transition-colors ${filters.lowStock ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700'}`}>⚠️ Stock bajo</button>
            <button onClick={() => setFilters(f => ({ ...f, nearExpiry: !f.nearExpiry }))} className={`px-3 py-2 text-sm rounded-lg border transition-colors ${filters.nearExpiry ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700'}`}>🗓️ Por vencer</button>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="📦" title="Sin productos" message="Ajusta los filtros o ve al Catálogo para crear productos."/>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                    {['Producto','Código','Categoría','P.Compra','P.Venta','Margen','Stock','Vence','Acciones'].map(h => (
                      <th key={h} className={`text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-3 ${['P.Compra','P.Venta','Margen'].includes(h)?'text-right':h==='Acciones'?'text-center':'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {filtered.map(p => {
                    const cat     = categories.find(c => c.id === p.categoryId)
                    const margin  = p.priceBuy > 0 ? ((p.priceSell - p.priceBuy) / p.priceBuy * 100).toFixed(1) : 0
                    const daysLeft = stockDaysLeft(p, stockMovements)
                    return (
                      <tr key={p.id} className={`hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 ${isExpired(p) ? 'bg-red-50' : ''}`}>
                        <td className="px-3 py-3">
                          <div className="text-sm font-medium text-gray-800 dark:text-slate-100 max-w-[180px] truncate">{p.name}</div>
                          {p.brand && <div className="text-xs text-gray-400 dark:text-slate-500">{p.brand}</div>}
                          {p.location && (() => {
                            const isMaster = locations?.some((l) => l.name === p.location)
                            return (
                              <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full mt-0.5 ${
                                isMaster
                                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400'
                                  : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
                              }`}>
                                📍 {p.location}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="px-3 py-3 text-xs font-mono text-gray-500 dark:text-slate-400">{p.barcode}</td>
                        <td className="px-3 py-3"><span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-full">{cat?.name || '—'}</span></td>
                        <td className="px-3 py-3 text-sm text-right text-gray-600 dark:text-slate-300">{formatCurrency(p.priceBuy)}</td>
                        <td className="px-3 py-3 text-sm text-right font-medium text-gray-800 dark:text-slate-100">{formatCurrency(p.priceSell)}</td>
                        <td className="px-3 py-3 text-right"><span className={`text-xs font-medium ${parseFloat(margin)>=30?'text-green-600':parseFloat(margin)>=15?'text-amber-600':'text-red-500'}`}>{margin}%</span></td>
                        <td className="px-3 py-3 text-center">
                          <StockBadge product={p}/>
                          {daysLeft !== null && <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{daysLeft}d</div>}
                        </td>
                        <td className="px-3 py-3 text-center"><ExpiryBadge product={p}/></td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Botón Kardex por producto — punto 3 */}
                            <button onClick={() => setModal({ type: 'kardex', data: p })} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg text-xs font-bold" title="Ver movimientos del producto">K</button>
                            <button onClick={() => setModal({ type: 'stock', data: p })} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold" title="Ajustar stock">±</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Tab movimientos generales */}
      {tab === 'movements' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[580px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                {['Fecha','Producto','Tipo','Cantidad','Stock ant.','Stock nuevo','Motivo'].map(h => (
                  <th key={h} className={`text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3 ${['Cantidad','Stock ant.','Stock nuevo'].includes(h)?'text-right':'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {stockMovements.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-300">Sin movimientos registrados</td></tr>
              ) : stockMovements.slice(0, 200).map(m => (
                <tr key={m.id} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700 max-w-[200px] truncate">{m.productName}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${m.type==='entrada'?'bg-green-100 text-green-700':m.type==='salida'?'bg-red-100 text-red-600':m.type==='merma'?'bg-amber-100 text-amber-600':'bg-blue-100 text-blue-600'}`}>{m.type}</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right font-medium">{m.type==='salida'||m.type==='merma'?'-':'+'}{m.quantity}</td>
                  <td className="px-4 py-2.5 text-sm text-right text-gray-500 dark:text-slate-400">{m.previousStock}</td>
                  <td className="px-4 py-2.5 text-sm text-right font-medium text-gray-800 dark:text-slate-100">{m.newStock}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400 max-w-[200px] truncate">{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal ajuste de stock */}
      {modal?.type === 'stock' && (
        <Modal title="Ajustar stock" subtitle={modal.data.name} onClose={() => setModal(null)}>
          <StockAdjustForm product={modal.data} currentUser={currentUser} onClose={() => setModal(null)}/>
        </Modal>
      )}

      {/* Modal Kardex por producto — punto 3 */}
      {modal?.type === 'kardex' && (
        <Modal title={`Movimientos — ${modal.data.name}`} subtitle={`${modal.data.barcode} · Stock actual: ${modal.data.stock} ${modal.data.unit}`} size="xl" onClose={() => setModal(null)}>
          <ProductKardex product={modal.data} movements={stockMovements} onClose={() => setModal(null)} systemConfig={systemConfig}/>
        </Modal>
      )}
    </div>
  )
}
