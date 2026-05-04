/**
 * stakeholdersSlice.js — Slice de Terceros y Compras
 * Ruta: src/store/slices/stakeholdersSlice.js
 *
 * Agrupa: clientes, proveedores, usuarios del sistema, compras a proveedor.
 * Todos son "actores externos" del negocio: coherente agruparlos.
 */

/** @param {Function} set @param {Function} get @returns {Object} */
export const createStakeholdersSlice = (set, get) => ({

  // ─── Clientes ──────────────────────────────────────────────────────────────
  addClient: (client) => {
    get().addAuditLog({
      action:   'CREATE',
      module:   'Clientes',
      detail:   `Cliente creado: ${client.name}`,
      entityId: client.id,
    })
    set((s) => ({ clients: [client, ...s.clients] }))
  },

  updateClient: (id, updates) =>
    set((s) => ({
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  // ─── Proveedores ───────────────────────────────────────────────────────────
  addSupplier: (supplier) => {
    get().addAuditLog({
      action:   'CREATE',
      module:   'Proveedores',
      detail:   `Proveedor creado: ${supplier.name}`,
      entityId: supplier.id,
    })
    set((s) => ({ suppliers: [supplier, ...s.suppliers] }))
  },

  updateSupplier: (id, updates) => {
    get().addAuditLog({
      action:   'UPDATE',
      module:   'Proveedores',
      detail:   `Proveedor actualizado: ID ${id}`,
      entityId: id,
    })
    set((s) => ({
      suppliers: s.suppliers.map((s2) => (s2.id === id ? { ...s2, ...updates } : s2)),
    }))
  },

  // ─── Usuarios del sistema ──────────────────────────────────────────────────
  addUser: (user) => {
    get().addAuditLog({
      action:   'CREATE',
      module:   'Usuarios',
      detail:   `Usuario creado: ${user.username} · Rol: ${user.role}`,
      entityId: user.id,
    })
    set((s) => ({ users: [user, ...s.users] }))
  },

  updateUser: (id, updates) => {
    get().addAuditLog({
      action:   'UPDATE',
      module:   'Usuarios',
      detail:   `Usuario actualizado: ID ${id}`,
      entityId: id,
    })
    set((s) => ({
      users: s.users.map((u) => (u.id === id ? { ...u, ...updates } : u)),
    }))
  },

  // ─── Compras a proveedor ───────────────────────────────────────────────────
  addPurchase: (purchase) => {
    get().addAuditLog({
      action:   'CREATE',
      module:   'Compras',
      detail:   `Compra: ${purchase.supplierName} · S/${purchase.total} · ${purchase.items?.length} prods`,
      entityId: purchase.id,
    })
    set((s) => ({ purchases: [purchase, ...s.purchases] }))
  },

  updatePurchase: (id, updates) => {
    get().addAuditLog({
      action:   'UPDATE',
      module:   'Compras',
      detail:   `Compra actualizada: ID ${id}`,
      entityId: id,
    })
    set((s) => ({
      purchases: s.purchases.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }))
  },
})
