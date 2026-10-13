/**
 * Manages the POS stock reservation lifecycle for API-enabled sessions.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { STOCK_RESERVE } from '../../../config/businessRules'
import { api, USE_API } from '../../../services/_base'

const TTL_RENEW_MS = STOCK_RESERVE.RENEW_MS

const buildItems = (cartItems) => cartItems
  .filter(item => !item.isBundle && item.stockControlUsed !== 'bundle')
  .map(item => ({ productId: item.productId, quantity: item.quantity }))

export function useStockReserve(cart) {
  const reserveIdRef = useRef(null)
  const renewTimerRef = useRef(null)
  const lastCartRef = useRef([])
  const syncReserveRef = useRef(null)
  const [conflicts, setConflicts] = useState([])

  const releaseReserve = useCallback(async () => {
    clearTimeout(renewTimerRef.current)
    lastCartRef.current = []
    setConflicts([])

    if (!USE_API || !reserveIdRef.current) return

    const id = reserveIdRef.current
    reserveIdRef.current = null

    try {
      await api.delete(`/stock-reserve/${id}`)
    } catch {
      // A timed-out or previously released reservation is already safe to ignore.
    }
  }, [])

  const syncReserve = useCallback(async (cartItems) => {
    if (!USE_API || !navigator.onLine) return

    const items = buildItems(cartItems)
    if (items.length === 0) {
      if (reserveIdRef.current) await releaseReserve()
      return
    }

    const cartKey = items.map(item => `${item.productId}:${item.quantity}`).sort().join(',')
    const lastKey = lastCartRef.current
      .map(item => `${item.productId}:${item.quantity}`)
      .sort()
      .join(',')
    if (cartKey === lastKey && reserveIdRef.current) return

    try {
      const { data } = await api.post('/stock-reserve', {
        items,
        ...(reserveIdRef.current && { reserveId: reserveIdRef.current }),
      })
      reserveIdRef.current = data.data.id
      lastCartRef.current = items
      setConflicts([])

      clearTimeout(renewTimerRef.current)
      renewTimerRef.current = setTimeout(() => {
        syncReserveRef.current?.(cartItems)
      }, TTL_RENEW_MS)
    } catch (error) {
      if (error.response?.status !== 409) return

      const stockConflicts = error.response?.data?.conflicts || []
      setConflicts(stockConflicts.map(conflict => conflict.productId))
      const message = stockConflicts.length === 1
        ? `Sin stock disponible: ${stockConflicts[0].productName} (disponible: ${stockConflicts[0].available})`
        : `${stockConflicts.length} productos sin stock disponible para reservar`
      toast.error(message, { duration: 5000, id: 'stock-reserve-conflict' })
    }
  }, [releaseReserve])

  useEffect(() => {
    syncReserveRef.current = syncReserve
  }, [syncReserve])

  useEffect(() => {
    void Promise.resolve().then(() => syncReserve(cart))
  }, [cart, syncReserve])

  useEffect(() => () => {
    clearTimeout(renewTimerRef.current)
    if (USE_API && reserveIdRef.current) {
      api.delete(`/stock-reserve/${reserveIdRef.current}`).catch(() => {})
      reserveIdRef.current = null
    }
  }, [])

  return {
    releaseReserve,
    getReserveId: () => reserveIdRef.current,
    stockConflicts: conflicts,
    hasConflicts: conflicts.length > 0,
  }
}
