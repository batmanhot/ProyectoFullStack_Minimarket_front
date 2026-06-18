import { useState, useEffect } from 'react'
import { useStore } from '../../store/index'
import { productService, categoryService, brandService } from '../../services/index'
import { USE_API } from '../../services/_base'
import { ProductsView } from './ProductsView'
import { CategoriesView } from './CategoriesView'
import { BrandsView } from './BrandsView'
import { BatchesView } from './BatchesView'
import { VariantesView } from './VariantesView'
import { SerialesView } from './SerialesView'

export { printPriceLabels } from './PriceLabels'

export default function Catalog() {
  const { products, categories, brands, suppliers, businessConfig, addAuditLog, productVariants } = useStore()
  const [tab, setTab] = useState('products')

  useEffect(() => {
    if (USE_API) { productService.getAll(); categoryService.getAll(); brandService.getAll() }
  }, [])

  const tabs = [
    { key: 'products',   label: 'Productos',  icon: '📦', count: products.filter(p => p.isActive).length },
    { key: 'categories', label: 'Categorías', icon: '🗂️', count: categories.length },
    { key: 'brands',     label: 'Marcas',     icon: '🏷️', count: (brands || []).filter(b => b.isActive).length },
    { key: 'batches',    label: 'Lotes',      icon: '🔢', count: products.filter(p => p.useBatches).length },
    { key: 'variants',   label: 'Variantes',  icon: '🎨', count: productVariants.length },
    { key: 'seriales',   label: 'Seriales',   icon: '🔑', count: products.filter(p => p.stockControl === 'serie' && p.isActive).length },
  ]

  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Catálogo</h1><p className="text-sm text-gray-400 dark:text-slate-500">Gestión de productos, categorías y marcas</p></div>
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-700/60 rounded-xl p-1 w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>
            <span>{t.icon}</span><span>{t.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tab === t.key ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-slate-400'}`}>{t.count}</span>
          </button>
        ))}
      </div>
      {tab === 'products'   && <ProductsView products={products} categories={categories} brands={brands || []} suppliers={suppliers} businessConfig={businessConfig} addAuditLog={addAuditLog}/>}
      {tab === 'categories' && <CategoriesView categories={categories} products={products}/>}
      {tab === 'brands'     && <BrandsView brands={brands || []} products={products}/>}
      {tab === 'batches'    && <BatchesView products={products} suppliers={suppliers}/>}
      {tab === 'variants'   && <VariantesView products={products}/>}
      {tab === 'seriales'   && <SerialesView products={products}/>}
    </div>
  )
}
