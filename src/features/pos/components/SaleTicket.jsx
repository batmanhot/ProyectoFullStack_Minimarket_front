import { useState, useRef, useCallback } from 'react'
import { useStore } from '../../../store/index'
import { formatCurrency, formatDateTime } from '../../../shared/utils/helpers'
import { PAYMENT_METHODS } from '../../../config/app'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const IGV_RATE = 0.18

// ─── Generar PDF desde el DOM del ticket ────────────────────────────────────
async function generateTicketPDF(element, { invoiceNumber, businessName }) {
  if (!element) throw new Error('Elemento no encontrado')
  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: element.scrollWidth,
    height: element.scrollHeight,
  })
  const imgData  = canvas.toDataURL('image/png')
  const pdfWidth  = 80
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, pdfHeight] })
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
  const safeBusinessName = (businessName || 'MI_NEGOCIO')
    .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase()
  const fileName = `${invoiceNumber}_${safeBusinessName}.pdf`
  return { pdf, fileName, blob: pdf.output('blob') }
}

// ─── HTML para impresión 80mm (térmico) ─────────────────────────────────────
function buildTicketHTML(sale, businessConfig) {
  const isTicket      = sale.tipoComprobante === 'ticket'
  const isFactura     = sale.tipoComprobante === 'factura'
  const igvRate       = sale.igvRate || IGV_RATE
  const baseImponible = sale.baseImponible ?? parseFloat((sale.total / (1 + igvRate)).toFixed(2))
  const igv           = sale.igv ?? parseFloat((sale.total - baseImponible).toFixed(2))
  const subtotalBruto = sale.subtotalBruto ?? sale.total
  const descuentos    = sale.totalDescuentos ?? sale.discount ?? 0
  const groupSummary  = sale.groupSummary || []

  const docLabel = isTicket ? 'TICKET DE VENTA'
    : isFactura  ? 'FACTURA ELECTRÓNICA'
    : 'BOLETA DE VENTA ELECTRÓNICA'

  const logoHtml = businessConfig?.logo
    ? `<div style="text-align:center;margin-bottom:2mm"><img src="${businessConfig.logo}" style="max-width:35mm;max-height:15mm"/></div>`
    : ''

  const itemsHtml = (sale.items || []).filter(i => !i._fromBundle && !i.fromBundle).map(item => {
    const qty         = item.quantity ?? item.qty ?? 1
    const pu          = item.unitPrice ?? item.price ?? 0
    const itemDiscount = item.totalDiscount ?? item.discount ?? 0
    const lineTotal   = (item.total ?? (qty * pu)) - itemDiscount
    const discDetails = (item.discountDetails || []).filter(d => d.amount > 0)
    const discHtml    = discDetails.map(d =>
      `<div style="font-size:9px;color:#059669;margin-left:4px">${d.icon || '🏷️'} ${d.name}: -${formatCurrency(d.amount)}</div>`
    ).join('')
    return `
    <div style="margin-bottom:4px">
      <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:bold">
        <span style="flex:1">${item.productName || item.name}</span>
        <span style="white-space:nowrap">${formatCurrency(lineTotal)}</span>
      </div>
      <div style="font-size:9px;color:#555;margin-left:2px">
        ${qty} ${item.unit || 'u'} × ${formatCurrency(pu)}${itemDiscount > 0 ? ` · dto -${formatCurrency(itemDiscount)}` : ''}
      </div>
      ${(() => {
        const isBundle = item.type === 'bundle' || item.isBundle
        if (!isBundle) return ''
        const fromSale    = (sale.items || []).filter(si => si.fromBundle === item.productId || si._fromBundle === item.productId)
        const fromCart    = item.components || []
        const fromStore   = (storeProducts.find(p => p.id === item.productId)?.components || [])
        const comps = fromSale.length > 0 ? fromSale : fromCart.length > 0 ? fromCart : fromStore
        return comps.length > 0
          ? comps.map(c => `<div style="font-size:8px;color:#ea580c;margin-left:6px">↳ ${c._name || c.name || c.productName || ''} ×${c.quantity}</div>`).join('')
          : ''
      })()}
      ${discHtml}
      ${item.manualDiscount > 0 ? `<div style="font-size:9px;color:#6b7280;margin-left:4px">Dto. manual: -${formatCurrency(item.manualDiscount)}</div>` : ''}
    </div>`
  }).join('')

  const groupHtml = groupSummary.length > 0
    ? `<hr class="hr"><div style="font-size:9px;font-weight:bold;color:#059669;margin-bottom:1mm">AHORRO POR PROMOCIÓN:</div>
       ${groupSummary.map(g => `<div style="display:flex;justify-content:space-between;font-size:9px"><span>${g.icon || '🎁'} ${g.name}</span><span style="color:#059669;font-weight:bold">-${formatCurrency(g.saving || g.amount || 0)}</span></div>`).join('')}`
    : ''

  const totalesHtml = isTicket
    ? `${descuentos > 0 ? `<div class="row" style="font-size:10px;color:#059669;margin-bottom:1mm"><span>Descuentos:</span><span>-${formatCurrency(descuentos)}</span></div>` : ''}`
    : `<div class="row" style="font-size:10px;margin-bottom:1mm"><span>Subtotal:</span><span>${formatCurrency(subtotalBruto)}</span></div>
       ${descuentos > 0 ? `<div class="row" style="font-size:10px;color:#059669;margin-bottom:1mm"><span>Descuentos:</span><span>-${formatCurrency(descuentos)}</span></div>` : ''}
       <div class="row" style="font-size:10px;margin-bottom:1mm"><span>Op. Gravada:</span><span>${formatCurrency(baseImponible)}</span></div>
       <div class="row" style="font-size:10px;margin-bottom:1mm"><span>IGV (${Math.round(igvRate * 100)}%):</span><span>${formatCurrency(igv)}</span></div>`

  const paymentsHtml = (sale.payments || []).map(p => {
    const m = PAYMENT_METHODS.find(pm => pm.value === p.method)
    return `<div class="row" style="font-size:10px;margin-bottom:1mm"><span>${m?.label || p.method}${p.reference ? ` (${p.reference})` : ''}</span><span>${formatCurrency(p.amount)}</span></div>`
  }).join('')

  const changeHtml = sale.change > 0
    ? `<div class="row" style="font-size:10px;margin-bottom:1mm"><span>Vuelto</span><span>${formatCurrency(sale.change)}</span></div>`
    : ''

  const qrSection = isTicket ? '' : `
    <div style="text-align:center;margin:3mm 0">
      <div style="display:inline-flex;width:22mm;height:22mm;border:1px solid #ccc;font-size:7px;align-items:center;justify-content:center;text-align:center;padding:2mm;border-radius:3px">
        QR<br/>SUNAT
      </div>
    </div>
    <div class="center" style="font-size:8px;color:#555">${isFactura ? 'Representación impresa de Factura Electrónica' : 'Representación impresa de Boleta de Venta Electrónica'}</div>
    <div class="center" style="font-size:8px;color:#555">Consulte en: <strong>www.sunat.gob.pe</strong></div>
    <hr class="hr">`

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${docLabel} ${sale.invoiceNumber}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Courier New',Courier,monospace;font-size:10px;width:80mm;padding:4mm;color:#000;background:#fff;}
.hr{border:none;border-top:1px dashed #000;margin:2.5mm 0;}
.row{display:flex;justify-content:space-between;}
.center{text-align:center;}
.bold{font-weight:bold;}
@page{size:80mm auto;margin:0;}
@media print{html,body{width:80mm;}}
</style></head><body>
${logoHtml}
<div class="center bold" style="font-size:12px;margin-bottom:1mm">${(businessConfig?.name || 'MI NEGOCIO').toUpperCase()}</div>
${businessConfig?.ruc     ? `<div class="center" style="font-size:9px">RUC: ${businessConfig.ruc}</div>` : ''}
${businessConfig?.address ? `<div class="center" style="font-size:9px">${businessConfig.address}</div>` : ''}
${businessConfig?.phone   ? `<div class="center" style="font-size:9px">Tel: ${businessConfig.phone}</div>` : ''}
<hr class="hr">
<div class="center bold" style="font-size:11px;margin-bottom:1mm">${docLabel}</div>
<div class="center bold" style="font-size:11px;letter-spacing:1px">${sale.invoiceNumber}</div>
<hr class="hr">
<div style="font-size:10px;margin-bottom:1mm"><strong>Fecha:</strong> ${formatDateTime(sale.date || new Date())}</div>
${sale.userName       ? `<div style="font-size:10px;margin-bottom:1mm"><strong>Cajero:</strong> ${sale.userName}</div>` : ''}
${sale.clientName     ? `<div style="font-size:10px;margin-bottom:1mm"><strong>${isFactura ? 'Razón Social' : 'Cliente'}:</strong> ${sale.clientName}</div>` : ''}
${sale.clientDocument ? `<div style="font-size:10px;margin-bottom:1mm"><strong>${isFactura ? 'RUC' : 'Documento'}:</strong> ${sale.clientDocument}</div>` : ''}
<hr class="hr">
${itemsHtml}
<hr class="hr">
${groupHtml}
${groupSummary.length > 0 ? '<hr class="hr">' : ''}
${totalesHtml}
<div class="row bold" style="font-size:13px;margin-bottom:1mm"><span>TOTAL</span><span>${formatCurrency(sale.total)}</span></div>
<hr class="hr">
<div class="bold" style="font-size:10px;margin-bottom:1.5mm">FORMA DE PAGO:</div>
${paymentsHtml}
${changeHtml}
<hr class="hr">
${qrSection}
<div class="center bold" style="font-size:10px">${businessConfig?.ticketFooter || '¡Gracias por su compra!'}</div>
<div class="center" style="font-size:9px;margin-top:1mm">${isTicket ? 'Conserve este ticket' : 'Conserve este comprobante'}</div>
<br>
</body></html>`
}

// ─── Separador visual ────────────────────────────────────────────────────────
const Divider = () => (
  <div style={{ borderTop: '1px dashed #d1d5db', margin: '8px 0' }} />
)

// ─── Componente principal ────────────────────────────────────────────────────
export default function SaleTicket({ sale, onClose }) {
  const { businessConfig, products: storeProducts } = useStore()
  const [showPhone, setShowPhone] = useState(false)
  const [phone, setPhone]         = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const ticketRef = useRef(null)

  const igvRate       = sale.igvRate || IGV_RATE
  const baseImponible = sale.baseImponible ?? parseFloat((sale.total / (1 + igvRate)).toFixed(2))
  const igv           = sale.igv ?? parseFloat((sale.total - baseImponible).toFixed(2))
  const subtotalBruto = sale.subtotalBruto ?? sale.total
  const descuentos    = sale.totalDescuentos ?? sale.discount ?? 0
  const groupSummary  = sale.groupSummary || []

  const isTicket   = sale.tipoComprobante === 'ticket'
  const isFactura  = sale.tipoComprobante === 'factura'
  const docLabel   = isTicket  ? 'TICKET DE VENTA'
    : isFactura    ? 'FACTURA ELECTRÓNICA'
    : 'BOLETA DE VENTA ELECTRÓNICA'
  const docRepLabel = isFactura
    ? 'Representación impresa de Factura Electrónica'
    : 'Representación impresa de Boleta de Venta Electrónica'

  // Colores según tipo de comprobante
  const typeColors = isTicket
    ? { bg: '#f3f4f6', border: '#d1d5db', text: '#374151', totalBg: '#f9fafb', totalBorder: '#e5e7eb', totalText: '#111827' }
    : isFactura
    ? { bg: '#eef2ff', border: '#a5b4fc', text: '#4338ca', totalBg: '#eef2ff', totalBorder: '#a5b4fc', totalText: '#3730a3' }
    : { bg: '#e0f2fe', border: '#7dd3fc', text: '#0369a1', totalBg: '#eff6ff', totalBorder: '#bfdbfe', totalText: '#1e40af' }

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handleDownloadPDF = useCallback(async () => {
    if (!ticketRef.current) return
    setPdfLoading(true)
    try {
      const { pdf, fileName } = await generateTicketPDF(ticketRef.current, {
        invoiceNumber: sale.invoiceNumber,
        businessName:  businessConfig?.name || 'MI_NEGOCIO',
      })
      pdf.save(fileName)
    } catch (err) {
      alert('Error al generar PDF: ' + err.message)
    } finally {
      setPdfLoading(false)
    }
  }, [sale.invoiceNumber, businessConfig?.name])

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  const handleWhatsAppSubmit = useCallback(async () => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 9) { setPhoneError('Ingresa un número válido de 9 dígitos'); return }
    setPdfLoading(true)
    try {
      const { pdf, fileName } = await generateTicketPDF(ticketRef.current, {
        invoiceNumber: sale.invoiceNumber,
        businessName:  businessConfig?.name || 'MI_NEGOCIO',
      })
      pdf.save(fileName)
      const groupLines = groupSummary.map(g => `${g.icon || '🎁'} ${g.name}: Ahorro ${formatCurrency(g.saving || g.amount || 0)}`)
      const lines = [
        `¡Gracias por tu compra en ${businessConfig?.name || 'nuestro negocio'}! 🛒`,
        '',
        `*${isTicket ? 'Ticket' : isFactura ? 'Factura' : 'Boleta'}:* ${sale.invoiceNumber}`,
        `*Fecha:* ${formatDateTime(sale.date || new Date())}`,
        sale.clientName ? `*${isFactura ? 'Razón Social' : 'Cliente'}:* ${sale.clientName}` : null,
        `*Total:* ${formatCurrency(sale.total)}`,
        '',
        ...(groupLines.length > 0 ? [...groupLines, '─────────────────'] : []),
        descuentos > 0 ? `Descuentos: -${formatCurrency(descuentos)}` : null,
        !isTicket ? `Op. Gravada: ${formatCurrency(baseImponible)}` : null,
        !isTicket ? `IGV (${Math.round(igvRate * 100)}%): ${formatCurrency(igv)}` : null,
        `*TOTAL: ${formatCurrency(sale.total)}*`,
        '─────────────────',
        ...(sale.payments || []).map(p => {
          const m = PAYMENT_METHODS.find(pm => pm.value === p.method)
          return `${m?.label || p.method}: ${formatCurrency(p.amount)}${p.reference ? ` (Ref: ${p.reference})` : ''}`
        }),
        sale.change > 0 ? `Vuelto: ${formatCurrency(sale.change)}` : null,
        '',
        businessConfig?.ticketFooter || '¡Gracias por su compra!',
        !isTicket ? `Consulte en: www.sunat.gob.pe` : null,
        '',
        '📎 *Adjunta el PDF descargado* para tener tu comprobante digital.',
      ].filter(Boolean).join('\n')
      const intl = cleaned.startsWith('51') ? cleaned : `51${cleaned}`
      window.open(`https://wa.me/${intl}?text=${encodeURIComponent(lines)}`, '_blank')
      setShowPhone(false); setPhone(''); setPhoneError('')
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setPdfLoading(false)
    }
  }, [phone, sale, businessConfig, igvRate, baseImponible, igv, descuentos, groupSummary, isTicket, isFactura])

  // ── Imprimir ───────────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    const html = buildTicketHTML(sale, businessConfig)
    const win  = window.open('', '_blank', 'width=380,height=700,left=100,top=50')
    if (!win) { alert('Activa las ventanas emergentes para imprimir'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 400)
  }, [sale, businessConfig])

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-auto flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div style={{
              background: typeColors.bg, border: `1px solid ${typeColors.border}`,
              borderRadius: '8px', padding: '4px 10px',
              fontSize: '11px', fontWeight: '700', color: typeColors.text,
            }}>
              {isTicket ? '🎫' : isFactura ? '🧾' : '📄'} {isTicket ? 'Ticket' : isFactura ? 'Factura' : 'Boleta'}
            </div>
            <div>
              <h2 className="font-bold text-gray-800 dark:text-slate-100 text-sm">{sale.invoiceNumber}</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500">{formatDateTime(sale.date || new Date())}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Vista previa del ticket */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-slate-900" style={{ colorScheme: 'light' }}>
          <div className="flex justify-center">
            <div
              ref={ticketRef}
              style={{
                width: '300px',
                maxWidth: '100%',
                background: '#ffffff',
                color: '#000000',
                padding: '16px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
              }}
            >
              {/* Logo */}
              {businessConfig?.logo && (
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <img src={businessConfig.logo} alt="logo" style={{ maxWidth: '100px', maxHeight: '40px' }} />
                </div>
              )}

              {/* Nombre del negocio */}
              <div style={{ textAlign: 'center', fontWeight: '800', fontSize: '14px', color: '#111827', marginBottom: '2px' }}>
                {(businessConfig?.name || 'MI NEGOCIO').toUpperCase()}
              </div>
              {businessConfig?.ruc && (
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#6b7280' }}>RUC: {businessConfig.ruc}</div>
              )}
              {businessConfig?.address && (
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#6b7280' }}>{businessConfig.address}</div>
              )}
              {businessConfig?.phone && (
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#6b7280' }}>Tel: {businessConfig.phone}</div>
              )}

              {/* Badge tipo + número */}
              <div style={{ margin: '12px 0 8px', textAlign: 'center' }}>
                <div style={{
                  display: 'inline-block',
                  background: typeColors.bg, border: `1px solid ${typeColors.border}`,
                  borderRadius: '6px', padding: '3px 12px',
                  fontSize: '10px', fontWeight: '700', color: typeColors.text,
                  letterSpacing: '0.04em', marginBottom: '4px',
                }}>
                  {docLabel}
                </div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#111827', letterSpacing: '1px' }}>
                  {sale.invoiceNumber}
                </div>
              </div>

              <Divider />

              {/* Datos de la venta */}
              {[
                { label: 'Fecha',      value: formatDateTime(sale.date || new Date()) },
                sale.userName       ? { label: 'Cajero',      value: sale.userName } : null,
                sale.clientName     ? { label: isFactura ? 'Razón Social' : 'Cliente', value: sale.clientName } : null,
                sale.clientDocument ? { label: isFactura ? 'RUC' : 'Documento',        value: sale.clientDocument } : null,
              ].filter(Boolean).map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px' }}>
                  <span style={{ color: '#6b7280', fontWeight: '600', flexShrink: 0 }}>{label}</span>
                  <span style={{ color: '#111827', textAlign: 'right', marginLeft: '8px' }}>{value}</span>
                </div>
              ))}

              <Divider />

              {/* Ítems */}
              {(sale.items || []).filter(item => !item._fromBundle && !item.fromBundle).map((item, idx) => {
                const qty          = item.quantity ?? item.qty ?? 1
                const pu           = item.unitPrice ?? item.price ?? 0
                const itemDiscount = item.totalDiscount ?? item.discount ?? 0
                const lineTotal    = (item.total ?? (qty * pu)) - itemDiscount
                const discDetails  = (item.discountDetails || []).filter(d => d.amount > 0)

                return (
                  <div key={idx} style={{ marginBottom: '8px' }}>
                    {/* Nombre + total */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1, fontSize: '11px', fontWeight: '600', color: '#111827', lineHeight: 1.35 }}>
                        {item.productName || item.name}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#111827', whiteSpace: 'nowrap' }}>
                        {formatCurrency(lineTotal)}
                      </div>
                    </div>
                    {/* Qty × PU */}
                    <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '1px' }}>
                      {qty} {item.unit || 'u'} × {formatCurrency(pu)}
                      {itemDiscount > 0 && (
                        <span style={{ color: '#059669' }}> · dto −{formatCurrency(itemDiscount)}</span>
                      )}
                    </div>
                    {/* Componentes del bundle */}
                    {(() => {
                      const isBundle = item.type === 'bundle' || item.isBundle
                      if (!isBundle) return null
                      const fromSale  = (sale.items || []).filter(si => si.fromBundle === item.productId || si._fromBundle === item.productId)
                      const fromCart  = item.components || []
                      const fromStore = (storeProducts.find(p => p.id === item.productId)?.components || [])
                      const comps = fromSale.length > 0 ? fromSale : fromCart.length > 0 ? fromCart : fromStore
                      return comps.length > 0 ? (
                        <div style={{ marginTop: '2px' }}>
                          {comps.map((c, ci) => (
                            <div key={ci} style={{ fontSize: '9px', color: '#ea580c', marginLeft: '6px' }}>
                              ↳ {c._name || c.name || c.productName || c.productId} ×{c.quantity}
                            </div>
                          ))}
                        </div>
                      ) : null
                    })()}
                    {/* Descuentos de campaña */}
                    {discDetails.map((d, di) => (
                      <div key={di} style={{ fontSize: '9px', color: '#059669', marginTop: '1px' }}>
                        {d.icon || '🏷️'} {d.name || 'Promo'}: −{formatCurrency(d.amount)}
                      </div>
                    ))}
                    {item.manualDiscount > 0 && (
                      <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '1px' }}>
                        Dto. manual: −{formatCurrency(item.manualDiscount)}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Ahorro por grupo */}
              {groupSummary.length > 0 && (
                <>
                  <Divider />
                  <div style={{ fontSize: '9px', fontWeight: '700', color: '#059669', marginBottom: '4px' }}>
                    AHORRO POR PROMOCIÓN
                  </div>
                  {groupSummary.map((g, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#059669', marginBottom: '2px' }}>
                      <span>{g.icon || '🎁'} {g.name}</span>
                      <span style={{ fontWeight: '700' }}>−{formatCurrency(g.saving || g.amount || 0)}</span>
                    </div>
                  ))}
                </>
              )}

              <Divider />

              {/* Desglose de totales */}
              {!isTicket && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#6b7280', marginBottom: '3px' }}>
                    <span>Subtotal</span><span>{formatCurrency(subtotalBruto)}</span>
                  </div>
                  {descuentos > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#059669', marginBottom: '3px' }}>
                      <span>Descuentos</span><span>−{formatCurrency(descuentos)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#6b7280', marginBottom: '3px' }}>
                    <span>Op. Gravada</span><span>{formatCurrency(baseImponible)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#6b7280', marginBottom: '3px' }}>
                    <span>IGV ({Math.round(igvRate * 100)}%)</span><span>{formatCurrency(igv)}</span>
                  </div>
                </>
              )}
              {isTicket && descuentos > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#059669', marginBottom: '3px' }}>
                  <span>Descuentos</span><span>−{formatCurrency(descuentos)}</span>
                </div>
              )}

              {/* Total destacado */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: typeColors.totalBg, border: `1px solid ${typeColors.totalBorder}`,
                borderRadius: '8px', padding: '10px 12px', marginTop: '6px',
              }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: typeColors.totalText }}>TOTAL</span>
                <span style={{ fontSize: '20px', fontWeight: '900', color: typeColors.totalText, letterSpacing: '-0.5px' }}>
                  {formatCurrency(sale.total)}
                </span>
              </div>

              <Divider />

              {/* Pagos */}
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#374151', marginBottom: '5px' }}>
                FORMA DE PAGO
              </div>
              {(sale.payments || []).map((p, pi) => {
                const m = PAYMENT_METHODS.find(pm => pm.value === p.method)
                return (
                  <div key={pi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#374151', marginBottom: '3px' }}>
                    <span>{m?.label || p.method}{p.reference ? ` (${p.reference})` : ''}</span>
                    <span style={{ fontWeight: '600' }}>{formatCurrency(p.amount)}</span>
                  </div>
                )
              })}
              {sale.change > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#374151', marginBottom: '3px' }}>
                  <span>Vuelto</span>
                  <span style={{ fontWeight: '600' }}>{formatCurrency(sale.change)}</span>
                </div>
              )}

              {/* QR SUNAT (solo Boleta y Factura) */}
              {!isTicket && (
                <>
                  <Divider />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '6px 0 2px' }}>
                    <div style={{
                      width: '60px', height: '60px',
                      border: '2px solid #e5e7eb', borderRadius: '8px',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      gap: '2px',
                    }}>
                      <span style={{ fontSize: '22px', lineHeight: 1 }}>◼</span>
                      <span style={{ fontSize: '7px', color: '#9ca3af', fontWeight: '600' }}>QR SUNAT</span>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '8px', color: '#9ca3af', lineHeight: 1.5 }}>
                      {docRepLabel}<br />
                      <span style={{ fontWeight: '700' }}>www.sunat.gob.pe</span>
                    </div>
                  </div>
                </>
              )}

              <Divider />

              {/* Footer */}
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#111827', marginBottom: '2px' }}>
                {businessConfig?.ticketFooter || '¡Gracias por su compra!'}
              </div>
              <div style={{ textAlign: 'center', fontSize: '9px', color: '#9ca3af' }}>
                {isTicket ? 'Conserve este ticket' : 'Conserve este comprobante'}
              </div>
            </div>
          </div>
        </div>

        {/* Panel WhatsApp */}
        {showPhone && (
          <div className="px-5 py-4 border-t border-green-100 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 flex-shrink-0">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-1">📱 Enviar por WhatsApp</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">El PDF se descargará automáticamente. Adjúntalo en WhatsApp.</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">+51</span>
                <input
                  type="tel" value={phone}
                  onChange={e => { setPhone(e.target.value); setPhoneError('') }}
                  placeholder="999 999 999"
                  className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-green-300 dark:border-green-700 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  maxLength={15}
                />
              </div>
              <button onClick={handleWhatsAppSubmit} disabled={pdfLoading}
                className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                {pdfLoading
                  ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  : 'Enviar'}
              </button>
              <button onClick={() => { setShowPhone(false); setPhone(''); setPhoneError('') }}
                className="px-3 py-2.5 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                Cancelar
              </button>
            </div>
            {phoneError && <p className="text-xs text-red-500 mt-2">{phoneError}</p>}
          </div>
        )}

        {/* Botones de acción */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex-shrink-0">
          <div className="grid grid-cols-4 gap-3">

            <button onClick={() => setShowPhone(!showPhone)}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold transition-all ${
                showPhone
                  ? 'bg-green-500 text-white'
                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 border border-green-200 dark:border-green-800'
              }`}>
              <span className="text-xl">💬</span>
              <span>WhatsApp</span>
            </button>

            <button onClick={handlePrint}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 transition-all">
              <span className="text-xl">🖨️</span>
              <span>Imprimir</span>
              <span className="text-[10px] font-normal opacity-60">80mm</span>
            </button>

            <button onClick={handleDownloadPDF} disabled={pdfLoading}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 border border-red-200 dark:border-red-800 transition-all disabled:opacity-50">
              <span className="text-xl">{pdfLoading ? '⏳' : '📄'}</span>
              <span>PDF</span>
              <span className="text-[10px] font-normal opacity-60">Descargar</span>
            </button>

            <button onClick={onClose}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition-all">
              <span className="text-xl">✓</span>
              <span>Cerrar</span>
              <span className="text-[10px] font-normal opacity-60">Nueva venta</span>
            </button>

          </div>
          <p className="text-center text-xs text-gray-400 dark:text-slate-500 mt-3">
            {isTicket ? 'Ticket interno · Sin validación SUNAT' : 'Formato SUNAT · Optimizado 58mm / 80mm'}
          </p>
        </div>

      </div>
    </div>
  )
}
