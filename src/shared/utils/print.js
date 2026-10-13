import DOMPurify from 'dompurify'

/**
 * Los comprobantes se generan en una ventana aislada para impresión. Todos los
 * datos del negocio, clientes y productos son editables, por lo que nunca se
 * deben escribir como HTML sin sanear.
 */
export function sanitizePrintHtml(html) {
  return DOMPurify.sanitize(String(html ?? ''), {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: [/^on/i],
  })
}

export function writePrintDocument(printWindow, html, { autoPrint = false, onReady } = {}) {
  if (!printWindow) return false

  printWindow.document.open()
  printWindow.document.write(sanitizePrintHtml(html))
  printWindow.document.close()
  onReady?.(printWindow)

  if (autoPrint) {
    // No se permiten scripts embebidos: el diálogo se activa desde código confiable.
    window.setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 250)
  }
  return true
}
