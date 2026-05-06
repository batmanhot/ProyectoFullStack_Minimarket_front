/**
 * useCartHold.js — Store de Zustand para ventas en espera
 * Ruta: src/features/pos/hooks/useCartHold.js
 *
 * CORRECCIÓN v2: migrado de useState (local, inestable entre renders)
 * a un mini-store de Zustand sin persistencia.
 *
 * Por qué Zustand y no useState:
 *   - useState en un hook crea estado LOCAL al componente.
 *     Cuando POS re-renderiza, el updater de recoverCart se ejecuta
 *     en un batch con setState del carrito, causando que el valor
 *     recuperado sea null antes de que el hold se elimine del array.
 *   - Zustand es síncrono: getState() devuelve el valor inmediato,
 *     sin esperar el próximo ciclo de render.
 *
 * No se incluye en persist → los holds se pierden al recargar (comportamiento correcto).
 */

import { create } from 'zustand'

const MAX_HOLDS = 5

// Mini-store independiente — no se persiste en localStorage
const useHoldStore = create((set, get) => ({
  heldCarts: [],

  holdCart: (cart, clientName = '') => {
    const state = get()
    if (cart.length === 0)              return null
    if (state.heldCarts.length >= MAX_HOLDS) return null

    const id       = crypto.randomUUID()
    const label    = clientName
      ? `Cliente: ${clientName}`
      : `Venta #${state.heldCarts.length + 1}`

    const snapshot = {
      id,
      label,
      items:     structuredClone(cart),
      createdAt: new Date().toISOString(),
    }

    set((s) => ({ heldCarts: [...s.heldCarts, snapshot] }))
    return id
  },

  // CORRECCIÓN CLAVE: getState() es SÍNCRONO — devuelve el valor real
  // antes del próximo render, sin batching ni closures obsoletos.
  recoverCart: (holdId) => {
    const state  = get()
    const hold   = state.heldCarts.find((h) => h.id === holdId)
    if (!hold) return null

    // Eliminar el hold del array ANTES de devolver los ítems
    set((s) => ({ heldCarts: s.heldCarts.filter((h) => h.id !== holdId) }))

    // Devolver copia profunda de los ítems para evitar mutaciones
    return structuredClone(hold.items)
  },

  discardHold: (holdId) => {
    set((s) => ({ heldCarts: s.heldCarts.filter((h) => h.id !== holdId) }))
  },
}))

// Hook público — misma API que la versión anterior, sin cambios en POS.jsx
export function useCartHold() {
  const heldCarts  = useHoldStore((s) => s.heldCarts)
  const holdCart   = useHoldStore((s) => s.holdCart)
  const recoverCart = useHoldStore((s) => s.recoverCart)
  const discardHold = useHoldStore((s) => s.discardHold)

  return {
    heldCarts,
    holdCart,
    recoverCart,
    discardHold,
    canHold: heldCarts.length < MAX_HOLDS,
  }
}
