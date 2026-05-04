/**
 * discountsSlice.js — Slice de Descuentos y Devoluciones
 * Ruta: src/store/slices/discountsSlice.js
 *
 * Agrupa: campañas de descuento, tickets de descuento (vales), devoluciones/NCs.
 */

/** @param {Function} set @param {Function} get @returns {Object} */
export const createDiscountsSlice = (set, get) => ({

  // ─── Campañas de descuento ─────────────────────────────────────────────────
  discountCampaigns: [],

  addDiscountCampaign: (campaign) => {
    get().addAuditLog({
      action:   'CREATE',
      module:   'Descuentos',
      detail:   `Campaña creada: ${campaign.name}`,
      entityId: campaign.id,
    })
    set((s) => ({ discountCampaigns: [campaign, ...s.discountCampaigns] }))
  },

  updateDiscountCampaign: (id, updates) => {
    get().addAuditLog({
      action:   'UPDATE',
      module:   'Descuentos',
      detail:   `Campaña actualizada: ID ${id}`,
      entityId: id,
    })
    set((s) => ({
      discountCampaigns: s.discountCampaigns.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }))
  },

  deleteDiscountCampaign: (id) => {
    get().addAuditLog({
      action:   'DELETE',
      module:   'Descuentos',
      detail:   `Campaña eliminada: ID ${id}`,
      entityId: id,
    })
    set((s) => ({
      discountCampaigns: s.discountCampaigns.filter((c) => c.id !== id),
    }))
  },

  // ─── Tickets / Vales de descuento ──────────────────────────────────────────
  discountTickets: [],

  addDiscountTicket: (ticket) => {
    get().addAuditLog({
      action:   'CREATE',
      module:   'Tickets',
      detail:   `Ticket creado: ${ticket.code} · ${ticket.holderName}`,
      entityId: ticket.id,
    })
    set((s) => ({ discountTickets: [ticket, ...s.discountTickets] }))
  },

  updateDiscountTicket: (id, updates) => {
    get().addAuditLog({
      action:   'UPDATE',
      module:   'Tickets',
      detail:   `Ticket actualizado: ID ${id}`,
      entityId: id,
    })
    set((s) => ({
      discountTickets: s.discountTickets.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }))
  },

  deleteDiscountTicket: (id) => {
    get().addAuditLog({
      action:   'DELETE',
      module:   'Tickets',
      detail:   `Ticket eliminado: ID ${id}`,
      entityId: id,
    })
    set((s) => ({
      discountTickets: s.discountTickets.filter((t) => t.id !== id),
    }))
  },

  redeemDiscountTicket: (code, saleId, saleTotal, userId) => {
    const now = new Date().toISOString()
    get().addAuditLog({
      action:   'UPDATE',
      module:   'Tickets',
      detail:   `Ticket canjeado: ${code} · Venta ${saleId} · S/${saleTotal}`,
      entityId: code,
    })
    set((s) => ({
      discountTickets: s.discountTickets.map((t) =>
        t.code.toUpperCase() === code.toUpperCase()
          ? { ...t, used: true, usedAt: now, usedInSale: saleId, usedByUser: userId }
          : t
      ),
    }))
  },

  // ─── Devoluciones / Notas de Crédito ──────────────────────────────────────
  returns: [],

  addReturn: (creditNote) => {
    get().addAuditLog({
      action:   'CREATE',
      module:   'Devoluciones',
      detail:   `NC ${creditNote.ncNumber} · Boleta ${creditNote.invoiceNumber} · S/${creditNote.totalRefund}`,
      entityId: creditNote.id,
    })
    set((s) => ({ returns: [creditNote, ...s.returns] }))
  },

  updateReturn: (id, updates) => {
    get().addAuditLog({
      action:   'UPDATE',
      module:   'Devoluciones',
      detail:   `NC actualizada: ID ${id}`,
      entityId: id,
    })
    set((s) => ({
      returns: s.returns.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }))
  },

  anularReturn: (id, motivo) => {
    get().addAuditLog({
      action:   'CANCEL',
      module:   'Devoluciones',
      detail:   `NC anulada: ID ${id} · ${motivo}`,
      entityId: id,
    })
    set((s) => ({
      returns: s.returns.map((r) =>
        r.id === id
          ? { ...r, status: 'anulada', anuladaAt: new Date().toISOString(), anuladaMotivo: motivo }
          : r
      ),
    }))
  },
})
