/**
 * Dashboard.jsx — Dashboard adaptativo por rol v3
 * Ruta: src/features/dashboard/Dashboard.jsx
 *
 * VISTAS POR ROL:
 *  admin / gerente  → Vista ejecutiva: rentabilidad, comparativo períodos,
 *                     gráficas de tendencia, top productos, cuentas por cobrar,
 *                     alertas críticas del negocio
 *  supervisor       → Vista operativa: ventas del día, stock bajo, devoluciones,
 *                     rendimiento por cajero, alertas de inventario
 *  cajero           → Vista de turno: ventas propias del turno actual,
 *                     contador de transacciones, caja abierta/cerrada,
 *                     acceso rápido a POS
 */

import { useMemo, useState } from 'react'
import { useStore }          from '../../store/index'
import { formatCurrency, formatDateTime } from '../../shared/utils/helpers'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts'

const COLORS = ['#378ADD','#5DCAA5','#EF9F27','#D85A30','#7F77DD','#D4537E']

// ─── Helpers comunes ──────────────────────────────────────────────────────────
function getRange(key) {
  const now = new Date(), s = new Date(now)
  if (key === 'today') { s.setHours(0,0,0,0); return { from: s, to: now } }
  if (key === 'week')  { s.setDate(s.getDate()-6); s.setHours(0,0,0,0); return { from: s, to: now } }
  if (key === 'month') { s.setDate(1); s.setHours(0,0,0,0); return { from: s, to: now } }
  return { from: new Date(0), to: now }
}

function getPrevRange(key) {
  const now = new Date()
  if (key === 'today') {
    const d = new Date(now); d.setDate(d.getDate()-1)
    return { from: new Date(d.setHours(0,0,0,0)), to: new Date(d.setHours(23,59,59,999)) }
  }
  if (key === 'week') {
    const e = new Date(now); e.setDate(e.getDate()-7); e.setHours(23,59,59,999)
    const s = new Date(e);   s.setDate(s.getDate()-6); s.setHours(0,0,0,0)
    return { from: s, to: e }
  }
  if (key === 'month') {
    const e = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59)
    const s = new Date(now.getFullYear(), now.getMonth()-1, 1, 0,0,0)
    return { from: s, to: e }
  }
  return null
}

const filterSales = (sales, range) =>
  range ? sales.filter(s => s.status === 'completada' &&
    new Date(s.createdAt) >= range.from && new Date(s.createdAt) <= range.to) : []

const pct = (curr, prev) => {
  if (!prev || prev === 0) return curr > 0 ? 100 : 0
  return parseFloat(((curr - prev) / prev * 100).toFixed(1))
}

// ─── Sub-componentes compartidos ──────────────────────────────────────────────
function KPI({ label, value, trend, icon, color = 'text-gray-800 dark:text-slate-100', sub }) {
  const up = trend >= 0
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
        {icon && <span className="text-xl opacity-40">{icon}</span>}
      </div>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      {trend !== undefined && trend !== null && (
        <p className={`text-xs font-medium mt-1 ${up ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
          {up ? '↑' : '↓'} {Math.abs(trend)}% vs período anterior
        </p>
      )}
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }) {
  return <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest">{children}</h2>
}

// ─── VISTA CAJERO ─────────────────────────────────────────────────────────────
function DashboardCajero({ currentUser, sales, activeCashSession, products }) {
  const turnoSales = useMemo(() => {
    if (!activeCashSession) return []
    return sales.filter(s =>
      s.status === 'completada' &&
      s.userId === currentUser?.id &&
      new Date(s.createdAt) >= new Date(activeCashSession.openedAt)
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [sales, activeCashSession, currentUser])

  const turnoTotal  = turnoSales.reduce((a, s) => a + s.total, 0)
  const turnoCount  = turnoSales.length
  const turnoAvg    = turnoCount > 0 ? turnoTotal / turnoCount : 0
  const efectivo    = turnoSales.reduce((a, s) => a + (s.payments?.find(p => p.method === 'efectivo')?.amount || 0), 0)

  const horaInicio  = activeCashSession ? new Date(activeCashSession.openedAt) : null
  const duracion    = horaInicio
    ? Math.floor((Date.now() - horaInicio) / 60000)
    : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header personalizado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">
            Buen día, {currentUser?.fullName?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">
            {activeCashSession
              ? `Turno activo desde ${horaInicio?.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} · ${duracion} min.`
              : 'No hay caja abierta — ve a Caja para aperturar'}
          </p>
        </div>
        {!activeCashSession && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400 font-medium">
            ⚠️ Caja cerrada
          </div>
        )}
      </div>

      {/* KPIs del turno */}
      <div>
        <SectionTitle>Mi turno actual</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
          <KPI label="Ventas del turno"     value={formatCurrency(turnoTotal)} icon="💰" color="text-blue-600 dark:text-blue-400"/>
          <KPI label="Transacciones"         value={turnoCount}                 icon="🧾"/>
          <KPI label="Ticket promedio"       value={formatCurrency(turnoAvg)}  icon="📊"/>
          <KPI label="Efectivo en turno"     value={formatCurrency(efectivo)}  icon="💵" color="text-emerald-600 dark:text-emerald-400"/>
        </div>
      </div>

      {/* Últimas ventas del turno */}
      {turnoSales.length > 0 ? (
        <div>
          <SectionTitle>Mis últimas ventas</SectionTitle>
          <div className="mt-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50">
                  {['Boleta','Hora','Productos','Método','Total'].map(h => (
                    <th key={h} className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-2.5 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {turnoSales.slice(0, 10).map(s => {
                  const method = s.payments?.[0]?.method || '—'
                  const methodLabels = { efectivo: '💵 Efectivo', yape: '💜 Yape', tarjeta: '💳 Tarjeta', credito: '📒 Crédito' }
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-2.5 text-xs font-mono text-gray-500 dark:text-slate-400">{s.invoiceNumber}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400">
                        {new Date(s.createdAt).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-slate-300">{s.items?.length || 0}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400">{methodLabels[method] || method}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-slate-100">{formatCurrency(s.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl">
          <div className="text-5xl mb-3 opacity-20">🧾</div>
          <p className="text-gray-400 dark:text-slate-500 font-medium">Sin ventas en este turno aún</p>
          <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">Ve al Punto de Venta para comenzar a atender</p>
        </div>
      )}
    </div>
  )
}

// ─── VISTA SUPERVISOR ─────────────────────────────────────────────────────────
function DashboardSupervisor({ sales, products, categories, returns, currentUser, users }) {
  const todayRange = useMemo(() => getRange('today'), [])
  const todaySales = useMemo(() => filterSales(sales, todayRange), [sales, todayRange])

  const totalHoy      = todaySales.reduce((a, s) => a + s.total, 0)
  const countHoy      = todaySales.length
  const lowStock      = products.filter(p => p.isActive && p.stock <= p.stockMin && p.stock > 0)
  const outOfStock    = products.filter(p => p.isActive && p.stock <= 0)
  const devHoy        = (returns || []).filter(r => {
    const d = new Date(r.createdAt)
    return d >= todayRange.from && d <= todayRange.to
  })

  // Ventas por cajero hoy
  const byCajero = useMemo(() => {
    const map = {}
    todaySales.forEach(s => {
      if (!map[s.userId]) map[s.userId] = { name: s.userName || s.userId, total: 0, count: 0 }
      map[s.userId].total += s.total
      map[s.userId].count++
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [todaySales])

  // Ventas por hora (hoy)
  const byHour = useMemo(() => {
    const map = {}
    for (let h = 6; h <= 22; h++) map[`${h}:00`] = 0
    todaySales.forEach(s => {
      const h = new Date(s.createdAt).getHours()
      const key = `${h}:00`
      if (map[key] !== undefined) map[key] += s.total
    })
    return Object.entries(map).map(([hora, total]) => ({ hora, total: parseFloat(total.toFixed(2)) }))
  }, [todaySales])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Panel Operativo</h1>
        <p className="text-sm text-gray-400 dark:text-slate-500">Supervisión del día · {new Date().toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long' })}</p>
      </div>

      {/* KPIs del día */}
      <div>
        <SectionTitle>Operaciones del día</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
          <KPI label="Ventas del día"  value={formatCurrency(totalHoy)}    icon="💰" color="text-blue-600 dark:text-blue-400"/>
          <KPI label="Transacciones"    value={countHoy}                    icon="🧾"/>
          <KPI label="Devoluciones"     value={devHoy.length}               icon="↩️" color={devHoy.length > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-800 dark:text-slate-100'}/>
          <KPI label="Cajeros activos"  value={byCajero.length}             icon="👤"/>
        </div>
      </div>

      {/* Alertas de inventario */}
      {(outOfStock.length > 0 || lowStock.length > 0) && (
        <div>
          <SectionTitle>Alertas de inventario</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {outOfStock.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">❌ Sin stock ({outOfStock.length})</p>
                <div className="space-y-1">
                  {outOfStock.slice(0, 5).map(p => (
                    <p key={p.id} className="text-xs text-red-600 dark:text-red-400">• {p.name} — 0 {p.unit}</p>
                  ))}
                  {outOfStock.length > 5 && <p className="text-xs text-red-400">+{outOfStock.length - 5} más</p>}
                </div>
              </div>
            )}
            {lowStock.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">⚠️ Stock bajo ({lowStock.length})</p>
                <div className="space-y-1">
                  {lowStock.slice(0, 5).map(p => (
                    <p key={p.id} className="text-xs text-amber-600 dark:text-amber-400">• {p.name} — {p.stock}/{p.stockMin} {p.unit}</p>
                  ))}
                  {lowStock.length > 5 && <p className="text-xs text-amber-400">+{lowStock.length - 5} más</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ventas por hora */}
      <div>
        <SectionTitle>Flujo de ventas por hora</SectionTitle>
        <div className="mt-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={byHour} margin={{ top:5, right:10, left:0, bottom:5 }}>
              <defs>
                <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#5DCAA5" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#5DCAA5" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="hora" tick={{ fontSize:10, fill:'#9ca3af' }}/>
              <YAxis tick={{ fontSize:10, fill:'#9ca3af' }} tickFormatter={v=>`S/${v}`} width={50}/>
              <Tooltip formatter={v=>[formatCurrency(v),'Ventas']} contentStyle={{ fontSize:12, borderRadius:8 }}/>
              <Area type="monotone" dataKey="total" stroke="#5DCAA5" fill="url(#gradGreen)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rendimiento por cajero */}
      {byCajero.length > 0 && (
        <div>
          <SectionTitle>Rendimiento por cajero — hoy</SectionTitle>
          <div className="mt-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50">
                  {['Cajero','Transacciones','Total vendido','Ticket prom.'].map(h => (
                    <th key={h} className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-2.5 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {byCajero.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-slate-100">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300">{c.count}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-slate-100">{formatCurrency(c.total)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300">{formatCurrency(c.count > 0 ? c.total/c.count : 0)}</td>
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

// ─── VISTA ADMIN / GERENTE ────────────────────────────────────────────────────
function DashboardEjecutivo({ sales, products, categories, returns, clients }) {
  const [range, setRange] = useState('month')

  const currRange = useMemo(() => getRange(range), [range])
  const prevRange = useMemo(() => getPrevRange(range), [range])
  const currSales = useMemo(() => filterSales(sales, currRange), [sales, currRange])
  const prevSales = useMemo(() => filterSales(sales, prevRange), [sales, prevRange])

  // Métricas
  const currTotal   = parseFloat(currSales.reduce((a,s) => a+s.total, 0).toFixed(2))
  const prevTotal   = parseFloat(prevSales.reduce((a,s) => a+s.total, 0).toFixed(2))
  const currCount   = currSales.length
  const prevCount   = prevSales.length
  const currAvg     = currCount > 0 ? parseFloat((currTotal/currCount).toFixed(2)) : 0
  const prevAvg     = prevCount > 0 ? parseFloat((prevTotal/prevCount).toFixed(2)) : 0

  const currUtil    = parseFloat(currSales.reduce((acc,s) =>
    acc + (s.items||[]).reduce((a2, item) => {
      const p = products.find(pr => pr.id === item.productId)
      const cost = p?.priceBuy > 0 ? p.priceBuy : item.unitPrice * 0.7
      return a2 + (item.unitPrice - cost) * (item.quantity || 1)
    }, 0), 0).toFixed(2))
  const prevUtil    = parseFloat(prevSales.reduce((acc,s) =>
    acc + (s.items||[]).reduce((a2, item) => {
      const p = products.find(pr => pr.id === item.productId)
      const cost = p?.priceBuy > 0 ? p.priceBuy : item.unitPrice * 0.7
      return a2 + (item.unitPrice - cost) * (item.quantity || 1)
    }, 0), 0).toFixed(2))

  const currDev     = (returns||[]).filter(r => r.status !== 'anulada' &&
    new Date(r.createdAt) >= currRange.from).reduce((a,r) => a+r.totalRefund, 0)
  const ventasNetas = parseFloat((currTotal - currDev).toFixed(2))
  const margenPct   = currTotal > 0 ? parseFloat((currUtil/currTotal*100).toFixed(1)) : 0

  // Cuentas por cobrar
  const cxcClients  = clients.filter(c => c.isActive && (c.currentDebt||0) > 0)
  const totalCxC    = cxcClients.reduce((a,c) => a+(c.currentDebt||0), 0)

  // Top 5 rentables
  const topRentable = useMemo(() => {
    const map = {}
    currSales.forEach(s => s.items?.forEach(item => {
      const p = products.find(pr => pr.id === item.productId)
      if (!p) return
      if (!map[item.productId]) map[item.productId] = { name: item.productName, util: 0, ventas: 0 }
      const cost = p.priceBuy > 0 ? p.priceBuy : item.unitPrice * 0.7
      map[item.productId].util   += (item.unitPrice - cost) * (item.quantity||1)
      map[item.productId].ventas += item.netTotal || item.unitPrice * (item.quantity||1)
    }))
    return Object.values(map)
      .sort((a,b) => b.util - a.util)
      .slice(0,8)
      .map(p => ({ ...p, util: parseFloat(p.util.toFixed(2)), ventas: parseFloat(p.ventas.toFixed(2)),
        margen: p.ventas > 0 ? parseFloat((p.util/p.ventas*100).toFixed(1)) : 0,
        name: p.name.length > 22 ? p.name.slice(0,20)+'…' : p.name,
      }))
  }, [currSales, products])

  // Ventas diarias para gráfica
  const dailyChart = useMemo(() => {
    const map = {}
    currSales.forEach(s => {
      const day = new Date(s.createdAt).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit'})
      if (!map[day]) map[day] = { dia: day, ventas: 0, utilidad: 0 }
      map[day].ventas += s.total
      map[day].utilidad += (s.items||[]).reduce((a, item) => {
        const p = products.find(pr => pr.id === item.productId)
        const cost = p?.priceBuy > 0 ? p.priceBuy : item.unitPrice * 0.7
        return a + (item.unitPrice - cost) * (item.quantity||1)
      }, 0)
    })
    return Object.values(map).map(d => ({
      ...d,
      ventas:   parseFloat(d.ventas.toFixed(2)),
      utilidad: parseFloat(d.utilidad.toFixed(2)),
    }))
  }, [currSales, products])

  // Métodos de pago
  const payMethods = useMemo(() => {
    const map = {}
    currSales.forEach(s => s.payments?.forEach(p => {
      map[p.method] = parseFloat(((map[p.method]||0)+p.amount).toFixed(2))
    }))
    return Object.entries(map).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase()+name.slice(1), value
    }))
  }, [currSales])

  const RANGES = [
    { key:'today', label:'Hoy'    },
    { key:'week',  label:'7 días' },
    { key:'month', label:'Mes'    },
    { key:'all',   label:'Todo'   },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header + selector período */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Dashboard Ejecutivo</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">
            {currCount} ventas · {prevRange ? 'comparando con período anterior' : 'sin comparación disponible'}
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                range === r.key ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-gray-500 dark:text-slate-400'
              }`}>{r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs ejecutivos */}
      <div>
        <SectionTitle>Indicadores del período</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-3">
          <KPI label="Ventas brutas"    value={formatCurrency(currTotal)}    trend={prevRange ? pct(currTotal, prevTotal) : null}   icon="💰" color="text-blue-600 dark:text-blue-400"/>
          <KPI label="Ventas netas"     value={formatCurrency(ventasNetas)}  icon="✅" color="text-emerald-600 dark:text-emerald-400" sub={currDev > 0 ? `-${formatCurrency(currDev)} dev.` : undefined}/>
          <KPI label="Utilidad bruta"   value={formatCurrency(currUtil)}     trend={prevRange ? pct(currUtil, prevUtil) : null}      icon="📈" color="text-teal-600 dark:text-teal-400"/>
          <KPI label="Margen bruto"     value={`${margenPct}%`}              icon="🎯" color={margenPct >= 30 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}/>
          <KPI label="Ticket promedio"  value={formatCurrency(currAvg)}      trend={prevRange ? pct(currAvg, prevAvg) : null}        icon="📊"/>
        </div>
      </div>

      {/* Cuentas por cobrar — alerta crítica */}
      {totalCxC > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                📒 Cuentas por cobrar — {cxcClients.length} cliente(s) con saldo pendiente
              </p>
              <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">{formatCurrency(totalCxC)}</p>
            </div>
            <div className="space-y-1 text-xs">
              {cxcClients.slice(0,4).map(c => (
                <div key={c.id} className="flex justify-between gap-8 text-amber-700 dark:text-amber-400">
                  <span>{c.name}</span>
                  <span className="font-semibold">{formatCurrency(c.currentDebt)}</span>
                </div>
              ))}
              {cxcClients.length > 4 && <p className="text-amber-500">+{cxcClients.length - 4} más</p>}
            </div>
          </div>
        </div>
      )}

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ventas + Utilidad diaria */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300">Ventas vs Utilidad</h3>
            {prevRange && (
              <span className={`text-xs font-medium ${pct(currTotal, prevTotal) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                {pct(currTotal, prevTotal) >= 0 ? '↑' : '↓'} {Math.abs(pct(currTotal, prevTotal))}% vs período anterior
              </span>
            )}
          </div>
          {dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyChart} margin={{ top:5, right:10, left:0, bottom:5 }}>
                <defs>
                  <linearGradient id="gVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#378ADD" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#378ADD" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="gUtil" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#5DCAA5" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#5DCAA5" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="dia" tick={{ fontSize:10, fill:'#9ca3af' }}/>
                <YAxis tick={{ fontSize:10, fill:'#9ca3af' }} tickFormatter={v=>`S/${v}`} width={52}/>
                <Tooltip formatter={(v,n)=>[formatCurrency(v), n==='ventas'?'Ventas':'Utilidad']}
                  contentStyle={{ fontSize:12, borderRadius:8 }}/>
                <Area type="monotone" dataKey="ventas"   stroke="#378ADD" fill="url(#gVentas)" strokeWidth={2} name="ventas"/>
                <Area type="monotone" dataKey="utilidad" stroke="#5DCAA5" fill="url(#gUtil)"   strokeWidth={2} name="utilidad"/>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-300 dark:text-slate-600 text-sm">Sin ventas en el período</div>
          )}
        </div>

        {/* Métodos de pago */}
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Métodos de pago</h3>
          {payMethods.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={payMethods} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={3} dataKey="value">
                    {payMethods.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={v=>[formatCurrency(v)]} contentStyle={{ fontSize:12, borderRadius:8 }}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {payMethods.map((d,i) => (
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

      {/* Top productos rentables */}
      {topRentable.length > 0 && (
        <div>
          <SectionTitle>Top productos por rentabilidad</SectionTitle>
          <div className="mt-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50">
                  {['#','Producto','Ventas totales','Utilidad','Margen'].map(h => (
                    <th key={h} className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-2.5 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {topRentable.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-2.5 text-xs font-bold text-gray-400 dark:text-slate-500">#{i+1}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-800 dark:text-slate-100">{p.name}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-slate-300">{formatCurrency(p.ventas)}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(p.util)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        p.margen >= 40 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        p.margen >= 20 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      }`}>{p.margen}%</span>
                    </td>
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

// ─── COMPONENTE PRINCIPAL — enruta por rol ────────────────────────────────────
export default function Dashboard() {
  const {
    sales, products, categories, returns, clients,
    activeCashSession, currentUser, users,
  } = useStore()

  const role = currentUser?.role || 'cajero'

  // Cajero → vista de turno personal
  if (role === 'cajero') {
    return (
      <DashboardCajero
        currentUser={currentUser}
        sales={sales}
        activeCashSession={activeCashSession}
        products={products}
      />
    )
  }

  // Supervisor → vista operativa del día
  if (role === 'supervisor') {
    return (
      <DashboardSupervisor
        sales={sales}
        products={products}
        categories={categories}
        returns={returns}
        currentUser={currentUser}
        users={users}
      />
    )
  }

  // Admin / Gerente → vista ejecutiva completa
  return (
    <DashboardEjecutivo
      sales={sales}
      products={products}
      categories={categories}
      returns={returns}
      clients={clients}
    />
  )
}
