/**
 * Stocktaking.jsx — Módulo de Inventario Físico v2
 * Ruta: src/features/inventory/Stocktaking.jsx
 *
 * FLUJO DE 4 PASOS:
 *  1. CONFIGURAR  → seleccionar categorías a contar y responsable
 *  2. CONTAR      → ingresar cantidad física por producto (barra de progreso)
 *  3. REVISAR     → ver diferencias sobrantes/faltantes antes de confirmar
 *  4. COMPLETADO  → ajustes aplicados, movimientos registrados, resumen final
 *
 * INTEGRACIÓN (ya existe en Inventory.jsx):
 *   if (view === 'stocktaking') return <Stocktaking onBack={() => setView('main')} />
 */

import { useState, useMemo, useCallback, useRef } from 'react'
import { useStore }                                from '../../store/index'
import { formatCurrency, formatDateTime }           from '../../shared/utils/helpers'
import toast                                        from 'react-hot-toast'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const HALF_UP = (n) => Math.floor(Number(n) * 100 + 0.5) / 100

function calcDiff(item, counts) {
  const raw = counts[item.id]
  if (raw === undefined || raw === '') return null
  return parseInt(raw, 10) - item.stock
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function StepIndicator({ current }) {
  const steps = [
    { n: 1, label: 'Configurar' },
    { n: 2, label: 'Contar'     },
    { n: 3, label: 'Revisar'    },
    { n: 4, label: 'Listo'      },
  ]
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              current > s.n  ? 'bg-emerald-500 text-white' :
              current === s.n ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40' :
                               'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
            }`}>
              {current > s.n
                ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                : s.n}
            </div>
            <span className={`text-xs mt-1 font-medium ${current === s.n ? 'text-blue-600 dark:text-blue-400' : current > s.n ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 w-16 mx-1 mb-5 transition-all ${current > s.n ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-slate-700'}`}/>
          )}
        </div>
      ))}
    </div>
  )
}

function DiffBadge({ diff }) {
  if (diff === null) return <span className="text-xs text-gray-300 dark:text-slate-600">—</span>
  if (diff === 0)    return <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓</span>
  return (
    <span className={`text-sm font-bold ${diff > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
      {diff > 0 ? '+' : ''}{diff}
    </span>
  )
}

// ─── PASO 1: Configurar ───────────────────────────────────────────────────────
function StepConfig({ categories, products, selCats, setSelCats, onStart }) {
  const allActive = products.filter(p => p.isActive)

  const countByCat = useMemo(() => {
    const map = {}
    allActive.forEach(p => { map[p.categoryId] = (map[p.categoryId] || 0) + 1 })
    return map
  }, [allActive])

  const toCount = selCats.length === 0
    ? allActive.length
    : allActive.filter(p => selCats.includes(p.categoryId)).length

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5">📋</span>
          <div>
            <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1">¿Cómo funciona el inventario físico?</p>
            <ol className="space-y-1 text-sm text-blue-700 dark:text-blue-400 list-decimal list-inside">
              <li>Selecciona las categorías que quieres contar (o todo el inventario)</li>
              <li>El sistema genera la hoja de conteo con el stock teórico actual</li>
              <li>Ingresa las cantidades que contaste físicamente</li>
              <li>El sistema calcula diferencias y genera ajustes automáticos</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Selector de categorías */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
          ¿Qué categorías vas a contar?
        </h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Todo el inventario */}
          <button
            onClick={() => setSelCats([])}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
              selCats.length === 0
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
            }`}>
            <span>📦</span>
            <span>Todo el inventario</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${selCats.length === 0 ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
              {allActive.length}
            </span>
          </button>

          {/* Por categoría */}
          {categories.filter(c => countByCat[c.id] > 0).map(c => {
            const sel = selCats.includes(c.id)
            return (
              <button key={c.id}
                onClick={() => setSelCats(prev =>
                  prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                )}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                  sel
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}>
                <span>{c.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${sel ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                  {countByCat[c.id]}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-700">
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Se contarán <strong className="text-gray-900 dark:text-slate-100">{toCount} productos</strong>
            {selCats.length > 0 && ` de ${selCats.length} categoría(s) seleccionada(s)`}
          </p>
          <button
            onClick={onStart}
            disabled={toCount === 0}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-2">
            Iniciar conteo
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PASO 2: Contar ───────────────────────────────────────────────────────────
function StepCount({ productsToCount, categories, counts, setCounts, onNext, onBack }) {
  const [search, setSearch]         = useState('')
  const [filterDiff, setFilterDiff] = useState('all')
  const inputRefs = useRef({})

  const contados   = Object.keys(counts).filter(id => counts[id] !== '' && counts[id] !== undefined).length
  const diferencias = productsToCount.filter(p => {
    const d = calcDiff(p, counts)
    return d !== null && d !== 0
  }).length
  const progress = productsToCount.length > 0 ? Math.round((contados / productsToCount.length) * 100) : 0

  const filtered = useMemo(() => {
    let list = productsToCount
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.barcode?.includes(search))
    }
    if (filterDiff === 'pendiente') list = list.filter(p => counts[p.id] === undefined || counts[p.id] === '')
    if (filterDiff === 'diff')      list = list.filter(p => { const d = calcDiff(p, counts); return d !== null && d !== 0 })
    if (filterDiff === 'ok')        list = list.filter(p => calcDiff(p, counts) === 0)
    return list
  }, [productsToCount, search, filterDiff, counts])

  const handleChange = useCallback((id, value) => {
    const v = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0).toString()
    setCounts(prev => ({ ...prev, [id]: v }))
  }, [setCounts])

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const next = filtered[idx + 1]
      if (next) inputRefs.current[next.id]?.focus()
    }
  }

  const handleFillZeros = () => {
    const filled = {}
    productsToCount.forEach(p => {
      if (counts[p.id] === undefined || counts[p.id] === '') filled[p.id] = '0'
    })
    setCounts(prev => ({ ...prev, ...filled }))
    toast.success('Productos sin contar marcados como 0')
  }

  return (
    <div className="space-y-4">
      {/* Progreso */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Progreso del conteo</span>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-500 dark:text-slate-400">
              <span className="font-bold text-gray-800 dark:text-slate-100">{contados}</span> / {productsToCount.length} contados
            </span>
            {diferencias > 0 && (
              <span className="text-amber-600 font-semibold">⚠️ {diferencias} diferencia(s)</span>
            )}
          </div>
        </div>
        <div className="h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mt-1">
          <span>{progress}% completado</span>
          {progress === 100 && <span className="text-emerald-600 font-semibold">✓ Conteo completo</span>}
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto o código..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          {[
            { k: 'all',       l: `Todos (${productsToCount.length})` },
            { k: 'pendiente', l: `Pendientes (${productsToCount.length - contados})` },
            { k: 'diff',      l: `Diferencias (${diferencias})` },
            { k: 'ok',        l: 'Sin diferencia' },
          ].map(f => (
            <button key={f.k} onClick={() => setFilterDiff(f.k)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                filterDiff === f.k
                  ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-slate-400'
              }`}>
              {f.l}
            </button>
          ))}
        </div>
        <button onClick={handleFillZeros}
          className="px-3 py-2 text-xs text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          Marcar sin contar → 0
        </button>
      </div>

      {/* Tabla de conteo */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
        {/* Cabecera */}
        <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
          <span className="col-span-5">Producto</span>
          <span className="col-span-2 text-center">Unidad</span>
          <span className="col-span-2 text-right">Stock teórico</span>
          <span className="col-span-2 text-center">Conteo físico</span>
          <span className="col-span-1 text-right">Dif.</span>
        </div>

        {/* Filas — scroll interno */}
        <div className="max-h-[52vh] overflow-y-auto divide-y divide-gray-50 dark:divide-slate-700/50">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-300 dark:text-slate-600">
              Sin productos que coincidan con el filtro
            </div>
          ) : filtered.map((product, idx) => {
            const diff = calcDiff(product, counts)
            const hasDiff = diff !== null && diff !== 0
            const isDone  = diff !== null
            const catName = categories.find(c => c.id === product.categoryId)?.name || ''

            return (
              <div key={product.id}
                className={`grid grid-cols-12 gap-3 items-center px-4 py-3 transition-colors ${
                  hasDiff
                    ? diff > 0
                      ? 'bg-blue-50/50 dark:bg-blue-900/10'
                      : 'bg-red-50/50 dark:bg-red-900/10'
                    : isDone
                      ? 'bg-emerald-50/30 dark:bg-emerald-900/10'
                      : ''
                }`}>

                {/* Producto */}
                <div className="col-span-5 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{product.name}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                    {product.barcode}
                    {catName && ` · ${catName}`}
                  </p>
                </div>

                {/* Unidad */}
                <div className="col-span-2 text-center text-xs text-gray-500 dark:text-slate-400">
                  {product.unit || 'u'}
                </div>

                {/* Stock teórico */}
                <div className="col-span-2 text-right">
                  <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">{product.stock}</span>
                </div>

                {/* Input de conteo físico */}
                <div className="col-span-2 flex items-center justify-center gap-1">
                  <button
                    tabIndex={-1}
                    onClick={() => handleChange(product.id, String(Math.max(0, (parseInt(counts[product.id] || '0', 10)) - 1)))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-500 hover:bg-red-100 hover:text-red-600 text-sm font-bold transition-colors">
                    −
                  </button>
                  <input
                    ref={el => inputRefs.current[product.id] = el}
                    type="number"
                    min="0"
                    value={counts[product.id] ?? ''}
                    onChange={e => handleChange(product.id, e.target.value)}
                    onKeyDown={e => handleKeyDown(e, idx)}
                    placeholder="—"
                    className={`w-16 text-center text-sm font-bold border rounded-lg py-1.5 focus:outline-none focus:ring-2 transition-colors dark:text-slate-100 ${
                      hasDiff
                        ? diff > 0
                          ? 'border-blue-300 focus:ring-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700'
                          : 'border-red-300 focus:ring-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-700'
                        : isDone
                          ? 'border-emerald-300 focus:ring-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700'
                          : 'border-gray-200 dark:border-slate-600 focus:ring-blue-500 dark:bg-slate-700'
                    }`}
                  />
                  <button
                    tabIndex={-1}
                    onClick={() => handleChange(product.id, String((parseInt(counts[product.id] || '0', 10)) + 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-500 hover:bg-green-100 hover:text-green-600 text-sm font-bold transition-colors">
                    +
                  </button>
                </div>

                {/* Diferencia */}
                <div className="col-span-1 text-right">
                  <DiffBadge diff={diff}/>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tip de teclado */}
      <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
        💡 Usa <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-xs">Enter</kbd> o <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-xs">Tab</kbd> para pasar al siguiente producto
      </p>

      {/* Acciones */}
      <div className="flex items-center justify-between">
        <button onClick={onBack}
          className="px-4 py-2.5 text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          ← Configuración
        </button>
        <button
          onClick={onNext}
          disabled={contados === 0}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-2">
          Revisar resultados ({contados} contados)
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── PASO 3: Revisar ─────────────────────────────────────────────────────────
function StepReview({ productsToCount, counts, onConfirm, onBack, applying }) {
  const diffs = useMemo(() =>
    productsToCount
      .map(p => ({ product: p, diff: calcDiff(p, counts) }))
      .filter(({ diff }) => diff !== null && diff !== 0)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  , [productsToCount, counts])

  const sobrantes = diffs.filter(d => d.diff > 0)
  const faltantes = diffs.filter(d => d.diff < 0)

  const valorDiferencia = HALF_UP(diffs.reduce((acc, { product, diff }) => {
    return acc + diff * (product.priceBuy || product.priceSell * 0.7)
  }, 0))

  const sinDiferencia = productsToCount.filter(p => calcDiff(p, counts) === 0).length
  const sinContar     = productsToCount.filter(p => calcDiff(p, counts) === null).length

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Sin diferencia', value: sinDiferencia, color: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', icon: '✅' },
          { label: 'Sobrantes',      value: sobrantes.length, color: 'bg-blue-50 dark:bg-blue-900/20',    text: 'text-blue-700 dark:text-blue-400',    icon: '📦' },
          { label: 'Faltantes',      value: faltantes.length, color: 'bg-red-50 dark:bg-red-900/20',      text: 'text-red-600 dark:text-red-400',      icon: '⚠️' },
          { label: 'Sin contar',     value: sinContar,        color: 'bg-gray-50 dark:bg-slate-800/50',   text: 'text-gray-500 dark:text-slate-400',   icon: '—'  },
        ].map(k => (
          <div key={k.label} className={`${k.color} rounded-xl p-4`}>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.text}`}>{k.icon} {k.value}</p>
          </div>
        ))}
      </div>

      {/* Impacto económico */}
      {Math.abs(valorDiferencia) > 0 && (
        <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${
          valorDiferencia > 0
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <span className="text-2xl">{valorDiferencia > 0 ? '📈' : '📉'}</span>
          <div>
            <p className={`text-sm font-semibold ${valorDiferencia > 0 ? 'text-blue-800 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>
              Impacto económico estimado: {valorDiferencia > 0 ? '+' : ''}{formatCurrency(Math.abs(valorDiferencia))}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Calculado sobre el precio de compra de cada producto
            </p>
          </div>
        </div>
      )}

      {/* Lista de diferencias */}
      {diffs.length > 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/10">
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Diferencias a ajustar ({diffs.length} producto{diffs.length > 1 ? 's' : ''})
            </h3>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Estos ajustes quedarán documentados como "Inventario Físico" en el Kardex
            </p>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-700/50 max-h-72 overflow-y-auto">
            {diffs.map(({ product, diff }) => {
              const newStock = product.stock + diff
              return (
                <div key={product.id} className="grid grid-cols-12 gap-4 px-5 py-3 items-center">
                  <div className="col-span-5 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{product.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 font-mono">{product.barcode}</p>
                  </div>
                  <div className="col-span-3 flex items-center gap-2 text-sm">
                    <span className="text-gray-500 dark:text-slate-400">{product.stock}</span>
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                    <span className="font-bold text-gray-800 dark:text-slate-100">{newStock}</span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={`text-sm font-bold ${diff > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                      {diff > 0 ? '+' : ''}{diff} {product.unit || 'u'}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      diff > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {diff > 0 ? 'Sobrante' : 'Faltante'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-emerald-700 dark:text-emerald-400 font-semibold">El stock físico coincide con el teórico</p>
          <p className="text-xs text-emerald-500 mt-1">No hay diferencias que ajustar</p>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-between">
        <button onClick={onBack}
          className="px-4 py-2.5 text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          ← Volver al conteo
        </button>
        <button
          onClick={onConfirm}
          disabled={applying}
          className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-60 transition-colors flex items-center gap-2">
          {applying ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Aplicando ajustes...
            </>
          ) : (
            <>
              ✅ Confirmar y ajustar stock ({diffs.length} cambio{diffs.length !== 1 ? 's' : ''})
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── PASO 4: Completado ───────────────────────────────────────────────────────
function StepDone({ summary, onNewCount, onBack }) {
  return (
    <div className="space-y-5">
      <div className="text-center py-10 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
        <div className="text-5xl mb-3">🎉</div>
        <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mb-1">
          Inventario físico completado
        </h3>
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {summary.ref} · {formatDateTime(summary.date)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{summary.total}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Productos contados</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{summary.adjusted}</p>
          <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">Ajustes aplicados</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{summary.sinDiff}</p>
          <p className="text-xs text-emerald-500 mt-1">Sin diferencia</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5 text-sm text-gray-600 dark:text-slate-300 space-y-2">
        <p className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Todos los ajustes quedaron registrados en el Kardex de cada producto</p>
        <p className="flex items-center gap-2"><span className="text-emerald-500">✓</span> El motivo registrado es <strong>"Inventario físico {summary.ref}"</strong></p>
        <p className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Puedes ver el detalle en la pestaña <strong>Movimientos</strong> del inventario</p>
      </div>

      <div className="flex gap-3 justify-center">
        <button onClick={onNewCount}
          className="px-5 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          Nuevo conteo
        </button>
        <button onClick={onBack}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          Volver al inventario
        </button>
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Stocktaking({ onBack }) {
  const { products, categories, currentUser, updateProduct, addStockMovement, addAuditLog } = useStore()

  const [step,     setStep]     = useState(1)
  const [selCats,  setSelCats]  = useState([])
  const [counts,   setCounts]   = useState({})
  const [applying, setApplying] = useState(false)
  const [summary,  setSummary]  = useState(null)

  const productsToCount = useMemo(() =>
    products
      .filter(p => p.isActive && (selCats.length === 0 || selCats.includes(p.categoryId)))
      .sort((a, b) => {
        const catA = categories.find(c => c.id === a.categoryId)?.name || ''
        const catB = categories.find(c => c.id === b.categoryId)?.name || ''
        return catA.localeCompare(catB) || a.name.localeCompare(b.name)
      })
  , [products, categories, selCats])

  const handleStart = () => {
    setCounts({})
    setStep(2)
  }

  const handleApply = useCallback(async () => {
    setApplying(true)
    const now = new Date().toISOString()
    const ref = `INV-${Date.now().toString().slice(-6)}`

    const diffs = productsToCount
      .map(p => ({ product: p, diff: calcDiff(p, counts) }))
      .filter(({ diff }) => diff !== null && diff !== 0)

    for (const { product, diff } of diffs) {
      const newStock = product.stock + diff
      updateProduct(product.id, { stock: newStock })
      addStockMovement({
        id:            crypto.randomUUID(),
        productId:     product.id,
        productName:   product.name,
        type:          diff > 0 ? 'entrada' : 'salida',
        quantity:      Math.abs(diff),
        previousStock: product.stock,
        newStock,
        reason:        `Inventario físico ${ref} · ${diff > 0 ? 'sobrante' : 'faltante'}`,
        userId:        currentUser?.id,
        userName:      currentUser?.fullName,
        createdAt:     now,
      })
    }

    addAuditLog({
      action:  'UPDATE',
      module:  'Inventario',
      detail:  `Inventario físico ${ref} · ${diffs.length} ajustes · ${productsToCount.length} productos contados`,
    })

    setSummary({
      ref,
      date:     now,
      total:    productsToCount.filter(p => calcDiff(p, counts) !== null).length,
      adjusted: diffs.length,
      sinDiff:  productsToCount.filter(p => calcDiff(p, counts) === 0).length,
    })

    setApplying(false)
    setStep(4)
    toast.success(`Inventario ${ref} aplicado — ${diffs.length} producto(s) ajustado(s)`)
  }, [productsToCount, counts, currentUser, updateProduct, addStockMovement, addAuditLog])

  const handleReset = () => {
    setStep(1)
    setSelCats([])
    setCounts({})
    setSummary(null)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Inventario Físico</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">Conteo real y ajuste de stock teórico vs. físico</p>
        </div>
        <StepIndicator current={step}/>
      </div>

      {/* Contenido por paso */}
      {step === 1 && (
        <StepConfig
          categories={categories}
          products={products}
          selCats={selCats}
          setSelCats={setSelCats}
          onStart={handleStart}
        />
      )}

      {step === 2 && (
        <StepCount
          productsToCount={productsToCount}
          categories={categories}
          counts={counts}
          setCounts={setCounts}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <StepReview
          productsToCount={productsToCount}
          counts={counts}
          onConfirm={handleApply}
          onBack={() => setStep(2)}
          applying={applying}
        />
      )}

      {step === 4 && summary && (
        <StepDone
          summary={summary}
          onNewCount={handleReset}
          onBack={onBack}
        />
      )}
    </div>
  )
}
