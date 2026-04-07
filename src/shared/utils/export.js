// ─── EXPORTAR EXCEL REAL con columnas y formato ────────────────────────────────
// Genera un archivo .xlsx usando HTML table que Excel abre correctamente
// con columnas separadas, encabezados formateados y colores.
export function exportToExcel(data, filename) {
  if (!data?.length) return

  const keys = Object.keys(data[0])
  const now  = new Date().toLocaleDateString('es-PE').replaceAll('/', '-')

  // Detectar columnas numéricas para alinear a la derecha
  const isNum = (v) => v !== '' && v !== null && v !== undefined && !isNaN(Number(String(v).replace(/[S/,% ]/g,'')))

  const headerRow = keys.map(k =>
    `<th style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:bold;padding:7px 10px;text-align:left;border:1px solid #163055;white-space:nowrap">${k}</th>`
  ).join('')

  const dataRows = data.map((row, ri) => {
    const bg = ri % 2 === 0 ? '#ffffff' : '#f0f4f8'
    const cells = keys.map(k => {
      const v   = row[k] ?? ''
      const num = isNum(v)
      return `<td style="background:${bg};font-size:11px;padding:5px 10px;border:1px solid #e2e8f0;text-align:${num?'right':'left'};${num?'font-weight:500;color:#1e3a5f':''}">${v}</td>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
<x:ExcelWorksheet><x:Name>Datos</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; }
  table { border-collapse: collapse; width: 100%; }
</style>
</head>
<body>
<table>
  <thead><tr>${headerRow}</tr></thead>
  <tbody>${dataRows}</tbody>
</table>
</body></html>`

  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${filename}_${now}.xls`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── EXPORTAR PDF — solo visualización, SIN print automático ─────────────────
// Abre una ventana con el documento PDF visual. El usuario elige si imprime.
export function exportToPDF(title, headers, rows, businessName = 'Mi Negocio') {
  const now    = new Date().toLocaleString('es-PE')
  const thHtml = headers.map(h =>
    `<th>${h}</th>`
  ).join('')
  const tdHtml = rows.map((row, ri) => {
    const bg = ri % 2 === 0 ? '#fff' : '#f8fafc'
    return `<tr style="background:${bg}">${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${title} — ${businessName}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#1a202c; background:#f7fafc; }
  .page { max-width:960px; margin:0 auto; background:#fff; box-shadow:0 2px 20px rgba(0,0,0,.10); min-height:100vh; }
  .header { background:linear-gradient(135deg,#1e3a5f,#2563eb); padding:24px 32px; display:flex; justify-content:space-between; align-items:flex-start; }
  .header-left h1 { font-size:18px; font-weight:800; color:#fff; margin-bottom:4px; }
  .header-left p  { font-size:12px; color:rgba(255,255,255,.65); }
  .header-right   { text-align:right; font-size:10px; color:rgba(255,255,255,.60); line-height:1.8; }
  .content { padding:24px 32px; }
  .meta { display:flex; gap:24px; margin-bottom:20px; padding:12px 16px; background:#f0f4f8; border-radius:8px; font-size:11px; }
  .meta span { color:#4a5568; } .meta strong { color:#1e3a5f; }
  table { width:100%; border-collapse:collapse; margin-top:4px; }
  thead tr { background:#1e3a5f; }
  th { padding:9px 12px; text-align:left; font-size:10px; font-weight:700; color:#fff; letter-spacing:.04em; text-transform:uppercase; }
  td { padding:7px 12px; border-bottom:1px solid #e2e8f0; font-size:11px; color:#2d3748; vertical-align:top; }
  tr:last-child td { border-bottom:none; }
  .footer { padding:16px 32px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; font-size:9px; color:#a0aec0; background:#f7fafc; }
  .print-btn { position:fixed; bottom:24px; right:24px; background:#2563eb; color:#fff; border:none; padding:12px 20px; border-radius:10px; cursor:pointer; font-size:13px; font-weight:700; box-shadow:0 4px 20px rgba(37,99,235,.4); display:flex; align-items:center; gap:8px; }
  .print-btn:hover { background:#1d4ed8; }
  .close-btn { position:fixed; bottom:24px; right:170px; background:#64748b; color:#fff; border:none; padding:12px 20px; border-radius:10px; cursor:pointer; font-size:13px; font-weight:700; }
  @media print {
    body { background:#fff; }
    .page { box-shadow:none; }
    .print-btn, .close-btn { display:none !important; }
    @page { size:A4 landscape; margin:12mm 15mm; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-left">
      <h1>${businessName}</h1>
      <p>${title}</p>
    </div>
    <div class="header-right">
      Generado: ${now}<br>
      Sistema POS · ${rows.length} registros
    </div>
  </div>
  <div class="content">
    <table>
      <thead><tr>${thHtml}</tr></thead>
      <tbody>${tdHtml}</tbody>
    </table>
  </div>
  <div class="footer">
    <span>Documento generado por Sistema POS · ${businessName}</span>
    <span>${now}</span>
  </div>
</div>
<button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
<button class="close-btn" onclick="window.close()">✕ Cerrar</button>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1024,height=700,menubar=yes,toolbar=yes,scrollbars=yes')
  if (!win) { alert('Activa las ventanas emergentes para ver el PDF'); return }
  win.document.write(html)
  win.document.close()
}
