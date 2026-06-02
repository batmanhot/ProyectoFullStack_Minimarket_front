import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Check, ChevronRight, Clock3, CreditCard, ExternalLink,
  Facebook, Gauge, Globe2, Instagram, Mail, MapPin, MessageCircle, Package,
  Phone, ReceiptText, ShieldCheck, ShoppingCart, Sparkles, Star, Store, Users,
  Zap
} from 'lucide-react'
import { BILLING_CYCLES, PLAN_ORDER, PLANS } from '../../config/plans'
import { getStoredPrices, getStoredSiteSettings } from '../../services/tenantService'

const DEFAULT_FEATURES = [
  { icon: ShoppingCart, title: 'Venta rapida', desc: 'POS agil para mostrador, lectores de codigo y pagos mixtos sin friccion.' },
  { icon: Package, title: 'Inventario vivo', desc: 'Stock, lotes, alertas y movimientos claros para comprar a tiempo.' },
  { icon: BarChart3, title: 'Reportes accionables', desc: 'Margen, ventas, productos top y caja diaria listos para decidir.' },
  { icon: Users, title: 'Clientes y credito', desc: 'Historial, deudas, fidelizacion y seguimiento en una sola vista.' },
  { icon: ShieldCheck, title: 'Control total', desc: 'Roles, auditoria, trazabilidad y datos ordenados por negocio.' },
  { icon: ReceiptText, title: 'Comprobantes', desc: 'Base preparada para boletas, facturas y gestion SUNAT.' },
]

const FEATURE_ICON_MAP = [ShoppingCart, Package, BarChart3, Users, ShieldCheck, ReceiptText, CreditCard, Gauge, Store, Zap]

const PLAN_FEATURES = {
  trial: ['POS y caja', 'Catalogo inicial', 'Inventario basico', 'Clientes', '1 usuario', 'Prueba gratuita'],
  basic: ['POS completo', 'Inventario y compras', 'Clientes y cobranza', 'Reportes', 'Hasta 3 usuarios', 'Exportacion'],
  pro: ['Todo Basic', 'Promociones', 'Fidelizacion', 'Auditoria', 'Multi-caja', 'Alertas avanzadas'],
  enterprise: ['Todo Pro', 'Usuarios ilimitados', 'Productos ilimitados', 'Soporte prioritario', 'Multi-negocio', 'Acompanamiento'],
}

const CURRENCY = {
  PEN: { symbol: 'S/', label: 'soles' },
  USD: { symbol: '$', label: 'dolares' },
  EUR: { symbol: 'EUR', label: 'euros' },
}

const GLOBAL_CSS = `
  .lp-shell { color: #102033; background: #f6f9fc; overflow-x: hidden; }
  .lp-nav-links { display: flex; gap: 24px; align-items: center; }
  .lp-hero { display: grid; grid-template-columns: minmax(0, 1.02fr) minmax(360px, .98fr); gap: 54px; align-items: center; }
  .lp-proof { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .lp-feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .lp-pricing-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .lp-demo-grid { display: grid; grid-template-columns: .86fr 1.14fr; gap: 44px; align-items: center; }
  .lp-footer-grid { display: grid; grid-template-columns: 1.2fr .9fr .9fr; gap: 42px; }
  .lp-card-hover { transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
  .lp-card-hover:hover { transform: translateY(-4px); box-shadow: 0 22px 48px rgba(20, 46, 82, .12); }
  .lp-reveal { animation: lpRise .65s ease both; }
  @keyframes lpRise { from { transform: translateY(14px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
  @media (max-width: 980px) {
    .lp-nav-links { display: none; }
    .lp-hero, .lp-demo-grid { grid-template-columns: 1fr; gap: 34px; }
    .lp-proof, .lp-pricing-grid { grid-template-columns: repeat(2, 1fr); }
    .lp-feature-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 640px) {
    .lp-proof, .lp-feature-grid, .lp-pricing-grid, .lp-footer-grid { grid-template-columns: 1fr; }
    .lp-hero-title { font-size: 40px !important; }
    .lp-section-title { font-size: 30px !important; }
    .lp-nav-cta-secondary { display: none !important; }
    .lp-hero-actions { flex-direction: column; align-items: stretch !important; }
    .lp-hero-actions button { justify-content: center; width: 100%; }
  }
`

const getReadableTextColor = (hex) => {
  const clean = hex?.replace('#', '')
  if (!clean || clean.length !== 6) return '#ffffff'
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#102033' : '#ffffff'
}

const getPlanPrice = (planId, cycleKey, storedPrices) => {
  const base = storedPrices[planId] ?? PLANS[planId]?.price ?? 0
  if (base === 0) return 0
  const discount = BILLING_CYCLES[cycleKey]?.discountPct ?? 0
  return Math.round(base * (1 - discount / 100))
}

const useLandingData = () => {
  const site = getStoredSiteSettings()
  const prices = getStoredPrices()
  return useMemo(() => {
    const primary = site.primaryColor || '#16a34a'
    const features = Array.isArray(site.features) && site.features.length > 0
      ? site.features.map((feature, index) => ({
          ...feature,
          icon: FEATURE_ICON_MAP[index % FEATURE_ICON_MAP.length],
          title: feature.title || DEFAULT_FEATURES[index % DEFAULT_FEATURES.length].title,
          desc: feature.desc || DEFAULT_FEATURES[index % DEFAULT_FEATURES.length].desc,
        }))
      : DEFAULT_FEATURES

    return {
      site: {
        ...site,
        brandName: site.brandName || 'MiniMarket POS',
        tagline: site.tagline || 'Sistema POS para retail minorista',
        description: site.description || 'Sistema de punto de venta disenado para vender mas, controlar mejor el inventario y cerrar caja sin dolores de cabeza.',
        heroTitle: site.heroTitle || 'Vende mas y controla tu tienda en tiempo real',
        heroSubtitle: site.heroSubtitle || 'POS moderno para bodegas, minimarkets y comercios que necesitan velocidad en caja, stock claro y reportes utiles desde el primer dia.',
        heroCtaText: site.heroCtaText || site.heroCta || 'Comenzar prueba gratis',
        heroCtaSecText: site.heroCtaSecText || 'Ver demo en vivo',
        heroCtaUrl: site.heroCtaUrl || '/register',
        heroCtaSecUrl: site.heroCtaSecUrl || '/app/demo',
        trialDays: Number(site.trialDays || 30),
        showPricesPublic: site.showPricesPublic !== false,
        publicCurrency: site.publicCurrency || 'PEN',
        footerText: site.footerText || '',
      },
      primary,
      onPrimary: getReadableTextColor(primary),
      prices,
      features,
    }
  }, [site, prices])
}

function BrandMark({ site, primary }) {
  if (site.logoUrl) {
    return (
      <img
        src={site.logoUrl}
        alt={site.brandName}
        style={{ width: '42px', height: '42px', borderRadius: '12px', objectFit: 'cover', boxShadow: `0 10px 28px ${primary}35` }}
      />
    )
  }

  return (
    <div style={{ width: '42px', height: '42px', borderRadius: '13px', background: primary, color: getReadableTextColor(primary), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '18px', boxShadow: `0 12px 30px ${primary}35` }}>
      {site.brandName?.[0]?.toUpperCase() || 'M'}
    </div>
  )
}

function handleConfiguredAction(url, navigate) {
  if (!url || url === '#planes') {
    document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' })
    return
  }
  if (url === '#demo') {
    window.location.href = '/app/demo'
    return
  }
  if (url.startsWith('http')) {
    window.open(url, '_blank', 'noreferrer')
    return
  }
  navigate(url)
}

function MiniDashboard({ primary, site }) {
  return (
    <div style={{ position: 'relative' }} className="lp-reveal">
      {site.heroImage ? (
        <img
          src={site.heroImage}
          alt="Vista del sistema"
          style={{ width: '100%', borderRadius: '26px', objectFit: 'cover', aspectRatio: '4 / 3', boxShadow: '0 32px 90px rgba(15, 23, 42, .2)', border: '1px solid rgba(255,255,255,.7)' }}
        />
      ) : (
        <div style={{ borderRadius: '28px', background: '#0f172a', padding: '14px', boxShadow: '0 34px 90px rgba(15, 23, 42, .28)', border: '1px solid rgba(255,255,255,.7)' }}>
          <div style={{ background: '#f8fafc', borderRadius: '20px', overflow: 'hidden' }}>
            <div style={{ height: '48px', background: '#ffffff', borderBottom: '1px solid #e5edf5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>Caja abierta</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 190px', minHeight: '390px' }}>
              <div style={{ padding: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div>
                    <div style={{ color: '#0f172a', fontSize: '20px', fontWeight: 900 }}>Venta del turno</div>
                    <div style={{ color: '#64748b', fontSize: '12px', marginTop: '3px' }}>Productos, descuentos y pago en una vista</div>
                  </div>
                  <div style={{ padding: '8px 12px', borderRadius: '999px', background: `${primary}16`, color: primary, fontSize: '12px', fontWeight: 800 }}>En linea</div>
                </div>
                {[
                  ['Arroz extra 5kg', '2 un.', 'S/ 37.80'],
                  ['Leche evaporada', '6 un.', 'S/ 25.20'],
                  ['Aceite vegetal', '1 un.', 'S/ 12.90'],
                  ['Galletas surtidas', '4 un.', 'S/ 9.60'],
                ].map(([name, qty, amount]) => (
                  <div key={name} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 82px', gap: '10px', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e8eef5' }}>
                    <div style={{ color: '#172033', fontWeight: 750, fontSize: '13px' }}>{name}</div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>{qty}</div>
                    <div style={{ color: '#0f172a', fontWeight: 900, fontSize: '13px', textAlign: 'right' }}>{amount}</div>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '20px' }}>
                  {[
                    ['Ventas', 'S/ 1,842'],
                    ['Tickets', '68'],
                    ['Stock bajo', '9'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ background: '#fff', border: '1px solid #e5edf5', borderRadius: '14px', padding: '13px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>{label}</div>
                      <div style={{ fontSize: '19px', color: '#0f172a', fontWeight: 950, marginTop: '5px' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#101827', padding: '18px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Total</div>
                  <div style={{ fontSize: '34px', fontWeight: 950, marginTop: '8px' }}>S/ 85.50</div>
                  <div style={{ marginTop: '16px', display: 'grid', gap: '8px' }}>
                    {['Efectivo', 'Yape', 'Tarjeta'].map((method, index) => (
                      <div key={method} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 10px', borderRadius: '10px', background: index === 1 ? `${primary}35` : 'rgba(255,255,255,.06)', fontSize: '12px' }}>
                        <span>{method}</span>
                        <Check size={14} />
                      </div>
                    ))}
                  </div>
                </div>
                <button style={{ height: '46px', border: 'none', borderRadius: '13px', background: primary, color: getReadableTextColor(primary), fontWeight: 900, fontSize: '13px' }}>
                  Cobrar ahora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', left: '-18px', bottom: '34px', borderRadius: '18px', background: '#ffffff', border: '1px solid #dbe5ef', padding: '14px 16px', boxShadow: '0 20px 46px rgba(15, 23, 42, .16)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={17} color="#16a34a" />
          </div>
          <div>
            <div style={{ color: '#0f172a', fontSize: '13px', fontWeight: 900 }}>Cierre listo</div>
            <div style={{ color: '#64748b', fontSize: '11px' }}>Diferencia: S/ 0.00</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const { site, primary, onPrimary, prices, features } = useLandingData()
  const [billing, setBilling] = useState('monthly')

  const currency = CURRENCY[site.publicCurrency] || CURRENCY.PEN
  const cycleKey = billing === 'annual' ? 'annual' : 'monthly'

  const handleChoosePlan = (planId) => {
    navigate('/register', { state: { plan: planId } })
  }

  const proof = [
    ['3 min', 'para empezar una venta'],
    ['18+', 'modulos conectados'],
    ['0', 'archivos sueltos de caja'],
    ['24/7', 'control desde la nube'],
  ]

  return (
    <div className="lp-shell" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{GLOBAL_CSS}</style>

      <header style={{ position: 'sticky', top: 0, zIndex: 60, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(205, 216, 228, .72)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', minHeight: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 22 }}>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ display: 'flex', alignItems: 'center', gap: 11, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
            <BrandMark site={site} primary={primary} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: '#102033', fontWeight: 950, fontSize: 16 }}>{site.brandName}</div>
              <div style={{ color: '#6b7b8d', fontWeight: 650, fontSize: 11 }}>{site.systemVersion || site.tagline}</div>
            </div>
          </button>

          <nav className="lp-nav-links">
            {[
              ['Producto', 'producto'],
              ['Funciones', 'funciones'],
              ...(site.showPricesPublic ? [['Planes', 'planes']] : []),
              ['Contacto', 'contacto'],
            ].map(([label, target]) => (
              <button key={target} onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' })} style={{ border: 'none', background: 'transparent', color: '#425267', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{label}</button>
            ))}
          </nav>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="lp-nav-cta-secondary" onClick={() => window.location.href = '/app/demo'} style={{ height: 40, padding: '0 15px', borderRadius: 11, border: '1px solid #d6e0ea', background: '#fff', color: '#102033', fontSize: 13, fontWeight: 850, cursor: 'pointer' }}>
              Ver demo
            </button>
            <button onClick={() => handleConfiguredAction(site.heroCtaUrl, navigate)} style={{ height: 40, padding: '0 17px', borderRadius: 11, border: 'none', background: primary, color: onPrimary, fontSize: 13, fontWeight: 900, cursor: 'pointer', boxShadow: `0 14px 28px ${primary}30` }}>
              {site.heroCtaText}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #ffffff 0%, #eef7f2 100%)' }}>
          <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 520, background: `radial-gradient(circle at 18% 20%, ${primary}24, transparent 34%), radial-gradient(circle at 82% 8%, #38bdf822, transparent 30%)`, pointerEvents: 'none' }} />
          <div className="lp-hero" style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '76px 24px 72px' }}>
            <div className="lp-reveal">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 22, color: '#102033', fontWeight: 850, fontSize: 13 }}>
                <Star size={16} color={primary} fill={primary} />
                <span>{site.tagline}</span>
              </div>
              <h1 className="lp-hero-title" style={{ margin: 0, color: '#0f1f32', fontSize: 62, lineHeight: 1.02, letterSpacing: 0, fontWeight: 950, maxWidth: 760 }}>
                {site.heroTitle}
              </h1>
              <p style={{ margin: '22px 0 0', color: '#516172', fontSize: 18, lineHeight: 1.72, maxWidth: 640 }}>
                {site.heroSubtitle}
              </p>
              <p style={{ margin: '14px 0 0', color: '#64748b', fontSize: 14, lineHeight: 1.7, maxWidth: 620 }}>
                {site.description}
              </p>
              <div className="lp-hero-actions" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 32 }}>
                <button onClick={() => handleConfiguredAction(site.heroCtaUrl, navigate)} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '0 24px', borderRadius: 14, border: 'none', background: primary, color: onPrimary, fontSize: 15, fontWeight: 950, cursor: 'pointer', boxShadow: `0 20px 42px ${primary}34` }}>
                  {site.heroCtaText} <ArrowRight size={18} />
                </button>
                <button onClick={() => handleConfiguredAction(site.heroCtaSecUrl, navigate)} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, minHeight: 52, padding: '0 20px', borderRadius: 14, border: '1px solid #cfdae6', background: '#ffffff', color: '#102033', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}>
                  {site.heroCtaSecText} <ExternalLink size={16} />
                </button>
              </div>
              <div className="lp-proof" style={{ marginTop: 38 }}>
                {proof.map(([value, label]) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,.75)', border: '1px solid #dce7f0', borderRadius: 16, padding: '15px 16px' }}>
                    <div style={{ color: '#0f1f32', fontSize: 24, lineHeight: 1, fontWeight: 950 }}>{value}</div>
                    <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.35, marginTop: 7, fontWeight: 700 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <MiniDashboard primary={primary} site={site} />
          </div>
        </section>

        <section id="producto" style={{ background: '#ffffff', borderTop: '1px solid #e5edf5', borderBottom: '1px solid #e5edf5' }}>
          <div className="lp-demo-grid" style={{ maxWidth: 1200, margin: '0 auto', padding: '78px 24px' }}>
            <div>
              <h2 className="lp-section-title" style={{ color: '#0f1f32', fontSize: 42, lineHeight: 1.12, letterSpacing: 0, fontWeight: 950, margin: 0 }}>
                La caja, el almacen y los reportes trabajando juntos.
              </h2>
              <p style={{ color: '#5f6f80', fontSize: 16, lineHeight: 1.75, margin: '18px 0 0' }}>
                Cada venta actualiza stock, caja y reportes. Menos doble digitacion, menos errores y mas visibilidad para tomar decisiones cada dia.
              </p>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                [CreditCard, 'Cobro sin friccion', 'Efectivo, tarjeta, Yape, Plin, credito y pagos mixtos.'],
                [Package, 'Reposicion inteligente', 'Alertas de stock bajo y productos por vencer para comprar antes de perder ventas.'],
                [BarChart3, 'Gestion con numeros', 'Margen, ticket promedio, ventas por hora y productos estrella en dashboards simples.'],
              ].map(([Icon, title, desc]) => (
                <div key={title} className="lp-card-hover" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: 18, background: '#f8fbfd', border: '1px solid #dfe9f2', borderRadius: 18 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: `${primary}15`, color: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={22} />
                  </div>
                  <div>
                    <div style={{ color: '#102033', fontSize: 15, fontWeight: 950 }}>{title}</div>
                    <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.65, marginTop: 5 }}>{desc}</div>
                  </div>
                  <ChevronRight size={18} color="#9aaaba" style={{ marginLeft: 'auto', marginTop: 13 }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="funciones" style={{ maxWidth: 1200, margin: '0 auto', padding: '84px 24px' }}>
          <div style={{ maxWidth: 720 }}>
            <h2 className="lp-section-title" style={{ color: '#0f1f32', fontSize: 42, lineHeight: 1.12, fontWeight: 950, margin: 0 }}>
              Configura la historia comercial desde SuperAdmin.
            </h2>
            <p style={{ color: '#64748b', fontSize: 16, lineHeight: 1.75, margin: '16px 0 0' }}>
              Estas funcionalidades salen de la configuracion del sitio. Puedes ajustar el mensaje sin tocar codigo.
            </p>
          </div>

          <div className="lp-feature-grid" style={{ marginTop: 34 }}>
            {features.map(({ icon: Icon, title, desc }, index) => (
              <article key={`${title}-${index}`} className="lp-card-hover" style={{ background: '#ffffff', border: '1px solid #dfe9f2', borderRadius: 20, padding: 22, minHeight: 176 }}>
                <div style={{ width: 48, height: 48, borderRadius: 15, background: index % 2 ? '#eef6ff' : `${primary}14`, color: index % 2 ? '#2563eb' : primary, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <Icon size={23} />
                </div>
                <h3 style={{ color: '#102033', fontSize: 17, lineHeight: 1.25, fontWeight: 950, margin: 0 }}>{title}</h3>
                <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.65, margin: '9px 0 0' }}>{desc}</p>
              </article>
            ))}
          </div>
        </section>

        {site.showPricesPublic && (
          <section id="planes" style={{ background: '#0f1f32', color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 20% 5%, ${primary}30, transparent 34%), radial-gradient(circle at 88% 25%, #60a5fa24, transparent 34%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '84px 24px 92px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 34 }}>
                <div style={{ maxWidth: 670 }}>
                  <h2 className="lp-section-title" style={{ fontSize: 42, lineHeight: 1.12, fontWeight: 950, margin: 0 }}>
                    Planes claros para empezar hoy.
                  </h2>
                  <p style={{ color: '#a8b6c7', fontSize: 16, lineHeight: 1.75, margin: '16px 0 0' }}>
                    Precios configurados desde SuperAdmin. La prueba gratuita es de {site.trialDays} dias.
                  </p>
                </div>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, padding: 5 }}>
                  {[
                    ['monthly', 'Mensual'],
                    ['annual', 'Anual'],
                  ].map(([key, label]) => (
                    <button key={key} onClick={() => setBilling(key)} style={{ border: 'none', borderRadius: 10, padding: '10px 16px', color: billing === key ? '#0f1f32' : '#d8e1ea', background: billing === key ? '#fff' : 'transparent', fontWeight: 900, cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lp-pricing-grid">
                {PLAN_ORDER.map((planId) => {
                  const plan = PLANS[planId]
                  const amount = getPlanPrice(planId, cycleKey, prices)
                  const popular = plan.badge
                  return (
                    <article key={planId} className="lp-card-hover" style={{ background: popular ? '#ffffff' : 'rgba(255,255,255,.06)', border: popular ? 'none' : '1px solid rgba(255,255,255,.12)', borderRadius: 22, padding: 22, color: popular ? '#102033' : '#fff', position: 'relative' }}>
                      {popular && (
                        <div style={{ position: 'absolute', top: -13, left: 22, borderRadius: 999, background: primary, color: onPrimary, padding: '6px 12px', fontSize: 11, fontWeight: 950 }}>
                          {plan.badge}
                        </div>
                      )}
                      <h3 style={{ fontSize: 18, fontWeight: 950, margin: '5px 0 6px' }}>{plan.label}</h3>
                      <p style={{ color: popular ? '#64748b' : '#a8b6c7', fontSize: 12, lineHeight: 1.55, margin: 0, minHeight: 38 }}>{plan.description}</p>
                      <div style={{ marginTop: 20, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: amount ? 34 : 28, fontWeight: 950 }}>{amount ? `${currency.symbol} ${amount}` : 'Gratis'}</span>
                        {amount > 0 && <span style={{ color: popular ? '#64748b' : '#a8b6c7', fontSize: 12 }}>/mes</span>}
                      </div>
                      {amount > 0 && billing === 'annual' && (
                        <div style={{ color: popular ? '#64748b' : '#a8b6c7', fontSize: 11, marginTop: 4 }}>
                          Total anual: {currency.symbol} {amount * 12}
                        </div>
                      )}
                      <button 
                        onClick={() => handleChoosePlan(planId)} 
                        style={{ 
                          width: '100%', height: 44, marginTop: 18, border: popular ? 'none' : '1px solid rgba(255,255,255,.2)', 
                          borderRadius: 13, background: popular ? primary : 'rgba(255,255,255,.1)', 
                          color: popular ? onPrimary : '#fff', fontWeight: 950, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                        }}
                      >
                        Elegir plan
                      </button>
                      <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                        {(PLAN_FEATURES[planId] || []).map((feature) => (
                          <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 9, color: popular ? '#334155' : '#dce8f3', fontSize: 12, fontWeight: 750 }}>
                            <Check size={15} color={popular ? primary : '#8bd8b6'} />
                            {feature}
                          </div>
                        ))}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        <section id="contacto" style={{ background: '#ffffff' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '82px 24px' }}>
            <div style={{ borderRadius: 28, background: `linear-gradient(135deg, ${primary} 0%, #0f766e 100%)`, color: onPrimary, padding: '44px 34px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 28, alignItems: 'center', boxShadow: `0 26px 70px ${primary}30` }}>
              <div>
                <h2 className="lp-section-title" style={{ fontSize: 38, lineHeight: 1.12, fontWeight: 950, margin: 0 }}>
                  Listo para convertir visitas en negocios registrados.
                </h2>
                <p style={{ fontSize: 15, lineHeight: 1.75, opacity: .86, margin: '14px 0 0', maxWidth: 660 }}>
                  Activa la demo, muestra tus planes y deja que cada comercio entienda el valor en menos de un minuto.
                </p>
              </div>
              <button onClick={() => handleConfiguredAction(site.heroCtaUrl, navigate)} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '0 24px', borderRadius: 15, border: 'none', background: '#ffffff', color: '#102033', fontWeight: 950, fontSize: 15, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {site.heroCtaText} <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ background: '#08111f', color: '#dbe6f0' }}>
        <div className="lp-footer-grid" style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px 28px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <BrandMark site={site} primary={primary} />
              <div>
                <div style={{ fontWeight: 950, color: '#fff' }}>{site.brandName}</div>
                <div style={{ fontSize: 12, color: '#8ea1b6', marginTop: 2 }}>{site.tagline}</div>
              </div>
            </div>
            <p style={{ color: '#8ea1b6', fontSize: 13, lineHeight: 1.75, margin: '16px 0 0', maxWidth: 380 }}>{site.description}</p>
          </div>

          <div>
            <div style={{ color: '#fff', fontWeight: 950, marginBottom: 14 }}>Contacto</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {site.phone && <a href={`tel:${site.phone}`} style={footerLink}><Phone size={15} /> {site.phone}</a>}
              {site.whatsapp && <a href={`https://wa.me/${site.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={footerLink}><MessageCircle size={15} /> {site.whatsapp}</a>}
              {site.email && <a href={`mailto:${site.email}`} style={footerLink}><Mail size={15} /> {site.email}</a>}
              {site.address && <span style={footerText}><MapPin size={15} /> {site.address}</span>}
            </div>
          </div>

          <div>
            <div style={{ color: '#fff', fontWeight: 950, marginBottom: 14 }}>Canales</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
              {site.facebook && <a href={site.facebook} target="_blank" rel="noreferrer" style={socialLink}><Facebook size={16} /> Facebook</a>}
              {site.instagram && <a href={site.instagram} target="_blank" rel="noreferrer" style={socialLink}><Instagram size={16} /> Instagram</a>}
              {site.tiktok && <a href={site.tiktok} target="_blank" rel="noreferrer" style={socialLink}><Globe2 size={16} /> TikTok</a>}
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 24px 26px', borderTop: '1px solid rgba(255,255,255,.08)', color: '#60758c', fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>{site.footerText || `© ${new Date().getFullYear()} ${site.brandName}. Todos los derechos reservados.`}</span>
          <span>Landing conectada con SuperAdmin</span>
        </div>
      </footer>
    </div>
  )
}

const footerLink = {
  color: '#b8c7d7',
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 750,
}

const footerText = {
  color: '#b8c7d7',
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  fontSize: 13,
  fontWeight: 750,
}

const socialLink = {
  color: '#dbe6f0',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  textDecoration: 'none',
  border: '1px solid rgba(255,255,255,.12)',
  background: 'rgba(255,255,255,.06)',
  borderRadius: 999,
  padding: '9px 12px',
  fontSize: 12,
  fontWeight: 850,
}
