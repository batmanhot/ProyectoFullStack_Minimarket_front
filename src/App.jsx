import { lazy, Suspense, useEffect, useState, Component } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useStore } from './store/index'
import { canAccess } from './config/app'
import { canUsePlan, getMinPlanForFeature } from './config/plans'
import { useTheme } from './shared/hooks/useTheme'
import Sidebar from './shared/components/ui/Sidebar'
import PlanUpgradePrompt from './shared/components/ui/PlanUpgradePrompt'
import ExcelPreviewHost from './shared/components/ui/ExcelPreviewHost'
import PDFPreviewHost from './shared/components/ui/PDFPreviewHost'
import Login from './features/auth/Login'
import toast from 'react-hot-toast'
import { useServiceWorker } from './shared/hooks/useServiceWorker'
import InstallPWA from './shared/components/InstallPWA'
import { Wifi, WifiOff } from 'lucide-react'
import { TenantProvider, useTenantSafe } from './context/TenantContext'

// ── Rutas públicas ─────────────────────────────────────────────────────────────
const Landing    = lazy(() => import('./features/landing/Landing'))
const Register   = lazy(() => import('./features/onboarding/Register'))
const SuperAdmin = lazy(() => import('./features/superadmin/SuperAdmin'))

// ── Módulos del tenant (lazy) ──────────────────────────────────────────────────
const Dashboard       = lazy(() => import('./features/dashboard/Dashboard'))
const POS             = lazy(() => import('./features/pos/POS'))
const Catalog         = lazy(() => import('./features/catalog/Catalog'))
const Inventory       = lazy(() => import('./features/inventory/Inventory'))
const Cash            = lazy(() => import('./features/cash/Cash'))
const Clients         = lazy(() => import('./features/clients/Clients'))
const Suppliers       = lazy(() => import('./features/suppliers/Suppliers'))
const Purchases       = lazy(() => import('./features/purchases/Purchases'))
const Reports         = lazy(() => import('./features/reports/Reports'))
const Users           = lazy(() => import('./features/users/Users'))
const Audit           = lazy(() => import('./features/audit/Audit'))
const Alerts          = lazy(() => import('./features/alerts/Alerts'))
const Discounts       = lazy(() => import('./features/discounts/Discounts'))
const Tickets         = lazy(() => import('./features/tickets/Tickets'))
const Returns         = lazy(() => import('./features/returns/Returns'))
const Settings        = lazy(() => import('./features/settings/Settings'))
const LoyaltyConsulta = lazy(() => import('./features/loyalty/LoyaltyConsulta'))
const Quotations      = lazy(() => import('./features/quotations/Quotations'))
const Merma           = lazy(() => import('./features/merma/Merma'))
const Trazabilidad    = lazy(() => import('./features/trazabilidad/Trazabilidad'))
const CustomerDisplay = lazy(() => import('./features/pos/CustomerDisplay'))
const AboutSystem     = lazy(() => import('./features/about/AboutSystem'))

const PAGES = {
  dashboard: Dashboard, pos: POS,
  catalog: Catalog, inventory: Inventory,
  suppliers: Suppliers, purchases: Purchases,
  cash: Cash, clients: Clients, reports: Reports,
  users: Users, audit: Audit, alerts: Alerts,
  discounts: Discounts, tickets: Tickets, returns: Returns,
  settings: Settings, loyalty: LoyaltyConsulta, quotations: Quotations,
  merma: Merma, trazabilidad: Trazabilidad, 'customer-display': CustomerDisplay,
  about: AboutSystem,
}

// ── Spinner de carga de módulo ─────────────────────────────────────────────────
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

// ── Error boundary por módulo ──────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-64 gap-4 p-8">
          <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-2xl">⚠️</div>
          <div className="text-center">
            <p className="font-semibold text-gray-800 dark:text-slate-100 mb-1">Ocurrió un error en este módulo</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mb-4">{this.state.error?.message || 'Error inesperado'}</p>
            <button onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Reintentar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Banner de reconexión ───────────────────────────────────────────────────────
function OnlineIndicator() {
  const [justReconnected, setJustReconnected] = useState(false)
  useEffect(() => {
    const handleOnline = () => { setJustReconnected(true); setTimeout(() => setJustReconnected(false), 3000) }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])
  if (!justReconnected) return null
  return (
    <div className="fixed top-0 left-0 right-0 bg-green-500 text-white py-2 px-4 text-center text-sm font-medium z-50 flex items-center justify-center gap-2">
      <Wifi className="w-4 h-4"/>
      <span>Conexión restaurada — sincronizando datos...</span>
    </div>
  )
}

// ── TenantApp — lógica principal del negocio ───────────────────────────────────
// Contiene el sidebar, la navegación interna y todos los módulos.
// Se mantiene como state-based (sin sub-rutas de React Router) para no
// tener que migrar los 20+ módulos. React Router solo gestiona el nivel superior.
function TenantApp() {
  const { currentUser } = useStore()
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [, setPermissionVersion] = useState(0)
  const { theme, toggle, setDirect } = useTheme()
  const { isOnline } = useServiceWorker()
  const tenantCtx = useTenantSafe()
  const plan = tenantCtx?.plan ?? 'trial'

  useEffect(() => {
    const handle = () => setPermissionVersion(v => v + 1)
    window.addEventListener('role-permissions-changed', handle)
    return () => window.removeEventListener('role-permissions-changed', handle)
  }, [])

  const handleNavigate = (page) => {
    if (!canAccess(currentUser?.role, page)) { toast.error('Sin permisos para esta sección'); return }
    setCurrentPage(page)
  }

  if (!currentUser) {
    return <Login />
  }

  const Page     = PAGES[currentPage] || PAGES.dashboard
  const planOk   = canUsePlan(plan, currentPage)
  const minPlan  = planOk ? null : getMinPlanForFeature(currentPage)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white py-2 px-4 text-center text-sm font-medium z-50 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4"/>
          <span>Modo Offline — los cambios se guardarán cuando vuelvas a estar en línea</span>
        </div>
      )}
      <OnlineIndicator/>
      <InstallPWA/>

      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        theme={theme}
        onThemeToggle={toggle}
        onThemeSet={setDirect}
      />

      <main className={`flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 ${!isOnline ? 'mt-10' : ''}`}>
        <ErrorBoundary key={currentPage}>
          <Suspense fallback={<PageFallback/>}>
            {planOk
              ? <Page onNavigate={handleNavigate}/>
              : <PlanUpgradePrompt page={currentPage} reason="upgrade" currentPlan={plan} minPlan={minPlan}/>
            }
          </Suspense>
        </ErrorBoundary>
      </main>

      <ExcelPreviewHost/>
      <PDFPreviewHost/>
    </div>
  )
}

// ── TenantRoot — envuelve TenantApp con el contexto del negocio ────────────────
// El Toaster vive aquí (fuera del condicional login/app) para que nunca se
// desmonte durante la transición de sesión y los toasts no pierdan su timer.
function TenantRoot() {
  return (
    <TenantProvider>
      <TenantApp />
      <Toaster position="top-right" toastOptions={{
        style: { fontSize: '13px', borderRadius: '8px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
        success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
        error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
      }}/>
    </TenantProvider>
  )
}

// ── App — shell de routing ─────────────────────────────────────────────────────
//
// Estructura de URLs:
//   /                    → Landing (marketing + pricing)
//   /register            → Self-service onboarding
//   /app/:tenantSlug/*   → App del negocio (TenantRoot)
//   /superadmin/*        → Panel de administración
//   *                    → Redirect a /
//
// IMPORTANTE: Los links hacia /app/:slug deben usar <a href> (hard navigation)
// para forzar un page-reload y que el store se inicialice con el slug correcto.
// React Router <Link> haría soft-navigation y el store no re-inicializaría.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/"                   element={<Suspense fallback={null}><Landing /></Suspense>} />
        <Route path="/register"           element={<Suspense fallback={null}><Register /></Suspense>} />
        <Route path="/app/:tenantSlug/*"  element={<TenantRoot />} />
        <Route path="/superadmin/*"       element={<Suspense fallback={null}><SuperAdmin /></Suspense>} />
        <Route path="*"                   element={<Navigate to="/" replace />} />
      </Routes>

      {/* Toaster global para páginas fuera del TenantApp (landing, register) */}
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '13px', borderRadius: '8px' } }}/>
    </>
  )
}
