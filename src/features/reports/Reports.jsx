/**
 * Reports.jsx — Módulo de Reportes v2
 * Ruta: src/features/reports/Reports.jsx
 *
 * CAMBIOS vs v1:
 *  1. Toda la lógica de cálculo movida a useReportMetrics (hook separado)
 *  2. Tab de Devoluciones agregado (NCs, reembolsado, ventas netas, tasa)
 *  3. Alerta cuando hay productos sin costo registrado (utilidad estimada)
 *  4. Métricas de ventas netas (ventas - devoluciones) en KPIs principales
 *  5. Componente queda solo con UI — sin lógica de negocio
 */

import { useMemo, useState } from 'react'
import { useStore } from '../../store/index'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatCurrency, formatDate, formatDateTime } from '../../shared/utils/helpers'
import { downloadExcel, exportToExcel, exportToPDF }  from '../../shared/utils/export'
import { ExcelButton, PDFButton }                       from '../../shared/components/ui/ExportButtons'
import { useReportMetrics }                            from './hooks/useReportMetrics'
import Modal                                            from '../../shared/components/ui/Modal'

// ─── Constantes ───────────────────────────────────────────────────────────────
const COLORS = ['#378ADD', '#5DCAA5', '#EF9F27', '#D85A30', '#7F77DD', '#D4537E']

const RANGES = [
  { key: 'today', label: 'Hoy'     },
  { key: 'week',  label: '7 días'  },
  { key: 'month', label: 'Mes'     },
  { key: 'all',   label: 'Todo'    },
]

const TABS = [
  { key: 'ventas',          label: 'Ventas por día'     },
  { key: 'productos',       label: 'Productos top'      },
  { key: 'categorias',      label: 'Por categoría'      },
  { key: 'rentabilidad',    label: '📈 Rentabilidad'    },
  { key: 'detalle_venta',   label: 'Detalle ventas'     },
  { key: 'devoluciones',    label: 'Devoluciones'       },
  { key: 'deuda',           label: 'Cuentas por cobrar' },
  { key: 'inmovilizado',    label: 'Sin movimiento'     },
]

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function KpiCard({ label, value, color = 'text-gray-800 dark:text-slate-100', sub }) {
  return (
    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function NoData({ msg = 'Sin datos en el período' }) {
  return (
    <div className="flex items-center justify-center h-40 text-gray-300 dark:text-slate-600 text-sm">
      {msg}
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
function ExcelPreviewModal({ title, rows, filename, onClose, onDownload }) {
  const columns = rows.length ? Object.keys(rows[0]) : []

  return (
    <Modal
      title={title}
      subtitle={`${rows.length} registro(s) listos para descargar`}
      size="xl"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Vista de solo lectura. El archivo se descargara como {filename}.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
              Cerrar
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={!rows.length}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              Descargar Excel
            </button>
          </div>
        </div>
      }>
      <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Hoja: Operaciones</span>
          </div>
          <span className="text-xs text-emerald-700/70 dark:text-emerald-300/70">Solo lectura</span>
        </div>

        <div className="max-h-[56vh] overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-10 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-2 py-2 text-right text-gray-400 font-medium">#</th>
                {columns.map((col) => (
                  <th key={col} className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 text-left text-gray-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-slate-500">
                    No hay operaciones para mostrar en el periodo seleccionado.
                  </td>
                </tr>
              ) : rows.map((row, rowIndex) => (
                <tr key={`${row.Comprobante}-${rowIndex}`} className="hover:bg-blue-50/60 dark:hover:bg-slate-800/70">
                  <td className="bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 px-2 py-2 text-right text-gray-400 tabular-nums">
                    {rowIndex + 1}
                  </td>
                  {columns.map((col) => (
                    <td key={col} className="border border-gray-200 dark:border-slate-700 px-3 py-2 text-gray-700 dark:text-slate-200 whitespace-nowrap">
                      {row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}

export default function Reports() {
  const { sales, products, clients, categories, returns = [], businessConfig, systemConfig, addAuditLog } = useStore()

  const [range, setRange]           = useState('month')
  const [activeTab, setActiveTab]   = useState('ventas')
  const [expandedSale, setExpandedSale] = useState(null)
  const [excelPreview, setExcelPreview] = useState(null)

  // ── Todas las métricas vienen del hook ────────────────────────────────────
  const {
    filteredSales,
    salesKPIs,
    byPayment,
    byCategory,
    topProducts,
    dailyChart,
    sinMovimiento,
    returnMetrics,
    productsSinCosto,
    rentabilidadProductos,
    rentabilidadCategorias,
    rentabilidadKPIs,
  } = useReportMetrics({ sales, products, categories, returns, range })

  const operacionesRows = useMemo(() => filteredSales.map((s) => {
    const descuentos    = s.totalDescuentos || s.discount || 0
    const baseImponible = parseFloat(Math.max(0, (s.subtotal || s.total) - descuentos).toFixed(2))
    const igv           = parseFloat((baseImponible * 0.18).toFixed(2))

    return {
      Comprobante: s.invoiceNumber,
      Fecha:       formatDate(s.createdAt),
      Usuario:     s.userName || '—',
      Items:       s.items?.length || 0,
      Subtotal:    formatCurrency(s.subtotal || s.total),
      Descuentos:  descuentos > 0 ? `-${formatCurrency(descuentos)}` : '—',
      'Base Imp.': formatCurrency(baseImponible),
      IGV:         formatCurrency(igv),
      Total:       formatCurrency(s.total),
      Metodo:      s.payments?.map((p) => p.method).join(' + ') || '—',
      'Nota de venta': s.note || '—',
    }
  }), [filteredSales])

  // ─── Exportaciones ────────────────────────────────────────────────────────
  const handleExportExcel = (tab) => {
    addAuditLog({ action: 'EXPORT', module: 'Reportes', detail: `Excel: ${tab} · ${filteredSales.length} ventas` })

    if (tab === 'ventas') {
      exportToExcel(filteredSales.map((s) => ({
        Boleta: s.invoiceNumber, Fecha: formatDate(s.createdAt),
        Items: s.items?.length, Total: s.total,
        Método: s.payments?.map((p) => p.method).join('+'), Estado: s.status,
      })), 'ventas')

    } else if (tab === 'productos') {
      exportToExcel(topProducts.map((p, i) => ({
        Posición: i + 1, Producto: p.name, Unidades: p.qty,
        Ingresos: p.revenue.toFixed(2),
      })), 'top_productos')

    } else if (tab === 'detalle_venta') {
      const rows = filteredSales.flatMap((s) =>
        s.items?.map((item) => {
          const lotes = item.batchAllocations?.length
            ? item.batchAllocations.map(b => `${b.batchNumber}(${b.quantity}u)`).join(', ')
            : '—'
          const venc = item.batchAllocations?.length
            ? item.batchAllocations.map(b => b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('es-PE') : '—').join(', ')
            : '—'
          return {
            Boleta: s.invoiceNumber, Fecha: formatDate(s.createdAt),
            Producto: item.productName, Cantidad: item.quantity,
            PrecioUnit: item.unitPrice, Descuento: item.discount || 0,
            Subtotal: item.subtotal,
            Lote: lotes,
            Vencimiento: venc,
          }
        }) || []
      )
      exportToExcel(rows, 'detalle_productos_ventas')

    } else if (tab === 'rentabilidad') {
      exportToExcel(
        rentabilidadProductos.map(p => {
          const cat = categories.find(c => c.id === p.categoryId)
          return {
            Producto:      p.name,
            Categoría:     cat?.name || '—',
            Código:        p.barcode,
            'Uds. vendidas': p.qtySold,
            'Costo unit.': p.unitCost.toFixed(2),
            'P. Venta':    p.unitPrice.toFixed(2),
            'Ingresos':    p.revenue.toFixed(2),
            'Costo total': p.costTotal.toFixed(2),
            'Utilidad':    p.utilidad.toFixed(2),
            'Margen %':    `${p.margenPct}%`,
            'Alerta':      p.margenNegativo ? 'VENTA A PÉRDIDA' : p.hasCost ? '' : 'SIN COSTO',
          }
        }),
        'rentabilidad_productos'
      )
      exportToExcel(returnMetrics.list.map((r) => ({
        NC: r.ncNumber, BolOrigen: r.invoiceNumber, Cajero: r.userName,
        Motivo: r.reasonLabel, Reembolso: r.totalRefund,
        Fecha: formatDate(r.createdAt),
      })), 'devoluciones')

    } else if (tab === 'deuda') {
      exportToExcel(
        clients.filter((c) => c.currentDebt > 0).map((c) => ({
          Nombre: c.name, Documento: c.documentNumber,
          Deuda: c.currentDebt, Límite: c.creditLimit,
        })),
        'cuentas_cobrar'
      )

    } else if (tab === 'inmovilizado') {
      exportToExcel(sinMovimiento.lista.map((p) => ({
        Nombre: p.name, Barcode: p.barcode, Stock: p.stock,
        Costo: p.priceBuy, ValorInmovilizado: p.priceBuy * p.stock,
      })), 'sin_movimiento')
    }
  }

  const handleExportOperaciones = () => {
    addAuditLog({ action: 'PREVIEW', module: 'Reportes', detail: `Vista Excel operaciones · ${operacionesRows.length} ventas` })
    setExcelPreview({
      title: 'Excel operaciones',
      filename: 'operaciones_ventas.xls',
      rows: operacionesRows,
    })
  }

  const handleDownloadOperaciones = () => {
    addAuditLog({ action: 'EXPORT', module: 'Reportes', detail: `Excel operaciones · ${operacionesRows.length} ventas` })
    downloadExcel(operacionesRows, 'operaciones_ventas')
  }

  const handleExportPDF = (tab) => {
    addAuditLog({ action: 'EXPORT', module: 'Reportes', detail: `PDF: ${tab}` })
    if (tab === 'productos') {
      exportToPDF('Top 10 Productos Más Vendidos',
        ['#', 'Producto', 'Unidades', 'Ingresos'],
        topProducts.map((p, i) => [i + 1, p.name, p.qty, formatCurrency(p.revenue)]),
        businessConfig?.name)
    } else if (tab === 'deuda') {
      exportToPDF('Reporte de Cuentas por Cobrar',
        ['Cliente', 'Documento', 'Límite', 'Deuda'],
        clients.filter((c) => c.currentDebt > 0).map((c) => [
          c.name, `${c.documentType} ${c.documentNumber}`,
          formatCurrency(c.creditLimit || 0), formatCurrency(c.currentDebt || 0),
        ]),
        businessConfig?.name)
    } else {
      exportToPDF(`Reporte de Ventas — ${range}`,
        ['Boleta', 'Fecha', 'Items', 'Total', 'Método', 'Estado'],
        filteredSales.slice(0, 200).map((s) => [
          s.invoiceNumber, formatDate(s.createdAt), s.items?.length,
          formatCurrency(s.total), s.payments?.map((p) => p.method).join('+'), s.status,
        ]),
        businessConfig?.name)
    }
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Reportes</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">{salesKPIs.count} ventas en el período</p>
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${range === r.key ? 'bg-white shadow text-blue-600' : 'text-gray-500 dark:text-slate-400'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alerta si hay productos sin costo — la utilidad puede ser inexacta */}
      {productsSinCosto > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300">
          <span className="text-base shrink-0">⚠️</span>
          <span>
            <strong>{productsSinCosto} producto{productsSinCosto > 1 ? 's' : ''} sin costo registrado.</strong>
            {' '}La utilidad de esos productos se calcula con un estimado del 30%.
            Completa el campo "Precio de compra" en el Catálogo para obtener datos exactos.
          </span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Total ventas"     value={formatCurrency(salesKPIs.total)}     color="text-blue-600" />
        <KpiCard label="Transacciones"    value={salesKPIs.count}                     color="text-gray-800 dark:text-slate-100" />
        <KpiCard label="Ticket promedio"  value={formatCurrency(salesKPIs.avgTicket)} color="text-teal-600" />
        <KpiCard label="Utilidad neta"    value={formatCurrency(salesKPIs.utilidad)}  color="text-green-600"
          sub={productsSinCosto > 0 ? `${productsSinCosto} prod. estimados` : undefined}/>
        <KpiCard label="IGV generado"     value={formatCurrency(salesKPIs.igv)}       color="text-purple-600" />
      </div>

      {/* KPIs de ventas netas (con devoluciones) */}
      {returnMetrics.count > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label="NCs emitidas"    value={returnMetrics.count}                         color="text-red-500" />
          <KpiCard label="Total reembolsado" value={formatCurrency(returnMetrics.totalReembolsado)} color="text-red-600" />
          <KpiCard label="Ventas netas"     value={formatCurrency(returnMetrics.ventasNetas)}   color="text-emerald-600"
            sub={`Tasa devolución: ${returnMetrics.tasaDevolucion}%`}/>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === t.key
                ? 'bg-white shadow text-blue-600'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
            }`}>
            {t.label}
            {t.key === 'devoluciones' && returnMetrics.count > 0 && (
              <span className="ml-1.5 text-[10px] bg-red-100 text-red-600 px-1 rounded-full">{returnMetrics.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══ TAB: Ventas por día ══════════════════════════════════════════════ */}
      {activeTab === 'ventas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300">Ventas diarias</h3>
              <div className="flex gap-2">
                <ExcelButton onClick={() => handleExportExcel('ventas')} />
                <PDFButton   onClick={() => handleExportPDF('ventas')} />
              </div>
            </div>
            {dailyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#9ca3af' }}/>
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `S/${v}`} width={52}/>
                  <Tooltip formatter={(v) => [formatCurrency(v), 'Ventas']} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                  <Bar dataKey="total" fill="#378ADD" radius={[4, 4, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            ) : <NoData/>}
          </div>

          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Métodos de pago</h3>
            {byPayment.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={byPayment} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                      {byPayment.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={(v) => [formatCurrency(v)]} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {byPayment.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }}/>
                        <span className="text-gray-600 dark:text-slate-300">{d.name}</span>
                      </div>
                      <span className="font-medium text-gray-700 dark:text-slate-200">{formatCurrency(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <NoData/>}
          </div>
        </div>
      )}

      {/* ══ TAB: Top productos ══════════════════════════════════════════════ */}
      {activeTab === 'productos' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300">Top 10 productos más vendidos</h3>
            <div className="flex gap-2">
              <ExcelButton onClick={() => handleExportExcel('productos')} />
              <PDFButton   onClick={() => handleExportPDF('productos')} />
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50">
                {['#', 'Producto', 'Unidades', 'Ingresos', 'Proporción'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {topProducts.length === 0
                ? <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-300">Sin datos</td></tr>
                : topProducts.map((p, i) => {
                  const max = topProducts[0]?.qty || 1
                  return (
                    <tr key={p.name} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="px-4 py-3 text-xs text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-slate-100 max-w-xs truncate">{p.name}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-700 dark:text-slate-200">{p.qty}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-slate-200">{formatCurrency(p.revenue)}</td>
                      <td className="px-4 py-3">
                        <div className="w-24 bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                          <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${(p.qty / max * 100).toFixed(0)}%` }}/>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ TAB: Por categoría ══════════════════════════════════════════════ */}
      {activeTab === 'categorias' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-4">Ventas por categoría</h3>
          {byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(byCategory.length * 44 + 60, 200)}>
              <BarChart data={byCategory} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `S/${v}`}/>
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={110}/>
                <Tooltip formatter={(v) => [formatCurrency(v), 'Ventas']} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                <Bar dataKey="value" fill="#5DCAA5" radius={[0, 4, 4, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : <NoData/>}
        </div>
      )}

      {/* ══ TAB: RENTABILIDAD ════════════════════════════════════════════════ */}
      {activeTab === 'rentabilidad' && (
        <div className="space-y-5">

          {/* Método activo */}
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border ${
            (systemConfig?.costMethod || 'peps') === 'peps'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
          }`}>
            <span>{(systemConfig?.costMethod || 'peps') === 'peps' ? '🕐' : '⚖️'}</span>
            <span>
              Método de valorización activo:
              <strong className="ml-1">
                {(systemConfig?.costMethod || 'peps') === 'peps'
                  ? 'PEPS — Primero en entrar, primero en salir'
                  : 'Costo Promedio Ponderado (CPP)'}
              </strong>
            </span>
            <span className="ml-auto text-gray-400 dark:text-slate-500">
              Configurable en Ajustes → Inventario
            </span>
          </div>

          {/* Alerta productos sin costo */}
          {rentabilidadKPIs.sinCostoItems > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <span className="text-amber-500 mt-0.5">⚠️</span>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>{rentabilidadKPIs.sinCostoItems} producto(s)</strong> sin precio de costo registrado.
                Su utilidad se calcula con un estimado del 30% del precio de venta.
                Actualiza el precio de compra en el Catálogo para mayor precisión.
              </p>
            </div>
          )}

          {/* Alerta productos con margen negativo */}
          {rentabilidadKPIs.negativos > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <span className="text-red-500 mt-0.5">🚨</span>
              <p className="text-sm text-red-700 dark:text-red-400">
                <strong>{rentabilidadKPIs.negativos} producto(s) con margen negativo</strong> —
                estás vendiendo por debajo del costo. Revisa los precios de venta o los costos registrados.
              </p>
            </div>
          )}

          {/* KPIs de rentabilidad */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Ingresos totales"  value={formatCurrency(rentabilidadKPIs.totalRevenue)} color="text-blue-600 dark:text-blue-400"/>
            <KpiCard label="Costo total"        value={formatCurrency(rentabilidadKPIs.totalCost)}    color="text-gray-600 dark:text-slate-300"/>
            <KpiCard label="Utilidad bruta"     value={formatCurrency(rentabilidadKPIs.totalUtil)}    color="text-emerald-600 dark:text-emerald-400"/>
            <KpiCard
              label="Margen bruto global"
              value={`${rentabilidadKPIs.margenGlobal}%`}
              color={
                rentabilidadKPIs.margenGlobal >= 30 ? 'text-green-600 dark:text-green-400' :
                rentabilidadKPIs.margenGlobal >= 15 ? 'text-amber-600 dark:text-amber-400' :
                'text-red-500 dark:text-red-400'
              }
              sub={
                rentabilidadKPIs.margenGlobal >= 30 ? '✓ Margen saludable' :
                rentabilidadKPIs.margenGlobal >= 15 ? '⚠ Margen ajustado' :
                '🚨 Margen bajo'
              }
            />
          </div>

          {/* Rentabilidad por categoría */}
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Rentabilidad por categoría</h3>
              <span className="text-xs text-gray-400 dark:text-slate-500">{rentabilidadCategorias.length} categorías</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700/40">
                    {['Categoría','Ingresos','Costo total','Utilidad','Margen %','Productos'].map(h => (
                      <th key={h} className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-2.5 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {rentabilidadCategorias.map((cat, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-slate-100">{cat.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300">{formatCurrency(cat.revenue)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{formatCurrency(cat.costTotal)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(cat.utilidad)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden w-16">
                            <div
                              className={`h-1.5 rounded-full ${cat.margenPct >= 30 ? 'bg-green-500' : cat.margenPct >= 15 ? 'bg-amber-400' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(100, Math.max(0, cat.margenPct))}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold ${cat.margenPct >= 30 ? 'text-green-600 dark:text-green-400' : cat.margenPct >= 15 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>
                            {cat.margenPct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400 text-center">{cat.productos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rentabilidad por producto */}
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                Rentabilidad por producto — top {Math.min(rentabilidadProductos.length, 50)}
              </h3>
              <ExcelButton onClick={() => handleExportExcel('rentabilidad')} label="Excel completo" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700/40">
                    {['Producto','Uds. vendidas','Costo unit.','P. Venta','Ingresos','Costo total','Utilidad','Margen %'].map(h => (
                      <th key={h} className={`text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-2.5 ${
                        ['Uds. vendidas','Costo unit.','P. Venta','Ingresos','Costo total','Utilidad','Margen %'].includes(h) ? 'text-right' : 'text-left'
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {rentabilidadProductos.slice(0, 50).map((p, i) => (
                    <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${p.margenNegativo ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-800 dark:text-slate-100 max-w-[200px] truncate">{p.name}</div>
                          {p.margenNegativo && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full shrink-0">
                              PÉRDIDA
                            </span>
                          )}
                          {!p.hasCost && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-full shrink-0">
                              est.
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-slate-500 font-mono">{p.barcode}</div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-right text-gray-600 dark:text-slate-300">{p.qtySold}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-gray-500 dark:text-slate-400">{formatCurrency(p.unitCost)}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-gray-600 dark:text-slate-300">{formatCurrency(p.unitPrice)}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-gray-700 dark:text-slate-200">{formatCurrency(p.revenue)}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-gray-500 dark:text-slate-400">{formatCurrency(p.costTotal)}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold">
                        <span className={p.utilidad >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                          {formatCurrency(p.utilidad)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          p.margenPct >= 30 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          p.margenPct >= 15 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {p.margenPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rentabilidadProductos.length > 50 && (
              <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-700 text-center text-xs text-gray-400 dark:text-slate-500">
                Mostrando 50 de {rentabilidadProductos.length} productos · Exporta a Excel para ver todos
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: Detalle ventas ══════════════════════════════════════════════ */}
      {activeTab === 'detalle_venta' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-slate-300">Click en una venta para ver el detalle de productos</p>
            <div className="flex gap-2">
              <ExcelButton onClick={handleExportOperaciones}                  label="Excel Ventas" />
              <ExcelButton onClick={() => handleExportExcel('detalle_venta')} label="Excel Productos Vendidos" />
              <PDFButton   onClick={() => handleExportPDF('ventas')} />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
            {filteredSales.length === 0
              ? <div className="text-center py-8 text-sm text-gray-300">Sin ventas en el período</div>
              : filteredSales.slice(0, 50).map((s) => {
                const descuentos    = s.totalDescuentos || s.discount || 0
                const baseImponible = parseFloat(Math.max(0, (s.subtotal || s.total) - descuentos).toFixed(2))
                const igvCalc       = parseFloat((baseImponible * 0.18).toFixed(2))
                const metodoPago    = s.payments?.map((p) => p.method).filter(Boolean).join(' + ') || '—'

                return (
                  <div key={s.id}>
                    <button
                      onClick={() => setExpandedSale(expandedSale === s.id ? null : s.id)}
                      className="w-full text-left border-b border-gray-100 dark:border-slate-700 hover:bg-blue-50/40 dark:hover:bg-slate-700/50 transition-colors">
                      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-4">
                        <div className="bg-blue-100 dark:bg-blue-900/40 rounded-lg px-2.5 py-1.5 flex-shrink-0">
                          <p className="text-xs text-blue-500 dark:text-blue-400 font-medium uppercase tracking-wide leading-none mb-0.5">Comprobante</p>
                          <p className="text-sm font-black font-mono text-blue-700 dark:text-blue-300">{s.invoiceNumber}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
                            <p className="text-base font-black text-gray-800 dark:text-slate-100">{formatCurrency(s.total)}</p>
                          </div>
                          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedSale === s.id ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                          </svg>
                        </div>
                      </div>
                      <div className="px-4 pb-2 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-x-3 gap-y-2 border-t border-gray-50 dark:border-slate-700/50 pt-2">
                        {[
                          { icon: '🕐', label: 'Fecha y Hora', val: new Date(s.createdAt).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) },
                          { icon: '📦', label: 'Cant. Productos', val: `${s.items?.length} prods · ${s.items?.reduce((a,i)=>a+i.quantity,0)} uds.` },
                          { icon: '💳', label: 'Forma de Pago', val: metodoPago },
                          { icon: '👤', label: 'Cajero', val: s.userName || '—' },
                          { icon: '📋', label: 'Base Imp.', val: formatCurrency(baseImponible) },
                          { icon: '🏷️', label: 'Descuentos', val: descuentos > 0 ? `-${formatCurrency(descuentos)}` : '—' },
                          { icon: '🧾', label: 'IGV (18%)', val: formatCurrency(igvCalc) },
                          { icon: '💰', label: 'Total', val: formatCurrency(s.total) },
                        ].map(({ icon, label, val }) => (
                          <div key={label} className="flex items-start gap-1.5">
                            <span className="text-gray-300 dark:text-slate-600 mt-0.5 flex-shrink-0">{icon}</span>
                            <div className="min-w-0">
                              <p className="text-xs text-gray-400 dark:text-slate-500 leading-none mb-0.5">{label}</p>
                              <p className="text-xs font-medium text-gray-700 dark:text-slate-300 leading-tight truncate">{val}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {s.note && (
                        <div className="px-4 pb-3 flex items-start gap-1.5">
                          <span className="text-gray-300 dark:text-slate-600 mt-0.5 flex-shrink-0">📝</span>
                          <div className="min-w-0">
                            <p className="text-xs text-gray-400 dark:text-slate-500 leading-none mb-0.5">Nota de venta</p>
                            <p className="text-xs font-medium text-gray-700 dark:text-slate-300 leading-tight">{s.note}</p>
                          </div>
                        </div>
                      )}
                    </button>

                    {expandedSale === s.id && (
                      <div className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700 px-4 py-3">
                        <table className="w-full">
                          <thead>
                            <tr>
                              {['Producto','Código','Cant.','P. Unit.','Descuento','Subtotal','Lote / Venc.'].map((h) => (
                                <th key={h} className={`text-xs font-medium text-gray-500 dark:text-slate-400 pb-2 ${h === 'Producto' ? 'text-left' : h === 'Lote / Venc.' ? 'text-left pl-4' : 'text-right'}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {s.items?.map((item, idx) => {
                              const itemDiscount = parseFloat((
                                (item.totalDiscount || 0) ||
                                ((item.campaignDiscount || 0) + (item.discount || 0))
                              ).toFixed(2))
                              const itemSubtotal = item.netTotal ?? item.subtotal ??
                                parseFloat(((item.quantity || 1) * item.unitPrice - itemDiscount).toFixed(2))
                              const hasBatch = item.batchAllocations?.length > 0

                              return (
                              <tr key={idx} className="border-t border-gray-100 dark:border-slate-700">
                                <td className="py-1.5 text-sm text-gray-800 dark:text-slate-100">{item.productName}</td>
                                <td className="py-1.5 text-xs font-mono text-gray-400 dark:text-slate-500 text-right">{item.barcode}</td>
                                <td className="py-1.5 text-sm text-right text-gray-600 dark:text-slate-300">{item.quantity} {item.unit || ''}</td>
                                <td className="py-1.5 text-sm text-right text-gray-600 dark:text-slate-300">{formatCurrency(item.unitPrice)}</td>
                                <td className="py-1.5 text-sm text-right text-green-600">
                                  {itemDiscount > 0 ? `-${formatCurrency(itemDiscount)}` : '—'}
                                </td>
                                <td className="py-1.5 text-sm text-right font-medium text-gray-800 dark:text-slate-100">
                                  {formatCurrency(itemSubtotal)}
                                </td>
                                <td className="py-1.5 pl-4">
                                  {hasBatch
                                    ? item.batchAllocations.map((b, bi) => (
                                        <div key={bi} className="flex flex-col">
                                          <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">{b.batchNumber}</span>
                                          {b.expiryDate && (
                                            <span className="text-[10px] text-gray-400 dark:text-slate-500">Venc: {new Date(b.expiryDate).toLocaleDateString('es-PE')}</span>
                                          )}
                                        </div>
                                      ))
                                    : <span className="text-xs text-gray-300 dark:text-slate-600">—</span>
                                  }
                                </td>
                              </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        <div className="flex justify-between text-sm font-semibold text-gray-800 dark:text-slate-100 pt-2 border-t border-gray-200 dark:border-slate-600 mt-2">
                          <span>Total de la venta</span><span>{formatCurrency(s.total)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
          {filteredSales.length > 50 && (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center">Mostrando 50 de {filteredSales.length} ventas. Exporta a Excel para ver todas.</p>
          )}
        </div>
      )}

      {/* ══ TAB: Devoluciones ═══════════════════════════════════════════════ */}
      {activeTab === 'devoluciones' && (
        <div className="space-y-5">
          {/* KPIs de devoluciones */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="NCs emitidas"       value={returnMetrics.count}                          color="text-red-600" />
            <KpiCard label="Total reembolsado"  value={formatCurrency(returnMetrics.totalReembolsado)} color="text-red-500" />
            <KpiCard label="Ventas netas"        value={formatCurrency(returnMetrics.ventasNetas)}    color="text-emerald-600" />
            <KpiCard label="Tasa de devolución" value={`${returnMetrics.tasaDevolucion}%`}           color="text-amber-600"
              sub={`de ${salesKPIs.count} ventas`}/>
          </div>

          {/* Top motivos */}
          {returnMetrics.topMotivos.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Top motivos de devolución</h3>
              <div className="space-y-2">
                {returnMetrics.topMotivos.map(({ motivo, count }) => {
                  const max = returnMetrics.topMotivos[0]?.count || 1
                  return (
                    <div key={motivo} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 dark:text-slate-400 w-48 truncate shrink-0">{motivo}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full bg-red-400" style={{ width: `${(count / max) * 100}%` }}/>
                      </div>
                      <span className="text-xs font-semibold text-gray-600 dark:text-slate-300 w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tabla de NCs */}
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300">Notas de Crédito emitidas</h3>
              <ExcelButton onClick={() => handleExportExcel('devoluciones')} />
            </div>
            {returnMetrics.list.length === 0 ? (
              <div className="text-center py-8 text-sm text-green-500">✓ Sin devoluciones en el período</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700/40">
                    {['NC N°', 'Boleta', 'Motivo', 'Cajero', 'Fecha', 'Reembolso'].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {returnMetrics.list.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="px-4 py-3 font-mono text-sm font-bold text-violet-600 dark:text-violet-400">{r.ncNumber}</td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-600 dark:text-slate-300">{r.invoiceNumber}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-300">{r.reasonLabel}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300">{r.userName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{formatDate(r.createdAt)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400">-{formatCurrency(r.totalRefund)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: Cuentas por cobrar ══════════════════════════════════════════ */}
      {activeTab === 'deuda' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300">Cuentas por cobrar</h3>
            <div className="flex gap-2">
              <ExcelButton onClick={() => handleExportExcel('deuda')} />
              <PDFButton   onClick={() => handleExportPDF('deuda')} />
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50">
                {['Cliente', 'Documento', 'Límite', 'Deuda', 'Disponible'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {clients.filter((c) => c.isActive && c.currentDebt > 0).length === 0
                ? <tr><td colSpan={5} className="text-center py-8 text-sm text-green-500">✓ Sin deudas pendientes</td></tr>
                : clients.filter((c) => c.isActive && c.currentDebt > 0).sort((a, b) => b.currentDebt - a.currentDebt).map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-slate-100">{c.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{c.documentType} {c.documentNumber}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-slate-300">{formatCurrency(c.creditLimit || 0)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-red-500">{formatCurrency(c.currentDebt || 0)}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600">{formatCurrency((c.creditLimit || 0) - (c.currentDebt || 0))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ TAB: Sin movimiento ══════════════════════════════════════════════ */}
      {activeTab === 'inmovilizado' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300">Productos sin movimiento (últimos 30 días)</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                Capital inmovilizado: <span className="font-medium text-amber-600">{formatCurrency(sinMovimiento.capitalInmovilizado)}</span>
              </p>
            </div>
            <ExcelButton onClick={() => handleExportExcel('inmovilizado')} />
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50">
                {['Producto', 'Stock', 'Costo unit.', 'Valor inmov.'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {sinMovimiento.lista.length === 0
                ? <tr><td colSpan={4} className="text-center py-8 text-sm text-green-500">✓ Todos los productos tuvieron movimiento</td></tr>
                : sinMovimiento.lista.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-800 dark:text-slate-100">{p.name}</div>
                      <div className="text-xs text-gray-400 dark:text-slate-500">{p.barcode}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-slate-300">{p.stock} {p.unit}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-slate-300">{formatCurrency(p.priceBuy)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-amber-600">{formatCurrency(p.priceBuy * p.stock)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {excelPreview && (
        <ExcelPreviewModal
          title={excelPreview.title}
          rows={excelPreview.rows}
          filename={excelPreview.filename}
          onClose={() => setExcelPreview(null)}
          onDownload={handleDownloadOperaciones}
        />
      )}
    </div>
  )
}
