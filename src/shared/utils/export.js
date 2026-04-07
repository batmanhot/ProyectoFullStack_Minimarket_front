// ─── EXPORTAR CSV con BOM para Excel correcto ─────────────────────────────────
export function exportToExcel(data, filename, sheetName = 'Datos') {
  if (!data?.length) return
  const keys    = Object.keys(data[0])
  const header  = keys.join('\t')
  const rows    = data.map(row => keys.map(k => {
    const v = row[k] ?? ''
    return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
  }).join('\t'))
  const content = '\uFEFF' + [header, ...rows].join('\n')
  const blob    = new Blob([content], { type: 'text/tab-separated-values;charset=utf-8;' })
  const url     = URL.createObjectURL(blob)
  const a       = document.createElement('a')
  const now     = new Date().toLocaleDateString('es-PE').replaceAll('/', '-')
  a.href        = url
  a.download    = `${filename}_${now}.xls`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── EXPORTAR PDF vía ventana de impresión ─────────────────────────────────────
export function exportToPDF(title, headers, rows, businessName = 'Mi Negocio') {
  const now    = new Date().toLocaleString('es-PE')
  const thHtml = headers.map(h => `<th>${h}</th>`).join('')
  const tdHtml = rows.map(row =>
    `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`
  ).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 10px; }
  .company { font-size: 16px; font-weight: bold; }
  .meta { text-align: right; font-size: 10px; color: #666; }
  h2 { font-size: 14px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e3a5f; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
  tr:nth-child(even) td { background: #f8f9fa; }
  .footer { margin-top: 16px; font-size: 9px; color: #999; text-align: center; }
  @page { size: A4 landscape; margin: 15mm; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <div><div class="company">${businessName}</div><h2>${title}</h2></div>
    <div class="meta">Generado: ${now}<br>Sistema POS Demo</div>
  </div>
  <table>
    <thead><tr>${thHtml}</tr></thead>
    <tbody>${tdHtml}</tbody>
  </table>
  <div class="footer">Documento generado automáticamente por el Sistema POS · ${businessName}</div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=600')
  if (!win) return
  win.document.write(html)
  win.document.close()
}
