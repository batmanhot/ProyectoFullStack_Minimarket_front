import { lazy, Suspense, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { useStore } from './store/index'
import { canAccess } from './config/app'
import { useTheme } from './shared/hooks/useTheme'
import Sidebar from './shared/components/ui/Sidebar'
import Login from './features/auth/Login'
import toast from 'react-hot-toast'

import Dashboard  from './features/dashboard/Dashboard'
import POS        from './features/pos/POS'

const Catalog    = lazy(() => import('./features/catalog/Catalog'))
const Inventory  = lazy(() => import('./features/inventory/Inventory'))
const Cash       = lazy(() => import('./features/cash/Cash'))
const Clients    = lazy(() => import('./features/clients/Clients'))
const Suppliers  = lazy(() => import('./features/suppliers/Suppliers'))
const Purchases  = lazy(() => import('./features/purchases/Purchases'))
const Reports    = lazy(() => import('./features/reports/Reports'))
const Users      = lazy(() => import('./features/users/Users'))
const Audit      = lazy(() => import('./features/audit/Audit'))
const Alerts     = lazy(() => import('./features/alerts/Alerts'))
const Discounts  = lazy(() => import('./features/discounts/Discounts'))
const Settings   = lazy(() => import('./features/settings/Settings'))

const PAGES = {
  dashboard: Dashboard, pos: POS,
  catalog: Catalog, inventory: Inventory,
  suppliers: Suppliers, purchases: Purchases,
  cash: Cash, clients: Clients, reports: Reports,
  users: Users, audit: Audit, alerts: Alerts,
  discounts: Discounts, settings: Settings,
}

function PageFallback() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-purple-600/95 via-purple-700/95 to-indigo-800/95 px-4">
      <div className="flex flex-col items-center justify-center gap-4 text-center max-w-md mx-auto animate-fade-in">
        {/* Spinner doble anillo con glow */}
        <div className="relative flex items-center justify-center w-20 h-20">
          <div className="w-20 h-20 border-4 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
          <div className="w-20 h-20 border-4 border-purple-200/30 border-t-purple-300/70 absolute inset-0 rounded-full animate-spin" style={{ animationDuration: '1.2s', animationDirection: 'reverse' }}></div>
          <div className="absolute inset-0 w-20 h-20 bg-gradient-to-r from-purple-400/30 via-blue-400/30 to-purple-400/30 rounded-full blur-xl animate-pulse"></div>
        </div>

        {/* Texto centrado en línea independiente */}
        <p className="text-white font-semibold text-2xl leading-tight text-center">
          Cargando Sistema POS...
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const { currentUser } = useStore()
  const [currentPage, setCurrentPage] = useState('dashboard')
  const { theme, toggle, setDirect }  = useTheme()

  const handleNavigate = (page) => {
    if (!canAccess(currentUser?.role, page)) { toast.error('Sin permisos para esta sección'); return }
    setCurrentPage(page)
  }

  if (!currentUser) {
    return (
      <>
        <Login/>
        <Toaster position="top-right" toastOptions={{ style: { fontSize: '13px', borderRadius: '8px' } }}/>
      </>
    )
  }

  const Page = PAGES[currentPage] || PAGES.dashboard

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} theme={theme} onThemeToggle={toggle} onThemeSet={setDirect}/>
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <Suspense fallback={<PageFallback/>}>
          <Page/>
        </Suspense>
      </main>
      <Toaster position="top-right" toastOptions={{
        style: { fontSize: '13px', borderRadius: '8px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
        success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
        error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
      }}/>
    </div>
  )
}
