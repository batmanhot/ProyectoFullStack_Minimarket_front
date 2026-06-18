import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { categoryService } from '../../services/index'
import { formatDate } from '../../shared/utils/helpers'
import { ImportButton } from '../../shared/components/ui/ExportButtons'
import ExcelImportModal from '../../shared/components/ui/ExcelImportModal'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import Modal from '../../shared/components/ui/Modal'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import { CategoryForm } from './CategoryForm'
import { ColorDot } from './catalog.shared'
import toast from 'react-hot-toast'

export function CategoriesView({ categories, products }) {
  const { deleteCategory } = useStore()
  const [search, setSearch]             = useState('')
  const [modal, setModal]               = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [importOpen, setImportOpen]     = useState(false)
  const dq = useDebounce(search, 150)
  const filtered = useMemo(() => { if (!dq) return categories; const q = dq.toLowerCase(); return categories.filter(c => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)) }, [categories, dq])
  const productCount = (catId) => products.filter(p => p.categoryId === catId && p.isActive).length

  const handleDelete = async (cat) => {
    if (productCount(cat.id) > 0) { toast.error(`No se puede eliminar: tiene ${productCount(cat.id)} productos activos`); setDeleteTarget(null); return }
    const result = await categoryService.remove(cat.id)
    if (result?.error) { toast.error(result.error); setDeleteTarget(null); return }
    toast.success(`Categoría "${cat.name}" eliminada`); setDeleteTarget(null)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3"><p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Total categorías</p><p className="text-2xl font-semibold text-gray-800 dark:text-slate-100">{categories.length}</p></div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3"><p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Con productos</p><p className="text-2xl font-semibold text-blue-700 dark:text-blue-300">{categories.filter(c => productCount(c.id) > 0).length}</p></div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3"><p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Sin productos</p><p className="text-2xl font-semibold text-amber-700 dark:text-amber-300">{categories.filter(c => productCount(c.id) === 0).length}</p></div>
      </div>
      <div className="flex gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar categoría..." className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <ImportButton onClick={() => setImportOpen(true)} label="Importar Excel" />
        <button onClick={() => setModal({ data: null })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>Nueva categoría</button>
      </div>
      {filtered.length === 0 ? <EmptyState icon="🗂️" title="No hay categorías" action={{ label: 'Nueva categoría', onClick: () => setModal({ data: null }) }}/> : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">{['Color','Nombre','Descripción','Productos activos','Creada','Acciones'].map(h => <th key={h} className={`text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3 ${h === 'Productos activos' || h === 'Acciones' ? 'text-center' : 'text-left'}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {filtered.map(cat => {
                const count = productCount(cat.id)
                return (
                  <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                    <td className="px-4 py-3 w-12"><ColorDot color={cat.color} size="lg"/></td>
                    <td className="px-4 py-3"><span className="text-sm font-semibold text-gray-800 dark:text-slate-100">{cat.name}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400 max-w-xs truncate">{cat.description || <span className="text-gray-300 dark:text-slate-600 italic">Sin descripción</span>}</td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex items-center justify-center text-xs font-semibold px-2.5 py-1 rounded-full ${count > 0 ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'}`}>{count} producto{count !== 1 ? 's' : ''}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500">{cat.createdAt ? formatDate(cat.createdAt) : '—'}</td>
                    <td className="px-4 py-3"><div className="flex items-center justify-center gap-1">
                      <button onClick={() => setModal({ data: cat })} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                      <button onClick={() => setDeleteTarget(cat)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                    </div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50"><p className="text-xs text-gray-400 dark:text-slate-500">{filtered.length} categoría{filtered.length !== 1 ? 's' : ''}</p></div>
        </div>
      )}
      {modal !== null && <Modal title={modal.data ? 'Editar categoría' : 'Nueva categoría'} size="sm" onClose={() => setModal(null)}><CategoryForm category={modal.data} onClose={() => setModal(null)}/></Modal>}
      {deleteTarget && <ConfirmModal title="¿Eliminar categoría?" message={productCount(deleteTarget.id) > 0 ? `Esta categoría tiene ${productCount(deleteTarget.id)} productos activos. No puede eliminarse.` : `"${deleteTarget.name}" será eliminada permanentemente.`} confirmLabel="Eliminar" variant="danger" onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)}/>}
      {importOpen && <ExcelImportModal entityType="categories" onClose={() => setImportOpen(false)} />}
    </div>
  )
}
