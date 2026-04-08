import { useState } from 'react'
import { useStore } from '../../store/index'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { userSchema } from '../../shared/schemas/index'
import { formatDate } from '../../shared/utils/helpers'
import { ROLES } from '../../config/app'
import { RoleBadge } from '../../shared/components/ui/Badge'
import Modal from '../../shared/components/ui/Modal'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import toast from 'react-hot-toast'

// FIX: ya no desestructura addProduct ni stores — usa addUser/updateUser correctamente
function UserForm({ user, onClose }) {
  const { addUser, updateUser } = useStore()
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: user || { role: 'cajero', isActive: true },
  })

  const onSubmit = (data) => {
    if (user) {
      // FIX: llamar la función correctamente con paréntesis y argumentos
      updateUser(user.id, data)
      toast.success('Usuario actualizado')
    } else {
      addUser({ ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() })
      toast.success('Usuario creado')
    }
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Nombre completo *</label>
          <input {...register('fullName')} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Usuario *</label>
          <input {...register('username')} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Rol *</label>
          <select {...register('role')} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Email *</label>
          <input {...register('email')} type="email" className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">Cancelar</button>
        <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{user ? 'Guardar' : 'Crear usuario'}</button>
      </div>
    </form>
  )
}

const ROLE_PERMS = {
  admin:      ['Ventas','Inventario','Caja','Clientes','Proveedores','Compras','Reportes','Usuarios'],
  gerente:    ['Ventas','Inventario','Caja','Clientes','Proveedores','Compras','Reportes'],
  supervisor: ['Ventas','Inventario','Caja','Clientes'],
  cajero:     ['Ventas','Caja'],
}

export default function Users() {
  const { users, updateUser } = useStore()
  const [modal, setModal]     = useState(null)
  const [confirm, setConfirm] = useState(null)

  const handleToggleActive = (u) => {
    updateUser(u.id, { isActive: !u.isActive })
    toast.success(`Usuario ${u.isActive ? 'desactivado' : 'activado'}`)
    setConfirm(null)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Usuarios del sistema</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">{users.filter(u => u.isActive).length} activos</p>
        </div>
        <button onClick={() => setModal({ type: 'form', data: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nuevo usuario
        </button>
      </div>

      {/* Tabla de permisos */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Permisos por rol</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(ROLE_PERMS).map(([role, perms]) => (
            <div key={role} className="rounded-lg border border-gray-100 dark:border-slate-700 p-3">
              <RoleBadge role={role}/>
              <ul className="mt-2 space-y-1">
                {perms.map(p => <li key={p} className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1"><span className="text-green-500">✓</span>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
              {['Usuario','Email','Rol','Creado','Estado','Acciones'].map(h => (
                <th key={h} className={`text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3 ${h === 'Acciones' || h === 'Estado' ? 'text-center' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {users.map(u => (
              <tr key={u.id} className={`hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 transition-colors ${!u.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-semibold text-blue-600">{u.fullName?.[0] || u.username?.[0]}</div>
                    <div><div className="text-sm font-medium text-gray-800 dark:text-slate-100">{u.fullName}</div><div className="text-xs text-gray-400 dark:text-slate-500">@{u.username}</div></div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{u.email}</td>
                <td className="px-4 py-3"><RoleBadge role={u.role}/></td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                    {u.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setModal({ type: 'form', data: u })} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Editar">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    </button>
                    <button onClick={() => setConfirm(u)} className={`p-1.5 rounded-lg transition-colors ${u.isActive ? 'text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 dark:text-slate-500 hover:text-green-600 hover:bg-green-50'}`} title={u.isActive ? 'Desactivar' : 'Activar'}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={u.isActive ? 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'}/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.type === 'form' && (
        <Modal title={modal.data ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setModal(null)}>
          <UserForm user={modal.data} onClose={() => setModal(null)}/>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.isActive ? '¿Desactivar usuario?' : '¿Activar usuario?'}
          message={confirm.isActive ? `${confirm.fullName} no podrá ingresar al sistema.` : `${confirm.fullName} podrá volver a ingresar al sistema.`}
          confirmLabel={confirm.isActive ? 'Desactivar' : 'Activar'}
          variant={confirm.isActive ? 'danger' : 'primary'}
          onConfirm={() => handleToggleActive(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
