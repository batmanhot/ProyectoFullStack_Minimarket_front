/**
 * LoyaltyConsulta.jsx — Programa de Puntos v3
 * Ruta: src/features/loyalty/LoyaltyConsulta.jsx
 *
 * Rediseño completo:
 *  - Layout full-width idéntico al módulo de Caja (p-6 space-y-6, sin max-w)
 *  - Un solo buscador inteligente (DNI o nombre en el mismo campo)
 *  - KPIs en grid horizontal como Cash
 *  - Layout de 2 columnas al mostrar resultados
 *  - Tabs: Consulta / Políticas / Configuración (admin/gerente)
 */

import { useState, useMemo, useRef } from 'react'
import { useStore }                  from '../../store/index'
import { formatCurrency, formatDate, formatDateTime } from '../../shared/utils/helpers'
import {
  buildLoyaltySummary,
  getClientLevel,
  LOYALTY_LEVELS,
  LOYALTY_CONFIG_DEFAULTS,
} from '../../shared/utils/LoyaltyEngine'
import toast from 'react-hot-toast'

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function LevelBadge({ level, size = 'sm' }) {
  const cls = size === 'lg'
    ? 'px-3 py-1 text-sm font-semibold rounded-full'
    : 'px-2 py-0.5 text-xs font-semibold rounded-full'
  return <span className={`${cls} ${level.badge}`}>{level.icon} {level.name}</span>
}

function TxnBadge({ type }) {
  if (type === 'earned')   return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">+ Ganado</span>
  if (type === 'redeemed') return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Canje</span>
  if (type === 'voided')   return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Anulado</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{type}</span>
}

// ─── Panel de resultados ──────────────────────────────────────────────────────
function ClientResult({ client, config }) {
  const summary = useMemo(() => buildLoyaltySummary(client, config), [client, config])

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

      {/* COLUMNA IZQUIERDA — Tarjeta del cliente */}
      <div className="xl:col-span-1 space-y-4">

        {/* Tarjeta de nivel */}
        <div className={`rounded-2xl border p-5 ${summary.level.bg}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${summary.level.badge}`}>
              {client.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 dark:text-slate-100 truncate">{client.name}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {client.documentType} {client.documentNumber}
              </p>
            </div>
            <LevelBadge level={summary.level} size="lg"/>
          </div>

          {/* Puntos */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 text-center border border-gray-100 dark:border-slate-700">
              <p className="text-3xl font-black text-gray-900 dark:text-slate-100">{(summary.available || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Puntos disponibles</p>
              {summary.canRedeem && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                  ≈ {formatCurrency(summary.available * config.pointsValue)}
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 text-center border border-gray-100 dark:border-slate-700">
              <p className="text-3xl font-black text-gray-900 dark:text-slate-100">{(summary.accumulated || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Pts. acumulados</p>
              <p className="text-xs text-gray-300 dark:text-slate-600 mt-0.5">Determina el nivel</p>
            </div>
          </div>

          {/* Progreso al siguiente nivel */}
          {summary.nextLvl ? (
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className={`${summary.level.color} font-semibold`}>{summary.level.icon} {summary.level.name}</span>
                <span className="text-gray-400 dark:text-slate-500">
                  Faltan <strong className="text-gray-600 dark:text-slate-300">{summary.nextLvl.pointsNeeded.toLocaleString()} pts</strong>
                </span>
                <span className={`${summary.nextLvl.level.color} font-semibold`}>{summary.nextLvl.level.icon} {summary.nextLvl.level.name}</span>
              </div>
              <div className="h-2.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-2.5 rounded-full bg-amber-400 transition-all" style={{ width: `${summary.progressPct}%` }}/>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 text-right">{summary.progressPct}%</p>
            </div>
          ) : (
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
              <p className="text-sm font-bold text-purple-700 dark:text-purple-300">💎 Nivel Platino — máximo alcanzado</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-green-600 dark:text-green-400">+{summary.totalEarned.toLocaleString()}</p>
            <p className="text-xs text-green-500 dark:text-green-500">Ganados</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{summary.totalRedeemed.toLocaleString()}</p>
            <p className="text-xs text-amber-500">Canjeados</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(summary.totalSavings)}</p>
            <p className="text-xs text-blue-500">Ahorro</p>
          </div>
        </div>

        {/* Info del cliente */}
        {(client.phone || client.email) && (
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Contacto</p>
            {client.phone && <p className="text-sm text-gray-600 dark:text-slate-300">📞 {client.phone}</p>}
            {client.email && <p className="text-sm text-gray-600 dark:text-slate-300">✉️ {client.email}</p>}
          </div>
        )}
      </div>

      {/* COLUMNA DERECHA — Historial de transacciones */}
      <div className="xl:col-span-2">
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100">Historial de transacciones</h3>
            <span className="text-xs text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-700 px-3 py-1 rounded-full">
              {summary.transactions.length} movimiento(s)
            </span>
          </div>

          {summary.transactions.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3 opacity-20">📋</div>
              <p className="text-sm text-gray-400 dark:text-slate-500">Sin transacciones aún</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700/40">
                    {['Fecha', 'Tipo', 'Descripción', 'Pts', 'S/ Desc.'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {summary.transactions.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap">
                        {formatDate(t.createdAt)}<br/>
                        <span className="text-[10px]">{new Date(t.createdAt).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</span>
                      </td>
                      <td className="px-4 py-3"><TxnBadge type={t.type}/></td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-sm text-gray-700 dark:text-slate-300 truncate">{t.description}</p>
                        {t.invoiceNumber && <p className="text-xs text-gray-400 dark:text-slate-500 font-mono">{t.invoiceNumber}</p>}
                        {t.level && <p className="text-xs text-gray-400 dark:text-slate-500">{t.level} · ×{t.multiplier}</p>}
                      </td>
                      <td className="px-4 py-3 font-bold text-sm whitespace-nowrap">
                        <span className={
                          t.type==='earned'   ? 'text-green-600 dark:text-green-400' :
                          t.type==='redeemed' ? 'text-amber-600 dark:text-amber-400' :
                          'text-red-500 dark:text-red-400'
                        }>
                          {t.type==='earned' ? '+' : '-'}{Math.abs(t.points)} pts
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {t.type==='redeemed' && t.discountAmount
                          ? <span className="text-amber-600 dark:text-amber-400 font-semibold">-{formatCurrency(t.discountAmount)}</span>
                          : t.saleTotal
                            ? <span className="text-xs text-gray-400 dark:text-slate-500">{formatCurrency(t.saleTotal)}</span>
                            : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Panel de Políticas ───────────────────────────────────────────────────────
function PoliciesPanel({ config }) {
  const blocks = [
    {
      icon: '⭐', title: 'Acumulación de puntos', color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
      items: [
        `${config.pointsPerSol} punto por cada S/ ${config.solsPerPoint} en el total de la compra`,
        'Solo en ventas completadas y confirmadas',
        'Calculado sobre el total ya pagado (incluye descuentos)',
        'Los puntos se acreditan al instante al confirmar la venta',
        'Redondeo hacia abajo — la fracción no genera puntos',
      ],
    },
    {
      icon: '🏆', title: 'Niveles y multiplicadores', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      items: LOYALTY_LEVELS.map(l =>
        l.max===Infinity
          ? `${l.icon} ${l.name}: ${l.min.toLocaleString()}+ pts → ×${l.multiplier} (${l.multiplierLabel})`
          : `${l.icon} ${l.name}: ${l.min.toLocaleString()}–${l.max.toLocaleString()} pts → ×${l.multiplier} (${l.multiplierLabel})`
      ),
    },
    {
      icon: '🎁', title: 'Canje de puntos', color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      items: [
        `Mínimo ${config.minRedeemPoints} puntos para canjear`,
        `S/ ${config.pointsValue} por punto (${config.minRedeemPoints} pts = S/ ${(config.minRedeemPoints*config.pointsValue).toFixed(2)})`,
        `Máximo ${config.maxRedeemPct || 50}% del total de la venta con puntos`,
        'Los puntos canjeados NO generan nuevos puntos en esa venta',
        'El nivel no baja al canjear (se basa en puntos acumulados históricos)',
      ],
    },
    {
      icon: '⏰', title: 'Vencimiento', color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      items: [
        `Los puntos vencen a los ${config.expiryDays} días desde la compra que los generó`,
        'Vencimiento por transacción individual, no de forma global',
        'Los puntos vencidos no se recuperan bajo ninguna circunstancia',
      ],
    },
    {
      icon: '↩️', title: 'Devoluciones', color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
      items: [
        'Si se devuelve una compra, los puntos de esa venta se anulan automáticamente',
        'Si los puntos ya fueron canjeados, se genera deuda que compensa la siguiente acumulación',
      ],
    },
    {
      icon: '🪪', title: 'Identificación del cliente', color: 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-600',
      items: [
        'El cliente DEBE estar identificado para acumular puntos',
        'Búsqueda por DNI, RUC, CE o nombre en el POS',
        'Sin documento registrado, no se acumulan puntos',
      ],
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {blocks.map(b => (
        <div key={b.title} className={`rounded-2xl border p-5 ${b.color}`}>
          <h3 className="font-semibold text-gray-800 dark:text-slate-100 flex items-center gap-2 mb-3">
            <span className="text-xl">{b.icon}</span>{b.title}
          </h3>
          <ul className="space-y-2">
            {b.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-slate-300">
                <span className="text-gray-400 mt-0.5 shrink-0">•</span>{item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ─── Panel de Configuración ───────────────────────────────────────────────────
function ConfigPanel({ config, onSave }) {
  const [form, setForm] = useState({ ...config })
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const fields = [
    { k:'programName',       label:'Nombre del programa',           type:'text',   desc:'Visible en el POS y en tickets' },
    { k:'programDescription',label:'Descripción corta',             type:'text',   desc:'Subtítulo del programa' },
    { k:'solsPerPoint',      label:'Soles por punto (base)',         type:'number', desc:'Cada S/X = 1 punto. Default: 10' },
    { k:'pointsValue',       label:'Valor de canje (S/ por punto)', type:'number', desc:'Cuánto vale 1 punto. Default: 0.10', step:0.01 },
    { k:'minRedeemPoints',   label:'Mínimo para canjear (pts)',      type:'number', desc:'Default: 50' },
    { k:'maxRedeemPct',      label:'Máx. cobertura por canje (%)',   type:'number', desc:'Máx % del total cubierto con pts. Default: 50' },
    { k:'expiryDays',        label:'Días de vencimiento',            type:'number', desc:'Default: 365' },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 dark:text-slate-100">Parámetros del programa</h3>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm text-amber-700 dark:text-amber-300">
          ⚠️ Los cambios afectan cálculos futuros. Los puntos acumulados no se recalculan retroactivamente.
        </div>
        {fields.map(field => (
          <div key={field.k}>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">{field.label}</label>
            <input type={field.type} step={field.step||1} value={form[field.k]||''}
              onChange={e => f(field.k, field.type==='number' ? parseFloat(e.target.value) : e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-700 dark:text-slate-100"/>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{field.desc}</p>
          </div>
        ))}
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => f('enabled',!form.enabled)}
            className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${form.enabled?'bg-amber-500':'bg-gray-300 dark:bg-slate-600'}`}>
            <span className={`inline-block h-4 w-4 mt-1 rounded-full bg-white transition-transform ${form.enabled?'translate-x-6':'translate-x-1'}`}/>
          </button>
          <span className="text-sm text-gray-700 dark:text-slate-300">{form.enabled?'Programa activo':'Programa desactivado'}</span>
        </div>
        <button onClick={() => onSave(form)}
          className="w-full py-3 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors">
          Guardar configuración
        </button>
      </div>

      <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 space-y-3">
        <h4 className="font-semibold text-gray-700 dark:text-slate-300">Vista previa de la configuración actual</h4>
        <div className="space-y-3">
          {[
            { label: 'Compra S/50 — nivel Bronce', value: `${Math.floor(50/(form.solsPerPoint||10))} pts` },
            { label: 'Compra S/50 — nivel Plata ×1.2', value: `${Math.floor(Math.floor(50/(form.solsPerPoint||10))*1.2)} pts` },
            { label: 'Compra S/50 — nivel Oro ×1.5', value: `${Math.floor(Math.floor(50/(form.solsPerPoint||10))*1.5)} pts` },
            { label: 'Compra S/50 — nivel Platino ×2.0', value: `${Math.floor(Math.floor(50/(form.solsPerPoint||10))*2.0)} pts` },
            { label: `${form.minRedeemPoints} pts canjeados`, value: `S/ ${((form.minRedeemPoints||0)*(form.pointsValue||0)).toFixed(2)} de descuento` },
            { label: 'Vencimiento de puntos', value: `${form.expiryDays} días desde la compra` },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-slate-700 last:border-0">
              <span className="text-sm text-gray-600 dark:text-slate-400">{r.label}</span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{r.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Niveles activos</p>
          <div className="space-y-2">
            {LOYALTY_LEVELS.map(l => (
              <div key={l.name} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${l.bg}`}>
                <span className={`text-sm font-semibold ${l.color}`}>{l.icon} {l.name}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  {l.max===Infinity ? `${l.min.toLocaleString()}+ pts` : `${l.min.toLocaleString()}–${l.max.toLocaleString()} pts`}
                </span>
                <span className={`text-xs font-bold ${l.color}`}>×{l.multiplier}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function LoyaltyConsulta() {
  const { clients, systemConfig, updateSystemConfig, addAuditLog, currentUser } = useStore()

  const config = useMemo(() => ({
    ...LOYALTY_CONFIG_DEFAULTS,
    ...(systemConfig?.loyaltyConfig || {}),
  }), [systemConfig])

  const [activeTab,      setActiveTab]  = useState('consulta')
  const [query,          setQuery]      = useState('')
  const [selectedClient, setSelected]  = useState(null)
  const [showDrop,       setShowDrop]  = useState(false)
  const inputRef = useRef()

  const isAdmin = ['admin','gerente'].includes(currentUser?.role)

  // ── Un solo buscador inteligente: detecta si es doc (solo números) o nombre
  const suggestions = useMemo(() => {
    const q = query.trim()
    if (q.length < 2) return []
    const isDoc = /^\d+$/.test(q)
    return clients.filter(c =>
      isDoc
        ? c.documentNumber?.includes(q)
        : c.name?.toLowerCase().includes(q.toLowerCase()) || c.documentNumber?.includes(q)
    ).slice(0, 10)
  }, [query, clients])

  const handleSelect = (c) => {
    setSelected(c)
    setQuery(c.name)
    setShowDrop(false)
  }

  const handleSearch = () => {
    // Si hay exactamente 1 resultado, seleccionarlo automáticamente
    if (suggestions.length === 1) { handleSelect(suggestions[0]); return }
    // Buscar por documento exacto
    const exact = clients.find(c => c.documentNumber === query.trim())
    if (exact) { handleSelect(exact); return }
    setShowDrop(suggestions.length > 0)
  }

  const handleSaveConfig = (newConfig) => {
    updateSystemConfig({ loyaltyConfig: newConfig })
    addAuditLog({ action:'UPDATE', module:'Programa de Puntos', detail:`Config actualizada por ${currentUser?.fullName}` })
    toast.success('Configuración guardada')
  }

  // KPIs globales
  const kpis = useMemo(() => {
    const all      = clients.filter(c => c.isActive)
    const withPts  = all.filter(c => (c.loyaltyAccumulated||0) > 0)
    const byLevel  = LOYALTY_LEVELS.reduce((acc,l) => {
      acc[l.name] = all.filter(c => {
        const lvl = getClientLevel(c.loyaltyAccumulated||0)
        return lvl.name === l.name
      }).length
      return acc
    }, {})
    return { total: all.length, withPts: withPts.length, byLevel }
  }, [clients])

  const TABS = [
    { key:'consulta',  label:'🔍 Consulta' },
    { key:'politicas', label:'📋 Políticas' },
    ...(isAdmin ? [{ key:'config', label:'⚙️ Configuración' }] : []),
  ]

  return (
    <div className="p-6 space-y-6">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">
            {config.programName || 'Club de Puntos'}
          </h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">
            {config.programDescription || 'Consulta de puntos y gestión del programa'}
          </p>
        </div>
      </div>

      {/* ── KPIs GLOBALES (igual que Caja) ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Total clientes</p>
          <p className="text-2xl font-semibold text-gray-800 dark:text-slate-100">{kpis.total}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <p className="text-xs text-amber-600 mb-1">Con puntos</p>
          <p className="text-2xl font-semibold text-amber-700">{kpis.withPts}</p>
        </div>
        {LOYALTY_LEVELS.map(l => (
          <div key={l.name} className={`rounded-xl p-4 ${l.bg}`}>
            <p className={`text-xs mb-1 ${l.color} font-medium`}>{l.icon} {l.name}</p>
            <p className={`text-2xl font-semibold ${l.color}`}>{kpis.byLevel[l.name] || 0}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">×{l.multiplier}</p>
          </div>
        ))}
      </div>

      {/* ── TABS ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab===t.key
                ? 'bg-white dark:bg-slate-600 shadow text-amber-600 dark:text-amber-400'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ TAB CONSULTA ════════════════════════════════════════════════════ */}
      {activeTab==='consulta' && (
        <div className="space-y-6">

          {/* Buscador único inteligente */}
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5">
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
              Buscar cliente — por nombre, DNI, RUC o CE
            </p>
            <div className="relative">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => { setQuery(e.target.value); setShowDrop(true); setSelected(null) }}
                    onFocus={() => query.length >= 2 && setShowDrop(true)}
                    onBlur={() => setTimeout(() => setShowDrop(false), 200)}
                    onKeyDown={e => e.key==='Enter' && handleSearch()}
                    placeholder="Escribe nombre, DNI, RUC o CE del cliente..."
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 text-base"
                    autoFocus
                  />
                  {query && (
                    <button onClick={() => { setQuery(''); setSelected(null); inputRef.current?.focus() }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg font-bold">
                      ✕
                    </button>
                  )}

                  {/* Dropdown de resultados */}
                  {showDrop && suggestions.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl z-30 overflow-hidden max-h-80 overflow-y-auto">
                      <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 text-xs text-gray-400 dark:text-slate-500 font-medium">
                        {suggestions.length} resultado(s) — clic para seleccionar
                      </div>
                      {suggestions.map(c => {
                        const lvl = getClientLevel(c.loyaltyAccumulated || 0)
                        return (
                          <button key={c.id} onMouseDown={() => handleSelect(c)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/20 border-b border-gray-50 dark:border-slate-700/50 last:border-0 text-left transition-colors">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${lvl.badge}`}>
                              {c.name?.[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">{c.name}</p>
                              <p className="text-xs text-gray-400 dark:text-slate-500 font-mono">
                                {c.documentType} {c.documentNumber}
                                {c.phone ? ` · ${c.phone}` : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <LevelBadge level={lvl}/>
                              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                {(c.loyaltyPoints||0).toLocaleString()} pts disp.
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <button onClick={handleSearch}
                  className="px-6 py-3 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  Buscar
                </button>
              </div>
            </div>
          </div>

          {/* Resultado */}
          {selectedClient ? (
            <>
              <ClientResult client={selectedClient} config={config}/>
              <button onClick={() => { setSelected(null); setQuery(''); inputRef.current?.focus() }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 border border-gray-100 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                ← Consultar otro cliente
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl">
              <div className="text-6xl opacity-10">⭐</div>
              <div>
                <p className="text-gray-400 dark:text-slate-500 font-medium">Busca un cliente para consultar sus puntos</p>
                <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">Ingresa nombre, DNI, RUC o CE en el campo de búsqueda</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB POLÍTICAS ════════════════════════════════════════════════════ */}
      {activeTab==='politicas' && <PoliciesPanel config={config}/>}

      {/* ══ TAB CONFIGURACIÓN ════════════════════════════════════════════════ */}
      {activeTab==='config' && isAdmin && <ConfigPanel config={config} onSave={handleSaveConfig}/>}
    </div>
  )
}
