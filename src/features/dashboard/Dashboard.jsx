import { useMemo, useState } from 'react'
import { useStore } from '../../store/index'
import { calcDashboardKPIs, formatCurrency } from '../../shared/utils/helpers'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const COLORS = ['#378ADD', '#5DCAA5', '#EF9F27', '#D85A30', '#7F77DD', '#D4537E']

const KPICard = ({ label, value, sub, color = 'text-gray-800', icon, trend }) => (
  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
    <div className="flex items-start justify-between mb-1">
      <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
      {icon && <span className="text-xl opacity-50">{icon}</span>}
    </div>
    <p className={`text-2xl font-medium ${color}`}>{value}</p>
    {(sub || trend !== undefined) && (
      <div className="flex items-center gap-2 mt-1">
        {trend !== undefined && trend !== null && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs ayer
          </span>
        )}
        {sub && <p className="text-xs text-gray-400 dark:text-slate-500">{sub}</p>}
      </div>
    )}
  </div>
)

export default function Dashboard() {
  const { sales, products, stockMovements } = useStore()
  const kpis = useMemo(() => calcDashboardKPIs(sales, products, stockMovements), [sales, products, stockMovements])

  const paymentData = useMemo(() =>
    Object.entries(kpis.paymentTotals || {}).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: parseFloat(value.toFixed(2)),
    }))
  , [kpis.paymentTotals])

  const top5Data = kpis.top5.map(p => ({
    name: p.name.length > 22 ? p.name.slice(0, 20) + '…' : p.name,
    unidades: p.qty,
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Dashboard</h1>
        <p className="text-sm text-gray-400 dark:text-slate-500">
          {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPIs fila 1 — ventas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Ventas del día"      value={formatCurrency(kpis.ventasHoy)}      icon="💰" color="text-blue-600" trend={kpis.tendenciaHoy} sub={`${kpis.transaccionesHoy} transacciones`} />
        <KPICard label="Ticket promedio"     value={formatCurrency(kpis.ticketPromedio)}  icon="🧾" color="text-teal-600"  sub="por transacción" />
        <KPICard label="Ventas del mes"      value={formatCurrency(kpis.ventasMes)}       icon="📅" color="text-purple-600" sub={`Semana: ${formatCurrency(kpis.ventasSemana)}`} />
        <KPICard label="Utilidad estimada"   value={formatCurrency(kpis.utilidadMes)}     icon="📈" color="text-green-600"  sub="ventas − costo · mes" />
      </div>

      {/* KPIs fila 2 — inventario y alertas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Valor en almacén"    value={formatCurrency(kpis.valorInventarioCosto)}  icon="📦" sub="a precio de costo" />
        <KPICard label="Potencial de venta"  value={formatCurrency(kpis.valorInventarioVenta)}  icon="💹" color="text-blue-500" sub="si se vende todo" />
        <KPICard label="Alertas de stock"    value={kpis.productosAlerta}  icon={kpis.productosAlerta > 0 ? '⚠️' : '✅'} color={kpis.productosAlerta > 0 ? 'text-red-500' : 'text-green-600'} sub="bajo mínimo o sin stock" />
        <KPICard label="Próximos a vencer"   value={kpis.productosPorVencer} icon={kpis.productosPorVencer > 0 ? '🗓️' : '✅'} color={kpis.productosPorVencer > 0 ? 'text-amber-600' : 'text-green-600'} sub="en los próximos 30 días" />
      </div>

      {/* Gráficos fila 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Ventas — últimos 7 días</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={kpis.ventasUltimos7} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#378ADD" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#378ADD" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="dia"   tick={{ fontSize: 11, fill: '#9ca3af' }}/>
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `S/${v}`} width={52}/>
              <Tooltip formatter={v => [formatCurrency(v), 'Ventas']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}/>
              <Area type="monotone" dataKey="total" stroke="#378ADD" strokeWidth={2} fill="url(#colorV)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Top 5 productos más vendidos</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={top5Data} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }}/>
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} width={140}/>
              <Tooltip formatter={v => [`${v} unidades`, 'Vendidas']} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
              <Bar dataKey="unidades" fill="#5DCAA5" radius={[0, 4, 4, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráficos fila 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4 lg:col-span-2">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Ventas por hora — hoy</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={kpis.ventasPorHora} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="hora"  tick={{ fontSize: 10, fill: '#9ca3af' }}/>
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `S/${v}`} width={44}/>
              <Tooltip formatter={v => [formatCurrency(v), 'Ventas']} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
              <Bar dataKey="total" fill="#7F77DD" radius={[4, 4, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Métodos de pago</h3>
          {paymentData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" innerRadius={35} outerRadius={58} paddingAngle={3} dataKey="value">
                    {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={v => [formatCurrency(v)]} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-1">
                {paymentData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }}/>
                      <span className="text-gray-600 dark:text-slate-300">{d.name}</span>
                    </div>
                    <span className="font-medium text-gray-700">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-gray-300">
              <span className="text-3xl mb-2">📊</span>
              <span className="text-xs">Sin ventas aún</span>
            </div>
          )}
        </div>
      </div>

      {/* Alertas de stock */}
      {kpis.productosAlerta > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span>⚠️</span>
            <h3 className="text-sm font-medium text-red-700">{kpis.productosAlerta} producto(s) con stock bajo o sin stock</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {products.filter(p => p.isActive && p.stock <= p.stockMin).slice(0, 6).map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-700 truncate max-w-[60%]">{p.name}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.stock === 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                  {p.stock === 0 ? 'Sin stock' : `${p.stock} / min ${p.stockMin}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertas de vencimiento */}
      {kpis.productosPorVencer > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span>🗓️</span>
            <h3 className="text-sm font-medium text-amber-700">{kpis.productosPorVencer} producto(s) próximos a vencer</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {products.filter(p => {
              if (!p.isActive || !p.expiryDate) return false
              const days = Math.ceil((new Date(p.expiryDate) - new Date()) / 86400000)
              return days >= 0 && days <= 30
            }).slice(0, 6).map(p => {
              const days = Math.ceil((new Date(p.expiryDate) - new Date()) / 86400000)
              return (
                <div key={p.id} className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-sm">
                  <span className="text-gray-700 truncate max-w-[60%]">{p.name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${days <= 7 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                    {days === 0 ? 'Vence hoy' : `En ${days} días`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
