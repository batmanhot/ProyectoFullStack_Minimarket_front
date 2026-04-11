import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatDate, isToday, isThisWeek, isThisMonth } from '../../shared/utils/helpers'
import { exportToExcel, exportToPDF } from '../../shared/utils/export'

const COLORS = ['#378ADD','#5DCAA5','#EF9F27','#D85A30','#7F77DD','#D4537E']
const RANGES = [{ key:'today',label:'Hoy' },{ key:'week',label:'7 días' },{ key:'month',label:'Mes' },{ key:'all',label:'Todo' }]
const TABS   = [
  { key:'ventas',       label:'Ventas por día' },
  { key:'productos',    label:'Productos top' },
  { key:'categorias',   label:'Por categoría' },
  { key:'detalle_venta',label:'Detalle ventas + productos' },
  { key:'deuda',        label:'Cuentas por cobrar' },
  { key:'inmovilizado', label:'Sin movimiento' },
]

export default function Reports() {
  const { sales, products, clients, categories, businessConfig, addAuditLog } = useStore()
  const [range, setRange]     = useState('month')
  const [activeTab, setActiveTab] = useState('ventas')
  const [expandedSale, setExpandedSale] = useState(null)

  const filteredSales = useMemo(() => {
    const completed = sales.filter(s => s.status === 'completada')
    if (range === 'today') return completed.filter(s => isToday(s.createdAt))
    if (range === 'week')  return completed.filter(s => isThisWeek(s.createdAt))
    if (range === 'month') return completed.filter(s => isThisMonth(s.createdAt))
    return completed
  }, [sales, range])

  const metrics = useMemo(() => {
    const total     = filteredSales.reduce((a, s) => a + s.total, 0)
    const count     = filteredSales.length
    const avgTicket = count > 0 ? total / count : 0

    // Utilidad neta
    const utilidad = filteredSales.reduce((acc, s) => acc + s.items.reduce((a2, item) => {
      const p = products.find(pr => pr.id === item.productId)
      return a2 + (item.unitPrice - (p?.priceBuy || item.unitPrice * 0.7)) * item.quantity
    }, 0), 0)

    // Por método de pago
    const byPayment = {}
    filteredSales.forEach(s => { s.payments?.forEach(p => { byPayment[p.method] = (byPayment[p.method]||0) + p.amount }) })

    // Por categoría
    const byCat = {}
    filteredSales.forEach(s => {
      s.items?.forEach(item => {
        const pr  = products.find(p => p.id === item.productId)
        const cat = categories.find(c => c.id === pr?.categoryId)?.name || 'Sin categoría'
        byCat[cat] = (byCat[cat]||0) + item.subtotal
      })
    })

    // Top productos
    const byProduct = {}
    filteredSales.forEach(s => {
      s.items?.forEach(item => {
        if (!byProduct[item.productId]) byProduct[item.productId] = { name: item.productName, qty: 0, revenue: 0 }
        byProduct[item.productId].qty     += item.quantity
        byProduct[item.productId].revenue += item.subtotal
      })
    })
    const topProducts = Object.values(byProduct).sort((a,b) => b.qty - a.qty).slice(0, 10)

    // Por día
    const byDay = {}
    filteredSales.forEach(s => { byDay[formatDate(s.createdAt)] = (byDay[formatDate(s.createdAt)]||0) + s.total })
    const dailyChart = Object.entries(byDay).sort((a,b) => new Date(a[0])-new Date(b[0])).map(([dia,total]) => ({ dia, total: parseFloat(total.toFixed(2)) }))

    // Sin movimiento
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30)
    const movIds = new Set(sales.filter(s => new Date(s.createdAt) >= cutoff).flatMap(s => s.items?.map(i => i.productId)||[]))
    const sinMovimiento = products.filter(p => p.isActive && !movIds.has(p.id))
    const capitalInmovilizado = sinMovimiento.reduce((a,p) => a+p.priceBuy*p.stock, 0)

    const igv = total / 1.18 * 0.18

    return { total, count, avgTicket, utilidad, igv, byPayment, byCat, topProducts, dailyChart, sinMovimiento, capitalInmovilizado }
  }, [filteredSales, products, categories, sales])

  const paymentData = Object.entries(metrics.byPayment).map(([name, value]) => ({ name: name.charAt(0).toUpperCase()+name.slice(1), value: parseFloat(value.toFixed(2)) }))
  const catData     = Object.entries(metrics.byCat).sort((a,b)=>b[1]-a[1]).map(([name,value]) => ({ name, value: parseFloat(value.toFixed(2)) }))

  const handleExportExcel = (tab) => {
    addAuditLog({ action: 'EXPORT', module: 'Reportes', detail: `Excel: ${tab} · ${filteredSales.length} ventas` })
    if (tab === 'ventas') {
      exportToExcel(filteredSales.map(s => ({ Boleta: s.invoiceNumber, Fecha: formatDate(s.createdAt), Items: s.items?.length, Total: s.total, Método: s.payments?.map(p=>p.method).join('+'), Estado: s.status })), 'ventas')
    } else if (tab === 'productos') {
      exportToExcel(metrics.topProducts.map((p,i) => ({ Posición: i+1, Producto: p.name, Unidades: p.qty, Ingresos: p.revenue.toFixed(2) })), 'top_productos')
    } else if (tab === 'detalle_venta') {
      const rows = filteredSales.flatMap(s => s.items?.map(item => ({
        Boleta: s.invoiceNumber, Fecha: formatDate(s.createdAt), Producto: item.productName,
        Cantidad: item.quantity, PrecioUnit: item.unitPrice, Descuento: item.discount||0, Subtotal: item.subtotal
      }))||[])
      exportToExcel(rows, 'detalle_productos_ventas')
    } else if (tab === 'deuda') {
      exportToExcel(clients.filter(c=>c.currentDebt>0).map(c => ({ Nombre: c.name, Documento: c.documentNumber, Deuda: c.currentDebt, Límite: c.creditLimit })), 'cuentas_cobrar')
    } else if (tab === 'inmovilizado') {
      exportToExcel(metrics.sinMovimiento.map(p => ({ Nombre: p.name, Barcode: p.barcode, Stock: p.stock, Costo: p.priceBuy, ValorInmovilizado: p.priceBuy*p.stock })), 'sin_movimiento')
    }
  }

  const handleExportPDF = (tab) => {
    addAuditLog({ action: 'EXPORT', module: 'Reportes', detail: `PDF: ${tab}` })
    if (tab === 'productos') {
      exportToPDF('Top 10 Productos Más Vendidos', ['#','Producto','Unidades Vendidas','Ingresos'],
        metrics.topProducts.map((p,i) => [i+1, p.name, p.qty, formatCurrency(p.revenue)]), businessConfig?.name)
    } else if (tab === 'deuda') {
      exportToPDF('Reporte de Cuentas por Cobrar', ['Cliente','Documento','Límite Crédito','Deuda Actual'],
        clients.filter(c=>c.currentDebt>0).map(c => [c.name, `${c.documentType} ${c.documentNumber}`, formatCurrency(c.creditLimit||0), formatCurrency(c.currentDebt||0)]), businessConfig?.name)
    } else {
      exportToPDF(`Reporte de Ventas — ${range}`, ['Boleta','Fecha','Items','Total','Método','Estado'],
        filteredSales.slice(0,200).map(s => [s.invoiceNumber, formatDate(s.createdAt), s.items?.length, formatCurrency(s.total), s.payments?.map(p=>p.method).join('+'), s.status]), businessConfig?.name)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Reportes</h1><p className="text-sm text-gray-400 dark:text-slate-500">{metrics.count} ventas en el período</p></div>
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          {RANGES.map(r => <button key={r.key} onClick={() => setRange(r.key)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${range===r.key?'bg-white shadow text-blue-600':'text-gray-500'}`}>{r.label}</button>)}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label:'Total ventas',    value: formatCurrency(metrics.total),     color:'text-blue-600' },
          { label:'Transacciones',   value: metrics.count,                     color:'text-gray-800' },
          { label:'Ticket promedio', value: formatCurrency(metrics.avgTicket), color:'text-teal-600' },
          { label:'Utilidad neta',   value: formatCurrency(metrics.utilidad),  color:'text-green-600' },
          { label:'IGV generado',    value: formatCurrency(metrics.igv),       color:'text-purple-600' },
        ].map(k => (
          <div key={k.label} className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4"><p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{k.label}</p><p className={`text-xl font-medium ${k.color}`}>{k.value}</p></div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1 flex-wrap">
        {TABS.map(t => <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab===t.key?'bg-white shadow text-blue-600':'text-gray-500 dark:text-slate-400 hover:text-gray-700'}`}>{t.label}</button>)}
      </div>

      {/* TAB: Ventas por día */}
      {activeTab === 'ventas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Ventas diarias</h3>
              <div className="flex gap-2"><button onClick={() => handleExportExcel('ventas')} className="text-xs text-blue-600 hover:underline">Excel</button><button onClick={() => handleExportPDF('ventas')} className="text-xs text-blue-600 hover:underline">PDF</button></div>
            </div>
            {metrics.dailyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={metrics.dailyChart} margin={{top:5,right:10,left:0,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="dia" tick={{fontSize:10,fill:'#9ca3af'}}/>
                  <YAxis tick={{fontSize:10,fill:'#9ca3af'}} tickFormatter={v=>`S/${v}`} width={52}/>
                  <Tooltip formatter={v=>[formatCurrency(v),'Ventas']} contentStyle={{fontSize:12,borderRadius:8}}/>
                  <Bar dataKey="total" fill="#378ADD" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Sin datos en el período</div>}
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Métodos de pago</h3>
            {paymentData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart><Pie data={paymentData} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                    {paymentData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie><Tooltip formatter={v=>[formatCurrency(v)]} contentStyle={{fontSize:12,borderRadius:8}}/></PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {paymentData.map((d,i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{background:COLORS[i%COLORS.length]}}/><span className="text-gray-600 dark:text-slate-300">{d.name}</span></div>
                      <span className="font-medium text-gray-700">{formatCurrency(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="flex items-center justify-center h-32 text-gray-300 text-sm">Sin datos</div>}
          </div>
        </div>
      )}

      {/* TAB: Top productos */}
      {activeTab === 'productos' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Top 10 productos más vendidos</h3>
            <div className="flex gap-2"><button onClick={() => handleExportExcel('productos')} className="text-xs text-blue-600 hover:underline">Excel</button><button onClick={() => handleExportPDF('productos')} className="text-xs text-blue-600 hover:underline">PDF</button></div>
          </div>
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-slate-800/50"><th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">#</th><th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Producto</th><th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Unidades</th><th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Ingresos</th><th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Proporción</th></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {metrics.topProducts.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-300">Sin datos</td></tr>
              : metrics.topProducts.map((p,i) => {
                const max = metrics.topProducts[0]?.qty||1
                return (
                  <tr key={p.name} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500 font-medium">{i+1}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-slate-100 max-w-xs truncate">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-700">{p.qty}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(p.revenue)}</td>
                    <td className="px-4 py-3"><div className="w-24 bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden"><div className="h-1.5 rounded-full bg-blue-400" style={{width:`${(p.qty/max*100).toFixed(0)}%`}}/></div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: Por categoría */}
      {activeTab === 'categorias' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Ventas por categoría</h3>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(catData.length*44+60,200)}>
              <BarChart data={catData} layout="vertical" margin={{top:5,right:60,left:10,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                <XAxis type="number" tick={{fontSize:11,fill:'#9ca3af'}} tickFormatter={v=>`S/${v}`}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'#6b7280'}} width={110}/>
                <Tooltip formatter={v=>[formatCurrency(v),'Ventas']} contentStyle={{fontSize:12,borderRadius:8}}/>
                <Bar dataKey="value" fill="#5DCAA5" radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Sin datos</div>}
        </div>
      )}

      {/* TAB: Detalle ventas + productos — punto 2 */}
      {activeTab === 'detalle_venta' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-slate-300">Click en una venta para ver el detalle de productos vendidos</p>
            <div className="flex gap-2">
              <button onClick={() => handleExportExcel('detalle_venta')} className="px-3 py-1.5 text-xs border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">📊 Excel detalle</button>
              <button onClick={() => handleExportPDF('ventas')} className="px-3 py-1.5 text-xs border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">📄 PDF</button>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
            {filteredSales.length === 0 ? <div className="text-center py-8 text-sm text-gray-300">Sin ventas en el período</div>
            : filteredSales.slice(0, 50).map(s => (
              <div key={s.id}>
                <button
                  onClick={() => setExpandedSale(expandedSale === s.id ? null : s.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 text-left border-b border-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-gray-500 dark:text-slate-400">{s.invoiceNumber}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{formatDate(s.createdAt)}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{s.items?.length} producto(s)</span>
                    {s.payments?.map(p=>p.method).filter(Boolean).length > 0 && (
                      <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full">{s.payments.map(p=>p.method).join(' + ')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-800 dark:text-slate-100">{formatCurrency(s.total)}</span>
                    <svg className={`w-4 h-4 text-gray-400 dark:text-slate-500 transition-transform ${expandedSale===s.id?'rotate-180':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                  </div>
                </button>
                {expandedSale === s.id && (
                  <div className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700 px-4 py-3">
                    <table className="w-full">
                      <thead><tr>{['Producto','Código','Cant.','P. Unit.','Descuento','Subtotal'].map(h => <th key={h} className={`text-xs font-medium text-gray-500 dark:text-slate-400 pb-2 ${h==='Cant.'||h.includes('.')&&'text-right'} ${h==='Producto'?'text-left':'text-right'}`}>{h}</th>)}</tr></thead>
                      <tbody>
                        {s.items?.map((item, idx) => (
                          <tr key={idx} className="border-t border-gray-100 dark:border-slate-700">
                            <td className="py-1.5 text-sm text-gray-800 dark:text-slate-100">{item.productName}</td>
                            <td className="py-1.5 text-xs font-mono text-gray-400 dark:text-slate-500 text-right">{item.barcode}</td>
                            <td className="py-1.5 text-sm text-right text-gray-600 dark:text-slate-300">{item.quantity} {item.unit||''}</td>
                            <td className="py-1.5 text-sm text-right text-gray-600 dark:text-slate-300">{formatCurrency(item.unitPrice)}</td>
                            <td className="py-1.5 text-sm text-right text-green-600">{item.discount > 0 ? `-${formatCurrency(item.discount)}` : '—'}</td>
                            <td className="py-1.5 text-sm text-right font-medium text-gray-800 dark:text-slate-100">{formatCurrency(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-between text-sm font-semibold text-gray-800 dark:text-slate-100 pt-2 border-t border-gray-200 dark:border-slate-600 mt-2">
                      <span>Total de la venta</span><span>{formatCurrency(s.total)}</span>
                    </div>
                    {s.payments && s.payments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {s.payments.map((p, i) => (
                          <div key={i} className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
                            <span>Pago {i+1}: {p.method}{p.reference ? ` (${p.reference})` : ''}</span>
                            <span>{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {filteredSales.length > 50 && <p className="text-xs text-gray-400 dark:text-slate-500 text-center">Mostrando 50 de {filteredSales.length} ventas. Exporta a Excel para ver todas.</p>}
        </div>
      )}

      {/* TAB: Deuda */}
      {activeTab === 'deuda' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Cuentas por cobrar</h3>
            <div className="flex gap-2"><button onClick={() => handleExportExcel('deuda')} className="text-xs text-blue-600 hover:underline">Excel</button><button onClick={() => handleExportPDF('deuda')} className="text-xs text-blue-600 hover:underline">PDF</button></div>
          </div>
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-slate-800/50"><th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Cliente</th><th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Documento</th><th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Límite</th><th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Deuda</th><th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Disponible</th></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {clients.filter(c=>c.isActive&&c.currentDebt>0).length===0
                ? <tr><td colSpan={5} className="text-center py-8 text-sm text-green-500">✓ Sin deudas pendientes</td></tr>
                : clients.filter(c=>c.isActive&&c.currentDebt>0).sort((a,b)=>b.currentDebt-a.currentDebt).map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-slate-100">{c.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{c.documentType} {c.documentNumber}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-slate-300">{formatCurrency(c.creditLimit||0)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-red-500">{formatCurrency(c.currentDebt||0)}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600">{formatCurrency((c.creditLimit||0)-(c.currentDebt||0))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: Sin movimiento */}
      {activeTab === 'inmovilizado' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Productos sin movimiento (últimos 30 días)</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Capital inmovilizado: <span className="font-medium text-amber-600">{formatCurrency(metrics.capitalInmovilizado)}</span></p>
            </div>
            <button onClick={() => handleExportExcel('inmovilizado')} className="text-xs text-blue-600 hover:underline">Excel</button>
          </div>
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-slate-800/50"><th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Producto</th><th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Stock</th><th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Costo unit.</th><th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Valor inmov.</th></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {metrics.sinMovimiento.length===0
                ? <tr><td colSpan={4} className="text-center py-8 text-sm text-green-500">✓ Todos los productos tuvieron movimiento</td></tr>
                : metrics.sinMovimiento.sort((a,b)=>b.priceBuy*b.stock-a.priceBuy*a.stock).map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3"><div className="text-sm text-gray-800 dark:text-slate-100">{p.name}</div><div className="text-xs text-gray-400 dark:text-slate-500">{p.barcode}</div></td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-slate-300">{p.stock} {p.unit}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-slate-300">{formatCurrency(p.priceBuy)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-amber-600">{formatCurrency(p.priceBuy*p.stock)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
