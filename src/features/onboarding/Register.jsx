import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { tenantService } from '../../services/tenantService'
import { PLANS, PLAN_ORDER, BILLING_CYCLES, CYCLE_ORDER, BONUS_DAYS, getPlanPrice, getTotalPrice, getAccessExpiry } from '../../config/plans'
import { SECTORS } from '../../config/app'
import { Check, ArrowLeft, ArrowRight, Loader, Calendar, Phone, Mail, Lock, User, Zap } from 'lucide-react'

const STEPS = ['Tu negocio', 'Tus datos', 'Plan de acceso']

// ── Utilidades ────────────────────────────────────────────────────────────────
const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })

function Field({ label, hint, icon: Icon, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        {Icon && (
          <Icon size={15} color={focused ? '#2563eb' : '#94a3b8'}
            style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        )}
        <input
          {...props}
          onFocus={e => { setFocused(true); props.onFocus?.(e) }}
          onBlur={e  => { setFocused(false); props.onBlur?.(e) }}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: Icon ? '10px 12px 10px 34px' : '10px 12px',
            borderRadius: '8px', fontSize: '14px', outline: 'none',
            border: `1.5px solid ${focused ? '#2563eb' : '#e2e8f0'}`,
            boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.10)' : 'none',
            transition: 'all .18s',
          }}
        />
      </div>
      {hint && <span style={{ fontSize: '11px', color: '#94a3b8' }}>{hint}</span>}
    </div>
  )
}

// ── Step 2: Selección de plan + ciclo ────────────────────────────────────────
function PlanStep({ form, setForm }) {
  const { plan, billingCycle } = form
  const cycleDays = BILLING_CYCLES[billingCycle]?.days ?? 30
  const expiryPreview = fmtDate(getAccessExpiry(new Date().toISOString(), billingCycle))
  const totalPrice = getTotalPrice(plan, billingCycle)
  const monthlyPrice = getPlanPrice(plan, billingCycle)
  const discount = BILLING_CYCLES[billingCycle]?.discountPct ?? 0
  const isFree = PLANS[plan]?.price === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Ciclo de facturación */}
      <div>
        <p style={{ fontSize: '12px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>
          Ciclo de facturación
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {CYCLE_ORDER.map(cid => {
            const c   = BILLING_CYCLES[cid]
            const sel = billingCycle === cid
            return (
              <button key={cid}
                onClick={() => setForm(f => ({ ...f, billingCycle: cid }))}
                style={{
                  padding: '8px 4px', borderRadius: '9px', cursor: 'pointer', textAlign: 'center',
                  border: sel ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                  background: sel ? '#eff6ff' : '#fff',
                  position: 'relative',
                }}>
                {c.discountPct > 0 && (
                  <div style={{
                    position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)',
                    background: '#22c55e', color: '#fff', fontSize: '9px', fontWeight: 800,
                    padding: '1px 6px', borderRadius: '10px', whiteSpace: 'nowrap',
                  }}>−{c.discountPct}%</div>
                )}
                <div style={{ fontSize: '11px', fontWeight: 700, color: sel ? '#2563eb' : '#374151' }}>{c.label}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>{c.shortLabel}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Plan */}
      <div>
        <p style={{ fontSize: '12px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>
          Elige tu plan
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {PLAN_ORDER.map(pid => {
            const p    = PLANS[pid]
            const sel  = plan === pid
            const mp   = getPlanPrice(pid, billingCycle)
            return (
              <button key={pid}
                onClick={() => setForm(f => ({ ...f, plan: pid }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', width: '100%',
                  border: sel ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                  background: sel ? '#eff6ff' : '#fff',
                  position: 'relative',
                }}>
                {p.badge && (
                  <span style={{ position: 'absolute', top: '-8px', right: '12px', background: 'linear-gradient(90deg,#f59e0b,#ef4444)', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '2px 8px', borderRadius: '10px' }}>
                    {p.badge}
                  </span>
                )}
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                  border: sel ? '5px solid #2563eb' : '2px solid #cbd5e1',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{p.label}</span>
                    <span style={{ fontWeight: 800, color: sel ? '#2563eb' : '#64748b', fontSize: '13px' }}>
                      {mp === 0 ? 'Gratis' : `S/ ${mp}/mes`}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{p.description}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Resumen de acceso */}
      <div style={{
        background: isFree ? '#f0fdf4' : '#eff6ff',
        border: `1px solid ${isFree ? '#bbf7d0' : '#bfdbfe'}`,
        borderRadius: '10px', padding: '14px 16px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: isFree ? '#15803d' : '#1d4ed8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={13} /> Resumen de acceso
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', color: isFree ? '#166534' : '#1e40af' }}>
          <div><b>Inicio:</b> {fmtDate(new Date().toISOString())}</div>
          <div><b>Vence:</b> {expiryPreview}</div>
          <div><b>Duración:</b> {cycleDays}d + {BONUS_DAYS}d bonus = {cycleDays + BONUS_DAYS}d</div>
          {!isFree && (
            <div>
              <b>Total:</b> S/ {totalPrice}
              {discount > 0 && <span style={{ marginLeft: '6px', background: '#22c55e', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '8px' }}>−{discount}%</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const preselectedPlan = location.state?.plan ?? 'trial'

  const [step, setStep]       = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(null)

  const [form, setForm] = useState({
    businessName: '', sector: 'bodega',
    ownerName: '', ownerEmail: '', phone: '', password: '', confirmPassword: '',
    plan: preselectedPlan, billingCycle: 'monthly',
  })

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const validateStep = () => {
    if (step === 0) {
      if (!form.businessName.trim()) return 'Ingresa el nombre de tu negocio'
    }
    if (step === 1) {
      if (!form.ownerName.trim())  return 'Ingresa el nombre del dueño / administrador'
      if (!form.ownerEmail.trim() || !form.ownerEmail.includes('@')) return 'Ingresa un email válido'
      if (!form.phone.trim() || form.phone.length < 9) return 'Ingresa un número de celular válido (9 dígitos)'
      if (form.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres'
      if (form.password !== form.confirmPassword) return 'Las contraseñas no coinciden'
    }
    return ''
  }

  const next = () => {
    const err = validateStep()
    if (err) { setError(err); return }
    setError(''); setStep(s => s + 1)
  }

  const submit = async () => {
    setLoading(true); setError('')
    const result = await tenantService.register({
      businessName: form.businessName,
      sector:       form.sector,
      ownerName:    form.ownerName,
      ownerEmail:   form.ownerEmail,
      phone:        form.phone,
      password:     form.password,
      plan:         form.plan,
      billingCycle: form.billingCycle,
    })
    setLoading(false)
    if (result.error) { setError(result.error); return }
    setDone(result.data)
  }

  // ── Pantalla de éxito ────────────────────────────────────────────────────────
  if (done) {
    const isFree = PLANS[done.plan]?.price === 0
    const cycleDays = BILLING_CYCLES[done.billingCycle ?? 'monthly']?.days ?? 30
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Check size={28} color="#fff" strokeWidth={3} />
          </div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>¡Tu negocio está listo!</h2>
          <p style={{ color: '#64748b', marginBottom: '16px', lineHeight: 1.6 }}>
            Creamos tu workspace en <strong>minimarket.app/app/{done.slug}</strong>
          </p>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', textAlign: 'left', fontSize: '13px', color: '#166534', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div><b>Plan:</b> {PLANS[done.plan]?.label}</div>
            <div><b>Ciclo:</b> {BILLING_CYCLES[done.billingCycle ?? 'monthly']?.label}</div>
            <div><b>Vigencia:</b> {cycleDays}d + {BONUS_DAYS}d bonus = {cycleDays + BONUS_DAYS} días</div>
            <div><b>Vence:</b> {fmtDate(done.accessExpiresAt)}</div>
            {!isFree && <div><b>Total pagado:</b> S/ {getTotalPrice(done.plan, done.billingCycle ?? 'monthly')}</div>}
          </div>
          <button onClick={() => { window.location.href = `/app/${done.slug}` }}
            style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>
            Ingresar a mi negocio →
          </button>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px' }}>
            Recibirás una confirmación en {form.ownerEmail}
          </p>
        </div>
      </div>
    )
  }

  // ── Formulario ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '520px', width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <button onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
            <ArrowLeft size={14} /> Volver al inicio
          </button>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Registra tu negocio</h1>
          <p style={{ color: '#64748b', fontSize: '13px' }}>30 días gratis · Sin tarjeta de crédito</p>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px' }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: i < step ? '#22c55e' : i === step ? '#2563eb' : '#e2e8f0', color: i <= step ? '#fff' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                  {i < step ? <Check size={13} strokeWidth={3} /> : i + 1}
                </div>
                <span style={{ fontSize: '10px', color: i === step ? '#2563eb' : '#94a3b8', fontWeight: i === step ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: '2px', background: i < step ? '#22c55e' : '#e2e8f0', margin: '0 6px 16px' }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px 28px' }}>

          {/* Paso 0: Negocio */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Field label="Nombre del negocio *" icon={Zap}
                placeholder="Ej: Bodega San Juan, Farmacia Flores..."
                value={form.businessName} onChange={set('businessName')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rubro del negocio</label>
                <select value={form.sector} onChange={set('sector')}
                  style={{ padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', background: '#fff', outline: 'none' }}>
                  {SECTORS.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Paso 1: Datos del dueño */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                Datos del dueño o administrador principal del negocio
              </div>
              <Field label="Nombre del dueño / administrador *" icon={User}
                placeholder="Juan Pérez López"
                value={form.ownerName} onChange={set('ownerName')} />
              <Field label="Correo electrónico *" icon={Mail} type="email"
                placeholder="juan@minegocio.com"
                hint="Te enviaremos alertas de vencimiento a este correo"
                value={form.ownerEmail} onChange={set('ownerEmail')} />
              <Field label="Número de celular *" icon={Phone} type="tel"
                placeholder="987 654 321"
                hint="Para alertas por WhatsApp/SMS cuando se acerque el vencimiento"
                value={form.phone} onChange={set('phone')}
                maxLength={12} />
              <Field label="Contraseña *" icon={Lock} type="password"
                placeholder="Mínimo 6 caracteres"
                value={form.password} onChange={set('password')} />
              <Field label="Confirmar contraseña *" icon={Lock} type="password"
                placeholder="Repite tu contraseña"
                value={form.confirmPassword} onChange={set('confirmPassword')} />
            </div>
          )}

          {/* Paso 2: Plan + Ciclo */}
          {step === 2 && <PlanStep form={form} setForm={setForm} />}

          {error && (
            <div style={{ marginTop: '14px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#dc2626' }}>
              {error}
            </div>
          )}

          {/* Acciones */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '22px', justifyContent: step > 0 ? 'space-between' : 'flex-end' }}>
            {step > 0 && (
              <button onClick={() => { setError(''); setStep(s => s - 1) }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                <ArrowLeft size={13} /> Atrás
              </button>
            )}
            {step < 2 ? (
              <button onClick={next}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 22px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                Continuar <ArrowRight size={13} />
              </button>
            ) : (
              <button onClick={submit} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 24px', borderRadius: '8px', border: 'none', background: loading ? '#94a3b8' : 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? <><Loader size={13} /> Creando...</> : 'Crear mi negocio →'}
              </button>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '14px' }}>
          ¿Ya tienes cuenta?{' '}
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
            Ir al inicio
          </button>
        </p>
      </div>
    </div>
  )
}
