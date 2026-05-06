/**
 * Stocktaking.jsx — Módulo de Inventario Físico
 * Ruta: src/features/inventory/Stocktaking.jsx
 *
 * FLUJO:
 *  1. Seleccionar categorías a contar (o todo el inventario)
 *  2. El sistema genera la hoja de conteo con stock teórico
 *  3. El usuario ingresa la cantidad física contada por producto
 *  4. El sistema calcula diferencias (sobrante/faltante/OK)
 *  5. Al confirmar, genera los ajustes de stock y movimientos documentados
 *
 * INTEGRACIÓN:
 * Agregar como view en Inventory.jsx:
 *   if (view === 'stocktaking') return <Stocktaking onBack={() => setView('main')}/>
 */

import { useState, useMemo, useCallback } from 'react'
import { useStore }                        from '../../store/index'
import { formatCurrency, formatDateTime }  from '../../shared/utils/helpers'
import toast                               from 'react-hot-toast'

const HALF_UP = (n) => Math.floor(Number(n) * 100 + 0.5) / 100

export default function Stocktaking({ onBack }) {
  const { products, categories, currentUser, updateProduct, addStockMovement, addAuditLog } = useStore()

  const [step, setStep]         = useState('setup')   // setup | count | review | done
  const [selCats, setSelCats]   = useState([])         // categorías seleccionadas (vacío = todas)
  const [counts, setCounts]     = useState({})          // { [productId]: qty }
  const [search, setSearch]     = useState('')
  const [filterDiff, setFilterDiff] = useState('all')  // all | diff | ok
  const [applying, setApplying] = useState(false)

  // Productos a contar (filtrados por categoría seleccionada)
  const productsToCount = useMemo(() =>
    products.filter((p) =>
      p.isActive &&
      (selCats.length === 0 || selCats.includes(p.categoryId))
    ).sort((a, b) => {
      const catA = categories.find((c) => c.id === a.categoryId)?.name || ''
      const catB = categories.find((c) => c.id === b.categoryId)?.name || ''
      return catA.localeCompare(catB) || a.name.localeCompare(b.name)
    })
  , [products, categories, selCats])

  // Productos filtrados en pantalla
  const filteredProducts = useMemo(() => {
    let list = productsToCount
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.barcode?.includes(search))
    }
    if (filterDiff === 'diff') list = list.filter((p) => {
      const cnt = counts[p.id]
      return cnt !== undefined && cnt !== '' && parseInt(cnt) !== p.stock
    })
    if (filterDiff === 'ok')   list = list.filter((p) => {
      const cnt = counts[p.id]
      return cnt !== undefined && cnt !== '' && parseInt(cnt) === p.stock
    })
    return list
  }, [productsToCount, search, filterDiff, counts])

  // Estadísticas del conteo
  const stats = useMemo(() => {
    const contados   = Object.keys(counts).filter((id) => counts[id] !== '' && counts[id] !== undefined).length
    const diferencias = productsToCount.filter((p) => {
      const cnt = parseInt(counts[p.id])
      return !isNaN(cnt) && cnt !== p.stock
    })
    const sobrantes = diferencias.filter((p) => parseInt(counts[p.id]) > p.stock)
    const faltantes = diferencias.filter((p) => parseInt(counts[p.id]) < p.stock)

    const valorDiferencia = diferencias.reduce((acc, p) => {
      const diff = parseInt(counts[p.id]) - p.stock
      return HALF_UP(acc + diff * (p.priceBuy || p.priceSell * 0.7))
    }, 0)

    return { contados, total: productsToCount.length, diferencias: diferencias.length, sobrantes: sobrantes.length, faltantes: faltantes.length, valorDiferencia }
  }, [counts, productsToCount])

  const handleCount = useCallback((productId, value) => {
    setCounts((prev) => ({ ...prev, [productId]: value }))
  }, [])

  const handleFillZeros = () => {
    const filled = {}
    productsToCount.forEach((p) => {
      if (counts[p.id] === undefined || counts[p.id] === '') filled[p.id] = 0
    })
    setCounts((prev) => ({ ...prev, ...filled }))
    toast.success('Ítems sin contar marcados como 0')
  }

  const handleApply = useCallback(async () => {
    setApplying(true)
    const now      = new Date().toISOString()
    const refNumber = `INV-${Date.now().toString().slice(-6)}`

    const adjustments = productsToCount
      .filter((p) => {
        const cnt = parseInt(counts[p.id])
        return !isNaN(cnt) && cnt !== p.stock
      })
      .map((p) => ({
        product:   p,
        prevStock: p.stock,
        newStock:  parseInt(counts[p.id]),
        diff:      parseInt(counts[p.id]) - p.stock,
      }))

    if (adjustments.length === 0) {
      toast('Sin diferencias que ajustar', { icon: 'ℹ️' })
      setApplying(false)
      return
    }

    // Aplicar ajustes
    for (const adj of adjustments) {
      updateProduct(adj.product.id, { stock: adj.newStock })
      addStockMovement({
        id:            crypto.randomUUID(),
        productId:     adj.product.id,
        productName:   adj.product.name,
        type:          adj.diff > 0 ? 'entrada' : 'salida',
        quantity:      Math.abs(adj.diff),
        previousStock: adj.prevStock,
        newStock:      adj.newStock,
        reason:        `Inventario físico ${refNumber} — ${adj.diff > 0 ? 'sobrante' : 'faltante'}`,
        userId:        currentUser?.id,
        userName:      currentUser?.fullName,
        createdAt:     now,
      })
    }

    addAuditLog({
      action:   'UPDATE',
      module:   'Inventario',
      detail:   `Inventario físico ${refNumber} · ${adjustments.length} ajustes · ${stats.sobrantes} sobrantes · ${stats.faltantes} faltantes`,
    })

    setApplying(false)
    setStep('done')
    toast.success(`Inventario aplicado — ${adjustments.length} productos ajustados`)
  }, [productsToCount, counts, currentUser, updateProduct, addStockMovement, addAuditLog, stats])

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">← Volver</button>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">Inventario Físico</h2>
          <p className="text-sm text-gray-400 dark:text-slate-500">Conteo y ajuste de stock real vs teórico</p>
        </div>
      </div>

      {/* ── PASO 1: CONFIGURACIÓN ─── */}
      {step === 'setup' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">¿Qué categorías contar?</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelCats([])}
                className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-all ${
                  selCats.length === 0 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-blue-300'
                }`}>
                📦 Todo el inventario ({products.filter(p => p.isActive).length} SKUs)
              </button>
              {categories.map((c) => {
                const count = products.filter(p => p.isActive && p.categoryId === c.id).length
                if (count === 0) return null
                return (
                  <button key={c.id}
                    onClick={() => setSelCats((prev) =>
                      prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                    )}
                    className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-all ${
                      selCats.includes(c.id) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-blue-300'
                    }`}>
                    {c.name} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 text-xs text-blue-700 dark:text-blue-300">
            <p className="font-semibold mb-1">📋 Instrucciones del proceso</p>
            <ol className="space-y-0.5 list-decimal list-inside">
              <li>Imprime la hoja de conteo (opcional) y da al personal</li>
              <li>El personal cuenta físicamente cada producto</li>
              <li>Ingresa las cantidades contadas en el sistema</li>
              <li>El sistema calcula diferencias automáticamente</li>
              <li>Revisa y confirma para ajustar el stock</li>
            </ol>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-slate-300">
              Se contarán <strong>{productsToCount.length} productos</strong>
              {selCats.length > 0 && ` de ${selCats.length} categoría(s)`}
            </p>
            <button
              onClick={() => { setCounts({}); setStep('count') }}
              disabled={productsToCount.length === 0}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors">
              Iniciar conteo →
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 2: CONTEO ─── */}
      {step === 'count' && (
        <div className="space-y-4">
          {/* Barra de progreso */}
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Progreso del conteo
              </span>
              <span className="text-sm font-bold text-blue-600">{stats.contados} / {stats.total}</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-2 bg-blue-500 rounded-full transition-all"
                style={{ width: `${stats.total > 0 ? (stats.contados / stats.total * 100) : 0}%` }}/>
            </div>
            {stats.diferencias > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                ⚠️ {stats.diferencias} diferencias detectadas
                ({stats.sobrantes} sobrantes · {stats.faltantes} faltantes)
              </p>
            )}
          </div>

          {/* Filtros + búsqueda */}
          <div className="flex gap-3 flex-wrap">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto o código..."
              className="flex-1 min-w-48 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
            />
            <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
              {[
                { key: 'all',  label: `Todos (${stats.total})` },
                { key: 'diff', label: `Diferencias (${stats.diferencias})` },
                { key: 'ok',   label: 'Sin diferencia' },
              ].map((f) => (
                <button key={f.key} onClick={() => setFilterDiff(f.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    filterDiff === f.key ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-gray-500 dark:text-slate-400'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={handleFillZeros}
              className="px-3 py-2 text-xs text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700">
              Marcar sin contar como 0
            </button>
          </div>

          {/* Tabla de conteo */}
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 dark:bg-slate-700/50 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
              <span className="col-span-5">Producto</span>
              <span className="col-span-2 text-right">Stock teórico</span>
              <span className="col-span-3 text-center">Conteo físico</span>
              <span className="col-span-2 text-right">Diferencia</span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-slate-700/60 max-h-[60vh] overflow-y-auto">
              {filteredProducts.map((product) => {
                const rawCount = counts[product.id]
                const counted  = rawCount !== undefined && rawCount !== '' ? parseInt(rawCount) : null
                const diff     = counted !== null ? counted - product.stock : null
                const hasDiff  = diff !== null && diff !== 0
                const catName  = categories.find((c) => c.id === product.categoryId)?.name || ''

                return (
                  <div key={product.id}
                    className={`grid grid-cols-12 gap-3 items-center px-4 py-3 transition-colors ${
                      hasDiff
                        ? diff > 0
                          ? 'bg-blue-50/60 dark:bg-blue-900/10'
                          : 'bg-red-50/60 dark:bg-red-900/10'
                        : counted !== null
                          ? 'bg-green-50/40 dark:bg-green-900/10'
                          : ''
                    }`}>
                    <div className="col-span-5 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {product.barcode} · {catName} · {product.unit}
                      </p>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">{product.stock}</span>
                    </div>
                    <div className="col-span-3 flex items-center justify-center gap-1">
                      <button onClick={() => handleCount(product.id, Math.max(0, (counted || 0) - 1))}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-500 hover:bg-red-100 hover:text-red-600 text-sm font-bold transition-colors">−</button>
                      <input
                        type="number" min="0" step="1"
                        value={rawCount ?? ''}
                        onChange={(e) => handleCount(product.id, e.target.value)}
                        placeholder="—"
                        className={`w-16 text-center text-sm font-bold border rounded-lg py-1.5 focus:outline-none focus:ring-2 transition-colors dark:bg-slate-700 dark:text-slate-100 ${
                          hasDiff
                            ? diff > 0
                              ? 'border-blue-300 focus:ring-blue-400 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-red-300 focus:ring-red-400 bg-red-50 dark:bg-red-900/20'
                            : counted !== null
                              ? 'border-green-300 focus:ring-green-400 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-slate-600 focus:ring-blue-500'
                        }`}
                      />
                      <button onClick={() => handleCount(product.id, (counted || 0) + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-500 hover:bg-green-100 hover:text-green-600 text-sm font-bold transition-colors">+</button>
                    </div>
                    <div className="col-span-2 text-right">
                      {diff !== null ? (
                        <span className={`text-sm font-bold ${
                          diff === 0 ? 'text-green-600 dark:text-green-400' :
                          diff > 0   ? 'text-blue-600 dark:text-blue-400' :
                                       'text-red-600 dark:text-red-400'
                        }`}>
                          {diff === 0 ? '✓' : `${diff > 0 ? '+' : ''}${diff}`}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-slate-600">—</span>
                      )}
                    </div>
                  </div>
                )
              })}
              {filteredProducts.length === 0 && (
                <div className="text-center py-10 text-gray-300 dark:text-slate-600 text-sm">
                  Sin productos que coincidan con el filtro
                </div>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 justify-between">
            <button onClick={() => setStep('setup')}
              className="px-4 py-2.5 text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700">
              ← Configuración
            </button>
            <button
              onClick={() => setStep('review')}
              disabled={stats.contados === 0}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors">
              Revisar resultados ({stats.contados} contados) →
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 3: REVISIÓN ─── */}
      {step === 'review' && (
        <div className="space-y-5">
          {/* Resumen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Productos contados', value: stats.contados,      color: 'text-gray-800 dark:text-slate-100', bg: 'bg-gray-50 dark:bg-slate-800/50' },
              { label: '✅ Sin diferencia',   value: stats.contados - stats.diferencias, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
              { label: '📦 Sobrantes',        value: stats.sobrantes,    color: 'text-blue-700 dark:text-blue-400',  bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { label: '⚠️ Faltantes',        value: stats.faltantes,    color: 'text-red-600 dark:text-red-400',   bg: 'bg-red-50 dark:bg-red-900/20' },
            ].map((k) => (
              <div key={k.label} className={`${k.bg} rounded-xl p-4`}>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {stats.diferencias > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/10">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Diferencias a ajustar ({stats.diferencias} productos)
                </h3>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Impacto económico estimado: {formatCurrency(Math.abs(stats.valorDiferencia))}
                  {stats.valorDiferencia > 0 ? ' (valor a ingresar)' : ' (valor a dar de baja)'}
                </p>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-slate-700/60 max-h-72 overflow-y-auto">
                {productsToCount
                  .filter((p) => {
                    const cnt = parseInt(counts[p.id])
                    return !isNaN(cnt) && cnt !== p.stock
                  })
                  .map((p) => {
                    const newStock = parseInt(counts[p.id])
                    const diff     = newStock - p.stock
                    return (
                      <div key={p.id} className="grid grid-cols-4 gap-4 px-4 py-3 text-sm">
                        <div className="col-span-2">
                          <p className="font-medium text-gray-800 dark:text-slate-100">{p.name}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">{p.barcode}</p>
                        </div>
                        <div className="text-center text-gray-500 dark:text-slate-400">
                          {p.stock} → <span className="font-bold text-gray-800 dark:text-slate-100">{newStock}</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-bold ${diff > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                            {diff > 0 ? '+' : ''}{diff} uds.
                          </span>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {stats.diferencias === 0 && stats.contados > 0 && (
            <div className="text-center py-8 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-green-700 dark:text-green-400 font-semibold">El inventario físico coincide con el teórico</p>
              <p className="text-xs text-green-500 mt-1">No hay diferencias que ajustar</p>
            </div>
          )}

          <div className="flex gap-3 justify-between">
            <button onClick={() => setStep('count')}
              className="px-4 py-2.5 text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700">
              ← Volver al conteo
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              className="px-6 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors flex items-center gap-2">
              {applying ? (
                <>⏳ Aplicando ajustes...</>
              ) : (
                <>✅ Confirmar y ajustar stock ({stats.diferencias} cambios)</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 4: COMPLETADO ─── */}
      {step === 'done' && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-8 text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h3 className="text-lg font-bold text-green-800 dark:text-green-300">Inventario físico completado</h3>
          <p className="text-sm text-green-600 dark:text-green-400">
            Los ajustes de stock han sido aplicados y registrados en el historial de movimientos.
            Cada ajuste queda documentado con referencia al inventario físico.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setStep('setup'); setCounts({}); setSelCats([]) }}
              className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm font-medium rounded-xl hover:bg-green-50 dark:hover:bg-green-900/30">
              Nuevo conteo
            </button>
            <button onClick={onBack}
              className="px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700">
              Volver al inventario
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
