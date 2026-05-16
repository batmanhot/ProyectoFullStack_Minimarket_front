import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PLANS, PLAN_ORDER, BILLING_CYCLES } from '../../config/plans'
import { getStoredPrices, getStoredSiteSettings } from '../../services/tenantService'
import { Check, Zap, ShoppingCart, BarChart2, Users, Package, Shield, Star, ArrowRight, TrendingUp, Clock, Phone, MessageCircle, Mail, MapPin } from 'lucide-react'

const FEATURES_SHOWCASE = [
  { icon: ShoppingCart, title: 'Punto de Venta',  desc: 'Yape, Plin, tarjeta, efectivo y mixto. Tickets impresos en segundos.',       bg: '#2563eb', light: '#dbeafe' },
  { icon: Package,      title: 'Inventario',       desc: 'Stock en tiempo real, alertas automáticas y control por lotes.',            bg: '#7c3aed', light: '#ede9fe' },
  { icon: BarChart2,    title: 'Reportes',         desc: 'KPIs, gráficas interactivas y exportación a Excel con un clic.',           bg: '#10b981', light: '#d1fae5' },
  { icon: Users,        title: 'Clientes',         desc: 'Crédito, cobranza, historial de compras y puntos de fidelidad.',           bg: '#f59e0b', light: '#fef3c7' },
  { icon: Shield,       title: 'Auditoría',        desc: 'Trazabilidad completa de cada operación. Nunca pierdas el control.',       bg: '#ef4444', light: '#fee2e2' },
  { icon: Zap,          title: 'Multi-rol',        desc: 'Admin, gerente, supervisor y cajero con permisos diferenciados.',          bg: '#06b6d4', light: '#cffafe' },
]

const STATS = [
  { value: '+500',  label: 'Negocios activos',   color: '#2563eb' },
  { value: '18',    label: 'Módulos integrados', color: '#7c3aed' },
  { value: '99.9%', label: 'Disponibilidad',     color: '#10b981' },
  { value: '24/7',  label: 'Soporte técnico',    color: '#f59e0b' },
]

const SECTORS = ['Bodega', 'Farmacia', 'Ferretería', 'Boutique', 'Panadería', 'Electrónica', 'Librería', 'Calzado']

// ── Estilos globales inyectados una sola vez ───────────────────────────────────
const GLOBAL_CSS = `
  @keyframes float { 0%,100% { transform: translateY(0px) } 50% { transform: translateY(-18px) } }
  @keyframes pulse-ring { 0% { transform: scale(.9); opacity:.7 } 70% { transform: scale(1.15); opacity:0 } 100% { transform: scale(1.15); opacity:0 } }
  .feat-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.10) !important; transform: translateY(-3px); transition: all .22s; }
  .plan-card:hover { transform: translateY(-4px); transition: all .2s; }
`

export default function Landing() {
  const navigate = useNavigate()
  const [billing, setBilling] = useState('monthly')

  const site        = getStoredSiteSettings()
  const brandName   = site.brandName  || 'MiniMarket POS'
  const tagline     = site.tagline    || 'Sistema POS para retail minorista en Perú'

  const storedPrices = getStoredPrices()
  const getBasePrice = (planId) => storedPrices[planId] ?? PLANS[planId]?.price ?? 0
  const cycleKey  = billing === 'annual' ? 'annual' : 'monthly'
  const cycleCfg  = BILLING_CYCLES[cycleKey]
  const price = (planId) => {
    const base = getBasePrice(planId)
    if (base === 0) return 0
    return Math.round(base * (1 - cycleCfg.discountPct / 100))
  }
  const goToDemo = () => { window.location.href = '/app/demo' }

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: '100vh', background: '#f1f5f9' }}>
      <style>{GLOBAL_CSS}</style>

      {/* ══════════════════════════ HERO (dark) ══════════════════════════════ */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #1e3a8a 100%)', position: 'relative', overflow: 'hidden' }}>

        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: '-160px', right: '-160px', width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-120px', left: '-120px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.20) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', right: '8%', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,211,153,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* ── Nav ── */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(14px)', background: 'rgba(15,23,42,0.7)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 28px', height: '66px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '18px', boxShadow: '0 4px 14px rgba(99,102,241,0.45)' }}>M</div>
              <span style={{ fontWeight: 700, fontSize: '18px', color: '#fff' }}>{brandName}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button onClick={goToDemo} style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.07)', color: '#cbd5e1', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Ver demo
              </button>
              <button onClick={() => navigate('/register')} style={{ padding: '9px 22px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.40)' }}>
                Empezar gratis
              </button>
            </div>
          </div>
        </nav>

        {/* ── Hero content ── */}
        <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '88px 28px 110px', textAlign: 'center', position: 'relative', zIndex: 10 }}>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: '24px', padding: '6px 18px', marginBottom: '30px' }}>
            <Star size={13} color="#a78bfa" fill="#a78bfa" />
            <span style={{ fontSize: '12px', color: '#c4b5fd', fontWeight: 600, letterSpacing: '0.04em' }}>{tagline}</span>
          </div>

          <h1 style={{ fontSize: '68px', fontWeight: 900, lineHeight: 1.05, color: '#fff', margin: '0 0 22px', letterSpacing: '-3px' }}>
            Gestiona tu negocio
            <br />
            <span style={{ background: 'linear-gradient(90deg, #60a5fa 0%, #a78bfa 50%, #34d399 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              desde cualquier lugar
            </span>
          </h1>

          <p style={{ fontSize: '19px', color: '#94a3b8', lineHeight: 1.8, margin: '0 auto 44px', maxWidth: '560px' }}>
            POS completo para bodegas, farmacias, ferreterías y más.
            <br />Ventas, inventario, reportes y fidelización — todo integrado.
          </p>

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/register')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '15px 32px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 36px rgba(99,102,241,0.50)' }}>
              Registrar mi negocio — gratis 30 días <ArrowRight size={16} />
            </button>
            <button onClick={goToDemo} style={{ padding: '15px 28px', borderRadius: '12px', border: '1.5px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', fontSize: '15px', fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
              Ver demo en vivo →
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '44px' }}>
            {SECTORS.map(s => (
              <span key={s} style={{ padding: '5px 14px', borderRadius: '20px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.11)', fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>{s}</span>
            ))}
          </div>
        </section>
      </div>

      {/* ══════════════════════════ STATS STRIP ═══════════════════════════════ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '36px 28px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {STATS.map(({ value, label, color }) => (
            <div key={label} style={{ textAlign: 'center', padding: '8px' }}>
              <div style={{ fontSize: '38px', fontWeight: 900, color, lineHeight: 1, letterSpacing: '-1px' }}>{value}</div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════ FEATURES ══════════════════════════════════ */}
      <div style={{ background: '#f8fafc', padding: '88px 0 96px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 28px' }}>

          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,#eff6ff,#ede9fe)', color: '#4f46e5', fontSize: '11px', fontWeight: 800, padding: '5px 16px', borderRadius: '20px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em', border: '1px solid #c7d2fe' }}>
              Funcionalidades
            </div>
            <h2 style={{ fontSize: '38px', fontWeight: 800, color: '#0f172a', margin: '0', letterSpacing: '-1.5px', lineHeight: 1.15 }}>
              Todo lo que necesitas en un solo lugar
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
            {FEATURES_SHOWCASE.map(({ icon: Icon, title, desc, bg, light }) => (
              <div key={title} className="feat-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '28px', display: 'flex', gap: '18px', alignItems: 'flex-start', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'all .22s', cursor: 'default' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0, background: light, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${bg}25` }}>
                  <Icon size={24} color={bg} strokeWidth={1.8} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '6px', fontSize: '15px' }}>{title}</div>
                  <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.65 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════ PRICING ═══════════════════════════════════ */}
      <div style={{ background: '#fff', padding: '88px 0 100px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 28px' }}>

          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,#f0fdf4,#d1fae5)', color: '#059669', fontSize: '11px', fontWeight: 800, padding: '5px 16px', borderRadius: '20px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em', border: '1px solid #a7f3d0' }}>
              Planes y Precios
            </div>
            <h2 style={{ fontSize: '38px', fontWeight: 800, color: '#0f172a', margin: '0 0 10px', letterSpacing: '-1.5px' }}>
              Precios simples y transparentes
            </h2>
            <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>Sin contratos. Sin sorpresas. Cancela cuando quieras.</p>
          </div>

          {/* Billing toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: '12px', padding: '5px', gap: '4px' }}>
              {[['monthly', 'Mensual'], ['annual', 'Anual']].map(([key, label]) => (
                <button key={key} onClick={() => setBilling(key)} style={{ padding: '8px 22px', borderRadius: '9px', border: 'none', cursor: 'pointer', background: billing === key ? '#fff' : 'transparent', color: billing === key ? '#0f172a' : '#64748b', fontWeight: billing === key ? 700 : 500, fontSize: '13px', boxShadow: billing === key ? '0 1px 6px rgba(0,0,0,0.10)' : 'none', transition: 'all .2s' }}>
                  {label}
                  {key === 'annual' && <span style={{ marginLeft: '8px', background: 'linear-gradient(90deg,#10b981,#059669)', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '2px 7px', borderRadius: '10px' }}>−20%</span>}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
            {PLAN_ORDER.map(planId => {
              const plan      = PLANS[planId]
              const featured  = plan.badge === 'Más popular'
              const basePrice = getBasePrice(planId)
              const shown     = price(planId)

              return (
                <div key={planId} className="plan-card" style={{ background: featured ? 'linear-gradient(155deg,#1e3a8a 0%,#312e81 60%,#1e1b4b 100%)' : '#fff', border: featured ? 'none' : '1.5px solid #e2e8f0', borderRadius: '20px', padding: '30px', position: 'relative', boxShadow: featured ? '0 24px 80px rgba(37,99,235,0.32)' : '0 2px 10px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', transition: 'all .2s' }}>

                  {plan.badge && (
                    <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg,#f59e0b,#ef4444)', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '5px 16px', borderRadius: '20px', letterSpacing: '0.04em', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(245,158,11,0.4)' }}>
                      {plan.badge}
                    </div>
                  )}

                  <div style={{ marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '18px', color: featured ? '#fff' : '#0f172a' }}>{plan.label}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: featured ? 'rgba(255,255,255,0.60)' : '#94a3b8', marginBottom: '24px', lineHeight: 1.5 }}>
                    {plan.description}
                  </div>

                  <div style={{ marginBottom: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '42px', fontWeight: 900, color: featured ? '#fff' : '#0f172a', lineHeight: 1, letterSpacing: '-2px' }}>
                        {basePrice === 0 ? 'Gratis' : `S/ ${shown}`}
                      </span>
                      {basePrice > 0 && <span style={{ fontSize: '14px', color: featured ? 'rgba(255,255,255,0.50)' : '#94a3b8' }}>/mes</span>}
                    </div>
                    {basePrice > 0 && billing === 'annual' && (
                      <div style={{ fontSize: '12px', color: featured ? 'rgba(255,255,255,0.50)' : '#94a3b8', marginTop: '4px' }}>
                        Total anual: S/ {shown * 12}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => navigate('/register', { state: { plan: planId } })}
                    style={{ width: '100%', padding: '13px', borderRadius: '10px', border: featured ? '2px solid rgba(255,255,255,0.25)' : 'none', background: featured ? 'rgba(255,255,255,0.12)' : 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', marginBottom: '24px', backdropFilter: featured ? 'blur(8px)' : 'none' }}>
                    {basePrice === 0 ? 'Empezar gratis' : 'Elegir este plan'}
                  </button>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                    {(plan.features === 'all'
                      ? ['Todo lo del plan Pro', 'Usuarios ilimitados', 'Productos ilimitados', 'Soporte prioritario 24/7']
                      : plan.features.slice(0, 6).map(f => f.charAt(0).toUpperCase() + f.slice(1))
                    ).map(feature => (
                      <div key={feature} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0, background: featured ? 'rgba(255,255,255,0.15)' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={11} color={featured ? '#fff' : '#2563eb'} strokeWidth={3} />
                        </div>
                        <span style={{ fontSize: '13px', color: featured ? 'rgba(255,255,255,0.85)' : '#374151' }}>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════ WHY US STRIP ══════════════════════════════ */}
      <div style={{ background: 'linear-gradient(135deg,#f8fafc,#eff6ff)', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '56px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '28px' }}>
          {[
            { icon: Clock,       color: '#2563eb', bg: '#dbeafe', title: '30 días gratis',        desc: 'Sin tarjeta de crédito requerida. Prueba sin riesgos.' },
            { icon: Shield,      color: '#7c3aed', bg: '#ede9fe', title: 'Datos seguros',         desc: 'Respaldo diario automático y cifrado en tránsito.' },
            { icon: TrendingUp,  color: '#10b981', bg: '#d1fae5', title: 'Sin límite de ventas',  desc: 'Procesa todo lo que tu negocio necesite sin restricciones.' },
            { icon: Zap,         color: '#f59e0b', bg: '#fef3c7', title: 'Soporte en español',    desc: 'Equipo local disponible para ayudarte a crecer.' },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={22} color={color} strokeWidth={1.8} />
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>{title}</div>
              <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.65 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════ CTA FINAL ════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#1e3a8a 100%)', padding: '80px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.20) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 10, maxWidth: '620px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '42px', fontWeight: 900, margin: '0 0 14px', color: '#fff', letterSpacing: '-2px', lineHeight: 1.1 }}>
            Empieza hoy —<br />
            <span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              30 días completamente gratis
            </span>
          </h2>
          <p style={{ fontSize: '16px', color: '#94a3b8', margin: '0 0 36px', lineHeight: 1.7 }}>
            Sin tarjeta de crédito. Sin compromisos. Cancela cuando quieras.
          </p>
          <button onClick={() => navigate('/register')} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '16px 40px', borderRadius: '12px', border: 'none', background: '#fff', color: '#1e3a8a', fontSize: '16px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 36px rgba(0,0,0,0.25)' }}>
            Registrar mi negocio <ArrowRight size={18} />
          </button>
        </div>
      </div>

      {/* ══════════════════════════ FOOTER ════════════════════════════════════ */}
      <footer style={{ background: '#0b1120', position: 'relative', overflow: 'hidden' }}>

        {/* Acento superior degradado */}
        <div style={{ height: '3px', background: 'linear-gradient(90deg,#3b82f6,#7c3aed,#10b981)' }} />

        {/* Blob decorativo */}
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '340px', height: '340px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '52px 28px 32px' }}>

          {/* ── 3 columnas principales ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '40px', marginBottom: '44px' }}>

            {/* Col 1 — Marca */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '18px', flexShrink: 0, boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>M</div>
                <span style={{ fontSize: '16px', color: '#f1f5f9', fontWeight: 800, letterSpacing: '-0.3px' }}>{brandName}</span>
              </div>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.75 }}>{tagline}</p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '20px', padding: '5px 12px', width: 'fit-content' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>Sistema operativo 24/7</span>
              </div>
            </div>

            {/* Col 2 — Contacto */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                Soporte y contacto
              </div>
              {site.phone && (
                <a href={`tel:${site.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', textDecoration: 'none', transition: 'all .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(59,130,246,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Phone size={13} color="#60a5fa" />
                  </div>
                  <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>{site.phone}</span>
                </a>
              )}
              {site.whatsapp && (
                <a href={`https://wa.me/${site.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', textDecoration: 'none', transition: 'all .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(34,197,94,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MessageCircle size={13} color="#4ade80" />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>WhatsApp</div>
                    <div style={{ fontSize: '11px', color: '#475569' }}>{site.whatsapp}</div>
                  </div>
                </a>
              )}
              {site.email && (
                <a href={`mailto:${site.email}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', textDecoration: 'none', transition: 'all .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(59,130,246,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Mail size={13} color="#60a5fa" />
                  </div>
                  <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>{site.email}</span>
                </a>
              )}
              {site.address && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MapPin size={13} color="#fbbf24" />
                  </div>
                  <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>{site.address}</span>
                </div>
              )}
              {!site.phone && !site.whatsapp && !site.email && !site.address && (
                <p style={{ fontSize: '12px', color: '#334155', fontStyle: 'italic', margin: 0 }}>Configura los datos de contacto desde SuperAdmin → Sitio web.</p>
              )}
            </div>

            {/* Col 3 — Navegación */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                Acceso rápido
              </div>
              {[
                { label: 'Ver demo en vivo', action: goToDemo },
                { label: 'Planes y precios', action: () => {} },
                { label: 'Registrar mi negocio', action: () => navigate('/register') },
              ].map(({ label, action }) => (
                <button key={label} onClick={action}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderRadius: '8px', background: 'transparent', border: '1px solid transparent', textAlign: 'left', cursor: 'pointer', transition: 'all .15s', width: '100%' }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.07)' }}
                  onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='transparent' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{label}</span>
                </button>
              ))}

              {/* Redes sociales */}
              {(site.facebook || site.instagram || site.tiktok) && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                    Redes sociales
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {site.facebook && (
                      <a href={site.facebook} target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)', color: '#60a5fa', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                        f &nbsp;Facebook
                      </a>
                    )}
                    {site.instagram && (
                      <a href={site.instagram} target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', background: 'rgba(236,72,153,0.10)', border: '1px solid rgba(236,72,153,0.20)', color: '#f472b6', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                        ◎ Instagram
                      </a>
                    )}
                    {site.tiktok && (
                      <a href={site.tiktok} target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#e2e8f0', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                        ♪ TikTok
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Línea de copyright ── */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <p style={{ fontSize: '12px', color: '#1e293b', margin: 0 }}>
              © {new Date().getFullYear()} <span style={{ color: '#334155', fontWeight: 600 }}>{brandName}</span> · Hecho en Perú 🇵🇪
            </p>
            <p style={{ fontSize: '11px', color: '#1e293b', margin: 0 }}>Sistema de gestión para retail minorista</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
