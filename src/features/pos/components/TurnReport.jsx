/**
 * TurnReport.jsx — Reporte de cierre de turno imprimible
 * Ruta: src/features/cash/components/TurnReport.jsx
 *
 * Genera el informe de turno en formato 80mm al cerrar caja.
 * Incluye: resumen de ventas, desglose por método, devoluciones del turno,
 * diferencia de arqueo y espacio para firmas.
 *
 * INTEGRACIÓN:
 * Llamar desde Cash.jsx después de un cierre exitoso:
 *   <TurnReport session={closedSession} sales={sessionSales} returns={sessionReturns}
 *     businessConfig={businessConfig} onClose={() => ...} />
 */

import { useMemo } from 'react'
import { formatCurrency, formatDateTime, formatDate } from '../../../shared/utils/helpers'
import { PAYMENT_METHODS } from '../../../config/app'

// ─── Generador HTML 80mm ──────────────────────────────────────────────────────
function buildTurnHTML({ session, sales, returns, businessConfig }) {
  const byMethod = {}
  sales.forEach((s) =>
    s.payments?.forEach((p) => {
      byMethod[p.method] = parseFloat(((byMethod[p.method] || 0) + p.amount).toFixed(2))
    })
  )

  const totalSales     = parseFloat(sales.reduce((a, s) => a + s.total, 0).toFixed(2))
  const totalReturns   = parseFloat((returns || []).filter(r => r.status !== 'anulada').reduce((a, r) => a + r.totalRefund, 0).toFixed(2))
  const netSales       = parseFloat((totalSales - totalReturns).toFixed(2))
  const igv            = parseFloat((netSales / 1.18 * 0.18).toFixed(2))
  const base           = parseFloat((netSales - igv).toFixed(2))
  const avgTicket      = sales.length > 0 ? parseFloat((totalSales / sales.length).toFixed(2)) : 0
  const cashTotal      = byMethod.efectivo || 0
  const expectedCash   = parseFloat((session.openingAmount + cashTotal).toFixed(2))
  const difference     = parseFloat(((session.closingAmount || 0) - expectedCash).toFixed(2))

  const methodRows = PAYMENT_METHODS
    .filter((m) => (byMethod[m.value] || 0) > 0)
    .map((m) => `
      <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:1.5mm">
        <span>${m.icon} ${m.label}</span>
        <span style="font-weight:bold">${formatCurrency(byMethod[m.value])}</span>
      </div>`
    ).join('')

  const returnRows = (returns || [])
    .filter(r => r.status !== 'anulada')
    .slice(0, 10)
    .map((r) => `
      <div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:1mm">
        <span>${r.ncNumber} — ${r.reasonLabel || r.reason}</span>
        <span style="color:#dc2626">-${formatCurrency(r.totalRefund)}</span>
      </div>`
    ).join('')

  const diffColor = Math.abs(difference) < 0.01 ? '#059669' : difference > 0 ? '#0284c7' : '#dc2626'
  const diffLabel = Math.abs(difference) < 0.01 ? 'SIN DIFERENCIA' : difference > 0 ? `SOBRANTE` : `FALTANTE`

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Reporte de Turno</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',Courier,monospace; font-size:10px; width:80mm; padding:4mm; color:#000; }
  .hr { border:none; border-top:1px dashed #000; margin:2.5mm 0; }
  .hr-solid { border:none; border-top:1px solid #000; margin:2.5mm 0; }
  .row { display:flex; justify-content:space-between; font-size:10px; margin-bottom:1.5mm; }
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
  ${businessConfig?.address ? `<div class="center" style="font-size:9px;color:#555">${businessConfig.address}</div>` : ''}

  <hr class="hr-solid">
  <div class="center bold" style="font-size:12px;margin-bottom:1mm">REPORTE DE CIERRE DE TURNO</div>
  <div class="center" style="font-size:9px;color:#555">${formatDate(new Date().toISOString())}</div>
  <hr class="hr">

  <div class="row"><span>Cajero:</span><span class="bold">${session.userName || '—'}</span></div>
  <div class="row"><span>Apertura:</span><span>${formatDateTime(session.openedAt)}</span></div>
  <div class="row"><span>Cierre:</span><span>${session.closedAt ? formatDateTime(session.closedAt) : formatDateTime(new Date().toISOString())}</span></div>
  <hr class="hr">

  <div class="bold" style="font-size:10px;margin-bottom:2mm">RESUMEN DE VENTAS:</div>
  <div class="row"><span>N° de transacciones</span><span class="bold">${sales.length}</span></div>
  <div class="row"><span>Ticket promedio</span><span>${formatCurrency(avgTicket)}</span></div>
  <div class="row"><span>Total bruto</span><span class="bold">${formatCurrency(totalSales)}</span></div>
  ${totalReturns > 0 ? `<div class="row" style="color:#dc2626"><span>Devoluciones (${(returns||[]).filter(r=>r.status!=='anulada').length} NCs)</span><span>-${formatCurrency(totalReturns)}</span></div>` : ''}
  <div class="row bold" style="font-size:12px;margin-top:1mm"><span>VENTA NETA</span><span>${formatCurrency(netSales)}</span></div>
  <hr class="hr">

  <div class="bold" style="font-size:10px;margin-bottom:2mm">DESGLOSE POR MÉTODO DE PAGO:</div>
  ${methodRows || '<div style="font-size:10px;color:#888">Sin ventas en el turno</div>'}
  <hr class="hr">

  <div class="row"><span>Op. Gravada (Base)</span><span>${formatCurrency(base)}</span></div>
  <div class="row"><span>I.G.V. (18%)</span><span>${formatCurrency(igv)}</span></div>
  <div class="row bold" style="font-size:11px"><span>TOTAL NETO</span><span>${formatCurrency(netSales)}</span></div>
  <hr class="hr">

  <div class="bold" style="font-size:10px;margin-bottom:2mm">ARQUEO DE EFECTIVO:</div>
  <div class="row"><span>Monto de apertura</span><span>${formatCurrency(session.openingAmount)}</span></div>
  <div class="row"><span>Ventas efectivo</span><span>${formatCurrency(cashTotal)}</span></div>
  <div class="row bold"><span>Efectivo esperado</span><span>${formatCurrency(expectedCash)}</span></div>
  <div class="row"><span>Efectivo contado</span><span>${formatCurrency(session.closingAmount || 0)}</span></div>
  <div class="row bold" style="color:${diffColor}">
    <span>${diffLabel}</span>
    <span>${Math.abs(difference) >= 0.01 ? (difference >= 0 ? '+' : '') + formatCurrency(difference) : '✓ CUADRA'}</span>
  </div>
  <hr class="hr">

  ${returnRows ? `
    <div class="bold" style="font-size:10px;margin-bottom:2mm">NOTAS DE CRÉDITO DEL TURNO:</div>
    ${returnRows}
    <hr class="hr">
  ` : ''}

  <div style="margin-top:8mm">
    <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:10mm">
      <div style="text-align:center;flex:1">
        <div style="border-top:1px solid #000;padding-top:2mm;margin-top:10mm">Cajero</div>
        <div style="font-size:9px">${session.userName || '___________'}</div>
      </div>
      <div style="width:10mm"></div>
      <div style="text-align:center;flex:1">
        <div style="border-top:1px solid #000;padding-top:2mm;margin-top:10mm">Supervisor</div>
        <div style="font-size:9px">___________</div>
      </div>
    </div>
  </div>

  <hr class="hr">
  <div class="center" style="font-size:9px">Documento interno — arqueo de caja</div>
  <div class="center" style="font-size:9px">${businessConfig?.name || ''} — ${formatDate(new Date().toISOString())}</div>
</body></html>`
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function TurnReport({ session, sales, returns = [], businessConfig, onClose }) {
  const stats = useMemo(() => {
    const byMethod = {}
    sales.forEach((s) => s.payments?.forEach((p) => {
      byMethod[p.method] = parseFloat(((byMethod[p.method] || 0) + p.amount).toFixed(2))
    }))

    const totalSales   = parseFloat(sales.reduce((a, s) => a + s.total, 0).toFixed(2))
    const totalReturns = parseFloat(returns.filter(r => r.status !== 'anulada').reduce((a, r) => a + r.totalRefund, 0).toFixed(2))
    const netSales     = parseFloat((totalSales - totalReturns).toFixed(2))
    const cashTotal    = byMethod.efectivo || 0
    const expected     = parseFloat((session.openingAmount + cashTotal).toFixed(2))
    const difference   = parseFloat(((session.closingAmount || 0) - expected).toFixed(2))

    return { byMethod, totalSales, totalReturns, netSales, cashTotal, expected, difference }
  }, [sales, returns, session])

  const handlePrint = () => {
    const html = buildTurnHTML({ session, sales, returns, businessConfig })
    const win  = window.open('', '_blank', 'width=380,height=750')
    if (!win) { alert('Activa las ventanas emergentes para imprimir'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 400)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xl">✓</div>
            <div>
              <h2 className="font-bold text-gray-800 dark:text-slate-100">Caja cerrada</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500">{session.userName} · {formatDateTime(session.closedAt || new Date().toISOString())}</p>
            </div>
          </div>
        </div>

        {/* Resumen compacto */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Ventas del turno</p>
              <p className="text-xl font-bold text-gray-800 dark:text-slate-100">{formatCurrency(stats.totalSales)}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">{sales.length} transacciones</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Venta neta</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(stats.netSales)}</p>
              {stats.totalReturns > 0 && (
                <p className="text-xs text-red-500">-{formatCurrency(stats.totalReturns)} dev.</p>
              )}
            </div>
            <div className={`rounded-xl p-3 ${
              Math.abs(stats.difference) < 0.01 ? 'bg-green-50 dark:bg-green-900/20' :
              stats.difference > 0 ? 'bg-blue-50 dark:bg-blue-900/20' :
              'bg-red-50 dark:bg-red-900/20'
            }`}>
              <p className={`text-xs mb-1 ${
                Math.abs(stats.difference) < 0.01 ? 'text-green-600 dark:text-green-400' :
                stats.difference > 0 ? 'text-blue-600 dark:text-blue-400' :
                'text-red-500 dark:text-red-400'
              }`}>
                {Math.abs(stats.difference) < 0.01 ? '✓ Sin diferencia' : stats.difference > 0 ? 'Sobrante' : 'Faltante'}
              </p>
              <p className={`text-xl font-bold ${
                Math.abs(stats.difference) < 0.01 ? 'text-green-700 dark:text-green-300' :
                stats.difference > 0 ? 'text-blue-700 dark:text-blue-300' :
                'text-red-600 dark:text-red-400'
              }`}>
                {Math.abs(stats.difference) < 0.01 ? '—' : `${stats.difference > 0 ? '+' : ''}${formatCurrency(stats.difference)}`}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Efectivo en caja</p>
              <p className="text-xl font-bold text-gray-800 dark:text-slate-100">{formatCurrency(session.closingAmount || 0)}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Esperado: {formatCurrency(stats.expected)}</p>
            </div>
          </div>

          {/* Desglose por método */}
          {Object.keys(stats.byMethod).length > 0 && (
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">Por método de pago</p>
              <div className="space-y-1">
                {PAYMENT_METHODS.filter((m) => (stats.byMethod[m.value] || 0) > 0).map((m) => (
                  <div key={m.value} className="flex justify-between text-xs">
                    <span className="text-gray-600 dark:text-slate-300">{m.icon} {m.label}</span>
                    <span className="font-medium text-gray-700 dark:text-slate-200">{formatCurrency(stats.byMethod[m.value])}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="px-6 pb-6 grid grid-cols-2 gap-3">
          <button onClick={handlePrint}
            className="flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            🖨️ Imprimir reporte
          </button>
          <button onClick={onClose}
            className="py-3 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
