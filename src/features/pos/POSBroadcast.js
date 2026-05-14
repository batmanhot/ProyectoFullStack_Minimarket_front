/**
 * POSBroadcast.js — Hook para emitir eventos al CustomerDisplay
 * Ruta: src/features/pos/POSBroadcast.js
 *
 * ARCHIVO NUEVO — Integración mínima en POS.jsx:
 *
 *   import { usePOSBroadcast } from './POSBroadcast'
 *
 *   // Dentro del componente POS:
 *   const { broadcast, openDisplay } = usePOSBroadcast()
 *
 *   // Cada vez que cambia el carrito:
 *   useEffect(() => {
 *     broadcast('CART_UPDATE', { cart: mergedCartItems, businessConfig })
 *   }, [mergedCartItems])
 *
 *   // Al completar venta:
 *   broadcast('SALE_COMPLETE', { sale: { total, change, invoiceNumber } })
 *
 *   // Botón para abrir pantalla del cliente:
 *   <button onClick={openDisplay}>📺 Pantalla cliente</button>
 */

import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../../store/index'

const CHANNEL_NAME = 'pos_customer_display'

/**
 * usePOSBroadcast — Hook que maneja el canal de comunicación con el CustomerDisplay.
 * Devuelve funciones para emitir eventos y abrir la pantalla del cliente.
 */
export function usePOSBroadcast() {
  const channelRef = useRef(null)
  const { businessConfig } = useStore()

  // Inicializar el canal al montar
  useEffect(() => {
    try {
      channelRef.current = new BroadcastChannel(CHANNEL_NAME)
    } catch {
      // BroadcastChannel no disponible (contexto inseguro o browser antiguo)
      channelRef.current = null
    }
    return () => {
      channelRef.current?.close()
    }
  }, [])

  /**
   * broadcast — Emite un evento al canal.
   * @param {string} type  — Tipo de evento: CART_UPDATE | CART_CLEAR | SALE_COMPLETE | PING
   * @param {object} data  — Datos adicionales del evento
   */
  const broadcast = useCallback((type, data = {}) => {
    if (!channelRef.current) return
    try {
      channelRef.current.postMessage({
        type,
        businessConfig,
        ts: Date.now(),
        ...data,
      })
    } catch {
      // Silencioso — no crítico
    }
  }, [businessConfig])

  /**
   * openDisplay — Abre la ventana del CustomerDisplay.
   * Intenta abrir en una nueva ventana (ideal para segundo monitor).
   */
  const openDisplay = useCallback(() => {
    // Construir URL de la pantalla del cliente
    const base = window.location.href.split('#')[0].split('?')[0]
    const url  = base.includes('localhost')
      ? `${window.location.origin}/#customer-display`
      : `${window.location.href.split('#')[0]}#customer-display`

    const win = window.open(
      url,
      'pos_customer_display_window',
      [
        'width=1024',
        'height=768',
        'menubar=no',
        'toolbar=no',
        'location=no',
        'status=no',
        'scrollbars=no',
        'resizable=yes',
      ].join(',')
    )

    if (!win) {
      alert(
        'No se pudo abrir la pantalla del cliente.\n' +
        'Por favor activa las ventanas emergentes en tu navegador\n' +
        'e intenta nuevamente.'
      )
      return null
    }

    // Enviar ping inicial con businessConfig
    setTimeout(() => broadcast('PING', {}), 800)

    return win
  }, [broadcast])

  return { broadcast, openDisplay }
}

/**
 * buildCartForDisplay — Prepara el carrito para enviarlo al CustomerDisplay.
 * Incluye información de lotes asignados, descuentos y precios.
 */
export function buildCartForDisplay(mergedCartItems, products) {
  return mergedCartItems.map(item => {
    const product = products?.find(p => p.id === item.productId)
    return {
      productId:        item.productId,
      productName:      item.productName || item.name,
      quantity:         item.quantity,
      unit:             item.unit || 'u',
      unitPrice:        item.unitPrice || item.priceSell,
      totalDiscount:    item.totalDiscount || 0,
      netTotal:         item.netTotal !== undefined ? item.netTotal : item.quantity * (item.unitPrice || item.priceSell),
      discountDetails:  item.discountDetails || [],
      batchAllocations: item.batchAllocations || [],
      imageUrl:         product?.imageUrl || item.imageUrl || null,
    }
  })
}
