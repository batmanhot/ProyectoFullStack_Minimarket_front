import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clientSchema } from '../../shared/schemas/index'
import { clientService } from '../../services/index'
import { formatCurrency, formatDate } from '../../shared/utils/helpers'
import { useDebounce } from '../../shared/hooks/useDebounce'
import Modal from '../../shared/components/ui/Modal'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import toast from 'react-hot-toast'

function ClientForm({ client, onClose }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: client || { documentType: 'DNI', creditLimit: 0 },
  })
  const onSubmit = async (data) => {
    const result = client ? await clientService.update(client.id, data) : await clientService.create(data)
    if (result.error) { toast.error(result.error); return }
    toast.success(client ? 'Cliente actualizado' : 'Cliente registrado')
    onClose()
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre / Razón social *</label>
          <input {...register('name')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo documento</label>
          <select {...register('documentType')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {['DNI','RUC','CE','Pasaporte'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Número *</label>
          <input {...register('documentNumber')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          {errors.documentNumber && <p className="text-xs text-red-500 mt-1">{errors.documentNumber.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
          <input {...register('phone')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input {...register('email')} type="email" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
          <input {...register('address')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Límite de crédito (S/)</label>
          <input type="number" step="50" {...register('creditLimit')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
        <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{client ? 'Guardar' : 'Registrar cliente'}</button>
      </div>
    </form>
  )
}

function ClientDetail({ client, sales, onClose }) {
  const clientSales = useMemo(() =>
    sales.filter(s => s.clientId === client.id && s.status === 'completada')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  , [sales, client.id])

  const totalComprado = clientSales.reduce((a, s) => a + s.total, 0)
  const creditAvailable = (client.creditLimit || 0) - (client.currentDebt || 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Total comprado</p><p className="text-lg font-semibold text-gray-800">{formatCurrency(totalComprado)}</p></div>
        <div className="bg-blue-50 rounded-xl p-3"><p className="text-xs text-blue-600 mb-1">Compras</p><p className="text-lg font-semibold text-blue-700">{clientSales.length}</p></div>
        <div className={`rounded-xl p-3 ${client.currentDebt > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <p className={`text-xs mb-1 ${client.currentDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>Deuda actual</p>
          <p className={`text-lg font-semibold ${client.currentDebt > 0 ? 'text-red-700' : 'text-green-700'}`}>{formatCurrency(client.currentDebt || 0)}</p>
          {client.creditLimit > 0 && <p className="text-xs text-gray-500">Límite: {formatCurrency(client.creditLimit)} · Disp: {formatCurrency(creditAvailable)}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {client.phone && <div><p className="text-xs text-gray-400">Teléfono</p><p className="text-gray-700">{client.phone}</p></div>}
        {client.email && <div><p className="text-xs text-gray-400">Email</p><p className="text-gray-700">{client.email}</p></div>}
        {client.address && <div className="col-span-2"><p className="text-xs text-gray-400">Dirección</p><p className="text-gray-700">{client.address}</p></div>}
        <div><p className="text-xs text-gray-400">Cliente desde</p><p className="text-gray-700">{formatDate(client.createdAt)}</p></div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Historial de compras</h3>
        {clientSales.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Sin compras registradas</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {clientSales.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                <div>
                  <span className="font-mono text-xs text-gray-500">{s.invoiceNumber}</span>
                  <span className="text-gray-400 text-xs ml-2">{formatDate(s.createdAt)}</span>
                </div>
                <span className="font-medium text-gray-800">{formatCurrency(s.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Clients() {
  const { clients, sales } = useStore()
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const dq = useDebounce(search, 150)

  const debtTotal = clients.filter(c => c.isActive && c.currentDebt > 0).reduce((a, c) => a + (c.currentDebt || 0), 0)

  const filtered = useMemo(() => {
    let list = clients.filter(c => c.isActive)
    if (dq) {
      const q = dq.toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.documentNumber.includes(q) || c.phone?.includes(q))
    }
    return list
  }, [clients, dq])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800">Clientes</h1>
          <p className="text-sm text-gray-400">{filtered.length} registros{debtTotal > 0 && <span className="ml-2 text-red-400">· Por cobrar: {formatCurrency(debtTotal)}</span>}</p>
        </div>
        <button onClick={() => setModal({ type: 'form', data: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nuevo cliente
        </button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por nombre, documento o teléfono..."
        className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>

      {filtered.length === 0 ? (
        <EmptyState icon="👥" title="No hay clientes" message="Registra tu primer cliente."
          action={{ label: 'Nuevo cliente', onClick: () => setModal({ type: 'form', data: null }) }}/>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Cliente','Documento','Contacto','Crédito disp.','Deuda','Acciones'].map(h => (
                  <th key={h} className={`text-xs font-medium text-gray-500 px-4 py-3 ${['Crédito disp.','Deuda'].includes(h) ? 'text-right' : h === 'Acciones' ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => {
                const cnt = sales.filter(s => s.clientId === c.id && s.status === 'completada').length
                const avail = (c.creditLimit || 0) - (c.currentDebt || 0)
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-semibold text-blue-600">{c.name[0]}</div>
                        <div><div className="text-sm font-medium text-gray-800">{c.name}</div><div className="text-xs text-gray-400">{cnt} compras</div></div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c.documentType}</span><span className="text-xs text-gray-600 ml-1">{c.documentNumber}</span></td>
                    <td className="px-4 py-3"><div className="text-xs text-gray-600">{c.phone || '—'}</div><div className="text-xs text-gray-400">{c.email || ''}</div></td>
                    <td className="px-4 py-3 text-right">
                      {c.creditLimit > 0
                        ? <span className={`text-sm font-medium ${avail > 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(avail)}</span>
                        : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${(c.currentDebt || 0) > 0 ? 'text-red-500' : 'text-green-600'}`}>{formatCurrency(c.currentDebt || 0)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setModal({ type: 'detail', data: c })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Ver historial">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        </button>
                        <button onClick={() => setModal({ type: 'form', data: c })} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Editar">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === 'form' && (
        <Modal title={modal.data ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setModal(null)}>
          <ClientForm client={modal.data} onClose={() => setModal(null)}/>
        </Modal>
      )}
      {modal?.type === 'detail' && (
        <Modal title={modal.data.name} subtitle={`${modal.data.documentType}: ${modal.data.documentNumber}`} onClose={() => setModal(null)}>
          <ClientDetail client={modal.data} sales={sales} onClose={() => setModal(null)}/>
        </Modal>
      )}
    </div>
  )
}
