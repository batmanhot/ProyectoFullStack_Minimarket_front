/**
 * CustomerDisplay.jsx — Pantalla del cliente (segundo monitor / segunda ventana)
 * Ruta: src/features/pos/CustomerDisplay.jsx
 *
 * ARCHIVO NUEVO — No modifica ningún archivo existente.
 *
 * FUNCIONAMIENTO:
 *  - El POS emite eventos via BroadcastChannel('pos_customer_display')
 *  - Esta pantalla los recibe y muestra en tiempo real
 *  - Se abre como segunda ventana con: window.open('/customer-display', '_blank', 'fullscreen=yes')
 *  - Compatible con segundo monitor físico o tablet del cliente
 *
 * INTEGRACIÓN EN POS.jsx (una sola línea):
 *  import { broadcastToCustomerDisplay } from './CustomerDisplay'
 *  // Llamar en handleAddToCart, handleRemoveItem, handleClearCart, handleCompleteSale
 *
 * INTEGRACIÓN EN App.jsx:
 *  import CustomerDisplay from './features/pos/CustomerDisplay'
 *  // Agregar ruta: 'customer-display': CustomerDisplay
 *  // No requiere autenticación — es pantalla pública
 */

import { useEffect, useState, useRef } from 'react'
import { formatCurrency } from '../../shared/utils/helpers'

// ─── Canal de comunicación ────────────────────────────────────────────────────
const CHANNEL_NAME = 'pos_customer_display'

/**
 * broadcastToCustomerDisplay — Emite eventos al canal.
 * Llamar desde POS.jsx cada vez que cambia el carrito.
 */
export function broadcastToCustomerDisplay(event) {
  try {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage({ ...event, ts: Date.now() })
    channel.close()
  } catch {
    // BroadcastChannel no disponible en este browser
  }
}

/**
 * openCustomerDisplay — Abre la ventana del cliente.
 * Llamar desde un botón en el POS.
 */
export function openCustomerDisplay() {
  const url = window.location.pathname.replace(/\/[^/]*$/, '/customer-display')
  const win = window.open(
    url,
    'customer_display',
    'width=800,height=600,menubar=no,toolbar=no,location=no,status=no'
  )
  if (!win) {
    alert('Activa las ventanas emergentes para abrir la pantalla del cliente')
  }
  return win
}

// ─── COMPONENTE — Pantalla del cliente ───────────────────────────────────────
export default function CustomerDisplay() {
  const [cart,          setCart]          = useState([])
  const [businessConfig,setBusinessConfig]= useState({})
  const [sale,          setSale]          = useState(null)  // venta completada
  const [lastEvent,     setLastEvent]     = useState(null)
  const [connected,     setConnected]     = useState(false)
  const channelRef = useRef(null)

  useEffect(() => {
    // Poner el título de la ventana
    document.title = 'Pantalla del Cliente'

    try {
      channelRef.current = new BroadcastChannel(CHANNEL_NAME)
      setConnected(true)

      channelRef.current.onmessage = (evt) => {
        const msg = evt.data
        setLastEvent(msg)

        switch (msg.type) {
          case 'CART_UPDATE':
            setCart(msg.cart || [])
            setBusinessConfig(msg.businessConfig || {})
            setSale(null)
            break
          case 'CART_CLEAR':
            setCart([])
            setSale(null)
            break
          case 'SALE_COMPLETE':
            setSale(msg.sale)
            setCart([])
            // Volver a idle después de 6 segundos
            setTimeout(() => setSale(null), 6000)
            break
          case 'PING':
            setBusinessConfig(msg.businessConfig || {})
            break
          default:
            break
        }
      }
    } catch {
      setConnected(false)
    }

    return () => {
      channelRef.current?.close()
    }
  }, [])

  // Cálculos del carrito
  const subtotal = cart.reduce((a, item) => a + (item.netTotal || item.quantity * item.unitPrice), 0)
  const descuentos = cart.reduce((a, item) => a + (item.totalDiscount || 0), 0)
  const total    = cart.reduce((a, item) => {
    const net = item.netTotal !== undefined ? item.netTotal : item.quantity * item.unitPrice
    return a + net
  }, 0)

  // ── PANTALLA DE VENTA COMPLETADA ────────────────────────────────────────────
  if (sale) {
    return (
      <div className="min-h-screen bg-green-600 flex flex-col items-center justify-center p-8" style={{colorScheme:'light'}}>
        <div className="text-center">
          <div className="text-8xl mb-6">✅</div>
          <h1 className="text-4xl font-black text-white mb-2">¡Gracias por su compra!</h1>
          <p className="text-green-200 text-xl mb-8">{businessConfig?.name || 'Mi Negocio'}</p>
          <div className="bg-white rounded-3xl p-8 shadow-2xl min-w-64">
            <p className="text-gray-500 text-sm mb-2">Total pagado</p>
            <p className="text-5xl font-black text-green-600">{formatCurrency(sale.total)}</p>
            {sale.change > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-gray-500 text-sm">Su vuelto</p>
                <p className="text-3xl font-bold text-blue-600">{formatCurrency(sale.change)}</p>
              </div>
            )}
          </div>
          <p className="text-green-200 text-sm mt-6">Comprobante: {sale.invoiceNumber}</p>
        </div>
      </div>
    )
  }

  // ── PANTALLA IDLE (sin carrito) ─────────────────────────────────────────────
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center p-8" style={{colorScheme:'light'}}>
        <div className="text-center">
          {businessConfig?.logoUrl && (
            <img src={businessConfig.logoUrl} alt="Logo"
              className="max-h-24 max-w-48 object-contain mx-auto mb-6"
              onError={e => e.target.style.display='none'}/>
          )}
          <h1 className="text-5xl font-black text-white mb-3">
            {businessConfig?.name || 'Mi Negocio'}
          </h1>
          <p className="text-blue-200 text-xl mb-8">Bienvenido · Welcome</p>
          <div className="bg-white/10 backdrop-blur rounded-2xl px-8 py-4 text-white">
            <p className="text-blue-100 text-lg">Esperando artículos...</p>
          </div>
          {!connected && (
            <p className="text-blue-300 text-sm mt-8">
              ⚠️ Sin conexión al POS — abre esta ventana desde el Punto de Venta
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── PANTALLA ACTIVA — Carrito en tiempo real ────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{colorScheme:'light'}}>

      {/* Header */}
      <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {businessConfig?.logoUrl && (
            <img src={businessConfig.logoUrl} alt="Logo"
              className="max-h-10 max-w-32 object-contain"
              onError={e => e.target.style.display='none'}/>
          )}
          <div>
            <p className="font-bold text-lg">{businessConfig?.name || 'Mi Negocio'}</p>
            {businessConfig?.ruc && <p className="text-blue-200 text-xs">RUC: {businessConfig.ruc}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-blue-200 text-xs">Pantalla del cliente</p>
          <p className="text-white text-sm font-medium">{new Date().toLocaleTimeString('es-PE')}</p>
        </div>
      </div>

      {/* Lista de artículos */}
      <div className="flex-1 overflow-y-auto p-4">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b-2 border-gray-200">
              <th className="pb-2 text-xs font-bold text-gray-500 uppercase tracking-wide">Artículo</th>
              <th className="pb-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">Cant.</th>
              <th className="pb-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">P. Unit.</th>
              <th className="pb-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cart.map((item, idx) => {
              const netTotal    = item.netTotal !== undefined ? item.netTotal : item.quantity * item.unitPrice
              const hasDiscount = (item.totalDiscount || 0) > 0
              return (
                <tr key={idx} className={`${idx === cart.length - 1 ? 'bg-blue-50 animate-pulse' : ''}`}>
                  <td className="py-3 pr-4">
                    <div className="flex items-start gap-2">
                      {/* Imagen del producto si existe */}
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0"
                          onError={e => e.target.style.display='none'}/>
                      )}
                      <div>
                        <p className={`font-semibold text-gray-800 ${idx === cart.length - 1 ? 'text-blue-700' : ''}`}>
                          {item.productName}
                        </p>
                        {/* Info de lote asignado (FEFO/FIFO) */}
                        {item.batchAllocations?.length > 0 && (
                          <p className="text-xs text-gray-400">
                            Lote: {item.batchAllocations.map(b => b.batchNumber).join(', ')}
                            {item.batchAllocations[0]?.expiryDate && ` · Vence: ${item.batchAllocations[0].expiryDate}`}
                          </p>
                        )}
                        {/* Descuentos aplicados */}
                        {hasDiscount && (
                          <div className="flex gap-1 flex-wrap mt-0.5">
                            {item.discountDetails?.map((d, i) => (
                              <span key={i} className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                                {d.icon} {d.label} -{formatCurrency(d.amount)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-right text-gray-600 font-medium">
                    {item.quantity} {item.unit || 'u'}
                  </td>
                  <td className="py-3 text-right text-gray-500 text-sm">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="py-3 text-right font-bold">
                    {hasDiscount ? (
                      <div>
                        <span className="text-gray-400 line-through text-xs block">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </span>
                        <span className="text-green-600">{formatCurrency(netTotal)}</span>
                      </div>
                    ) : (
                      <span className="text-gray-800">{formatCurrency(netTotal)}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer — Total prominente */}
      <div className="bg-white border-t-2 border-gray-200 p-6">
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            {descuentos > 0 && (
              <>
                <div className="flex justify-between gap-8 text-sm text-gray-500">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal + descuentos)}</span>
                </div>
                <div className="flex justify-between gap-8 text-sm text-green-600 font-medium">
                  <span>🎉 Descuentos:</span>
                  <span>-{formatCurrency(descuentos)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between gap-8 text-xs text-gray-400">
              <span>{cart.length} artículo{cart.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 mb-1">TOTAL A PAGAR</p>
            <p className="text-5xl font-black text-blue-700">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
