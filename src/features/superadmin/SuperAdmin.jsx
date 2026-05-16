import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { tenantService } from '../../services/tenantService'
import { PLANS, PLAN_ORDER, BONUS_DAYS, BILLING_CYCLES, CYCLE_ORDER, getAccessExpiry, getPlanPrice, getTotalPrice, daysUntilExpiry, getAccessStatus, ACCESS_STATUS_CONFIG } from '../../config/plans'
import { SECTORS } from '../../config/app'
import {
  Shield, Users, Package, TrendingUp, RefreshCw, LogOut, ExternalLink,
  RotateCcw, Plus, Edit2, Trash2, X, Check, ChevronRight, Clock, History, DollarSign, Save,
  Globe, Phone, Mail, MapPin, MessageCircle,
} from 'lucide-react'

// ─── Utilidades ───────────────────────────────────────────────────────────────
const SUPERADMIN_PASS = 'superadmin2024'
const fmtDate  = (iso) => iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtTime  = (iso) => iso ? new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const isoToInput = (iso) => iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10)
const SECTOR_LABEL = (val) => SECTORS.find(s => s.value === val)?.label ?? val

const PLAN_STYLE = {
  trial:      { bg: '#f1f5f9', color: '#64748b' },
  basic:      { bg: '#eff6ff', color: '#2563eb' },
  pro:        { bg: '#f3e8ff', color: '#7c3aed' },
  enterprise: { bg: '#fef3c7', color: '#d97706' },
}

// ─── Sub-componentes reutilizables ────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, iconBg }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color="#fff" />
        </div>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function PlanBadge({ plan }) {
  const s = PLAN_STYLE[plan] ?? PLAN_STYLE.trial
  return (
    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.color }}>
      {PLANS[plan]?.label ?? plan}
    </span>
  )
}

function StatusBadge({ accessExpiresAt, isActive }) {
  const status = getAccessStatus(accessExpiresAt, isActive)
  const cfg    = ACCESS_STATUS_CONFIG[status]
  const days   = daysUntilExpiry(accessExpiresAt)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: cfg.bg, color: cfg.color, display: 'inline-block' }}>
        {cfg.label}
      </span>
      {days !== null && (
        <span style={{ fontSize: '10px', color: days < 0 ? '#dc2626' : days <= 5 ? '#d97706' : '#64748b', paddingLeft: '2px' }}>
          {days < 0 ? `Venció hace ${Math.abs(days)}d` : days === 0 ? 'Vence hoy' : `${days}d restantes`}
        </span>
      )}
    </div>
  )
}

function Modal({ title, onClose, children, width = 460 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 24px 24px' }}>{children}</div>
      </div>
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  padding: '9px 11px', borderRadius: '7px',
  border: '1.5px solid #e2e8f0', fontSize: '13px', outline: 'none',
  width: '100%', boxSizing: 'border-box',
}

// ─── Modal de Renovación ──────────────────────────────────────────────────────
function RenewModal({ tenant, onClose, onDone }) {
  const [plan,      setPlan]    = useState(tenant.plan)
  const [cycle,     setCycle]   = useState(tenant.billingCycle ?? 'monthly')
  const [startMode, setMode]    = useState('today')
  const [notes,     setNotes]   = useState('')
  const [loading,   setLoading] = useState(false)
  const [error,     setError]   = useState('')

  const baseDateISO = startMode === 'from_expiry' && tenant.accessExpiresAt && new Date(tenant.accessExpiresAt) > new Date()
    ? tenant.accessExpiresAt : new Date().toISOString()
  const previewExpiry = getAccessExpiry(baseDateISO, cycle)
  const cycleDays     = BILLING_CYCLES[cycle]?.days ?? 30
  const totalPrice    = getTotalPrice(plan, cycle)

  const submit = async () => {
    setLoading(true); setError('')
    const r = await tenantService.renewAccess(tenant.id, { plan, billingCycle: cycle, startMode, notes })
    setLoading(false)
    if (r.error) { setError(r.error); return }
    onDone()
  }

  return (
    <Modal title={`Renovar acceso — ${tenant.businessName}`} onClose={onClose} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Info actual */}
        <div style={{ background: '#f8fafc', borderRadius: '9px', padding: '12px 14px', fontSize: '13px', color: '#475569', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div><span style={{ fontWeight: 600 }}>Plan actual:</span> {PLANS[tenant.plan]?.label}</div>
          <div><span style={{ fontWeight: 600 }}>Vence:</span> {fmtDate(tenant.accessExpiresAt)}</div>
        </div>

        {/* Ciclo de facturación */}
        <FieldRow label="Ciclo de facturación">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
            {CYCLE_ORDER.map(cid => {
              const cfg = BILLING_CYCLES[cid]
              const sel = cycle === cid
              return (
                <button key={cid} onClick={() => setCycle(cid)} style={{
                  padding: '8px 6px', borderRadius: '8px', cursor: 'pointer',
                  border: `1.5px solid ${sel ? '#2563eb' : '#e2e8f0'}`,
                  background: sel ? '#eff6ff' : '#fff',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: sel ? '#2563eb' : '#0f172a' }}>{cfg.shortLabel}</span>
                  {cfg.discountPct > 0
                    ? <span style={{ fontSize: '9px', fontWeight: 700, background: '#dcfce7', color: '#16a34a', padding: '1px 5px', borderRadius: '10px' }}>-{cfg.discountPct}%</span>
                    : <span style={{ fontSize: '9px', color: '#94a3b8' }}>precio base</span>}
                </button>
              )
            })}
          </div>
        </FieldRow>

        {/* Plan */}
        <FieldRow label="Nuevo plan">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {PLAN_ORDER.map(pid => {
              const mp  = getPlanPrice(pid, cycle)
              const tp  = getTotalPrice(pid, cycle)
              const sel = plan === pid
              const months = BILLING_CYCLES[cycle]?.months ?? 1
              return (
                <label key={pid} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: `1.5px solid ${sel ? '#2563eb' : '#e2e8f0'}`, background: sel ? '#eff6ff' : '#fff', cursor: 'pointer' }}>
                  <input type="radio" name="plan" value={pid} checked={sel} onChange={() => setPlan(pid)} style={{ accentColor: '#2563eb' }} />
                  <span style={{ flex: 1, fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{PLANS[pid].label}</span>
                  <div style={{ textAlign: 'right' }}>
                    {mp === 0
                      ? <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>Gratis</span>
                      : <>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>S/ {mp}<span style={{ fontWeight: 400, color: '#94a3b8' }}>/mes</span></span>
                          {months > 1 && <div style={{ fontSize: '10px', color: '#64748b' }}>Total S/ {tp}</div>}
                        </>
                    }
                  </div>
                </label>
              )
            })}
          </div>
        </FieldRow>

        {/* Inicio de vigencia */}
        <FieldRow label="Inicio de la nueva vigencia">
          <div style={{ display: 'flex', gap: '8px' }}>
            {[['today', 'Desde hoy'], ['from_expiry', 'Desde vencimiento actual']].map(([v, l]) => (
              <label key={v} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 12px', borderRadius: '8px', border: `1.5px solid ${startMode === v ? '#2563eb' : '#e2e8f0'}`, background: startMode === v ? '#eff6ff' : '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                <input type="radio" name="startMode" checked={startMode === v} onChange={() => setMode(v)} style={{ accentColor: '#2563eb' }} />
                {l}
              </label>
            ))}
          </div>
        </FieldRow>

        {/* Vista previa */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '9px', padding: '12px 14px' }}>
          <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, marginBottom: '8px' }}>Vista previa del nuevo acceso</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '13px', color: '#166534' }}>
            <div><b>Inicio:</b> {fmtDate(baseDateISO)}</div>
            <div><b>Vence:</b> {fmtDate(previewExpiry)}</div>
            <div><b>Duración:</b> {cycleDays}d + {BONUS_DAYS} bonus = {cycleDays + BONUS_DAYS}d</div>
            {totalPrice > 0 && <div><b>Total a cobrar:</b> <span style={{ fontWeight: 800 }}>S/ {totalPrice}</span></div>}
          </div>
        </div>

        {/* Notas */}
        <FieldRow label="Notas (opcional)">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: Pago confirmado por Yape, referencia #12345" rows={2}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </FieldRow>

        {error && <div style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', padding: '9px 12px', borderRadius: '7px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={submit} disabled={loading} style={{ padding: '9px 22px', borderRadius: '8px', border: 'none', background: loading ? '#94a3b8' : 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Renovando...' : 'Confirmar renovación'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Modal de Acceso (crear / editar) ────────────────────────────────────────
function AccessFormModal({ access, tenantOptions, onClose, onDone }) {
  const isEdit = !!access

  const [tenantId,        setTenantId]        = useState(access?.tenantId ?? '')
  const [plan,            setPlan]            = useState(access?.plan ?? 'trial')
  const [cycle,           setCycle]           = useState(access?.billingCycle ?? 'monthly')
  const [accessStartDate, setAccessStartDate] = useState(isoToInput(access?.accessStartDate ?? new Date().toISOString()))
  const [bonusDays,       setBonusDays]       = useState(access?.bonusDays ?? BONUS_DAYS)
  const [notes,           setNotes]           = useState(access?.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const cycleDays     = BILLING_CYCLES[cycle]?.days ?? 30
  const previewExpiry = getAccessExpiry(new Date(accessStartDate).toISOString(), cycle)

  const submit = async () => {
    if (!tenantId) { setError('Selecciona un negocio'); return }
    setLoading(true); setError('')
    const isoStart = new Date(accessStartDate).toISOString()
    const r = isEdit
      ? await tenantService.updateAccess(access.id, { plan, billingCycle: cycle, accessStartDate: isoStart, bonusDays: Number(bonusDays), notes })
      : await tenantService.createAccess({ tenantId, plan, billingCycle: cycle, accessStartDate: isoStart, bonusDays: Number(bonusDays), notes })
    setLoading(false)
    if (r.error) { setError(r.error); return }
    onDone()
  }

  return (
    <Modal title={isEdit ? 'Editar acceso' : 'Nuevo acceso manual'} onClose={onClose} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        <FieldRow label="Negocio *">
          <select value={tenantId} onChange={e => setTenantId(e.target.value)} disabled={isEdit} style={inputStyle}>
            <option value="">— Selecciona un negocio —</option>
            {tenantOptions.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </FieldRow>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FieldRow label="Plan">
            <select value={plan} onChange={e => setPlan(e.target.value)} style={inputStyle}>
              {PLAN_ORDER.map(pid => <option key={pid} value={pid}>{PLANS[pid].label}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Días de bonus">
            <input type="number" min={0} max={30} value={bonusDays} onChange={e => setBonusDays(e.target.value)} style={inputStyle} />
          </FieldRow>
        </div>

        <FieldRow label="Ciclo">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '5px' }}>
            {CYCLE_ORDER.map(cid => {
              const cfg = BILLING_CYCLES[cid]
              const sel = cycle === cid
              return (
                <button key={cid} onClick={() => setCycle(cid)} style={{ padding: '6px 4px', borderRadius: '7px', cursor: 'pointer', border: `1.5px solid ${sel ? '#2563eb' : '#e2e8f0'}`, background: sel ? '#eff6ff' : '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: sel ? '#2563eb' : '#0f172a' }}>{cfg.shortLabel}</span>
                  {cfg.discountPct > 0 && <span style={{ fontSize: '9px', fontWeight: 700, background: '#dcfce7', color: '#16a34a', padding: '0 4px', borderRadius: '8px' }}>-{cfg.discountPct}%</span>}
                </button>
              )
            })}
          </div>
        </FieldRow>

        <FieldRow label="Fecha de inicio de acceso">
          <input type="date" value={accessStartDate} onChange={e => setAccessStartDate(e.target.value)} style={inputStyle} />
        </FieldRow>

        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#64748b' }}>
          Vencimiento calculado: <strong style={{ color: '#0f172a' }}>{fmtDate(previewExpiry)}</strong>
          &nbsp;({cycleDays}d + {bonusDays} bonus = {cycleDays + Number(bonusDays)}d)
        </div>

        <FieldRow label="Notas">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observaciones, número de pago, etc."
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </FieldRow>

        {error && <div style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', padding: '9px 12px', borderRadius: '7px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={submit} disabled={loading} style={{ padding: '9px 22px', borderRadius: '8px', border: 'none', background: loading ? '#94a3b8' : '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear acceso'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Tab: Negocios ────────────────────────────────────────────────────────────
function TenantsTab({ onRefreshStats }) {
  const [tenants, setTenants]   = useState([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [renewTarget, setRenewTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await tenantService.listAll({ search })
    if (r.data) setTenants(r.data)
    setLoading(false)
  }, [search])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const toggleActive = async (t) => {
    await tenantService.setActive(t.id, !t.isActive)
    load(); onRefreshStats()
  }

  const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }
  const tdStyle = { padding: '12px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' }

  return (
    <>
      {renewTarget && (
        <RenewModal tenant={renewTarget} onClose={() => setRenewTarget(null)} onDone={() => { setRenewTarget(null); load(); onRefreshStats() }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Negocios registrados</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar negocio o slug..."
            style={{ ...inputStyle, width: '220px' }} />
          <button onClick={load} disabled={loading} style={{ padding: '8px 12px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Negocio / Propietario', 'Rubro', 'Plan', 'Inicio acceso', 'Vence', 'Estado', 'Acciones'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && tenants.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>No hay negocios registrados</td></tr>
            )}
            {tenants.map(t => (
              <tr key={t.id} style={{ background: '#fff' }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{t.businessName}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{t.slug}</div>
                  {t.ownerName && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{t.ownerName} · {t.ownerEmail}</div>}
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: '12px', color: '#475569' }}>{SECTOR_LABEL(t.sector)}</span>
                </td>
                <td style={tdStyle}><PlanBadge plan={t.plan} /></td>
                <td style={{ ...tdStyle, fontSize: '12px', color: '#475569' }}>{fmtDate(t.accessStartDate)}</td>
                <td style={{ ...tdStyle, fontSize: '12px', color: '#475569' }}>{fmtDate(t.accessExpiresAt)}</td>
                <td style={tdStyle}><StatusBadge accessExpiresAt={t.accessExpiresAt} isActive={t.isActive} /></td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button onClick={() => window.open(`/app/${t.slug}`, '_blank')}
                      style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>
                      Ver
                    </button>
                    <button onClick={() => setRenewTarget(t)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: 'none', background: '#eff6ff', color: '#2563eb', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}>
                      <RotateCcw size={11} /> Renovar
                    </button>
                    <button onClick={() => toggleActive(t)}
                      style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: t.isActive ? '#fef2f2' : '#f0fdf4', color: t.isActive ? '#dc2626' : '#16a34a', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>
                      {t.isActive ? 'Suspender' : 'Activar'}
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

// ─── Tab: Gestión de Accesos (CRUD) ──────────────────────────────────────────
function AccessTab() {
  const [accesses, setAccesses]   = useState([])
  const [tenantOpts, setTOpts]    = useState([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [formTarget, setForm]     = useState(null)   // null | 'new' | access object
  const [deleteId, setDeleteId]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      tenantService.listAccesses({ search }),
      tenantService.getTenantOptions(),
    ])
    if (r1.data) setAccesses(r1.data)
    if (r2.data) setTOpts(r2.data)
    setLoading(false)
  }, [search])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const confirmDelete = async () => {
    await tenantService.deleteAccess(deleteId)
    setDeleteId(null); load()
  }

  const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0' }
  const tdStyle = { padding: '11px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '13px', color: '#374151', verticalAlign: 'middle' }

  return (
    <>
      {formTarget !== null && (
        <AccessFormModal
          access={formTarget === 'new' ? null : formTarget}
          tenantOptions={tenantOpts}
          onClose={() => setForm(null)}
          onDone={() => { setForm(null); load() }}
        />
      )}
      {deleteId && (
        <Modal title="Confirmar eliminación" onClose={() => setDeleteId(null)} width={380}>
          <p style={{ fontSize: '14px', color: '#475569', marginBottom: '20px' }}>¿Seguro que deseas eliminar este registro de acceso? Esta acción no se puede deshacer.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => setDeleteId(null)} style={{ padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={confirmDelete} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Eliminar</button>
          </div>
        </Modal>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Gestión de accesos</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar negocio..."
            style={{ ...inputStyle, width: '200px' }} />
          <button onClick={load} style={{ padding: '8px 12px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setForm('new')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '7px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={14} /> Nuevo acceso
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Negocio', 'Plan', 'Inicio', 'Vencimiento', 'Bonus', 'Estado', 'Notas', 'Acciones'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && accesses.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '13px' }}>No hay registros de acceso</td></tr>
            )}
            {accesses.map(a => {
              const status = getAccessStatus(a.accessExpiresAt, true)
              const scfg   = ACCESS_STATUS_CONFIG[status]
              return (
                <tr key={a.id}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{a.businessName}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>{a.tenantSlug}</div>
                  </td>
                  <td style={tdStyle}><PlanBadge plan={a.plan} /></td>
                  <td style={{ ...tdStyle, color: '#64748b' }}>{fmtDate(a.accessStartDate)}</td>
                  <td style={{ ...tdStyle, color: '#64748b' }}>{fmtDate(a.accessExpiresAt)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', fontSize: '11px', fontWeight: 700, color: '#475569' }}>+{a.bonusDays}d</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: scfg.bg, color: scfg.color }}>{scfg.label}</span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: '160px', color: '#94a3b8', fontSize: '12px' }}>{a.notes || '—'}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setForm(a)} style={{ padding: '5px 9px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }} title="Editar">
                        <Edit2 size={13} color="#374151" />
                      </button>
                      <button onClick={() => setDeleteId(a.id)} style={{ padding: '5px 9px', borderRadius: '6px', border: 'none', background: '#fef2f2', cursor: 'pointer' }} title="Eliminar">
                        <Trash2 size={13} color="#dc2626" />
                      </button>
                    </div>
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

// ─── Tab: Historial de Renovaciones ──────────────────────────────────────────
function HistoryTab() {
  const [renewals, setRenewals] = useState([])
  const [loading, setLoading]   = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await tenantService.getRenewals()
    if (r.data) setRenewals(r.data)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0' }
  const tdStyle = { padding: '11px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '13px', color: '#374151', verticalAlign: 'middle' }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Historial de renovaciones</h2>
        <button onClick={load} style={{ padding: '8px 12px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['Fecha', 'Negocio', 'Cambio de plan', 'Inicio', 'Vence', 'Quién renovó', 'Notas'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!loading && renewals.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '13px' }}>No hay registros de renovación</td></tr>
          )}
          {renewals.map(r => (
            <tr key={r.id}>
              <td style={{ ...tdStyle, color: '#64748b', whiteSpace: 'nowrap' }}>{fmtTime(r.renewedAt)}</td>
              <td style={tdStyle}><span style={{ fontWeight: 600, color: '#0f172a' }}>{r.businessName}</span></td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {r.previousPlan ? <PlanBadge plan={r.previousPlan} /> : <span style={{ fontSize: '11px', color: '#94a3b8' }}>—</span>}
                  {r.previousPlan && <ChevronRight size={12} color="#94a3b8" />}
                  <PlanBadge plan={r.newPlan} />
                </div>
              </td>
              <td style={{ ...tdStyle, color: '#64748b' }}>{fmtDate(r.accessStartDate)}</td>
              <td style={{ ...tdStyle, color: '#64748b' }}>{fmtDate(r.accessExpiresAt)}</td>
              <td style={tdStyle}>
                <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: r.renewedBy === 'superadmin' ? '#f3e8ff' : '#eff6ff', color: r.renewedBy === 'superadmin' ? '#7c3aed' : '#2563eb' }}>
                  {r.renewedBy === 'superadmin' ? 'Superadmin' : 'Auto-registro'}
                </span>
              </td>
              <td style={{ ...tdStyle, color: '#94a3b8', fontSize: '12px', maxWidth: '180px' }}>{r.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// ─── Tab: Precios ─────────────────────────────────────────────────────────────
const PAID_PLANS = PLAN_ORDER.filter(pid => PLANS[pid].price > 0)

function PricesTab() {
  const [prices,  setPrices]  = useState({})
  const [loading, setLoading] = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    tenantService.getPrices().then(r => { if (r.data) setPrices(r.data) })
  }, [])

  const set = (pid) => (e) => {
    const val = parseInt(e.target.value, 10)
    setPrices(p => ({ ...p, [pid]: isNaN(val) ? 0 : val }))
  }

  const save = async () => {
    setLoading(true); setError('')
    const r = await tenantService.updatePrices(prices)
    setLoading(false)
    if (r.error) { setError(r.error); return }
    setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 3px' }}>Precios de planes</h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Los cambios se reflejan de inmediato en la página de inicio.</p>
        </div>
        <button onClick={save} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 20px', borderRadius: '8px', border: 'none', background: loading ? '#94a3b8' : saved ? '#16a34a' : '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {saved ? <><Check size={14} /> Guardado</> : <><Save size={14} /> Guardar precios</>}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {PAID_PLANS.map(pid => {
          const plan = PLANS[pid]
          const base = prices[pid] ?? plan.price
          return (
            <div key={pid} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <PlanBadge plan={pid} />
                <span style={{ fontSize: '12px', color: '#64748b' }}>{plan.description}</span>
              </div>

              <FieldRow label="Precio base (S/ / mes)">
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#64748b', fontWeight: 700 }}>S/</span>
                  <input
                    type="number" min={0} max={9999} value={base}
                    onChange={set(pid)}
                    style={{ ...inputStyle, paddingLeft: '30px', fontWeight: 700, fontSize: '15px' }}
                  />
                </div>
              </FieldRow>

              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Precio por ciclo</div>
                {CYCLE_ORDER.map(cid => {
                  const cfg = BILLING_CYCLES[cid]
                  const monthly = Math.round(base * (1 - cfg.discountPct / 100))
                  const total   = monthly * cfg.months
                  return (
                    <div key={cid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#475569', padding: '5px 8px', borderRadius: '6px', background: '#f8fafc' }}>
                      <span style={{ fontWeight: 600 }}>{cfg.label}</span>
                      <span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>S/ {monthly}/mes</span>
                        {cfg.months > 1 && <span style={{ color: '#94a3b8', marginLeft: '6px' }}>· Total S/ {total}</span>}
                        {cfg.discountPct > 0 && <span style={{ marginLeft: '6px', background: '#dcfce7', color: '#16a34a', fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '8px' }}>-{cfg.discountPct}%</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {error && <div style={{ marginTop: '16px', fontSize: '13px', color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: '8px' }}>{error}</div>}

      <div style={{ marginTop: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', fontSize: '12px', color: '#64748b' }}>
        <strong style={{ color: '#374151' }}>Nota:</strong> El plan <em>Prueba gratuita</em> siempre es S/ 0 y no es editable. Los precios se guardan en el almacenamiento local del navegador y se aplican hasta conectar el backend.
      </div>
    </div>
  )
}

// ─── SiteTab — Configuración del sitio / landing ──────────────────────────────
const SITE_FIELDS = [
  {
    section: 'Marca',
    fields: [
      { key: 'brandName', label: 'Nombre del sistema', placeholder: 'MiniMarket POS', icon: Globe },
      { key: 'tagline',   label: 'Eslogan / badge del hero', placeholder: 'Sistema POS para retail minorista en Perú', icon: Globe },
    ],
  },
  {
    section: 'Contacto',
    fields: [
      { key: 'phone',    label: 'Teléfono de soporte',   placeholder: '+51 999 888 777', icon: Phone },
      { key: 'whatsapp', label: 'WhatsApp',              placeholder: '+51 999 888 777', icon: MessageCircle },
      { key: 'email',    label: 'Correo de contacto',    placeholder: 'soporte@minimarketpos.com', icon: Mail },
      { key: 'address',  label: 'Dirección / ciudad',    placeholder: 'Lima, Perú', icon: MapPin },
    ],
  },
  {
    section: 'Redes sociales',
    note: 'Deja vacío para ocultar el enlace en el footer.',
    fields: [
      { key: 'facebook',  label: 'Facebook',  placeholder: 'https://facebook.com/minimarketpos', icon: Globe },
      { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/minimarketpos', icon: Globe },
      { key: 'tiktok',    label: 'TikTok',    placeholder: 'https://tiktok.com/@minimarketpos', icon: Globe },
    ],
  },
]

function SiteTab() {
  const [form,    setForm]    = useState({})
  const [loading, setLoading] = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    tenantService.getSiteSettings().then(r => { if (r.data) setForm(r.data) })
  }, [])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const save = async () => {
    setLoading(true); setError('')
    const r = await tenantService.updateSiteSettings(form)
    setLoading(false)
    if (r.error) { setError(r.error); return }
    setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 3px' }}>Configuración del sitio</h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Los cambios se reflejan de inmediato en la página de inicio.</p>
        </div>
        <button onClick={save} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 20px', borderRadius: '8px', border: 'none', background: loading ? '#94a3b8' : saved ? '#16a34a' : '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {saved ? <><Check size={14} /> Guardado</> : <><Save size={14} /> Guardar cambios</>}
        </button>
      </div>

      {/* Secciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {SITE_FIELDS.map(({ section, note, fields }) => (
          <div key={section} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{section}</div>
              {note && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>{note}</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {fields.map(({ key, label, placeholder, icon: Icon }) => ( // eslint-disable-line no-unused-vars
                <FieldRow key={key} label={label}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                      <Icon size={14} color="#94a3b8" />
                    </div>
                    <input
                      value={form[key] ?? ''}
                      onChange={set(key)}
                      placeholder={placeholder}
                      style={{ ...inputStyle, paddingLeft: '32px' }}
                    />
                  </div>
                </FieldRow>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <div style={{ marginTop: '16px', fontSize: '13px', color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: '8px' }}>{error}</div>}

      {/* Vista previa de uso */}
      <div style={{ marginTop: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          Vista previa — Footer de la landing
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {[
            { icon: Globe,          val: form.brandName, label: 'Marca' },
            { icon: Phone,          val: form.phone,     label: 'Teléfono' },
            { icon: MessageCircle,  val: form.whatsapp,  label: 'WhatsApp' },
            { icon: Mail,           val: form.email,     label: 'Email' },
            { icon: MapPin,         val: form.address,   label: 'Dirección' },
          ].map(({ icon: Icon, val, label }) => val ? ( // eslint-disable-line no-unused-vars
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
              <Icon size={13} color="#2563eb" />
              <span style={{ fontWeight: 500 }}>{val}</span>
            </div>
          ) : null)}
        </div>
        {!form.phone && !form.email && !form.address && (
          <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Completa los datos de contacto para verlos aquí.</div>
        )}
      </div>
    </div>
  )
}

// ─── LoginForm ────────────────────────────────────────────────────────────────
function LoginForm({ onLogin }) {
  const [pass, setPass]   = useState('')
  const [error, setError] = useState('')
  const submit = (e) => { e.preventDefault(); pass === SUPERADMIN_PASS ? onLogin() : setError('Contraseña incorrecta') }
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '36px', width: '360px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>SuperAdmin</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>MiniMarket POS</div>
          </div>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input type="password" placeholder="Contraseña de superadmin" value={pass} onChange={e => setPass(e.target.value)}
            style={{ padding: '11px 14px', borderRadius: '9px', border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '14px', outline: 'none' }} />
          {error && <div style={{ fontSize: '13px', color: '#f87171' }}>{error}</div>}
          <button type="submit" style={{ padding: '11px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
            Ingresar
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── SuperAdmin principal ─────────────────────────────────────────────────────
const TABS = [
  { id: 'tenants', label: 'Negocios',            icon: Users        },
  { id: 'access',  label: 'Gestión de Accesos',  icon: Package      },
  { id: 'history', label: 'Historial',           icon: History      },
  { id: 'prices',  label: 'Precios',             icon: DollarSign   },
  { id: 'site',    label: 'Sitio web',           icon: Globe        },
]

export default function SuperAdmin() {
  const navigate = useNavigate()
  const [auth, setAuth]   = useState(false)
  const [tab, setTab]     = useState('tenants')
  const [stats, setStats] = useState({ total: 0, active: 0, trial: 0, expiring: 0 })

  const loadStats = useCallback(async () => {
    const r = await tenantService.listAll()
    if (!r.data) return
    const all = r.data
    setStats({
      total:    all.length,
      active:   all.filter(t => t.isActive).length,
      trial:    all.filter(t => t.plan === 'trial').length,
      expiring: all.filter(t => {
        const s = getAccessStatus(t.accessExpiresAt, t.isActive)
        return s === 'expiring' || s === 'expired'
      }).length,
    })
  }, [])

  useEffect(() => { if (auth) loadStats() /* eslint-disable-line react-hooks/set-state-in-effect */ }, [auth, loadStats])

  if (!auth) return <LoginForm onLogin={() => setAuth(true)} />

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Nav */}
      <nav style={{ background: '#0f172a', padding: '0 24px', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={15} color="#fff" />
          </div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>SuperAdmin</span>
          <span style={{ color: '#475569', fontSize: '12px' }}>· MiniMarket POS</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: '12px', cursor: 'pointer' }}>
            <ExternalLink size={12} /> Landing
          </button>
          <button
            onClick={() => { if (window.prompt('Escribe RESET para borrar todos los datos de prueba:') === 'RESET') { tenantService._resetMock(); loadStats(); window.location.reload() } }}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', fontSize: '11px', cursor: 'pointer' }}
            title="Solo desarrollo — escribe RESET para confirmar">
            <RefreshCw size={11} /> Reset
          </button>
          <button onClick={() => setAuth(false)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '7px', border: 'none', background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: '12px', cursor: 'pointer' }}>
            <LogOut size={12} /> Salir
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <StatCard icon={Users}      label="Negocios totales"  value={stats.total}    iconBg="#2563eb" />
          <StatCard icon={Shield}     label="Negocios activos"  value={stats.active}   iconBg="#16a34a" />
          <StatCard icon={Package}    label="En prueba (trial)" value={stats.trial}    iconBg="#f59e0b" />
          <StatCard icon={TrendingUp} label="Por vencer / Vencidos" value={stats.expiring} iconBg="#ef4444" sub="Requieren atención" />
        </div>

        {/* Tabs */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)} style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '13px 20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                background: tab === id ? '#fff' : 'transparent',
                color: tab === id ? '#2563eb' : '#64748b',
                borderBottom: tab === id ? '2px solid #2563eb' : '2px solid transparent',
                transition: 'all .15s',
              }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <div style={{ padding: '20px' }}>
            {tab === 'tenants' && <TenantsTab onRefreshStats={loadStats} />}
            {tab === 'access'  && <AccessTab />}
            {tab === 'history' && <HistoryTab />}
            {tab === 'prices'  && <PricesTab />}
            {tab === 'site'    && <SiteTab />}
          </div>
        </div>

      </div>
    </div>
  )
}
