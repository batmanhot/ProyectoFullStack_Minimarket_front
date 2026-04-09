import { useState, useRef } from 'react'
import { useStore } from '../../../store/index'
import { formatCurrency, formatDateTime, formatDate } from '../../../shared/utils/helpers'
import { PAYMENT_METHODS } from '../../../config/app'

// ─── Constantes SUNAT ──────────────────────────────────────────────────────────
const IGV_RATE = 0.18

// ─── HTML del comprobante (80mm) para impresión directa ───────────────────────
function buildTicketHTML(sale, businessConfig) {
  const baseImponible = parseFloat((sale.total / (1 + IGV_RATE)).toFixed(2))
  const igv           = parseFloat((sale.total - baseImponible).toFixed(2))
  const logoHtml      = businessConfig?.logoUrl
    ? `<div style="text-align:center;margin-bottom:3mm"><img src="${businessConfig.logoUrl}" style="max-width:50mm;max-height:20mm;object-fit:contain" onerror="this.style.display='none'"></div>`
    : ''

  const itemsHtml = (sale.items || []).map(item => `
    <div style="margin-bottom:2.5mm">
      <div style="font-weight:bold;font-size:10px">${item.productName}</div>
      <div style="display:flex;justify-content:space-between;font-size:10px">
        <span>${item.quantity} ${item.unit || 'u'} x ${formatCurrency(item.unitPrice)}</span>
        <span>${formatCurrency(item.subtotal)}</span>
      </div>
      ${item.discount > 0 ? `<div style="font-size:9px;color:#555">Descuento: -${formatCurrency(item.discount)}</div>` : ''}
    </div>`).join('')

  const paymentsHtml = (sale.payments || []).map(p => {
    const m = PAYMENT_METHODS.find(pm => pm.value === p.method)
    return `<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:1mm">
      <span>${m?.label || p.method}${p.reference ? ` (${p.reference})` : ''}</span>
      <span>${formatCurrency(p.amount)}</span>
    </div>`
  }).join('')

  const changeHtml = (sale.change > 0)
    ? `<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:1mm"><span>Vuelto</span><span>${formatCurrency(sale.change)}</span></div>`
    : ''

  const qrPlaceholder = `<div style="text-align:center;margin:3mm 0">
    <div style="display:inline-block;width:25mm;height:25mm;border:1px solid #000;font-size:7px;display:flex;align-items:center;justify-content:center;text-align:center;padding:2mm">
      Código de verificación SUNAT<br>${sale.invoiceNumber}
    </div></div>`

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Boleta ${sale.invoiceNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',Courier,monospace; font-size:10px; width:80mm; padding:4mm; color:#000; background:#fff; }
  .hr { border:none; border-top:1px dashed #000; margin:2.5mm 0; }
  .center { text-align:center; }
  .right  { text-align:right; }
  .bold   { font-weight:bold; }
  .row    { display:flex; justify-content:space-between; }
  @page   { size:80mm auto; margin:0; }
  @media print { html,body{ width:80mm; } }
</style></head>
<body>
  ${logoHtml}
  <div class="center bold" style="font-size:13px;letter-spacing:1.5px;margin-bottom:1mm">${(businessConfig?.name || 'MI NEGOCIO').toUpperCase()}</div>
  ${businessConfig?.ruc     ? `<div class="center" style="font-size:10px">R.U.C.: ${businessConfig.ruc}</div>` : ''}
  ${businessConfig?.address ? `<div class="center" style="font-size:9px">${businessConfig.address}</div>` : ''}
  ${businessConfig?.phone   ? `<div class="center" style="font-size:9px">Tel: ${businessConfig.phone}</div>` : ''}

  <hr class="hr">
  <div class="center bold" style="font-size:11px;margin-bottom:1mm">BOLETA DE VENTA ELECTRÓNICA</div>
  <div class="center bold" style="font-size:11px;letter-spacing:1px">${sale.invoiceNumber}</div>
  <hr class="hr">

  <div style="font-size:10px;margin-bottom:1mm"><strong>Fecha:</strong> ${formatDateTime(sale.createdAt)}</div>
  ${sale.userName ? `<div style="font-size:10px;margin-bottom:1mm"><strong>Cajero:</strong> ${sale.userName}</div>` : ''}
  ${sale.clientName ? `<div style="font-size:10px;margin-bottom:1mm"><strong>Cliente:</strong> ${sale.clientName}</div>` : ''}

  <hr class="hr">
  <div class="row bold" style="font-size:10px;margin-bottom:1.5mm">
    <span style="flex:1">DESCRIPCIÓN</span>
    <span style="width:35px;text-align:right">CANT</span>
    <span style="width:45px;text-align:right">TOTAL</span>
  </div>
  <hr class="hr">
  ${itemsHtml}
  <hr class="hr">

  <div class="row" style="font-size:10px;margin-bottom:1mm"><span>Op. Gravada:</span><span>${formatCurrency(baseImponible)}</span></div>
  <div class="row" style="font-size:10px;margin-bottom:1.5mm"><span>I.G.V. (18%):</span><span>${formatCurrency(igv)}</span></div>
  <div class="row bold" style="font-size:13px;margin-bottom:1mm"><span>IMPORTE TOTAL:</span><span>${formatCurrency(sale.total)}</span></div>
  <hr class="hr">

  <div class="bold" style="font-size:10px;margin-bottom:1.5mm">FORMA DE PAGO:</div>
  ${paymentsHtml}
  ${changeHtml}
  <hr class="hr">

  ${qrPlaceholder}
  <div class="center" style="font-size:9px;margin-top:1mm">Representación impresa de Boleta de Venta Electrónica</div>
  <div class="center" style="font-size:9px">Consulte en: www.sunat.gob.pe</div>
  <hr class="hr">
  <div class="center" style="font-size:10px">${businessConfig?.ticketFooter || '¡Gracias por su compra!'}</div>
  <div class="center" style="font-size:9px;margin-top:1mm">Conserve su comprobante</div>
  <br>
</body></html>`
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SaleTicket({ sale, onClose }) {
  const { businessConfig } = useStore()
  const [showPhone, setShowPhone] = useState(false)
  const [phone, setPhone]         = useState('')
  const [phoneError, setPhoneError] = useState('')

  const baseImponible = parseFloat((sale.total / (1 + IGV_RATE)).toFixed(2))
  const igv           = parseFloat((sale.total - baseImponible).toFixed(2))

  // ── Imprimir: abre ventana optimizada para impresora de tickets 80mm ─────────
  const handlePrint = () => {
    const html = buildTicketHTML(sale, businessConfig)
    const win  = window.open('', '_blank', 'width=380,height=700,left=100,top=50')
    if (!win) { alert('Activa las ventanas emergentes para imprimir'); return }
    win.document.write(html)
    win.document.close()
    // Pequeño delay para que cargue imágenes (logo) antes de imprimir
    setTimeout(() => {
      win.focus()
      win.print()
      // No cerramos automáticamente para que el usuario vea la vista previa
    }, 400)
  }

  // ── WhatsApp: pide número y genera mensaje de texto del comprobante ────────
  const handleWhatsAppSubmit = () => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 9) { setPhoneError('Ingresa un número válido de 9 dígitos'); return }
    setPhoneError('')

    // Número con código Perú (+51) por defecto
    const intl  = cleaned.startsWith('51') ? cleaned : `51${cleaned}`
    const lines = [
      `*${businessConfig?.name || 'Mi Negocio'}*`,
      businessConfig?.ruc ? `RUC: ${businessConfig.ruc}` : null,
      businessConfig?.address || null,
      `─────────────────────`,
      `*BOLETA DE VENTA*`,
      `N°: ${sale.invoiceNumber}`,
      `Fecha: ${formatDateTime(sale.createdAt)}`,
      `─────────────────────`,
      ...sale.items.map(i => `• ${i.productName}\n  ${i.quantity} ${i.unit||'u'} × ${formatCurrency(i.unitPrice)} = *${formatCurrency(i.subtotal)}*`),
      `─────────────────────`,
      `Op. Gravada: ${formatCurrency(baseImponible)}`,
      `IGV (18%): ${formatCurrency(igv)}`,
      `*TOTAL: ${formatCurrency(sale.total)}*`,
      sale.payments?.length ? `─────────────────────` : null,
      ...(sale.payments || []).map(p => {
        const m = PAYMENT_METHODS.find(pm => pm.value === p.method)
        return `${m?.label || p.method}: ${formatCurrency(p.amount)}${p.reference ? ` (Ref: ${p.reference})` : ''}`
      }),
      sale.change > 0 ? `Vuelto: ${formatCurrency(sale.change)}` : null,
      `─────────────────────`,
      businessConfig?.ticketFooter || '¡Gracias por su compra!',
      `Consulte su boleta en: www.sunat.gob.pe`,
    ].filter(Boolean).join('\n')

    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(lines)}`, '_blank')
    setShowPhone(false)
    setPhone('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-auto flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 dark:text-slate-100 text-base">Comprobante de venta</h2>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sale.invoiceNumber} · {formatDateTime(sale.createdAt)}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* ── Vista previa del ticket ── */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-slate-900">
          <div className="flex justify-center">
            <div className="ticket-paper" style={{
              fontFamily: "'Courier New', monospace",
              fontSize: '11px', width: '300px', maxWidth: '100%',
              background: '#fff', padding: '12px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              borderRadius: '4px',
              border: '1px solid #e5e7eb',
            }}>
              {/* Logo del negocio */}
              {businessConfig?.logoUrl && (
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <img src={businessConfig.logoUrl} alt="Logo" style={{ maxWidth: '120px', maxHeight: '50px', objectFit: 'contain' }} onError={e => e.target.style.display='none'}/>
                </div>
              )}

              {/* Encabezado SUNAT */}
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', letterSpacing: '1.5px', marginBottom: '2px' }}>
                {(businessConfig?.name || 'MI NEGOCIO').toUpperCase()}
              </div>
              {businessConfig?.ruc     && <div style={{ textAlign: 'center', fontSize: '10px' }}>R.U.C.: {businessConfig.ruc}</div>}
              {businessConfig?.address && <div style={{ textAlign: 'center', fontSize: '9px', color: '#555' }}>{businessConfig.address}</div>}
              {businessConfig?.phone   && <div style={{ textAlign: 'center', fontSize: '9px', color: '#555' }}>Tel: {businessConfig.phone}</div>}

              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }}/>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', marginBottom: '1px' }}>BOLETA DE VENTA ELECTRÓNICA</div>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px' }}>{sale.invoiceNumber}</div>
              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }}/>

              <div style={{ fontSize: '10px', marginBottom: '2px' }}><strong>Fecha:</strong> {formatDateTime(sale.createdAt)}</div>
              {sale.userName && <div style={{ fontSize: '10px', marginBottom: '2px' }}><strong>Cajero:</strong> {sale.userName}</div>}

              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>
                <span style={{ flex: 1 }}>DESCRIPCIÓN</span>
                <span style={{ width: '30px', textAlign: 'right' }}>CANT</span>
                <span style={{ width: '45px', textAlign: 'right' }}>TOTAL</span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '4px 0' }}/>

              {sale.items?.map((item, idx) => (
                <div key={idx} style={{ marginBottom: '5px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{item.productName}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                    <span>{formatCurrency(item.unitPrice)} c/u</span>
                    <span>{item.quantity} {item.unit || ''}</span>
                    <span>{formatCurrency(item.subtotal)}</span>
                  </div>
                  {item.discount > 0 && <div style={{ fontSize: '9px', color: '#22c55e' }}>Descuento aplicado: -{formatCurrency(item.discount)}</div>}
                </div>
              ))}

              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                <span>Op. Gravada:</span><span>{formatCurrency(baseImponible)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                <span>I.G.V. (18%):</span><span>{formatCurrency(igv)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginBottom: '2px' }}>
                <span>IMPORTE TOTAL</span><span>{formatCurrency(sale.total)}</span>
              </div>

              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }}/>
              <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '3px' }}>FORMA DE PAGO:</div>
              {sale.payments?.map((p, idx) => {
                const m = PAYMENT_METHODS.find(pm => pm.value === p.method)
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '1px' }}>
                    <span>{m?.label || p.method}{p.reference ? ` (${p.reference})` : ''}</span>
                    <span>{formatCurrency(p.amount)}</span>
                  </div>
                )
              })}
              {sale.change > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '1px' }}>
                  <span>Vuelto</span><span>{formatCurrency(sale.change)}</span>
                </div>
              )}

              {/* QR SUNAT placeholder */}
              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }}/>
              <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', border: '1px solid #999', fontSize: '7px', textAlign: 'center', padding: '4px', color: '#666' }}>
                  QR<br/>SUNAT<br/>{sale.invoiceNumber?.slice(-6)}
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: '8px', color: '#666', marginBottom: '2px' }}>
                Representación impresa de Boleta de Venta Electrónica
              </div>
              <div style={{ textAlign: 'center', fontSize: '8px', color: '#666', marginBottom: '4px' }}>
                Consulte en: <strong>www.sunat.gob.pe</strong>
              </div>
              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }}/>
              <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                {businessConfig?.ticketFooter || '¡Gracias por su compra!'}
              </div>
              <div style={{ textAlign: 'center', fontSize: '9px', color: '#888', marginTop: '2px' }}>
                Conserve este comprobante
              </div>
            </div>
          </div>
        </div>

        {/* ── Panel WhatsApp: pedir número ── */}
        {showPhone && (
          <div className="px-5 py-4 border-t border-green-100 dark:border-green-900/40 bg-green-50 dark:bg-green-950/30 flex-shrink-0">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">📱 Enviar comprobante por WhatsApp</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">Ingresa el número de celular del cliente para enviar el comprobante</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">+51</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setPhoneError('') }}
                  placeholder="999 999 999"
                  autoFocus
                  maxLength={9}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  onKeyDown={e => e.key === 'Enter' && handleWhatsAppSubmit()}
                />
              </div>
              <button onClick={handleWhatsAppSubmit} className="px-4 py-2.5 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 transition-colors whitespace-nowrap">
                Enviar
              </button>
              <button onClick={() => { setShowPhone(false); setPhone(''); setPhoneError('') }} className="px-3 py-2.5 border border-gray-200 text-gray-500 text-sm rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
            </div>
            {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
          </div>
        )}

        {/* ── Botones de acción ── */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-800 rounded-b-2xl">
          <div className="grid grid-cols-3 gap-2">
            {/* WhatsApp */}
            <button
              onClick={() => setShowPhone(p => !p)}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold transition-all ${showPhone ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'}`}
            >
              <span className="text-xl">📱</span>
              <span>WhatsApp</span>
            </button>

            {/* Imprimir */}
            <button
              onClick={handlePrint}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all"
            >
              <span className="text-xl">🖨️</span>
              <span>Imprimir</span>
              <span className="text-xs font-normal opacity-60">80mm</span>
            </button>

            {/* Cerrar */}
            <button
              onClick={onClose}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 transition-all"
            >
              <span className="text-xl">✓</span>
              <span>Cerrar</span>
              <span className="text-xs font-normal opacity-60">Nueva venta</span>
            </button>
          </div>

          {/* Info impresora */}
          <p className="text-center text-xs text-gray-400 mt-2">
            Impresión optimizada para impresora de tickets 58mm/80mm · Formato SUNAT
          </p>
        </div>
      </div>
    </div>
  )
}
