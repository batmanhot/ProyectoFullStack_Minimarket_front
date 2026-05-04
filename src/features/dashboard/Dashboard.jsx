/**
 * Dashboard.jsx — Dashboard v2 con comparativo de períodos
 * Ruta: src/features/dashboard/Dashboard.jsx
 *
 * NUEVO vs v1:
 *  1. Selector de período (Hoy / 7 días / Mes / Todo)
 *  2. Selector de período de comparación (período anterior equivalente)
 *  3. Cada KPI muestra variación % respecto al período anterior
 *  4. Gráficas de área (ventas diarias) y barras (top 5 productos)
 *  5. Métricas de devoluciones integradas en el dashboard
 */

import { useMemo, useState } from 'react'
import { useStore }          from '../../store/index'
import { formatCurrency }    from '../../shared/utils/helpers'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const COLORS = ['#378ADD','#5DCAA5','#EF9F27','#D85A30','#7F77DD','#D4537E']

const RANGES = [
  { key: 'today', label: 'Hoy'     },
  { key: 'week',  label: '7 días'  },
  { key: 'month', label: 'Mes'     },
  { key: 'all',   label: 'Todo'    },
]

// ─── Helpers de fecha ─────────────────────────────────────────────────────────
function getDateRange(key) {
  const now   = new Date()
  const start = new Date(now)
  if (key === 'today') { start.setHours(0,0,0,0); return { from: start, to: now } }
  if (key === 'week')  { start.setDate(start.getDate()-6); start.setHours(0,0,0,0); return { from: start, to: now } }
  if (key === 'month') { start.setDate(1); start.setHours(0,0,0,0); return { from: start, to: now } }
  return { from: new Date(0), to: now }
}

function getPreviousRange(key) {
  const now = new Date()
  if (key === 'today') {
    const yd = new Date(now); yd.setDate(yd.getDate()-1); yd.setHours(0,0,0,0)
    const ye = new Date(yd); ye.setHours(23,59,59,999)
    return { from: yd, to: ye }
  }
  if (key === 'week') {
    const e = new Date(now); e.setDate(e.getDate()-7); e.setHours(23,59,59,999)
    const s = new Date(e);   s.setDate(s.getDate()-6); s.setHours(0,0,0,0)
    return { from: s, to: e }
  }
  if (key === 'month') {
    const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const s = new Date(now.getFullYear(), now.getMonth()-1, 1, 0, 0, 0)
    return { from: s, to: e }
  }
  return null
}

function filterSales(sales, range) {
  if (!range) return []
  return sales.filter(s => s.status === 'completada' &&
    new Date(s.createdAt) >= range.from && new Date(s.createdAt) <= range.to)
}

function calcMetrics(sales, products) {
  const total     = parseFloat(sales.reduce((a,s) => a + s.total, 0).toFixed(2))
  const count     = sales.length
  const avgTicket = count > 0 ? parseFloat((total/count).toFixed(2)) : 0
  const utilidad  = parseFloat(sales.reduce((acc,s) =>
    acc + s.items.reduce((a2, item) => {
      const p = products.find(pr => pr.id === item.productId)
      const cost = p?.priceBuy > 0 ? p.priceBuy : item.unitPrice * 0.7
      return a2 + (item.unitPrice - cost) * item.quantity
    }, 0), 0).toFixed(2))
  return { total, count, avgTicket, utilidad }
}

function pct(curr, prev) {
  if (!prev || prev === 0) return curr > 0 ? 100 : 0
  return parseFloat(((curr - prev) / prev * 100).toFixed(1))
}

// ─── KPI Card con tendencia ───────────────────────────────────────────────────
function KPICard({ label, value, trend, sub, icon, color = 'text-gray-800 dark:text-slate-100' }) {
  const trendColor = trend === null || trend === undefined ? '' :
    trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
  const trendIcon  = trend === null || trend === undefined ? '' : trend >= 0 ? '↑' : '↓'

  return (
    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
        {icon && <span className="text-xl opacity-50">{icon}</span>}
      </div>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      {(sub || trend !== undefined) && (
        <div className="flex items-center gap-2 mt-1">
          {trend !== null && trend !== undefined && (
            <span className={`text-xs font-semibold ${trendColor}`}>
              {trendIcon} {Math.abs(trend)}% vs período anterior
            </span>
          )}
          {sub && <p className="text-xs text-gray-400 dark:text-slate-500">{sub}</p>}
        </div>
      )}
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Dashboard() {
  const { sales, products, stockMovements, returns = [], clients } = useStore()
  const [range, setRange] = useState('month')

  const currRange = useMemo(() => getDateRange(range), [range])
  const prevRange = useMemo(() => getPreviousRange(range), [range])

  const currSales = useMemo(() => filterSales(sales, currRange), [sales, currRange])
  const prevSales = useMemo(() => filterSales(sales, prevRange), [sales, prevRange])

  const currM = useMemo(() => calcMetrics(currSales, products), [currSales, products])
  const prevM = useMemo(() => calcMetrics(prevSales, products), [prevSales, products])

  // Devoluciones del período actual
  const currReturns = useMemo(() => (returns||[]).filter(r =>
    r.status !== 'anulada' &&
    new Date(r.createdAt) >= currRange.from && new Date(r.createdAt) <= currRange.to
  ), [returns, currRange])
  const totalReembolsado = parseFloat(currReturns.reduce((a,r) => a + r.totalRefund, 0).toFixed(2))
  const ventasNetas      = parseFloat((currM.total - totalReembolsado).toFixed(2))

  // Tendencias
  const trends = {
    total:     pct(currM.total,     prevM.total),
    count:     pct(currM.count,     prevM.count),
    avgTicket: pct(currM.avgTicket, prevM.avgTicket),
    utilidad:  pct(currM.utilidad,  prevM.utilidad),
  }

  // Gráficas
  const dailyChart = useMemo(() => {
    const map = {}
    currSales.forEach(s => {
      const day = new Date(s.createdAt).toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit' })
      map[day] = parseFloat(((map[day]||0) + s.total).toFixed(2))
    })
    return Object.entries(map)
      .sort((a,b) => new Date(a[0]) - new Date(b[0]))
      .map(([dia, total]) => ({ dia, total }))
  }, [currSales])

  const top5 = useMemo(() => {
    const map = {}
    currSales.forEach(s => s.items?.forEach(item => {
      if (!map[item.productId]) map[item.productId] = { name: item.productName, qty: 0 }
      map[item.productId].qty += item.quantity
    }))
    return Object.values(map).sort((a,b) => b.qty - a.qty).slice(0,5)
      .map(p => ({ name: p.name.length > 20 ? p.name.slice(0,18)+'…' : p.name, unidades: p.qty }))
  }, [currSales])

  const paymentData = useMemo(() => {
    const map = {}
    currSales.forEach(s => s.payments?.forEach(p => {
      map[p.method] = parseFloat(((map[p.method]||0) + p.amount).toFixed(2))
    }))
    return Object.entries(map).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), value,
    }))
  }, [currSales])

  const lowStock    = products.filter(p => p.isActive && p.stock <= p.stockMin).length
  const clientsDebt = clients.filter(c => c.isActive && (c.currentDebt||0) > 0).length

  return (
    <div className="p-6 space-y-6">

      {/* Header + selector de período */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-0.5">
            {currSales.length} ventas · {prevRange ? 'comparando con período anterior' : 'sin comparación disponible'}
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                range === r.key ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-gray-500 dark:text-slate-400'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs principales con variación vs período anterior */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total ventas"     value={formatCurrency(currM.total)}     trend={prevRange ? trends.total     : null} icon="💰" color="text-blue-600"/>
        <KPICard label="Transacciones"    value={currM.count}                     trend={prevRange ? trends.count     : null} icon="🧾"/>
        <KPICard label="Ticket promedio"  value={formatCurrency(currM.avgTicket)} trend={prevRange ? trends.avgTicket : null} icon="📊" color="text-teal-600"/>
        <KPICard label="Utilidad neta"    value={formatCurrency(currM.utilidad)}  trend={prevRange ? trends.utilidad  : null} icon="📈" color="text-green-600"/>
      </div>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">↩️ Devoluciones</p>
          <p className="text-xl font-semibold text-red-500">{currReturns.length > 0 ? `-${formatCurrency(totalReembolsado)}` : '—'}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{currReturns.length} NCs emitidas</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">✅ Venta neta</p>
          <p className="text-xl font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(ventasNetas)}</p>
          <p className="text-xs text-emerald-500">ventas - devoluciones</p>
        </div>
        <div className={`rounded-xl p-4 ${lowStock > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
          <p className={`text-xs mb-1 ${lowStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>
            ⚠️ Stock bajo
          </p>
          <p className={`text-xl font-semibold ${lowStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>{lowStock}</p>
          <p className={`text-xs ${lowStock > 0 ? 'text-red-400' : 'text-gray-400 dark:text-slate-500'}`}>productos con stock bajo</p>
        </div>
        <div className={`rounded-xl p-4 ${clientsDebt > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
          <p className={`text-xs mb-1 ${clientsDebt > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-slate-400'}`}>
            📒 Créditos vivos
          </p>
          <p className={`text-xl font-semibold ${clientsDebt > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500'}`}>{clientsDebt}</p>
          <p className={`text-xs ${clientsDebt > 0 ? 'text-amber-500' : 'text-gray-400 dark:text-slate-500'}`}>clientes con deuda</p>
        </div>
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Ventas diarias */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300">Ventas diarias</h3>
            {prevRange && (
              <span className="text-xs text-gray-400 dark:text-slate-500">
                {trends.total >= 0 ? '↑' : '↓'} {Math.abs(trends.total)}% vs período anterior
              </span>
            )}
          </div>
          {dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyChart} margin={{ top:5, right:10, left:0, bottom:5 }}>
                <defs>
                  <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#378ADD" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#378ADD" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="dia" tick={{ fontSize:10, fill:'#9ca3af' }}/>
                <YAxis tick={{ fontSize:10, fill:'#9ca3af' }} tickFormatter={v=>`S/${v}`} width={52}/>
                <Tooltip formatter={v=>[formatCurrency(v),'Ventas']} contentStyle={{ fontSize:12, borderRadius:8 }}/>
                <Area type="monotone" dataKey="total" stroke="#378ADD" fill="url(#gradBlue)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-300 dark:text-slate-600 text-sm">Sin ventas en el período</div>
          )}
        </div>

        {/* Métodos de pago */}
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Métodos de pago</h3>
          {paymentData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                    {paymentData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={v=>[formatCurrency(v)]} contentStyle={{ fontSize:12, borderRadius:8 }}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {paymentData.map((d,i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i%COLORS.length] }}/>
                      <span className="text-gray-600 dark:text-slate-300">{d.name}</span>
                    </div>
                    <span className="font-medium text-gray-700 dark:text-slate-200">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-300 dark:text-slate-600 text-sm">Sin datos</div>
          )}
        </div>
      </div>

      {/* Top 5 productos */}
      {top5.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Top 5 productos más vendidos</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={top5} layout="vertical" margin={{ top:0, right:40, left:10, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
              <XAxis type="number" tick={{ fontSize:10, fill:'#9ca3af' }}/>
              <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill:'#6b7280' }} width={120}/>
              <Tooltip formatter={v=>[`${v} uds.`,'Ventas']} contentStyle={{ fontSize:12, borderRadius:8 }}/>
              <Bar dataKey="unidades" fill="#5DCAA5" radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
