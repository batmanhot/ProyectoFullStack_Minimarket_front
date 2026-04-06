import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatDate, isToday, isThisWeek, isThisMonth, exportCSV } from '../../shared/utils/helpers'

const COLORS = ['#378ADD','#5DCAA5','#EF9F27','#D85A30','#7F77DD','#D4537E']
const RANGES = [{ key: 'today', label: 'Hoy' },{ key: 'week', label: '7 días' },{ key: 'month', label: 'Mes' },{ key: 'all', label: 'Todo' }]

export default function Reports() {
  const { sales, products, clients, categories } = useStore()
  const [range, setRange]     = useState('month')
  const [activeTab, setActiveTab] = useState('ventas')

  const filteredSales = useMemo(() => {
    const completed = sales.filter(s => s.status === 'completada')
    if (range === 'today') return completed.filter(s => isToday(s.createdAt))
    if (range === 'week')  return completed.filter(s => isThisWeek(s.createdAt))
    if (range === 'month') return completed.filter(s => isThisMonth(s.createdAt))
    return completed
  }, [sales, range])

  const metrics = useMemo(() => {
    const total      = filteredSales.reduce((a, s) => a + s.total, 0)
    const count      = filteredSales.length
    const avgTicket  = count > 0 ? total / count : 0
    const baseImpon  = total / 1.18
    const igv        = total - baseImpon

    // Utilidad neta
    const utilidad = filteredSales.reduce((acc, s) => acc + s.items.reduce((a2, item) => {
      const p = products.find(pr => pr.id === item.productId)
      return a2 + (item.unitPrice - (p?.priceBuy || item.unitPrice * 0.7)) * item.quantity
    }, 0), 0)

    // Por método de pago (totales)
    const byPayment = {}
    filteredSales.forEach(s => {
      s.payments?.forEach(p => { byPayment[p.method] = (byPayment[p.method] || 0) + p.amount })
    })

    // Por categoría
    const byCat = {}
    filteredSales.forEach(s => {
      s.items?.forEach(item => {
        const pr  = products.find(p => p.id === item.productId)
        const cat = categories.find(c => c.id === pr?.categoryId)?.name || 'Sin categoría'
        byCat[cat] = (byCat[cat] || 0) + item.subtotal
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
    const topProducts = Object.values(byProduct).sort((a, b) => b.qty - a.qty).slice(0, 10)

    // Por día
    const byDay = {}
    filteredSales.forEach(s => { byDay[formatDate(s.createdAt)] = (byDay[formatDate(s.createdAt)] || 0) + s.total })
    const dailyChart = Object.entries(byDay).sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([dia, total]) => ({ dia, total: parseFloat(total.toFixed(2)) }))

    // Productos sin movimiento (30 días)
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)
    const movProductIds = new Set(
      sales.filter(s => new Date(s.createdAt) >= cutoff).flatMap(s => s.items?.map(i => i.productId) || [])
    )
    const sinMovimiento = products.filter(p => p.isActive && !movProductIds.has(p.id))
    const capitalInmovilizado = sinMovimiento.reduce((a, p) => a + p.priceBuy * p.stock, 0)

    return {
      total: parseFloat(total.toFixed(2)), count, avgTicket: parseFloat(avgTicket.toFixed(2)),
      igv: parseFloat(igv.toFixed(2)), baseImpon: parseFloat(baseImpon.toFixed(2)),
      utilidad: parseFloat(utilidad.toFixed(2)),
      byPayment, byCat, topProducts, dailyChart, sinMovimiento, capitalInmovilizado,
    }
  }, [filteredSales, products, categories])

  const paymentData  = Object.entries(metrics.byPayment).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: parseFloat(value.toFixed(2)) }))
  const catData      = Object.entries(metrics.byCat).sort((a,b)=>b[1]-a[1]).map(([name,value]) => ({ name, value: parseFloat(value.toFixed(2)) }))

  const TABS = [
    { key: 'ventas',    label: 'Ventas por día' },
    { key: 'productos', label: 'Productos top' },
    { key: 'categorias',label: 'Por categoría' },
    { key: 'deuda',     label: 'Cuentas por cobrar' },
    { key: 'inmovilizado', label: 'Sin movimiento' },
    { key: 'detalle',   label: 'Detalle ventas' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800">Reportes</h1>
          <p className="text-sm text-gray-400">{metrics.count} ventas en el período</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${range === r.key ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={() => exportCSV(
            filteredSales.map(s => ({ boleta: s.invoiceNumber, fecha: formatDate(s.createdAt), items: s.items?.length, total: s.total, metodo: s.payments?.map(p=>p.method).join('+'), estado: s.status })),
            'ventas'
          )} className="px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
            ⬇️ Exportar CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total ventas',     value: formatCurrency(metrics.total),     color: 'text-blue-600' },
          { label: 'Transacciones',    value: metrics.count,                     color: 'text-gray-800' },
          { label: 'Ticket promedio',  value: formatCurrency(metrics.avgTicket), color: 'text-teal-600' },
          { label: 'Utilidad neta',    value: formatCurrency(metrics.utilidad),  color: 'text-green-600' },
          { label: 'IGV generado',     value: formatCurrency(metrics.igv),       color: 'text-purple-600' },
        ].map(k => (
          <div key={k.label} className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-xl font-medium ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === t.key ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'ventas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-100 rounded-xl p-4 lg:col-span-2">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Ventas diarias</h3>
            {metrics.dailyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={metrics.dailyChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="dia"  tick={{ fontSize: 10, fill: '#9ca3af' }}/>
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `S/${v}`} width={52}/>
                  <Tooltip formatter={v => [formatCurrency(v), 'Ventas']} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                  <Bar dataKey="total" fill="#378ADD" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Sin datos</div>}
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Métodos de pago</h3>
            {paymentData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart><Pie data={paymentData} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                    {paymentData.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie><Tooltip formatter={v => [formatCurrency(v)]} contentStyle={{ fontSize: 12, borderRadius: 8 }}/></PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {paymentData.map((d,i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }}/><span className="text-gray-600">{d.name}</span></div>
                      <span className="font-medium text-gray-700">{formatCurrency(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="flex items-center justify-center h-32 text-gray-300 text-sm">Sin datos</div>}
          </div>
        </div>
      )}

      {activeTab === 'productos' && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between">
            <h3 className="text-sm font-medium text-gray-700">Top 10 productos más vendidos</h3>
            <button onClick={() => exportCSV(metrics.topProducts, 'top_productos')} className="text-xs text-blue-600 hover:underline">Exportar CSV</button>
          </div>
          <table className="w-full">
            <thead><tr className="bg-gray-50"><th className="text-left text-xs font-medium text-gray-500 px-4 py-2">#</th><th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Producto</th><th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Unidades</th><th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Ingresos</th><th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Proporción</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {metrics.topProducts.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-300">Sin datos</td></tr>
              ) : metrics.topProducts.map((p, i) => {
                const maxQty = metrics.topProducts[0]?.qty || 1
                return (
                  <tr key={p.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-400 font-medium">{i+1}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-700">{p.qty}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(p.revenue)}</td>
                    <td className="px-4 py-3"><div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden"><div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${(p.qty/maxQty*100).toFixed(0)}%` }}/></div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'categorias' && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Ventas por categoría</h3>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(catData.length * 44 + 60, 200)}>
              <BarChart data={catData} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `S/${v}`}/>
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={110}/>
                <Tooltip formatter={v => [formatCurrency(v), 'Ventas']} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                <Bar dataKey="value" fill="#5DCAA5" radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Sin datos</div>}
        </div>
      )}

      {activeTab === 'deuda' && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between">
            <h3 className="text-sm font-medium text-gray-700">Cuentas por cobrar</h3>
            <button onClick={() => exportCSV(clients.filter(c => c.currentDebt > 0).map(c => ({ nombre: c.name, documento: c.documentNumber, deuda: c.currentDebt, limite: c.creditLimit })), 'cuentas_cobrar')} className="text-xs text-blue-600 hover:underline">Exportar CSV</button>
          </div>
          <table className="w-full">
            <thead><tr className="bg-gray-50"><th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Cliente</th><th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Documento</th><th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Límite</th><th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Deuda</th><th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Disponible</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {clients.filter(c => c.isActive && c.currentDebt > 0).length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-sm text-green-500">✓ Sin deudas pendientes</td></tr>
              ) : clients.filter(c => c.isActive && c.currentDebt > 0).sort((a,b) => b.currentDebt - a.currentDebt).map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800">{c.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.documentType} {c.documentNumber}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(c.creditLimit)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-red-500">{formatCurrency(c.currentDebt)}</td>
                  <td className="px-4 py-3 text-sm text-right text-green-600">{formatCurrency((c.creditLimit||0) - (c.currentDebt||0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'inmovilizado' && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Productos sin movimiento (últimos 30 días)</h3>
              <p className="text-xs text-gray-400 mt-0.5">Capital inmovilizado: <span className="font-medium text-amber-600">{formatCurrency(metrics.capitalInmovilizado)}</span></p>
            </div>
            <button onClick={() => exportCSV(metrics.sinMovimiento.map(p => ({ nombre: p.name, barcode: p.barcode, stock: p.stock, costo: p.priceBuy, valor: p.priceBuy * p.stock })), 'sin_movimiento')} className="text-xs text-blue-600 hover:underline">Exportar CSV</button>
          </div>
          <table className="w-full">
            <thead><tr className="bg-gray-50"><th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Producto</th><th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Stock</th><th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Costo unit.</th><th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Valor inmov.</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {metrics.sinMovimiento.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-sm text-green-500">✓ Todos los productos tuvieron movimiento en los últimos 30 días</td></tr>
              ) : metrics.sinMovimiento.sort((a,b) => b.priceBuy*b.stock - a.priceBuy*a.stock).map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><div className="text-sm text-gray-800">{p.name}</div><div className="text-xs text-gray-400">{p.barcode}</div></td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{p.stock} {p.unit}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(p.priceBuy)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-amber-600">{formatCurrency(p.priceBuy * p.stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'detalle' && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between">
            <h3 className="text-sm font-medium text-gray-700">Detalle — {filteredSales.length} ventas</h3>
            <button onClick={() => exportCSV(filteredSales.map(s => ({ boleta: s.invoiceNumber, fecha: formatDate(s.createdAt), items: s.items?.length, total: s.total, metodo: s.payments?.map(p=>p.method).join('+'), estado: s.status })), 'detalle_ventas')} className="text-xs text-blue-600 hover:underline">Exportar CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gray-50"><th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Boleta</th><th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Fecha</th><th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Items</th><th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Total</th><th className="text-center text-xs font-medium text-gray-500 px-4 py-2">Método</th><th className="text-center text-xs font-medium text-gray-500 px-4 py-2">Estado</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {filteredSales.slice(0, 50).map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-600">{s.invoiceNumber}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-2.5 text-xs text-right text-gray-600">{s.items?.length}</td>
                    <td className="px-4 py-2.5 text-sm text-right font-medium text-gray-800">{formatCurrency(s.total)}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-gray-500">{s.payments?.map(p=>p.method).join('+')||'—'}</td>
                    <td className="px-4 py-2.5 text-center"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.status==='completada'?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
