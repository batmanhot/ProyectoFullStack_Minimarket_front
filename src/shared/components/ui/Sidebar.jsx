import { useState } from 'react'
import { useStore, selectLowStockProducts, selectNearExpiryProducts, selectUnreadNotifications } from '../../../store/index'
import { ROLES, SECTORS, canAccess } from '../../../config/app'
import toast from 'react-hot-toast'

const NAV_GROUPS = [
  { label:'Principal',   items:[{ key:'dashboard',label:'Dashboard',icon:'📊'},{ key:'pos',label:'Punto de Venta',icon:'🖥️'}] },
  { label:'Operaciones', items:[{ key:'catalog',label:'Catálogo',icon:'🗂️'},{ key:'inventory',label:'Inventario',icon:'📦'},{ key:'suppliers',label:'Proveedores',icon:'🏭'},{ key:'purchases',label:'Compras',icon:'🛍️'}] },
  { label:'Comercial',   items:[{ key:'cash',label:'Caja',icon:'💰'},{ key:'clients',label:'Clientes',icon:'👥'},{ key:'reports',label:'Reportes',icon:'📈'},{ key:'discounts',label:'Descuentos',icon:'🏷️'}] },
  { label:'Sistema',     items:[{ key:'alerts',label:'Alertas',icon:'🔔'},{ key:'audit',label:'Auditoría',icon:'🔍'},{ key:'users',label:'Usuarios',icon:'⚙️'},{ key:'settings',label:'Configuración',icon:'🛠️'}] },
]

const THEME_OPTIONS = [
  { value:'light',  icon:'☀️',  label:'Claro',   desc:'Blanco & gris' },
  { value:'dark',   icon:'🌙',  label:'Oscuro',  desc:'Slate profundo' },
  { value:'ocean',  icon:'🌊',  label:'Océano',  desc:'Azul & cyan'   },
  { value:'forest', icon:'🌿',  label:'Bosque',  desc:'Verde esmeralda'},
]

export default function Sidebar({ currentPage, onNavigate, theme, onThemeToggle, onThemeSet }) {
  const { currentUser, activeCashSession, resetDemo, logout, businessConfig } = useStore()
  const lowStockCount   = useStore(s => selectLowStockProducts(s).length)
  const nearExpiryCount = useStore(s => selectNearExpiryProducts(s).length)
  const unreadCount     = useStore(selectUnreadNotifications)

  const [showReset, setShowReset]             = useState(false)
  const [selectedSector, setSelectedSector]   = useState('')
  const [collapsed, setCollapsed]             = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)

  const role = ROLES[currentUser?.role]

  const handleResetConfirm = () => {
    resetDemo(selectedSector || undefined)
    const sectorLabel = SECTORS.find(s => s.value===selectedSector)?.label || 'Bodega'
    toast.success(`Demo reseteado — ${sectorLabel}`, { duration: 3000, icon: '🔄' })
    onNavigate('dashboard')
    setShowReset(false); setSelectedSector('')
  }

  const getBadge = (key) => {
    if (key==='inventory') {
      const t = lowStockCount + nearExpiryCount
      return t > 0 ? { count: t, color: lowStockCount > 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600' } : null
    }
    if (key==='alerts' && unreadCount > 0) return { count: unreadCount, color: 'bg-blue-100 text-blue-700' }
    return null
  }

  const currentThemeOpt = THEME_OPTIONS.find(t => t.value === theme) || THEME_OPTIONS[0]

  if (collapsed) {
    const allItems = NAV_GROUPS.flatMap(g => g.items).filter(i => canAccess(currentUser?.role, i.key))
    return (
      <aside className="sidebar-root w-14 border-r flex flex-col h-screen sticky top-0">
        <button onClick={() => setCollapsed(false)} className="p-4 sidebar-muted border-b sidebar-border">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <nav className="flex-1 py-2 overflow-y-auto">
          {allItems.map(item => {
            const badge = getBadge(item.key)
            return (
              <button key={item.key} onClick={() => onNavigate(item.key)} title={item.label}
                className={`w-full flex items-center justify-center py-2.5 relative transition-colors ${currentPage===item.key ? 'sidebar-active-icon' : 'sidebar-muted sidebar-hover'}`}>
                <span className="text-lg leading-none">{item.icon}</span>
                {badge && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500"/>}
              </button>
            )
          })}
        </nav>
        <button onClick={onThemeToggle} title={`Tema: ${currentThemeOpt.label}`}
          className="p-3 text-center text-lg border-t sidebar-border sidebar-hover">
          {currentThemeOpt.icon}
        </button>
      </aside>
    )
  }

  return (
    <aside className="sidebar-root w-56 border-r flex flex-col h-screen sticky top-0">

      {/* ── Logo ── */}
      <div className="px-4 py-3 border-b sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="sidebar-logo-icon w-8 h-8 rounded-lg flex items-center justify-center text-white text-base flex-shrink-0">🛒</div>
          <div className="min-w-0">
            <div className="text-xs font-semibold sidebar-text-primary truncate">{businessConfig?.name || 'Mi Negocio'}</div>
            <div className="text-xs sidebar-muted">Sistema POS</div>
          </div>
        </div>
        <button onClick={() => setCollapsed(true)} className="sidebar-muted hover:sidebar-text-primary flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
        </button>
      </div>

      {/* ── Usuario ── */}
      {currentUser && (
        <div className="px-4 py-2.5 border-b sidebar-border">
          <div className="flex items-center gap-2">
            <div className="sidebar-avatar w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
              {currentUser.fullName?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium sidebar-text-primary truncate">{currentUser.fullName || currentUser.username}</div>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${role?.color || 'bg-gray-100 text-gray-600'}`}>{role?.label}</span>
            </div>
          </div>
          <div className={`mt-1.5 text-xs flex items-center gap-1.5 ${activeCashSession ? 'text-green-500' : 'text-red-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${activeCashSession ? 'bg-green-500' : 'bg-red-400'}`}/>
            {activeCashSession ? 'Caja abierta' : 'Caja cerrada'}
          </div>
        </div>
      )}

      {/* ── Nav agrupado ── */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_GROUPS.map(group => {
          const allowed = group.items.filter(i => canAccess(currentUser?.role, i.key))
          if (allowed.length===0) return null
          return (
            <div key={group.label} className="mb-1">
              <p className="px-4 py-1 text-xs font-medium sidebar-muted uppercase tracking-wide">{group.label}</p>
              {allowed.map(item => {
                const badge = getBadge(item.key)
                return (
                  <button key={item.key} onClick={() => onNavigate(item.key)}
                    style={{ width: 'calc(100% - 8px)', marginLeft: '4px' }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      currentPage===item.key
                        ? 'sidebar-nav-active font-medium'
                        : 'sidebar-text-sec sidebar-nav-hover'
                    }`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none">{item.icon}</span>
                      {item.label}
                    </div>
                    {badge && <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badge.color}`}>{badge.count}</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* ── SELECTOR DE TEMA ── */}
      <div className="px-3 py-2 border-t sidebar-border">
        <div className="relative">
          <button onClick={() => setShowThemePicker(p => !p)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium sidebar-muted sidebar-hover transition-colors">
            <span className="text-base">{currentThemeOpt.icon}</span>
            <span>Tema: <strong>{currentThemeOpt.label}</strong></span>
            <svg className={`w-3 h-3 ml-auto transition-transform ${showThemePicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          {showThemePicker && (
            <div className="absolute bottom-full left-0 right-0 mb-1 sidebar-dropdown rounded-xl shadow-xl overflow-hidden z-50 border sidebar-border">
              {THEME_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => { onThemeSet(opt.value); setShowThemePicker(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors sidebar-dropdown-item ${
                    theme===opt.value ? 'sidebar-dropdown-active' : ''
                  }`}>
                  <span className="text-xl">{opt.icon}</span>
                  <div className="text-left">
                    <div className="font-medium leading-tight">{opt.label}</div>
                    <div className="text-xs opacity-60">{opt.desc}</div>
                  </div>
                  {theme===opt.value && <span className="ml-auto text-xs font-bold opacity-70">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Acciones ── */}
      <div className="px-2 py-2 border-t sidebar-border space-y-0.5">
        <button onClick={() => setShowReset(true)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 font-medium transition-colors">
          <span>🔄</span> Resetear demo
        </button>
        <button onClick={() => { logout(); toast('Sesión cerrada', { icon: '👋' }) }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sidebar-muted sidebar-hover transition-colors">
          <span>🚪</span> Cerrar sesión
        </button>
      </div>

      {/* ── Modal reset ── */}
      {showReset && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Resetear demo</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona el rubro para cargar datos de ejemplo del sector:</p>
            <select value={selectedSector} onChange={e => setSelectedSector(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100">
              <option value="">Bodega / Abarrotes (por defecto)</option>
              {SECTORS.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => { setShowReset(false); setSelectedSector('') }}
                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancelar
              </button>
              <button onClick={handleResetConfirm} className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">
                Resetear
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
