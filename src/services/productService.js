import { api, USE_API, ok, gs, delay } from './_base'

export const productService = {
  async getAll(filters = {}) {
    await delay()
    if (USE_API) {
      const { data } = await api.get('/products', { params: filters })
      return ok(data.data, data.meta?.total)
    }
    let products = gs().products.filter(p => p.isActive)
    if (filters.categoryId) products = products.filter(p => p.categoryId === filters.categoryId)
    if (filters.search) {
      const q = filters.search.toLowerCase()
      products = products.filter(p =>
        p.name.toLowerCase().includes(q) || p.barcode.includes(q) ||
        p.sku?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      )
    }
    if (filters.lowStock)   products = products.filter(p => p.stock <= p.stockMin)
    if (filters.nearExpiry) products = products.filter(p => {
      if (!p.expiryDate) return false
      return Math.ceil((new Date(p.expiryDate) - new Date()) / 86400000) <= 30
    })
    if (filters.noMovement) products = products.filter(p => {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - (filters.noMovementDays || 30))
      return gs().stockMovements.filter(m => m.productId === p.id && new Date(m.createdAt) >= cutoff).length === 0
    })
    return ok(products, products.length)
  },

  async getByBarcode(barcode) {
    await delay(100)
    if (USE_API) {
      const { data } = await api.get(`/products/barcode/${barcode}`)
      return ok(data.data)
    }
    const product = gs().products.find(p => p.barcode === barcode && p.isActive)
    return product ? ok(product) : { data: null, meta: null, error: 'Producto no encontrado' }
  },

  async create(payload) {
    await delay()
    if (USE_API) { const { data } = await api.post('/products', payload); return ok(data.data) }
    const product = {
      ...payload,
      id:        crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    gs().addProduct(product)
    return ok(product)
  },

  async update(id, payload) {
    await delay()
    if (USE_API) { const { data } = await api.put(`/products/${id}`, payload); return ok(data.data) }
    gs().updateProduct(id, payload)
    return ok({ id, ...payload })
  },

  async adjustStock(id, quantity, type, reason, userId) {
    await delay()
    if (USE_API) {
      const { data } = await api.post(`/products/${id}/stock`, { quantity, type, reason })
      return ok(data.data)
    }
    const state   = gs()
    const product = state.products.find(p => p.id === id)
    if (!product) return { data: null, meta: null, error: 'Producto no encontrado' }

    const prevStock = product.stock
    const delta     = type === 'entrada' ? quantity : -quantity
    const newStock  = Math.max(0, prevStock + delta)

    state.updateProduct(id, { stock: newStock })
    state.addStockMovement({
      id: crypto.randomUUID(), productId: id, productName: product.name,
      type, quantity, previousStock: prevStock, newStock, reason, userId,
      createdAt: new Date().toISOString(),
    })
    return ok({ id, newStock })
  },
}
