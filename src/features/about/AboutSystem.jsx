import { useTenantSafe } from '../../context/TenantContext'
import { useStore }       from '../../store/index'
import { PLANS, PLAN_ORDER } from '../../config/plans'
import { ROLES }          from '../../config/app'

// ── Datos descriptivos del sistema ────────────────────────────────────────────
const BENEFITS = [
  { icon: '🖥️', title: 'Punto de Venta ágil',       desc: 'Cobra en segundos con Yape, Plin, tarjeta, efectivo o crédito. Compatible con lector de código de barras.' },
  { icon: '📦', title: 'Control de inventario',      desc: 'Stock en tiempo real, alertas de quiebre, vencimientos y trazabilidad completa de cada movimiento.' },
  { icon: '👥', title: 'Gestión de clientes',        desc: 'Registro de deudas, cobranza integrada, historial de compras y programa de puntos de fidelidad.' },
  { icon: '📊', title: 'Reportes y KPIs',            desc: 'Dashboard con métricas del día, semana y mes. Exportación a Excel para contabilidad y análisis.' },
  { icon: '🏭', title: 'Compras y proveedores',      desc: 'Registro de órdenes de compra, entradas de mercadería y control de costos por proveedor.' },
  { icon: '🏷️', title: 'Descuentos y promociones',  desc: 'Campañas por categoría o producto, vales de descuento, devoluciones y notas de crédito.' },
  { icon: '🔍', title: 'Auditoría y trazabilidad',   desc: 'Registro de todas las operaciones con usuario, fecha y detalle. Ideal para cumplimiento y control interno.' },
  { icon: '🔔', title: 'Alertas inteligentes',       desc: 'Notificaciones automáticas de stock bajo, productos por vencer y sesiones de caja sin cerrar.' },
]

const PLAN_COLORS = {
  trial:      { bg: '#f8fafc', border: '#e2e8f0', header: '#64748b', badge: null },
  basic:      { bg: '#eff6ff', border: '#bfdbfe', header: '#1d4ed8', badge: null },
  pro:        { bg: '#f5f3ff', border: '#ddd6fe', header: '#6d28d9', badge: 'Más popular' },
  enterprise: { bg: '#fdf4ff', border: '#e9d5ff', header: '#7e22ce', badge: null },
}

const PLAN_ICONS = { trial: '🆓', basic: '⭐', pro: '🚀', enterprise: '🏢' }

const ROLE_INFO = [
  {
    role: 'admin', icon: '🛡️', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe',
    title: 'Administrador',
    desc: 'Acceso total al sistema. Configura el negocio, gestiona usuarios, revisa auditoría y controla todas las operaciones.',
    caps: ['Todos los módulos', 'Gestión de usuarios', 'Configuración del sistema', 'Auditoría completa'],
  },
  {
    role: 'gerente', icon: '👔', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',
    title: 'Gerente',
    desc: 'Visión gerencial del negocio. Accede a reportes, compras, proveedores y descuentos sin poder modificar configuración ni usuarios.',
    caps: ['Dashboard y reportes', 'Catálogo e inventario', 'Compras y proveedores', 'Descuentos y fidelidad'],
  },
  {
    role: 'supervisor', icon: '👁️', color: '#d97706', bg: '#fffbeb', border: '#fde68a',
    title: 'Supervisor',
    desc: 'Control operativo del día a día. Supervisa caja, stock, descuentos y devoluciones sin acceso a compras ni configuración.',
    caps: ['POS y caja', 'Catálogo e inventario', 'Clientes y descuentos', 'Devoluciones'],
  },
  {
    role: 'cajero', icon: '🖥️', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0',
    title: 'Cajero',
    desc: 'Enfocado en la venta. Accede solo a lo necesario: POS, caja, devoluciones y cotizaciones.',
    caps: ['Punto de Venta', 'Apertura y cierre de caja', 'Devoluciones', 'Cotizaciones'],
  },
]

// ── Módulos por plan (para la tabla comparativa) ──────────────────────────────
const MODULE_GROUPS = [
  { group: 'Operaciones básicas', modules: [
    { key: 'pos',        label: 'Punto de Venta' },
    { key: 'catalog',    label: 'Catálogo de productos' },
    { key: 'inventory',  label: 'Inventario y stock' },
    { key: 'cash',       label: 'Caja y arqueo' },
    { key: 'clients',    label: 'Clientes' },
    { key: 'reports',    label: 'Reportes y KPIs' },
  ]},
  { group: 'Gestión avanzada', modules: [
    { key: 'suppliers',  label: 'Proveedores' },
    { key: 'purchases',  label: 'Compras' },
    { key: 'returns',    label: 'Devoluciones' },
    { key: 'quotations', label: 'Cotizaciones / Preventa' },
  ]},
  { group: 'Comercial y fidelización', modules: [
    { key: 'discounts',  label: 'Campañas de descuento' },
    { key: 'tickets',    label: 'Vales de descuento' },
    { key: 'loyalty',    label: 'Programa de Puntos' },
    { key: 'merma',      label: 'Registro de merma' },
  ]},
  { group: 'Control y auditoría', modules: [
    { key: 'trazabilidad', label: 'Trazabilidad completa' },
    { key: 'audit',      label: 'Auditoría de acciones' },
    { key: 'alerts',     label: 'Alertas inteligentes' },
  ]},
]

export default function AboutSystem() {
  const tenantCtx   = useTenantSafe()
  const { currentUser } = useStore()
  const plan        = tenantCtx?.plan ?? 'trial'
  const planCfg     = PLANS[plan]
  const userRole    = currentUser?.role ?? 'cajero'
  const availRoles  = planCfg?.availableRoles ?? ['admin']

  const planHas = (planId, key) => {
    const f = PLANS[planId]?.features
    return f === 'all' || (Array.isArray(f) && f.includes(key))
  }

  return (
    <div className="p-6 space-y-8">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #4f46e5 50%, #7c3aed 100%)' }}>
        <div className="px-8 py-10 flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 text-white">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <span className="text-xs font-semibold tracking-wider uppercase text-white/80">Sistema POS · Retail Minorista</span>
            </div>
            <h1 className="text-3xl font-extrabold mb-2 leading-tight">MiniMarket POS</h1>
            <p className="text-white/80 text-sm leading-relaxed max-w-md">
              Solución integral de punto de venta diseñada para microempresas y negocios minoristas del Perú.
              Control total de ventas, inventario, clientes y finanzas en una sola plataforma.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Bodega','Ferretería','Farmacia','Boutique','Panadería','Electrónica'].map(s => (
                <span key={s} className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/75 font-medium">{s}</span>
              ))}
              <span className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/75 font-medium">+6 más</span>
            </div>
          </div>
          <div className="flex-shrink-0 text-center">
            <div className="w-24 h-24 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-5xl mx-auto mb-3">🛒</div>
            <div className="text-white/60 text-xs">
              Plan activo<br/>
              <span className="text-white font-bold text-sm">{planCfg?.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── BENEFICIOS ──────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-bold text-gray-800 dark:text-slate-100 mb-1">¿Qué incluye el sistema?</h2>
        <p className="text-sm text-gray-400 dark:text-slate-500 mb-4">Módulos diseñados para cubrir cada aspecto de tu negocio</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
          {BENEFITS.map(b => (
            <div key={b.title} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4 hover:shadow-sm transition-shadow">
              <span className="text-2xl mb-2 block">{b.icon}</span>
              <p className="text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">{b.title}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── PERFILES / ROLES ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-bold text-gray-800 dark:text-slate-100 mb-1">Perfiles de usuario</h2>
        <p className="text-sm text-gray-400 dark:text-slate-500 mb-4">
          Tu plan <strong className="text-gray-600 dark:text-slate-300">{planCfg?.label}</strong> incluye{' '}
          {availRoles.length === 1 ? 'el perfil' : 'los perfiles'}:{' '}
          <strong className="text-gray-600 dark:text-slate-300">{availRoles.map(r => ROLES[r]?.label).join(', ')}</strong>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {ROLE_INFO.map(r => {
            const available = availRoles.includes(r.role)
            const isCurrent = userRole === r.role
            return (
              <div key={r.role}
                style={{ background: available ? r.bg : '#f8fafc', borderColor: available ? r.border : '#e2e8f0', opacity: available ? 1 : 0.55 }}
                className="border rounded-xl p-4 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div style={{ background: available ? r.color : '#94a3b8' }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg text-white flex-shrink-0">
                    {r.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-800 dark:text-slate-100">{r.title}</span>
                      {isCurrent && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">Tu perfil</span>
                      )}
                      {!available && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-semibold">Plan superior</span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed mb-3">{r.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.caps.map(c => (
                    <span key={c} style={{ borderColor: available ? r.border : '#e2e8f0', color: available ? r.color : '#94a3b8' }}
                      className="text-xs px-2 py-0.5 rounded-full border font-medium bg-white dark:bg-slate-800">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── COMPARATIVA DE PLANES ────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-bold text-gray-800 dark:text-slate-100 mb-1">Módulos por plan</h2>
        <p className="text-sm text-gray-400 dark:text-slate-500 mb-4">Compara lo que incluye cada plan para encontrar el que mejor se adapta a tu negocio</p>

        {/* Headers de planes */}
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700">
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-semibold w-48">Módulo</th>
                {PLAN_ORDER.map(planId => {
                  const pc   = PLAN_COLORS[planId]
                  const pcfg = PLANS[planId]
                  const isActive = planId === plan
                  return (
                    <th key={planId} className="px-3 py-3 text-center"
                      style={{ background: isActive ? pc.bg : 'transparent', minWidth: '100px' }}>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-base">{PLAN_ICONS[planId]}</span>
                        <span className="font-bold" style={{ color: pc.header }}>{pcfg.label}</span>
                        {pc.badge && (
                          <span className="text-white text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: pc.header }}>
                            {pc.badge}
                          </span>
                        )}
                        {isActive && !pc.badge && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">Activo</span>
                        )}
                        <span className="font-bold text-sm text-gray-700 dark:text-slate-200">
                          {pcfg.price === 0 ? 'Gratis' : `S/ ${pcfg.price}`}
                          {pcfg.price > 0 && <span className="text-gray-400 font-normal">/mes</span>}
                        </span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {/* Límites */}
              <tr className="bg-gray-50 dark:bg-slate-800/50">
                <td className="px-4 py-2 font-semibold text-gray-600 dark:text-slate-300" colSpan={5}>Límites</td>
              </tr>
              {[
                { label: 'Productos', key: 'products', fmt: v => v === null ? 'Ilimitados' : `Hasta ${v}` },
                { label: 'Usuarios',  key: 'users',    fmt: v => v === null ? 'Ilimitados' : `Hasta ${v}` },
                { label: 'Roles disponibles', key: null },
              ].map(row => (
                <tr key={row.label} className="border-t border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-2.5 text-gray-600 dark:text-slate-400">{row.label}</td>
                  {PLAN_ORDER.map(planId => {
                    const pc  = PLAN_COLORS[planId]
                    const pcfg = PLANS[planId]
                    const isActive = planId === plan
                    let value
                    if (row.key === null) {
                      value = pcfg.availableRoles.map(r => ROLES[r]?.label).join(', ')
                    } else {
                      value = row.fmt(pcfg.limits[row.key])
                    }
                    return (
                      <td key={planId} className="px-3 py-2.5 text-center"
                        style={{ background: isActive ? pc.bg : 'transparent' }}>
                        <span className="text-gray-600 dark:text-slate-400">{value}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* Módulos por grupo */}
              {MODULE_GROUPS.map(group => (
                <>
                  <tr key={group.group} className="bg-gray-50 dark:bg-slate-800/50">
                    <td className="px-4 py-2 font-semibold text-gray-600 dark:text-slate-300" colSpan={5}>{group.group}</td>
                  </tr>
                  {group.modules.map(mod => (
                    <tr key={mod.key} className="border-t border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 text-gray-600 dark:text-slate-400">{mod.label}</td>
                      {PLAN_ORDER.map(planId => {
                        const pc = PLAN_COLORS[planId]
                        const has = planHas(planId, mod.key)
                        const isActive = planId === plan
                        return (
                          <td key={planId} className="px-3 py-2.5 text-center"
                            style={{ background: isActive ? pc.bg : 'transparent' }}>
                            {has
                              ? <span className="text-green-500 font-bold text-base">✓</span>
                              : <span className="text-gray-200 dark:text-slate-700 text-base">—</span>
                            }
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <div className="bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">¿Necesitas más funciones?</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Actualiza tu plan para desbloquear todos los módulos y roles.</p>
        </div>
        <button
          onClick={() => window.open('/#pricing', '_self')}
          className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 shrink-0">
          Ver todos los planes
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
          </svg>
        </button>
      </div>

    </div>
  )
}
