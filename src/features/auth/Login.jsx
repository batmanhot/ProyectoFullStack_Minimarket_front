import { useState, useEffect } from 'react'
import { useStore } from '../../store/index'
import { authService } from '../../services/index'
import { ROLES } from '../../config/app'
import { PLANS } from '../../config/plans'
import { useTenantSafe } from '../../context/TenantContext'
import logo from '../../assets/logo.png'
import toast from 'react-hot-toast'

const ALL_DEMO_ROLES = [
  { role: 'admin',      icon: '🛡️', desc: 'Acceso total al sistema' },
  { role: 'gerente',    icon: '👔', desc: 'Gestión y reportes'      },
  { role: 'supervisor', icon: '👁️', desc: 'Control operativo'       },
  { role: 'cajero',     icon: '🖥️', desc: 'Punto de venta'          },
]

const FEATURES = [
  { icon: '🖥️', label: 'Punto de Venta',  desc: 'Yape, Plin, tarjeta, mixto'      },
  { icon: '📦', label: 'Inventario',       desc: 'Control de stock en tiempo real'  },
  { icon: '📊', label: 'Reportes',         desc: 'KPIs y análisis de negocio'       },
  { icon: '👥', label: 'Clientes',         desc: 'Crédito y cobranza integrada'     },
  { icon: '🏭', label: 'Proveedores',      desc: 'Compras y entradas de mercadería' },
  { icon: '🔍', label: 'Auditoría',        desc: 'Trazabilidad completa'            },
]

const SECTORS = ['Bodega', 'Farmacia', 'Ferretería', 'Boutique', 'Panadería', 'Electrónica', 'Librería', 'Calzado']

const ROLE_COLORS = {
  admin:      { bg: 'rgba(59,130,246,0.18)',  border: 'rgba(59,130,246,0.50)',  text: '#93c5fd' },
  gerente:    { bg: 'rgba(139,92,246,0.18)',  border: 'rgba(139,92,246,0.50)',  text: '#c4b5fd' },
  supervisor: { bg: 'rgba(245,158,11,0.18)',  border: 'rgba(245,158,11,0.50)',  text: '#fcd34d' },
  cajero:     { bg: 'rgba(34,197,94,0.18)',   border: 'rgba(34,197,94,0.50)',   text: '#86efac' },
}

export default function Login() {
  const { setCurrentUser, businessConfig } = useStore()
  const tenantCtx   = useTenantSafe()
  const tenantSlug  = tenantCtx?.tenantSlug ?? 'demo'
  const businessName = tenantCtx?.tenant?.businessName ?? businessConfig?.name

  const plan           = tenantCtx?.plan ?? 'trial'
  const availableRoles = PLANS[plan]?.availableRoles ?? ['admin']
  const planLabel      = PLANS[plan]?.label ?? 'Prueba gratuita'

  const DEMO_ROLES = ALL_DEMO_ROLES.filter(r => availableRoles.includes(r.role))

  const [loading, setLoading]       = useState(false)
  const [username, setUsername]     = useState('')
  const [activeRole, setActiveRole] = useState(null)
  const [tick, setTick]             = useState(0)
  const [hovered, setHovered]       = useState(null)

  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % FEATURES.length), 2800)
    return () => clearInterval(id)
  }, [])

  const handleDemoLogin = async (role) => {
    if (loading) return
    setActiveRole(role)
    setLoading(true)
    const result = await authService.login(role, tenantSlug)
    if (result.data) {
      setCurrentUser(result.data)
      toast.success(`Bienvenido, ${result.data.fullName}`, {
        style: { background: '#0f172a', color: '#fff', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)' },
      })
    } else {
      toast.error(result.error)
      setActiveRole(null)
    }
    setLoading(false)
  }

  const handleManualLogin = async (e) => {
    e.preventDefault()
    if (!username.trim() || loading) return
    setLoading(true)
    const result = await authService.loginWithCredentials(username.trim(), tenantSlug)
    if (result.data) {
      setCurrentUser(result.data)
      toast.success(`Bienvenido, ${result.data.fullName}`)
    } else {
      toast.error(result.error)
    }
    setLoading(false)
  }

  const baseFont = "'Segoe UI', system-ui, -apple-system, sans-serif"

  return (
    <>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeLeft{ from { opacity:0; transform:translateX(-20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes featIn  { from { opacity:0; transform:translateX(8px)  } to { opacity:1; transform:translateX(0) } }

        * { box-sizing: border-box; }

        /* ── Contenedor raíz: dos columnas ── */
        .login-root {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: stretch;
          position: relative;
          overflow: hidden;
          font-family: ${baseFont};
        }

        /* ── Fondo ── */
        .login-bg {
          position: absolute; inset: 0;
          background-image: url(/bg_login.png);
          background-size: cover;
          background-position: center 30%;
          filter: brightness(0.52) saturate(0.85);
        }

        /* Overlay izquierdo — refuerza legibilidad del panel izquierdo */
        .login-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(
            105deg,
            rgba(2,8,26,0.68) 0%,
            rgba(2,8,26,0.40) 45%,
            rgba(2,8,26,0.20) 100%
          );
        }
        .login-dots {
          position: absolute; inset: 0; opacity: 0.022;
          background-image: radial-gradient(circle, #fff 1px, transparent 1px);
          background-size: 28px 28px;
        }

        /* ══ PANEL IZQUIERDO ══ */
        .login-left {
          position: relative; z-index: 2;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 52px 0 52px 6%;
          animation: fadeLeft .55s ease both;
        }

        .left-brand {
          display: flex; align-items: center; gap: 14px;
          margin-bottom: 36px;
        }
        .left-brand-logo {
          width: 58px; height: 58px;
          border-radius: 16px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.15);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          box-shadow: 0 8px 28px rgba(0,0,0,0.30);
          flex-shrink: 0;
        }
        .left-brand-name {
          font-size: 26px; font-weight: 900;
          color: #fff; margin: 0 0 3px;
          letter-spacing: -0.6px; line-height: 1.1;
          text-shadow: 0 2px 12px rgba(0,0,0,0.40);
        }
        .left-brand-sub {
          font-size: 13px; font-weight: 700;
          background: linear-gradient(90deg, #38bdf8, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }

        .left-headline {
          font-size: 44px; font-weight: 900;
          color: #fff; margin: 0 0 10px;
          line-height: 1.08; letter-spacing: -2px;
          text-shadow: 0 4px 24px rgba(0,0,0,0.45);
          max-width: 520px;
        }
        .left-tagline {
          font-size: 15px; color: rgba(255,255,255,0.55);
          margin: 0 0 36px; line-height: 1.6;
          max-width: 440px;
        }

        .left-features {
          display: flex; flex-direction: column;
          gap: 11px; margin-bottom: 36px;
          max-width: 400px;
        }
        .left-feat-row {
          display: flex; align-items: center; gap: 13px;
        }
        .left-feat-icon {
          width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0;
          background: rgba(255,255,255,0.09);
          border: 1px solid rgba(255,255,255,0.12);
          display: flex; align-items: center; justify-content: center;
          font-size: 17px;
        }
        .left-feat-label {
          font-size: 13px; font-weight: 700;
          color: rgba(255,255,255,0.90); margin-bottom: 1px;
        }
        .left-feat-desc {
          font-size: 11px; color: rgba(255,255,255,0.40);
        }

        .left-sectors {
          display: flex; flex-wrap: wrap; gap: 6px;
          max-width: 420px;
        }
        .left-sector-pill {
          font-size: 11px; color: rgba(255,255,255,0.45);
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 20px; padding: 4px 11px;
          font-weight: 500;
        }

        /* ══ PANEL DERECHO — wrapper ══ */
        .login-right-wrap {
          position: relative; z-index: 2;
          display: flex;
          align-items: center;
          padding: 28px 4% 28px 20px;
          flex-shrink: 0;
        }

        /* ── Card ── */
        .login-card {
          width: 100%;
          max-width: 420px;
          background: rgba(4,10,28,0.82);
          border: 1px solid rgba(255,255,255,0.13);
          border-radius: 24px;
          padding: 28px 26px 22px;
          backdrop-filter: blur(36px);
          -webkit-backdrop-filter: blur(36px);
          box-shadow: 0 32px 96px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.08) inset;
          animation: fadeUp .45s ease both;
        }

        /* ── Cabecera de marca (compacta) ── */
        .brand-header {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 6px;
        }
        .brand-logo {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: rgba(255,255,255,0.08);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(0,0,0,0.20);
          flex-shrink: 0;
        }
        .brand-name {
          font-size: 18px; font-weight: 800;
          color: #fff; margin: 0 0 2px;
          letter-spacing: -0.4px; line-height: 1.1;
        }
        .brand-sub {
          font-size: 11px; font-weight: 700;
          background: linear-gradient(90deg, #38bdf8, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }
        .brand-badge {
          margin-left: auto; flex-shrink: 0;
          display: inline-flex; align-items: center; gap: 5px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.11);
          border-radius: 20px; padding: 4px 10px;
          font-size: 9px; color: rgba(255,255,255,0.40);
          font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
          white-space: nowrap;
        }

        /* ── Feature pill rotativa ── */
        .feat-pill {
          display: flex; align-items: center; gap: 10px;
          background: rgba(56,189,248,0.06);
          border: 1px solid rgba(56,189,248,0.16);
          border-radius: 11px;
          padding: 9px 12px;
          margin: 12px 0;
          animation: featIn .35s ease both;
        }
        .feat-pill-icon {
          width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
          background: linear-gradient(135deg, #38bdf8, #6366f1);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px;
        }
        .feat-pill-text { flex: 1; min-width: 0; }
        .feat-pill-label { font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 1px; }
        .feat-pill-desc  { font-size: 10px; color: rgba(255,255,255,0.50); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .feat-dots { display: flex; gap: 4px; flex-shrink: 0; align-items: center; }

        .section-sep {
          height: 1px;
          background: rgba(255,255,255,0.07);
          margin: 14px 0;
        }

        /* ── Acceso rápido — demo section ── */
        .demo-section {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 13px 13px 11px;
          margin-bottom: 4px;
        }
        .quick-label {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 10px;
        }
        .quick-label-text {
          font-size: 10px; font-weight: 700;
          color: rgba(255,255,255,0.30);
          letter-spacing: .10em; text-transform: uppercase; margin: 0;
        }
        .plan-chip {
          font-size: 9px; color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 20px; padding: 2px 8px; font-weight: 600;
        }

        /* ── Botones de rol ── */
        .role-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
        }
        .role-btn {
          display: flex; flex-direction: column;
          align-items: flex-start; gap: 2px;
          padding: 10px 11px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 11px;
          cursor: pointer;
          transition: background .18s, border-color .18s, transform .12s;
          text-align: left; width: 100%;
        }
        .role-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .role-btn:active:not(:disabled) { transform: translateY(0); }
        .role-btn:disabled { opacity: .45; cursor: not-allowed; }

        /* ── Login manual — sección principal ── */
        .login-section {
          margin-top: 4px;
        }

        .divider {
          display: flex; align-items: center; gap: 10px;
          margin: 14px 0 12px;
        }
        .divider-line { flex:1; height:1px; background:rgba(255,255,255,0.08); }
        .divider-text {
          font-size: 10px; color: rgba(255,255,255,0.22);
          font-weight: 600; letter-spacing:.08em; text-transform:uppercase;
          white-space: nowrap;
        }

        .login-input {
          width: 100%;
          padding: 12px 14px 12px 38px;
          background: rgba(255,255,255,0.07);
          border: 1.5px solid rgba(255,255,255,0.13);
          border-radius: 11px;
          font-size: 13px; color: #fff;
          outline: none;
          transition: border-color .2s, box-shadow .2s;
          font-family: ${baseFont};
        }
        .login-input::placeholder { color: rgba(255,255,255,0.28); }
        .login-input:focus {
          border-color: rgba(56,189,248,0.65);
          box-shadow: 0 0 0 3px rgba(56,189,248,0.12);
        }

        .login-submit {
          width: 100%;
          padding: 13px;
          border-radius: 11px;
          font-size: 14px; font-weight: 700;
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: opacity .2s, transform .12s, box-shadow .2s;
          font-family: ${baseFont};
          margin-top: 9px;
        }
        .login-submit.active {
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          color: #fff;
          box-shadow: 0 6px 24px rgba(37,99,235,0.40);
        }
        .login-submit.active:hover  { opacity: .92; }
        .login-submit.active:active { transform: scale(.98); }
        .login-submit.inactive {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.09);
          color: rgba(255,255,255,0.25);
          cursor: not-allowed;
        }

        .card-footer {
          margin-top: 14px;
          padding: 9px 12px;
          background: rgba(255,255,255,0.03);
          border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .footer-note {
          font-size: 10px; color: rgba(255,255,255,0.22);
          text-align: center; margin: 0; line-height: 1.65;
        }

        .spin { animation: spin .9s linear infinite; }

        /* ── Responsive: tablet/móvil — ocultar panel izquierdo ── */
        @media (max-width: 900px) {
          .login-left { display: none; }
          .login-root  { justify-content: center; }
          .login-right-wrap {
            padding: 20px 16px;
            width: 100%;
            justify-content: center;
          }
          .login-card { max-width: 440px; }
        }

        @media (max-width: 480px) {
          .login-card { padding: 22px 16px 18px; border-radius: 20px; }
          .brand-name { font-size: 17px; }
          .role-grid  { gap: 6px; }
        }
      `}</style>

      <div className="login-root">
        <div className="login-bg"/>
        <div className="login-overlay"/>
        <div className="login-dots"/>

        {/* ══ PANEL IZQUIERDO — propuesta de valor ══════════════════════════ */}
        <div className="login-left">

          {/* Marca */}
          <div className="left-brand">
            <div className="left-brand-logo">
              <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
            <div>
              <p className="left-brand-name">{businessName || 'POS Pro'}</p>
              <p className="left-brand-sub">Gestión inteligente</p>
            </div>
          </div>

          {/* Titular */}
          <h1 className="left-headline">
            Todo tu negocio<br/>
            <span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
              en un solo sistema
            </span>
          </h1>
          <p className="left-tagline">
            POS completo para bodegas, farmacias, ferreterías y más.<br/>
            Ventas, inventario, reportes y fidelización — todo integrado.
          </p>

          {/* Características */}
          <div className="left-features">
            {FEATURES.map(f => (
              <div key={f.label} className="left-feat-row">
                <div className="left-feat-icon">{f.icon}</div>
                <div>
                  <div className="left-feat-label">{f.label}</div>
                  <div className="left-feat-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Sectores */}
          <div className="left-sectors">
            {SECTORS.map(s => (
              <span key={s} className="left-sector-pill">{s}</span>
            ))}
          </div>
        </div>

        {/* ══ PANEL DERECHO — login card ════════════════════════════════════ */}
        <div className="login-right-wrap">
          <div className="login-card">

            {/* ── CABECERA ─────────────────────────────────────────────── */}
            <div className="brand-header">
              <div className="brand-logo">
                <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="brand-name">{businessName || 'POS Pro'}</p>
                <p className="brand-sub">Gestión inteligente</p>
              </div>
              <span className="brand-badge">🛒 Sistema POS</span>
            </div>

            {/* ── FEATURE PILL ROTATIVA (visible en móvil) ─────────────── */}
            <div className="feat-pill" key={tick}>
              <div className="feat-pill-icon">{FEATURES[tick].icon}</div>
              <div className="feat-pill-text">
                <div className="feat-pill-label">{FEATURES[tick].label}</div>
                <div className="feat-pill-desc">{FEATURES[tick].desc}</div>
              </div>
              <div className="feat-dots">
                {FEATURES.map((_, i) => (
                  <div key={i} style={{
                    width: i === tick ? '16px' : '5px',
                    height: '5px', borderRadius: '3px',
                    background: i === tick ? '#38bdf8' : 'rgba(255,255,255,0.18)',
                    transition: 'all .3s ease',
                  }}/>
                ))}
              </div>
            </div>

            <div className="section-sep"/>

            {/* ── ACCESO RÁPIDO — sección demo ─────────────────────────── */}
            <div className="demo-section">
              <div className="quick-label">
                <p className="quick-label-text">Acceso rápido — Demo</p>
                <span className="plan-chip">Plan {planLabel}</span>
              </div>

              <div className="role-grid">
                {DEMO_ROLES.map(({ role, icon, desc }) => {
                  const cfg  = ROLES[role]
                  const c    = ROLE_COLORS[role]
                  const isAct = activeRole === role && loading
                  const isHov = hovered === role && !loading
                  return (
                    <button
                      key={role}
                      className="role-btn"
                      disabled={loading}
                      onClick={() => handleDemoLogin(role)}
                      onMouseEnter={() => setHovered(role)}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        background:  (isAct || isHov) ? c.bg     : 'rgba(255,255,255,0.04)',
                        borderColor: (isAct || isHov) ? c.border : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px' }}>{icon}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: (isAct||isHov) ? c.text : 'rgba(255,255,255,0.80)' }}>
                          {cfg.label}
                        </span>
                        {isAct && (
                          <svg className="spin" style={{ width:'11px', height:'11px', marginLeft:'auto', color: c.text }} fill="none" viewBox="0 0 24 24">
                            <circle style={{opacity:.25}} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path style={{opacity:.75}} fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                        )}
                      </div>
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', paddingLeft: '1px' }}>{desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── LOGIN MANUAL — sección principal ─────────────────────── */}
            <div className="login-section">
              <div className="divider">
                <div className="divider-line"/>
                <span className="divider-text">o ingresa tu usuario</span>
                <div className="divider-line"/>
              </div>

              <form onSubmit={handleManualLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                <div style={{ position: 'relative' }}>
                  <svg style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', width:'14px', height:'14px', opacity:.3, pointerEvents:'none' }} fill="none" viewBox="0 0 24 24" stroke="white">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  <input
                    className="login-input"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin, cajero1, gerente..."
                    autoComplete="username"
                  />
                </div>
                <button
                  type="submit"
                  className={`login-submit ${username.trim() && !loading ? 'active' : 'inactive'}`}
                  disabled={loading || !username.trim()}
                >
                  {loading && !activeRole
                    ? <><svg className="spin" style={{ width:'15px', height:'15px' }} fill="none" viewBox="0 0 24 24"><circle style={{opacity:.25}} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path style={{opacity:.75}} fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Ingresando...</>
                    : 'Ingresar al sistema →'
                  }
                </button>
              </form>
            </div>

            {/* ── FOOTER ───────────────────────────────────────────────── */}
            <div className="card-footer">
              <p className="footer-note">
                Aplicación demo para presentaciones comerciales<br/>
                <span style={{ color: 'rgba(56,189,248,0.50)' }}>Datos simulados · Sin conexión a servidor</span>
              </p>
            </div>

          </div>
        </div>

      </div>
    </>
  )
}
