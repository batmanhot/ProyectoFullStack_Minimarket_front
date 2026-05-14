/**
 * CreditNoteModal.jsx — Nota de Crédito v2
 * Ruta: src/features/returns/components/CreditNoteModal.jsx
 *
 * CORRECCIONES:
 *  1. Vista previa siempre en blanco (colorScheme light) — funciona en todos los temas
 *  2. Separación clara de formatos:
 *     - Vista previa modal → simulación A4 (documento formal SUNAT)
 *     - Botón "📄 PDF A4"   → documento formal A4 imprimible / guardable como PDF
 *     - Botón "🖨️ 80mm"    → ticket térmico para impresora de rollo (uso interno)
 *     - Botón "📱 WhatsApp" → texto formateado para el cliente
 *
 * NOTA SUNAT: La Nota de Crédito es un comprobante electrónico.
 * El formato A4 es la "representación impresa" oficial.
 * El ticket 80mm es solo para referencia interna del comercio.
 */

import { useState } from 'react'
import { formatCurrency, formatDateTime } from '../../../shared/utils/helpers'

const RETURN_REASONS = [
  { value: 'defectuoso',   label: 'Producto defectuoso / dañado',     icon: '⚠️' },
  { value: 'vencido',      label: 'Producto vencido / caducado',       icon: '📅' },
  { value: 'equivocado',   label: 'Producto equivocado / error cobro', icon: '🔄' },
  { value: 'insatisfecho', label: 'Cliente insatisfecho',              icon: '😞' },
  { value: 'incompleto',   label: 'Producto incompleto / faltante',    icon: '📦' },
  { value: 'otro',         label: 'Otro motivo',                       icon: '📝' },
]

const HALF_UP = (n) => Math.floor(Number(n) * 100 + 0.5) / 100

// ─── HTML A4 — Documento formal SUNAT ────────────────────────────────────────
function buildA4HTML(nc, businessConfig) {
  const igvRate       = nc.igvRate       || 0.18
  const baseImponible = nc.baseImponible ?? HALF_UP(nc.totalRefund / (1 + igvRate))
  const igv           = nc.igv           ?? HALF_UP(nc.totalRefund - baseImponible)
  const reasonLabel   = RETURN_REASONS.find(r => r.value === nc.reason)?.label || nc.reasonLabel || nc.reason
  const biz           = businessConfig || {}

  const itemsRows = (nc.items || []).map(item => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb">${item.productName}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity} ${item.unit||'u'}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">S/ ${Number(item.netUnitPrice||item.unitPrice).toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#7c3aed">S/ ${Number(item.totalRefund).toFixed(2)}</td>
    </tr>`).join('')

  const createdDate = new Date(nc.createdAt).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'})
  const createdTime = new Date(nc.createdAt).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Nota de Crédito ${nc.ncNumber}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; font-size:11px; color:#111; background:#f9fafb; }
  .page { max-width:210mm; margin:10mm auto; background:#fff; padding:15mm; box-shadow:0 2px 16px rgba(0,0,0,.1); }

  /* Header */
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
  .biz-logo { max-height:60px; max-width:180px; object-fit:contain; margin-bottom:6px; }
  .biz-name { font-size:16px; font-weight:800; color:#111; }
  .biz-sub  { font-size:10px; color:#6b7280; margin-top:2px; }

  /* Caja del documento */
  .doc-box { border:2px solid #7c3aed; border-radius:6px; padding:12px 16px; text-align:center; min-width:160px; }
  .doc-type { font-size:11px; font-weight:700; color:#7c3aed; text-transform:uppercase; letter-spacing:.05em; }
  .doc-name { font-size:14px; font-weight:800; color:#111; margin:3px 0; }
  .doc-num  { font-size:16px; font-weight:900; color:#7c3aed; font-family:'Courier New',monospace; }

  /* Separador */
  .divider { border:none; border-top:1px solid #e5e7eb; margin:14px 0; }
  .divider-bold { border-top:2px solid #7c3aed; margin:14px 0; }

  /* Grid de datos */
  .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px; }
  .meta-box { background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:10px; }
  .meta-label { font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; font-weight:700; display:block; margin-bottom:3px; }
  .meta-val { font-size:12px; font-weight:600; color:#111; }
  .meta-sub { font-size:10px; color:#6b7280; margin-top:1px; }

  /* Motivo */
  .reason-box { background:#fdf4ff; border:1px solid #e9d5ff; border-radius:6px; padding:10px 14px; margin-bottom:14px; }
  .reason-label { font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#7c3aed; font-weight:700; margin-bottom:3px; }

  /* Tabla */
  table { width:100%; border-collapse:collapse; margin-bottom:14px; }
  thead tr { background:#7c3aed; color:#fff; }
  thead th { padding:8px; font-size:10px; font-weight:700; text-align:left; }
  thead th:not(:first-child) { text-align:right; }
  thead th:nth-child(2) { text-align:center; }
  tbody tr:nth-child(even) { background:#fdf4ff; }

  /* Totales */
  .totals { width:240px; margin-left:auto; margin-bottom:14px; }
  .total-row { display:flex; justify-content:space-between; padding:4px 0; font-size:11px; }
  .total-final { background:#7c3aed; color:#fff; border-radius:6px; padding:10px 14px; display:flex; justify-content:space-between; font-size:14px; font-weight:800; margin-top:4px; }

  /* Firma */
  .signature { display:flex; justify-content:space-between; margin-top:30px; }
  .sig-box { text-align:center; border-top:1px solid #d1d5db; padding-top:8px; width:160px; font-size:10px; color:#6b7280; }

  /* Footer SUNAT */
  .sunat-footer { margin-top:20px; padding-top:12px; border-top:1px dashed #d1d5db; text-align:center; font-size:9px; color:#9ca3af; }
  .sunat-footer strong { color:#374151; }

  /* Acciones (solo pantalla) */
  .actions-bar { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
  .btn { padding:8px 20px; border-radius:8px; border:none; cursor:pointer; font-size:12px; font-weight:700; }
  .btn-print { background:#7c3aed; color:#fff; }
  .btn-pdf   { background:#dc2626; color:#fff; }
  .btn-wa    { background:#16a34a; color:#fff; }

  /* Marca de agua si NC está anulada */
  .watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-35deg); font-size:72px; font-weight:900; color:rgba(220,38,38,.08); pointer-events:none; white-space:nowrap; }

  @media print {
    .actions-bar, .watermark { display:none !important; }
    body { background:#fff; }
    .page { box-shadow:none; margin:0; padding:12mm; }
    @page { size:A4; margin:8mm; }
  }
</style></head>
<body>
<div class="page">
  <div class="actions-bar">
    <button class="btn btn-print" onclick="window.print()">🖨️ Imprimir A4</button>
    <button class="btn btn-pdf"   onclick="window.print()">📄 Guardar PDF</button>
    <button class="btn btn-wa"    onclick="sendWA()">📱 WhatsApp</button>
  </div>

  <!-- HEADER -->
  <div class="header">
    <div>
      ${biz.logoUrl ? `<img src="${biz.logoUrl}" class="biz-logo" onerror="this.style.display='none'">` : ''}
      <div class="biz-name">${biz.name || 'MI NEGOCIO'}</div>
      ${biz.ruc     ? `<div class="biz-sub">R.U.C.: ${biz.ruc}</div>` : ''}
      ${biz.address ? `<div class="biz-sub">${biz.address}</div>` : ''}
      ${biz.phone   ? `<div class="biz-sub">Tel: ${biz.phone}</div>` : ''}
    </div>
    <div class="doc-box">
      <div class="doc-type">Comprobante Electrónico</div>
      <div class="doc-name">NOTA DE CRÉDITO<br>ELECTRÓNICA</div>
      <div class="doc-num">${nc.ncNumber}</div>
    </div>
  </div>

  <hr class="divider-bold">

  <!-- DATOS DEL DOCUMENTO -->
  <div class="meta-grid">
    <div class="meta-box">
      <span class="meta-label">Cliente / Receptor</span>
      <div class="meta-val">${nc.clientName || 'Consumidor Final'}</div>
      ${nc.clientDoc ? `<div class="meta-sub">Doc.: ${nc.clientDoc}</div>` : ''}
    </div>
    <div class="meta-box">
      <span class="meta-label">Fecha de emisión</span>
      <div class="meta-val">${createdDate} ${createdTime}</div>
    </div>
    <div class="meta-box">
      <span class="meta-label">Documento de referencia</span>
      <div class="meta-val">${nc.invoiceNumber}</div>
      <div class="meta-sub">Boleta / Comprobante original</div>
    </div>
    <div class="meta-box">
      <span class="meta-label">Atendido por</span>
      <div class="meta-val">${nc.userName || '—'}</div>
    </div>
  </div>

  <!-- MOTIVO -->
  <div class="reason-box">
    <div class="reason-label">Motivo de la Nota de Crédito</div>
    <div style="font-size:12px;font-weight:600;color:#374151">${reasonLabel}</div>
    ${nc.reasonNote ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${nc.reasonNote}</div>` : ''}
  </div>

  <!-- DETALLE DE PRODUCTOS DEVUELTOS -->
  <table>
    <thead>
      <tr>
        <th style="text-align:left;width:50%">DESCRIPCIÓN</th>
        <th style="text-align:center">CANT.</th>
        <th style="text-align:right">P. UNIT. (S/)</th>
        <th style="text-align:right">REEMBOLSO (S/)</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <!-- TOTALES -->
  <div class="totals">
    <div class="total-row">
      <span style="color:#6b7280">Op. Gravada:</span>
      <span>S/ ${Number(baseImponible).toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span style="color:#6b7280">I.G.V. (${Math.round(igvRate*100)}%):</span>
      <span>S/ ${Number(igv).toFixed(2)}</span>
    </div>
    <div class="total-final">
      <span>TOTAL A REEMBOLSAR</span>
      <span>S/ ${Number(nc.totalRefund).toFixed(2)}</span>
    </div>
  </div>

  <!-- FIRMAS -->
  <div class="signature">
    <div class="sig-box">
      <div style="margin-bottom:32px">V°B° Emisor</div>
      <div>${biz.name || 'MI NEGOCIO'}</div>
    </div>
    <div class="sig-box">
      <div style="margin-bottom:32px">Recibí conforme</div>
      <div>${nc.clientName || 'Cliente'}</div>
    </div>
  </div>

  <!-- FOOTER SUNAT -->
  <div class="sunat-footer">
    <div>Representación Impresa de Nota de Crédito Electrónica</div>
    <div>Este documento fue generado electrónicamente y tiene plena validez tributaria según la normativa SUNAT.</div>
    <div style="margin-top:4px">Consulte y verifique en: <strong>www.sunat.gob.pe</strong> · Ref: ${nc.ncNumber}</div>
  </div>
</div>

<script>
var NC = ${JSON.stringify({ ncNumber: nc.ncNumber, invoiceNumber: nc.invoiceNumber, clientName: nc.clientName, totalRefund: nc.totalRefund, items: nc.items, reasonNote: nc.reasonNote })};
var BIZ = ${JSON.stringify({ name: biz.name, ruc: biz.ruc })};
var REASON = "${reasonLabel.replace(/"/g, '\\"')}";

function sendWA() {
  var lines = [
    '*' + (BIZ.name||'Mi Negocio') + '*',
    BIZ.ruc ? 'RUC: ' + BIZ.ruc : null,
    '─────────────────',
    '*NOTA DE CRÉDITO ELECTRÓNICA*',
    'N°: ' + NC.ncNumber,
    'Doc. referencia: ' + NC.invoiceNumber,
    NC.clientName ? 'Cliente: ' + NC.clientName : null,
    '─────────────────',
    'Motivo: ' + REASON,
    NC.reasonNote ? 'Detalle: ' + NC.reasonNote : null,
    '─────────────────',
  ].filter(Boolean);
  (NC.items||[]).forEach(function(item){
    lines.push('• ' + item.productName + ': ' + item.quantity + ' ' + (item.unit||'u') + ' = *S/ ' + Number(item.totalRefund).toFixed(2) + '*');
  });
  lines.push('─────────────────');
  lines.push('*TOTAL REEMBOLSO: S/ ' + Number(NC.totalRefund).toFixed(2) + '*');
  lines.push('Consulte en: www.sunat.gob.pe');
  var phone = prompt('Número WhatsApp (con código de país, ej: 51987654321):');
  if (phone) window.open('https://wa.me/' + phone.replace(/[^0-9]/g,'') + '?text=' + encodeURIComponent(lines.join('\n')), '_blank');
}
</script>
</body></html>`
}

// ─── HTML 80mm — Ticket térmico (uso interno) ─────────────────────────────────
function buildTicketHTML(nc, businessConfig) {
  const igvRate       = nc.igvRate       || 0.18
  const baseImponible = nc.baseImponible ?? HALF_UP(nc.totalRefund / (1 + igvRate))
  const igv           = nc.igv           ?? HALF_UP(nc.totalRefund - baseImponible)
  const reasonLabel   = RETURN_REASONS.find(r => r.value === nc.reason)?.label || nc.reasonLabel || nc.reason
  const biz           = businessConfig || {}

  const itemsHtml = (nc.items || []).map(item => `
    <div style="margin-bottom:3mm">
      <div style="font-weight:bold;font-size:10px;color:#000">${item.productName}</div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#000">
        <span>${item.quantity} ${item.unit||'u'} × S/${Number(item.netUnitPrice||item.unitPrice).toFixed(2)}</span>
        <span>S/${Number(item.totalRefund).toFixed(2)}</span>
      </div>
    </div>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>NC Ticket ${nc.ncNumber}</title>
<style>
  *{ margin:0; padding:0; box-sizing:border-box; }
  body{ font-family:'Courier New',Courier,monospace; font-size:10px; width:80mm; padding:4mm; color:#000; background:#fff; }
  .hr{ border:none; border-top:1px dashed #000; margin:2.5mm 0; }
  .row{ display:flex; justify-content:space-between; }
  .center{ text-align:center; }
  .bold{ font-weight:bold; }
  .fab{ position:fixed; bottom:12px; right:12px; background:#7c3aed; color:#fff; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:700; }
  @page{ size:80mm auto; margin:0; }
  @media print{ html,body{ width:80mm; } .fab{display:none} }
</style></head>
<body>
  ${biz.logoUrl ? `<div class="center" style="margin-bottom:3mm"><img src="${biz.logoUrl}" style="max-width:50mm;max-height:20mm;object-fit:contain" onerror="this.style.display='none'"></div>` : ''}
  <div class="center bold" style="font-size:13px;letter-spacing:1.5px;color:#000">${(biz.name||'MI NEGOCIO').toUpperCase()}</div>
  ${biz.ruc     ? `<div class="center" style="color:#000">R.U.C.: ${biz.ruc}</div>` : ''}
  ${biz.address ? `<div class="center" style="font-size:9px;color:#333">${biz.address}</div>` : ''}
  <hr class="hr">
  <div class="center bold" style="font-size:11px;color:#000">NOTA DE CRÉDITO ELECTRÓNICA</div>
  <div class="center bold" style="font-size:12px;color:#000">${nc.ncNumber}</div>
  <hr class="hr">
  <div style="color:#000"><strong>Fecha:</strong> ${formatDateTime(nc.createdAt)}</div>
  <div style="color:#000"><strong>Doc. ref.:</strong> ${nc.invoiceNumber}</div>
  ${nc.clientName ? `<div style="color:#000"><strong>Cliente:</strong> ${nc.clientName}</div>` : ''}
  <hr class="hr">
  <div class="bold" style="font-size:9px;color:#000">MOTIVO:</div>
  <div style="font-size:9px;color:#000">${reasonLabel}${nc.reasonNote ? ` — ${nc.reasonNote}` : ''}</div>
  <hr class="hr">
  <div class="row bold" style="font-size:10px;color:#000"><span>PRODUCTO</span><span>MONTO</span></div>
  <hr class="hr">
  ${itemsHtml}
  <hr class="hr">
  <div class="row" style="color:#000"><span>Op. Gravada:</span><span>S/${Number(baseImponible).toFixed(2)}</span></div>
  <div class="row" style="color:#000"><span>I.G.V. (${Math.round(igvRate*100)}%):</span><span>S/${Number(igv).toFixed(2)}</span></div>
  <div class="row bold" style="font-size:13px;color:#000"><span>TOTAL REEMBOLSO</span><span>S/${Number(nc.totalRefund).toFixed(2)}</span></div>
  <hr class="hr">
  <div class="center bold" style="color:#000">★ IMPORTE A DEVOLVER AL CLIENTE ★</div>
  <hr class="hr">
  <div class="center" style="font-size:8px;color:#333">Representación impresa de Nota de Crédito Electrónica</div>
  <div class="center" style="font-size:8px;color:#333">Consulte en: www.sunat.gob.pe</div>
  <hr class="hr">
  <div class="center bold" style="color:#000">${biz.ticketFooter || '¡Gracias por su preferencia!'}</div>
  <button class="fab" onclick="window.print()">🖨️ Imprimir 80mm</button>
</body></html>`
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CreditNoteModal({ creditNote: nc, businessConfig, onClose }) {
  const [showPhone,  setShowPhone]  = useState(false)
  const [phone,      setPhone]      = useState('')
  const [phoneError, setPhoneError] = useState('')

  const igvRate       = nc.igvRate       || 0.18
  const baseImponible = nc.baseImponible ?? HALF_UP(nc.totalRefund / (1 + igvRate))
  const igv           = nc.igv           ?? HALF_UP(nc.totalRefund - baseImponible)
  const reasonLabel   = RETURN_REASONS.find(r => r.value === nc.reason)?.label || nc.reasonLabel || nc.reason

  // Abrir documento A4 en nueva ventana
  const handlePrintA4 = () => {
    const html = buildA4HTML(nc, businessConfig)
    const win  = window.open('', '_blank', 'width=900,height=750,menubar=yes,scrollbars=yes')
    if (!win) { alert('Activa las ventanas emergentes'); return }
    win.document.write(html)
    win.document.close()
  }

  // Abrir ticket 80mm en nueva ventana
  const handlePrint80mm = () => {
    const html = buildTicketHTML(nc, businessConfig)
    const win  = window.open('', '_blank', 'width=380,height=700,left=100,top=50')
    if (!win) { alert('Activa las ventanas emergentes'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 400)
  }

  const handleWhatsApp = () => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 9) { setPhoneError('Ingresa un número válido de 9 dígitos'); return }
    setPhoneError('')
    const intl      = cleaned.startsWith('51') ? cleaned : `51${cleaned}`
    const itemLines = nc.items.map(item =>
      `• ${item.productName}\n  ${item.quantity} ${item.unit||'u'} × S/${Number(item.netUnitPrice||item.unitPrice).toFixed(2)} = *S/${Number(item.totalRefund).toFixed(2)}*`
    )
    const lines = [
      `*${businessConfig?.name || 'Mi Negocio'}*`,
      businessConfig?.ruc ? `RUC: ${businessConfig.ruc}` : null,
      `─────────────────────`,
      `*NOTA DE CRÉDITO ELECTRÓNICA*`,
      `N°: ${nc.ncNumber}`,
      `Doc. referencia: ${nc.invoiceNumber}`,
      nc.clientName ? `Cliente: ${nc.clientName}` : null,
      `─────────────────────`,
      `Motivo: ${reasonLabel}`,
      nc.reasonNote ? `Detalle: ${nc.reasonNote}` : null,
      `─────────────────────`,
      ...itemLines,
      `─────────────────────`,
      `Op. Gravada: S/ ${Number(baseImponible).toFixed(2)}`,
      `IGV (${Math.round(igvRate*100)}%): S/ ${Number(igv).toFixed(2)}`,
      `*TOTAL A REEMBOLSAR: S/ ${Number(nc.totalRefund).toFixed(2)}*`,
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
            <p className="text-xs text-purple-500 font-mono mt-0.5">{nc.ncNumber} · Ref: {nc.invoiceNumber}</p>
          </div>
          <button onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* ── FIX 1: Vista previa siempre en blanco con colorScheme light ────── */}
        {/* ── FIX 2: Simulación A4 en lugar de ticket 80mm ─────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-200 dark:bg-slate-900"
          style={{ colorScheme: 'light' }}>
          <div className="mx-auto bg-white shadow-lg"
            style={{
              width: '100%', maxWidth: '480px',
              fontFamily: 'Arial, sans-serif',
              fontSize: '11px',
              color: '#111111',
              WebkitTextFillColor: '#111111',
              padding: '20px',
              border: '1px solid #d1d5db',
              colorScheme: 'light',
            }}>

            {/* Encabezado A4 */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px' }}>
              <div>
                {businessConfig?.logoUrl && (
                  <img src={businessConfig.logoUrl} alt="" style={{ maxHeight:'44px', maxWidth:'140px', objectFit:'contain', marginBottom:'6px', display:'block' }}
                    onError={e => e.target.style.display='none'}/>
                )}
                <div style={{ fontSize:'14px', fontWeight:'800', color:'#111' }}>{businessConfig?.name || 'MI NEGOCIO'}</div>
                {businessConfig?.ruc     && <div style={{ fontSize:'10px', color:'#555' }}>R.U.C.: {businessConfig.ruc}</div>}
                {businessConfig?.address && <div style={{ fontSize:'10px', color:'#555' }}>{businessConfig.address}</div>}
                {businessConfig?.phone   && <div style={{ fontSize:'10px', color:'#555' }}>Tel: {businessConfig.phone}</div>}
              </div>
              <div style={{ border:'2px solid #7c3aed', borderRadius:'6px', padding:'8px 12px', textAlign:'center', minWidth:'130px' }}>
                <div style={{ fontSize:'9px', fontWeight:'700', color:'#7c3aed', textTransform:'uppercase', letterSpacing:'.04em' }}>Nota de Crédito</div>
                <div style={{ fontSize:'10px', fontWeight:'700', color:'#111', margin:'2px 0' }}>ELECTRÓNICA</div>
                <div style={{ fontSize:'14px', fontWeight:'900', color:'#7c3aed', fontFamily:'monospace' }}>{nc.ncNumber}</div>
              </div>
            </div>

            <hr style={{ border:'none', borderTop:'2px solid #7c3aed', margin:'10px 0' }}/>

            {/* Datos del documento */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'12px' }}>
              {[
                { label:'Cliente / Receptor', val: nc.clientName || 'Consumidor Final' },
                { label:'Fecha de emisión',   val: new Date(nc.createdAt).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'}) + ' ' + new Date(nc.createdAt).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) },
                { label:'Doc. de referencia', val: nc.invoiceNumber, sub:'Comprobante original' },
                { label:'Atendido por',        val: nc.userName || '—' },
              ].map(m => (
                <div key={m.label} style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'5px', padding:'8px' }}>
                  <div style={{ fontSize:'8px', textTransform:'uppercase', letterSpacing:'.06em', color:'#9ca3af', fontWeight:'700', marginBottom:'3px' }}>{m.label}</div>
                  <div style={{ fontSize:'11px', fontWeight:'600', color:'#111' }}>{m.val}</div>
                  {m.sub && <div style={{ fontSize:'9px', color:'#6b7280' }}>{m.sub}</div>}
                </div>
              ))}
            </div>

            {/* Motivo */}
            <div style={{ background:'#fdf4ff', border:'1px solid #e9d5ff', borderRadius:'5px', padding:'8px 10px', marginBottom:'12px' }}>
              <div style={{ fontSize:'8px', textTransform:'uppercase', letterSpacing:'.06em', color:'#7c3aed', fontWeight:'700', marginBottom:'3px' }}>Motivo de la Nota de Crédito</div>
              <div style={{ fontSize:'12px', fontWeight:'600', color:'#374151' }}>{reasonLabel}</div>
              {nc.reasonNote && <div style={{ fontSize:'10px', color:'#6b7280', marginTop:'2px' }}>{nc.reasonNote}</div>}
            </div>

            {/* Tabla de productos */}
            <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:'12px' }}>
              <thead>
                <tr style={{ background:'#7c3aed', color:'#fff' }}>
                  {['DESCRIPCIÓN','CANT.','P. UNIT.','REEMBOLSO'].map((h,i) => (
                    <th key={h} style={{ padding:'6px 8px', fontSize:'9px', fontWeight:'700', textAlign: i===0?'left':i===1?'center':'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nc.items?.map((item, idx) => (
                  <tr key={idx} style={{ background: idx%2===1 ? '#fdf4ff' : '#fff' }}>
                    <td style={{ padding:'6px 8px', fontSize:'10px', color:'#111', borderBottom:'1px solid #e5e7eb' }}>{item.productName}</td>
                    <td style={{ padding:'6px 8px', fontSize:'10px', color:'#111', textAlign:'center', borderBottom:'1px solid #e5e7eb' }}>{item.quantity} {item.unit||'u'}</td>
                    <td style={{ padding:'6px 8px', fontSize:'10px', color:'#111', textAlign:'right', borderBottom:'1px solid #e5e7eb' }}>S/ {Number(item.netUnitPrice||item.unitPrice).toFixed(2)}</td>
                    <td style={{ padding:'6px 8px', fontSize:'10px', fontWeight:'600', color:'#7c3aed', textAlign:'right', borderBottom:'1px solid #e5e7eb' }}>S/ {Number(item.totalRefund).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totales */}
            <div style={{ marginLeft:'auto', width:'220px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#555', padding:'2px 0' }}>
                <span>Op. Gravada:</span><span>S/ {Number(baseImponible).toFixed(2)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#555', padding:'2px 0' }}>
                <span>I.G.V. ({Math.round(igvRate*100)}%):</span><span>S/ {Number(igv).toFixed(2)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', fontWeight:'800', background:'#7c3aed', color:'#fff', padding:'8px 10px', borderRadius:'5px', marginTop:'4px' }}>
                <span>TOTAL REEMBOLSO</span><span>S/ {Number(nc.totalRefund).toFixed(2)}</span>
              </div>
            </div>

            {/* Footer SUNAT */}
            <div style={{ marginTop:'16px', paddingTop:'10px', borderTop:'1px dashed #d1d5db', textAlign:'center', fontSize:'9px', color:'#9ca3af' }}>
              <div>Representación Impresa de Nota de Crédito Electrónica</div>
              <div style={{ marginTop:'2px' }}>Consulte y verifique en: <strong style={{ color:'#374151' }}>www.sunat.gob.pe</strong></div>
            </div>
          </div>
        </div>
        {/* ─────────────────────────────────────────────────────────────────── */}

        {/* Panel WhatsApp */}
        {showPhone && (
          <div className="px-5 py-4 border-t border-green-100 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 flex-shrink-0">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">📱 Enviar NC por WhatsApp</p>
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
                ✕
              </button>
            </div>
            {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
          </div>
        )}

        {/* Botones — 4 acciones claramente diferenciadas */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-800 rounded-b-2xl">
          <div className="grid grid-cols-4 gap-2">
            <button onClick={() => setShowPhone(p => !p)}
              className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-xs font-semibold transition-all ${
                showPhone ? 'bg-green-500 text-white' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 border border-green-200 dark:border-green-800'}`}>
              <span className="text-lg">📱</span><span>WhatsApp</span>
            </button>
            <button onClick={handlePrintA4}
              className="flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-xs font-semibold bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 transition-all">
              <span className="text-lg">📄</span>
              <span>PDF A4</span>
              <span className="text-[10px] font-normal opacity-60">Formal</span>
            </button>
            <button onClick={handlePrint80mm}
              className="flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 transition-all">
              <span className="text-lg">🖨️</span>
              <span>Imprimir</span>
              <span className="text-[10px] font-normal opacity-60">80mm</span>
            </button>
            <button onClick={onClose}
              className="flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-xs font-semibold bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 transition-all">
              <span className="text-lg">✓</span><span>Cerrar</span>
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-slate-500 mt-2">
            PDF A4 = documento formal SUNAT · 80mm = ticket térmico interno
          </p>
        </div>
      </div>
    </div>
  )
}
