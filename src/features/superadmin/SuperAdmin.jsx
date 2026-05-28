// ─── SuperAdmin V2 — Panel de Administración SaaS ────────────────────────────
import { useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  tenantService, DEFAULT_PLAN_LIMITS, DEFAULT_ALERT_THRESHOLDS,
} from '../../services/tenantService'
import {
  PLANS, PLAN_ORDER, BILLING_CYCLES, CYCLE_ORDER,
  getAccessExpiry, daysUntilExpiry, getAccessStatus, ACCESS_STATUS_CONFIG,
  BONUS_DAYS, getPlanPrice, getTotalPrice,
} from '../../config/plans'
import { SECTORS } from '../../config/app'
import { useTheme } from '../../shared/hooks/useTheme'
import {
  Crown, Shield, Users, Package, TrendingUp, RefreshCw, LogOut, ExternalLink,
  RotateCcw, Plus, Edit2, Trash2, X, Check, ChevronRight, ChevronLeft,
  History, DollarSign, Save, Globe, Phone, Mail, MapPin, MessageCircle,
  Sliders, Bell, Star, Eye, EyeOff, Settings, AlertTriangle,
  CreditCard, Building2, BarChart3, FileText, Link2, Palette,
} from 'lucide-react'

// ─── Credenciales dev ─────────────────────────────────────────────────────────
const SA_EMAIL = 'admin@sistema.pe'
const SA_PASS  = 'sistema2024'

// ─── Keys de localStorage adicionales ────────────────────────────────────────
const PAYMENTS_KEY     = 'mm_sa_payments_v1'
const FEATURED_KEY     = 'mm_sa_featured_plan'
const INACTIVE_KEY      = 'mm_sa_inactive_plans'
const PLAN_FEATURES_KEY = 'mm_sa_plan_features_v1'

const loadLocal = (key, def) => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def } catch { return def } }
const saveLocal = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }

// ─── Utilidades ───────────────────────────────────────────────────────────────
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtMoney = (n) => n > 0 ? `S/ ${n.toLocaleString('es-PE')}` : 'Gratis'
const isoToInput = (iso) => iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10)
const SECTOR_LABEL = (v) => SECTORS.find(s => s.value === v)?.label ?? v
const accessUrl = (slug) => `${window.location.origin}/app/${slug}`

// ─── Paletas de temas ─────────────────────────────────────────────────────────
// Cada tema tiene un set completo de tokens; el contexto distribuye el correcto.
const D_THEMES = {
  light: {
    bg: '#f1f5f9', sidebar: '#ffffff', card: '#ffffff', card2: '#f8fafc',
    border: 'rgba(0,0,0,0.07)', border2: 'rgba(0,0,0,0.14)',
    t1: '#0f172a', t2: '#475569', t3: '#94a3b8',
    accent: '#3b82f6', accentB: 'rgba(59,130,246,0.1)',
    green: '#16a34a', greenB: 'rgba(22,163,74,0.1)',
    amber: '#d97706', amberB: 'rgba(217,119,6,0.1)',
    red: '#dc2626', redB: 'rgba(220,38,38,0.1)',
    purple: '#7c3aed', purpleB: 'rgba(124,58,237,0.1)',
    orange: '#ea580c', orangeB: 'rgba(234,88,12,0.1)',
  },
  dark: {
    bg: '#050d1a', sidebar: '#030c16', card: '#09131f', card2: '#0c1828',
    border: 'rgba(255,255,255,0.06)', border2: 'rgba(255,255,255,0.11)',
    t1: '#ecfdf5', t2: '#94a3b8', t3: '#64748b',
    accent: '#10b981', accentB: 'rgba(16,185,129,0.15)',
    green: '#10b981', greenB: 'rgba(16,185,129,0.15)',
    amber: '#f59e0b', amberB: 'rgba(245,158,11,0.15)',
    red: '#ef4444', redB: 'rgba(239,68,68,0.15)',
    purple: '#8b5cf6', purpleB: 'rgba(139,92,246,0.15)',
    orange: '#f97316', orangeB: 'rgba(249,115,22,0.15)',
  },
  ocean: {
    bg: '#080f1f', sidebar: '#0b1222', card: '#101928', card2: '#0e1624',
    border: 'rgba(255,255,255,0.07)', border2: 'rgba(255,255,255,0.12)',
    t1: '#e2e8f0', t2: '#94a3b8', t3: '#64748b',
    accent: '#06b6d4', accentB: 'rgba(6,182,212,0.15)',
    green: '#10b981', greenB: 'rgba(16,185,129,0.15)',
    amber: '#f59e0b', amberB: 'rgba(245,158,11,0.15)',
    red: '#ef4444', redB: 'rgba(239,68,68,0.15)',
    purple: '#8b5cf6', purpleB: 'rgba(139,92,246,0.15)',
    orange: '#f97316', orangeB: 'rgba(249,115,22,0.15)',
  },
  forest: {
    bg: '#071510', sidebar: '#05100c', card: '#0b1e14', card2: '#0e2419',
    border: 'rgba(255,255,255,0.07)', border2: 'rgba(255,255,255,0.12)',
    t1: '#ecfdf5', t2: '#94a3b8', t3: '#64748b',
    accent: '#22c55e', accentB: 'rgba(34,197,94,0.15)',
    green: '#22c55e', greenB: 'rgba(34,197,94,0.15)',
    amber: '#f59e0b', amberB: 'rgba(245,158,11,0.15)',
    red: '#ef4444', redB: 'rgba(239,68,68,0.15)',
    purple: '#8b5cf6', purpleB: 'rgba(139,92,246,0.15)',
    orange: '#f97316', orangeB: 'rgba(249,115,22,0.15)',
  },
  sunset: {
    bg: '#160800', sidebar: '#100500', card: '#1e0e00', card2: '#231200',
    border: 'rgba(255,255,255,0.07)', border2: 'rgba(255,255,255,0.12)',
    t1: '#fff7ed', t2: '#94a3b8', t3: '#64748b',
    accent: '#f97316', accentB: 'rgba(249,115,22,0.15)',
    green: '#10b981', greenB: 'rgba(16,185,129,0.15)',
    amber: '#f59e0b', amberB: 'rgba(245,158,11,0.15)',
    red: '#ef4444', redB: 'rgba(239,68,68,0.15)',
    purple: '#8b5cf6', purpleB: 'rgba(139,92,246,0.15)',
    orange: '#f97316', orangeB: 'rgba(249,115,22,0.15)',
  },
  midnight: {
    bg: '#0f0a00', sidebar: '#0b0700', card: '#181000', card2: '#1d1300',
    border: 'rgba(255,255,255,0.07)', border2: 'rgba(255,255,255,0.12)',
    t1: '#fffbeb', t2: '#94a3b8', t3: '#64748b',
    accent: '#f59e0b', accentB: 'rgba(245,158,11,0.15)',
    green: '#10b981', greenB: 'rgba(16,185,129,0.15)',
    amber: '#f59e0b', amberB: 'rgba(245,158,11,0.15)',
    red: '#ef4444', redB: 'rgba(239,68,68,0.15)',
    purple: '#8b5cf6', purpleB: 'rgba(139,92,246,0.15)',
    orange: '#f97316', orangeB: 'rgba(249,115,22,0.15)',
  },
  nature: {
    bg: '#0a0e05', sidebar: '#070a03', card: '#101508', card2: '#131a0a',
    border: 'rgba(255,255,255,0.07)', border2: 'rgba(255,255,255,0.12)',
    t1: '#f7fee7', t2: '#94a3b8', t3: '#64748b',
    accent: '#84cc16', accentB: 'rgba(132,204,22,0.15)',
    green: '#10b981', greenB: 'rgba(16,185,129,0.15)',
    amber: '#f59e0b', amberB: 'rgba(245,158,11,0.15)',
    red: '#ef4444', redB: 'rgba(239,68,68,0.15)',
    purple: '#8b5cf6', purpleB: 'rgba(139,92,246,0.15)',
    orange: '#f97316', orangeB: 'rgba(249,115,22,0.15)',
  },
}

// D base (ocean — defecto) — también usado por constantes de módulo (inp, etc.)
const D = { ...D_THEMES.ocean }

// Context: distribuye D reactivo a todos los componentes
const DContext = createContext(D)
const useD = () => useContext(DContext)

// ─── Plan badge (dark) ────────────────────────────────────────────────────────
const PLAN_BADGE = {
  trial:      { bg: 'rgba(71,85,105,0.35)',  color: '#94a3b8' },
  basic:      { bg: 'rgba(59,130,246,0.2)',  color: '#60a5fa' },
  pro:        { bg: 'rgba(139,92,246,0.2)',  color: '#a78bfa' },
  enterprise: { bg: 'rgba(245,158,11,0.2)',  color: '#fbbf24' },
}

// ─── Status badge (dark) ──────────────────────────────────────────────────────
const STATUS_DARK = {
  active:    { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: 'activo' },
  trial:     { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'trial' },
  expiring:  { bg: 'rgba(249,115,22,0.15)', color: '#fb923c', label: 'por vencer' },
  suspended: { bg: 'rgba(249,115,22,0.2)',  color: '#fb923c', label: 'suspendido' },
  expired:   { bg: 'rgba(239,68,68,0.15)',  color: '#f87171', label: 'vencido' },
}

function PlanBadgeDark({ plan }) {
  const s = PLAN_BADGE[plan] ?? PLAN_BADGE.trial
  return (
    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {PLANS[plan]?.label ?? plan}
    </span>
  )
}

function StatusBadgeDark({ accessExpiresAt, isActive }) {
  const D = useD()
  const key = getAccessStatus(accessExpiresAt, isActive)
  const cfg = STATUS_DARK[key] ?? STATUS_DARK.expired
  const days = daysUntilExpiry(accessExpiresAt)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: cfg.bg, color: cfg.color, display: 'inline-block', width: 'fit-content' }}>
        {cfg.label}
      </span>
      {days !== null && (
        <span style={{ fontSize: '10px', color: days < 0 ? D.red : days <= 5 ? D.orange : D.t3, paddingLeft: '2px' }}>
          {days < 0 ? `Vencido hace ${Math.abs(days)}d` : days === 0 ? 'Vence hoy' : `${days}d restantes`}
        </span>
      )}
    </div>
  )
}

// ─── UI Primitivos dark ───────────────────────────────────────────────────────
const makeInp = (D) => ({
  padding: '9px 12px', borderRadius: '8px', border: `1.5px solid ${D.border2}`,
  background: D.card, color: D.t1, fontSize: '13px', outline: 'none',
  width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
})

function SAModal({ title, onClose, children, width = 480 }) {
  const D = useD()
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: D.card, border: `1px solid ${D.border2}`, borderRadius: '16px', width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px', borderBottom: `1px solid ${D.border}` }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: D.t1, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.t3, padding: '4px', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 24px 24px' }}>{children}</div>
      </div>
    </div>
  )
}

function FRow({ label, children }) {
  const D = useD()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: D.t2 }}>{label}</label>
      {children}
    </div>
  )
}

function SABtn({ children, onClick, variant = 'primary', disabled, icon: Icon, size = 'md', style: extra }) {
  const D = useD()
  const base = { display: 'flex', alignItems: 'center', gap: '6px', border: 'none', borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontFamily: 'inherit', transition: 'opacity .15s', opacity: disabled ? 0.5 : 1, ...extra }
  const sizes = { sm: { padding: '6px 12px', fontSize: '12px' }, md: { padding: '9px 18px', fontSize: '13px' }, lg: { padding: '11px 24px', fontSize: '14px' } }
  const variants = {
    primary: { background: `linear-gradient(135deg, ${D.accent}, #0891b2)`, color: '#fff' },
    secondary: { background: D.card2, border: `1px solid ${D.border2}`, color: D.t2 },
    danger: { background: D.redB, border: `1px solid ${D.red}40`, color: D.red },
    ghost: { background: 'transparent', border: `1px solid ${D.border2}`, color: D.t2 },
  }
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...sizes[size], ...variants[variant] }}>
      {Icon && <Icon size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  )
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  const D = useD()
  return (
    <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: '12px', padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: '12px', color: D.t3, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: '26px', fontWeight: 800, color: D.t1, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: D.t3, marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginFormV2({ onLogin }) {
  const D = useD()
  const inp = makeInp(D)
  const [email, setEmail]   = useState(SA_EMAIL)
  const [pass, setPass]     = useState('')
  const [showPass, setShow] = useState(false)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      if (email.trim() === SA_EMAIL && pass === SA_PASS) { onLogin() }
      else { setError('Credenciales incorrectas'); setLoading(false) }
    }, 600)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      {/* Left — branding */}
      <div style={{ flex: 1, background: 'linear-gradient(145deg, #04091a 0%, #061228 40%, #082040 70%, #0a2e56 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Grid pattern */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(6,182,212,0.06) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Glow circles */}
        <div style={{ position: 'absolute', top: '20%', left: '15%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: '250px', height: '250px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '40px', maxWidth: '480px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', boxShadow: '0 0 40px rgba(6,182,212,0.3)' }}>
            <Crown size={36} color="#fff" />
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 12px', letterSpacing: '-0.5px' }}>Panel de Administración</h1>
          <p style={{ fontSize: '16px', color: '#64748b', margin: '0 0 40px', lineHeight: 1.6 }}>Gestión centralizada de negocios, planes y configuración del sistema SaaS</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
            {[
              { icon: Building2, text: 'Gestión de clientes y negocios' },
              { icon: CreditCard, text: 'Planes, precios y facturación' },
              { icon: BarChart3, text: 'Historial de renovaciones' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Icon size={16} color={D.accent} />
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: '20px', color: '#1e3a5f', fontSize: '11px' }}>
          SISTEMA EN LÍNEA ● StockPro v2.0 · Maqueta — localStorage
        </div>
      </div>

      {/* Right — form */}
      <div style={{ width: '440px', minWidth: '340px', background: '#0b1222', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 36px', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
          {/* Brand */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #06b6d4, #0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 24px rgba(6,182,212,0.3)' }}>
              <Crown size={26} color="#fff" />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: D.t1, margin: '0 0 4px' }}>Admin Sistema</h2>
            <p style={{ fontSize: '13px', color: D.t3, margin: 0 }}>Acceso exclusivo administrador</p>
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: D.t3, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>EMAIL</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username"
                style={{ ...inp, background: '#0d1729' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: D.t3, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>CONTRASEÑA</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} required autoComplete="current-password"
                  style={{ ...inp, background: '#0d1729', paddingRight: '42px' }}
                />
                <button type="button" onClick={() => setShow(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: D.t3, display: 'flex' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ fontSize: '13px', color: D.red, background: D.redB, border: `1px solid ${D.red}30`, padding: '9px 12px', borderRadius: '8px' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ padding: '13px', borderRadius: '10px', border: 'none', background: loading ? '#1e3a5f' : `linear-gradient(135deg, ${D.accent}, #0891b2)`, color: '#fff', fontWeight: 700, fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'inherit', boxShadow: loading ? 'none' : '0 4px 20px rgba(6,182,212,0.25)' }}>
              {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Crown size={16} />}
              {loading ? 'Verificando...' : 'Ingresar al Panel'}
            </button>
          </form>

          <div style={{ marginTop: '20px', padding: '12px 14px', borderRadius: '8px', background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.12)', fontSize: '12px', color: D.t3 }}>
            <span style={{ color: D.t2, fontWeight: 600 }}>Demo:</span> {SA_EMAIL} / {SA_PASS}
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: '20px', fontSize: '11px', color: D.t3 }}>
          StockPro v2.0 · Maqueta — localStorage
        </div>
      </div>
    </div>
  )
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const THEME_OPTIONS = [
  { value: 'light',    icon: '☀️',  label: 'Claro' },
  { value: 'dark',     icon: '🌙',  label: 'Oscuro' },
  { value: 'ocean',    icon: '🌊',  label: 'Océano' },
  { value: 'forest',   icon: '🌿',  label: 'Bosque' },
  { value: 'sunset',   icon: '🌅',  label: 'Atardecer' },
  { value: 'midnight', icon: '🌃',  label: 'Medianoche' },
  { value: 'nature',   icon: '🍃',  label: 'Naturaleza' },
]

function SASidebar({ activeTab, onTabChange, onLogout, theme, onThemeToggle, onThemeSet, brandName = 'StockPro' }) {
  const D = useD()
  const [collapsed, setCollapsed] = useState(false)
  const [showTheme, setShowTheme] = useState(false)

  const TAB_NAV = [
    { id: 'tenants',   icon: Building2,  label: 'Negocios' },
    { id: 'plans',     icon: CreditCard, label: 'Planes y Precios' },
    { id: 'renewals',  icon: History,    label: 'Historial Renovaciones' },
    { id: 'limits',    icon: Sliders,    label: 'Límites del Plan' },
    { id: 'alerts',    icon: Bell,       label: 'Alertas de Vencimiento' },
    { id: 'landing',   icon: Globe,      label: 'Landing Page' },
  ]

  return (
    <aside style={{ width: collapsed ? '60px' : '240px', minWidth: collapsed ? '60px' : '240px', background: D.sidebar, borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, transition: 'width .2s ease, min-width .2s ease', overflow: 'hidden' }}>
      {/* Brand */}
      <div style={{ padding: collapsed ? '16px 0' : '16px 14px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: '10px', justifyContent: collapsed ? 'center' : 'space-between', minHeight: '70px' }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div style={{ width: '36px', height: '36px', minWidth: '36px', borderRadius: '10px', background: `linear-gradient(135deg, ${D.accent}, #0891b2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 14px rgba(6,182,212,0.25)` }}>
              <Crown size={18} color="#fff" />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: D.t1, whiteSpace: 'nowrap' }}>Admin Sistema</div>
              <div style={{ fontSize: '10px', color: D.accent, fontWeight: 600 }}>{brandName}</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `linear-gradient(135deg, ${D.accent}, #0891b2)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Crown size={18} color="#fff" />
          </div>
        )}
        <button onClick={() => setCollapsed(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.t3, display: 'flex', padding: '4px', minWidth: collapsed ? 'auto' : 'auto' }}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav section label */}
      {!collapsed && (
        <div style={{ padding: '14px 14px 6px', fontSize: '10px', fontWeight: 700, color: D.t3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Administración SaaS
        </div>
      )}

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
        {TAB_NAV.map(({ id, icon: Icon, label }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              title={collapsed ? label : undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: collapsed ? '10px 0' : '9px 10px', borderRadius: '8px', border: 'none',
                background: isActive ? D.accentB : 'transparent',
                color: isActive ? D.accent : D.t2,
                cursor: 'pointer', fontSize: '13px', fontWeight: isActive ? 700 : 500,
                justifyContent: collapsed ? 'center' : 'flex-start',
                marginBottom: '2px', transition: 'all .15s',
                borderLeft: isActive ? `3px solid ${D.accent}` : '3px solid transparent',
              }}
            >
              <Icon size={16} />
              {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Bottom controls */}
      <div style={{ padding: '8px 6px', borderTop: `1px solid ${D.border}` }}>
        {/* Theme picker */}
        {showTheme && !collapsed && (
          <div style={{ marginBottom: '8px', background: D.card, border: `1px solid ${D.border2}`, borderRadius: '10px', padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            {THEME_OPTIONS.map(t => (
              <button key={t.value} onClick={() => { onThemeSet(t.value); setShowTheme(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '6px', border: 'none', background: theme === t.value ? D.accentB : 'transparent', color: theme === t.value ? D.accent : D.t2, cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowTheme(p => !p)}
          title={collapsed ? 'Tema' : undefined}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: collapsed ? '10px 0' : '9px 10px', borderRadius: '8px', border: 'none', background: showTheme ? D.purpleB : 'transparent', color: showTheme ? '#a78bfa' : D.t2, cursor: 'pointer', fontSize: '13px', fontWeight: 500, justifyContent: collapsed ? 'center' : 'flex-start', marginBottom: '4px' }}>
          <Palette size={16} />
          {!collapsed && 'Temas'}
        </button>
        <button
          onClick={onLogout}
          title={collapsed ? 'Cerrar sesión' : undefined}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: collapsed ? '10px 0' : '9px 10px', borderRadius: '8px', border: 'none', background: 'transparent', color: D.t3, cursor: 'pointer', fontSize: '13px', fontWeight: 500, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <LogOut size={16} />
          {!collapsed && 'Cerrar sesión'}
        </button>
      </div>
    </aside>
  )
}

// ─── TAB: NEGOCIOS ────────────────────────────────────────────────────────────
function TenantFormModal({ tenant, onClose, onDone }) {
  const D = useD()
  const inp = makeInp(D)
  const readOnlyInp = { ...inp, background: D.card2, color: D.t2, cursor: 'default' }
  const isEdit = !!tenant
  const [form, setForm] = useState({
    businessName: tenant?.businessName ?? '',
    ruc:          tenant?.ruc ?? '',
    sector:       tenant?.sector ?? 'bodega',
    ownerName:    tenant?.ownerName ?? '',
    ownerEmail:   tenant?.ownerEmail ?? '',
    phone:        tenant?.phone ?? '',
    plan:         tenant?.plan ?? 'trial',
    billingCycle: tenant?.billingCycle ?? 'monthly',
    accessStartDate: isoToInput(tenant?.accessStartDate),
    accessExpiresAt: isoToInput(tenant?.accessExpiresAt ?? getAccessExpiry(new Date().toISOString(), tenant?.billingCycle ?? 'monthly')),
    createdAt:     isoToInput(tenant?.createdAt),
    isActive:     tenant?.isActive ?? true,
    internalNotes: tenant?.internalNotes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))
  const setAccessField = (k) => (e) => {
    const value = e.target.value
    setForm(p => {
      const next = { ...p, [k]: value }
      if (k === 'accessStartDate' || k === 'billingCycle') {
        const start = k === 'accessStartDate' ? value : p.accessStartDate
        const cycle = k === 'billingCycle' ? value : p.billingCycle
        next.accessExpiresAt = isoToInput(getAccessExpiry(`${start}T00:00:00`, cycle))
      }
      return next
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const r = isEdit
      ? await tenantService.superadminUpdateTenant(tenant.id, form)
      : await tenantService.superadminCreateTenant(form)
    setLoading(false)
    if (r.error) { setError(r.error); return }
    onDone()
  }

  return (
    <SAModal title={isEdit ? 'Editar negocio' : 'Nuevo negocio'} onClose={onClose} width={680}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FRow label="Nombre del negocio *">
            <input value={form.businessName} onChange={set('businessName')} required style={inp} placeholder="Ej: Bodega San Juan" />
          </FRow>
          <FRow label="RUC">
            <input value={form.ruc} onChange={set('ruc')} style={inp} placeholder="20XXXXXXXXX" />
          </FRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FRow label="Nombre del propietario">
            <input value={form.ownerName} onChange={set('ownerName')} style={inp} placeholder="Juan Pérez" />
          </FRow>
          <FRow label="Email *">
            <input type="email" value={form.ownerEmail} onChange={set('ownerEmail')} required style={inp} placeholder="juan@negocio.com" />
          </FRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FRow label="Teléfono">
            <input value={form.phone} onChange={set('phone')} style={inp} placeholder="+51 999 999 999" />
          </FRow>
          <FRow label="Rubro">
            <select value={form.sector} onChange={set('sector')} style={inp}>
              {SECTORS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </FRow>
        </div>
        {tenant?.slug && (
          <FRow label="Link de acceso">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${D.green}55`, background: D.greenB, color: D.green, fontSize: '12px', overflow: 'hidden' }}>
              <Link2 size={13} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{accessUrl(tenant.slug)}</span>
              <a href={`/app/${tenant.slug}`} target="_blank" rel="noreferrer" style={{ color: D.green, display: 'flex', marginLeft: 'auto', flexShrink: 0 }}><ExternalLink size={13} /></a>
            </div>
          </FRow>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <FRow label="Plan">
            <select value={form.plan} onChange={set('plan')} style={inp}>
              {PLAN_ORDER.map(p => <option key={p} value={p}>{PLANS[p].label}</option>)}
            </select>
          </FRow>
          <FRow label="Ciclo">
            <select value={form.billingCycle} onChange={setAccessField('billingCycle')} style={inp}>
              {CYCLE_ORDER.map(c => <option key={c} value={c}>{BILLING_CYCLES[c].shortLabel}</option>)}
            </select>
          </FRow>
          <FRow label="Estado">
            <select value={form.isActive ? 'active' : 'suspended'} onChange={e => setForm(p => ({ ...p, isActive: e.target.value === 'active' }))} style={inp}>
              <option value="active">Activo</option>
              <option value="suspended">Suspendido</option>
            </select>
          </FRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <FRow label="Fecha de registro">
            <input type="date" value={form.createdAt} readOnly style={readOnlyInp} />
          </FRow>
          <FRow label="Inicio de acceso">
            <input type="date" value={form.accessStartDate} onChange={setAccessField('accessStartDate')} style={inp} />
          </FRow>
          <FRow label="Fecha de vencimiento">
            <input type="date" value={form.accessExpiresAt} onChange={set('accessExpiresAt')} style={inp} />
          </FRow>
        </div>
        <FRow label="Notas internas">
          <textarea value={form.internalNotes} onChange={set('internalNotes')} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Observaciones, referencias de pago..." />
        </FRow>

        {error && <div style={{ fontSize: '13px', color: D.red, background: D.redB, padding: '9px 12px', borderRadius: '8px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <SABtn variant="ghost" onClick={onClose}>Cancelar</SABtn>
          <SABtn variant="primary" disabled={loading} onClick={() => {}}>
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear negocio'}
          </SABtn>
        </div>
      </form>
    </SAModal>
  )
}

function RenewModal({ tenant, onClose, onDone }) {
  const D = useD()
  const inp = makeInp(D)
  const [plan, setPlan]   = useState(tenant.plan)
  const [cycle, setCycle] = useState(tenant.billingCycle ?? 'monthly')
  const [mode, setMode]   = useState('today')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const base = mode === 'from_expiry' && tenant.accessExpiresAt && new Date(tenant.accessExpiresAt) > new Date()
    ? tenant.accessExpiresAt : new Date().toISOString()
  const previewExp = getAccessExpiry(base, cycle)
  const total      = getTotalPrice ? getTotalPrice(plan, cycle) : 0

  const submit = async () => {
    setLoading(true); setError('')
    const r = await tenantService.renewAccess(tenant.id, { plan, billingCycle: cycle, startMode: mode, notes })
    setLoading(false)
    if (r.error) { setError(r.error); return }
    onDone()
  }

  return (
    <SAModal title={`Renovar — ${tenant.businessName}`} onClose={onClose} width={500}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ background: D.card2, borderRadius: '9px', padding: '12px 14px', fontSize: '13px', color: D.t2, display: 'flex', gap: '24px' }}>
          <div><span style={{ fontWeight: 600, color: D.t1 }}>Plan actual:</span> {PLANS[tenant.plan]?.label}</div>
          <div><span style={{ fontWeight: 600, color: D.t1 }}>Vence:</span> {fmtDate(tenant.accessExpiresAt)}</div>
        </div>

        <FRow label="Nuevo plan">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {PLAN_ORDER.map(pid => {
              const sel = plan === pid
              return (
                <label key={pid} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: `1.5px solid ${sel ? D.accent : D.border2}`, background: sel ? D.accentB : D.card2, cursor: 'pointer' }}>
                  <input type="radio" name="plan" value={pid} checked={sel} onChange={() => setPlan(pid)} style={{ accentColor: D.accent }} />
                  <span style={{ flex: 1, fontWeight: 700, fontSize: '13px', color: D.t1 }}>{PLANS[pid].label}</span>
                  <span style={{ fontSize: '12px', color: D.t2 }}>{PLANS[pid].price === 0 ? 'Gratis' : `S/ ${PLANS[pid].price}/mes`}</span>
                </label>
              )
            })}
          </div>
        </FRow>

        <FRow label="Ciclo">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
            {CYCLE_ORDER.map(cid => {
              const cfg = BILLING_CYCLES[cid]; const sel = cycle === cid
              return (
                <button key={cid} onClick={() => setCycle(cid)} style={{ padding: '8px 4px', borderRadius: '8px', border: `1.5px solid ${sel ? D.accent : D.border2}`, background: sel ? D.accentB : D.card2, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: sel ? D.accent : D.t1 }}>{cfg.shortLabel}</span>
                  {cfg.discountPct > 0 && <span style={{ fontSize: '9px', fontWeight: 700, background: D.greenB, color: D.green, padding: '1px 5px', borderRadius: '10px' }}>-{cfg.discountPct}%</span>}
                </button>
              )
            })}
          </div>
        </FRow>

        <div style={{ background: D.greenB, border: `1px solid ${D.green}30`, borderRadius: '9px', padding: '12px 14px', fontSize: '12px', color: D.green }}>
          <strong>Vista previa:</strong> Vence el {fmtDate(previewExp)}{total > 0 ? ` · Total S/ ${total}` : ''}
        </div>

        <FRow label="Notas">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Referencia de pago, observaciones..." />
        </FRow>

        {error && <div style={{ fontSize: '13px', color: D.red, background: D.redB, padding: '9px 12px', borderRadius: '8px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <SABtn variant="ghost" onClick={onClose}>Cancelar</SABtn>
          <SABtn variant="primary" disabled={loading} onClick={submit}>{loading ? 'Procesando...' : 'Confirmar renovación'}</SABtn>
        </div>
      </div>
    </SAModal>
  )
}

function TenantsTab({ onStatsRefresh }) {
  const D = useD()
  const inp = makeInp(D)
  const [tenants,     setTenants]     = useState([])
  const [search,      setSearch]      = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPlan,  setFilterPlan]  = useState('')
  const [loading,     setLoading]     = useState(false)
  const [stats,       setStats]       = useState({ total: 0, active: 0, trial: 0, expiring: 0, expired: 0 })
  const [modal,       setModal]       = useState(null) // null | 'new' | {edit:tenant} | {renew:tenant} | {del:tenant}

  const load = useCallback(async () => {
    setLoading(true)
    const r = await tenantService.listAll({ search })
    if (r.data) {
      const all = r.data
      setTenants(all)
      const now = new Date()
      setStats({
        total:    all.length,
        active:   all.filter(t => getAccessStatus(t.accessExpiresAt, t.isActive) === 'active').length,
        trial:    all.filter(t => getAccessStatus(t.accessExpiresAt, t.isActive) === 'trial').length,
        expiring: all.filter(t => { const d = daysUntilExpiry(t.accessExpiresAt); return d !== null && d >= 0 && d <= 30 }).length,
        expired:  all.filter(t => getAccessStatus(t.accessExpiresAt, t.isActive) === 'expired').length,
      })
    }
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  const filtered = tenants.filter(t => {
    if (filterStatus) { const s = getAccessStatus(t.accessExpiresAt, t.isActive); if (s !== filterStatus) return false }
    if (filterPlan && t.plan !== filterPlan) return false
    return true
  })

  const doDelete = async (t) => {
    await tenantService.superadminDeleteTenant(t.id)
    setModal(null); load(); onStatsRefresh()
  }

  const thS = { padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: D.t3, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid ${D.border}`, whiteSpace: 'nowrap', background: D.card2 }
  const tdS = { padding: '13px 14px', borderBottom: `1px solid ${D.border}`, verticalAlign: 'middle' }

  return (
    <>
      {modal === 'new' && <TenantFormModal onClose={() => setModal(null)} onDone={() => { setModal(null); load(); onStatsRefresh() }} />}
      {modal?.edit && <TenantFormModal tenant={modal.edit} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); onStatsRefresh() }} />}
      {modal?.renew && <RenewModal tenant={modal.renew} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); onStatsRefresh() }} />}
      {modal?.del && (
        <SAModal title="Confirmar eliminación" onClose={() => setModal(null)} width={380}>
          <p style={{ fontSize: '14px', color: D.t2, marginBottom: '20px' }}>¿Eliminar <strong style={{ color: D.t1 }}>{modal.del.businessName}</strong>? Esta acción no se puede deshacer.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <SABtn variant="ghost" onClick={() => setModal(null)}>Cancelar</SABtn>
            <SABtn variant="danger" icon={Trash2} onClick={() => doDelete(modal.del)}>Eliminar</SABtn>
          </div>
        </SAModal>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatCard icon={Users}         label="Total Registrados"   value={stats.total}    color={D.accent} />
        <StatCard icon={Check}         label="Activos"             value={stats.active}   color={D.green} />
        <StatCard icon={TrendingUp}    label="Trial Activo"        value={stats.trial}    color={D.amber} />
        <StatCard icon={AlertTriangle} label="Por Vencer (≤30d)"   value={stats.expiring} color={D.orange} />
        <StatCard icon={AlertTriangle} label="Vencidos"            value={stats.expired}  color={D.red} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar por nombre, RUC, email o ID..."
          style={{ ...inp, flex: 1, minWidth: '200px', background: D.card2 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: '170px', background: D.card2 }}>
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="trial">Trial</option>
          <option value="expiring">Por vencer</option>
          <option value="suspended">Suspendido</option>
          <option value="expired">Vencido</option>
        </select>
        <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} style={{ ...inp, width: '160px', background: D.card2 }}>
          <option value="">Todos los planes</option>
          {PLAN_ORDER.map(p => <option key={p} value={p}>{PLANS[p].label}</option>)}
        </select>
        <SABtn icon={RefreshCw} variant="ghost" onClick={load} disabled={loading} style={{ padding: '9px 12px' }}>{' '}</SABtn>
        <SABtn icon={Plus} variant="primary" onClick={() => setModal('new')}>Nuevo negocio</SABtn>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1px solid ${D.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
          <thead>
            <tr>
              {['EMPRESA', 'PLAN', 'ESTADO', 'VENCIMIENTO', 'LINK DE ACCESO', 'CONTACTO', ''].map(h => (
                <th key={h} style={thS}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: D.t3, fontSize: '13px' }}>Cargando...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: D.t3, fontSize: '13px' }}>No hay negocios registrados</td></tr>
            )}
            {filtered.map(t => (
              <tr key={t.id} style={{ background: D.card, transition: 'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = D.card2}
                onMouseLeave={e => e.currentTarget.style.background = D.card}>
                <td style={tdS}>
                  <div style={{ fontWeight: 700, color: D.t1, fontSize: '13px' }}>{t.businessName}</div>
                  <div style={{ fontSize: '10px', color: D.t3, marginTop: '2px' }}>
                    ID: {t.slug}{t.ruc ? ` · RUC: ${t.ruc}` : ''}
                  </div>
                </td>
                <td style={tdS}><PlanBadgeDark plan={t.plan} /></td>
                <td style={tdS}><StatusBadgeDark accessExpiresAt={t.accessExpiresAt} isActive={t.isActive} /></td>
                <td style={{ ...tdS, fontSize: '12px', color: D.t2 }}>
                  <div>{fmtDate(t.accessExpiresAt)}</div>
                </td>
                <td style={tdS}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: D.accent }}>
                    <span>/app/{t.slug}</span>
                    <a href={`/app/${t.slug}`} target="_blank" rel="noreferrer" style={{ color: D.t3, display: 'flex' }}><ExternalLink size={12} /></a>
                  </div>
                </td>
                <td style={tdS}>
                  <div style={{ fontSize: '12px', color: D.t1, fontWeight: 600 }}>{t.ownerName || '—'}</div>
                  <div style={{ fontSize: '11px', color: D.t3 }}>{t.ownerEmail}</div>
                </td>
                <td style={{ ...tdS, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setModal({ renew: t })} title="Renovar" style={{ padding: '6px 8px', borderRadius: '6px', border: `1px solid ${D.border2}`, background: D.accentB, color: D.accent, cursor: 'pointer', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RotateCcw size={11} /> Renovar
                    </button>
                    <button onClick={() => setModal({ edit: t })} title="Editar" style={{ padding: '6px 8px', borderRadius: '6px', border: `1px solid ${D.border2}`, background: 'transparent', color: D.t2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => setModal({ del: t })} title="Eliminar" style={{ padding: '6px 8px', borderRadius: '6px', border: `1px solid ${D.red}30`, background: D.redB, color: D.red, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── TAB: PLANES Y PRECIOS ────────────────────────────────────────────────────
const PLAN_CARD_COLORS = {
  trial:      { border: D.border2, accent: D.t3 },
  basic:      { border: '#3b82f6', accent: '#60a5fa' },
  pro:        { border: '#8b5cf6', accent: '#a78bfa' },
  enterprise: { border: '#f59e0b', accent: '#fbbf24' },
}

// Features human-readable para las cards (lenguaje natural, estilo pricing page)
const PLAN_CARD_FEATURES = {
  trial: [
    'POS con múltiples medios de pago',
    'Catálogo (hasta 100 productos)',
    'Control de inventario y stock',
    'Módulo de clientes',
    '1 usuario · 1 caja registradora',
    '30 días completamente gratis',
  ],
  basic: [
    'POS, catálogo e inventario',
    'Clientes y cobranza',
    'Compras y proveedores',
    'Reportes + exportación a Excel',
    'Hasta 500 productos · 3 usuarios',
    'Cotizaciones y devoluciones',
  ],
  pro: [
    'Todo lo del plan Básico',
    'Descuentos y campañas promocionales',
    'Fidelización y puntos de cliente',
    'Auditoría y trazabilidad completa',
    'Hasta 2,000 productos · 10 usuarios',
    'Multi-caja y alertas automáticas',
  ],
  enterprise: [
    'Todo lo del plan Profesional',
    'Usuarios y productos ilimitados',
    'Soporte prioritario 24/7',
    'Multi-empresa y API Access',
    'SLA garantizado',
    'Onboarding dedicado',
  ],
}

// Módulos del sistema agrupados para la tabla comparativa
const MODULE_GROUPS = [
  {
    label: 'Operaciones básicas', color: '#60a5fa',
    modules: [
      { key: 'pos',        label: 'Punto de Venta' },
      { key: 'catalog',    label: 'Catálogo de productos' },
      { key: 'inventory',  label: 'Inventario y stock' },
      { key: 'cash',       label: 'Caja y arqueo' },
      { key: 'clients',    label: 'Clientes' },
      { key: 'reports',    label: 'Reportes y KPIs' },
    ],
  },
  {
    label: 'Gestión avanzada', color: '#34d399',
    modules: [
      { key: 'suppliers',  label: 'Proveedores' },
      { key: 'purchases',  label: 'Compras' },
      { key: 'returns',    label: 'Devoluciones' },
      { key: 'quotations', label: 'Cotizaciones / Preventa' },
    ],
  },
  {
    label: 'Comercial y fidelización', color: '#fbbf24',
    modules: [
      { key: 'discounts',  label: 'Campañas de descuento' },
      { key: 'tickets',    label: 'Vales de descuento' },
      { key: 'loyalty',    label: 'Programa de Puntos' },
      { key: 'merma',      label: 'Registro de merma' },
    ],
  },
  {
    label: 'Control y auditoría', color: '#a78bfa',
    modules: [
      { key: 'trazabilidad', label: 'Trazabilidad completa' },
      { key: 'audit',        label: 'Auditoría de acciones' },
      { key: 'alerts',       label: 'Alertas inteligentes' },
      { key: 'comprobantes', label: 'Comprobantes SUNAT' },
    ],
  },
]

const ALWAYS_ON = ['dashboard', 'users', 'settings', 'about']
const DEFAULT_PLAN_FEATURES = Object.fromEntries(
  PLAN_ORDER.map(pid => [pid, [...(PLANS[pid]?.features ?? [])]])
)
const PLAN_ROLES = {
  trial:      'Administrador',
  basic:      'Administrador, Cajero',
  pro:        'Administrador, Gerente, Supervisor, Cajero',
  enterprise: 'Administrador, Gerente, Supervisor, Cajero',
}
const PLAN_ICONS = { trial: '🎁', basic: '⭐', pro: '🚀', enterprise: '🏢' }

function PlansTab() {
  const D = useD()
  const inp = makeInp(D)
  const [prices,    setPrices]    = useState({})
  const [limits,    setLimits]    = useState(null)
  const [featured,  setFeatured]  = useState(() => loadLocal(FEATURED_KEY, 'pro'))
  const [inactive,  setInactive]  = useState(() => loadLocal(INACTIVE_KEY, []))
  const [editPlan,  setEditPlan]  = useState(null)
  const [view,      setView]      = useState('cards') // 'cards' | 'table'
  const [planFeats, setPlanFeats] = useState(() => loadLocal(PLAN_FEATURES_KEY, DEFAULT_PLAN_FEATURES))
  const [saved,     setSaved]     = useState(false)
  const [featSaved, setFeatSaved] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [cardCycle, setCardCycle] = useState('monthly')

  useEffect(() => {
    tenantService.getPrices().then(r => { if (r.data) setPrices(r.data) })
    tenantService.getLimits().then(r => { if (r.data) setLimits(r.data) })
  }, [])

  const savePrices = async () => {
    setLoading(true)
    await tenantService.updatePrices(prices)
    setLoading(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }
  const saveModules = () => {
    saveLocal(PLAN_FEATURES_KEY, planFeats)
    setFeatSaved(true); setTimeout(() => setFeatSaved(false), 3000)
  }
  const toggleFeatured = (pid) => {
    const val = featured === pid ? null : pid
    setFeatured(val); saveLocal(FEATURED_KEY, val)
  }
  const toggleInactive = (pid) => {
    const next = inactive.includes(pid) ? inactive.filter(i => i !== pid) : [...inactive, pid]
    setInactive(next); saveLocal(INACTIVE_KEY, next)
  }
  const toggleModule = (pid, mod) => {
    if (ALWAYS_ON.includes(mod)) return
    setPlanFeats(prev => {
      const cur = prev[pid] ?? []
      const next = cur.includes(mod) ? cur.filter(k => k !== mod) : [...cur, mod]
      return { ...prev, [pid]: next }
    })
  }
  const hasModule = (pid, mod) => (planFeats[pid] ?? PLANS[pid]?.features ?? []).includes(mod)

  // Style helper for featured column
  const colBg   = (pid) => featured === pid ? 'rgba(139,92,246,0.06)' : D.card
  const colBord = (pid) => ({ borderLeft: `1px solid ${featured === pid ? PLAN_CARD_COLORS[pid].border : D.border}` })

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: D.t1, margin: '0 0 4px' }}>Planes y Precios</h2>
          <p style={{ fontSize: '12px', color: D.t3, margin: 0 }}>Define los planes SaaS y los módulos disponibles para tus clientes</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: D.card2, borderRadius: '8px', border: `1px solid ${D.border2}`, overflow: 'hidden' }}>
            {[['cards', '📋 Cards'], ['table', '📊 Tabla comparativa']].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '7px 14px', border: 'none', background: view === v ? D.accent : 'transparent', color: view === v ? '#fff' : D.t2, cursor: 'pointer', fontSize: '12px', fontWeight: view === v ? 700 : 500, fontFamily: 'inherit', transition: 'all .15s' }}>
                {l}
              </button>
            ))}
          </div>
          {view === 'cards' && (
            <>
              <SABtn icon={saved ? Check : Save} variant={saved ? 'ghost' : 'primary'} onClick={savePrices} disabled={loading}>
                {saved ? 'Guardado' : 'Guardar precios'}
              </SABtn>
              <SABtn icon={Plus} variant="ghost">Nuevo plan</SABtn>
            </>
          )}
          {view === 'table' && (
            <SABtn icon={featSaved ? Check : Save} variant={featSaved ? 'ghost' : 'primary'} onClick={saveModules}>
              {featSaved ? 'Módulos guardados' : 'Guardar módulos'}
            </SABtn>
          )}
        </div>
      </div>

      {/* ── VISTA CARDS ── */}
      {view === 'cards' && (
        <div>
          {/* Toggle Mensual / Anual */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
            <div style={{ display: 'inline-flex', background: D.card2, borderRadius: '30px', border: `1px solid ${D.border2}`, padding: '4px', gap: '2px' }}>
              {[['monthly', 'Mensual', null], ['annual', 'Anual', '-20%']].map(([cid, lbl, badge]) => (
                <button key={cid} onClick={() => setCardCycle(cid)} style={{
                  padding: '7px 22px', borderRadius: '25px', border: 'none',
                  background: cardCycle === cid ? D.accent : 'transparent',
                  color: cardCycle === cid ? '#fff' : D.t2,
                  cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                  gap: '7px', transition: 'all .15s',
                }}>
                  {lbl}
                  {badge && <span style={{ fontSize: '10px', background: '#16a34a', color: '#fff', padding: '1px 7px', borderRadius: '10px', fontWeight: 800 }}>{badge}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de tarjetas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px', alignItems: 'start' }}>
            {PLAN_ORDER.map(pid => {
              const plan      = PLANS[pid]
              const c         = PLAN_CARD_COLORS[pid]
              const basePrice = prices[pid] ?? plan.price
              const monthly   = cardCycle === 'annual' ? Math.round(basePrice * 0.8) : basePrice
              const isFeat    = featured === pid
              const isInact   = inactive.includes(pid)
              const cardFeats = PLAN_CARD_FEATURES[pid] ?? []

              // Estilo diferenciado para plan destacado (fondo azul oscuro)
              const cardBg      = isFeat ? 'linear-gradient(155deg, #1a1f4e 0%, #15325c 60%, #0f2744 100%)' : D.card
              const cardBorder  = isFeat ? '1.5px solid #4f46e5' : `1px solid ${D.border}`
              const headColor   = isFeat ? '#e0e7ff' : D.t1
              const subColor    = isFeat ? '#94a3b8' : D.t3
              const featsColor  = isFeat ? '#cbd5e1' : D.t2
              const checkColor  = isFeat ? '#818cf8' : c.accent
              const divColor    = isFeat ? 'rgba(255,255,255,0.08)' : D.border
              const btnBorder   = isFeat ? 'rgba(255,255,255,0.15)' : D.border2
              const btnColor    = isFeat ? '#94a3b8' : D.t2

              return (
                <div key={pid} style={{
                  background: cardBg, border: cardBorder, borderRadius: '18px',
                  overflow: 'hidden', opacity: isInact ? 0.45 : 1,
                  transition: 'all .2s', position: 'relative',
                  display: 'flex', flexDirection: 'column',
                  boxShadow: isFeat ? '0 8px 32px rgba(79,70,229,0.25)' : 'none',
                }}>

                  {/* Badge "Más popular" centrado en el borde superior */}
                  {isFeat && (
                    <div style={{
                      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                      background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                      color: '#000', fontSize: '11px', fontWeight: 800,
                      padding: '4px 18px', borderRadius: '0 0 12px 12px',
                      letterSpacing: '0.02em', whiteSpace: 'nowrap',
                    }}>
                      ★ Más popular
                    </div>
                  )}

                  {/* ── Cabecera: nombre + descripción + precio ── */}
                  <div style={{ padding: `${isFeat ? '36px' : '24px'} 24px 20px` }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: headColor, margin: '0 0 5px' }}>{plan.label}</h3>
                    <p  style={{ fontSize: '12px', color: subColor, margin: '0 0 18px', lineHeight: '1.5' }}>{plan.description}</p>

                    {basePrice === 0 ? (
                      <div style={{ fontSize: '44px', fontWeight: 900, color: headColor, lineHeight: 1 }}>Gratis</div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                          <span style={{ fontSize: '18px', fontWeight: 700, color: headColor }}>S/</span>
                          <span style={{ fontSize: '44px', fontWeight: 900, color: headColor, lineHeight: 1 }}>{monthly}</span>
                          <span style={{ fontSize: '13px', color: subColor, marginLeft: '2px' }}>/mes</span>
                        </div>
                        {cardCycle === 'annual' ? (
                          <div style={{ fontSize: '11px', color: '#22c55e', fontWeight: 600, marginTop: '5px' }}>
                            S/ {monthly * 12}/año — ahorras S/ {(basePrice - monthly) * 12} al año
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: subColor, marginTop: '5px' }}>
                            S/ {Math.round(basePrice * 12 * 0.8)}/año con plan anual&nbsp;
                            <span style={{ color: '#22c55e', fontWeight: 600 }}>(ahorra 20%)</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Separador */}
                  <div style={{ height: '1px', background: divColor, margin: '0 24px' }} />

                  {/* ── Lista de características ── */}
                  <div style={{ padding: '20px 24px', flex: 1 }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {cardFeats.map(f => (
                        <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: featsColor, lineHeight: '1.45' }}>
                          <span style={{ color: checkColor, flexShrink: 0, fontWeight: 700, marginTop: '1px', fontSize: '14px' }}>✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* ── Botones de administración ── */}
                  <div style={{ padding: '14px 24px 20px', borderTop: `1px solid ${divColor}`, display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button onClick={() => setEditPlan(pid)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '7px', border: `1px solid ${btnBorder}`, background: 'transparent', color: btnColor, cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit' }}>
                      <Edit2 size={11} /> Editar
                    </button>
                    <button onClick={() => toggleInactive(pid)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '7px', border: `1px solid ${btnBorder}`, background: 'transparent', color: isInact ? D.green : btnColor, cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit' }}>
                      {isInact ? <Eye size={11} /> : <EyeOff size={11} />} {isInact ? 'Activar' : 'Desactivar'}
                    </button>
                    <button onClick={() => toggleFeatured(pid)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '7px', border: `1px solid ${isFeat ? D.amber + '50' : btnBorder}`, background: isFeat ? D.amberB : 'transparent', color: isFeat ? D.amber : btnColor, cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit' }}>
                      <Star size={11} /> Destacar
                    </button>
                    {pid !== 'trial' && (
                      <button style={{ padding: '6px 10px', borderRadius: '7px', border: `1px solid ${D.red}30`, background: D.redB, color: D.red, cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: 'inherit' }}>
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── VISTA TABLA COMPARATIVA ── */}
      {view === 'table' && (
        <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: '14px', overflow: 'hidden' }}>
          {/* Info banner */}
          <div style={{ background: D.accentB, border: `1px solid ${D.accent}25`, borderRadius: '10px', padding: '10px 16px', margin: '16px 16px 0', fontSize: '12px', color: D.accent, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>💡</span>
            Haz clic en ✓ o — para activar/desactivar módulos por plan. Los cambios se aplican al guardar.
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              {/* ── CABECERA DE COLUMNAS ── */}
              <thead>
                <tr style={{ borderBottom: `2px solid ${D.border2}` }}>
                  {/* Columna módulo */}
                  <th style={{ padding: '18px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: D.t3, textTransform: 'uppercase', letterSpacing: '0.07em', width: '200px', background: D.card2, borderRight: `1px solid ${D.border}` }}>
                    Módulo
                  </th>
                  {/* Columna por plan */}
                  {PLAN_ORDER.map(pid => {
                    const plan   = PLANS[pid]
                    const price  = prices[pid] ?? plan.price
                    const isFeat = featured === pid
                    const c      = PLAN_CARD_COLORS[pid]
                    return (
                      <th key={pid} style={{ padding: '16px 20px', textAlign: 'center', background: colBg(pid), ...colBord(pid) }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '20px' }}>{PLAN_ICONS[pid]}</span>
                          {isFeat && (
                            <span style={{ fontSize: '9px', fontWeight: 800, background: D.purple, color: '#fff', padding: '2px 8px', borderRadius: '20px', letterSpacing: '0.04em' }}>
                              ★ Más popular
                            </span>
                          )}
                          <span style={{ fontSize: '14px', fontWeight: 800, color: c.accent }}>{plan.label}</span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: price === 0 ? D.green : D.t1 }}>
                            {price === 0 ? 'Gratis' : `S/ ${price}`}
                            {price > 0 && <span style={{ fontSize: '11px', color: D.t3, fontWeight: 400 }}>/mes</span>}
                          </span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>

              <tbody>
                {/* ── SECCIÓN LÍMITES ── */}
                <tr>
                  <td colSpan={5} style={{ padding: '7px 20px', background: '#0a1220', fontSize: '11px', fontWeight: 700, color: D.t3, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: `1px solid ${D.border}`, borderTop: `1px solid ${D.border}` }}>
                    Límites
                  </td>
                </tr>
                {[
                  {
                    label: 'Productos',
                    render: (pid) => {
                      const v = limits?.[pid]?.products ?? DEFAULT_PLAN_LIMITS[pid]?.products ?? null
                      return v === null ? <span style={{ color: D.green, fontWeight: 700 }}>Ilimitados</span>
                        : <span style={{ color: D.amber }}>Hasta {v?.toLocaleString()}</span>
                    },
                  },
                  {
                    label: 'Usuarios',
                    render: (pid) => {
                      const v = limits?.[pid]?.users ?? DEFAULT_PLAN_LIMITS[pid]?.users ?? null
                      return v === null ? <span style={{ color: D.green, fontWeight: 700 }}>Ilimitados</span>
                        : <span style={{ color: D.amber }}>Hasta {v}</span>
                    },
                  },
                  {
                    label: 'Roles disponibles',
                    render: (pid) => <span style={{ color: D.t2, fontSize: '11px' }}>{PLAN_ROLES[pid]}</span>,
                  },
                ].map(({ label, render }) => (
                  <tr key={label} style={{ borderBottom: `1px solid ${D.border}` }}>
                    <td style={{ padding: '11px 20px', fontSize: '13px', color: D.t2, background: D.card2, borderRight: `1px solid ${D.border}` }}>
                      {label}
                    </td>
                    {PLAN_ORDER.map(pid => (
                      <td key={pid} style={{ padding: '11px 20px', textAlign: 'center', fontSize: '13px', background: colBg(pid), ...colBord(pid) }}>
                        {render(pid)}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* ── GRUPOS DE MÓDULOS ── */}
                {MODULE_GROUPS.map(({ label: grpLabel, color: grpColor, modules }) => (
                  <>
                    {/* Group header */}
                    <tr key={grpLabel}>
                      <td colSpan={5} style={{ padding: '7px 20px', background: '#0a1220', fontSize: '11px', fontWeight: 700, color: grpColor, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: `1px solid ${D.border}`, borderTop: `2px solid ${D.border}` }}>
                        {grpLabel}
                      </td>
                    </tr>
                    {/* Module rows */}
                    {modules.map(({ key: modKey, label: modLabel }) => (
                      <tr key={modKey} style={{ borderBottom: `1px solid ${D.border}` }}>
                        <td style={{ padding: '11px 20px', fontSize: '13px', color: D.t1, background: D.card2, borderRight: `1px solid ${D.border}` }}>
                          {modLabel}
                        </td>
                        {PLAN_ORDER.map(pid => {
                          const on = hasModule(pid, modKey)
                          return (
                            <td key={pid} style={{ padding: '11px 20px', textAlign: 'center', background: colBg(pid), ...colBord(pid) }}>
                              <button
                                onClick={() => toggleModule(pid, modKey)}
                                title={on ? 'Clic para desactivar este módulo' : 'Clic para activar este módulo'}
                                style={{ background: 'none', border: `1px solid transparent`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', transition: 'all .15s' }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = on ? D.redB : D.greenB
                                  e.currentTarget.style.borderColor = on ? `${D.red}50` : `${D.green}50`
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = 'none'
                                  e.currentTarget.style.borderColor = 'transparent'
                                }}
                              >
                                {on
                                  ? <Check size={17} color={D.green} strokeWidth={2.5} />
                                  : <span style={{ fontSize: '15px', color: D.t3, lineHeight: 1, fontWeight: 700, userSelect: 'none' }}>—</span>
                                }
                              </button>
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

          {/* Footer actions */}
          <div style={{ padding: '16px 20px', borderTop: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: D.t3 }}>
              Los cambios se guardan en localStorage hasta conectar el backend.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <SABtn variant="ghost" onClick={() => setPlanFeats({ ...DEFAULT_PLAN_FEATURES })}>
                Restaurar defaults
              </SABtn>
              <SABtn icon={featSaved ? Check : Save} variant="primary" onClick={saveModules}>
                {featSaved ? 'Módulos guardados ✓' : 'Guardar módulos'}
              </SABtn>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal editar precio ── */}
      {editPlan && (
        <SAModal title={`Editar — ${PLANS[editPlan]?.label}`} onClose={() => setEditPlan(null)} width={360}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <FRow label="Precio base (S/ / mes)">
              <input type="number" min={0} value={prices[editPlan] ?? PLANS[editPlan]?.price ?? 0}
                onChange={e => setPrices(p => ({ ...p, [editPlan]: parseInt(e.target.value) || 0 }))}
                style={inp} />
            </FRow>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <SABtn variant="ghost" onClick={() => setEditPlan(null)}>Cancelar</SABtn>
              <SABtn variant="primary" icon={Check} onClick={() => { savePrices(); setEditPlan(null) }}>Guardar</SABtn>
            </div>
          </div>
        </SAModal>
      )}
    </div>
  )
}

// ─── TAB: HISTORIAL RENOVACIONES ─────────────────────────────────────────────
function RenovationsTab() {
  const D = useD()
  const inp = makeInp(D)
  const [renewals, setRenewals] = useState([])
  const [payments, setPayments] = useState(() => loadLocal(PAYMENTS_KEY, []))
  const [loading,  setLoading]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [filterBiz, setFilterBiz] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [tenants, setTenants] = useState([])

  const load = async () => {
    setLoading(true)
    const [r1, r2] = await Promise.all([tenantService.getRenewals(), tenantService.listAll()])
    if (r1.data) setRenewals(r1.data)
    if (r2.data) setTenants(r2.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Merge renewals with payment metadata
  const rows = renewals.map(r => {
    const pay = payments.find(p => p.renewalId === r.id) ?? {}
    const plan = PLANS[r.newPlan]
    const cycle = BILLING_CYCLES[r.billingCycle ?? 'monthly']
    const monthly = plan?.price ?? 0
    const calcAmount = Math.round(monthly * (1 - (cycle?.discountPct ?? 0) / 100)) * (cycle?.months ?? 1)
    return { ...r, method: pay.method ?? '—', receipt: pay.receipt ?? '—', amount: pay.amount ?? calcAmount, payStatus: pay.status ?? (calcAmount === 0 ? 'gratis' : 'pagado') }
  })

  const filtered = rows.filter(r => {
    if (filterBiz && r.tenantId !== filterBiz) return false
    if (filterStatus && r.payStatus !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.businessName.toLowerCase().includes(q) && !(r.receipt ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalAmount = filtered.reduce((s, r) => s + (r.amount ?? 0), 0)
  const thisMonth   = new Date().toISOString().slice(0, 7)
  const monthAmount = filtered.filter(r => (r.renewedAt ?? '').startsWith(thisMonth)).reduce((s, r) => s + (r.amount ?? 0), 0)
  const pending     = filtered.filter(r => r.payStatus === 'pendiente').length

  const PAY_STATUS = {
    pagado:  { bg: D.greenB,  color: D.green,  label: 'pagado' },
    pendiente: { bg: D.amberB, color: D.amber,  label: 'pendiente' },
    anulado: { bg: D.redB,   color: D.red,    label: 'anulado' },
    gratis:  { bg: D.border,  color: D.t3,     label: 'gratis' },
  }

  const thS = { padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: D.t3, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid ${D.border}`, background: D.card2, whiteSpace: 'nowrap' }
  const tdS = { padding: '12px 14px', borderBottom: `1px solid ${D.border}`, verticalAlign: 'middle' }

  return (
    <>
      {showModal && (
        <RegisterPaymentModal tenants={tenants} payments={payments} setPayments={setPayments}
          onClose={() => setShowModal(false)} onDone={() => { setShowModal(false); load() }} />
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatCard icon={RefreshCw}   label="Total Renovaciones" value={filtered.length} color={D.accent} />
        <StatCard icon={DollarSign}  label="Monto Total"        value={fmtMoney(totalAmount)} color={D.green} />
        <StatCard icon={History}     label="Monto Este Mes"     value={fmtMoney(monthAmount)} color={D.purple} />
        <StatCard icon={AlertTriangle} label="Pendientes de Pago" value={pending}           color={D.amber} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar empresa o comprobante..."
          style={{ ...inp, flex: 1, minWidth: '200px', background: D.card2 }} />
        <select value={filterBiz} onChange={e => setFilterBiz(e.target.value)} style={{ ...inp, width: '200px', background: D.card2 }}>
          <option value="">Todos los negocios</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.businessName}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: '160px', background: D.card2 }}>
          <option value="">Todos los estados</option>
          <option value="pagado">Pagado</option>
          <option value="pendiente">Pendiente</option>
          <option value="anulado">Anulado</option>
        </select>
        <SABtn icon={RefreshCw} variant="ghost" onClick={load} disabled={loading} style={{ padding: '9px 12px' }}>{' '}</SABtn>
        <SABtn icon={Plus} variant="primary" onClick={() => setShowModal(true)}>Registrar pago</SABtn>
      </div>

      <div style={{ fontSize: '12px', color: D.t3, marginBottom: '12px' }}>
        Mostrando {filtered.length} registro{filtered.length !== 1 ? 's' : ''} · Total filtrado: <strong style={{ color: D.green }}>{fmtMoney(totalAmount)}</strong>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1px solid ${D.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '780px' }}>
          <thead>
            <tr>{['EMPRESA', 'PLAN', 'PERÍODO', 'MONTO', 'MÉTODO', 'COMPROBANTE', 'ESTADO', ''].map(h => <th key={h} style={thS}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: D.t3, fontSize: '13px' }}>No hay registros de renovación</td></tr>
            )}
            {filtered.map((r, i) => {
              const ps = PAY_STATUS[r.payStatus] ?? PAY_STATUS.pagado
              return (
                <tr key={r.id ?? i} style={{ background: D.card }} onMouseEnter={e => e.currentTarget.style.background = D.card2} onMouseLeave={e => e.currentTarget.style.background = D.card}>
                  <td style={tdS}>
                    <div style={{ fontWeight: 600, color: D.t1, fontSize: '13px' }}>{r.businessName}</div>
                    <div style={{ fontSize: '11px', color: D.t3 }}>{fmtDate(r.renewedAt)}</div>
                  </td>
                  <td style={tdS}><PlanBadgeDark plan={r.newPlan} /></td>
                  <td style={{ ...tdS, fontSize: '12px', color: D.t2 }}>
                    <div>{fmtDate(r.accessStartDate)}</div>
                    <div style={{ color: D.t3 }}>→ {fmtDate(r.accessExpiresAt)}</div>
                  </td>
                  <td style={{ ...tdS, fontSize: '13px', fontWeight: 700, color: r.amount > 0 ? D.accent : D.t3 }}>
                    {r.amount > 0 ? `S/ ${r.amount}` : 'Gratis'}
                    <span style={{ fontSize: '10px', color: D.t3, fontWeight: 400, marginLeft: '3px' }}>PEN</span>
                  </td>
                  <td style={{ ...tdS, fontSize: '12px', color: D.t2 }}>{r.method}</td>
                  <td style={{ ...tdS, fontSize: '12px', color: D.t2, fontFamily: 'monospace' }}>{r.receipt}</td>
                  <td style={tdS}>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: ps.bg, color: ps.color }}>{ps.label}</span>
                  </td>
                  <td style={{ ...tdS, textAlign: 'right' }}>
                    <button style={{ padding: '5px 7px', borderRadius: '6px', border: `1px solid ${D.red}30`, background: D.redB, color: D.red, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function RegisterPaymentModal({ tenants, payments, setPayments, onClose, onDone }) {
  const D = useD()
  const inp = makeInp(D)
  const [form, setForm] = useState({ tenantId: '', plan: 'pro', amount: '', method: 'transferencia', receipt: '', status: 'pagado', periodStart: isoToInput(new Date().toISOString()), periodEnd: '' })
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const save = async () => {
    const newPay = {
      id: `pay_${Date.now()}`, renewalId: `manual_${Date.now()}`,
      tenantId: form.tenantId, plan: form.plan,
      periodStart: form.periodStart, periodEnd: form.periodEnd,
      amount: parseFloat(form.amount) || 0, method: form.method,
      receipt: form.receipt, status: form.status,
      createdAt: new Date().toISOString(),
    }
    const next = [...payments, newPay]
    setPayments(next); saveLocal(PAYMENTS_KEY, next)
    // Also create a renewal
    const t = tenants.find(t => t.id === form.tenantId)
    if (t) await tenantService.renewAccess(t.id, { plan: form.plan, billingCycle: 'monthly', startMode: 'today', notes: `Pago ${form.receipt}` })
    onDone()
  }

  return (
    <SAModal title="Registrar pago" onClose={onClose} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FRow label="Empresa">
            <select value={form.tenantId} onChange={set('tenantId')} style={inp}>
              <option value="">— Selecciona —</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.businessName}</option>)}
            </select>
          </FRow>
          <FRow label="Plan">
            <select value={form.plan} onChange={set('plan')} style={inp}>
              {PLAN_ORDER.map(p => <option key={p} value={p}>{PLANS[p].label}</option>)}
            </select>
          </FRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FRow label="Monto (S/)"><input type="number" value={form.amount} onChange={set('amount')} style={inp} placeholder="990" /></FRow>
          <FRow label="Método de pago">
            <select value={form.method} onChange={set('method')} style={inp}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="yape">Yape / Plin</option>
            </select>
          </FRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FRow label="N° Comprobante"><input value={form.receipt} onChange={set('receipt')} style={inp} placeholder="REC-2026-001" /></FRow>
          <FRow label="Estado">
            <select value={form.status} onChange={set('status')} style={inp}>
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </FRow>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <SABtn variant="ghost" onClick={onClose}>Cancelar</SABtn>
          <SABtn variant="primary" icon={Save} onClick={save}>Registrar</SABtn>
        </div>
      </div>
    </SAModal>
  )
}

// ─── TAB: LÍMITES DEL PLAN ────────────────────────────────────────────────────
const SUPPORT_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'chat',  label: 'Chat / Prioritario' },
  { value: 'phone', label: 'Soporte 24/7' },
]

function LimitsTab() {
  const D = useD()
  const inp = makeInp(D)
  const [limits,  setLimits]  = useState(null)
  const [selPlan, setSelPlan] = useState('trial')
  const [loading, setLoading] = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => { tenantService.getLimits().then(r => { if (r.data) setLimits(r.data) }) }, [])

  const cur = limits?.[selPlan] ?? {}

  const setVal = (field, val) => {
    setLimits(p => ({ ...p, [selPlan]: { ...p[selPlan], [field]: val } }))
  }

  const numInput = (field, label, icon = null) => (
    <FRow label={label}>
      <input
        type="number" min={-1}
        value={cur[field] === null || cur[field] === undefined ? '' : cur[field]}
        onChange={e => { const v = e.target.value === '' ? null : parseInt(e.target.value); setVal(field, v) }}
        style={inp}
        placeholder="-1 = ilimitado"
      />
      <div style={{ fontSize: '10px', color: D.t3, marginTop: '2px' }}>-1 = ilimitado</div>
    </FRow>
  )

  const save = async () => {
    setLoading(true); setError('')
    const r = await tenantService.updateLimits(limits)
    setLoading(false)
    if (r.error) { setError(r.error); return }
    setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  if (!limits) return <div style={{ textAlign: 'center', padding: '40px', color: D.t3, fontSize: '13px' }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: D.t1, margin: '0 0 4px' }}>Límites por Plan</h2>
        <p style={{ fontSize: '12px', color: D.t3, margin: 0 }}>Configura los límites operativos de cada plan SaaS</p>
      </div>

      {/* Plan tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {PLAN_ORDER.map(pid => (
          <button key={pid} onClick={() => setSelPlan(pid)} style={{ padding: '8px 18px', borderRadius: '8px', border: `1px solid ${selPlan === pid ? D.accent : D.border2}`, background: selPlan === pid ? D.accentB : D.card2, color: selPlan === pid ? D.accent : D.t2, cursor: 'pointer', fontSize: '13px', fontWeight: selPlan === pid ? 700 : 500 }}>
            {PLANS[pid].label}
          </button>
        ))}
      </div>

      {/* Plan card */}
      <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: '14px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${D.border}` }}>
          <PlanBadgeDark plan={selPlan} />
          <span style={{ fontSize: '13px', color: D.t3 }}>{PLANS[selPlan]?.description}</span>
        </div>

        <div style={{ fontSize: '11px', fontWeight: 700, color: D.t3, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '14px' }}>
          Límites Cuantitativos · (-1 = ILIMITADO)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
          {numInput('users',         'Máx. Usuarios')}
          {numInput('products',      'Máx. Productos')}
          {numInput('suppliers',     'Máx. Proveedores')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
          {numInput('customers',     'Máx. Clientes')}
          {numInput('ordersPerMonth','Máx. Órdenes/Mes')}
          {numInput('storageGB',     'Almacenamiento (GB)')}
          <FRow label="Tipo de Soporte">
            <select value={cur.supportType ?? 'email'} onChange={e => setVal('supportType', e.target.value)} style={inp}>
              {SUPPORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FRow>
        </div>

        <div style={{ fontSize: '11px', fontWeight: 700, color: D.t3, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '14px' }}>
          Funcionalidades Incluidas
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
          {[
            { key: 'apiAccess',       label: 'Acceso API',           desc: 'Permite conexión vía API REST' },
            { key: 'advancedExport',  label: 'Exportación avanzada',  desc: 'PDF, Excel, CSV con reportes personalizados' },
            { key: 'advancedReports', label: 'Reportes avanzados',    desc: 'Dashboards KPI, previsión de demanda, SUNAT' },
          ].map(({ key, label, desc }) => {
            const on = cur[key] ?? false
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${D.border}`, background: D.card2 }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: D.t1 }}>{label}</div>
                  <div style={{ fontSize: '11px', color: D.t3 }}>{desc}</div>
                </div>
                <button onClick={() => setVal(key, !on)} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: on ? D.accent : D.border2, cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: on ? '23px' : '3px', transition: 'left .2s' }} />
                </button>
              </div>
            )
          })}
        </div>

        {error && <div style={{ fontSize: '13px', color: D.red, background: D.redB, padding: '9px 12px', borderRadius: '8px', marginBottom: '14px' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SABtn icon={saved ? Check : Save} variant="primary" onClick={save} disabled={loading}>
            {saved ? 'Guardado' : `Guardar límites del plan ${PLANS[selPlan]?.label}`}
          </SABtn>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: ALERTAS DE VENCIMIENTO ──────────────────────────────────────────────
const ALERT_LEVELS = [
  { key: 'warning',  label: 'Aviso',    desc: 'Primera alerta. Indicador amarillo en el sidebar.',             icon: '⏳', color: D.amber  },
  { key: 'urgent',   label: 'Urgente',  desc: 'Segunda alerta. El indicador cambia a naranja.',                icon: '⚠️', color: D.orange },
  { key: 'critical', label: 'Crítico',  desc: 'Última alerta antes del vencimiento. Indicador rojo.',          icon: '🚨', color: D.red    },
]

function AlertsTab() {
  const D = useD()
  const inp = makeInp(D)
  const [form,    setForm]    = useState({ ...DEFAULT_ALERT_THRESHOLDS })
  const [loading, setLoading] = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => { tenantService.getAlertThresholds().then(r => { if (r.data) setForm({ ...r.data }) }) }, [])

  const isValid = form.critical >= 1 && form.urgent >= 1 && form.warning >= 1 && form.critical < form.urgent && form.urgent < form.warning

  const save = async () => {
    setLoading(true); setError('')
    const r = await tenantService.updateAlertThresholds(form)
    setLoading(false)
    if (r.error) { setError(r.error); return }
    setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: D.t1, margin: '0 0 4px' }}>Alertas de Vencimiento</h2>
          <p style={{ fontSize: '12px', color: D.t3, margin: 0 }}>Define cuántos días antes del vencimiento se activa cada nivel de alerta.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <SABtn variant="ghost" onClick={() => setForm({ ...DEFAULT_ALERT_THRESHOLDS })}>Restaurar</SABtn>
          <SABtn icon={saved ? Check : Save} variant="primary" onClick={save} disabled={loading || !isValid}>
            {saved ? 'Guardado' : 'Guardar'}
          </SABtn>
        </div>
      </div>

      <div style={{ background: D.accentB, border: `1px solid ${D.accent}30`, borderRadius: '10px', padding: '12px 16px', fontSize: '12px', color: D.accent, marginBottom: '24px' }}>
        ℹ️ Regla: <strong>Crítico &lt; Urgente &lt; Aviso</strong> · Ejemplo: 1 &lt; 3 &lt; 7 días.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {ALERT_LEVELS.map(({ key, label, desc, icon, color }) => {
          const val = form[key] ?? DEFAULT_ALERT_THRESHOLDS[key]
          const isModif = val !== DEFAULT_ALERT_THRESHOLDS[key]
          return (
            <div key={key} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', background: `${color}10`, borderBottom: `1px solid ${color}25`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>{icon}</span>
                <div>
                  <div style={{ fontWeight: 700, color: D.t1, fontSize: '13px' }}>{label}</div>
                  <div style={{ fontSize: '11px', color, marginTop: '1px' }}>Nivel {ALERT_LEVELS.findIndex(l => l.key === key) + 1}</div>
                </div>
              </div>
              <div style={{ padding: '18px' }}>
                <p style={{ fontSize: '12px', color: D.t3, margin: '0 0 14px', lineHeight: 1.55 }}>{desc}</p>
                <div style={{ position: 'relative' }}>
                  <input type="number" min={1} max={365} value={val}
                    onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) setForm(f => ({ ...f, [key]: v })) }}
                    style={{ ...inp, fontSize: '26px', fontWeight: 800, color, paddingRight: '48px', background: isModif ? `${color}08` : D.card, border: `1.5px solid ${isModif ? color : D.border2}` }}
                  />
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color, fontWeight: 600 }}>días</span>
                </div>
                <div style={{ fontSize: '11px', color: D.t3, marginTop: '6px' }}>
                  Default: <strong>{DEFAULT_ALERT_THRESHOLDS[key]} días</strong>
                  {isModif && <span style={{ color, marginLeft: '6px', fontWeight: 600 }}>✎ modificado</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Scale preview */}
      <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: '12px', padding: '16px 18px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: D.t2, marginBottom: '12px' }}>Vista previa de la escala</div>
        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${D.border}`, fontSize: '12px' }}>
          <div style={{ flex: form.warning - form.urgent, background: `${D.amber}15`, padding: '10px 12px', textAlign: 'center', color: D.amber, fontWeight: 600, minWidth: '80px' }}>
            ⏳ Aviso<br /><span style={{ fontSize: '10px', fontWeight: 400 }}>≤ {form.warning}d</span>
          </div>
          <div style={{ flex: form.urgent - form.critical, background: `${D.orange}15`, padding: '10px 12px', textAlign: 'center', color: D.orange, fontWeight: 600, borderLeft: `1px solid ${D.border}`, minWidth: '80px' }}>
            ⚠️ Urgente<br /><span style={{ fontSize: '10px', fontWeight: 400 }}>≤ {form.urgent}d</span>
          </div>
          <div style={{ flex: form.critical, background: `${D.red}15`, padding: '10px 12px', textAlign: 'center', color: D.red, fontWeight: 600, borderLeft: `1px solid ${D.border}`, minWidth: '80px' }}>
            🚨 Crítico<br /><span style={{ fontSize: '10px', fontWeight: 400 }}>≤ {form.critical}d</span>
          </div>
        </div>
        {!isValid && <div style={{ marginTop: '10px', fontSize: '12px', color: D.red, fontWeight: 500 }}>⚠ Escala no válida. Asegúrate que Crítico &lt; Urgente &lt; Aviso y todos ≥ 1.</div>}
      </div>

      {error && <div style={{ marginTop: '14px', fontSize: '13px', color: D.red, background: D.redB, padding: '10px 14px', borderRadius: '8px' }}>{error}</div>}
    </div>
  )
}

// ─── TAB: LANDING PAGE ────────────────────────────────────────────────────────

// Características por defecto del sistema (minimarket / bodega)
const DEFAULT_LANDING_FEATURES = [
  { id: 1, icon: '🛒', title: 'Punto de Venta Completo',   desc: 'Cobra rápido con efectivo, yape, plin y tarjeta. Emite tickets automáticos por cada venta.' },
  { id: 2, icon: '📦', title: 'Inventario en Tiempo Real', desc: 'Control de stock con alertas de quiebre, kardex valorizado y ajustes de inventario.' },
  { id: 3, icon: '📊', title: 'Reportes y KPIs',           desc: 'Dashboards de ventas diarias, semanales y mensuales. Productos más vendidos y rentabilidad.' },
  { id: 4, icon: '🧾', title: 'Comprobantes SUNAT',        desc: 'Emite boletas y facturas electrónicas con validación automática integrada.' },
  { id: 5, icon: '👥', title: 'Multi-usuario con Roles',   desc: 'Asigna permisos diferenciados a cajeros, supervisores y administradores.' },
  { id: 6, icon: '🎯', title: 'Programa de Fidelidad',     desc: 'Acumula puntos por compra y premia a tus clientes frecuentes automáticamente.' },
]

// Modal para agregar / editar característica
function FeatEditModal({ mode, initial, onClose, onSave }) {
  const D = useD()
  const inp = makeInp(D)
  const [form, setForm] = useState({ ...initial })
  const s = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  return (
    <SAModal title={mode === 'add' ? 'Nueva característica' : 'Editar característica'} onClose={onClose} width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <FRow label="Ícono (emoji)">
          <input value={form.icon ?? ''} onChange={s('icon')} maxLength={4} placeholder="🛒"
            style={{ ...inp, background: D.card2, fontSize: '22px', textAlign: 'center', width: '80px' }} />
        </FRow>
        <FRow label="Título">
          <input value={form.title ?? ''} onChange={s('title')} placeholder="Nombre de la característica"
            style={{ ...inp, background: D.card2, width: '100%', boxSizing: 'border-box' }} />
        </FRow>
        <FRow label="Descripción">
          <textarea value={form.desc ?? ''} onChange={s('desc')} rows={3}
            style={{ ...inp, resize: 'vertical', background: D.card2, width: '100%', boxSizing: 'border-box' }}
            placeholder="Descripción breve de la funcionalidad..." />
        </FRow>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
          <SABtn variant="ghost" onClick={onClose}>Cancelar</SABtn>
          <SABtn variant="primary" icon={Save} onClick={() => onSave(form)} disabled={!form.title?.trim()}>
            {mode === 'add' ? 'Agregar' : 'Guardar cambios'}
          </SABtn>
        </div>
      </div>
    </SAModal>
  )
}

const LANDING_SUBTABS = [
  { id: 'site',     label: 'Sitio',             icon: Settings },
  { id: 'hero',     label: 'Sección Hero',      icon: Star },
  { id: 'features', label: 'Características',   icon: Package },
  { id: 'contact',  label: 'Contacto & Redes',  icon: Phone },
  { id: 'seo',      label: 'SEO & Footer',      icon: FileText },
]

function LandingTab({ onBrandUpdate }) {
  const D = useD()
  const inp = makeInp(D)
  const [siteForm,    setSiteForm]    = useState({})
  const [loading,     setLoading]     = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [sub,         setSub]         = useState('site')
  const [featModal,   setFeatModal]   = useState(null)   // null | { mode, item?, idx? }
  const [hoveredFeat, setHoveredFeat] = useState(null)

  useEffect(() => { tenantService.getSiteSettings().then(r => { if (r.data) setSiteForm(r.data) }) }, [])

  const set = (k) => (e) => setSiteForm(f => ({ ...f, [k]: e.target.value }))

  const saveAll = async () => {
    setLoading(true)
    await tenantService.updateSiteSettings(siteForm)
    setLoading(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
    if (onBrandUpdate && siteForm.brandName?.trim()) onBrandUpdate(siteForm.brandName.trim())
  }

  const Field = ({ k, label, placeholder, type = 'text', icon: Icon }) => (
    <FRow label={label}>
      <div style={{ position: 'relative' }}>
        {Icon && <Icon size={14} color={D.t3} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />}
        <input type={type} value={siteForm[k] ?? ''} onChange={set(k)} placeholder={placeholder}
          style={{ ...inp, paddingLeft: Icon ? '33px' : '12px', background: D.card2 }} />
      </div>
    </FRow>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: D.t1, margin: '0 0 4px' }}>Configuración del Sitio Web / Landing Page</h2>
          <p style={{ fontSize: '12px', color: D.t3, margin: 0 }}>Esta información se usará para publicar y promocionar el sistema</p>
        </div>
        <SABtn icon={saved ? Check : Save} variant="primary" onClick={saveAll} disabled={loading}>
          {saved ? 'Todo guardado' : 'Guardar todo'}
        </SABtn>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: `1px solid ${D.border}`, paddingBottom: '0' }}>
        {LANDING_SUBTABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSub(id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px 8px 0 0', border: 'none', background: sub === id ? D.card : 'transparent', color: sub === id ? D.accent : D.t3, cursor: 'pointer', fontSize: '13px', fontWeight: sub === id ? 700 : 500, borderBottom: sub === id ? `2px solid ${D.accent}` : '2px solid transparent', marginBottom: '-1px' }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: '14px', padding: '24px' }}>
        {sub === 'site' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: D.t3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Información General del Sitio</div>
            <FRow label="Nombre del Producto / Marca">
              <input value={siteForm.brandName ?? ''} onChange={set('brandName')} placeholder="StockPro" style={{ ...inp, background: D.card2 }} />
            </FRow>
            <FRow label="Tagline">
              <input value={siteForm.tagline ?? ''} onChange={set('tagline')} placeholder="Logística inteligente para tu empresa" style={{ ...inp, background: D.card2 }} />
            </FRow>
            <FRow label="Descripción">
              <textarea value={siteForm.description ?? ''} onChange={set('description')} rows={3}
                style={{ ...inp, resize: 'vertical', background: D.card2 }} placeholder="Describe el sistema..." />
            </FRow>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <FRow label="Color Primario">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="color" value={siteForm.primaryColor ?? '#00c896'} onChange={set('primaryColor')}
                    style={{ width: '44px', height: '36px', borderRadius: '6px', border: `1px solid ${D.border2}`, background: 'none', cursor: 'pointer', padding: '2px' }} />
                  <input value={siteForm.primaryColor ?? ''} onChange={set('primaryColor')}
                    style={{ ...inp, background: D.card2 }} placeholder="#00c896" />
                </div>
              </FRow>
              <Field k="logoUrl" label="URL del Logo" placeholder="https://..." icon={Link2} />
            </div>
          </div>
        )}

        {sub === 'hero' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: D.t3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Sección Hero (Portada Principal)</div>

            <Field k="heroTitle"    label="Título principal"
              placeholder="Controla tu negocio con precisión" />
            <FRow label="Subtítulo">
              <textarea value={siteForm.heroSubtitle ?? ''} onChange={set('heroSubtitle')} rows={2}
                style={{ ...inp, resize: 'vertical', background: D.card2 }}
                placeholder="Sistema POS completo para bodegas y minimarkets. Gestiona ventas, inventario y clientes desde un solo lugar." />
            </FRow>

            {/* CTA Principal */}
            <div style={{ fontSize: '11px', fontWeight: 700, color: D.t3, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>CTA Principal</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field k="heroCtaText"  label="CTA Principal — Texto" placeholder="Comenzar prueba gratis" />
              <Field k="heroCtaUrl"   label="CTA Principal — URL"   placeholder="#planes" icon={Link2} />
            </div>

            {/* CTA Secundario */}
            <div style={{ fontSize: '11px', fontWeight: 700, color: D.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CTA Secundario</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field k="heroCtaSecText" label="CTA Secundario — Texto" placeholder="Ver demo en vivo" />
              <Field k="heroCtaSecUrl"  label="CTA Secundario — URL"   placeholder="#demo" icon={Link2} />
            </div>

            <Field k="heroImage" label="URL de imagen hero" placeholder="https://.../hero.png" icon={Link2} />
          </div>
        )}

        {sub === 'features' && (() => {
          const feats   = siteForm.features?.length ? siteForm.features : DEFAULT_LANDING_FEATURES
          const setFeats = (next) => setSiteForm(f => ({ ...f, features: next }))
          return (
            <div>
              {/* Header de la sección */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: D.t3 }}>Funcionalidades destacadas que aparecerán en el sitio web</div>
                <button
                  onClick={() => setFeatModal({ mode: 'add' })}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: `1px solid ${D.border2}`, background: D.card2, color: D.t2, cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'inherit' }}
                >
                  <Plus size={13} /> Agregar
                </button>
              </div>

              {/* Grid de tarjetas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {feats.map((feat, idx) => (
                  <div
                    key={feat.id ?? idx}
                    onMouseEnter={() => setHoveredFeat(idx)}
                    onMouseLeave={() => setHoveredFeat(null)}
                    style={{
                      position: 'relative', background: D.card2,
                      border: `1px solid ${hoveredFeat === idx ? D.border2 : D.border}`,
                      borderRadius: '12px', padding: '16px 18px', transition: 'border-color .15s',
                    }}
                  >
                    {/* Botones editar / eliminar (visibles al hover) */}
                    <div style={{
                      position: 'absolute', top: '10px', right: '10px',
                      display: 'flex', gap: '4px',
                      opacity: hoveredFeat === idx ? 1 : 0,
                      pointerEvents: hoveredFeat === idx ? 'auto' : 'none',
                      transition: 'opacity .15s',
                    }}>
                      <button
                        onClick={() => setFeatModal({ mode: 'edit', item: { ...feat }, idx })}
                        style={{ padding: '5px', borderRadius: '6px', border: `1px solid ${D.border2}`, background: D.card, color: D.t2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => setFeats(feats.filter((_, i) => i !== idx))}
                        style={{ padding: '5px', borderRadius: '6px', border: `1px solid ${D.red}30`, background: D.redB, color: D.red, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Contenido de la tarjeta */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ fontSize: '28px', lineHeight: 1, flexShrink: 0 }}>{feat.icon}</div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: D.t1, marginBottom: '5px', paddingRight: hoveredFeat === idx ? '52px' : '0', transition: 'padding .1s' }}>
                          {feat.title}
                        </div>
                        <div style={{ fontSize: '12px', color: D.t3, lineHeight: '1.55' }}>{feat.desc}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal agregar / editar */}
              {featModal && (
                <FeatEditModal
                  mode={featModal.mode}
                  initial={featModal.item ?? { icon: '⭐', title: '', desc: '' }}
                  onClose={() => setFeatModal(null)}
                  onSave={(item) => {
                    if (featModal.mode === 'add') {
                      setFeats([...feats, { ...item, id: Date.now() }])
                    } else {
                      setFeats(feats.map((x, i) => i === featModal.idx ? { ...x, ...item } : x))
                    }
                    setFeatModal(null)
                  }}
                />
              )}
            </div>
          )
        })()}

        {sub === 'contact' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: D.t3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Contacto</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field k="phone"    label="Teléfono de soporte" placeholder="+51 999 888 777"         icon={Phone} />
              <Field k="whatsapp" label="WhatsApp"            placeholder="+51 999 888 777"         icon={MessageCircle} />
              <Field k="email"    label="Correo de contacto"  placeholder="soporte@sistema.com"     icon={Mail} />
              <Field k="address"  label="Dirección / ciudad"  placeholder="Lima, Perú"              icon={MapPin} />
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: D.t3, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '4px 0' }}>Redes Sociales</div>
            <p style={{ fontSize: '12px', color: D.t3, margin: '-8px 0 0' }}>Deja vacío para ocultar el enlace en el footer.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
              <Field k="facebook"  label="Facebook"  placeholder="https://facebook.com/..." icon={Globe} />
              <Field k="instagram" label="Instagram" placeholder="https://instagram.com/..." icon={Globe} />
              <Field k="tiktok"    label="TikTok"    placeholder="https://tiktok.com/..."   icon={Globe} />
            </div>
          </div>
        )}

        {sub === 'seo' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>

            {/* ── Columna izquierda: SEO y Metadatos ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: D.t3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>SEO y Metadatos</div>

              <FRow label="Meta Título">
                <div style={{ fontSize: '11px', color: D.t3, marginBottom: '5px' }}>Aparece en la pestaña del navegador y en Google</div>
                <input value={siteForm.metaTitle ?? ''} onChange={set('metaTitle')}
                  style={{ ...inp, background: D.card2 }}
                  placeholder="MiniMarket POS — Sistema de Punto de Venta" />
              </FRow>

              <FRow label="Meta Descripción">
                <div style={{ fontSize: '11px', color: D.t3, marginBottom: '5px' }}>
                  Texto que aparece bajo el título en los resultados de búsqueda (160 chars)
                </div>
                <textarea value={siteForm.metaDesc ?? ''} onChange={set('metaDesc')} rows={3}
                  style={{ ...inp, resize: 'vertical', background: D.card2 }}
                  placeholder="Gestiona tu bodega o minimarket con nuestro sistema POS. Control de inventario, ventas, clientes y reportes. Prueba gratis por 30 días." />
                <div style={{ fontSize: '11px', color: (siteForm.metaDesc ?? '').length > 160 ? D.red : D.t3, textAlign: 'right', marginTop: '4px' }}>
                  {(siteForm.metaDesc ?? '').length}/160
                </div>
              </FRow>

              <FRow label="Keywords">
                <div style={{ fontSize: '11px', color: D.t3, marginBottom: '5px' }}>Separadas por coma</div>
                <input value={siteForm.seoKeywords ?? ''} onChange={set('seoKeywords')}
                  style={{ ...inp, background: D.card2 }}
                  placeholder="pos minimarket, sistema bodega, punto de venta perú, control inventario" />
              </FRow>
            </div>

            {/* ── Columna derecha: Footer y Configuración General ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: D.t3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Footer y Configuración General</div>

              <FRow label="Texto Legal del Footer">
                <textarea value={siteForm.footerText ?? ''} onChange={set('footerText')} rows={2}
                  style={{ ...inp, resize: 'vertical', background: D.card2 }}
                  placeholder="© 2026 MiniMarket POS. Todos los derechos reservados." />
              </FRow>

              {/* Toggle: Mostrar precios públicamente */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${D.border}`, background: D.card2 }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: D.t1 }}>Mostrar precios públicamente</div>
                  <div style={{ fontSize: '11px', color: D.t3, marginTop: '2px' }}>Tabla de precios visible en el sitio</div>
                </div>
                <div
                  onClick={() => setSiteForm(f => ({ ...f, showPricesPublic: !f.showPricesPublic }))}
                  style={{
                    width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
                    background: siteForm.showPricesPublic ? D.accent : D.border2,
                    position: 'relative', transition: 'background .2s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '3px',
                    left: siteForm.showPricesPublic ? '23px' : '3px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: '#fff', transition: 'left .2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }} />
                </div>
              </div>

              {/* Moneda pública */}
              <FRow label="Moneda Pública">
                <select value={siteForm.publicCurrency ?? 'PEN'} onChange={set('publicCurrency')}
                  style={{ ...inp, background: D.card2, cursor: 'pointer' }}>
                  <option value="PEN">PEN — Soles peruanos (S/)</option>
                  <option value="USD">USD — Dólares americanos ($)</option>
                  <option value="EUR">EUR — Euros (€)</option>
                </select>
              </FRow>

              {/* Días de prueba gratuita */}
              <FRow label="Días de Prueba Gratuita">
                <input type="number" min={1} max={90} value={siteForm.trialDays ?? 30} onChange={set('trialDays')}
                  style={{ ...inp, background: D.card2 }} />
              </FRow>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: `1px solid ${D.border}` }}>
          <SABtn icon={saved ? Check : Save} variant="primary" onClick={saveAll} disabled={loading}>
            {saved ? 'Guardado' : `Guardar configuración de landing`}
          </SABtn>
        </div>
      </div>
    </div>
  )
}

// ─── SUPERADMIN PRINCIPAL ─────────────────────────────────────────────────────
export default function SuperAdmin() {
  const navigate = useNavigate()
  const [auth,      setAuth]      = useState(() => sessionStorage.getItem('sa_auth') === '1')
  const [tab,       setTab]       = useState('tenants')
  const [stats,     setStats]     = useState({ total: 0, active: 0, trial: 0, expiring: 0 })
  const [brandName, setBrandName] = useState('StockPro')
  const { theme, toggle, setDirect } = useTheme()
  const D = useMemo(() => D_THEMES[theme] ?? D_THEMES.ocean, [theme])

  const loadStats = useCallback(async () => {
    const r = await tenantService.listAll()
    if (!r.data) return
    setStats({
      total:    r.data.length,
      active:   r.data.filter(t => getAccessStatus(t.accessExpiresAt, t.isActive) === 'active').length,
      trial:    r.data.filter(t => getAccessStatus(t.accessExpiresAt, t.isActive) === 'trial').length,
      expiring: r.data.filter(t => { const d = daysUntilExpiry(t.accessExpiresAt); return d !== null && d >= 0 && d <= 30 }).length,
    })
  }, [])

  // Carga el brandName guardado al iniciar sesión
  useEffect(() => {
    if (auth) {
      loadStats()
      tenantService.getSiteSettings().then(r => {
        if (r.data?.brandName?.trim()) setBrandName(r.data.brandName.trim())
      })
    }
  }, [auth, loadStats])

  const handleLogin = () => { sessionStorage.setItem('sa_auth', '1'); setAuth(true) }
  const handleLogout = () => { sessionStorage.removeItem('sa_auth'); setAuth(false) }

  if (!auth) return (
    <DContext.Provider value={D}>
      <LoginFormV2 onLogin={handleLogin} />
    </DContext.Provider>
  )

  const TAB_TITLES = {
    tenants:  'Panel de Administración',
    plans:    'Planes y Precios',
    renewals: 'Historial de Renovaciones',
    limits:   'Límites del Plan',
    alerts:   'Alertas de Vencimiento',
    landing:  'Landing Page',
  }

  return (
    <DContext.Provider value={D}>
    <div style={{ display: 'flex', height: '100vh', background: D.bg, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", color: D.t1, overflow: 'hidden' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${D.bg}; }
        ::-webkit-scrollbar-thumb { background: ${D.border2}; border-radius: 3px; }
      `}</style>

      <SASidebar activeTab={tab} onTabChange={setTab} onLogout={handleLogout} theme={theme} onThemeToggle={toggle} onThemeSet={setDirect} brandName={brandName} />

      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Top header */}
        <div style={{ background: D.sidebar, borderBottom: `1px solid ${D.border}`, padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: D.t1, margin: '0 0 2px' }}>{TAB_TITLES[tab]}</h1>
            <div style={{ fontSize: '12px', color: D.t3, display: 'flex', gap: '12px' }}>
              <span>🟢 {stats.active} activos</span>
              <span>🟡 {stats.trial} en trial</span>
              <span>🔴 {stats.expiring} por vencer</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', border: `1px solid ${D.border2}`, background: 'transparent', color: D.t2, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
              <ExternalLink size={12} /> Landing
            </button>
            <button
              onClick={() => { if (window.prompt('Escribe RESET para borrar los datos de prueba:') === 'RESET') { tenantService._resetMock?.(); loadStats(); window.location.reload() } }}
              style={{ padding: '7px 10px', borderRadius: '8px', border: `1px solid ${D.border2}`, background: 'transparent', color: D.t3, cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px' }}
              title="Reset datos de prueba">
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '28px' }}>
          {tab === 'tenants'  && <TenantsTab onStatsRefresh={loadStats} />}
          {tab === 'plans'    && <PlansTab />}
          {tab === 'renewals' && <RenovationsTab />}
          {tab === 'limits'   && <LimitsTab />}
          {tab === 'alerts'   && <AlertsTab />}
          {tab === 'landing'  && <LandingTab onBrandUpdate={setBrandName} />}
        </div>
      </main>
    </div>
    </DContext.Provider>
  )
}
