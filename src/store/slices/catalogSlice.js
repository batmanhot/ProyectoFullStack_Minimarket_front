/**
 * catalogSlice.js — Slice de Catálogo e Inventario
 * Ruta: src/store/slices/catalogSlice.js
 *
 * Agrupa: productos, variantes de producto, movimientos de stock.
 * stockMovements tiene límite de 1000 registros para controlar el tamaño en localStorage.
 */

import { formatInvoice } from '../../shared/utils/helpers'

/** @param {Function} set @param {Function} get @returns {Object} */
export const createCatalogSlice = (set, get) => ({

  // ─── Productos ─────────────────────────────────────────────────────────────
  addProduct: (product) => {
    get().addAuditLog({
      action:   'CREATE',
      module:   'Catálogo',
      detail:   `Producto creado: ${product.name}`,
      entityId: product.id,
    })
    set((s) => ({ products: [product, ...s.products] }))
  },

  updateProduct: (id, updates) => {
    get().addAuditLog({
      action:   'UPDATE',
      module:   'Catálogo',
      detail:   `Producto actualizado: ${updates.name || id}`,
      entityId: id,
    })
    set((s) => ({
      products: s.products.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ),
    }))
  },

  deleteProduct: (id) => {
    const product = get().products.find((p) => p.id === id)
    get().addAuditLog({
      action:   'DELETE',
      module:   'Catálogo',
      detail:   `Producto desactivado: ${product?.name || id}`,
      entityId: id,
    })
    // Soft-delete: marcar como inactivo, nunca eliminar físicamente
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? { ...p, isActive: false } : p)),
    }))
  },

  // ─── Variantes de producto ─────────────────────────────────────────────────
  productVariants: [],

  addVariant: (variant) =>
    set((s) => ({ productVariants: [variant, ...s.productVariants] })),

  updateVariant: (id, updates) =>
    set((s) => ({
      productVariants: s.productVariants.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    })),

  // ─── Movimientos de stock ──────────────────────────────────────────────────
  // Límite de 1000 registros — protege contra crecimiento ilimitado en localStorage.
  // Los más recientes siempre se conservan (inserción al frente + slice).
  addStockMovement: (movement) =>
    set((s) => ({
      stockMovements: [movement, ...s.stockMovements].slice(0, 1000),
    })),

  // ─── Categorías ────────────────────────────────────────────────────────────
  addCategory: (category) => {
    get().addAuditLog({
      action: 'CREATE', module: 'Catálogo',
      detail: `Categoría creada: ${category.name}`, entityId: category.id,
    })
    set((s) => ({ categories: [category, ...s.categories] }))
  },

  updateCategory: (id, updates) => {
    get().addAuditLog({
      action: 'UPDATE', module: 'Catálogo',
      detail: `Categoría actualizada: ${updates.name || id}`, entityId: id,
    })
    set((s) => ({
      categories: s.categories.map((c) => c.id === id ? { ...c, ...updates } : c),
    }))
  },

  deleteCategory: (id) => {
    get().addAuditLog({
      action: 'DELETE', module: 'Catálogo',
      detail: `Categoría eliminada: ID ${id}`, entityId: id,
    })
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }))
  },

  // ─── Marcas ────────────────────────────────────────────────────────────────
  addBrand: (brand) => {
    get().addAuditLog({
      action: 'CREATE', module: 'Catálogo',
      detail: `Marca creada: ${brand.name}`, entityId: brand.id,
    })
    set((s) => ({ brands: [brand, ...(s.brands || [])] }))
  },

  updateBrand: (id, updates) => {
    get().addAuditLog({
      action: 'UPDATE', module: 'Catálogo',
      detail: `Marca actualizada: ${updates.name || id}`, entityId: id,
    })
    set((s) => ({
      brands: (s.brands || []).map((b) => b.id === id ? { ...b, ...updates } : b),
    }))
  },

  deleteBrand: (id) => {
    get().addAuditLog({
      action: 'DELETE', module: 'Catálogo',
      detail: `Marca eliminada: ID ${id}`, entityId: id,
    })
    set((s) => ({ brands: (s.brands || []).filter((b) => b.id !== id) }))
  },

  // ─── Merma ─────────────────────────────────────────────────────────────────
  addMermaRecord: (record) => {
    get().addAuditLog({
      action: 'CREATE',
      module: 'Merma',
      detail: `Registro de merma: ${record.productName || record.productId} · ${record.quantity || 0}`,
      entityId: record.id,
    })
    set((s) => ({ mermaRecords: [record, ...(s.mermaRecords || [])] }))
  },

  updateMermaRecord: (id, updates) => {
    get().addAuditLog({
      action: 'UPDATE',
      module: 'Merma',
      detail: `Merma actualizada: ID ${id}`,
      entityId: id,
    })
    set((s) => ({
      mermaRecords: (s.mermaRecords || []).map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }))
  },

  // ─── Contador de facturas ──────────────────────────────────────────────────
  getNextInvoice: () => {
    const n = get().nextInvoice
    set({ nextInvoice: n + 1 })
    return formatInvoice(n)
  },
})