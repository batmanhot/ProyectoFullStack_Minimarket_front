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
    set((s) => {
      const updatedVariants = s.productVariants.map((v) => (v.id === id ? { ...v, ...updates } : v))

      if (!('stock' in updates)) return { productVariants: updatedVariants }

      // Sincronizar stock del producto padre = suma de stocks de todas sus variantes
      const variant = s.productVariants.find((v) => v.id === id)
      if (!variant) return { productVariants: updatedVariants }

      const totalStock = updatedVariants
        .filter((v) => v.productId === variant.productId)
        .reduce((sum, v) => sum + (v.stock ?? 0), 0)

      return {
        productVariants: updatedVariants,
        products: s.products.map((p) =>
          p.id === variant.productId
            ? { ...p, stock: totalStock, updatedAt: new Date().toISOString() }
            : p
        ),
      }
    }),

  deleteVariant: (id) =>
    set((s) => ({
      productVariants: s.productVariants.filter((v) => v.id !== id),
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

  // ─── Contador de facturas por prefijo ─────────────────────────────────────
  // invoiceCounters = { T001: n, B001: n, F001: n, NC001: n }
  // Migración: si invoiceCounters[prefix] no existe, cae al legacy nextInvoice.
  getNextInvoice: (prefix = 'B001') => {
    const counters = get().invoiceCounters || {}
    const n = counters[prefix] != null ? counters[prefix] : (get().nextInvoice || 1)
    set(s => ({
      invoiceCounters: { ...(s.invoiceCounters || {}), [prefix]: n + 1 },
      nextInvoice: n + 1,
    }))
    return formatInvoice(n, prefix)
  },

  // Permite configurar el número de inicio de un correlativo desde Ajustes
  setInvoiceCounter: (prefix, value) => {
    const n = Math.max(1, parseInt(value) || 1)
    set(s => ({
      invoiceCounters: { ...(s.invoiceCounters || {}), [prefix]: n },
    }))
  },
})