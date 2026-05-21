import { lazy, Suspense, useEffect, useState, Component } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useStore } from './store/index'
import { canAccess } from './config/app'
import { canUsePlan, getMinPlanForFeature, PLANS } from './config/plans'
import { useTheme } from './shared/hooks/useTheme'
import Sidebar from './shared/components/ui/Sidebar'
import PlanUpgradePrompt from './shared/components/ui/PlanUpgradePrompt'
import ExcelPreviewHost from './shared/components/ui/ExcelPreviewHost'
import PDFPreviewHost from './shared/components/ui/PDFPreviewHost'
import Login from './features/auth/Login'
import toast from 'react-hot-toast'
import { useServiceWorker } from './shared/hooks/useServiceWorker'
import InstallPWA from './shared/components/InstallPWA'
import { Wifi, WifiOff, Lock, AlertTriangle, ArrowLeft, PhoneCall } from 'lucide-react'
import { TenantProvider, useTenantSafe } from './context/TenantContext'
import { getStoredAlertThresholds } from './services/tenantService'

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
const Comprobantes    = lazy(() => import('./features/comprobantes/Comprobantes'))
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
  comprobantes: Comprobantes,
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

// ── AccessExpiredScreen — pantalla de bloqueo por vencimiento / suspensión ─────
function AccessExpiredScreen({ tenant, accessStatus }) {
  const isSuspended = accessStatus === 'suspended'
  const planLabel   = PLANS[tenant?.plan]?.label ?? tenant?.plan ?? '—'
  const expiryDate  = tenant?.accessExpiresAt
    ? new Date(tenant.accessExpiresAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 55%,#1e3a8a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '24px', padding: '48px 40px', maxWidth: '460px', width: '100%', textAlign: 'center', backdropFilter: 'blur(12px)' }}>

        {/* Icono */}
        <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: isSuspended ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', border: `1px solid ${isSuspended ? 'rgba(239,68,68,0.30)' : 'rgba(245,158,11,0.30)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px' }}>
          {isSuspended
            ? <Lock size={32} color="#f87171" strokeWidth={1.5} />
            : <AlertTriangle size={32} color="#fbbf24" strokeWidth={1.5} />
          }
        </div>

        {/* Título */}
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 10px', letterSpacing: '-0.5px' }}>
          {isSuspended ? 'Acceso suspendido' : 'Acceso vencido'}
        </h1>

        {/* Descripción */}
        <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.7, margin: '0 0 28px' }}>
          {isSuspended
            ? 'Tu cuenta ha sido suspendida temporalmente. Contacta al administrador del sistema para reactivarla.'
            : 'El período de acceso de este negocio ha vencido. Renueva tu plan para continuar usando el sistema.'
          }
        </p>

        {/* Datos del plan */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', marginBottom: '28px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {tenant?.businessName && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Negocio</span>
              <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>{tenant.businessName}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Plan</span>
            <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>{planLabel}</span>
          </div>
          {expiryDate && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Venció el</span>
              <span style={{ fontSize: '13px', color: isSuspended ? '#94a3b8' : '#fca5a5', fontWeight: 600 }}>{expiryDate}</span>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', borderRadius: '10px', background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>
            <ArrowLeft size={15} />
            Ir al inicio
          </a>
          <a href="https://wa.me/51925464880" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>
            <PhoneCall size={15} />
            Contactar soporte
          </a>
        </div>
      </div>
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

  // Toast de alerta de vencimiento — una vez por sesión (sessionStorage)
  useEffect(() => {
    if (!tenantCtx || tenantCtx.loading) return
    // Si ya está vencido/suspendido, la AccessExpiredScreen lo comunica — no mostrar toast
    const accessStatus = tenantCtx.accessStatus
    if (accessStatus === 'expired' || accessStatus === 'suspended') return
    const daysLeft = tenantCtx.daysLeft
    if (daysLeft === null || daysLeft === undefined || daysLeft <= 0) return

    const thresholds = getStoredAlertThresholds()
    if (daysLeft > thresholds.warning) return

    const todayKey = `mm_expiry_toast_${new Date().toISOString().slice(0, 10)}`
    if (sessionStorage.getItem(todayKey)) return
    sessionStorage.setItem(todayKey, '1')

    const isCritical = daysLeft <= thresholds.critical
    const isUrgent   = daysLeft <= thresholds.urgent
    const icon       = isCritical ? '🚨' : isUrgent ? '⚠️' : '⏳'
    const bg         = isCritical ? '#fef2f2' : isUrgent ? '#fff7ed' : '#fef9c3'
    const color      = isCritical ? '#991b1b' : isUrgent ? '#9a3412' : '#854d0e'
    const border     = isCritical ? '#fca5a5' : isUrgent ? '#fb923c' : '#fde047'
    const msg        = `Tu acceso vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}. Renueva para continuar sin interrupciones.`

    toast(msg, {
      icon,
      duration: 9000,
      style: { background: bg, color, border: `1px solid ${border}`, fontWeight: 600, fontSize: '13px', maxWidth: '340px' },
    })
  }, [tenantCtx?.loading, tenantCtx?.daysLeft])

  const handleNavigate = (page) => {
    if (!canAccess(currentUser?.role, page)) { toast.error('Sin permisos para esta sección'); return }
    setCurrentPage(page)
  }

  if (!currentUser) {
    return <Login />
  }

  const accessStatus = tenantCtx?.accessStatus
  if (!tenantCtx?.loading && (accessStatus === 'expired' || accessStatus === 'suspended')) {
    return <AccessExpiredScreen tenant={tenantCtx?.tenant} accessStatus={accessStatus} />
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
