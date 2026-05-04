/**
 * DenominationArqueo.jsx — Arqueo de caja por denominaciones
 * Ruta: src/features/cash/components/DenominationArqueo.jsx
 *
 * Permite al cajero ingresar la cantidad de cada billete/moneda.
 * El sistema calcula el total automáticamente y lo compara con el esperado.
 * Genera un reporte imprimible en 80mm para firma.
 *
 * INTEGRACIÓN EN Cash.jsx:
 * Reemplaza el campo "Monto contado físicamente" del CloseForm con este componente.
 * Retorna el totalContado al padre via onCountedChange(total).
 */

import { useState, useMemo, useCallback } from 'react'
import { formatCurrency, formatDateTime } from '../../../shared/utils/helpers'

// ─── Denominaciones peruanas ──────────────────────────────────────────────────
const BILLETES = [
  { valor: 200, label: 'S/ 200', tipo: 'billete', icon: '🟩' },
  { valor: 100, label: 'S/ 100', tipo: 'billete', icon: '🟦' },
  { valor:  50, label: 'S/ 50',  tipo: 'billete', icon: '🟪' },
  { valor:  20, label: 'S/ 20',  tipo: 'billete', icon: '🟧' },
  { valor:  10, label: 'S/ 10',  tipo: 'billete', icon: '🟥' },
]
const MONEDAS = [
  { valor: 5,    label: 'S/ 5',    tipo: 'moneda', icon: '🪙' },
  { valor: 2,    label: 'S/ 2',    tipo: 'moneda', icon: '🪙' },
  { valor: 1,    label: 'S/ 1',    tipo: 'moneda', icon: '🪙' },
  { valor: 0.50, label: 'S/ 0.50', tipo: 'moneda', icon: '🔘' },
  { valor: 0.20, label: 'S/ 0.20', tipo: 'moneda', icon: '🔘' },
  { valor: 0.10, label: 'S/ 0.10', tipo: 'moneda', icon: '🔘' },
]
const ALL_DENOMS = [...BILLETES, ...MONEDAS]

// ─── Generador HTML 80mm ──────────────────────────────────────────────────────
function buildArqueoHTML({ quantities, totalContado, expected, difference, session, businessConfig, userName }) {
  const rows = ALL_DENOMS
    .filter((d) => (quantities[d.valor] || 0) > 0)
    .map((d) => {
      const qty      = quantities[d.valor] || 0
      const subtotal = parseFloat((qty * d.valor).toFixed(2))
      return `<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:1mm">
        <span>${d.label} × ${qty}</span>
        <span>${formatCurrency(subtotal)}</span>
      </div>`
    }).join('')

  const diffColor = Math.abs(difference) < 0.01 ? '#059669' : difference > 0 ? '#0284c7' : '#dc2626'
  const diffLabel = Math.abs(difference) < 0.01 ? 'SIN DIFERENCIA' : difference > 0 ? `SOBRANTE +${formatCurrency(difference)}` : `FALTANTE ${formatCurrency(difference)}`

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Arqueo de Caja</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',Courier,monospace; font-size:10px; width:80mm; padding:4mm; color:#000; }
  .hr { border:none; border-top:1px dashed #000; margin:2.5mm 0; }
  .row { display:flex; justify-content:space-between; }
  .center { text-align:center; }
  .bold { font-weight:bold; }
  @page { size:80mm auto; margin:0; }
  @media print { html,body{ width:80mm; } }
</style></head>
<body>
  <div class="center bold" style="font-size:13px;letter-spacing:1px;margin-bottom:1mm">
    ${(businessConfig?.name || 'MI NEGOCIO').toUpperCase()}
  </div>
  ${businessConfig?.ruc ? `<div class="center" style="font-size:10px">RUC: ${businessConfig.ruc}</div>` : ''}
  <hr class="hr">
  <div class="center bold" style="font-size:11px;margin-bottom:1mm">REPORTE DE ARQUEO DE CAJA</div>
  <hr class="hr">

  <div style="font-size:10px;margin-bottom:1mm"><b>Fecha:</b> ${formatDateTime(new Date().toISOString())}</div>
  <div style="font-size:10px;margin-bottom:1mm"><b>Cajero:</b> ${userName || '—'}</div>
  ${session?.openedAt ? `<div style="font-size:10px;margin-bottom:1mm"><b>Apertura:</b> ${formatDateTime(session.openedAt)}</div>` : ''}
  <hr class="hr">

  <div class="bold" style="font-size:10px;margin-bottom:2mm">CONTEO DE EFECTIVO:</div>
  ${rows || '<div style="font-size:10px;color:#888">Sin denominaciones ingresadas</div>'}
  <hr class="hr">

  <div class="row bold" style="font-size:12px;margin-bottom:1.5mm">
    <span>TOTAL CONTADO</span><span>${formatCurrency(totalContado)}</span>
  </div>
  <div class="row" style="font-size:10px;margin-bottom:1mm">
    <span>Monto esperado</span><span>${formatCurrency(expected)}</span>
  </div>
  <div class="row bold" style="font-size:11px;color:${diffColor}">
    <span>${diffLabel}</span>
    ${Math.abs(difference) >= 0.01 ? `<span>${formatCurrency(Math.abs(difference))}</span>` : ''}
  </div>
  <hr class="hr">

  <div style="margin-top:10mm;font-size:10px">
    <div class="row" style="margin-bottom:8mm">
      <span>Firma cajero: _______________</span>
    </div>
    <div class="row">
      <span>Firma supervisor: ___________</span>
    </div>
  </div>
  <hr class="hr">
  <div class="center" style="font-size:9px">Documento interno — no válido como comprobante</div>
</body></html>`
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DenominationArqueo({
  expected,
  session,
  businessConfig,
  userName,
  onCountedChange,
}) {
  const [quantities, setQuantities] = useState({})
  const [showAll, setShowAll]       = useState(false)

  const totalContado = useMemo(() =>
    ALL_DENOMS.reduce((acc, d) => {
      const qty = parseInt(quantities[d.valor] || 0)
      return parseFloat((acc + qty * d.valor).toFixed(2))
    }, 0)
  , [quantities])

  const difference = useMemo(() =>
    parseFloat((totalContado - expected).toFixed(2))
  , [totalContado, expected])

  const handleChange = useCallback((valor, qty) => {
    const v = Math.max(0, parseInt(qty) || 0)
    setQuantities((prev) => ({ ...prev, [valor]: v }))
    // Notificar al padre con el nuevo total
    const newTotal = ALL_DENOMS.reduce((acc, d) => {
      const q = d.valor === valor ? v : (parseInt(prev[d.valor] || 0))
      return parseFloat((acc + q * d.valor).toFixed(2))
    }, 0)
    onCountedChange?.(newTotal)
  }, [onCountedChange])

  const handlePrint = () => {
    const html = buildArqueoHTML({ quantities, totalContado, expected, difference, session, businessConfig, userName })
    const win  = window.open('', '_blank', 'width=380,height=700')
    if (!win) { alert('Activa las ventanas emergentes para imprimir'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 400)
  }

  const denomsToShow = showAll ? ALL_DENOMS : BILLETES

  return (
    <div className="space-y-4">

      {/* Indicador de total en tiempo real */}
      <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
        <div>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total contado</p>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{formatCurrency(totalContado)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-slate-400">Esperado</p>
          <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">{formatCurrency(expected)}</p>
        </div>
        {totalContado > 0 && (
          <div className={`text-center px-4 py-2 rounded-xl ${
            Math.abs(difference) < 0.01 ? 'bg-green-100 dark:bg-green-900/30' :
            difference > 0 ? 'bg-blue-100 dark:bg-blue-900/30' :
            'bg-red-100 dark:bg-red-900/30'
          }`}>
            <p className={`text-xs font-semibold ${
              Math.abs(difference) < 0.01 ? 'text-green-700 dark:text-green-400' :
              difference > 0 ? 'text-blue-700 dark:text-blue-300' :
              'text-red-600 dark:text-red-400'
            }`}>
              {Math.abs(difference) < 0.01 ? '✓ Cuadra' : difference > 0 ? 'Sobrante' : 'Faltante'}
            </p>
            {Math.abs(difference) >= 0.01 && (
              <p className={`text-sm font-black ${difference > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-600 dark:text-red-400'}`}>
                {difference > 0 ? '+' : ''}{formatCurrency(difference)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tabla de denominaciones */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
          <div className="grid grid-cols-4 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            <span>Denominación</span>
            <span className="text-center">Cantidad</span>
            <span className="text-right">Subtotal</span>
            <span className="text-right">—</span>
          </div>
        </div>

        <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
          {denomsToShow.map((d) => {
            const qty      = quantities[d.valor] || 0
            const subtotal = parseFloat((qty * d.valor).toFixed(2))
            return (
              <div key={d.valor} className="grid grid-cols-4 items-center gap-3 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{d.icon}</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">{d.label}</span>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => handleChange(d.valor, qty - 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-500 hover:bg-red-100 hover:text-red-600 text-sm font-bold transition-colors">
                    −
                  </button>
                  <input
                    type="number" min="0" step="1"
                    value={qty || ''}
                    onChange={(e) => handleChange(d.valor, e.target.value)}
                    placeholder="0"
                    className="w-14 text-center text-sm font-bold border border-gray-200 dark:border-slate-600 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                  />
                  <button onClick={() => handleChange(d.valor, qty + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-500 hover:bg-green-100 hover:text-green-600 text-sm font-bold transition-colors">
                    +
                  </button>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-semibold ${subtotal > 0 ? 'text-gray-800 dark:text-slate-100' : 'text-gray-300 dark:text-slate-600'}`}>
                    {subtotal > 0 ? formatCurrency(subtotal) : '—'}
                  </span>
                </div>
                <div className="text-right">
                  {qty > 0 && (
                    <button onClick={() => handleChange(d.valor, 0)}
                      className="text-xs text-gray-300 hover:text-red-400 transition-colors">✕</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Toggle billetes/monedas */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800">
          <button onClick={() => setShowAll((v) => !v)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            {showAll ? '▲ Ocultar monedas' : '▼ Incluir monedas y céntimos'}
          </button>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-3">
        <button onClick={handlePrint}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          🖨️ Imprimir arqueo 80mm
        </button>
        <button
          onClick={() => setQuantities({})}
          className="px-4 py-2.5 text-sm text-gray-400 hover:text-red-400 border border-gray-100 dark:border-slate-700 rounded-xl transition-colors">
          Limpiar
        </button>
      </div>
    </div>
  )
}
