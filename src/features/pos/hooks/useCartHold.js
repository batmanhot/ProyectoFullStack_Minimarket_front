/**
 * useCartHold.js — Hook para suspender y recuperar carritos
 * Ruta: src/features/pos/hooks/useCartHold.js
 *
 * Guarda snapshots del carrito activo en un array temporal (en memoria, no localStorage).
 * Cada "hold" tiene: id, label, items, cliente, timestamp.
 * El cajero puede suspender hasta 5 ventas simultáneas y recuperar cualquiera.
 */

import { useState, useCallback } from 'react'

const MAX_HOLDS = 5

export function useCartHold() {
  const [heldCarts, setHeldCarts] = useState([])

  /**
   * Suspende el carrito actual y devuelve el array actualizado.
   * @param {Array}  cart       - Ítems actuales del carrito
   * @param {string} clientName - Nombre del cliente (opcional, para el label)
   * @returns {string|null} id del hold creado, o null si el límite fue alcanzado
   */
  const holdCart = useCallback((cart, clientName = '') => {
    if (cart.length === 0) return null
    if (heldCarts.length >= MAX_HOLDS) return null

    const id    = crypto.randomUUID()
    const label = clientName
      ? `Cliente: ${clientName}`
      : `Venta #${heldCarts.length + 1}`

    const snapshot = {
      id,
      label,
      items:     structuredClone(cart),
      createdAt: new Date().toISOString(),
    }

    setHeldCarts((prev) => [...prev, snapshot])
    return id
  }, [heldCarts.length])

  /**
   * Recupera un carrito suspendido por su id y lo elimina de la cola.
   * @returns {Array|null} ítems del carrito recuperado
   */
  const recoverCart = useCallback((holdId) => {
    let recovered = null
    setHeldCarts((prev) => {
      const hold = prev.find((h) => h.id === holdId)
      if (hold) recovered = hold.items
      return prev.filter((h) => h.id !== holdId)
    })
    return recovered
  }, [])

  /** Elimina un hold sin recuperarlo */
  const discardHold = useCallback((holdId) => {
    setHeldCarts((prev) => prev.filter((h) => h.id !== holdId))
  }, [])

  return {
    heldCarts,
    holdCart,
    recoverCart,
    discardHold,
    canHold: heldCarts.length < MAX_HOLDS,
  }
}
