import { useState, useEffect } from 'react'
import { useStore, selectLowStockProducts, selectNearExpiryProducts, selectUnreadNotifications } from '../../../store/index'
import { ROLES, canAccess } from '../../../config/app'
import { canUsePlan, PLANS } from '../../../config/plans'
import { useTenantSafe } from '../../../context/TenantContext'
import { getStoredAlertThresholds } from '../../../services/tenantService'
import toast from 'react-hot-toast'

// ── Helpers de alerta de vencimiento ─────────────────────────────────────────
const ALERT_CFG = {
  warning:  { bg: '#fef9c3', border: '#fde047', text: '#854d0e', icon: '⏳', verb: 'Vence en' },
  urgent:   { bg: '#fff7ed', border: '#fb923c', text: '#9a3412', icon: '⚠️', verb: 'Vence en' },
  critical: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', icon: '🚨', verb: 'Último día' },
}

function getAlertLevel(daysLeft, thresholds) {
  if (daysLeft === null || daysLeft === undefined || daysLeft < 0) return null
  if (daysLeft <= thresholds.critical) return 'critical'
  if (daysLeft <= thresholds.urgent)   return 'urgent'
  if (daysLeft <= thresholds.warning)  return 'warning'
  return null
}

const NAV_GROUPS = [
  { label:'Principal',   items:[
    { key:'dashboard',  label:'Dashboard',           icon:'📊' },
    { key:'pos',        label:'Punto de Venta',      icon:'🖥️' },
    { key:'customer-display', label:'Pantalla Cliente', icon:'📺', isExternal: true },
  ]},
  { label:'Operaciones', items:[
    { key:'catalog',    label:'Catálogo',             icon:'🗂️' },
    { key:'inventory',  label:'Inventario',           icon:'📦' },
    { key:'merma',         label:'Merma',                icon:'⚠️' },
    { key:'trazabilidad',  label:'Trazabilidad',         icon:'🧬' },
    { key:'suppliers',     label:'Proveedores',          icon:'🏭' },
    { key:'purchases',  label:'Compras',              icon:'🛍️' },
  ]},
  { label:'Comercial',   items:[
    { key:'cash',       label:'Caja',                 icon:'💰' },
    { key:'clients',    label:'Clientes',             icon:'👥' },
    { key:'quotations', label:'Cotizaciones',         icon:'📋' },
    { key:'reports',    label:'Reportes',             icon:'📈' },
    { key:'discounts',  label:'Gestion Descuentos',  icon:'🏷️' },
    { key:'tickets',    label:'Descuentos por Vales', icon:'🎟️' },
    { key:'returns',       label:'Devoluciones',          icon:'↩️' },
    { key:'comprobantes',  label:'Comprobantes SUNAT',    icon:'🧾' },
  ]},
  { label:'Sistema',     items:[
    { key:'alerts',     label:'Alertas',              icon:'🔔' },
    { key:'loyalty',    label:'Programa de Puntos',   icon:'⭐' },
    { key:'audit',      label:'Auditoría',            icon:'🔍' },
    { key:'users',      label:'Usuarios',             icon:'⚙️' },
    { key:'settings',   label:'Configuración',        icon:'🛠️' },
    { key:'sync',       label:'Sincronización',       icon:'🔄', isPanel: true },
    { key:'about',      label:'Acerca del Sistema',   icon:'ℹ️' },
  ]},
]

const THEME_OPTIONS = [
  { value:'light',    icon:'☀️',  label:'Claro',      desc:'Blanco & gris neutro'    },
  { value:'dark',     icon:'🌙',  label:'Oscuro',     desc:'Slate profundo'           },
  { value:'ocean',    icon:'🌊',  label:'Océano',     desc:'Azul marino & cyan'       },
  { value:'forest',   icon:'🌿',  label:'Bosque',     desc:'Verde esmeralda'          },
  { value:'sunset',   icon:'🌅',  label:'Atardecer',  desc:'Naranja & violeta cálido' },
  { value:'midnight', icon:'🌃',  label:'Medianoche', desc:'Negro profundo & índigo'  },
  { value:'nature',   icon:'🍃',  label:'Naturaleza', desc:'Tierra & ámbar orgánico'  },
]

export default function Sidebar({ currentPage, onNavigate, theme, onThemeToggle, onThemeSet, onOpenSyncPanel }) {
  const { currentUser, activeCashSession, logout, businessConfig } = useStore()
  const lowStockCount   = useStore(s => selectLowStockProducts(s).length)
  const nearExpiryCount = useStore(s => selectNearExpiryProducts(s).length)
  const unreadCount     = useStore(selectUnreadNotifications)
  const pendingSync     = useStore(s => (s.offlineQueue || []).filter(op => op.status === 'pending' || op.status === 'syncing').length)
  const conflictSync    = useStore(s => (s.offlineQueue || []).filter(op => op.status === 'conflict' || op.status === 'error').length)

  const [collapsed, setCollapsed]       = useState(() => window.innerWidth < 768)
  const [isMobile, setIsMobile]         = useState(() => window.innerWidth < 768)
  const [showThemePicker, setShowThemePicker] = useState(false)

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setCollapsed(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleNavigate = (key) => {
    onNavigate(key)
    if (isMobile) setCollapsed(true)
  }

  const role       = ROLES[currentUser?.role]
  const tenantCtx  = useTenantSafe()
  const plan       = tenantCtx?.plan ?? 'trial'
  const planCfg    = PLANS[plan]
  const planLabel  = planCfg?.label ?? 'Trial'
  const daysLeft   = tenantCtx?.daysLeft ?? null
  const alertThresholds = getStoredAlertThresholds()
  const alertLevel = getAlertLevel(daysLeft, alertThresholds)

  // Devuelve true si el módulo está incluido en el plan activo
  const isPlanAllowed = (key) => canUsePlan(plan, key)

  const getBadge = (key) => {
    if (key === 'inventory') {
      const t = lowStockCount + nearExpiryCount
      return t > 0 ? { count: t, color: lowStockCount > 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600' } : null
    }
    if (key === 'alerts' && unreadCount > 0) return { count: unreadCount, color: 'bg-blue-100 text-blue-700' }
    if (key === 'sync') {
      if (conflictSync > 0) return { count: conflictSync, color: 'bg-red-100 text-red-600', pulse: false }
      if (pendingSync > 0)  return { count: pendingSync,  color: 'bg-amber-100 text-amber-700', pulse: true }
    }
    return null
  }

  const currentThemeOpt = THEME_OPTIONS.find(t => t.value === theme) || THEME_OPTIONS[0]

  if (collapsed) {
    const allItems = NAV_GROUPS.flatMap(g => g.items).filter(i => i.isPanel || i.isExternal || canAccess(currentUser?.role, i.key))
    return (
      <aside className="w-14 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col h-screen sticky top-0">
        <button onClick={() => setCollapsed(false)} className="p-4 text-gray-400 hover:text-gray-600 border-b border-gray-100 dark:border-gray-800">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <nav className="flex-1 py-2 overflow-y-auto sidebar-nav-scroll">
          {allItems.map(item => {
            const badge    = getBadge(item.key)
            const isActive = !item.isPanel && !item.isExternal && currentPage === item.key
            const handleCollapsedClick = () => {
              if (item.isPanel) { onOpenSyncPanel?.(); return }
              if (item.isExternal) {
                const slug = tenantCtx?.tenantSlug ?? 'demo'
                window.open(`${window.location.origin}/app/${slug}/${item.key}`, `pos_${item.key}`, 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no,resizable=yes')
                return
              }
              handleNavigate(item.key)
            }
            return (
              <button key={item.key}
                onClick={handleCollapsedClick}
                title={item.isExternal ? `${item.label} (nueva ventana)` : item.label}
                className={`w-full flex items-center justify-center py-2.5 relative ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
                <span className="text-lg leading-none">{item.icon}</span>
                {badge && (
                  <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${badge.color?.includes('red') ? 'bg-red-500' : 'bg-amber-400'} ${badge.pulse ? 'animate-pulse' : ''}`}/>
                )}
              </button>
            )
          })}
        </nav>
        {/* Indicador de vencimiento en modo colapsado */}
        {alertLevel && (
          <div title={daysLeft === 0 ? 'Vence hoy' : `Vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}`}
            style={{ margin: '4px auto 2px', width: '28px', height: '28px', borderRadius: '8px', background: ALERT_CFG[alertLevel].bg, border: `1px solid ${ALERT_CFG[alertLevel].border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', cursor: 'default' }}>
            {ALERT_CFG[alertLevel].icon}
          </div>
        )}
        {/* Badge de sincronización offline en modo colapsado — clic abre el panel */}
        {(pendingSync > 0 || conflictSync > 0) && (
          <button onClick={onOpenSyncPanel}
            title={conflictSync > 0 ? `${conflictSync} conflicto(s) — ver cola` : `${pendingSync} pendiente(s) de sync — ver cola`}
            className={`mx-auto mb-1 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${conflictSync > 0 ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-amber-100 text-amber-700 animate-pulse hover:bg-amber-200'}`}>
            {conflictSync > 0 ? '⚠' : `↑${pendingSync}`}
          </button>
        )}
        {/* Theme toggle en modo colapsado */}
        <button onClick={onThemeToggle} title={`Tema: ${currentThemeOpt.label}`}
          className="p-3 text-center text-lg border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
          {currentThemeOpt.icon}
        </button>
      </aside>
    )
  }

  const asideContent = (
    <aside className={`w-56 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col h-screen ${isMobile ? 'fixed left-0 top-0 z-50' : 'sticky top-0'}`}>

      {/* Logo */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-base flex-shrink-0">🛒</div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{businessConfig?.name || 'Mi Negocio'}</div>
            <div className="text-xs text-gray-400">Sistema POS</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Badge de cola offline — clic abre el panel */}
          {conflictSync > 0 && (
            <button onClick={onOpenSyncPanel}
              title={`${conflictSync} conflicto(s) — clic para ver detalles`}
              className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-bold hover:bg-red-200 transition-colors">
              ⚠{conflictSync}
            </button>
          )}
          {pendingSync > 0 && conflictSync === 0 && (
            <button onClick={onOpenSyncPanel}
              title={`${pendingSync} pendiente(s) — clic para ver detalles`}
              className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold animate-pulse hover:bg-amber-200 transition-colors">
              ↑{pendingSync}
            </button>
          )}
          <button onClick={() => setCollapsed(true)} className="text-gray-300 hover:text-gray-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
          </button>
        </div>
      </div>

      {/* Usuario */}
      {currentUser && (
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300 flex-shrink-0">
              {currentUser.fullName?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{currentUser.fullName || currentUser.username}</div>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${role?.color || 'bg-gray-100 text-gray-600'}`}>{role?.label}</span>
            </div>
          </div>
          <div className={`mt-1.5 text-xs flex items-center gap-1.5 ${activeCashSession?'text-green-600':'text-red-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${activeCashSession?'bg-green-500':'bg-red-400'}`}/>
            {activeCashSession ? 'Caja abierta' : 'Caja cerrada'}
          </div>
        </div>
      )}

      {/* Nav agrupado */}
      <nav className="flex-1 overflow-y-auto py-2 sidebar-nav-scroll" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}>
        {NAV_GROUPS.map(group => {
          // Ítems visibles: rol lo permite, o es panel/externo (siempre visibles para el usuario logueado)
          const visible = group.items.filter(i => i.isPanel || i.isExternal || canAccess(currentUser?.role, i.key))
          if (visible.length === 0) return null
          return (
            <div key={group.label} className="mb-1">
              <p className="px-4 py-1 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">{group.label}</p>
              {visible.map(item => {
                const badge      = getBadge(item.key)
                const planOk     = item.isPanel || item.isExternal || isPlanAllowed(item.key)
                const isActive   = !item.isPanel && !item.isExternal && currentPage === item.key

                if (!planOk) return null

                const handleClick = () => {
                  if (item.isPanel) { onOpenSyncPanel?.(); return }
                  if (item.isExternal) {
                    const slug = tenantCtx?.tenantSlug ?? 'demo'
                    window.open(`${window.location.origin}/app/${slug}/${item.key}`, `pos_${item.key}`, 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no,resizable=yes')
                    return
                  }
                  handleNavigate(item.key)
                }

                return (
                  <button key={item.key}
                    onClick={handleClick}
                    style={{ width: 'calc(100% - 8px)', marginLeft: '4px' }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none">{item.icon}</span>
                      {item.label}
                    </div>
                    {item.isExternal
                      ? <span className="text-gray-300 dark:text-gray-600" title="Se abre en nueva ventana">↗</span>
                      : badge && <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badge.color} ${badge.pulse ? 'animate-pulse' : ''}`}>{badge.count}</span>
                    }
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* ── SELECTOR DE TEMA ─────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800">
        <div className="relative">
          <button onClick={() => setShowThemePicker(p => !p)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <span className="text-base">{currentThemeOpt.icon}</span>
            <span>Tema: {currentThemeOpt.label}</span>
            <svg className="w-3 h-3 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
          </button>

          {showThemePicker && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-50">
              {THEME_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => { onThemeSet(opt.value); setShowThemePicker(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${theme===opt.value ? 'text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/30' : 'text-gray-700 dark:text-gray-300'}`}>
                  <span className="text-lg">{opt.icon}</span>
                  <span>{opt.label}</span>
                  {theme===opt.value && <span className="ml-auto text-blue-500">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Tira de alerta de vencimiento (solo cuando aplica) ─────────────── */}
      {alertLevel && (() => {
        const cfg = ALERT_CFG[alertLevel]
        return (
          <div style={{ margin: '0 8px 6px', borderRadius: '10px', background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span style={{ fontSize: '13px' }}>{cfg.icon}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.text }}>
                {daysLeft === 0 ? 'Vence hoy' : daysLeft === 1 ? cfg.verb + ' 1 día' : `${cfg.verb} ${daysLeft} días`}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: cfg.text, opacity: 0.75, lineHeight: 1.4 }}>
              Plan <strong>{planLabel}</strong> — renueva para continuar
            </div>
          </div>
        )
      })()}

      {/* Acciones */}
      <div className="px-2 py-2 border-t border-gray-100 dark:border-gray-800">
        <button onClick={() => { logout(); toast('Sesión cerrada', { icon: '👋' }) }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800">
          <span>🚪</span> Cerrar sesión
        </button>
      </div>
    </aside>
  )

  if (isMobile) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setCollapsed(true)}
        />
        {asideContent}
      </>
    )
  }
  return asideContent
}
