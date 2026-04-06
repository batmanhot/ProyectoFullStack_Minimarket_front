import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supplierSchema } from '../../shared/schemas/index'
import { supplierService } from '../../services/index'
import { formatDate, formatCurrency } from '../../shared/utils/helpers'
import { useDebounce } from '../../shared/hooks/useDebounce'
import Modal from '../../shared/components/ui/Modal'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import toast from 'react-hot-toast'

function SupplierForm({ supplier, onClose }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(supplierSchema),
    defaultValues: supplier || {},
  })

  const onSubmit = async (data) => {
    const result = supplier
      ? await supplierService.update(supplier.id, data)
      : await supplierService.create(data)
    if (result.error) { toast.error(result.error); return }
    toast.success(supplier ? 'Proveedor actualizado' : 'Proveedor creado')
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
          <label className="block text-xs font-medium text-gray-600 mb-1">RUC / Nro. tributario</label>
          <input {...register('taxId')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Contacto</label>
          <input {...register('contact')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
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
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
          <textarea {...register('notes')} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
        <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          {supplier ? 'Guardar cambios' : 'Crear proveedor'}
        </button>
      </div>
    </form>
  )
}

export default function Suppliers() {
  const { suppliers, products, purchases } = useStore()
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const dq = useDebounce(search, 150)

  const filtered = useMemo(() => {
    let list = suppliers.filter(s => s.isActive !== false)
    if (dq) {
      const q = dq.toLowerCase()
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.taxId?.includes(q))
    }
    return list
  }, [suppliers, dq])

  const getSupplierStats = (supplierId) => {
    const supplierPurchases = purchases.filter(p => p.supplierId === supplierId)
    const totalComprado = supplierPurchases.reduce((a, p) => a + (p.total || 0), 0)
    const productCount = products.filter(p => p.supplierId === supplierId && p.isActive).length
    return { totalComprado, productCount, purchaseCount: supplierPurchases.length }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-800">Proveedores</h1>
          <p className="text-sm text-gray-400">{filtered.length} registros</p>
        </div>
        <button onClick={() => setModal({ type: 'form', data: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nuevo proveedor
        </button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por nombre o RUC..."
        className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>

      {filtered.length === 0 ? (
        <EmptyState icon="🏭" title="No hay proveedores" message="Agrega tu primer proveedor para comenzar."
          action={{ label: 'Nuevo proveedor', onClick: () => setModal({ type: 'form', data: null }) }}/>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Proveedor</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Contacto</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Productos</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Total comprado</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(s => {
                const stats = getSupplierStats(s.id)
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-800">{s.name}</div>
                      {s.taxId && <div className="text-xs text-gray-400">RUC: {s.taxId}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-600">{s.contact || '—'}</div>
                      <div className="text-xs text-gray-400">{s.phone || ''}{s.phone && s.email ? ' · ' : ''}{s.email || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-gray-700">{stats.productCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-gray-700">{formatCurrency(stats.totalComprado)}</span>
                      <div className="text-xs text-gray-400">{stats.purchaseCount} compras</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setModal({ type: 'form', data: s })}
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === 'form' && (
        <Modal title={modal.data ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={() => setModal(null)}>
          <SupplierForm supplier={modal.data} onClose={() => setModal(null)}/>
        </Modal>
      )}
    </div>
  )
}
