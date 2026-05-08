/**
 * Users.jsx — Gestión de usuarios y permisos v2
 * Ruta: src/features/users/Users.jsx
 */
import { useState, useMemo } from 'react'
import { useStore }           from '../../store/index'
import { useForm }            from 'react-hook-form'
import { zodResolver }        from '@hookform/resolvers/zod'
import { userSchema }         from '../../shared/schemas/index'
import { formatDate }         from '../../shared/utils/helpers'
import { ROLES }              from '../../config/app'
import { RoleBadge }          from '../../shared/components/ui/Badge'
import Modal                  from '../../shared/components/ui/Modal'
import ConfirmModal           from '../../shared/components/ui/ConfirmModal'
import toast                  from 'react-hot-toast'

// ─── Todas las páginas del sistema ────────────────────────────────────────────
const ALL_PAGES = [
  { key: 'dashboard',  label: 'Dashboard',         icon: '📊', group: 'principal'   },
  { key: 'pos',        label: 'Punto de Venta',     icon: '🛒', group: 'principal'   },
  { key: 'catalog',    label: 'Catálogo',           icon: '📦', group: 'operaciones' },
  { key: 'inventory',  label: 'Inventario',         icon: '🗃️', group: 'operaciones' },
  { key: 'purchases',  label: 'Compras',            icon: '🛍️', group: 'operaciones' },
  { key: 'suppliers',  label: 'Proveedores',        icon: '🏭', group: 'operaciones' },
  { key: 'cash',       label: 'Caja',               icon: '💰', group: 'comercial'   },
  { key: 'clients',    label: 'Clientes',           icon: '👥', group: 'comercial'   },
  { key: 'returns',    label: 'Devoluciones',       icon: '↩️', group: 'comercial'   },
  { key: 'discounts',  label: 'Descuentos',         icon: '🏷️', group: 'comercial'   },
  { key: 'tickets',    label: 'Vales descuento',    icon: '🎟️', group: 'comercial'   },
  { key: 'loyalty',    label: 'Prog. de Puntos',    icon: '⭐', group: 'comercial'   },
  { key: 'reports',    label: 'Reportes',           icon: '📈', group: 'analisis'    },
  { key: 'alerts',     label: 'Alertas',            icon: '🔔', group: 'sistema'     },
  { key: 'audit',      label: 'Auditoría',          icon: '🔍', group: 'sistema'     },
  { key: 'users',      label: 'Usuarios',           icon: '👤', group: 'sistema'     },
  { key: 'settings',   label: 'Configuración',      icon: '⚙️', group: 'sistema'     },
]

const PAGE_GROUPS = {
  principal:   'Principal',
  operaciones: 'Operaciones',
  comercial:   'Comercial',
  analisis:    'Análisis',
  sistema:     'Sistema',
}

const ROLE_ORDER = ['admin', 'gerente', 'supervisor', 'cajero']

const RC = {
  admin:      { bg: 'bg-blue-600',   light: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',     border: 'border-blue-200 dark:border-blue-800'   },
  gerente:    { bg: 'bg-purple-600', light: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  supervisor: { bg: 'bg-amber-500',  light: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',   border: 'border-amber-200 dark:border-amber-800'   },
  cajero:     { bg: 'bg-green-600',  light: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',   border: 'border-green-200 dark:border-green-800'   },
}

// ─── Formulario de usuario ────────────────────────────────────────────────────
function UserForm({ user, onClose }) {
  const { addUser, updateUser, users } = useStore()
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: user || { role: 'cajero', isActive: true },
  })
  const selectedRole = watch('role')
  const rolePages    = ROLES[selectedRole]?.pages || []

  const onSubmit = (data) => {
    if (user) {
      updateUser(user.id, data)
      toast.success('Usuario actualizado')
    } else {
      if (users.find(u => u.username === data.username)) { toast.error('El nombre de usuario ya existe'); return }
      addUser({ ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() })
      toast.success('Usuario creado')
    }
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Nombre completo *</label>
          <input {...register('fullName')} placeholder="Ej: María García López"
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"/>
          {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Usuario *</label>
          <input {...register('username')} placeholder="Ej: mgarcial" autoComplete="off"
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"/>
          {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Rol *</label>
          <select {...register('role')}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100">
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Email *</label>
          <input {...register('email')} type="email" placeholder="mgarcial@negocio.pe"
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"/>
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>
      </div>

      {/* Preview de módulos del rol */}
      <div className={`rounded-xl border p-4 ${RC[selectedRole]?.light} ${RC[selectedRole]?.border}`}>
        <p className="text-xs font-semibold mb-2">
          Módulos habilitados para <strong>{ROLES[selectedRole]?.label}</strong> ({rolePages.length} de {ALL_PAGES.length}):
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_PAGES.filter(p => rolePages.includes(p.key)).map(p => (
            <span key={p.key} className="text-xs px-2 py-0.5 bg-white/70 dark:bg-slate-800/70 rounded-full border border-current/20 font-medium">
              {p.icon} {p.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="isActive" {...register('isActive')} className="rounded"/>
        <label htmlFor="isActive" className="text-sm text-gray-600 dark:text-slate-300">Usuario activo</label>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
          Cancelar
        </button>
        <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          {user ? 'Guardar cambios' : 'Crear usuario'}
        </button>
      </div>
    </form>
  )
}

// ─── Editor de permisos por rol ───────────────────────────────────────────────
function RolesPermissionsEditor() {
  const [localRoles, setLocalRoles] = useState(() => {
    try { const s = localStorage.getItem('pos_role_overrides'); if (s) return JSON.parse(s) } catch {}
    return Object.fromEntries(Object.entries(ROLES).map(([k,v]) => [k, { ...v, pages: [...v.pages] }]))
  })

  const togglePage = (role, page) => {
    if (role === 'admin') { toast.error('El rol Admin siempre tiene acceso total'); return }
    setLocalRoles(prev => {
      const pages    = prev[role].pages || []
      const newPages = pages.includes(page) ? pages.filter(p => p !== page) : [...pages, page]
      const updated  = { ...prev, [role]: { ...prev[role], pages: newPages } }
      localStorage.setItem('pos_role_overrides', JSON.stringify(updated))
      return updated
    })
  }

  const handleReset = (role) => {
    setLocalRoles(prev => {
      const updated = { ...prev, [role]: { ...ROLES[role], pages: [...ROLES[role].pages] } }
      localStorage.setItem('pos_role_overrides', JSON.stringify(updated))
      return updated
    })
    toast.success(`Permisos de ${ROLES[role]?.label} restaurados`)
  }

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400">
        ⚠️ Los cambios aplican de forma inmediata en este navegador. Al integrar el backend se persistirán en la base de datos.
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 px-4 py-3 w-52">Módulo</th>
                {ROLE_ORDER.map(role => (
                  <th key={role} className="px-4 py-3 text-center w-32">
                    <div className="flex flex-col items-center gap-1.5">
                      <RoleBadge role={role}/>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500">
                        {localRoles[role]?.pages?.length || 0} módulos
                      </span>
                      {role !== 'admin' && (
                        <button onClick={() => handleReset(role)}
                          className="text-[10px] text-blue-500 hover:text-blue-700 transition-colors underline">
                          Restaurar
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PAGE_GROUPS).map(([groupKey, groupLabel]) => {
                const groupPages = ALL_PAGES.filter(p => p.group === groupKey)
                return [
                  <tr key={`g-${groupKey}`}>
                    <td colSpan={5} className="px-4 py-2 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest bg-gray-50/50 dark:bg-slate-700/20 border-t border-gray-100 dark:border-slate-700">
                      {groupLabel}
                    </td>
                  </tr>,
                  ...groupPages.map(page => (
                    <tr key={page.key} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors border-t border-gray-50 dark:border-slate-700/50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span>{page.icon}</span>
                          <span className="text-sm text-gray-700 dark:text-slate-300">{page.label}</span>
                        </div>
                      </td>
                      {ROLE_ORDER.map(role => {
                        const hasAccess = localRoles[role]?.pages?.includes(page.key)
                        const isAdmin   = role === 'admin'
                        return (
                          <td key={role} className="px-4 py-2.5 text-center">
                            <button
                              onClick={() => togglePage(role, page.key)}
                              disabled={isAdmin}
                              title={isAdmin ? 'Admin tiene acceso total' : hasAccess ? 'Quitar acceso' : 'Dar acceso'}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all ${
                                isAdmin
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 cursor-default'
                                  : hasAccess
                                    ? `${RC[role]?.light} hover:opacity-70 cursor-pointer`
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-300 dark:text-slate-600 hover:bg-gray-200 dark:hover:bg-slate-600 cursor-pointer'
                              }`}>
                              {hasAccess
                                ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))
                ]
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLE_ORDER.map(role => {
          const pages = localRoles[role]?.pages || []
          return (
            <div key={role} className={`rounded-xl border p-4 ${RC[role]?.light} ${RC[role]?.border}`}>
              <div className="flex items-center justify-between mb-2">
                <RoleBadge role={role}/>
                <span className="text-xs font-bold">{pages.length}/{ALL_PAGES.length}</span>
              </div>
              <div className="h-1.5 bg-white/40 dark:bg-black/20 rounded-full overflow-hidden">
                <div className={`h-1.5 rounded-full ${RC[role]?.bg} transition-all`}
                  style={{ width: `${(pages.length / ALL_PAGES.length) * 100}%` }}/>
              </div>
              <p className="text-xs mt-1.5 opacity-70">{pages.length} módulos habilitados</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Users() {
  const { users, sales, updateUser, activeCashSession } = useStore()
  const [modal,      setModal]      = useState(null)
  const [confirm,    setConfirm]    = useState(null)
  const [activeTab,  setActiveTab]  = useState('usuarios')
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('todos')

  const filtered = useMemo(() => {
    let list = users
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(u => u.fullName?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    }
    if (roleFilter !== 'todos') list = list.filter(u => u.role === roleFilter)
    return list
  }, [users, search, roleFilter])

  const ventasTurno = useMemo(() => {
    if (!activeCashSession) return {}
    const map = {}
    sales.filter(s => s.status === 'completada' && new Date(s.createdAt) >= new Date(activeCashSession.openedAt))
      .forEach(s => { map[s.userId] = (map[s.userId] || 0) + 1 })
    return map
  }, [sales, activeCashSession])

  const kpis = useMemo(() => ({
    total:    users.length,
    activos:  users.filter(u => u.isActive).length,
    inactivos:users.filter(u => !u.isActive).length,
    porRol:   Object.fromEntries(ROLE_ORDER.map(r => [r, users.filter(u => u.role === r).length])),
  }), [users])

  const handleToggleActive = (u) => {
    updateUser(u.id, { isActive: !u.isActive })
    toast.success(`Usuario ${u.isActive ? 'desactivado' : 'activado'}`)
    setConfirm(null)
  }

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Usuarios del sistema</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">
            {kpis.activos} activos · {kpis.inactivos} inactivos · {kpis.total} total
          </p>
        </div>
        <button onClick={() => setModal({ type: 'form', data: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Nuevo usuario
        </button>
      </div>

      {/* KPIs por rol */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{kpis.activos}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Activos</p>
        </div>
        {ROLE_ORDER.map(role => (
          <div key={role} className={`rounded-xl border p-3 text-center ${RC[role]?.light} ${RC[role]?.border}`}>
            <p className="text-2xl font-bold">{kpis.porRol[role] || 0}</p>
            <p className="text-xs mt-0.5 opacity-80">{ROLES[role]?.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1 w-fit">
        {[{ key:'usuarios', label:'👥 Usuarios' }, { key:'permisos', label:'🔐 Roles y Permisos' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab === t.key
                ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
            }`}>{t.label}
          </button>
        ))}
      </div>

      {/* ══ TAB: USUARIOS ══════════════════════════════════════════════════ */}
      {activeTab === 'usuarios' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, usuario o email..."
              className="flex-1 min-w-48 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"/>
            <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
              {[{k:'todos',l:'Todos'}, ...ROLE_ORDER.map(r => ({k:r, l:ROLES[r]?.label}))].map(f => (
                <button key={f.k} onClick={() => setRoleFilter(f.k)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    roleFilter === f.k ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400'
                  }`}>{f.l}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                  {['Usuario','Email','Rol','Módulos','Creado','Estado','Acciones'].map(h => (
                    <th key={h} className={`text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-3 ${
                      ['Acciones','Estado','Módulos'].includes(h) ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {filtered.map(u => {
                  const pageCount  = ROLES[u.role]?.pages?.length || 0
                  const turnoCount = ventasTurno[u.id] || 0
                  return (
                    <tr key={u.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${!u.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${RC[u.role]?.bg}`}>
                            {u.fullName?.[0]?.toUpperCase() || u.username?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-800 dark:text-slate-100">{u.fullName}</div>
                            <div className="text-xs text-gray-400 dark:text-slate-500">@{u.username}</div>
                            {turnoCount > 0 && (
                              <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                                🟢 {turnoCount} venta{turnoCount > 1 ? 's' : ''} en turno
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{u.email}</td>
                      <td className="px-4 py-3"><RoleBadge role={u.role}/></td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-bold text-gray-700 dark:text-slate-200">{pageCount}</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 block">módulos</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          u.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                        }`}>{u.isActive ? 'Activo' : 'Inactivo'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setModal({ type: 'form', data: u })}
                            className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Editar">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                          </button>
                          <button onClick={() => setConfirm(u)}
                            className={`p-1.5 rounded-lg transition-colors ${u.isActive ? 'text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-gray-400 dark:text-slate-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                            title={u.isActive ? 'Desactivar' : 'Activar'}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={u.isActive ? 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'}/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-300 dark:text-slate-600">
                <div className="text-4xl mb-2">👤</div>
                <p className="text-sm">Sin usuarios que coincidan</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: ROLES Y PERMISOS ═════════════════════════════════════════ */}
      {activeTab === 'permisos' && <RolesPermissionsEditor/>}

      {modal?.type === 'form' && (
        <Modal title={modal.data ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setModal(null)}>
          <UserForm user={modal.data} onClose={() => setModal(null)}/>
        </Modal>
      )}
      {confirm && (
        <ConfirmModal
          title={confirm.isActive ? '¿Desactivar usuario?' : '¿Activar usuario?'}
          message={confirm.isActive ? `${confirm.fullName} no podrá ingresar al sistema.` : `${confirm.fullName} podrá volver a ingresar.`}
          confirmLabel={confirm.isActive ? 'Desactivar' : 'Activar'}
          variant={confirm.isActive ? 'danger' : 'primary'}
          onConfirm={() => handleToggleActive(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
