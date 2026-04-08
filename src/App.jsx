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
    <div className="flex items-center justify-center h-full min-h-64">
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
