import { afterEach, describe, expect, it, vi } from 'vitest'
import { sanitizePrintHtml, writePrintDocument } from '../../shared/utils/print'

describe('sanitizePrintHtml', () => {
  it('elimina scripts y manejadores de eventos inyectados desde datos editables', () => {
    const html = '<!doctype html><html><body><img src="x" onerror="alert(1)"><script>alert(1)</script><p>Seguro</p></body></html>'
    const result = sanitizePrintHtml(html)

    expect(result).toContain('Seguro')
    expect(result).not.toContain('<script')
    expect(result).not.toContain('onerror')
  })

  it('conserva el marcado seguro de los comprobantes', () => {
    const result = sanitizePrintHtml('<!doctype html><html><head><style>.ticket{color:#000}</style></head><body><div class="ticket">Venta</div></body></html>')

    expect(result).toContain('class="ticket"')
    expect(result).toContain('Venta')
  })
})

describe('writePrintDocument', () => {
  afterEach(() => vi.useRealTimers())

  it('sanea el documento y conserva la impresión automática en código confiable', () => {
    vi.useFakeTimers()
    const printWindow = {
      document: document.implementation.createHTMLDocument('comprobante'),
      focus: vi.fn(),
      print: vi.fn(),
    }
    const onReady = vi.fn()

    writePrintDocument(printWindow, '<body><img src=x onerror="alert(1)"><script>alert(1)</script><p>Venta</p></body>', {
      autoPrint: true,
      onReady,
    })
    vi.advanceTimersByTime(250)

    expect(printWindow.document.body.innerHTML).toContain('Venta')
    expect(printWindow.document.body.innerHTML).not.toContain('onerror')
    expect(onReady).toHaveBeenCalledWith(printWindow)
    expect(printWindow.focus).toHaveBeenCalledOnce()
    expect(printWindow.print).toHaveBeenCalledOnce()
  })
})
