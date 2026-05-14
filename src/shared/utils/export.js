/**
 * export.js — Utilidades de exportación v2
 * Ruta: src/shared/utils/export.js
 *
 * MEJORAS vs v1:
 *  exportToExcel → sin cambios (ya funciona bien)
 *  exportToPDF   → encabezado con logo + RUC + dirección del negocio,
 *                  tabla con estilos más limpios, pie de página con número de página,
 *                  fecha/usuario en el footer, subtotales automáticos para columnas numéricas,
 *                  exportToPDFAdvanced() para reportes con múltiples secciones
 */

// ─── EXPORTAR EXCEL (sin cambios — ya funciona) ───────────────────────────────
function createExcelBlob(data) {
  if (!data?.length) return

  const keys = Object.keys(data[0])
  const isNum = (v) => v !== '' && v !== null && v !== undefined && !isNaN(Number(String(v).replace(/[S/,% ]/g, '')))

  const headerRow = keys.map((k) =>
    `<th style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:bold;padding:7px 10px;text-align:left;border:1px solid #163055;white-space:nowrap">${k}</th>`
  ).join('')

  const dataRows = data.map((row, ri) => {
    const bg    = ri % 2 === 0 ? '#ffffff' : '#f0f4f8'
    const cells = keys.map((k) => {
      const v   = row[k] ?? ''
      const num = isNum(v)
      return `<td style="background:${bg};font-size:11px;padding:5px 10px;border:1px solid #e2e8f0;text-align:${num ? 'right' : 'left'};${num ? 'font-weight:500;color:#1e3a5f' : ''}">${v}</td>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Datos</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>body{font-family:Calibri,Arial,sans-serif;}table{border-collapse:collapse;width:100%;}</style></head>
<body><table><thead><tr>${headerRow}</tr></thead><tbody>${dataRows}</tbody></table></body></html>`

  return new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
}

export function downloadExcel(data, filename) {
  const blob = createExcelBlob(data)
  if (!blob) return

  const now  = new Date().toLocaleDateString('es-PE').replaceAll('/', '-')
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `${filename}_${now}.xls`
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

export function exportToExcel(data, filename, options = {}) {
  if (!data?.length) return
  if (options.preview === false) {
    downloadExcel(data, filename)
    return
  }

  window.dispatchEvent(new CustomEvent('excel-preview', {
    detail: {
      rows: data,
      filename,
      title: options.title || filename,
    },
  }))
}

// ─── EXPORTAR PDF — versión mejorada ─────────────────────────────────────────
/**
 * @param {string} title           - Título del reporte
 * @param {string[]} headers       - Encabezados de columnas
 * @param {Array[]} rows           - Filas de datos
 * @param {string} businessName    - Nombre del negocio
 * @param {Object} businessConfig  - { ruc, address, phone, logoUrl } (opcional)
 * @param {string} userName        - Usuario que generó el reporte (opcional)
 * @param {Object} options         - { showTotals, orientation }
 */
export function exportToPDF(
  title,
  headers,
  rows,
  businessName = 'Mi Negocio',
  businessConfig = {},
  userName = '',
  options = {}
) {
  const now         = new Date().toLocaleString('es-PE')
  const nowDate     = new Date().toLocaleDateString('es-PE')
  const orientation = options.orientation || 'landscape'
  const showTotals  = options.showTotals !== false

  // ── Detectar columnas numéricas para subtotales ───────────────────────────
  const numericCols = headers.map((_, ci) =>
    rows.every((r) => {
      const v = String(r[ci] ?? '')
      return v === '—' || v === '' || !isNaN(Number(v.replace(/[S/,% ]/g, '')))
    })
  )

  // ── Calcular totales por columna numérica ─────────────────────────────────
  const colTotals = headers.map((_, ci) => {
    if (!numericCols[ci] || !showTotals) return null
    const sum = rows.reduce((acc, r) => {
      const raw = String(r[ci] ?? '').replace(/[S/, ]/g, '')
      const n   = parseFloat(raw)
      return isNaN(n) ? acc : acc + n
    }, 0)
    return sum !== 0 ? `S/ ${sum.toFixed(2)}` : null
  })
  const hasTotals = colTotals.some((t) => t !== null)

  // ── Filas de la tabla ─────────────────────────────────────────────────────
  const thHtml = headers.map((h, i) =>
    `<th style="text-align:${numericCols[i] ? 'right' : 'left'}">${h}</th>`
  ).join('')

  const tdHtml = rows.map((row, ri) => {
    const bg = ri % 2 === 0 ? '#fff' : '#f8fafc'
    const cells = row.map((cell, ci) =>
      `<td style="text-align:${numericCols[ci] ? 'right' : 'left'};${numericCols[ci] ? 'font-variant-numeric:tabular-nums' : ''}">${cell ?? '—'}</td>`
    ).join('')
    return `<tr style="background:${bg}">${cells}</tr>`
  }).join('')

  const totalRowHtml = hasTotals
    ? `<tr class="total-row">${colTotals.map((t, i) =>
        `<td style="text-align:${numericCols[i] ? 'right' : 'left'};font-weight:bold">${t !== null ? t : (i === 0 ? `TOTAL (${rows.length} registros)` : '')}</td>`
      ).join('')}</tr>`
    : ''

  // ── Logo del negocio ──────────────────────────────────────────────────────
  const logoHtml = businessConfig.logoUrl
    ? `<img src="${businessConfig.logoUrl}" style="height:48px;object-fit:contain;filter:brightness(0) invert(1)" onerror="this.style.display='none'">`
    : `<div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px">${(businessName || 'MN').substring(0,2).toUpperCase()}</div>`

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${title} — ${businessName}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#1a202c; background:#f7fafc; }
  .page { max-width:${orientation==='landscape'?'1100px':'760px'}; margin:0 auto; background:#fff; box-shadow:0 2px 20px rgba(0,0,0,.1); min-height:100vh; display:flex; flex-direction:column; }

  /* Header */
  .header { background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%); padding:20px 28px; display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
  .header-logo { width:52px; height:52px; background:rgba(255,255,255,.15); border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }
  .header-info { flex:1; }
  .header-info h1 { font-size:14px; font-weight:800; color:#fff; letter-spacing:.3px; }
  .header-info .biz { font-size:11px; color:rgba(255,255,255,.75); margin-top:1px; }
  .header-info .meta { display:flex; flex-wrap:wrap; gap:12px; margin-top:6px; font-size:10px; color:rgba(255,255,255,.6); }
  .header-right { text-align:right; font-size:10px; color:rgba(255,255,255,.65); line-height:1.8; flex-shrink:0; }
  .badge { display:inline-block; background:rgba(255,255,255,.2); border-radius:20px; padding:2px 10px; font-size:10px; color:#fff; font-weight:600; margin-top:4px; }

  /* Content */
  .content { padding:20px 28px; flex:1; }
  .report-info { display:flex; gap:16px; margin-bottom:14px; padding:10px 14px; background:#f0f5ff; border-radius:8px; border-left:3px solid #2563eb; font-size:10px; }
  .report-info strong { color:#1e3a5f; }

  /* Table */
  table { width:100%; border-collapse:collapse; font-size:10.5px; }
  thead tr { background:#1e3a5f; }
  th { padding:8px 10px; text-align:left; font-size:9.5px; font-weight:700; color:#fff; letter-spacing:.05em; text-transform:uppercase; white-space:nowrap; }
  td { padding:6px 10px; border-bottom:1px solid #e8edf5; color:#2d3748; vertical-align:top; }
  tr:last-child td { border-bottom:none; }
  tr:hover td { background:#f7fbff; }
  .total-row td { background:#1e3a5f !important; color:#fff !important; font-size:11px; padding:8px 10px; }

  /* Footer */
  .footer { padding:12px 28px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; font-size:9px; color:#a0aec0; background:#f7fafc; }
  .footer-left { display:flex; flex-direction:column; gap:2px; }

  @media print {
    body { background:#fff; }
    .page { box-shadow:none; max-width:100%; }
    .fab-group { display:none !important; }
    @page { size:A4 ${orientation}; margin:10mm 12mm; }
  }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="header-logo">${logoHtml}</div>
    <div class="header-info">
      <h1>${title}</h1>
      <div class="biz">${businessName}</div>
      <div class="meta">
        ${businessConfig.ruc     ? `<span>RUC: <strong>${businessConfig.ruc}</strong></span>` : ''}
        ${businessConfig.address ? `<span>📍 ${businessConfig.address}</span>` : ''}
        ${businessConfig.phone   ? `<span>📞 ${businessConfig.phone}</span>` : ''}
      </div>
    </div>
    <div class="header-right">
      <div>Generado: ${now}</div>
      ${userName ? `<div>Por: ${userName}</div>` : ''}
      <div class="badge">📊 ${rows.length} registros</div>
    </div>
  </div>

  <!-- Content -->
  <div class="content">
    <div class="report-info">
      <span>📅 Fecha: <strong>${nowDate}</strong></span>
      <span>📋 Reporte: <strong>${title}</strong></span>
      <span>📦 Total registros: <strong>${rows.length}</strong></span>
      ${userName ? `<span>👤 Generado por: <strong>${userName}</strong></span>` : ''}
    </div>
    <table>
      <thead><tr>${thHtml}</tr></thead>
      <tbody>
        ${tdHtml}
        ${totalRowHtml}
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <span>Sistema POS · ${businessName}${businessConfig.ruc ? ` · RUC ${businessConfig.ruc}` : ''}</span>
      <span>Documento generado el ${now}</span>
    </div>
    <span>Pág. 1 de 1</span>
  </div>
</div>

</body>
</html>`

  window.dispatchEvent(new CustomEvent('pdf-preview', { detail: { html, title } }))
}

/**
 * exportToPDFAdvanced — Para reportes con múltiples secciones o KPIs destacados.
 * @param {string} title
 * @param {Object[]} sections  - [{ subtitle, headers, rows, kpis: [{label, value}] }]
 * @param {Object} businessConfig
 * @param {string} userName
 */
export function exportToPDFAdvanced(title, sections = [], businessConfig = {}, userName = '') {
  const businessName = businessConfig.name || 'Mi Negocio'
  const now          = new Date().toLocaleString('es-PE')

  const sectionsHtml = sections.map((section) => {
    const kpisHtml = section.kpis?.length
      ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
           ${section.kpis.map((k) =>
             `<div style="background:#f0f5ff;border:1px solid #c3d9ff;border-radius:8px;padding:10px 16px;flex:1;min-width:120px">
                <div style="font-size:9px;color:#4a6fa5;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">${k.label}</div>
                <div style="font-size:16px;font-weight:800;color:#1e3a5f">${k.value}</div>
              </div>`
           ).join('')}
         </div>`
      : ''

    const thHtml = section.headers.map((h) => `<th>${h}</th>`).join('')
    const tdHtml = section.rows.map((row, ri) => {
      const bg = ri % 2 === 0 ? '#fff' : '#f8fafc'
      return `<tr style="background:${bg}">${row.map((c) => `<td>${c ?? '—'}</td>`).join('')}</tr>`
    }).join('')

    return `
      ${section.subtitle ? `<h2 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:20px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">${section.subtitle}</h2>` : ''}
      ${kpisHtml}
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:24px">
        <thead><tr style="background:#1e3a5f">${thHtml}</tr></thead>
        <tbody>${tdHtml}</tbody>
      </table>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${title}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#1a202c;background:#f7fafc;}
  .page{max-width:1100px;margin:0 auto;background:#fff;min-height:100vh;}
  .header{background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:20px 28px;display:flex;justify-content:space-between;align-items:center;}
  .header h1{font-size:16px;font-weight:800;color:#fff;}
  .header p{font-size:10px;color:rgba(255,255,255,.7);margin-top:3px;}
  .header-right{text-align:right;font-size:10px;color:rgba(255,255,255,.65);}
  .content{padding:24px 28px;}
  th{padding:8px 10px;text-align:left;font-size:9.5px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.05em;}
  td{padding:6px 10px;border-bottom:1px solid #e8edf5;}
  .footer{padding:12px 28px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#a0aec0;background:#f7fafc;}
  @media print{@page{size:A4 landscape;margin:10mm 12mm;}}
</style></head>
<body><div class="page">
  <div class="header">
    <div><h1>${title}</h1><p>${businessName}${businessConfig.ruc ? ` · RUC ${businessConfig.ruc}` : ''}</p></div>
    <div class="header-right"><div>${now}</div>${userName ? `<div>${userName}</div>` : ''}</div>
  </div>
  <div class="content">${sectionsHtml}</div>
  <div class="footer"><span>Sistema POS · ${businessName}</span><span>${now}</span></div>
</div>
</body></html>`

  window.dispatchEvent(new CustomEvent('pdf-preview', { detail: { html, title } }))
}
