import { lazy, Suspense, useState, useEffect  } from 'react'
import { Toaster } from 'react-hot-toast'
import { useStore } from './store/index'
import { canAccess } from './config/app'
import Sidebar from './shared/components/ui/Sidebar'
import Login from './features/auth/Login'
import toast from 'react-hot-toast'

import { useServiceWorker } from './shared/hooks/useServiceWorker.jsx'
import InstallPWA from './shared/components/InstallPWA'
import { Wifi, WifiOff } from 'lucide-react'


import Dashboard from './features/dashboard/Dashboard'
import POS       from './features/pos/POS'

const Catalog   = lazy(() => import('./features/catalog/Catalog'))
const Inventory = lazy(() => import('./features/inventory/Inventory'))
const Cash      = lazy(() => import('./features/cash/Cash'))
const Clients   = lazy(() => import('./features/clients/Clients'))
const Suppliers = lazy(() => import('./features/suppliers/Suppliers'))
const Purchases = lazy(() => import('./features/purchases/Purchases'))
const Reports   = lazy(() => import('./features/reports/Reports'))
const Users     = lazy(() => import('./features/users/Users'))
const Audit     = lazy(() => import('./features/audit/Audit'))
const Alerts    = lazy(() => import('./features/alerts/Alerts'))
const Settings  = lazy(() => import('./features/settings/Settings'))

const PAGES = {
  dashboard: Dashboard, pos: POS,
  catalog: Catalog, inventory: Inventory,
  suppliers: Suppliers, purchases: Purchases,
  cash: Cash, clients: Clients, reports: Reports,
  users: Users, audit: Audit, alerts: Alerts, settings: Settings,
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3 text-gray-300">
        <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <span className="text-sm">Cargando módulo...</span>
      </div>
    </div>
  )
}

// Componente para mostrar indicador de reconexión
function OnlineIndicator() {
  const [justReconnected, setJustReconnected] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setJustReconnected(true)
      setTimeout(() => setJustReconnected(false), 3000)
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  if (!justReconnected) return null

  return (
    <div className="fixed top-0 left-0 right-0 bg-green-500 text-white py-2 px-4 text-center text-sm font-medium z-50 animate-slide-down flex items-center justify-center gap-2">
      <Wifi className="w-4 h-4" />
      <span>Conexión restaurada - Sincronizando datos...</span>
    </div>
  )
}


export default function App() {
  // const { currentUser } = useStore()
  const currentUser = useStore((state) => state.currentUser)
  const { isOnline } = useServiceWorker()

  const [currentPage, setCurrentPage] = useState('dashboard')

  const handleNavigate = (page) => {
    if (!canAccess(currentUser?.role, page)) { toast.error('Sin permisos para esta sección'); return }
    setCurrentPage(page)
  }

  if (!currentUser) {
    return (
      <>
        {/* Indicador de conexión (solo cuando está offline) */}
          {!isOnline && (
            <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white py-2 px-4 text-center text-sm font-medium z-50 flex items-center justify-center gap-2">
              <WifiOff className="w-4 h-4" />
              <span>Modo Offline - Los cambios se sincronizarán cuando vuelvas a estar online</span>
            </div>
          )}

          {/* Indicador de reconexión (muestra brevemente cuando vuelve online) */}
          <OnlineIndicator />

          {/* Banner de instalación PWA */}
          <InstallPWA />

        <Login/>
        <Toaster position="top-right" toastOptions={{ style: { fontSize: '13px', borderRadius: '8px' } }}/>
      </>
    )
  }

  const Page = PAGES[currentPage] || PAGES.dashboard

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate}/>
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<PageFallback/>}>
          <Page/>
        </Suspense>
      </main>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '13px', borderRadius: '8px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }, success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } }, error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } } }}/>
    </div>
  )
}
