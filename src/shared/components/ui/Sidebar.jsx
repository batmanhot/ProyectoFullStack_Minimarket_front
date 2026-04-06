import { useState } from 'react'
import { useStore, selectLowStockProducts, selectNearExpiryProducts } from '../../../store/index'
import { ROLES, SECTORS, canAccess } from '../../../config/app'
import ConfirmModal from './ConfirmModal'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { key: 'dashboard',  label: 'Dashboard',          icon: '📊' },
  { key: 'pos',        label: 'Punto de Venta',      icon: '🖥️' },
  { key: 'inventory',  label: 'Inventario',          icon: '📦' },
  { key: 'suppliers',  label: 'Proveedores',         icon: '🏭' },
  { key: 'purchases',  label: 'Compras',             icon: '🛍️' },
  { key: 'cash',       label: 'Caja',                icon: '💰' },
  { key: 'clients',    label: 'Clientes',            icon: '👥' },
  { key: 'reports',    label: 'Reportes',            icon: '📈' },
  { key: 'users',      label: 'Usuarios',            icon: '⚙️' },
]

export default function Sidebar({ currentPage, onNavigate }) {
  const { currentUser, activeCashSession, resetDemo, logout, businessConfig } = useStore()
  const lowStockCount   = useStore(s => selectLowStockProducts(s).length)
  const nearExpiryCount = useStore(s => selectNearExpiryProducts(s).length)

  const [showReset, setShowReset]       = useState(false)
  const [selectedSector, setSelectedSector] = useState('')
  const [collapsed, setCollapsed]       = useState(false)

  const allowedItems = NAV_ITEMS.filter(item => canAccess(currentUser?.role, item.key))

  const handleResetConfirm = () => {
    resetDemo(selectedSector || undefined)
    toast.success(`Demo reseteado${selectedSector ? ` — rubro: ${SECTORS.find(s=>s.value===selectedSector)?.label}` : ''}`, { duration: 3000, icon: '🔄' })
    onNavigate('dashboard')
    setShowReset(false)
    setSelectedSector('')
  }

  const handleLogout = () => {
    logout()
    toast('Sesión cerrada', { icon: '👋' })
  }

  const role = ROLES[currentUser?.role]

  if (collapsed) {
    return (
      <aside className="w-14 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
        <button onClick={() => setCollapsed(false)} className="p-4 text-gray-400 hover:text-gray-600 border-b border-gray-100">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <nav className="flex-1 py-3 space-y-1 overflow-y-auto">
          {allowedItems.map(item => (
            <button key={item.key} onClick={() => onNavigate(item.key)} title={item.label}
              className={`w-full flex items-center justify-center py-2.5 transition-colors relative ${currentPage === item.key ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <span className="text-lg leading-none">{item.icon}</span>
              {item.key === 'inventory' && (lowStockCount + nearExpiryCount) > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"/>
              )}
            </button>
          ))}
        </nav>
      </aside>
    )
  }

  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">

      {/* Logo + colapso */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-base flex-shrink-0">🛒</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-800 truncate">{businessConfig?.name || 'Mi Negocio'}</div>
            <div className="text-xs text-gray-400">Sistema POS</div>
          </div>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-gray-300 hover:text-gray-500 flex-shrink-0 ml-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
        </button>
      </div>

      {/* Usuario */}
      {currentUser && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
              {currentUser.fullName?.[0] || currentUser.username?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-700 truncate">{currentUser.fullName || currentUser.username}</div>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${role?.color || 'bg-gray-100 text-gray-600'}`}>{role?.label || currentUser.role}</span>
            </div>
          </div>
          <div className={`mt-2 text-xs flex items-center gap-1.5 ${activeCashSession ? 'text-green-600' : 'text-red-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${activeCashSession ? 'bg-green-500' : 'bg-red-400'}`}/>
            {activeCashSession ? 'Caja abierta' : 'Caja cerrada'}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {allowedItems.map(item => (
          <button key={item.key} onClick={() => onNavigate(item.key)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${currentPage === item.key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}`}>
            <div className="flex items-center gap-2.5">
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </div>
            {/* Badges de alerta */}
            {item.key === 'inventory' && lowStockCount > 0 && (
              <span className="text-xs bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{lowStockCount}</span>
            )}
            {item.key === 'inventory' && nearExpiryCount > 0 && lowStockCount === 0 && (
              <span className="text-xs bg-amber-100 text-amber-600 font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{nearExpiryCount}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Acciones */}
      <div className="px-2 py-3 border-t border-gray-100 space-y-1">
        <button onClick={() => setShowReset(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-amber-600 hover:bg-amber-50 transition-colors font-medium">
          <span>🔄</span> Resetear demo
        </button>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-50 transition-colors">
          <span>🚪</span> Cerrar sesión
        </button>
      </div>

      {/* Modal reset con selector de rubro */}
      {showReset && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-800">Resetear demo</h3>
            <p className="text-sm text-gray-500">Selecciona el rubro para cargar los datos de ejemplo correspondientes:</p>
            <select value={selectedSector} onChange={e => setSelectedSector(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Bodega / Abarrotes (por defecto)</option>
              {SECTORS.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => { setShowReset(false); setSelectedSector('') }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={handleResetConfirm}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">Resetear</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
