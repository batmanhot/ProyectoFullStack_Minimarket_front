import { useState, useMemo, useEffect } from 'react'
import { useStore } from '../../store/index'
import { VariantManager } from './VariantManager'

export function VariantesView({ products }) {
  const { productVariants } = useStore()
  const [search, setSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState(null)
  const variantProducts = useMemo(() => { const q = search.toLowerCase(); return products.filter(p => p.isActive && p.hasVariants && (!q || p.name.toLowerCase().includes(q) || p.barcode.includes(q))) }, [products, search])
  useEffect(() => { if (!selectedProductId && variantProducts.length > 0) setSelectedProductId(variantProducts[0].id) }, [variantProducts, selectedProductId])
  const selectedProduct = products.find(p => p.id === selectedProductId)

  return (
    <div className="flex gap-4 min-h-[520px]">
      <div className="w-96 shrink-0 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-100 dark:border-slate-700"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..." className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-800 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"/></div>
        <div className="flex-1 overflow-y-auto">
          {variantProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-400 dark:text-slate-500"><span className="text-3xl mb-2">🎨</span><p className="text-xs">{search ? 'Sin resultados' : 'Ningún producto tiene variantes activas. Activa la opción en el formulario del producto.'}</p></div>
          ) : variantProducts.map(p => {
            const count = productVariants.filter(v => v.productId === p.id).length; const isSelected = p.id === selectedProductId
            return (
              <button key={p.id} onClick={() => setSelectedProductId(p.id)} className={`w-full text-left px-3 py-2.5 border-b border-gray-50 dark:border-slate-700/50 transition-colors ${isSelected ? 'bg-purple-50 dark:bg-purple-900/30 border-l-2 border-l-purple-500' : 'hover:bg-gray-50 dark:hover:bg-slate-700/40 border-l-2 border-l-transparent'}`}>
                <p className={`text-sm font-medium truncate ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-gray-800 dark:text-slate-100'}`}>{p.name}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{count > 0 ? <span className="text-purple-500 dark:text-purple-400 font-medium">{count} variante{count !== 1 ? 's' : ''}</span> : <span>Sin variantes aún</span>}</p>
              </button>
            )
          })}
        </div>
        <div className="p-2 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50"><p className="text-xs text-center text-gray-400 dark:text-slate-500">{variantProducts.length} producto{variantProducts.length !== 1 ? 's' : ''} con variantes</p></div>
      </div>
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        {selectedProduct ? (
          <div className="h-full flex flex-col">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3"><span className="text-lg">🎨</span><div><p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{selectedProduct.name}</p><p className="text-xs text-gray-400 dark:text-slate-500">{selectedProduct.barcode}</p></div></div>
            <div className="flex-1 overflow-y-auto p-4"><VariantManager productId={selectedProduct.id} /></div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 p-8 text-center"><span className="text-5xl mb-4">🎨</span><p className="text-base font-medium text-gray-600 dark:text-slate-300 mb-1">Gestión de variantes</p><p className="text-sm">Selecciona un producto de la lista para ver y editar sus variantes</p></div>
        )}
      </div>
    </div>
  )
}
