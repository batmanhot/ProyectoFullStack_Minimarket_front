import { useState, useEffect } from 'react'
import { useStore } from '../../store/index'
import { authService } from '../../services/index'
import { ROLES } from '../../config/app'
import toast from 'react-hot-toast'

const DEMO_ROLES = [
  { role: 'admin',      icon: '🛡️', desc: 'Acceso total al sistema' },
  { role: 'gerente',    icon: '👔', desc: 'Gestión y reportes'      },
  { role: 'supervisor', icon: '👁️', desc: 'Control operativo'       },
  { role: 'cajero',     icon: '🖥️', desc: 'Punto de venta'          },
]

const FEATURES = [
  { icon: '🖥️', label: 'Punto de Venta',  desc: 'Yape, Plin, tarjeta, mixto'        },
  { icon: '📦', label: 'Inventario',       desc: 'Control de stock en tiempo real'    },
  { icon: '📊', label: 'Reportes',         desc: 'KPIs y análisis de negocio'         },
  { icon: '👥', label: 'Clientes',         desc: 'Crédito y cobranza integrada'       },
  { icon: '🏭', label: 'Proveedores',      desc: 'Compras y entradas de mercadería'   },
  { icon: '🔍', label: 'Auditoría',        desc: 'Trazabilidad completa'              },
]

const ROLE_COLORS = {
  admin:      { bg: 'rgba(59,130,246,0.18)',  border: 'rgba(59,130,246,0.50)',  text: '#93c5fd' },
  gerente:    { bg: 'rgba(139,92,246,0.18)',  border: 'rgba(139,92,246,0.50)',  text: '#c4b5fd' },
  supervisor: { bg: 'rgba(245,158,11,0.18)',  border: 'rgba(245,158,11,0.50)',  text: '#fcd34d' },
  cajero:     { bg: 'rgba(34,197,94,0.18)',   border: 'rgba(34,197,94,0.50)',   text: '#86efac' },
}

export default function Login() {
  const { setCurrentUser, businessConfig } = useStore()
  const [loading, setLoading]     = useState(false)
  const [username, setUsername]   = useState('')
  const [activeRole, setActiveRole] = useState(null)
  const [tick, setTick]           = useState(0)
  const [isMobile, setIsMobile]   = useState(false)
  const [inputFocus, setInputFocus] = useState(false)
  const [hovered, setHovered]     = useState(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % FEATURES.length), 2800)
    return () => clearInterval(id)
  }, [])

  const handleDemoLogin = async (role) => {
    if (loading) return
    setActiveRole(role)
    setLoading(true)
    const result = await authService.login(role)
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
    const result = await authService.loginWithCredentials(username.trim())
    if (result.data) {
      setCurrentUser(result.data)
      toast.success(`Bienvenido, ${result.data.fullName}`)
    } else {
      toast.error(result.error)
    }
    setLoading(false)
  }

  // ─── Estilos base ────────────────────────────────────────────────────────────
  const baseFont = "'Segoe UI', system-ui, -apple-system, sans-serif"

  return (
    <>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes shimmer { 0%,100%{opacity:.6} 50%{opacity:1} }

        * { box-sizing: border-box; }

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
          filter: brightness(0.30) saturate(0.7);
        }
        .login-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(135deg,
            rgba(5,15,40,0.98) 0%,
            rgba(8,22,60,0.92) 40%,
            rgba(10,30,80,0.65) 100%);
        }
        .login-dots {
          position: absolute; inset: 0; opacity: 0.035;
          background-image: radial-gradient(circle, #fff 1px, transparent 1px);
          background-size: 28px 28px;
        }

        /* ── Layout ── */
        .login-layout {
          position: relative; z-index: 2;
          display: flex;
          width: 100%;
          min-height: 100vh;
          min-height: 100dvh;
        }

        /* DESKTOP: dos columnas */
        @media (min-width: 900px) {
          .login-layout { flex-direction: row; align-items: stretch; }
          .login-left {
            flex: 1;
            display: flex; flex-direction: column; justify-content: center;
            padding: 60px 56px;
            min-width: 0;
          }
          .login-right {
            width: 440px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            padding: 32px 36px 32px 0;
          }
          .login-card { width: 100%; }
          .login-left-inner { max-width: 520px; }
        }

        /* MOBILE/TABLET: columna única — card primero, branding debajo */
        @media (max-width: 899px) {
          .login-layout {
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding: 0;
            overflow-y: auto;
          }
          .login-right {
            width: 100%;
            padding: 32px 16px 20px;
            order: 1;
          }
          .login-card { width: 100%; max-width: 440px; margin: 0 auto; }
          .login-left {
            width: 100%; padding: 24px 20px 36px;
            order: 2;
          }
          .login-left-inner { max-width: 100%; }
          .h-title-main  { font-size: 36px !important; }
          .h-title-grad  { font-size: 36px !important; }
          .h-desc        { font-size: 14px !important; }
          .feat-grid     { grid-template-columns: 1fr 1fr !important; }
          .sector-row    { justify-content: center; }
        }

        @media (max-width: 480px) {
          .login-right { padding: 24px 12px 16px; }
          .login-card-inner { padding: 24px 20px !important; }
          .role-grid   { grid-template-columns: 1fr 1fr !important; }
          .h-title-main { font-size: 30px !important; }
          .h-title-grad { font-size: 30px !important; }
        }

        /* ── Card ── */
        .login-card-inner {
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 22px;
          padding: 32px 28px;
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          box-shadow: 0 24px 80px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.07) inset;
          animation: fadeUp .5s ease both;
        }

        /* ── Botones de rol ── */
        .role-btn {
          display: flex; flex-direction: column;
          align-items: flex-start; gap: 3px;
          padding: 13px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 13px;
          cursor: pointer;
          transition: background .18s, border-color .18s, transform .12s;
          text-align: left; width: 100%;
        }
        .role-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .role-btn:active:not(:disabled) { transform: translateY(0); }
        .role-btn:disabled { opacity: .45; cursor: not-allowed; }

        /* ── Input ── */
        .login-input {
          width: 100%;
          padding: 12px 14px 12px 38px;
          background: rgba(255,255,255,0.06);
          border: 1.5px solid rgba(255,255,255,0.12);
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

        /* ── Botón submit ── */
        .login-submit {
          width: 100%;
          padding: 13px;
          border-radius: 11px;
          font-size: 14px; font-weight: 700;
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: opacity .2s, transform .12s, box-shadow .2s;
          font-family: ${baseFont};
        }
        .login-submit.active {
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          color: #fff;
          box-shadow: 0 6px 24px rgba(37,99,235,0.40);
        }
        .login-submit.active:hover { opacity: .92; }
        .login-submit.active:active { transform: scale(.98); }
        .login-submit.inactive {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.09);
          color: rgba(255,255,255,0.25);
          cursor: not-allowed;
        }

        /* ── Feature card animada ── */
        .feat-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 16px;
          padding: 18px 20px;
          margin-bottom: 20px;
        }

        /* ── Badge sector ── */
        .sector-badge {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 30px; padding: 5px 13px;
          font-size: 11px; color: rgba(255,255,255,0.4);
          font-weight: 500; margin: 3px;
        }

        /* ── Divider ── */
        .divider {
          display: flex; align-items: center; gap: 10px;
          margin: 18px 0;
        }
        .divider-line { flex:1; height:1px; background:rgba(255,255,255,0.08); }
        .divider-text {
          font-size: 10px; color: rgba(255,255,255,0.25);
          font-weight: 600; letter-spacing:.08em; text-transform:uppercase;
          white-space: nowrap;
        }

        /* Spinner */
        .spin { animation: spin .9s linear infinite; }
      `}</style>

      <div className="login-root">
        <div className="login-bg"/>
        <div className="login-overlay"/>
        <div className="login-dots"/>

        <div className="login-layout">

          {/* ── PANEL DERECHO — card de login (orden 1 en móvil) ────────────── */}
          <div className="login-right">
            <div className="login-card">
              <div className="login-card-inner">

                {/* Header card */}
                <div style={{ marginBottom: '22px' }}>
                  <div style={{
                    width: '50px', height: '50px', borderRadius: '13px',
                    background: 'linear-gradient(135deg,#2563eb,#4f46e5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px', marginBottom: '14px',
                    boxShadow: '0 8px 24px rgba(37,99,235,0.40)',
                  }}>🛒</div>
                  <h3 style={{ fontSize: '21px', fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>Iniciar sesión</h3>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)', margin: 0 }}>Selecciona un rol o ingresa tu usuario</p>
                </div>

                {/* Roles */}
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.30)', letterSpacing: '.10em', textTransform: 'uppercase', marginBottom: '9px' }}>
                  Acceso rápido — Demo
                </p>
                <div className="role-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '4px' }}>
                  {DEMO_ROLES.map(({ role, icon, desc }) => {
                    const cfg = ROLES[role]
                    const c   = ROLE_COLORS[role]
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
                          background: (isAct || isHov) ? c.bg : 'rgba(255,255,255,0.04)',
                          borderColor: (isAct || isHov) ? c.border : 'rgba(255,255,255,0.09)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '14px' }}>{icon}</span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: (isAct||isHov) ? c.text : 'rgba(255,255,255,0.80)' }}>{cfg.label}</span>
                        </div>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', paddingLeft: '2px' }}>{desc}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Divider */}
                <div className="divider">
                  <div className="divider-line"/>
                  <span className="divider-text">o ingresa tu usuario</span>
                  <div className="divider-line"/>
                </div>

                {/* Input + submit */}
                <form onSubmit={handleManualLogin} style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  <div style={{ position: 'relative' }}>
                    <svg style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', width:'14px', height:'14px', opacity:.3, pointerEvents:'none' }} fill="none" viewBox="0 0 24 24" stroke="white"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
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
                      : 'Ingresar al sistema →'}
                  </button>
                </form>

                {/* Footer */}
                <div style={{ marginTop: '18px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.22)', textAlign: 'center', margin: 0, lineHeight: 1.65 }}>
                    Aplicación demo para presentaciones comerciales<br/>
                    <span style={{ color: 'rgba(56,189,248,0.50)' }}>Datos simulados · Sin conexión a servidor</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── PANEL IZQUIERDO — branding (orden 2 en móvil) ───────────────── */}
          <div className="login-left">
            <div className="login-left-inner">

              {/* Badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.11)',
                borderRadius: '30px', padding: '5px 13px', marginBottom: '24px',
              }}>
                <span style={{ fontSize: '13px' }}>🛒</span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.55)', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Sistema POS · Retail Minorista
                </span>
              </div>

              {/* Título */}
              <h1 className="h-title-main" style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1.08, color: '#fff', margin: '0 0 4px', letterSpacing: '-1.5px' }}>
                {businessConfig?.name || 'POS Pro'}
              </h1>
              <h2 className="h-title-grad" style={{
                fontSize: '48px', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-1.5px',
                background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                margin: '0 0 20px',
              }}>
                Gestión inteligente
              </h2>
              <p className="h-desc" style={{ fontSize: '15px', color: 'rgba(255,255,255,0.50)', lineHeight: 1.75, margin: '0 0 36px', maxWidth: '400px' }}>
                Solución completa para microempresas de venta minorista. Bodega, ferretería, calzado, farmacia y más.
              </p>

              {/* Feature rotativa */}
              <div className="feat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '11px', flexShrink: 0,
                    background: 'linear-gradient(135deg,#38bdf8,#6366f1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                  }}>
                    {FEATURES[tick].icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>{FEATURES[tick].label}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)' }}>{FEATURES[tick].desc}</div>
                  </div>
                  {/* Indicadores */}
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {FEATURES.map((_, i) => (
                      <div key={i} style={{
                        width: i === tick ? '16px' : '5px', height: '5px', borderRadius: '3px',
                        background: i === tick ? '#38bdf8' : 'rgba(255,255,255,0.18)',
                        transition: 'all .3s ease',
                      }}/>
                    ))}
                  </div>
                </div>
              </div>

              {/* Grid mini-features */}
              <div className="feat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '28px' }}>
                {FEATURES.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: i === tick ? 1 : 0.38, transition: 'opacity .3s' }}>
                    <span style={{ fontSize: '12px' }}>{f.icon}</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.70)', fontWeight: 500 }}>{f.label}</span>
                  </div>
                ))}
              </div>

              {/* Sectores */}
              <div className="sector-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0', margin: '-3px' }}>
                {['Bodega','Ferretería','Calzado','Farmacia','Boutique','Electrónica','Librería','+4 más'].map(s => (
                  <span key={s} className="sector-badge">{s}</span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
