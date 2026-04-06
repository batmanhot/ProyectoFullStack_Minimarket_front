import { useRef } from 'react'
import { useStore } from '../../../store/index'
import { formatCurrency, formatDateTime, formatDate } from '../../../shared/utils/helpers'
import { PAYMENT_METHODS } from '../../../config/app'

export default function SaleTicket({ sale, onClose }) {
  const ticketRef = useRef()
  const { businessConfig } = useStore()

  const handlePrint = () => {
    const content = ticketRef.current.innerHTML
    const win = window.open('', '_blank', 'width=320,height=650')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Ticket ${sale.invoiceNumber}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:11px;width:80mm;padding:4mm;color:#000;background:#fff}.center{text-align:center}.right{text-align:right}.bold{font-weight:bold}.divider{border:none;border-top:1px dashed #000;margin:3mm 0}.row{display:flex;justify-content:space-between;margin:1mm 0}.total-row{display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin-top:2mm}.logo{font-size:16px;font-weight:bold;letter-spacing:2px}@media print{body{width:80mm}@page{size:80mm auto;margin:0}}</style>
      </head><body>${content}<script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`)
    win.document.close()
  }

  const handleWhatsApp = () => {
    const lines = [
      `*${businessConfig?.name || 'Mi Negocio'}*`,
      businessConfig?.ruc ? `RUC: ${businessConfig.ruc}` : '',
      `Boleta: ${sale.invoiceNumber}`,
      `Fecha: ${formatDateTime(sale.createdAt)}`,
      '─────────────────',
      ...sale.items.map(i => `${i.productName}\n  ${i.quantity} x ${formatCurrency(i.unitPrice)} = ${formatCurrency(i.subtotal)}`),
      '─────────────────',
      `TOTAL: ${formatCurrency(sale.total)}`,
      ...(sale.payments?.map(p => {
        const m = PAYMENT_METHODS.find(pm => pm.value === p.method)
        return `${m?.label || p.method}: ${formatCurrency(p.amount)}${p.reference ? ` (${p.reference})` : ''}`
      }) || []),
      '',
      '¡Gracias por su compra!',
    ].filter(Boolean).join('\n')

    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank')
  }

  const baseImponible = parseFloat((sale.total / 1.18).toFixed(2))
  const igv = parseFloat((sale.total - baseImponible).toFixed(2))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Ticket de venta</h2>
          <div className="flex gap-2">
            <button onClick={handleWhatsApp} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors">
              📱 WhatsApp
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
              🖨️ Imprimir
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 flex justify-center">
          <div ref={ticketRef} style={{ fontFamily: "'Courier New',monospace", fontSize: '11px', width: '280px', padding: '8px', color: '#000', background: '#fff', border: '1px dashed #ccc' }}>
            {/* Encabezado */}
            <div className="center bold logo" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', letterSpacing: '2px', marginBottom: '2mm' }}>
              {businessConfig?.name?.toUpperCase() || 'MI NEGOCIO'}
            </div>
            {businessConfig?.ruc && <div style={{ textAlign: 'center', fontSize: '10px' }}>RUC: {businessConfig.ruc}</div>}
            {businessConfig?.address && <div style={{ textAlign: 'center', fontSize: '10px' }}>{businessConfig.address}</div>}
            {businessConfig?.phone && <div style={{ textAlign: 'center', fontSize: '10px' }}>Tel: {businessConfig.phone}</div>}

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '3mm 0' }} />
            <div style={{ fontSize: '10px', marginBottom: '1mm' }}><strong>Boleta:</strong> {sale.invoiceNumber}</div>
            <div style={{ fontSize: '10px', marginBottom: '1mm' }}><strong>Fecha:</strong> {formatDateTime(sale.createdAt)}</div>
            {sale.userName && <div style={{ fontSize: '10px', marginBottom: '1mm' }}><strong>Cajero:</strong> {sale.userName}</div>}

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '3mm 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold', marginBottom: '1mm' }}>
              <span style={{ flex: 1 }}>Producto</span>
              <span style={{ width: '40px', textAlign: 'right' }}>Cant</span>
              <span style={{ width: '50px', textAlign: 'right' }}>Total</span>
            </div>
            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '2mm 0' }} />

            {sale.items?.map((item, idx) => (
              <div key={idx} style={{ marginBottom: '2mm' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{item.productName}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                  <span>{formatCurrency(item.unitPrice)} c/u</span>
                  <span>{item.quantity} {item.unit || ''}</span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
                {item.discount > 0 && <div style={{ fontSize: '10px', color: '#888' }}>Descuento: -{formatCurrency(item.discount)}</div>}
              </div>
            ))}

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '3mm 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '1mm' }}>
              <span>Base imponible</span><span>{formatCurrency(baseImponible)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2mm' }}>
              <span>IGV (18%)</span><span>{formatCurrency(igv)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginBottom: '2mm' }}>
              <span>TOTAL</span><span>{formatCurrency(sale.total)}</span>
            </div>

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '3mm 0' }} />
            {sale.payments?.map((p, idx) => {
              const m = PAYMENT_METHODS.find(pm => pm.value === p.method)
              return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '1mm' }}>
                  <span>{m?.icon} {m?.label || p.method}{p.reference ? ` (${p.reference})` : ''}</span>
                  <span>{formatCurrency(p.amount)}</span>
                </div>
              )
            })}
            {(sale.change > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '1mm' }}>
                <span>Vuelto</span><span>{formatCurrency(sale.change)}</span>
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '3mm 0' }} />
            <div style={{ textAlign: 'center', fontSize: '10px' }}>
              ¡Gracias por su compra!<br />Conserve este comprobante<br />{formatDate(sale.createdAt)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
