/**
 * SaleTicket.jsx — Comprobante de Venta v3
 * Ruta: src/features/pos/components/SaleTicket.jsx
 *
 * CAMBIOS vs v2:
 *  1. Cada línea del ticket muestra 1 ud. con su precio unitario (modo acumulativo)
 *  2. Descuento se imprime DEBAJO de la línea que lo originó (campaña o manual)
 *  3. Sección "Ahorro por Promoción" en el bloque de totales (si aplica)
 *  4. Formato SUNAT respetado: Op. Gravada / IGV / IMPORTE TOTAL
 *  5. HTML de impresión 80mm actualizado con el mismo formato
 */

import { useState } from 'react'
import { useStore } from '../../../store/index'
import { formatCurrency, formatDateTime } from '../../../shared/utils/helpers'
import { PAYMENT_METHODS } from '../../../config/app'

const IGV_RATE = 0.18

// ─── Generador HTML para impresión 80mm ───────────────────────────────────────
function buildTicketHTML(sale, businessConfig) {
  const igvRate       = sale.igvRate       || IGV_RATE
  const baseImponible = sale.baseImponible ?? parseFloat((sale.total / (1 + igvRate)).toFixed(2))
  const igv           = sale.igv           ?? parseFloat((sale.total - baseImponible).toFixed(2))
  const subtotalBruto = sale.subtotalBruto ?? sale.total
  const descuentos    = sale.totalDescuentos ?? sale.discount ?? 0
  const groupSummary  = sale.groupSummary  || []

  const logoHtml = businessConfig?.logoUrl
    ? `<div style="text-align:center;margin-bottom:3mm">
         <img src="${businessConfig.logoUrl}" style="max-width:50mm;max-height:20mm;object-fit:contain" onerror="this.style.display='none'">
       </div>`
    : ''

  // ── Líneas de ítems — datos reales: cantidad, PU, descuento, total ──────────
  const itemsHtml = (sale.items || []).map(item => {
    const qty          = item.quantity || 1
    const pu           = item.unitPrice || 0
    const itemDiscount = parseFloat((
      (item.totalDiscount || 0) ||
      ((item.campaignDiscount || 0) + (item.discount || 0))
    ).toFixed(2))
    const lineTotal    = item.netTotal ?? item.subtotal ?? parseFloat((qty * pu - itemDiscount).toFixed(2))
    const discDetails  = item.discountDetails || []

    const discHtml = discDetails.map(d =>
      `<div style="font-size:9px;color:#059669;margin-left:2mm">
         ${d.icon || '🏷️'} ${d.label || 'Campaña'}: -${formatCurrency(d.amount)}
       </div>`
    ).join('') +
    (item.manualDiscount > 0
      ? `<div style="font-size:9px;color:#6b7280;margin-left:2mm">Dto. manual: -${formatCurrency(item.manualDiscount)}</div>`
      : '')

    return `
    <div style="margin-bottom:2.5mm">
      <div style="font-weight:bold;font-size:10px">${item.productName}</div>
      <div style="display:flex;justify-content:space-between;font-size:10px">
        <span style="flex:2">${item.unit || 'u'}</span>
        <span style="width:22px;text-align:center">${qty}</span>
        <span style="width:38px;text-align:right">${formatCurrency(pu)}</span>
        <span style="width:32px;text-align:right">${itemDiscount > 0 ? '-'+formatCurrency(itemDiscount) : '—'}</span>
        <span style="width:38px;text-align:right;font-weight:bold">${formatCurrency(lineTotal)}</span>
      </div>
      ${discHtml}
    </div>`
  }).join('')

  // ── Ahorro por grupo ──────────────────────────────────────────────────────
  const groupHtml = groupSummary.length > 0
    ? `<hr class="hr">
       <div style="font-size:9px;font-weight:bold;margin-bottom:1mm">AHORRO POR PROMOCIÓN:</div>
       ${groupSummary.map(g =>
         `<div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:0.5mm">
            <span>${g.icon} ${g.name}</span><span style="color:#059669">-${formatCurrency(g.saving)}</span>
          </div>`
       ).join('')}`
    : ''

  // ── Pagos ─────────────────────────────────────────────────────────────────
  const paymentsHtml = (sale.payments || []).map(p => {
    const m = PAYMENT_METHODS.find(pm => pm.value === p.method)
    return `<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:1mm">
      <span>${m?.label || p.method}${p.reference ? ` (${p.reference})` : ''}</span>
      <span>${formatCurrency(p.amount)}</span>
    </div>`
  }).join('')

  const changeHtml = sale.change > 0
    ? `<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:1mm">
         <span>Vuelto</span><span>${formatCurrency(sale.change)}</span>
       </div>`
    : ''

  const qrPlaceholder = `
    <div style="text-align:center;margin:3mm 0">
      <div style="display:inline-block;width:25mm;height:25mm;border:1px solid #000;font-size:7px;display:flex;align-items:center;justify-content:center;text-align:center;padding:2mm">
        Código verificación SUNAT<br>${sale.invoiceNumber}
      </div>
    </div>`

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Boleta ${sale.invoiceNumber}</title>
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
  <div class="center bold" style="font-size:11px;margin-bottom:1mm">BOLETA DE VENTA ELECTRÓNICA</div>
  <div class="center bold" style="font-size:11px;letter-spacing:1px">${sale.invoiceNumber}</div>
  <hr class="hr">

  <div style="font-size:10px;margin-bottom:1mm"><strong>Fecha:</strong> ${formatDateTime(sale.createdAt)}</div>
  ${sale.userName   ? `<div style="font-size:10px;margin-bottom:1mm"><strong>Cajero:</strong> ${sale.userName}</div>` : ''}
  ${sale.clientName ? `<div style="font-size:10px;margin-bottom:1mm"><strong>Cliente:</strong> ${sale.clientName}</div>` : ''}

  <hr class="hr">
  <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:bold;margin-bottom:1.5mm">
    <span style="flex:2">PRODUCTO</span>
    <span style="width:22px;text-align:center">CANT</span>
    <span style="width:38px;text-align:right">P.U.</span>
    <span style="width:32px;text-align:right">DSCT.</span>
    <span style="width:38px;text-align:right">TOTAL</span>
  </div>
  <hr class="hr">
  ${itemsHtml}
  <hr class="hr">

  ${groupHtml}
  ${groupSummary.length > 0 ? '<hr class="hr">' : ''}

  <div class="row" style="font-size:10px;margin-bottom:1mm"><span>Subtotal:</span><span>${formatCurrency(subtotalBruto)}</span></div>
  ${descuentos > 0
    ? `<div class="row" style="font-size:10px;margin-bottom:1mm;color:#059669"><span>Descuentos:</span><span>-${formatCurrency(descuentos)}</span></div>`
    : ''}
  <div class="row" style="font-size:10px;margin-bottom:1mm"><span>Op. Gravada:</span><span>${formatCurrency(baseImponible)}</span></div>
  <div class="row" style="font-size:10px;margin-bottom:1.5mm"><span>I.G.V. (${Math.round(igvRate*100)}%):</span><span>${formatCurrency(igv)}</span></div>
  <div class="row bold" style="font-size:13px;margin-bottom:1mm"><span>IMPORTE TOTAL</span><span>${formatCurrency(sale.total)}</span></div>
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

  const igvRate       = sale.igvRate       || IGV_RATE
  const baseImponible = sale.baseImponible ?? parseFloat((sale.total / (1 + igvRate)).toFixed(2))
  const igv           = sale.igv           ?? parseFloat((sale.total - baseImponible).toFixed(2))
  const subtotalBruto = sale.subtotalBruto ?? sale.total
  const descuentos    = sale.totalDescuentos ?? sale.discount ?? 0
  const groupSummary  = sale.groupSummary  || []

  const handlePrint = () => {
    const html = buildTicketHTML(sale, businessConfig)
    const win  = window.open('', '_blank', 'width=380,height=700,left=100,top=50')
    if (!win) { alert('Activa las ventanas emergentes para imprimir'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 400)
  }

  const handleWhatsAppSubmit = () => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 9) { setPhoneError('Ingresa un número válido de 9 dígitos'); return }
    setPhoneError('')
    const intl  = cleaned.startsWith('51') ? cleaned : `51${cleaned}`

    const itemLines = sale.items.map(item => {
      const qty  = item.quantity || 1
      const pu   = item.unitPrice || 0
      const disc = (item.totalDiscount || 0) || ((item.discount || 0) + (item.campaignDiscount || 0))
      const net  = item.netTotal ?? item.subtotal ?? parseFloat((qty * pu - disc).toFixed(2))
      return `• ${item.productName}\n  ${qty} ${item.unit||'u'} × ${formatCurrency(pu)}${disc > 0 ? ` (-${formatCurrency(disc)})` : ''} = *${formatCurrency(net)}*`
    })

    const groupLines = groupSummary.map(g =>
      `${g.icon} Ahorro ${g.name}: -${formatCurrency(g.saving)}`
    )

    const lines = [
      `*${businessConfig?.name || 'Mi Negocio'}*`,
      businessConfig?.ruc ? `RUC: ${businessConfig.ruc}` : null,
      businessConfig?.address || null,
      `─────────────────────`,
      `*BOLETA DE VENTA*`,
      `N°: ${sale.invoiceNumber}`,
      `Fecha: ${formatDateTime(sale.createdAt)}`,
      `─────────────────────`,
      ...itemLines,
      `─────────────────────`,
      ...(groupLines.length > 0 ? [...groupLines, `─────────────────────`] : []),
      descuentos > 0 ? `Descuentos: -${formatCurrency(descuentos)}` : null,
      `Op. Gravada: ${formatCurrency(baseImponible)}`,
      `IGV (${Math.round(igvRate*100)}%): ${formatCurrency(igv)}`,
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

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 dark:text-slate-100 text-base">Comprobante de venta</h2>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sale.invoiceNumber} · {formatDateTime(sale.createdAt)}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Vista previa del ticket */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-slate-900" style={{ colorScheme: 'light' }}>
          <div className="flex justify-center">
            <div style={{
              fontFamily: "'Courier New', monospace",
              fontSize: '11px', width: '300px', maxWidth: '100%',
              background: '#ffffff', color: '#000000', WebkitTextFillColor: '#000000', padding: '12px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              borderRadius: '4px', border: '1px solid #e5e7eb',
            }}>

              {/* Logo */}
              {businessConfig?.logoUrl && (
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <img src={businessConfig.logoUrl} alt="Logo"
                    style={{ maxWidth: '120px', maxHeight: '50px', objectFit: 'contain' }}
                    onError={e => e.target.style.display='none'}/>
                </div>
              )}

              {/* Encabezado SUNAT */}
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', letterSpacing: '1.5px', marginBottom: '2px' }}>
                {(businessConfig?.name || 'MI NEGOCIO').toUpperCase()}
              </div>
              {businessConfig?.ruc     && <div style={{ textAlign: 'center', fontSize: '10px' }}>R.U.C.: {businessConfig.ruc}</div>}
              {businessConfig?.address && <div style={{ textAlign: 'center', fontSize: '9px', color: '#333333' }}>{businessConfig.address}</div>}
              {businessConfig?.phone   && <div style={{ textAlign: 'center', fontSize: '9px', color: '#333333' }}>Tel: {businessConfig.phone}</div>}

              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }}/>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', marginBottom: '1px' }}>BOLETA DE VENTA ELECTRÓNICA</div>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px' }}>{sale.invoiceNumber}</div>
              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }}/>

              <div style={{ fontSize: '10px', marginBottom: '2px' }}><strong>Fecha:</strong> {formatDateTime(sale.createdAt)}</div>
              {sale.userName   && <div style={{ fontSize: '10px', marginBottom: '2px' }}><strong>Cajero:</strong> {sale.userName}</div>}
              {sale.clientName && <div style={{ fontSize: '10px', marginBottom: '2px' }}><strong>Cliente:</strong> {sale.clientName}</div>}

              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>
                <span style={{ flex: 2 }}>PRODUCTO</span>
                <span style={{ width: '22px', textAlign: 'center' }}>CANT</span>
                <span style={{ width: '42px', textAlign: 'right' }}>P.U.</span>
                <span style={{ width: '36px', textAlign: 'right' }}>DSCT.</span>
                <span style={{ width: '42px', textAlign: 'right' }}>TOTAL</span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '4px 0' }}/>

              {/* ── ÍTEMS — datos reales: CANT, PRODUCTO, P.U., DSCT., TOTAL ── */}
              {sale.items?.map((item, idx) => {
                const qty          = item.quantity || 1
                const pu           = item.unitPrice || 0
                const itemDiscount = parseFloat((
                  (item.totalDiscount || 0) ||
                  ((item.campaignDiscount || 0) + (item.discount || 0))
                ).toFixed(2))
                const lineTotal    = item.netTotal ?? item.subtotal ??
                                     parseFloat((qty * pu - itemDiscount).toFixed(2))
                const discDetails  = item.discountDetails || []

                return (
                  <div key={idx} style={{ marginBottom: '5px' }}>
                    {/* Nombre del producto */}
                    <div style={{ fontSize: '10px', fontWeight: 'bold' }}>
                      {item.productName}
                    </div>

                    {/* CANT · P.U. · DSCT. · TOTAL */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                      <span style={{ flex: 2, color: '#333333' }}>{item.unit || 'u'}</span>
                      <span style={{ width: '22px', textAlign: 'center' }}>{qty}</span>
                      <span style={{ width: '42px', textAlign: 'right' }}>{formatCurrency(pu)}</span>
                      <span style={{ width: '36px', textAlign: 'right', color: itemDiscount > 0 ? '#dc2626' : '#666666' }}>
                        {itemDiscount > 0 ? `-${formatCurrency(itemDiscount)}` : '—'}
                      </span>
                      <span style={{ width: '42px', textAlign: 'right', fontWeight: 'bold' }}>
                        {formatCurrency(lineTotal)}
                      </span>
                    </div>

                    {/* Detalle de descuento(s) de campaña */}
                    {discDetails.map((d, di) => (
                      <div key={di} style={{ fontSize: '9px', color: '#059669', display: 'flex', justifyContent: 'space-between', marginLeft: '4px' }}>
                        <span>{d.icon || '🏷️'} {d.label}</span>
                        <span>-{formatCurrency(d.amount)}</span>
                      </div>
                    ))}

                    {/* Descuento manual */}
                    {item.manualDiscount > 0 && (
                      <div style={{ fontSize: '9px', color: '#6b7280', display: 'flex', justifyContent: 'space-between', marginLeft: '4px' }}>
                        <span>Dto. manual</span>
                        <span>-{formatCurrency(item.manualDiscount)}</span>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* ── Ahorro por grupo ── */}
              {groupSummary.length > 0 && (
                <>
                  <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }}/>
                  <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '2px' }}>AHORRO POR PROMOCIÓN:</div>
                  {groupSummary.map((g, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '1px' }}>
                      <span>{g.icon} {g.name}</span>
                      <span style={{ color: '#059669', fontWeight: 'bold' }}>-{formatCurrency(g.saving)}</span>
                    </div>
                  ))}
                </>
              )}

              {/* ── Totales fiscales ── */}
              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                <span>Subtotal:</span><span>{formatCurrency(subtotalBruto)}</span>
              </div>
              {descuentos > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '1px', color: '#059669' }}>
                  <span>Descuentos:</span><span>-{formatCurrency(descuentos)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '1px' }}>
                <span>Op. Gravada:</span><span>{formatCurrency(baseImponible)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                <span>I.G.V. ({Math.round(igvRate*100)}%):</span><span>{formatCurrency(igv)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginBottom: '2px' }}>
                <span>IMPORTE TOTAL</span><span>{formatCurrency(sale.total)}</span>
              </div>

              {/* ── Forma de pago ── */}
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

              {/* QR SUNAT */}
              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }}/>
              <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', border: '1px solid #999', fontSize: '7px', textAlign: 'center', padding: '4px', color: '#444444' }}>
                  QR<br/>SUNAT<br/>{sale.invoiceNumber?.slice(-6)}
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: '8px', color: '#444444', marginBottom: '2px' }}>
                Representación impresa de Boleta de Venta Electrónica
              </div>
              <div style={{ textAlign: 'center', fontSize: '8px', color: '#444444', marginBottom: '4px' }}>
                Consulte en: <strong>www.sunat.gob.pe</strong>
              </div>
              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }}/>
              <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                {businessConfig?.ticketFooter || '¡Gracias por su compra!'}
              </div>
              <div style={{ textAlign: 'center', fontSize: '9px', color: '#555555', marginTop: '2px' }}>
                Conserve este comprobante
              </div>
            </div>
          </div>
        </div>

        {/* Panel WhatsApp */}
        {showPhone && (
          <div className="px-5 py-4 border-t border-green-100 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 flex-shrink-0">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">📱 Enviar comprobante por WhatsApp</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">+51</span>
                <input
                  type="tel" value={phone}
                  onChange={e => { setPhone(e.target.value); setPhoneError('') }}
                  placeholder="999 999 999" autoFocus maxLength={9}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-100"
                  onKeyDown={e => e.key === 'Enter' && handleWhatsAppSubmit()}/>
              </div>
              <button onClick={handleWhatsAppSubmit}
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

        {/* Botones de acción */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-800 rounded-b-2xl">
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setShowPhone(p => !p)}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold transition-all ${showPhone ? 'bg-green-500 text-white' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 border border-green-200 dark:border-green-800'}`}>
              <span className="text-xl">📱</span>
              <span>WhatsApp</span>
            </button>
            <button onClick={handlePrint}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 transition-all">
              <span className="text-xl">🖨️</span>
              <span>Imprimir</span>
              <span className="text-xs font-normal opacity-60">80mm</span>
            </button>
            <button onClick={onClose}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 transition-all">
              <span className="text-xl">✓</span>
              <span>Cerrar</span>
              <span className="text-xs font-normal opacity-60">Nueva venta</span>
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-slate-500 mt-2">
            Formato SUNAT · Impresión optimizada 58mm/80mm
          </p>
        </div>
      </div>
    </div>
  )
}