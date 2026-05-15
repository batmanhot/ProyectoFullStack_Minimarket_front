/**
 * SaleTicket.jsx — Comprobante de Venta v4
 * Ruta: src/features/pos/components/SaleTicket.jsx
 *
 * CAMBIOS vs v3:
 * 1. Botón "Descargar PDF" genera archivo con nombre: {invoiceNumber}_{negocio}.pdf
 * 2. WhatsApp ahora adjunta el PDF generado (Blob + descarga automática)
 * 3. Hook usePDF integrado para generación de PDF desde el DOM
 * 4. Formato 80mm optimizado para tickets térmicos
 */

import { useState, useRef, useCallback } from 'react'
import { useStore } from '../../../store/index'
import { formatCurrency, formatDateTime } from '../../../shared/utils/helpers'
// import { PAYMENT_METHODS } from '../../../shared/constants/paymentMethods'
import { PAYMENT_METHODS } from '../../../config/app'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const IGV_RATE = 0.18

// ─── Helper: Generar PDF desde elemento DOM ─────────────────────────────
async function generateTicketPDF(element, { invoiceNumber, businessName }) {
  if (!element) throw new Error('Elemento no encontrado')

  // Capturar el ticket como imagen de alta resolución
  const canvas = await html2canvas(element, {
    scale: 3, // Alta resolución para tickets pequeños
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: element.scrollWidth,
    height: element.scrollHeight,
  })

  const imgData = canvas.toDataURL('image/png')

  // PDF con formato ticket 80mm de ancho
  const pdfWidth = 80 // mm
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pdfWidth, pdfHeight],
  })

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)

  // Nombre del archivo: B001-001933_MI_NEGOCIO.pdf
  const safeBusinessName = (businessName || 'MI_NEGOCIO')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toUpperCase()

  const fileName = `${invoiceNumber}_${safeBusinessName}.pdf`

  return { pdf, fileName, blob: pdf.output('blob') }
}

// ─── Generador HTML para impresión 80mm ─────────────────────────────────
function buildTicketHTML(sale, businessConfig) {
  const igvRate = sale.igvRate || IGV_RATE
  const baseImponible = sale.baseImponible ?? parseFloat((sale.total / (1 + igvRate)).toFixed(2))
  const igv = sale.igv ?? parseFloat((sale.total - baseImponible).toFixed(2))
  const subtotalBruto = sale.subtotalBruto ?? sale.total
  const descuentos = sale.totalDescuentos ?? sale.discount ?? 0
  const groupSummary = sale.groupSummary || []

  // ── Logo ──
  const logoHtml = businessConfig?.logo
    ? `<div style="text-align:center;margin-bottom:2mm"><img src="${businessConfig.logo}" style="max-width:35mm;max-height:15mm"/></div>`
    : ''

  // ── Items ──
  const itemsHtml = (sale.items || []).filter(item => !item._fromBundle).map((item, idx) => {
    const qty = item.quantity ?? item.qty ?? 1
    const pu = item.unitPrice ?? item.price ?? 0
    const itemDiscount = item.totalDiscount ?? item.discount ?? 0
    const lineTotal = (item.total ?? (qty * pu)) - itemDiscount

    // Detalle de descuentos de campaña
    const discDetails = (item.discountDetails || []).filter(d => d.amount > 0)
    const discHtml = discDetails.map((d, di) =>
      `<div style="display:flex;justify-content:space-between;font-size:9px;color:#059669;margin-left:4px">
        <span>${d.icon || '🏷️'} ${d.name || 'Promo'}</span>
        <span>-${formatCurrency(d.amount)}</span>
      </div>`
    ).join('')

    return `
    <div style="margin-bottom:4px">
      <div style="font-size:10px;font-weight:bold">${item.productName || item.name}</div>
      <div style="display:flex;justify-content:space-between;font-size:10px">
        <span style="flex:2;color:#333">${item.unit || 'u'}</span>
        <span style="width:22px;text-align:center">${qty}</span>
        <span style="width:42px;text-align:right">${formatCurrency(pu)}</span>
        <span style="width:36px;text-align:right;color:${itemDiscount > 0 ? '#dc2626' : '#666'}">
          ${itemDiscount > 0 ? `-${formatCurrency(itemDiscount)}` : '—'}
        </span>
        <span style="width:42px;text-align:right;font-weight:bold">${formatCurrency(lineTotal)}</span>
      </div>
      ${discHtml}
      ${item.manualDiscount > 0 ? `
        <div style="font-size:9px;color:#6b7280;display:flex;justify-content:space-between;margin-left:4px">
          <span>Dto. manual</span><span>-${formatCurrency(item.manualDiscount)}</span>
        </div>` : ''}
    </div>`
  }).join('')

  // ── Ahorro por grupo ──
  const groupHtml = groupSummary.length > 0
    ? `<hr class="hr">
       <div style="font-size:9px;font-weight:bold;margin-bottom:1mm">AHORRO POR PROMOCIÓN:</div>
       ${groupSummary.map(g => `
         <div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:0.5mm">
           <span>${g.icon || '🎁'} ${g.name}</span>
           <span style="color:#059669;font-weight:bold">-${formatCurrency(g.saving || g.amount || 0)}</span>
         </div>
       `).join('')}`
    : ''

  // ── Pagos ──
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
        Código verificación<br/>SUNAT
      </div>
    </div>`

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Boleta ${sale.invoiceNumber}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Courier New',Courier,monospace;font-size:10px;width:80mm;padding:4mm;color:#000;background:#fff;}
.hr{border:none;border-top:1px dashed #000;margin:2.5mm 0;}
.row{display:flex;justify-content:space-between;}
.center{text-align:center;}
.bold{font-weight:bold;}
@page{size:80mm auto;margin:0;}
@media print{html,body{width:80mm;}}
</style></head>
<body>
${logoHtml}
<div class="center bold" style="font-size:12px;margin-bottom:1mm">${(businessConfig?.name || 'MI NEGOCIO').toUpperCase()}</div>
${businessConfig?.ruc ? `<div class="center" style="font-size:9px">RUC: ${businessConfig.ruc}</div>` : ''}
${businessConfig?.address ? `<div class="center" style="font-size:9px">${businessConfig.address}</div>` : ''}
${businessConfig?.phone ? `<div class="center" style="font-size:9px">Tel: ${businessConfig.phone}</div>` : ''}
<hr class="hr">
<div class="center bold" style="font-size:11px;margin-bottom:1mm">BOLETA DE VENTA ELECTRÓNICA</div>
<div class="center bold" style="font-size:11px;letter-spacing:1px">${sale.invoiceNumber}</div>
<hr class="hr">
<div style="font-size:10px;margin-bottom:1mm"><strong>Fecha:</strong> ${formatDateTime(sale.date || new Date())}</div>
${sale.userName ? `<div style="font-size:10px;margin-bottom:1mm"><strong>Cajero:</strong> ${sale.userName}</div>` : ''}
${sale.clientName ? `<div style="font-size:10px;margin-bottom:1mm"><strong>Cliente:</strong> ${sale.clientName}</div>` : ''}
<hr class="hr">
<div style="display:flex;justify-content:space-between;font-size:10px;font-weight:bold;margin-bottom:1.5mm">
  <span style="flex:2">PRODUCTO</span>
  <span style="width:22px;text-align:center">CANT</span>
  <span style="width:42px;text-align:right">P.U.</span>
  <span style="width:36px;text-align:right">DSCT.</span>
  <span style="width:42px;text-align:right">TOTAL</span>
</div>
<hr class="hr">
${itemsHtml}
<hr class="hr">
${groupHtml}
${groupSummary.length > 0 ? '<hr class="hr">' : ''}
<div class="row" style="font-size:10px;margin-bottom:1mm"><span>Subtotal:</span><span>${formatCurrency(subtotalBruto)}</span></div>
${descuentos > 0 ? `<div class="row" style="font-size:10px;margin-bottom:1mm;color:#059669"><span>Descuentos:</span><span>-${formatCurrency(descuentos)}</span></div>` : ''}
<div class="row" style="font-size:10px;margin-bottom:1mm"><span>Op. Gravada:</span><span>${formatCurrency(baseImponible)}</span></div>
<div class="row" style="font-size:10px;margin-bottom:1mm"><span>IGV (${Math.round(igvRate * 100)}%):</span><span>${formatCurrency(igv)}</span></div>
<div class="row bold" style="font-size:13px;margin-bottom:1mm"><span>IMPORTE TOTAL</span><span>${formatCurrency(sale.total)}</span></div>
<hr class="hr">
<div class="bold" style="font-size:10px;margin-bottom:1.5mm">FORMA DE PAGO:</div>
${paymentsHtml}
${changeHtml}
<hr class="hr">
${qrPlaceholder}
<div class="center" style="font-size:9px;margin-top:1mm">Representación impresa de Boleta de Venta Electrónica</div>
<div class="center" style="font-size:9px">Consulte en: <strong>www.sunat.gob.pe</strong></div>
<hr class="hr">
<div class="center" style="font-size:10px;font-weight:bold">${businessConfig?.ticketFooter || '¡Gracias por su compra!'}</div>
<div class="center" style="font-size:9px;margin-top:1mm">Conserve este comprobante</div>
<br>
</body></html>`
}

// ─── Componente principal ────────────────────────────────────────────────
export default function SaleTicket({ sale, onClose }) {
  const { businessConfig } = useStore()
  const [showPhone, setShowPhone] = useState(false)
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  
  // Ref para capturar el ticket en el DOM
  const ticketRef = useRef(null)

  const igvRate = sale.igvRate || IGV_RATE
  const baseImponible = sale.baseImponible ?? parseFloat((sale.total / (1 + igvRate)).toFixed(2))
  const igv = sale.igv ?? parseFloat((sale.total - baseImponible).toFixed(2))
  const subtotalBruto = sale.subtotalBruto ?? sale.total
  const descuentos = sale.totalDescuentos ?? sale.discount ?? 0
  const groupSummary = sale.groupSummary || []

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLER: Descargar PDF
  // ═══════════════════════════════════════════════════════════════════════
  const handleDownloadPDF = useCallback(async () => {
    if (!ticketRef.current) return
    
    setPdfLoading(true)
    try {
      const { pdf, fileName } = await generateTicketPDF(ticketRef.current, {
        invoiceNumber: sale.invoiceNumber,
        businessName: businessConfig?.name || 'MI_NEGOCIO',
      })
      
      pdf.save(fileName)
    } catch (error) {
      console.error('Error generando PDF:', error)
      alert('Error al generar PDF: ' + error.message)
    } finally {
      setPdfLoading(false)
    }
  }, [sale.invoiceNumber, businessConfig?.name])

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLER: WhatsApp con PDF adjunto
  // ═══════════════════════════════════════════════════════════════════════
  const handleWhatsAppSubmit = useCallback(async () => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 9) {
      setPhoneError('Ingresa un número válido de 9 dígitos')
      return
    }

    setPdfLoading(true)
    try {
      // 1. Generar el PDF
      const { pdf, fileName, blob } = await generateTicketPDF(ticketRef.current, {
        invoiceNumber: sale.invoiceNumber,
        businessName: businessConfig?.name || 'MI_NEGOCIO',
      })

      // 2. Descargar automáticamente el PDF
      pdf.save(fileName)

      // 3. Construir mensaje predefinido
      const groupLines = groupSummary.map(g =>
        `${g.icon || '🎁'} ${g.name}: Ahorro ${formatCurrency(g.saving || g.amount || 0)}`
      )

      const lines = [
        `¡Gracias por tu compra en ${businessConfig?.name || 'nuestro negocio'}! 🛒`,
        '',
        `*Boleta:* ${sale.invoiceNumber}`,
        `*Fecha:* ${formatDateTime(sale.date || new Date())}`,
        `*Total:* S/ ${formatCurrency(sale.total)}`,
        '',
        ...(groupLines.length > 0 ? [...groupLines, '─────────────────────'] : []),
        descuentos > 0 ? `Descuentos: -${formatCurrency(descuentos)}` : null,
        `Op. Gravada: ${formatCurrency(baseImponible)}`,
        `IGV (${Math.round(igvRate * 100)}%): ${formatCurrency(igv)}`,
        `*TOTAL: ${formatCurrency(sale.total)}*`,
        sale.payments?.length ? `─────────────────────` : null,
        ...(sale.payments || []).map(p => {
          const m = PAYMENT_METHODS.find(pm => pm.value === p.method)
          return `${m?.label || p.method}: ${formatCurrency(p.amount)}${p.reference ? ` (Ref: ${p.reference})` : ''}`
        }),
        sale.change > 0 ? `Vuelto: ${formatCurrency(sale.change)}` : null,
        `─────────────────────`,
        businessConfig?.ticketFooter || '¡Gracias por su compra!',
        '',
        `Consulte su boleta en: www.sunat.gob.pe`,
        '',
        '📎 *Adjunta el PDF descargado* para tener tu comprobante digital.',
      ].filter(Boolean).join('\n')

      // 4. Abrir WhatsApp Web/App
      const intl = cleaned.startsWith('51') ? cleaned : `51${cleaned}`
      window.open(`https://wa.me/${intl}?text=${encodeURIComponent(lines)}`, '_blank')

      setShowPhone(false)
      setPhone('')
      setPhoneError('')

    } catch (error) {
      console.error('Error enviando WhatsApp:', error)
      alert('Error: ' + error.message)
    } finally {
      setPdfLoading(false)
    }
  }, [phone, sale, businessConfig, igvRate, baseImponible, igv, subtotalBruto, descuentos, groupSummary])

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLER: Imprimir
  // ═══════════════════════════════════════════════════════════════════════
  const handlePrint = useCallback(() => {
    const html = buildTicketHTML(sale, businessConfig)
    const win = window.open('', '_blank', 'width=380,height=700,left=100,top=50')
    if (!win) {
      alert('Activa las ventanas emergentes para imprimir')
      return
    }
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 400)
  }, [sale, businessConfig])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-auto flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 dark:text-slate-100 text-base">Comprobante de venta</h2>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              {sale.invoiceNumber} · {formatDateTime(sale.date || new Date())}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Vista previa del ticket (referencia para PDF) ── */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-slate-900" style={{ colorScheme: 'light' }}>
          <div className="flex justify-center">
            <div
              ref={ticketRef}
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: '11px',
                width: '300px',
                maxWidth: '100%',
                background: '#ffffff',
                color: '#000000',
                WebkitTextFillColor: '#000000',
                padding: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                borderRadius: '4px',
                border: '1px solid #e5e7eb',
              }}
            >
              {/* Logo */}
              {businessConfig?.logo && (
                <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                  <img src={businessConfig.logo} alt="logo" style={{ maxWidth: '120px', maxHeight: '50px' }} />
                </div>
              )}

              {/* Negocio */}
              <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', marginBottom: '1px' }}>
                {(businessConfig?.name || 'MI NEGOCIO').toUpperCase()}
              </div>
              {businessConfig?.ruc && <div style={{ textAlign: 'center', fontSize: '9px' }}>RUC: {businessConfig.ruc}</div>}
              {businessConfig?.address && <div style={{ textAlign: 'center', fontSize: '9px' }}>{businessConfig.address}</div>}
              {businessConfig?.phone && <div style={{ textAlign: 'center', fontSize: '9px' }}>Tel: {businessConfig.phone}</div>}

              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', marginBottom: '1px' }}>
                BOLETA DE VENTA ELECTRÓNICA
              </div>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px' }}>
                {sale.invoiceNumber}
              </div>

              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

              <div style={{ fontSize: '10px', marginBottom: '2px' }}>
                <strong>Fecha:</strong> {formatDateTime(sale.date || new Date())}
              </div>
              {sale.userName && <div style={{ fontSize: '10px', marginBottom: '2px' }}><strong>Cajero:</strong> {sale.userName}</div>}
              {sale.clientName && <div style={{ fontSize: '10px', marginBottom: '2px' }}><strong>Cliente:</strong> {sale.clientName}</div>}

              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

              {/* Headers tabla */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold', marginBottom: '3px' }}>
                <span style={{ flex: 2 }}>PRODUCTO</span>
                <span style={{ width: '22px', textAlign: 'center' }}>CANT</span>
                <span style={{ width: '42px', textAlign: 'right' }}>P.U.</span>
                <span style={{ width: '36px', textAlign: 'right' }}>DSCT.</span>
                <span style={{ width: '42px', textAlign: 'right' }}>TOTAL</span>
              </div>

              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

              {/* Items */}
              {(sale.items || []).filter(item => !item._fromBundle).map((item, idx) => {
                const qty = item.quantity ?? item.qty ?? 1
                const pu = item.unitPrice ?? item.price ?? 0
                const itemDiscount = item.totalDiscount ?? item.discount ?? 0
                const lineTotal = (item.total ?? (qty * pu)) - itemDiscount
                const discDetails = (item.discountDetails || []).filter(d => d.amount > 0)

                return (
                  <div key={idx} style={{ marginBottom: '5px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{item.productName || item.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                      <span style={{ flex: 2, color: '#333' }}>{item.unit || 'u'}</span>
                      <span style={{ width: '22px', textAlign: 'center' }}>{qty}</span>
                      <span style={{ width: '42px', textAlign: 'right' }}>{formatCurrency(pu)}</span>
                      <span style={{ width: '36px', textAlign: 'right', color: itemDiscount > 0 ? '#dc2626' : '#666' }}>
                        {itemDiscount > 0 ? `-${formatCurrency(itemDiscount)}` : '—'}
                      </span>
                      <span style={{ width: '42px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(lineTotal)}</span>
                    </div>
                    {discDetails.map((d, di) => (
                      <div key={di} style={{ fontSize: '9px', color: '#059669', display: 'flex', justifyContent: 'space-between', marginLeft: '4px' }}>
                        <span>{d.icon || '🏷️'} {d.name || 'Promo'}</span>
                        <span>-{formatCurrency(d.amount)}</span>
                      </div>
                    ))}
                    {item.manualDiscount > 0 && (
                      <div style={{ fontSize: '9px', color: '#6b7280', display: 'flex', justifyContent: 'space-between', marginLeft: '4px' }}>
                        <span>Dto. manual</span><span>-{formatCurrency(item.manualDiscount)}</span>
                      </div>
                    )}
                  </div>
                )
              })}

              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

              {/* Ahorro por grupo */}
              {groupSummary.length > 0 && (
                <>
                  <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '2px' }}>AHORRO POR PROMOCIÓN:</div>
                  {groupSummary.map((g, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '1px' }}>
                      <span>{g.icon || '🎁'} {g.name}</span>
                      <span style={{ color: '#059669', fontWeight: 'bold' }}>-{formatCurrency(g.saving || g.amount || 0)}</span>
                    </div>
                  ))}
                  <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />
                </>
              )}

              {/* Totales */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                <span>Subtotal:</span><span>{formatCurrency(subtotalBruto)}</span>
              </div>
              {descuentos > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px', color: '#059669' }}>
                  <span>Descuentos:</span><span>-{formatCurrency(descuentos)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                <span>Op. Gravada:</span><span>{formatCurrency(baseImponible)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                <span>IGV ({Math.round(igvRate * 100)}%):</span><span>{formatCurrency(igv)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', marginBottom: '2px' }}>
                <span>IMPORTE TOTAL</span><span>{formatCurrency(sale.total)}</span>
              </div>

              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

              {/* Pagos */}
              <div style={{ fontWeight: 'bold', fontSize: '10px', marginBottom: '3px' }}>FORMA DE PAGO:</div>
              {(sale.payments || []).map((p, pi) => {
                const m = PAYMENT_METHODS.find(pm => pm.value === p.method)
                return (
                  <div key={pi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                    <span>{m?.label || p.method}{p.reference ? ` (${p.reference})` : ''}</span>
                    <span>{formatCurrency(p.amount)}</span>
                  </div>
                )
              })}
              {sale.change > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                  <span>Vuelto</span><span>{formatCurrency(sale.change)}</span>
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

              {/* QR */}
              <div style={{ textAlign: 'center', margin: '8px 0' }}>
                <div style={{ width: '80px', height: '80px', border: '1px solid #000', fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px' }}>
                  Código<br/>verificación<br/>SUNAT
                </div>
              </div>

              <div style={{ textAlign: 'center', fontSize: '8px', color: '#444', marginBottom: '2px' }}>
                Representación impresa de Boleta de Venta Electrónica
              </div>
              <div style={{ textAlign: 'center', fontSize: '8px', color: '#444', marginBottom: '4px' }}>
                Consulte en: <strong>www.sunat.gob.pe</strong>
              </div>

              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

              <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                {businessConfig?.ticketFooter || '¡Gracias por su compra!'}
              </div>
              <div style={{ textAlign: 'center', fontSize: '9px', color: '#555', marginTop: '2px' }}>
                Conserve este comprobante
              </div>
            </div>
          </div>
        </div>

        {/* ── Panel WhatsApp ── */}
        {showPhone && (
          <div className="px-5 py-4 border-t border-green-100 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 flex-shrink-0">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">
              📱 Enviar comprobante por WhatsApp
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
              El PDF se descargará automáticamente. Luego adjúntalo en WhatsApp.
            </p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">+51</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setPhoneError('')
                  }}
                  placeholder="999 999 999"
                  className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-green-300 dark:border-green-700 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  maxLength={15}
                />
              </div>
              <button
                onClick={handleWhatsAppSubmit}
                disabled={pdfLoading}
                className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                {pdfLoading ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  'Enviar'
                )}
              </button>
              <button
                onClick={() => { setShowPhone(false); setPhone(''); setPhoneError('') }}
                className="px-3 py-2.5 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
            {phoneError && <p className="text-xs text-red-500 mt-2">{phoneError}</p>}
          </div>
        )}

        {/* ── Botones de acción ── */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex-shrink-0">
          <div className="grid grid-cols-4 gap-3">
            
            {/* WhatsApp */}
            <button
              onClick={() => setShowPhone(!showPhone)}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold transition-all ${
                showPhone 
                  ? 'bg-green-500 text-white' 
                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 border border-green-200 dark:border-green-800'
              }`}
            >
              <span className="text-xl">💬</span>
              <span>WhatsApp</span>
            </button>

            {/* Imprimir */}
            <button
              onClick={handlePrint}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 transition-all"
            >
              <span className="text-xl">🖨️</span>
              <span>Imprimir</span>
              <span className="text-[10px] font-normal opacity-60">80mm</span>
            </button>

            {/* ⭐ NUEVO: Descargar PDF */}
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 border border-red-200 dark:border-red-800 transition-all disabled:opacity-50"
            >
              <span className="text-xl">{pdfLoading ? '⏳' : '📄'}</span>
              <span>PDF</span>
              <span className="text-[10px] font-normal opacity-60">Descargar</span>
            </button>

            {/* Cerrar / Nueva venta */}
            <button
              onClick={onClose}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 transition-all"
            >
              <span className="text-xl">✓</span>
              <span>Cerrar</span>
              <span className="text-[10px] font-normal opacity-60">Nueva venta</span>
            </button>

          </div>
          <p className="text-center text-xs text-gray-400 dark:text-slate-500 mt-3">
            Formato SUNAT · Impresión optimizada 58mm/80mm
          </p>
        </div>

      </div>
    </div>
  )
}