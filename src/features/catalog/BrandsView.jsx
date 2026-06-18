import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { brandService } from '../../services/index'
import { ImportButton } from '../../shared/components/ui/ExportButtons'
import ExcelImportModal from '../../shared/components/ui/ExcelImportModal'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import Modal from '../../shared/components/ui/Modal'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import { BrandForm } from './BrandForm'
import toast from 'react-hot-toast'

export function BrandsView({ brands, products }) {
  const { updateBrand } = useStore()
  const [search, setSearch]             = useState('')
  const [modal, setModal]               = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [importOpen, setImportOpen]     = useState(false)
  const dq = useDebounce(search, 150)
  const filtered = useMemo(() => { const list = brands || []; if (!dq) return list; const q = dq.toLowerCase(); return list.filter(b => b.name.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q)) }, [brands, dq])
  const productCount = (brandName) => products.filter(p => p.brand === brandName && p.isActive).length

  const handleDelete = async (brand) => {
    if (productCount(brand.name) > 0) { toast.error(`No se puede eliminar: tiene ${productCount(brand.name)} productos activos`); setDeleteTarget(null); return }
    const result = await brandService.remove(brand.id)
    if (result?.error) { toast.error(result.error); setDeleteTarget(null); return }
    toast.success(`Marca "${brand.name}" eliminada`); setDeleteTarget(null)
  }

  const toggleActive = (brand) => { updateBrand(brand.id, { isActive: !brand.isActive }); toast.success(`Marca "${brand.name}" ${brand.isActive ? 'desactivada' : 'activada'}`) }
  const activeBrands = (brands || []).filter(b => b.isActive).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3"><p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Total marcas</p><p className="text-2xl font-semibold text-gray-800 dark:text-slate-100">{(brands || []).length}</p></div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3"><p className="text-xs text-green-600 dark:text-green-400 mb-1">Marcas activas</p><p className="text-2xl font-semibold text-green-700 dark:text-green-300">{activeBrands}</p></div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3"><p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Con productos</p><p className="text-2xl font-semibold text-purple-700 dark:text-purple-300">{(brands || []).filter(b => productCount(b.name) > 0).length}</p></div>
      </div>
      <div className="flex gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar marca..." className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <ImportButton onClick={() => setImportOpen(true)} label="Importar Excel" />
        <button onClick={() => setModal({ data: null })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>Nueva marca</button>
      </div>
      {filtered.length === 0 ? <EmptyState icon="🏷️" title="No hay marcas" action={{ label: 'Nueva marca', onClick: () => setModal({ data: null }) }}/> : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">{['','Marca','Descripción','Productos','Estado','Acciones'].map(h => <th key={h} className={`text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3 ${h === 'Productos' || h === 'Estado' || h === 'Acciones' ? 'text-center' : 'text-left'}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {filtered.map(brand => {
                const count = productCount(brand.name)
                return (
                  <tr key={brand.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${!brand.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 w-10"><div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: brand.color || '#94a3b8' }}>{brand.name.charAt(0)}</div></td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-slate-100">{brand.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 max-w-xs truncate">{brand.description || '—'}</td>
                    <td className="px-4 py-3 text-center"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${count > 0 ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>{count}</span></td>
                    <td className="px-4 py-3 text-center"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${brand.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>{brand.isActive ? 'Activa' : 'Inactiva'}</span></td>
                    <td className="px-4 py-3"><div className="flex items-center justify-center gap-1">
                      <button onClick={() => setModal({ data: brand })} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                      <button onClick={() => toggleActive(brand)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={brand.isActive ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"}/></svg></button>
                      <button onClick={() => setDeleteTarget(brand)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                    </div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50"><p className="text-xs text-gray-400 dark:text-slate-500">{filtered.length} marca{filtered.length !== 1 ? 's' : ''}</p></div>
        </div>
      )}
      {modal !== null && <Modal title={modal.data ? 'Editar marca' : 'Nueva marca'} size="sm" onClose={() => setModal(null)}><BrandForm brand={modal.data} onClose={() => setModal(null)}/></Modal>}
      {deleteTarget && <ConfirmModal title="¿Eliminar marca?" message={productCount(deleteTarget.name) > 0 ? `Esta marca tiene ${productCount(deleteTarget.name)} productos activos. No puede eliminarse.` : `"${deleteTarget.name}" será eliminada permanentemente.`} confirmLabel="Eliminar" variant="danger" onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)}/>}
      {importOpen && <ExcelImportModal entityType="brands" onClose={() => setImportOpen(false)} />}
    </div>
  )
}
