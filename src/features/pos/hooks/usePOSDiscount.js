/**
 * usePOSDiscount
 * Centraliza el estado y la lógica de descuentos del POS:
 *  - Descuento manual por ítem (monto o porcentaje)
 *  - Descuento global de la venta
 *  - Ticket de descuento (validación y aplicación)
 *
 * Extrae la lógica que antes vivía directamente en POS.jsx para que el
 * componente solo coordine UI, no reglas de negocio.
 */
import { useState, useCallback } from 'react'
import { useStore } from '../../../store/index'
import { discountTicketService } from '../../../services/index'
import { POS_RULES } from '../../../config/businessRules'
import toast from 'react-hot-toast'

/**
 * @param {Function} updateCartItem - Acción del store para actualizar un ítem del carrito
 *
 * Nota: handleCheckTicket(preSaleTotal) recibe el total como argumento en lugar de
 * como parámetro del hook, lo que evita la dependencia circular con usePOSTotals.
 */
export function usePOSDiscount(updateCartItem) {
  const { systemConfig } = useStore()

  // ── Estado ────────────────────────────────────────────────────────────────
  // Descuento manual por ítem: { [key]: { value: string, pct: boolean } }
  const [discountEdit, setDiscountEdit] = useState({})

  // Descuento global (input del cajero)
  const [globalDiscount, setGlobalDiscount] = useState('')

  // Ticket de descuento
  const [ticketCode, setTicketCode]     = useState('')
  const [appliedTicket, setAppliedTicket] = useState(null)
  const [ticketError, setTicketError]   = useState('')

  // ── Derivados ─────────────────────────────────────────────────────────────
  const discountsEnabled = systemConfig?.allowDiscounts !== false
  const maxDiscPct       = systemConfig?.maxDiscountPct ?? POS_RULES.DEFAULT_MAX_DISCOUNT_PCT

  const globalDiscountAmt = parseFloat(globalDiscount) || 0
  const ticketDiscAmt     = appliedTicket ? appliedTicket.discountAmt : 0

  // ── Handlers de descuento por ítem ───────────────────────────────────────

  /** Abre o cierra el panel de descuento manual de un ítem */
  const toggleDiscountEdit = useCallback((key) => {
    setDiscountEdit(d =>
      d[key]
        ? (() => { const n = { ...d }; delete n[key]; return n })()
        : { ...d, [key]: { value: '', pct: true } }
    )
  }, [])

  /** Aplica el descuento manual ingresado para un ítem del carrito */
  const applyDiscount = useCallback((key, item) => {
    const ed = discountEdit[key]
    if (!ed) return

    const val        = parseFloat(ed.value) || 0
    const discountAmt = ed.pct
      ? parseFloat((item.quantity * item.unitPrice * val / 100).toFixed(2))
      : val

    const pct = (discountAmt / (item.quantity * item.unitPrice)) * 100
    if (pct > maxDiscPct) {
      toast.error(`Descuento máximo permitido: ${maxDiscPct}%`)
      return
    }

    updateCartItem(key, { discount: discountAmt })
    setDiscountEdit(d => { const n = { ...d }; delete n[key]; return n })
    toast.success('Descuento aplicado', { duration: 1000 })
  }, [discountEdit, maxDiscPct, updateCartItem])

  /** Actualiza el valor o tipo (% / S/) en el panel de descuento de un ítem */
  const setDiscountValue = useCallback((key, value) => {
    setDiscountEdit(d => ({ ...d, [key]: { ...d[key], value } }))
  }, [])

  const toggleDiscountType = useCallback((key) => {
    setDiscountEdit(d => ({ ...d, [key]: { ...d[key], pct: !d[key].pct } }))
  }, [])

  // ── Handlers de ticket de descuento ──────────────────────────────────────

  /**
   * Valida y aplica un ticket de descuento.
   * @param {number} preSaleTotal - Subtotal antes de ticket (subtotalBruto - globalDiscAmt),
   *                                calculado en POS.jsx tras usePOSTotals para evitar
   *                                dependencia circular entre hooks.
   */
  const handleCheckTicket = useCallback(async (preSaleTotal) => {
    setTicketError('')
    if (!ticketCode.trim()) return

    const result = await discountTicketService.validate(ticketCode.trim())
    if (result.error) { setTicketError(result.error); return }

    const ticket = result.data

    // Validar monto mínimo de compra
    if (ticket.minAmount && preSaleTotal < ticket.minAmount) {
      setTicketError(`Monto mínimo para este código: S/${ticket.minAmount.toFixed(2)}`)
      return
    }

    // ticket.discount es un porcentaje (0-100) según el modelo DiscountTicket de la BD
    const discountAmt = Math.max(0, parseFloat((preSaleTotal * ticket.discount / 100).toFixed(2)))
    setAppliedTicket({ ticket, discountAmt })
    toast.success(`✅ Ticket válido · Descuento: S/${discountAmt.toFixed(2)}`, { duration: 3000 })
  }, [ticketCode])

  const handleRemoveTicket = useCallback(() => {
    setAppliedTicket(null)
    setTicketCode('')
    setTicketError('')
  }, [])

  // ── Reset completo (al completar o vaciar la venta) ───────────────────────
  const resetDiscount = useCallback(() => {
    setDiscountEdit({})
    setGlobalDiscount('')
    setAppliedTicket(null)
    setTicketCode('')
    setTicketError('')
  }, [])

  return {
    // Estado
    discountEdit,
    globalDiscount,  setGlobalDiscount,
    ticketCode,      setTicketCode: (v) => { setTicketCode(v.toUpperCase()); setTicketError('') },
    appliedTicket,
    ticketError,

    // Derivados
    discountsEnabled,
    maxDiscPct,
    globalDiscountAmt,
    ticketDiscAmt,

    // Handlers
    toggleDiscountEdit,
    applyDiscount,
    setDiscountValue,
    toggleDiscountType,
    handleCheckTicket,
    handleRemoveTicket,
    resetDiscount,
  }
}
