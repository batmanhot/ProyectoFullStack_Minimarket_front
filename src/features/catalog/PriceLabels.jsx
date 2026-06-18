import { useRef, useEffect } from 'react'
import JsBarcode from 'jsbarcode'
import toast from 'react-hot-toast'

function renderBarcodeSVG(value) {
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    JsBarcode(svg, String(value), { format: 'CODE128', width: 1.2, height: 30, displayValue: false, margin: 0, xmlDocument: document })
    svg.setAttribute('class', 'bc')
    return svg.outerHTML
  } catch { return '<svg class="bc"></svg>' }
}

function buildLabelHTML(products, businessConfig) {
  const bizName = (businessConfig?.name || 'MI NEGOCIO').substring(0, 22)
  const labels = products.map(p => `
    <div class="label">
      <div class="biz">${bizName}</div>
      <div class="name">${p.name.substring(0, 32)}</div>
      <div class="price">S/ ${Number(p.priceSell).toFixed(2)}</div>
      ${renderBarcodeSVG(p.barcode)}
      <div class="sku">${p.barcode}${p.sku ? ' · ' + p.sku : ''}</div>
    </div>`).join('')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Etiquetas de precio</title>
<style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:'Courier New',monospace; background:#fff; } .grid { display:flex; flex-wrap:wrap; gap:4px; padding:8px; } .label { width:56mm; border:1px solid #ccc; border-radius:3px; padding:4px 6px; text-align:center; page-break-inside:avoid; } .biz { font-size:7px; color:#555; margin-bottom:1px; } .name { font-size:9px; font-weight:bold; margin-bottom:2px; min-height:20px; display:flex; align-items:center; justify-content:center; } .price { font-size:20px; font-weight:900; margin:3px 0; color:#000; } .bc { width:100%; height:30px; } .sku { font-size:7px; color:#777; margin-top:1px; } .fab { position:fixed; bottom:16px; right:16px; background:#2563eb; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer; font-size:13px; font-weight:700; } @media print { .fab { display:none } @page { size:A4; margin:5mm; } }</style></head>
<body><div class="grid">${labels}</div><button class="fab" onclick="window.print()">🖨️ Imprimir etiquetas</button></body></html>`
}

export function printPriceLabels(products, businessConfig) {
  if (!products?.length) { toast.error('No hay productos para imprimir'); return }
  const win = window.open('', '_blank', 'width=950,height=720,menubar=yes,scrollbars=yes')
  if (!win) { toast.error('Activa las ventanas emergentes para imprimir etiquetas'); return }
  win.document.write(buildLabelHTML(products, businessConfig))
  win.document.close()
}

export function PriceLabelsModal({ products, businessConfig, onClose }) {
  const iframeRef = useRef(null)
  const html = buildLabelHTML(products, businessConfig)
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex flex-col flex-1 m-4 rounded-2xl overflow-hidden shadow-2xl bg-white">
        <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-lg">🏷️</div>
            <div>
              <h2 className="text-base font-bold text-gray-800">Vista previa — Etiquetas de precio</h2>
              <p className="text-xs text-gray-400">{products.length} producto{products.length !== 1 ? 's' : ''} · Formato 58mm</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => iframeRef.current?.contentWindow?.print()}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              Imprimir etiquetas
            </button>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="flex-1 bg-gray-100 overflow-hidden">
          <iframe ref={iframeRef} srcDoc={html} className="w-full h-full border-0" title="Vista previa de etiquetas"/>
        </div>
      </div>
    </div>
  )
}
