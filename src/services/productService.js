import { api, USE_API, ok, fail, gs, delay } from './_base'

// Normaliza un producto del backend al formato que espera el frontend/Zod
const toFrontend = (p) => {
  const sc = p.stockControl || 'simple'
  return {
    ...p,
    type:        p.type === 'normal' ? 'simple' : (p.type || 'simple'),
    brand:       p.brandId || p.brand || '',
    attributes:  p.attributes || {},
    imageUrl:    p.imageUrl   || '',
    location:    p.location   || '',
    expiryDate:  p.expiryDate || '',
    supplierId:  p.supplierId || '',
    stockMax:    p.stockMax   ?? 0,
    stockControl: sc,
    // useBatches se deriva de stockControl (no existe como campo en la BD)
    useBatches: sc === 'lote_fefo' || sc === 'lote_fifo',
    // Mapear bundleParents (POST/PUT) → components (formulario)
    components: p.components ?? (p.bundleParents || []).map(bc => ({
      productId:  bc.productId,
      quantity:   bc.quantity,
      _name:      bc.product?.name      || '',
      _barcode:   bc.product?.barcode   || '',
      _unit:      bc.product?.unit      || 'unidad',
      _priceSell: bc.product?.priceSell ?? 0,
    })),
  }
}

export const productService = {
  async getAll(filters = {}) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.get('/products', { params: filters })
        const normalized = data.data.map(toFrontend)
        // Sincroniza el store con datos del backend para que Inventario y otros
        // componentes que leen gs().products vean los datos reales de la API.
        const noRestrictiveFilter = !filters.lowStock && !filters.nearExpiry && !filters.noMovement && !filters.search && !filters.categoryId
        if (noRestrictiveFilter) gs().setProducts(normalized)
        return ok(normalized, data.meta?.total)
      } catch (err) {
        return fail(err.response?.data?.message || err.message || 'Error al obtener productos')
      }
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
      try {
        const { data } = await api.get(`/products/barcode/${barcode}`)
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.message || err.message || 'Producto no encontrado')
      }
    }
    const product = gs().products.find(p => p.barcode === barcode && p.isActive)
    return product ? ok(product) : fail('Producto no encontrado')
  },

  async create(payload) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.post('/products', payload)
        const product = toFrontend(data.data)
        gs().addProduct(product)
        return ok(product)
      } catch (err) {
        return fail(err.response?.data?.message || err.message || 'Error al crear el producto')
      }
    }
    const product = {
      ...payload,
      id:        payload.id || crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    gs().addProduct(product)
    return ok(product)
  },

  async update(id, payload) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.put(`/products/${id}`, payload)
        const product = toFrontend(data.data)
        gs().updateProduct(id, product)
        return ok(product)
      } catch (err) {
        if (err.response?.status !== 404) {
          return fail(err.response?.data?.message || err.message || 'Error al actualizar el producto')
        }
        // 404 = producto no existe en el backend stub, actualizar localmente
      }
    }
    gs().updateProduct(id, payload)
    return ok({ id, ...payload })
  },

  async remove(id) {
    await delay()
    if (USE_API) {
      try {
        await api.delete(`/products/${id}`)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al eliminar el producto')
      }
    }
    gs().deleteProduct(id)
    return ok({ id, deleted: true })
  },

  async adjustStock(id, quantity, type, reason, userId) {
    await delay()
    const state   = gs()
    const product = state.products.find(p => p.id === id)
    if (!product) return fail('Producto no encontrado')

    const prevStock = product.stock
    const delta     = type === 'entrada' ? quantity : -quantity
    const newStock  = Math.max(0, prevStock + delta)

    if (USE_API) {
      try {
        await api.post(`/products/${id}/stock`, { quantity, type, reason })
      } catch (_) {
        // Si el producto no existe en el backend, continuar con el ajuste local
      }
    }

    state.updateProduct(id, { stock: newStock })
    state.addStockMovement({
      id: crypto.randomUUID(), productId: id, productName: product.name,
      type, quantity, previousStock: prevStock, newStock, reason, userId,
      createdAt: new Date().toISOString(),
    })
    return ok({ id, newStock })
  },
}
