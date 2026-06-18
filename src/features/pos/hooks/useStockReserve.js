/**
 * useStockReserve.js
 * Hook que gestiona la reserva de stock multi-caja para el POS.
 *
 * Comportamiento:
 *  - Al cambiar el carrito (addToCart, updateCartItem, removeFromCart)
 *    envía POST /api/stock-reserve con los ítems actuales.
 *  - La reserva se renueva (mismo reserveId) mientras el cajero sigue
 *    en el mismo carrito — el TTL de 10 min se reinicia con cada cambio.
 *  - Al completar o cancelar la venta, llama a releaseReserve() que
 *    hace DELETE /api/stock-reserve/:id.
 *  - Si el backend devuelve 409 (conflicto de stock), muestra un toast
 *    con el detalle y marca los productos afectados.
 *  - En modo offline o USE_API=false, no hace nada (no bloquea el flujo).
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import { api, USE_API } from '../../../services/_base'
import { STOCK_RESERVE } from '../../../config/businessRules'
import toast from 'react-hot-toast'

const TTL_RENEW_MS = STOCK_RESERVE.RENEW_MS

export function useStockReserve(cart) {
  const reserveIdRef   = useRef(null)   // ID de la reserva activa en el backend
  const renewTimerRef  = useRef(null)   // Timer de renovación automática
  const lastCartRef    = useRef([])     // Último carrito enviado (evita calls redundantes)
  const [conflicts, setConflicts] = useState([])  // productIds con conflicto de stock

  // ── Construir payload de ítems desde el carrito ───────────────────────────
  const buildItems = (cartItems) =>
    cartItems
      .filter(i => !i.isBundle && i.stockControlUsed !== 'bundle')
      .map(i => ({ productId: i.productId, quantity: i.quantity }))

  // ── Enviar/renovar reserva al backend ─────────────────────────────────────
  const syncReserve = useCallback(async (cartItems) => {
    if (!USE_API || !navigator.onLine) return

    const items = buildItems(cartItems)
    if (items.length === 0) {
      // Carrito vacío — liberar reserva existente si la hay
      if (reserveIdRef.current) {
        await releaseReserve()
      }
      return
    }

    // Evitar llamada redundante si el carrito no cambió
    const cartKey = items.map(i => `${i.productId}:${i.quantity}`).sort().join(',')
    const lastKey = lastCartRef.current.map(i => `${i.productId}:${i.quantity}`).sort().join(',')
    if (cartKey === lastKey && reserveIdRef.current) return

    try {
      const payload = {
        items,
        ...(reserveIdRef.current && { reserveId: reserveIdRef.current }),
      }
      const { data } = await api.post('/stock-reserve', payload)
      reserveIdRef.current = data.data.id
      lastCartRef.current  = items
      setConflicts([])  // Limpiar conflictos anteriores si la reserva fue exitosa

      // Programar renovación automática antes de que expire el TTL
      clearTimeout(renewTimerRef.current)
      renewTimerRef.current = setTimeout(() => {
        syncReserve(cartItems)
      }, TTL_RENEW_MS)

    } catch (err) {
      if (err.response?.status === 409) {
        // Conflicto: uno o más productos sin stock disponible
        const conflicts = err.response?.data?.conflicts || []
        setConflicts(conflicts.map(c => c.productId))

        const msg = conflicts.length === 1
          ? `Sin stock disponible: ${conflicts[0].productName} (disponible: ${conflicts[0].available})`
          : `${conflicts.length} productos sin stock disponible para reservar`

        toast.error(msg, { duration: 5000, id: 'stock-reserve-conflict' })
      }
      // Otros errores de red: no bloquear el flujo del POS
    }
  }, [])

  // ── Liberar reserva (completar o cancelar venta) ──────────────────────────
  const releaseReserve = useCallback(async () => {
    clearTimeout(renewTimerRef.current)
    lastCartRef.current = []
    setConflicts([])

    if (!USE_API || !reserveIdRef.current) return

    const id = reserveIdRef.current
    reserveIdRef.current = null

    try {
      await api.delete(`/stock-reserve/${id}`)
    } catch (_) {
      // Si ya expiró o fue liberada, ignorar el error
    }
  }, [])

  // ── Sincronizar cuando cambia el carrito ──────────────────────────────────
  useEffect(() => {
    syncReserve(cart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart])

  // ── Limpiar al desmontar el POS ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimeout(renewTimerRef.current)
      // Liberar silenciosamente al desmontar (sin await — fire and forget)
      if (USE_API && reserveIdRef.current) {
        api.delete(`/stock-reserve/${reserveIdRef.current}`).catch(() => {})
        reserveIdRef.current = null
      }
    }
  }, [])

  return {
    releaseReserve,
    reserveId:       reserveIdRef,
    stockConflicts:  conflicts,    // productIds con conflicto — útil para resaltar en el carrito
    hasConflicts:    conflicts.length > 0,
  }
}
