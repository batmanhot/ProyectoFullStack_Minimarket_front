/**
 * TemplatesModal.jsx — Modal de plantillas de campaña
 * Ruta: src/features/discounts/components/TemplatesModal.jsx
 */

import { useState } from 'react'
import { CAMPAIGN_TYPES, CAMPAIGN_TEMPLATES } from '../../../shared/utils/discountEngine'

const TYPE_COLORS = {
  campaign:  'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300',
  promotion: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300',
  volume:    'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-900/20 dark:border-teal-800 dark:text-teal-300',
  line:      'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300',
}

export default function TemplatesModal({ onUse, onClose }) {
  const [tplFilter,   setTplFilter]   = useState('all')
  const [selectedTpl, setSelectedTpl] = useState(null)
  const [quickDate,   setQuickDate]   = useState(null)

  const today = new Date()
  const fmt   = (d) => d.toISOString().split('T')[0]

  const QUICK_DATES = [
    { label: 'Esta semana',   from: fmt(today), to: fmt(new Date(today.getTime() + 6 * 86400000)) },
    { label: 'Este mes',      from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)) },
    { label: 'Próx. 30 días', from: fmt(today), to: fmt(new Date(today.getTime() + 29 * 86400000)) },
    { label: 'Próx. 90 días', from: fmt(today), to: fmt(new Date(today.getTime() + 89 * 86400000)) },
  ]

  const TYPE_FILTERS = [
    { value: 'all',       label: 'Todas',    count: CAMPAIGN_TEMPLATES.length },
    { value: 'campaign',  label: 'Campañas', count: CAMPAIGN_TEMPLATES.filter((t) => t.type === 'campaign').length },
    { value: 'promotion', label: 'NxM',      count: CAMPAIGN_TEMPLATES.filter((t) => t.type === 'promotion').length },
    { value: 'volume',    label: 'Volumen',  count: CAMPAIGN_TEMPLATES.filter((t) => t.type === 'volume').length },
    { value: 'line',      label: 'Compra X', count: CAMPAIGN_TEMPLATES.filter((t) => t.type === 'line').length },
  ]

  const filtered = tplFilter === 'all'
    ? CAMPAIGN_TEMPLATES
    : CAMPAIGN_TEMPLATES.filter((t) => t.type === tplFilter)

  const handleUse = () => {
    if (!selectedTpl) return
    const dates = quickDate
      ? { dateFrom: quickDate.from, dateTo: quickDate.to }
      : { dateFrom: '', dateTo: '' }
    onUse({ ...selectedTpl, ...dates })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-slate-100">⚡ Plantillas de campañas</h2>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Elige una plantilla, configura fechas rápidas y ábrela en el formulario.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Panel izquierdo — filtros y lista */}
          <div className="w-64 shrink-0 border-r border-gray-100 dark:border-slate-700 flex flex-col">
            <div className="p-3 border-b border-gray-100 dark:border-slate-700 space-y-1">
              {TYPE_FILTERS.map((f) => (
                <button key={f.value} onClick={() => { setTplFilter(f.value); setSelectedTpl(null) }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tplFilter === f.value ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                  <span>{f.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${tplFilter === f.value ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>{f.count}</span>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filtered.map((tpl, i) => (
                <button key={i} onClick={() => { setSelectedTpl(tpl); setQuickDate(null) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all border ${selectedTpl === tpl ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                  <span className="text-xl shrink-0">{tpl.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${selectedTpl === tpl ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-slate-100'}`}>{tpl.name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">{CAMPAIGN_TYPES.find((t) => t.value === tpl.type)?.label}</p>
                  </div>
                  {selectedTpl === tpl && <span className="ml-auto text-blue-500 text-xs shrink-0">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Panel derecho — detalle de la plantilla */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedTpl ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{selectedTpl.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">{selectedTpl.name}</h3>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${TYPE_COLORS[selectedTpl.type] || TYPE_COLORS.campaign}`}>
                      {CAMPAIGN_TYPES.find((t) => t.value === selectedTpl.type)?.icon}{' '}
                      {CAMPAIGN_TYPES.find((t) => t.value === selectedTpl.type)?.label}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
                  {CAMPAIGN_TYPES.find((t) => t.value === selectedTpl.type)?.desc}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {selectedTpl.type !== 'promotion' && selectedTpl.discountPct > 0 && (
                    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Descuento</p>
                      <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{selectedTpl.discountPct}%</p>
                    </div>
                  )}
                  {selectedTpl.type === 'promotion' && (
                    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Fórmula</p>
                      <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{selectedTpl.buyQty}×{selectedTpl.payQty}</p>
                    </div>
                  )}
                  {selectedTpl.type === 'volume' && selectedTpl.minAmount && (
                    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Monto mínimo</p>
                      <p className="text-xl font-black text-teal-600 dark:text-teal-400">S/ {selectedTpl.minAmount}</p>
                    </div>
                  )}
                  {selectedTpl.type === 'line' && (
                    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Regla</p>
                      <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                        Compra {selectedTpl.minQty} → el {selectedTpl.discountOnNth}° con {selectedTpl.discountPct}%
                      </p>
                    </div>
                  )}
                  <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Alcance</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                      {selectedTpl.scope === 'all'        ? '🛒 Todos'
                       : selectedTpl.scope === 'categories' ? '🗂️ Categorías'
                       : selectedTpl.scope === 'brand'      ? '🏷️ Marca'
                       : '📦 Productos específicos'}
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5">📝 Deberás completar en el formulario:</p>
                  <ul className="space-y-1 text-xs text-amber-600 dark:text-amber-500">
                    <li>• Rango de fechas de vigencia</li>
                    {selectedTpl.scope === 'categories' && <li>• Categorías específicas</li>}
                    {selectedTpl.scope === 'brand' && <li>• Marcas específicas</li>}
                    {(selectedTpl.type === 'promotion' || selectedTpl.scope === 'products') && <li>• Productos incluidos</li>}
                    <li>• Días de la semana (opcional)</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wide">⚡ Precargar fechas</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_DATES.map((qd, i) => (
                      <button key={i} onClick={() => setQuickDate(quickDate?.label === qd.label ? null : qd)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-all ${quickDate?.label === qd.label ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700'}`}>
                        <p className="font-semibold">{qd.label}</p>
                        <p className={`text-[10px] mt-0.5 ${quickDate?.label === qd.label ? 'text-blue-100' : 'text-gray-400 dark:text-slate-500'}`}>{qd.from} → {qd.to}</p>
                      </button>
                    ))}
                  </div>
                  {!quickDate && <p className="text-[11px] text-gray-400 dark:text-slate-500 italic">Sin fecha rápida: ingresa fechas manualmente en el formulario.</p>}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8 text-gray-400 dark:text-slate-500">
                <span className="text-5xl opacity-30">⚡</span>
                <p className="text-sm font-medium">Selecciona una plantilla</p>
                <p className="text-xs">Elige una opción del panel izquierdo para ver su configuración.</p>
              </div>
            )}

            <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 shrink-0 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                {selectedTpl ? `Seleccionada: ${selectedTpl.name}` : 'Ninguna plantilla seleccionada'}
              </p>
              <div className="flex gap-2 shrink-0">
                <button onClick={onClose} className="px-4 py-2 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
                  Cancelar
                </button>
                <button onClick={handleUse} disabled={!selectedTpl}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${selectedTpl ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 dark:bg-slate-700 text-gray-400 cursor-not-allowed'}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                  Usar esta plantilla
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
