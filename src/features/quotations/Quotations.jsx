/**
 * Quotations.jsx — Cotizaciones y Pedidos Preventa v2
 * Ruta: src/features/quotations/Quotations.jsx
 *
 * FLUJO OFICIAL (escrito en piedra):
 *  1. CREAR    → Borrador   (editable, sin restricciones)
 *  2. ENVIAR   → Enviada    (se envía al cliente para revisión)
 *  3. APROBAR  → Aprobada   (cliente confirma — solo desde este estado se puede convertir)
 *  4. CONVERTIR→ Convertida (se carga en el POS para cobrar)
 *
 * RESTRICCIONES:
 *  - Solo las cotizaciones en estado "Aprobada" pueden convertirse en venta
 *  - No se puede convertir una cotización vencida (expiresAt < hoy)
 *  - Al convertir: se pre-cargan ítems con cantidad cotizada en el POS
 *  - El campo "Nota de venta" del POS recibe referencia de la cotización
 */

import { useState, useMemo } from 'react'
import { useStore }           from '../../store/index'
import { formatCurrency, formatDate } from '../../shared/utils/helpers'
import { useDebounce }        from '../../shared/hooks/useDebounce'
import toast                  from 'react-hot-toast'

// ─── Estados del flujo ────────────────────────────────────────────────────────
const Q_STATUS = {
  borrador:   { label: 'Borrador',    color: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',           step: 1 },
  enviada:    { label: 'Enviada',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',          step: 2 },
  aprobada:   { label: 'Aprobada',    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',      step: 3 },
  convertida: { label: 'Convertida',  color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',  step: 4 },
  rechazada:  { label: 'Rechazada',   color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',              step: 0 },
  vencida:    { label: 'Vencida',     color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',      step: 0 },
}

let QN = parseInt(localStorage.getItem('pos_quote_num') || '1', 10)
const nextQN = () => {
  QN++
  localStorage.setItem('pos_quote_num', String(QN))
  return `COT-${String(QN).padStart(6, '0')}`
}

const isExpiredQ = (q) =>
  q.expiresAt && new Date(q.expiresAt) < new Date() &&
  !['convertida','rechazada','vencida'].includes(q.status)

// ─── DOCUMENTO DE COTIZACIÓN (imprimible / WhatsApp / PDF) ────────────────────
function buildQuotationHTML(q, businessConfig) {
  const biz      = businessConfig || {}
  const items    = (q.items || []).map(item => {
    const sub = parseFloat((item.quantity * item.unitPrice * (1 - (item.discount||0)/100)).toFixed(2))
    const descValue = parseFloat((item.quantity * item.unitPrice * (item.discount||0)/100).toFixed(2))
    return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:left">${item.productName}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">S/ ${Number(item.unitPrice).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${item.discount > 0 ? 'S/ ' + descValue.toFixed(2) : '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">S/ ${sub.toFixed(2)}</td>
      </tr>`
  }).join('')

  const expiryDate = q.expiresAt ? new Date(q.expiresAt).toLocaleDateString('es-PE') : '—'
  const createdDate = q.createdAt ? new Date(q.createdAt).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'
  const totalDescuento = (q.items || []).reduce((acc, item) => acc + parseFloat((item.quantity * item.unitPrice * (item.discount||0)/100).toFixed(2)), 0)
  const baseImponible = q.total + totalDescuento
  const igv = parseFloat((q.total * 0.1765).toFixed(2)) // 18% / 1.18 ≈ 17.65%

  const logoUrl = biz.logoUrl || biz.logo || ''

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Cotización ${q.number}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Courier New',monospace; font-size:11px; color:#000; background:#f5f5f5; }
  .actions-bar { display:flex; gap:8px; margin-bottom:20px; padding:15px; background:#fff; position:sticky; top:0; z-index:100; box-shadow:0 2px 4px rgba(0,0,0,.1); }
  .btn { padding:10px 18px; border:1px solid #999; background:#f9f9f9; cursor:pointer; font-size:11px; font-weight:bold; border-radius:4px; transition:0.3s; }
  .btn:hover { background:#e9e9e9; }
  .btn-pdf { background:#dc2626; color:white; border:none; }
  .btn-pdf:hover { background:#b91c1c; }
  .btn-wa { background:#16a34a; color:white; border:none; }
  .btn-wa:hover { background:#15803d; }
  .page { max-width:900px; margin:0 auto; background:#fff; padding:30px; box-shadow:0 1px 3px rgba(0,0,0,.1); page-break-after:always; }
  .header-sunat { margin-bottom:25px; border-bottom:3px solid #000; padding-bottom:15px; }
  .header-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
  .biz-info { flex:1; }
  .biz-logo-wrap { margin-bottom:8px; }
  .biz-logo { max-width:180px; max-height:56px; object-fit:contain; display:block; }
  .biz-name { font-size:16px; font-weight:bold; text-transform:uppercase; margin-bottom:3px; }
  .biz-ruc { font-size:10px; margin:1px 0; }
  .biz-address { font-size:10px; margin:1px 0; max-width:350px; }
  .doc-type { text-align:right; font-size:14px; font-weight:bold; }
  .doc-number { text-align:right; font-size:11px; margin-top:5px; }
  .header-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
  .header-box { font-size:10px; border:1px solid #999; padding:10px; }
  .header-box-label { font-weight:bold; text-transform:uppercase; font-size:9px; margin-bottom:3px; }
  .header-box-value { font-size:11px; }
  table { width:100%; border-collapse:collapse; margin-bottom:15px; }
  thead { background:#f0f0f0; border-top:2px solid #000; border-bottom:2px solid #000; }
  thead th { padding:8px; text-align:left; font-weight:bold; font-size:10px; text-transform:uppercase; border:none; }
  tbody td { padding:8px; border-bottom:1px solid #ddd; }
  .total-section { margin:20px 0; }
  .total-row { display:grid; grid-template-columns:auto auto; gap:20px; justify-content:flex-end; font-size:11px; }
  .total-line { display:grid; grid-template-columns:150px 80px; gap:10px; justify-content:flex-end; }
  .total-label { text-align:right; font-weight:bold; }
  .total-value { text-align:right; font-weight:bold; border-bottom:1px solid #000; padding-bottom:3px; }
  .total-final { font-size:13px; font-weight:bold; }
  .conditions { font-size:9px; margin-top:20px; line-height:1.5; border-top:1px solid #ddd; padding-top:10px; }
  .conditions strong { text-transform:uppercase; }
  .footer { margin-top:25px; text-align:center; font-size:9px; border-top:1px solid #ddd; padding-top:10px; }

  /* Modal bloqueante para WhatsApp */
  .wa-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.65);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 16px;
  }
  .wa-modal-backdrop.show { display: flex; }
  .wa-modal {
    width: 100%;
    max-width: 520px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0,0,0,.25);
    border: 1px solid #e5e7eb;
    overflow: hidden;
  }
  .wa-modal-header {
    padding: 14px 16px;
    border-bottom: 1px solid #e5e7eb;
    font-size: 15px;
    font-weight: bold;
  }
  .wa-modal-body { padding: 16px; }
  .wa-label { display: block; font-size: 12px; font-weight: bold; margin-bottom: 8px; }
  .wa-input {
    width: 100%;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 14px;
    outline: none;
  }
  .wa-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
  .wa-help { margin-top: 6px; font-size: 11px; color: #6b7280; }
  .wa-error { margin-top: 10px; font-size: 12px; color: #dc2626; display: none; }
  .wa-link-wrap { margin-top: 12px; display: none; }
  .wa-link {
    display: inline-block;
    background: #16a34a;
    color: #fff;
    text-decoration: none;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: bold;
  }
  .wa-modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 14px;
  }
  .wa-btn {
    border: 1px solid #d1d5db;
    background: #fff;
    color: #111827;
    padding: 9px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
    font-weight: bold;
  }
  .wa-btn-primary {
    background: #2563eb;
    color: #fff;
    border-color: #2563eb;
  }

  @media print { 
    .actions-bar { display:none !important; } 
    body { background:white; } 
    .page { box-shadow:none; margin:0; padding:15mm; page-break-after:always; }
  }
</style></head>
<body>
  <div class="actions-bar">
    <button class="btn" onclick="window.print()">🖨️ Imprimir</button>
    <button class="btn btn-pdf" onclick="savePDFDocument()">📄 Guardar PDF</button>
    <button class="btn btn-wa" onclick="sendWhatsAppMessage()">📱 Enviar WhatsApp</button>
  </div>

  <div id="wa-modal-backdrop" class="wa-modal-backdrop" aria-hidden="true">
    <div class="wa-modal" role="dialog" aria-modal="true" aria-labelledby="waModalTitle">
      <div class="wa-modal-header" id="waModalTitle">Enviar cotización por WhatsApp</div>
      <div class="wa-modal-body">
        <label class="wa-label" for="wa-phone-input">Número de WhatsApp</label>
        <input id="wa-phone-input" class="wa-input" type="text" placeholder="Ej: 51987654321 o 987654321" />
        <div class="wa-help">Si ingresas 9 dígitos, se agregará prefijo 51 automáticamente.</div>
        <div id="wa-error" class="wa-error"></div>
        <div id="wa-link-wrap" class="wa-link-wrap">
          <div class="wa-help" style="margin-bottom:6px;">Si tu navegador bloquea ventanas emergentes, usa este botón:</div>
          <a id="wa-manual-link" class="wa-link" href="#" target="_blank" rel="noopener noreferrer">Abrir WhatsApp manualmente</a>
        </div>
        <div class="wa-modal-actions">
          <button class="wa-btn" type="button" onclick="closeWhatsAppModal()">Cerrar</button>
          <button class="wa-btn wa-btn-primary" type="button" onclick="confirmSendWhatsApp()">Abrir WhatsApp</button>
        </div>
      </div>
    </div>
  </div>

  <div class="page" id="quotation-page">
    <div class="header-sunat">
      <div class="header-top">
        <div class="biz-info">
          ${logoUrl ? `<div class="biz-logo-wrap"><img src="${logoUrl}" alt="Logo negocio" class="biz-logo" onerror="this.style.display='none'"></div>` : ''}
          <div class="biz-name">${biz.name || 'RAZÓN SOCIAL'}</div>
          <div class="biz-ruc">RUC: ${biz.ruc || '—'}</div>
          <div class="biz-address">${biz.address || 'Dirección'}</div>
          <div class="biz-ruc">Teléfono: ${biz.phone || '—'}</div>
        </div>
        <div>
          <div class="doc-type">COTIZACIÓN</div>
          <div class="doc-number">N° ${q.number}</div>
        </div>
      </div>
    </div>

    <div class="header-grid">
      <div class="header-box">
        <div class="header-box-label">Cliente</div>
        <div class="header-box-value">${q.clientName || 'Sin cliente'}</div>
      </div>
      <div class="header-box">
        <div class="header-box-label">Fecha de Emisión</div>
        <div class="header-box-value">${createdDate}</div>
      </div>
      <div class="header-box">
        <div class="header-box-label">Vigencia (Hasta)</div>
        <div class="header-box-value">${expiryDate}</div>
      </div>
      <div class="header-box">
        <div class="header-box-label">Estado</div>
        <div class="header-box-value">${q.status === 'aprobada' ? 'APROBADA' : q.status === 'enviada' ? 'ENVIADA' : 'BORRADOR'}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:45%">Descripción</th>
          <th style="width:10%">Cant.</th>
          <th style="width:15%;text-align:right">P. Unit.</th>
          <th style="width:15%;text-align:right">Descuento</th>
          <th style="width:15%;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items}
      </tbody>
    </table>

    <div class="total-section">
      <div class="total-row">
        <div class="total-line">
          <span class="total-label">Base Imponible:</span>
          <span class="total-value">S/ ${baseImponible.toFixed(2)}</span>
        </div>
      </div>
      <div class="total-row">
        <div class="total-line">
          <span class="total-label">Descuentos Totales:</span>
          <span class="total-value">S/ ${totalDescuento.toFixed(2)}</span>
        </div>
      </div>
      <div class="total-row">
        <div class="total-line">
          <span class="total-label">IGV (18%):</span>
          <span class="total-value">S/ ${igv.toFixed(2)}</span>
        </div>
      </div>
      <div class="total-row">
        <div class="total-line total-final">
          <span class="total-label">TOTAL A PAGAR:</span>
          <span class="total-value">S/ ${Number(q.total).toFixed(2)}</span>
        </div>
      </div>
    </div>

    ${q.note ? `<div class="conditions"><strong>Notas / Condiciones:</strong><br>${q.note.replace(/\n/g, '<br>')}</div>` : ''}

    <div class="conditions">
      <strong>Condiciones Generales:</strong><br>
      • Esta cotización tiene validez hasta el <strong>${expiryDate}</strong>. Pasada esta fecha no se garantizan los precios.<br>
      • Los precios incluyen IGV del 18%. Sujeto a disponibilidad de stock.<br>
      • Para confirmar el pedido, citar N° de cotización <strong>${q.number}</strong>.<br>
      • Reserva de stock: 48 horas máximo. Luego será liberado automáticamente.<br>
      • Pago contra entrega. Se aceptan transferencias bancarias y efectivo.
    </div>

    <div class="footer">
      <p>Documento emitido por: ${q.userName || '—'}</p>
      <p style="margin-top:15px;">___________________________<br>Firma del Representante</p>
    </div>
  </div>

<script>
  var QUOTE_DATA = ${JSON.stringify({ 
    number: q.number, 
    clientName: q.clientName, 
    total: q.total, 
    items: q.items, 
    userName: q.userName,
    bizName: biz.name,
    createdDate: createdDate,
    status: q.status
  })};
  var BIZ_DATA = ${JSON.stringify({ name: biz.name, ruc: biz.ruc })};

  async function savePDFDocument() {
    try {
      const element = document.getElementById('quotation-page');
      const fileName = 'Cotizacion_' + QUOTE_DATA.number.replace(/-/g, '_') + '_' + (BIZ_DATA.name || 'Empresa').replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
      
      const opt = {
        margin: 10,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
      };
      
      await html2pdf().set(opt).from(element).save();
      alert('PDF descargado: ' + fileName);
    } catch(err) {
      alert('Error al generar PDF: ' + err.message);
    }
  }

  function buildWhatsAppMessage() {
    var lines = [];
    lines.push('¡Hola! 👋');
    lines.push('Te compartimos tu *COTIZACIÓN N° ' + QUOTE_DATA.number + '*');
    lines.push('');
    lines.push('*Empresa:* ' + (BIZ_DATA.name || '—'));
    lines.push('*Cliente:* ' + (QUOTE_DATA.clientName || '—'));
    lines.push('*Fecha:* ' + (QUOTE_DATA.createdDate || '—'));
    lines.push('*Estado:* ' + (QUOTE_DATA.status === 'aprobada' ? 'APROBADA' : QUOTE_DATA.status === 'enviada' ? 'ENVIADA' : 'BORRADOR'));
    lines.push('');
    lines.push('*Detalle de productos:*');

    (QUOTE_DATA.items || []).forEach(function(item, idx) {
      var qty = Number(item.quantity || 0);
      var unit = Number(item.unitPrice || 0);
      var discount = Number(item.discount || 0);
      var sub = (qty * unit * (1 - discount / 100)).toFixed(2);
      var desc = discount > 0 ? ' | Dcto: ' + discount.toFixed(2) + '%' : '';
      lines.push((idx + 1) + '. ' + item.productName);
      lines.push('   Cant: ' + qty + ' x S/ ' + unit.toFixed(2) + desc);
      lines.push('   Subtotal: *S/ ' + sub + '*');
    });

    lines.push('');
    lines.push('*TOTAL COTIZADO: S/ ' + Number(QUOTE_DATA.total || 0).toFixed(2) + '*');
    lines.push('');
    lines.push('Si deseas el PDF, puedes adjuntarlo manualmente desde tu descarga.');
    lines.push('Gracias por tu preferencia 🙌');
    lines.push('');
    lines.push('Atendido por: ' + (QUOTE_DATA.userName || '—'));

    return encodeURIComponent(lines.join('\\n'));
  }

  function openWhatsAppModal() {
    var backdrop = document.getElementById('wa-modal-backdrop');
    var input = document.getElementById('wa-phone-input');
    var error = document.getElementById('wa-error');
    var linkWrap = document.getElementById('wa-link-wrap');
    var link = document.getElementById('wa-manual-link');

    if (error) { error.style.display = 'none'; error.textContent = ''; }
    if (linkWrap) linkWrap.style.display = 'none';
    if (link) link.href = '#';

    backdrop.classList.add('show');
    backdrop.setAttribute('aria-hidden', 'false');
    setTimeout(function() { if (input) input.focus(); }, 40);
  }

  function closeWhatsAppModal() {
    var backdrop = document.getElementById('wa-modal-backdrop');
    backdrop.classList.remove('show');
    backdrop.setAttribute('aria-hidden', 'true');
  }

  function normalizePhone(raw) {
    var cleanPhone = String(raw || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 9) cleanPhone = '51' + cleanPhone;
    return cleanPhone;
  }

  function confirmSendWhatsApp() {
    try {
      var input = document.getElementById('wa-phone-input');
      var error = document.getElementById('wa-error');
      var linkWrap = document.getElementById('wa-link-wrap');
      var link = document.getElementById('wa-manual-link');

      if (error) { error.style.display = 'none'; error.textContent = ''; }
      if (linkWrap) linkWrap.style.display = 'none';

      var phone = input ? input.value : '';
      var cleanPhone = normalizePhone(phone);

      if (!cleanPhone || cleanPhone.length < 11 || cleanPhone.length > 15) {
        error.textContent = 'Número inválido. Usa formato internacional (ej. 51987654321).';
        error.style.display = 'block';
        return;
      }

      var msg = buildWhatsAppMessage();
      var url = 'https://wa.me/' + cleanPhone + '?text=' + msg;

      var waWin = window.open(url, '_blank');
      if (!waWin) {
        if (link) link.href = url;
        if (linkWrap) linkWrap.style.display = 'block';
        error.textContent = 'Tu navegador bloqueó la apertura automática. Usa el botón verde para abrir WhatsApp.';
        error.style.display = 'block';
        return;
      }

      closeWhatsAppModal();
    } catch (err) {
      var error = document.getElementById('wa-error');
      if (error) {
        error.textContent = 'No se pudo preparar el envío: ' + err.message;
        error.style.display = 'block';
      }
    }
  }

  async function sendWhatsAppMessage() {
    openWhatsAppModal();
  }
</script>
</body></html>`
}

// ─── Formulario de cotización ─────────────────────────────────────────────────
function QuotationForm({ quotation, onClose, onSave }) {
  const { products, clients, currentUser } = useStore()
  const [clientId,  setClientId]  = useState(quotation?.clientId  || '')
  const [items,     setItems]     = useState(quotation?.items      || [])
  const [note,      setNote]      = useState(quotation?.note       || '')
  const [validDays, setValidDays] = useState(quotation?.validDays  || 7)
  const [search,    setSearch]    = useState('')
  const dq = useDebounce(search, 150)

  const searchResults = useMemo(() => {
    if (!dq.trim()) return []
    const q = dq.toLowerCase()
    return products.filter(p => p.isActive && (
      p.name.toLowerCase().includes(q) || p.barcode.includes(dq)
    )).slice(0, 6)
  }, [dq, products])

  const addItem = (product) => {
    if (items.find(i => i.productId === product.id)) { toast.error('Ya está en la lista'); return }
    setItems(prev => [...prev, {
      productId: product.id, productName: product.name,
      barcode: product.barcode, unit: product.unit,
      quantity: 1, unitPrice: product.priceSell, discount: 0,
    }])
    setSearch('')
  }

  const updateItem = (idx, field, val) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: parseFloat(val) || 0 } : item))

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  const total    = items.reduce((a, i) => a + i.quantity * i.unitPrice * (1 - i.discount / 100), 0)
  const client   = clients.find(c => c.id === clientId)

  const handleSave = (status = 'borrador') => {
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return }
    const q = {
      id:         quotation?.id || crypto.randomUUID(),
      number:     quotation?.number || nextQN(),
      clientId,
      clientName: client?.name || 'Sin cliente',
      items,
      note,
      validDays,
      expiresAt:  new Date(new Date().getTime() + validDays * 86400000).toISOString(),
      total:      parseFloat(total.toFixed(2)),
      status,
      userId:     currentUser?.id,
      userName:   currentUser?.fullName,
      createdAt:  quotation?.createdAt || new Date().toISOString(),
      updatedAt:  new Date().toISOString(),
    }
    onSave(q)
    onClose()
  }

  const cls = 'w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-4">

      {/* ── PUNTO 5: Flujo explicativo con restricciones ─────────────────────── */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <p className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide mb-2">
          📋 Flujo de cotización — pasos y restricciones
        </p>
        <div className="flex items-center gap-1 flex-wrap text-xs text-blue-700 dark:text-blue-400 mb-2">
          {[
            { n:1, label:'Crear', icon:'✏️' },
            { n:2, label:'Enviar', icon:'📤' },
            { n:3, label:'Aprobar', icon:'✅' },
            { n:4, label:'→ Venta', icon:'🛒' },
          ].map((s, i, arr) => (
            <span key={s.n} className="flex items-center gap-1">
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 rounded-full font-semibold">
                {s.icon} {s.label}
              </span>
              {i < arr.length-1 && <span className="text-blue-400 dark:text-blue-600">→</span>}
            </span>
          ))}
        </div>
        <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-0.5">
          <li>⚠️ <strong>Solo una cotización "Aprobada"</strong> puede convertirse en venta</li>
          <li>⏰ <strong>No se puede convertir</strong> una cotización vencida (fuera de fecha de validez)</li>
          <li>📦 Al convertir, los ítems y cantidades cotizadas se cargan automáticamente en el POS</li>
          <li>📝 El N° de cotización aparecerá como referencia en la nota de la venta</li>
        </ul>
      </div>

      {/* Cliente y validez */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Cliente</label>
          <select value={clientId} onChange={e => setClientId(e.target.value)} className={cls}>
            <option value="">Sin cliente / Prospect</option>
            {clients.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
            Válida por (días)
          </label>
          <select value={validDays} onChange={e => setValidDays(parseInt(e.target.value))} className={cls}>
            {[1, 3, 7, 15, 30, 60].map(d => <option key={d} value={d}>{d} día{d > 1 ? 's' : ''}</option>)}
          </select>
        </div>
      </div>

      {/* Búsqueda de productos */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Agregar productos</label>
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código de barras..."
            className={cls}/>
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl z-20 overflow-hidden">
              {searchResults.map(p => (
                <button key={p.id} onMouseDown={() => addItem(p)}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-50 dark:border-slate-700/50 last:border-0 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{p.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{p.barcode} · Stock: {p.stock}</p>
                  </div>
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(p.priceSell)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla de ítems */}
      {items.length > 0 && (
        <div className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                {['Producto','Cant.','P. Unit.','Dto.%','V. Desc.','Subtotal',''].map(h => (
                  <th key={h} className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {items.map((item, idx) => {
                const sub = parseFloat((item.quantity * item.unitPrice * (1 - item.discount/100)).toFixed(2))
                const discountValue = parseFloat((item.quantity * item.unitPrice * (item.discount/100)).toFixed(2))
                return (
                  <tr key={idx}>
                    <td className="px-3 py-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{item.productName}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{item.unit}</p>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="1" step="1" value={item.quantity}
                        onChange={e => updateItem(idx,'quantity',e.target.value)}
                        className="w-16 text-center px-2 py-1 border border-gray-200 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="0.01" value={item.unitPrice} disabled
                        className="w-20 text-right px-2 py-1 border border-gray-200 dark:border-slate-600 rounded text-sm dark:bg-slate-600 dark:text-slate-300 bg-gray-100 text-gray-500 cursor-not-allowed focus:outline-none"/>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" max="100" step="0.01" value={item.discount}
                        onChange={e => updateItem(idx,'discount',e.target.value)}
                        className="w-24 text-center px-2 py-1 border border-gray-200 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-slate-100">{formatCurrency(discountValue)}</td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-slate-100">{formatCurrency(sub)}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeItem(idx)} className="text-gray-300 dark:text-slate-600 hover:text-red-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-700">
            <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">TOTAL COTIZACIÓN</span>
            <span className="text-base font-bold text-gray-800 dark:text-slate-100">{formatCurrency(total)}</span>
          </div>
        </div>
      )}

      {/* Nota */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Nota / Condiciones de la cotización</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
          placeholder="Condiciones de pago, plazo de entrega, observaciones..."
          className={cls + ' resize-none'}/>
      </div>

      {/* Acciones */}
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
          Cancelar
        </button>
        <button type="button" onClick={() => handleSave('borrador')}
          className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-600">
          💾 Borrador
        </button>
        <button type="button" onClick={() => handleSave('enviada')}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          📤 Enviar al cliente
        </button>
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Quotations() {
  const { businessConfig } = useStore()

  const [quotations, setQuotations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_quotations') || '[]') } catch { return [] }
  })

  const saveQuotations = (list) => {
    setQuotations(list)
    localStorage.setItem('pos_quotations', JSON.stringify(list))
  }

  const [modal,        setModal]        = useState(null)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('todas')
  const dq = useDebounce(search, 150)

  const filtered = useMemo(() => {
    let list = quotations
    if (dq.trim()) {
      const q = dq.toLowerCase()
      list = list.filter(qt =>
        qt.number?.toLowerCase().includes(q) ||
        qt.clientName?.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'todas') list = list.filter(qt => qt.status === statusFilter)
    return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [quotations, dq, statusFilter])

  const kpis = useMemo(() => ({
    total:       quotations.length,
    pendientes:  quotations.filter(q => ['borrador','enviada','aprobada'].includes(q.status)).length,
    convertidas: quotations.filter(q => q.status === 'convertida').length,
    monto:       quotations.filter(q => ['enviada','aprobada'].includes(q.status))
                   .reduce((a, q) => a + q.total, 0),
  }), [quotations])

  const handleSave = (q) => {
    const existing = quotations.findIndex(x => x.id === q.id)
    const updated  = existing >= 0
      ? quotations.map(x => x.id === q.id ? q : x)
      : [q, ...quotations]
    saveQuotations(updated)
    toast.success(`Cotización ${q.number} ${q.status === 'borrador' ? 'guardada' : 'enviada'}`)
  }

  const handleStatusChange = (id, status) => {
    saveQuotations(quotations.map(q => q.id === id ? { ...q, status, updatedAt: new Date().toISOString() } : q))
    toast.success(`Estado actualizado: ${Q_STATUS[status]?.label}`)
  }

  // ── PUNTO 1, 2, 3, 4: Convertir a venta con todas las restricciones ─────────

  // ── Punto 6: Emitir documento de cotización ───────────────────────────────
  const handleEmitirDocumento = (q) => {
    const html = buildQuotationHTML(q, businessConfig)
    setModal({ type: 'document', data: { quotation: q, html } })
  }

  const handleDelete = (id) => {
    saveQuotations(quotations.filter(q => q.id !== id))
    toast.success('Cotización eliminada')
  }

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Cotizaciones</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">
            Pedidos preventa — {quotations.length} total
          </p>
        </div>
        <button onClick={() => setModal({ type: 'form', data: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Nueva cotización
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total',           value: kpis.total,                 color: 'text-gray-800 dark:text-slate-100' },
          { label: 'Pendientes',      value: kpis.pendientes,            color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Convertidas',     value: kpis.convertidas,           color: 'text-green-600 dark:text-green-400' },
          { label: 'Monto pendiente', value: formatCurrency(kpis.monto), color: 'text-blue-600 dark:text-blue-400' },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-semibold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Flujo visual compacto */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-slate-400">
        <span className="font-semibold text-gray-700 dark:text-slate-300 mr-1">Flujo:</span>
        {[
          { s:'borrador',   label:'✏️ Borrador',   note:'Editable' },
          { s:'enviada',    label:'📤 Enviada',    note:'Al cliente' },
          { s:'aprobada',   label:'✅ Aprobada',   note:'Lista para venta', highlight: true },
        ].map((f, i, arr) => (
          <span key={f.s} className="flex items-center gap-1">
            <span className={`flex flex-col items-center px-2 py-1 rounded-lg ${f.highlight ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-semibold border border-green-200 dark:border-green-800' : ''}`}>
              <span>{f.label}</span>
              <span className="text-[10px] opacity-60">{f.note}</span>
            </span>
            {i < arr.length - 1 && <span className="text-gray-300 dark:text-slate-600">→</span>}
          </span>
        ))}
        <span className="ml-2 text-red-400 text-[10px]">⚠️ Solo "Aprobada" puede convertirse · No se puede si está vencida</span>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por N° o cliente..."
          className="flex-1 min-w-48 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1 flex-wrap">
          {[{ k:'todas', l:'Todas' }, ...Object.entries(Q_STATUS).map(([k,v]) => ({ k, l: v.label }))].map(f => (
            <button key={f.k} onClick={() => setStatusFilter(f.k)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                statusFilter === f.k ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400'
              }`}>{f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl">
          <div className="text-5xl mb-3 opacity-20">📋</div>
          <p className="text-gray-400 dark:text-slate-500 font-medium">
            {quotations.length === 0 ? 'No hay cotizaciones aún' : 'Sin resultados para este filtro'}
          </p>
          {quotations.length === 0 && (
            <button onClick={() => setModal({ type: 'form', data: null })}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              Crear primera cotización
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                  {['N° Cotización','Cliente','Ítems','Total','Válida hasta','Estado','Acciones'].map(h => (
                    <th key={h} className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-2.5 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {filtered.map(q => {
                  const expired = isExpiredQ(q)
                  const status  = expired ? 'vencida' : q.status
                  const st      = Q_STATUS[status] || Q_STATUS.borrador

                  return (
                    <tr key={q.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${expired ? 'opacity-70' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-mono font-semibold text-gray-800 dark:text-slate-100">{q.number}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{formatDate(q.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-200">{q.clientName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300">{q.items?.length} ítem{q.items?.length !== 1 ? 's' : ''}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-slate-100">{formatCurrency(q.total)}</td>
                      <td className="px-4 py-3">
                        <p className={`text-xs ${expired ? 'text-red-500' : 'text-gray-500 dark:text-slate-400'}`}>
                          {formatDate(q.expiresAt)}
                        </p>
                        {expired && <p className="text-[10px] text-red-400">Vencida</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">

                          {/* Punto 6: Emitir documento */}
                          <button onClick={() => handleEmitirDocumento(q)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Ver / Imprimir documento de cotización">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                          </button>

                          {/* Editar */}
                          {['borrador','enviada'].includes(q.status) && (
                            <button onClick={() => setModal({ type: 'form', data: q })}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Editar">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                            </button>
                          )}

                          {/* Aprobar (desde Enviada) */}
                          {q.status === 'enviada' && !expired && (
                            <button onClick={() => handleStatusChange(q.id, 'aprobada')}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors" title="Marcar como aprobada">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            </button>
                          )}

                          {/* Botón de venta removido cuando está aprobada por solicitud del usuario */}
                          {/* La cotización aprobada se carga manualmente desde otra interfaz */}

                          {/* Rechazar */}
                          {['borrador','enviada','aprobada'].includes(q.status) && (
                            <button onClick={() => handleStatusChange(q.id, 'rechazada')}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Rechazar cotización">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                          )}

                          {/* Eliminar */}
                          {['borrador','rechazada','vencida'].includes(q.status) && (
                            <button onClick={() => handleDelete(q.id)}
                              className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-red-400 rounded-lg transition-colors" title="Eliminar">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal documento de cotización (bloqueante) */}
      {modal?.type === 'document' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] overflow-hidden border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div>
                <h2 className="text-base font-bold text-gray-800 dark:text-slate-100">
                  Documento de cotización
                </h2>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  {modal.data?.quotation?.number} · {modal.data?.quotation?.clientName}
                </p>
              </div>
              <button
                onClick={() => setModal(null)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700">
                Cerrar
              </button>
            </div>

            <iframe
              title="Documento de cotización"
              srcDoc={modal.data?.html || ''}
              className="w-full h-[calc(92vh-58px)] border-0 bg-white"
            />
          </div>
        </div>
      )}

      {/* Modal formulario */}
      {modal?.type === 'form' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <div>
                <h2 className="text-base font-bold text-gray-800 dark:text-slate-100">
                  {modal.data ? `Editar ${modal.data.number}` : 'Nueva cotización'}
                </h2>
                {modal.data && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Estado actual: <strong>{Q_STATUS[modal.data.status]?.label}</strong>
                  </p>
                )}
              </div>
              <button onClick={() => setModal(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-xl">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-5">
              <QuotationForm quotation={modal.data} onClose={() => setModal(null)} onSave={handleSave}/>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
