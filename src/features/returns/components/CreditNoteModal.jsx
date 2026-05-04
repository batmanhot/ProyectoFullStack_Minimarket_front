/**
 * CreditNoteModal.jsx — Vista previa e impresión de Nota de Crédito
 * Ruta: src/features/returns/components/CreditNoteModal.jsx
 *
 * Genera HTML imprimible en formato 80mm (idéntico al SaleTicket)
 * Soporta: impresión directa + envío por WhatsApp
 */

import { useState } from 'react'
import { formatCurrency, formatDateTime } from '../../../shared/utils/helpers'
import { PAYMENT_METHODS } from '../../../config/app'

const RETURN_REASONS = [
  { value: 'defectuoso',   label: 'Producto defectuoso / dañado',    icon: '⚠️' },
  { value: 'vencido',      label: 'Producto vencido / caducado',      icon: '📅' },
  { value: 'equivocado',   label: 'Producto equivocado / error cobro',icon: '🔄' },
  { value: 'insatisfecho', label: 'Cliente insatisfecho',             icon: '😞' },
  { value: 'incompleto',   label: 'Producto incompleto / faltante',   icon: '📦' },
  { value: 'otro',         label: 'Otro motivo',                      icon: '📝' },
]

const HALF_UP = (n) => Math.floor(Number(n) * 100 + 0.5) / 100

// ─── Generador HTML 80mm ──────────────────────────────────────────────────────
function buildCreditNoteHTML(nc, businessConfig) {
  const igvRate       = nc.igvRate       || 0.18
  const baseImponible = nc.baseImponible ?? HALF_UP(nc.totalRefund / (1 + igvRate))
  const igv           = nc.igv           ?? HALF_UP(nc.totalRefund - baseImponible)

  const logoHtml = businessConfig?.logoUrl
    ? `<div style="text-align:center;margin-bottom:3mm">
         <img src="${businessConfig.logoUrl}" style="max-width:50mm;max-height:20mm;object-fit:contain"
           onerror="this.style.display='none'">
       </div>`
    : ''

  const itemsHtml = (nc.items || []).map(item => `
    <div style="margin-bottom:3mm">
      <div style="font-weight:bold;font-size:10px">${item.productName}</div>
      <div style="display:flex;justify-content:space-between;font-size:10px">
        <span>${item.quantity} ${item.unit||'u'} × ${formatCurrency(item.netUnitPrice)}</span>
        <span>${formatCurrency(item.totalRefund)}</span>
      </div>
      ${item.discount > 0
        ? `<div style="font-size:9px;color:#555">Precio lista: ${formatCurrency(item.unitPrice)}/u · con dto.</div>`
        : ''
      }
    </div>`).join('')

  const reasonLabel = RETURN_REASONS.find(r => r.value === nc.reason)?.label || nc.reasonLabel || nc.reason

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Nota de Crédito ${nc.ncNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',Courier,monospace; font-size:10px; width:80mm; padding:4mm; color:#000; background:#fff; }
  .hr  { border:none; border-top:1px dashed #000; margin:2.5mm 0; }
  .row { display:flex; justify-content:space-between; }
  .center { text-align:center; }
  .bold   { font-weight:bold; }
  @page { size:80mm auto; margin:0; }
  @media print { html,body{ width:80mm; } }
</style></head>
<body>
  ${logoHtml}
  <div class="center bold" style="font-size:13px;letter-spacing:1.5px;margin-bottom:1mm">
    ${(businessConfig?.name || 'MI NEGOCIO').toUpperCase()}
  </div>
  ${businessConfig?.ruc     ? `<div class="center" style="font-size:10px">R.U.C.: ${businessConfig.ruc}</div>` : ''}
  ${businessConfig?.address ? `<div class="center" style="font-size:9px">${businessConfig.address}</div>` : ''}
  ${businessConfig?.phone   ? `<div class="center" style="font-size:9px">Tel: ${businessConfig.phone}</div>` : ''}

  <hr class="hr">
  <div class="center bold" style="font-size:12px;margin-bottom:1mm">NOTA DE CRÉDITO ELECTRÓNICA</div>
  <div class="center bold" style="font-size:12px;letter-spacing:1px">${nc.ncNumber}</div>
  <hr class="hr">

  <div style="font-size:10px;margin-bottom:1mm"><strong>Fecha:</strong> ${formatDateTime(nc.createdAt)}</div>
  <div style="font-size:10px;margin-bottom:1mm"><strong>Doc. ref.:</strong> ${nc.invoiceNumber}</div>
  ${nc.clientName ? `<div style="font-size:10px;margin-bottom:1mm"><strong>Cliente:</strong> ${nc.clientName}</div>` : ''}
  ${nc.userName   ? `<div style="font-size:10px;margin-bottom:1mm"><strong>Cajero:</strong> ${nc.userName}</div>` : ''}

  <hr class="hr">
  <div style="font-size:9px;font-weight:bold;margin-bottom:1mm">MOTIVO:</div>
  <div style="font-size:9px;margin-bottom:2mm">${reasonLabel}${nc.reasonNote ? ` — ${nc.reasonNote}` : ''}</div>
  <hr class="hr">

  <div class="row bold" style="font-size:10px;margin-bottom:1.5mm">
    <span style="flex:1">PRODUCTO DEVUELTO</span>
    <span style="width:50px;text-align:right">MONTO</span>
  </div>
  <hr class="hr">
  ${itemsHtml}
  <hr class="hr">

  <div class="row" style="font-size:10px;margin-bottom:1mm"><span>Op. Gravada:</span><span>${formatCurrency(baseImponible)}</span></div>
  <div class="row" style="font-size:10px;margin-bottom:1.5mm"><span>I.G.V. (${Math.round(igvRate*100)}%):</span><span>${formatCurrency(igv)}</span></div>
  <div class="row bold" style="font-size:13px;margin-bottom:1mm"><span>TOTAL A REEMBOLSAR</span><span>${formatCurrency(nc.totalRefund)}</span></div>
  <hr class="hr">

  <div class="center" style="font-size:10px;font-weight:bold;margin:2mm 0">★ ESTE IMPORTE SERÁ DEVUELTO AL CLIENTE ★</div>
  <hr class="hr">

  <div class="center" style="font-size:9px;margin-top:1mm">Representación impresa de Nota de Crédito Electrónica</div>
  <div class="center" style="font-size:9px">Consulte en: www.sunat.gob.pe</div>
  <hr class="hr">
  <div class="center" style="font-size:10px">${businessConfig?.ticketFooter || '¡Gracias por su preferencia!'}</div>
  <br>
</body></html>`
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function CreditNoteModal({ creditNote: nc, businessConfig, onClose }) {
  const [showPhone, setShowPhone] = useState(false)
  const [phone, setPhone]         = useState('')
  const [phoneError, setPhoneError] = useState('')

  const igvRate       = nc.igvRate       || 0.18
  const baseImponible = nc.baseImponible ?? HALF_UP(nc.totalRefund / (1 + igvRate))
  const igv           = nc.igv           ?? HALF_UP(nc.totalRefund - baseImponible)
  const reasonLabel   = RETURN_REASONS.find(r => r.value === nc.reason)?.label || nc.reasonLabel || nc.reason

  const handlePrint = () => {
    const html = buildCreditNoteHTML(nc, businessConfig)
    const win  = window.open('', '_blank', 'width=380,height=700,left=100,top=50')
    if (!win) { alert('Activa las ventanas emergentes para imprimir'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 400)
  }

  const handleWhatsApp = () => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 9) { setPhoneError('Ingresa un número válido de 9 dígitos'); return }
    setPhoneError('')
    const intl = cleaned.startsWith('51') ? cleaned : `51${cleaned}`

    const itemLines = nc.items.map(item =>
      `• ${item.productName}\n  ${item.quantity} ${item.unit||'u'} × ${formatCurrency(item.netUnitPrice)} = *${formatCurrency(item.totalRefund)}*`
    )

    const lines = [
      `*${businessConfig?.name || 'Mi Negocio'}*`,
      businessConfig?.ruc ? `RUC: ${businessConfig.ruc}` : null,
      `─────────────────────`,
      `*NOTA DE CRÉDITO*`,
      `N°: ${nc.ncNumber}`,
      `Doc. referencia: ${nc.invoiceNumber}`,
      `Fecha: ${formatDateTime(nc.createdAt)}`,
      `─────────────────────`,
      `Motivo: ${reasonLabel}`,
      nc.reasonNote ? `Detalle: ${nc.reasonNote}` : null,
      `─────────────────────`,
      ...itemLines,
      `─────────────────────`,
      `Op. Gravada: ${formatCurrency(baseImponible)}`,
      `IGV (${Math.round(igvRate*100)}%): ${formatCurrency(igv)}`,
      `*TOTAL A REEMBOLSAR: ${formatCurrency(nc.totalRefund)}*`,
      `─────────────────────`,
      `Este importe será devuelto al cliente.`,
      `Consulte su NC en: www.sunat.gob.pe`,
    ].filter(Boolean).join('\n')

    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(lines)}`, '_blank')
    setShowPhone(false)
    setPhone('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-auto flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-purple-500 text-lg">📋</span>
              <h2 className="font-bold text-gray-800 dark:text-slate-100">Nota de Crédito</h2>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5 font-mono">{nc.ncNumber} · Ref: {nc.invoiceNumber}</p>
          </div>
          <button onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Vista previa del ticket */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-slate-900/50">
          <div className="flex justify-center">
            <div style={{
              fontFamily: "'Courier New', monospace",
              fontSize: '11px', width: '300px', maxWidth: '100%',
              background: '#fff', padding: '12px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              borderRadius: '4px', border: '1px solid #e5e7eb',
            }}>
              {/* Logo */}
              {businessConfig?.logoUrl && (
                <div style={{ textAlign:'center', marginBottom:'8px' }}>
                  <img src={businessConfig.logoUrl} alt="" style={{ maxWidth:'120px', maxHeight:'50px', objectFit:'contain' }}
                    onError={e => e.target.style.display='none'}/>
                </div>
              )}

              <div style={{ textAlign:'center', fontWeight:'bold', fontSize:'13px', letterSpacing:'1.5px', marginBottom:'2px' }}>
                {(businessConfig?.name || 'MI NEGOCIO').toUpperCase()}
              </div>
              {businessConfig?.ruc && <div style={{ textAlign:'center', fontSize:'10px' }}>R.U.C.: {businessConfig.ruc}</div>}
              {businessConfig?.address && <div style={{ textAlign:'center', fontSize:'9px', color:'#555' }}>{businessConfig.address}</div>}

              <hr style={{ border:'none', borderTop:'1px dashed #000', margin:'6px 0' }}/>
              <div style={{ textAlign:'center', fontWeight:'bold', fontSize:'12px', marginBottom:'1px' }}>NOTA DE CRÉDITO ELECTRÓNICA</div>
              <div style={{ textAlign:'center', fontWeight:'bold', fontSize:'12px', letterSpacing:'1px', color:'#7c3aed' }}>{nc.ncNumber}</div>
              <hr style={{ border:'none', borderTop:'1px dashed #000', margin:'6px 0' }}/>

              <div style={{ fontSize:'10px', marginBottom:'2px' }}><strong>Fecha:</strong> {formatDateTime(nc.createdAt)}</div>
              <div style={{ fontSize:'10px', marginBottom:'2px' }}><strong>Doc. ref.:</strong> {nc.invoiceNumber}</div>
              {nc.clientName && <div style={{ fontSize:'10px', marginBottom:'2px' }}><strong>Cliente:</strong> {nc.clientName}</div>}
              {nc.userName   && <div style={{ fontSize:'10px', marginBottom:'2px' }}><strong>Cajero:</strong> {nc.userName}</div>}

              <hr style={{ border:'none', borderTop:'1px dashed #000', margin:'6px 0' }}/>
              <div style={{ fontSize:'9px', fontWeight:'bold', marginBottom:'1px', color:'#555' }}>MOTIVO DE DEVOLUCIÓN:</div>
              <div style={{ fontSize:'9px', marginBottom:'4px', color:'#333' }}>
                {reasonLabel}{nc.reasonNote ? ` — ${nc.reasonNote}` : ''}
              </div>
              <hr style={{ border:'none', borderTop:'1px dashed #000', margin:'6px 0' }}/>

              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', fontWeight:'bold', marginBottom:'4px' }}>
                <span style={{ flex:1 }}>PRODUCTO DEVUELTO</span>
                <span style={{ width:'50px', textAlign:'right' }}>MONTO</span>
              </div>
              <hr style={{ border:'none', borderTop:'1px dashed #000', margin:'4px 0' }}/>

              {nc.items?.map((item, idx) => (
                <div key={idx} style={{ marginBottom:'5px' }}>
                  <div style={{ fontSize:'10px', fontWeight:'bold' }}>{item.productName}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px' }}>
                    <span>{item.quantity} {item.unit||'u'} × {formatCurrency(item.netUnitPrice)}</span>
                    <span>{formatCurrency(item.totalRefund)}</span>
                  </div>
                  {item.discount > 0 && (
                    <div style={{ fontSize:'9px', color:'#777' }}>
                      Precio lista: {formatCurrency(item.unitPrice)}/u · con dto.
                    </div>
                  )}
                </div>
              ))}

              <hr style={{ border:'none', borderTop:'1px dashed #000', margin:'6px 0' }}/>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', marginBottom:'1px' }}>
                <span>Op. Gravada:</span><span>{formatCurrency(baseImponible)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', marginBottom:'4px' }}>
                <span>I.G.V. ({Math.round(igvRate*100)}%):</span><span>{formatCurrency(igv)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:'bold', fontSize:'14px', marginBottom:'2px', color:'#7c3aed' }}>
                <span>TOTAL REEMBOLSO</span><span>{formatCurrency(nc.totalRefund)}</span>
              </div>

              <hr style={{ border:'none', borderTop:'1px dashed #000', margin:'6px 0' }}/>
              <div style={{ textAlign:'center', fontSize:'10px', fontWeight:'bold', color:'#7c3aed', margin:'3mm 0' }}>
                ★ IMPORTE A DEVOLVER AL CLIENTE ★
              </div>
              <hr style={{ border:'none', borderTop:'1px dashed #000', margin:'6px 0' }}/>
              <div style={{ textAlign:'center', fontSize:'8px', color:'#777', marginBottom:'2px' }}>
                Representación impresa de Nota de Crédito Electrónica
              </div>
              <div style={{ textAlign:'center', fontSize:'8px', color:'#777' }}>
                Consulte en: <strong>www.sunat.gob.pe</strong>
              </div>
              <hr style={{ border:'none', borderTop:'1px dashed #000', margin:'6px 0' }}/>
              <div style={{ textAlign:'center', fontSize:'10px', fontWeight:'bold' }}>
                {businessConfig?.ticketFooter || '¡Gracias por su preferencia!'}
              </div>
            </div>
          </div>
        </div>

        {/* Panel WhatsApp */}
        {showPhone && (
          <div className="px-5 py-4 border-t border-green-100 dark:border-slate-700 bg-green-50 dark:bg-green-900/20 flex-shrink-0">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">📱 Enviar NC por WhatsApp</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">+51</span>
                <input type="tel" value={phone}
                  onChange={e => { setPhone(e.target.value); setPhoneError('') }}
                  placeholder="999 999 999" autoFocus maxLength={9}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-100"
                  onKeyDown={e => e.key === 'Enter' && handleWhatsApp()}/>
              </div>
              <button onClick={handleWhatsApp}
                className="px-4 py-2.5 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 transition-colors">
                Enviar
              </button>
              <button onClick={() => { setShowPhone(false); setPhone(''); setPhoneError('') }}
                className="px-3 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
                Cancelar
              </button>
            </div>
            {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
          </div>
        )}

        {/* Botones */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-800 rounded-b-2xl">
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setShowPhone(p => !p)}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold transition-all ${showPhone ? 'bg-green-500 text-white' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 border border-green-200 dark:border-green-800'}`}>
              <span className="text-xl">📱</span><span>WhatsApp</span>
            </button>
            <button onClick={handlePrint}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 transition-all">
              <span className="text-xl">🖨️</span><span>Imprimir</span><span className="text-xs font-normal opacity-60">80mm</span>
            </button>
            <button onClick={onClose}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 border border-gray-200 dark:border-slate-600 transition-all">
              <span className="text-xl">✓</span><span>Cerrar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
