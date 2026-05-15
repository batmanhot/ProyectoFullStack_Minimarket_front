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
import { formatCurrency, formatDate, formatDateTime } from '../../shared/utils/helpers'
import { useDebounce }        from '../../shared/hooks/useDebounce'
import toast                  from 'react-hot-toast'
import ConfirmModal           from '../../shared/components/ui/ConfirmModal'

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

// ─── Modal de documento de cotización — estilo idéntico a CreditNoteModal ─────
function QuotationDocModal({ q, businessConfig, onClose }) {
  const [showPhone, setShowPhone] = useState(false)
  const [phone, setPhone]         = useState('')
  const [phoneError, setPhoneError] = useState('')

  const biz         = businessConfig || {}
  const expiryDate  = q.expiresAt ? new Date(q.expiresAt).toLocaleDateString('es-PE') : '—'
  const createdDate = q.createdAt  ? new Date(q.createdAt).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'
  const stLabel     = Q_STATUS[q.status]?.label || q.status
  const totalDesc   = (q.items||[]).reduce((a,i) => a + i.quantity*i.unitPrice*(i.discount||0)/100, 0)
  const base        = q.total / 1.18
  const igv         = q.total - base

  // ── PDF A4 formal ──────────────────────────────────────────────────────────
  const handlePrintA4 = () => {
    const rows = (q.items||[]).map(item => {
      const subtotalBruto = parseFloat((item.quantity*item.unitPrice).toFixed(2))
      const importeDesc   = parseFloat((subtotalBruto*(item.discount||0)/100).toFixed(2))
      const totalNeto     = parseFloat((subtotalBruto - importeDesc).toFixed(2))
      const bs = 'padding:7px 8px;border-bottom:1px solid #e5e7eb;color:#111;font-size:10px;'
      return `<tr>
        <td style="${bs}">${item.productName}<br><span style="color:#9ca3af;font-size:9px">${item.unit||'u'}</span></td>
        <td style="${bs}text-align:center;">${item.quantity}</td>
        <td style="${bs}text-align:right;">S/ ${Number(item.unitPrice).toFixed(2)}</td>
        <td style="${bs}text-align:right;">S/ ${subtotalBruto.toFixed(2)}</td>
        <td style="${bs}text-align:center;">${item.discount||0}%</td>
        <td style="${bs}text-align:right;color:${importeDesc>0?'#dc2626':'#9ca3af'}">${importeDesc>0?`-S/ ${importeDesc.toFixed(2)}`:'—'}</td>
        <td style="${bs}text-align:right;font-weight:700;">S/ ${totalNeto.toFixed(2)}</td>
      </tr>`
    }).join('')
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cotización ${q.number}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#f3f4f6;}
.page{max-width:210mm;margin:10mm auto;background:#fff;padding:15mm;box-shadow:0 2px 16px rgba(0,0,0,.1);}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;}
.doc-box{border:2px solid #2563eb;border-radius:6px;padding:12px 16px;text-align:center;min-width:150px;}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
.meta-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:5px;padding:9px;}
.meta-label{font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;font-weight:700;display:block;margin-bottom:3px;}
.meta-val{font-size:12px;font-weight:600;color:#111;}.meta-sub{font-size:10px;color:#6b7280;}
table{width:100%;border-collapse:collapse;margin-bottom:14px;}
thead tr{background:#2563eb;color:#fff;}thead th{padding:8px;font-size:9px;font-weight:700;}
tbody tr:nth-child(even){background:#eff6ff;}
.total-final{background:#2563eb;color:#fff;border-radius:5px;padding:9px 13px;display:flex;justify-content:space-between;font-size:14px;font-weight:800;margin-top:4px;}
.signature{display:flex;justify-content:space-between;margin-top:28px;}
.sig-box{text-align:center;border-top:1px solid #d1d5db;padding-top:6px;width:150px;font-size:10px;color:#6b7280;}
.conditions{font-size:10px;color:#6b7280;line-height:1.6;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:8px;}
.actions-bar{display:flex;gap:8px;margin-bottom:16px;}
.btn{padding:8px 18px;border-radius:8px;border:none;cursor:pointer;font-size:12px;font-weight:700;}
.btn-p{background:#2563eb;color:#fff;}.btn-w{background:#16a34a;color:#fff;}
@media print{.actions-bar{display:none!important}body{background:#fff}.page{box-shadow:none;margin:0;padding:12mm}@page{size:A4;margin:8mm}}
</style></head><body>
<div class="page">
  <div class="actions-bar">
    <button class="btn btn-p" onclick="window.print()">🖨️ Imprimir / PDF A4</button>
    <button class="btn btn-w" onclick="sendWA()">📱 WhatsApp</button>
  </div>
  <div class="header">
    <div>
      ${biz.logoUrl ? `<img src="${biz.logoUrl}" style="max-height:52px;max-width:155px;object-fit:contain;margin-bottom:5px;display:block" onerror="this.style.display='none'">` : ''}
      <div style="font-size:16px;font-weight:800;color:#111">${biz.name||'MI NEGOCIO'}</div>
      ${biz.ruc     ? `<div style="font-size:10px;color:#6b7280">R.U.C.: ${biz.ruc}</div>` : ''}
      ${biz.address ? `<div style="font-size:10px;color:#6b7280">${biz.address}</div>` : ''}
      ${biz.phone   ? `<div style="font-size:10px;color:#6b7280">Tel: ${biz.phone}</div>` : ''}
    </div>
    <div class="doc-box">
      <div style="font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase">Documento Comercial</div>
      <div style="font-size:16px;font-weight:900;color:#111;margin:3px 0;letter-spacing:.04em">COTIZACIÓN</div>
      <div style="font-size:14px;font-weight:900;color:#2563eb;font-family:monospace">${q.number}</div>
      <div style="font-size:9px;color:#6b7280;margin-top:3px">Estado: <b style="color:#2563eb">${stLabel}</b></div>
    </div>
  </div>
  <hr style="border:none;border-top:2px solid #2563eb;margin:12px 0">
  <div class="meta-grid">
    <div class="meta-box"><span class="meta-label">Cliente</span><div class="meta-val">${q.clientName||'Sin cliente'}</div></div>
    <div class="meta-box"><span class="meta-label">Fecha de emisión</span><div class="meta-val">${createdDate}</div></div>
    <div class="meta-box"><span class="meta-label">Válida hasta</span><div class="meta-val">${expiryDate}</div><div class="meta-sub">${q.validDays} día${q.validDays>1?'s':''} de validez</div></div>
    <div class="meta-box"><span class="meta-label">Elaborado por</span><div class="meta-val">${q.userName||'—'}</div><div class="meta-sub">Citar N° ${q.number} al confirmar</div></div>
  </div>
  <table>
    <thead><tr>
      <th style="text-align:left;width:30%">DESCRIPCIÓN</th>
      <th style="text-align:center">CANT.</th>
      <th style="text-align:right">P. UNIT.</th>
      <th style="text-align:right">SUBTOTAL</th>
      <th style="text-align:center">DTO.%</th>
      <th style="text-align:right">IMP. DESC.</th>
      <th style="text-align:right">TOTAL (S/)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="width:240px;margin-left:auto;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;color:#555"><span>Base imponible:</span><span>S/ ${base.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;color:${totalDesc>0?'#dc2626':'#555'}"><span>Descuentos totales:</span><span>-S/ ${totalDesc.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;color:#555"><span>IGV (18%):</span><span>S/ ${igv.toFixed(2)}</span></div>
    <div class="total-final"><span>TOTAL A PAGAR:</span><span>S/ ${Number(q.total).toFixed(2)}</span></div>
  </div>
  ${q.note ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:5px;padding:10px;margin-bottom:12px;font-size:10px;color:#1e40af"><b>Notas / Condiciones:</b><br>${q.note}</div>` : ''}
  <div class="conditions">
    <b>Condiciones generales:</b><br>
    • Esta cotización tiene validez hasta el <b>${expiryDate}</b>. Pasada esta fecha no se garantizan los precios.<br>
    • Los precios incluyen IGV del 18%. Sujeto a disponibilidad de stock.<br>
    • Para confirmar el pedido, citar N° de cotización <b>${q.number}</b>.<br>
    • Reserva de stock: 48 horas máximo. Luego será liberado automáticamente.
  </div>
  <div class="signature">
    <div class="sig-box"><div style="margin-bottom:28px">V°B° Emisor</div><div>${biz.name||'MI NEGOCIO'}</div></div>
    <div class="sig-box"><div style="margin-bottom:28px">Aprobado por</div><div>${q.clientName||'Cliente'}</div></div>
  </div>
</div>
<script>
var Q=${JSON.stringify({number:q.number,clientName:q.clientName,total:q.total,items:q.items,userName:q.userName,note:q.note})};
var BIZ=${JSON.stringify({name:biz.name,ruc:biz.ruc})};
function sendWA(){
  var lines=['*'+(BIZ.name||'Mi Negocio')+'*'];
  if(BIZ.ruc) lines.push('RUC: '+BIZ.ruc);
  lines.push('─────────────────','*COTIZACIÓN '+Q.number+'*','Cliente: '+Q.clientName,'─────────────────');
  (Q.items||[]).forEach(function(i){
    var stB=(i.quantity*i.unitPrice).toFixed(2);
    var imp=((i.quantity*i.unitPrice*(i.discount||0)/100)).toFixed(2);
    var tot=(i.quantity*i.unitPrice*(1-(i.discount||0)/100)).toFixed(2);
    var dsc=parseFloat(imp)>0?' | Dto.'+i.discount+'%: -S/'+imp:'';
    lines.push('• '+i.productName+': '+i.quantity+' '+(i.unit||'u')+' x S/'+(+i.unitPrice).toFixed(2)+' = S/'+stB+dsc+' → *S/'+tot+'*');
  });
  lines.push('─────────────────','*TOTAL: S/'+Number(Q.total).toFixed(2)+'*');
  if(Q.note) lines.push('Nota: '+Q.note);
  lines.push('Confirmar citando N°: '+Q.number);
  var ph=prompt('Número WhatsApp (ej: 51987654321):');
  if(ph) window.open('https://wa.me/'+ph.replace(/[^0-9]/g,'')+'?text='+encodeURIComponent(lines.join('\n')),'_blank');
}
</script></body></html>`
    const win = window.open('', '_blank', 'width=900,height=750,menubar=yes,scrollbars=yes')
    if (!win) { toast.error('Activa las ventanas emergentes'); return }
    win.document.write(html)
    win.document.close()
  }

  // ── WhatsApp desde el modal ───────────────────────────────────────────────
  const handleWhatsApp = () => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 9) { setPhoneError('Ingresa un número válido de 9 dígitos'); return }
    setPhoneError('')
    const intl      = cleaned.startsWith('51') ? cleaned : `51${cleaned}`
    const itemLines = (q.items||[]).map(item => {
      const stBruto = parseFloat((item.quantity * item.unitPrice).toFixed(2))
      const impDesc = parseFloat((stBruto * (item.discount||0) / 100).toFixed(2))
      const total   = parseFloat((stBruto - impDesc).toFixed(2))
      const dscPart = impDesc > 0 ? ` | Dto.${item.discount}%: -S/${impDesc.toFixed(2)}` : ''
      return `• ${item.productName}: ${item.quantity} ${item.unit||'u'} × S/${Number(item.unitPrice).toFixed(2)} = S/${stBruto.toFixed(2)}${dscPart} → *Total: S/${total.toFixed(2)}*`
    })
    const lines = [
      `*${biz.name||'Mi Negocio'}*`,
      biz.ruc ? `RUC: ${biz.ruc}` : null,
      `─────────────────────`,
      `*COTIZACIÓN ${q.number}*`,
      `Cliente: ${q.clientName||'Sin cliente'}`,
      `Válida hasta: ${expiryDate}`,
      `─────────────────────`,
      ...itemLines,
      `─────────────────────`,
      `*TOTAL: S/ ${Number(q.total).toFixed(2)}*`,
      q.note ? `Nota: ${q.note}` : null,
      `Para confirmar citar N°: ${q.number}`,
    ].filter(Boolean).join('\n')
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(lines)}`, '_blank')
    setShowPhone(false); setPhone('')
  }

  // ── Ticket 80mm (uso interno) ─────────────────────────────────────────────
  const handlePrint80mm = () => {
    const win = window.open('', '_blank', 'width=380,height=680')
    if (!win) { toast.error('Activa las ventanas emergentes'); return }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:10px;width:80mm;padding:4mm;color:#000;background:#fff}
.hr{border:none;border-top:1px dashed #000;margin:2.5mm 0}.row{display:flex;justify-content:space-between}.center{text-align:center}.bold{font-weight:bold}
.fab{position:fixed;bottom:12px;right:12px;background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700}
@page{size:80mm auto;margin:0}@media print{.fab{display:none}}</style></head><body>
${biz.logoUrl ? `<div class="center" style="margin-bottom:2mm"><img src="${biz.logoUrl}" style="max-width:48mm;max-height:16mm;object-fit:contain" onerror="this.style.display='none'"></div>` : ''}
<div class="center bold" style="font-size:12px">${(biz.name||'MI NEGOCIO').toUpperCase()}</div>
${biz.ruc ? `<div class="center">RUC: ${biz.ruc}</div>` : ''}
<hr class="hr">
<div class="center bold">COTIZACIÓN</div>
<div class="center bold" style="font-size:12px">${q.number}</div>
<hr class="hr">
<div>Cliente: ${q.clientName||'Sin cliente'}</div>
<div>Válida hasta: ${expiryDate}</div>
<hr class="hr">
${(q.items||[]).map(i => {
      const stBruto   = parseFloat((i.quantity*i.unitPrice).toFixed(2))
      const impDesc   = parseFloat((stBruto*(i.discount||0)/100).toFixed(2))
      const totalNeto = parseFloat((stBruto - impDesc).toFixed(2))
      return `<div class="bold">${i.productName}</div>
<div class="row"><span>${i.quantity} ${i.unit||'u'} x S/${Number(i.unitPrice).toFixed(2)}</span><span>S/${stBruto.toFixed(2)}</span></div>${impDesc>0?`<div class="row"><span>Dto. ${i.discount}%:</span><span style="color:#dc2626">-S/${impDesc.toFixed(2)}</span></div>`:''}
<div class="row bold"><span>Total:</span><span>S/${totalNeto.toFixed(2)}</span></div>`
    }).join('<hr class="hr">')}
<hr class="hr">
<div class="row bold" style="font-size:12px"><span>TOTAL:</span><span>S/${Number(q.total).toFixed(2)}</span></div>
<hr class="hr">
<div class="center" style="font-size:9px">Confirmar citando N°: ${q.number}</div>
<button class="fab" onclick="window.print()">🖨️ Imprimir 80mm</button>
</body></html>`)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-auto flex flex-col" style={{maxHeight:'92vh'}}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-blue-500 text-lg">📋</span>
              <h2 className="font-bold text-gray-800 dark:text-slate-100">Documento de Cotización</h2>
            </div>
            <p className="text-xs text-blue-500 font-mono mt-0.5">{q.number} · {q.clientName||'Sin cliente'}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        {/* Vista previa — siempre fondo blanco, inmune al tema oscuro */}
        <div className="flex-1 overflow-y-auto p-4" style={{background:'#d1d5db',colorScheme:'light'}}>
          <div className="mx-auto shadow-lg" style={{width:'100%',maxWidth:'480px',background:'#ffffff',fontFamily:'Arial,sans-serif',fontSize:'11px',color:'#111111',WebkitTextFillColor:'#111111',padding:'20px',border:'1px solid #d1d5db',colorScheme:'light'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'14px'}}>
              <div>
                {biz.logoUrl && <img src={biz.logoUrl} alt="" style={{maxHeight:'44px',maxWidth:'140px',objectFit:'contain',marginBottom:'6px',display:'block'}} onError={e => e.target.style.display='none'}/>}
                <div style={{fontSize:'14px',fontWeight:'800',color:'#111'}}>{biz.name||'MI NEGOCIO'}</div>
                {biz.ruc     && <div style={{fontSize:'10px',color:'#555'}}>R.U.C.: {biz.ruc}</div>}
                {biz.address && <div style={{fontSize:'10px',color:'#555'}}>{biz.address}</div>}
                {biz.phone   && <div style={{fontSize:'10px',color:'#555'}}>Tel: {biz.phone}</div>}
              </div>
              <div style={{border:'2px solid #2563eb',borderRadius:'6px',padding:'8px 12px',textAlign:'center',minWidth:'130px'}}>
                <div style={{fontSize:'8px',fontWeight:'700',color:'#6b7280',textTransform:'uppercase',letterSpacing:'.05em'}}>Documento Comercial</div>
                <div style={{fontSize:'16px',fontWeight:'900',color:'#111',margin:'3px 0',letterSpacing:'.04em'}}>COTIZACIÓN</div>
                <div style={{fontSize:'13px',fontWeight:'900',color:'#2563eb',fontFamily:'monospace'}}>{q.number}</div>
                <div style={{fontSize:'9px',color:'#6b7280',marginTop:'3px'}}>Estado: <strong style={{color:'#2563eb'}}>{stLabel}</strong></div>
              </div>
            </div>
            <hr style={{border:'none',borderTop:'2px solid #2563eb',margin:'10px 0'}}/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px'}}>
              {[{label:'Cliente',val:q.clientName||'Sin cliente'},{label:'Fecha de emisión',val:createdDate},{label:'Válida hasta',val:expiryDate,sub:`${q.validDays} día${q.validDays>1?'s':''} de validez`},{label:'Elaborado por',val:q.userName||'—',sub:`Citar N° ${q.number}`}].map(m => (
                <div key={m.label} style={{background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:'5px',padding:'8px'}}>
                  <div style={{fontSize:'8px',textTransform:'uppercase',letterSpacing:'.06em',color:'#9ca3af',fontWeight:'700',marginBottom:'3px'}}>{m.label}</div>
                  <div style={{fontSize:'11px',fontWeight:'600',color:'#111'}}>{m.val}</div>
                  {m.sub && <div style={{fontSize:'9px',color:'#6b7280'}}>{m.sub}</div>}
                </div>
              ))}
            </div>
            <table style={{width:'100%',borderCollapse:'collapse',marginBottom:'12px'}}>
              <thead>
                <tr style={{background:'#2563eb',color:'#fff'}}>
                  {[['DESCRIPCIÓN','left'],['CANT.','center'],['P. UNIT.','right'],['SUBTOTAL','right'],['DTO.%','center'],['IMP. DESC.','right'],['TOTAL','right']].map(([h,align]) => (
                    <th key={h} style={{padding:'5px 6px',fontSize:'8px',fontWeight:'700',textAlign:align}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(q.items||[]).map((item,idx) => {
                  const subtotalBruto = parseFloat((item.quantity*item.unitPrice).toFixed(2))
                  const importeDesc   = parseFloat((subtotalBruto*(item.discount||0)/100).toFixed(2))
                  const totalNeto     = parseFloat((subtotalBruto - importeDesc).toFixed(2))
                  const cs = {fontSize:'10px',color:'#111',borderBottom:'1px solid #e5e7eb',padding:'5px 6px'}
                  return (
                    <tr key={idx} style={{background:idx%2===1?'#eff6ff':'#fff'}}>
                      <td style={cs}>{item.productName}<br/><span style={{fontSize:'8px',color:'#9ca3af'}}>{item.unit||'u'}</span></td>
                      <td style={{...cs,textAlign:'center'}}>{item.quantity}</td>
                      <td style={{...cs,textAlign:'right'}}>S/ {Number(item.unitPrice).toFixed(2)}</td>
                      <td style={{...cs,textAlign:'right'}}>S/ {subtotalBruto.toFixed(2)}</td>
                      <td style={{...cs,textAlign:'center'}}>{item.discount||0}%</td>
                      <td style={{...cs,textAlign:'right',color:importeDesc>0?'#dc2626':'#9ca3af'}}>{importeDesc>0?`-S/ ${importeDesc.toFixed(2)}`:'—'}</td>
                      <td style={{...cs,textAlign:'right',fontWeight:'700'}}>S/ {totalNeto.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{marginLeft:'auto',width:'220px'}}>
              {[{l:'Base imponible:',v:`S/ ${base.toFixed(2)}`,r:false},{l:'Descuentos totales:',v:`-S/ ${totalDesc.toFixed(2)}`,r:totalDesc>0},{l:'IGV (18%):',v:`S/ ${igv.toFixed(2)}`,r:false}].map(row => (
                <div key={row.l} style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:row.r?'#dc2626':'#555',padding:'2px 0'}}>
                  <span>{row.l}</span><span>{row.v}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',fontWeight:'800',background:'#2563eb',color:'#fff',padding:'8px 10px',borderRadius:'5px',marginTop:'4px'}}>
                <span>TOTAL A PAGAR:</span><span>S/ {Number(q.total).toFixed(2)}</span>
              </div>
            </div>
            {q.note && (
              <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'5px',padding:'8px 10px',marginTop:'10px',fontSize:'10px',color:'#1e40af'}}>
                <strong>Notas / Condiciones:</strong><br/>{q.note}
              </div>
            )}
            <div style={{marginTop:'12px',paddingTop:'10px',borderTop:'1px solid #e5e7eb',fontSize:'9px',color:'#9ca3af',lineHeight:'1.6'}}>
              <strong style={{color:'#374151'}}>Condiciones generales:</strong><br/>
              • Válida hasta {expiryDate}. Pasada esta fecha no se garantizan los precios.<br/>
              • Precios incluyen IGV 18%. Sujeto a disponibilidad de stock.<br/>
              • Para confirmar citar N° <strong style={{color:'#374151'}}>{q.number}</strong>
            </div>
          </div>
        </div>
        {showPhone && (
          <div className="px-5 py-4 border-t border-green-100 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 flex-shrink-0">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">📱 Enviar cotización por WhatsApp</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">+51</span>
                <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setPhoneError('') }}
                  placeholder="999 999 999" autoFocus maxLength={9}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-100"
                  onKeyDown={e => e.key === 'Enter' && handleWhatsApp()}/>
              </div>
              <button onClick={handleWhatsApp} className="px-4 py-2.5 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600">Enviar</button>
              <button onClick={() => { setShowPhone(false); setPhone(''); setPhoneError('') }}
                className="px-3 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">✕</button>
            </div>
            {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
          </div>
        )}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-800 rounded-b-2xl">
          <div className="grid grid-cols-4 gap-2">
            <button onClick={() => setShowPhone(p => !p)} className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-xs font-semibold transition-all ${showPhone ? 'bg-green-500 text-white' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 border border-green-200 dark:border-green-800'}`}>
              <span className="text-lg">📱</span><span>WhatsApp</span>
            </button>
            <button onClick={handlePrintA4} className="flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 transition-all">
              <span className="text-lg">📄</span><span>PDF A4</span><span className="text-[10px] font-normal opacity-60">Formal</span>
            </button>
            <button onClick={handlePrint80mm} className="flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-xs font-semibold bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 transition-all">
              <span className="text-lg">🖨️</span><span>Imprimir</span><span className="text-[10px] font-normal opacity-60">80mm</span>
            </button>
            <button onClick={onClose} className="flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-xs font-semibold bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 transition-all">
              <span className="text-lg">✓</span><span>Cerrar</span>
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-slate-500 mt-2">PDF A4 = documento formal · 80mm = resumen interno</p>
        </div>
      </div>
    </div>
  )
}

// ─── Vista de solo lectura de cotización ──────────────────────────────────────
function QuotationViewModal({ q, onClose }) {
  const totalDiscount = (q.items||[]).reduce((a, i) => a + i.quantity * i.unitPrice * (i.discount||0) / 100, 0)
  const total         = (q.items||[]).reduce((a, i) => a + i.quantity * i.unitPrice * (1 - (i.discount||0) / 100), 0)
  const st            = Q_STATUS[q.status] || Q_STATUS.borrador

  const roField  = 'w-full px-3 py-2 border border-gray-100 dark:border-slate-700 rounded-lg text-sm bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-slate-200 cursor-default select-all'
  const roLabel  = 'block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              <h2 className="font-bold text-gray-800 dark:text-slate-100">Ver Cotización</h2>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
            </div>
            <p className="text-xs text-indigo-500 font-mono mt-0.5">{q.number}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Cliente y validez */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={roLabel}>Cliente</label>
              <div className={roField}>{q.clientName || 'Sin cliente'}</div>
            </div>
            <div>
              <label className={roLabel}>Válida por (días)</label>
              <div className={roField}>{q.validDays} día{q.validDays > 1 ? 's' : ''} · vence {q.expiresAt ? new Date(q.expiresAt).toLocaleDateString('es-PE') : '—'}</div>
            </div>
          </div>

          {/* Tabla de ítems */}
          {(q.items||[]).length > 0 && (
            <div className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                    <th className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-left">Producto</th>
                    <th className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-center">Cant.</th>
                    <th className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-right">P. Unit.</th>
                    <th className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-right">Subtotal</th>
                    <th className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-center">Dto.%</th>
                    <th className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-right">Imp. Desc.</th>
                    <th className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {(q.items||[]).map((item, idx) => {
                    const subtotalBruto = parseFloat((item.quantity * item.unitPrice).toFixed(2))
                    const importeDesc   = parseFloat((subtotalBruto * (item.discount||0) / 100).toFixed(2))
                    const totalNeto     = parseFloat((subtotalBruto - importeDesc).toFixed(2))
                    return (
                      <tr key={idx} className="bg-white dark:bg-slate-800">
                        <td className="px-3 py-2">
                          <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{item.productName}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">{item.unit}</p>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">{item.quantity}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-sm text-gray-500 dark:text-slate-400">{formatCurrency(item.unitPrice)}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-sm text-gray-700 dark:text-slate-200">{formatCurrency(subtotalBruto)}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-sm text-gray-600 dark:text-slate-300">{item.discount||0}%</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {importeDesc > 0
                            ? <span className="text-sm font-medium text-red-500 dark:text-red-400">-{formatCurrency(importeDesc)}</span>
                            : <span className="text-sm text-gray-300 dark:text-slate-600">—</span>
                          }
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-sm font-bold text-gray-800 dark:text-slate-100">{formatCurrency(totalNeto)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="border-t border-gray-100 dark:border-slate-700">
                {totalDiscount > 0 && (
                  <div className="flex justify-between items-center px-4 py-2 bg-red-50 dark:bg-red-900/10">
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">Descuentos aplicados</span>
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">-{formatCurrency(totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 dark:bg-slate-700/50">
                  <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">TOTAL COTIZACIÓN</span>
                  <span className="text-base font-bold text-gray-800 dark:text-slate-100">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Nota */}
          <div>
            <label className={roLabel}>Nota / Condiciones de la cotización</label>
            <div className={`${roField} min-h-[60px] whitespace-pre-wrap`}>
              {q.note || <span className="text-gray-300 dark:text-slate-600 italic">Sin notas</span>}
            </div>
          </div>

          {/* Botón cerrar */}
          <div className="pt-2">
            <button onClick={onClose}
              className="w-full py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
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
    setItems(prev => prev.map((item, i) => i === idx
      ? { ...item, [field]: field === 'quantity' ? (parseInt(val) || 1) : (parseFloat(val) || 0) }
      : item))

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  const totalDiscount = items.reduce((a, i) => a + i.quantity * i.unitPrice * (i.discount || 0) / 100, 0)
  const total    = items.reduce((a, i) => a + i.quantity * i.unitPrice * (1 - i.discount / 100), 0)
  const client   = clients.find(c => c.id === clientId)
  const expiresAt = quotation?.expiresAt || new Date(Date.now() + validDays * 86400000).toISOString()

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
      expiresAt:  new Date(Date.now() + validDays * 86400000).toISOString(),
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
                <th className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-left">Producto</th>
                <th className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-center">Cant.</th>
                <th className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-right">P. Unit.</th>
                <th className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-right">Subtotal</th>
                <th className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-center">Dto.%</th>
                <th className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-right">Imp. Desc.</th>
                <th className="text-xs font-medium text-gray-500 dark:text-slate-400 px-3 py-2 text-right">Total</th>
                <th className="px-2 py-2"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {items.map((item, idx) => {
                const subtotalBruto = parseFloat((item.quantity * item.unitPrice).toFixed(2))
                const importeDesc   = parseFloat((subtotalBruto * (item.discount || 0) / 100).toFixed(2))
                const totalNeto     = parseFloat((subtotalBruto - importeDesc).toFixed(2))
                return (
                  <tr key={idx}>
                    <td className="px-3 py-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{item.productName}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{item.unit}</p>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="1" step="1" value={item.quantity}
                        onChange={e => updateItem(idx,'quantity',e.target.value)}
                        className="w-14 text-center px-2 py-1 border border-gray-200 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-sm text-gray-500 dark:text-slate-400">{formatCurrency(item.unitPrice)}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-sm text-gray-700 dark:text-slate-200">{formatCurrency(subtotalBruto)}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <input type="number" min="0" max="100" step="1" value={item.discount}
                          onChange={e => updateItem(idx,'discount',e.target.value)}
                          className="w-12 text-center px-1.5 py-1 border border-gray-200 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                        <span className="text-xs text-gray-400 dark:text-slate-500">%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {importeDesc > 0
                        ? <span className="text-sm font-medium text-red-500 dark:text-red-400">-{formatCurrency(importeDesc)}</span>
                        : <span className="text-sm text-gray-300 dark:text-slate-600">—</span>
                      }
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-sm font-bold text-gray-800 dark:text-slate-100">{formatCurrency(totalNeto)}</span>
                    </td>
                    <td className="px-2 py-2">
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
          <div className="border-t border-gray-100 dark:border-slate-700">
            {totalDiscount > 0 && (
              <div className="flex justify-between items-center px-4 py-2 bg-red-50 dark:bg-red-900/10">
                <span className="text-xs font-medium text-red-600 dark:text-red-400">Descuentos aplicados</span>
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">-{formatCurrency(totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 dark:bg-slate-700/50">
              <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">TOTAL COTIZACIÓN</span>
              <span className="text-base font-bold text-gray-800 dark:text-slate-100">{formatCurrency(total)}</span>
            </div>
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
export default function Quotations({ onNavigate }) {
  const { products, clients, currentUser, businessConfig } = useStore()

  const [quotations, setQuotations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_quotations') || '[]') } catch { return [] }
  })

  const saveQuotations = (list) => {
    setQuotations(list)
    localStorage.setItem('pos_quotations', JSON.stringify(list))
  }

  const [modal,        setModal]        = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
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

  // ── Convertir cotización aprobada en venta en el POS ────────────────────────
  const handleConvertToSale = (q) => {
    if (q.status !== 'aprobada') {
      toast.error('Solo las cotizaciones "Aprobadas" pueden convertirse en venta')
      return
    }
    // c) No se puede convertir una cotización fuera de fecha
    if (q.expiresAt && new Date(q.expiresAt) < new Date()) {
      toast.error(`La cotización ${q.number} ha vencido (${new Date(q.expiresAt).toLocaleDateString('es-PE')}). No se puede convertir en venta.`)
      return
    }

    // a) Construir cada línea del carrito con los valores exactos de la cotización:
    //    unitPrice del momento de la cotización (no el precio actual del producto),
    //    discount en soles, subtotal = (Cant × P.Unit) - Descuento
    const cartItems = q.items.map(item => {
      const product    = products.find(p => p.id === item.productId)
      if (!product) return null
      const discountAmt = parseFloat((item.quantity * item.unitPrice * (item.discount || 0) / 100).toFixed(2))
      // subtotal DEBE ser bruto (qty × price) para que calcCartTotals no descuente dos veces.
      // El POS calcula: total = subtotal - discount. Si subtotal ya fuera neto, habría doble descuento.
      const subtotal    = parseFloat((item.quantity * item.unitPrice).toFixed(2))
      return {
        _key:        product.id,
        id:          crypto.randomUUID(),
        productId:   product.id,
        variantId:   null,
        productName: item.productName || product.name,
        barcode:     product.barcode,
        quantity:    item.quantity,
        unitPrice:   item.unitPrice,   // precio de la cotización, no el precio vigente
        discount:    discountAmt,      // monto en soles
        subtotal,                      // bruto = qty × price (el POS descuenta aparte)
        unit:        item.unit || product.unit || 'unidad',
      }
    }).filter(Boolean)

    useStore.setState({ cart: cartItems })

    // b) Nota con referencia completa: número, fecha, condiciones
    const fechaCot = new Date(q.createdAt).toLocaleDateString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
    const partes = [
      `Ref. ${q.number}`,
      `Fecha: ${fechaCot}`,
      q.clientName && q.clientName !== 'Sin cliente' ? `Cliente: ${q.clientName}` : null,
      q.note ? `Cond.: ${q.note}` : null,
    ].filter(Boolean)
    const notaReferencia = partes.join(' | ').slice(0, 200)

    localStorage.setItem('pos_pending_note', notaReferencia)

    handleStatusChange(q.id, 'convertida')
    onNavigate?.('pos')
    toast.success(`✅ ${q.number} cargada en el POS`, { duration: 4000 })
  }

  // ── Punto 6: Emitir documento de cotización ───────────────────────────────
  const handleEmitirDocumento = (q) => {
    setModal({ type: 'doc', data: q })
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
          { s:'convertida', label:'🛒 Convertida', note:'En POS' },
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
                  const canConvert = status === 'aprobada' && !expired

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

                          {/* Ver cotización (solo lectura) — solo cuando aún no está aprobada */}
                          {q.status !== 'aprobada' && (
                            <button onClick={() => setModal({ type: 'view', data: q })}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                              title="Ver cotización">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                              </svg>
                            </button>
                          )}

                          {/* Emitir documento — siempre visible */}
                          <button onClick={() => handleEmitirDocumento(q)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Emitir documento de cotización">
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

                          {/* Convertir a venta — SOLO APROBADA y no vencida */}
                          {canConvert && (
                            <button onClick={() => handleConvertToSale(q)}
                              className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                              title="Convertir en venta (pre-carga el POS)">
                              🛒 → Venta
                            </button>
                          )}

                          {/* Rechazar */}
                          {['borrador','enviada','aprobada'].includes(q.status) && (
                            <button onClick={() => setRejectTarget(q)}
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

      {rejectTarget && (
        <ConfirmModal
          title="¿Rechazar esta cotización?"
          message={`La cotización ${rejectTarget.number} de ${rejectTarget.clientName} pasará al estado "Rechazada". Esta acción no se puede deshacer.`}
          confirmLabel="Sí, rechazar"
          variant="danger"
          onConfirm={() => { handleStatusChange(rejectTarget.id, 'rechazada'); setRejectTarget(null) }}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      {modal?.type === 'view' && (
        <QuotationViewModal q={modal.data} onClose={() => setModal(null)}/>
      )}

      {modal?.type === 'doc' && (
        <QuotationDocModal q={modal.data} businessConfig={businessConfig} onClose={() => setModal(null)}/>
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
