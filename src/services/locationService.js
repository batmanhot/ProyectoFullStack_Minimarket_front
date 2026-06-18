/**
 * locationService.js
 * Gestión de ubicaciones físicas (Almacén, Góndola, Mostrador, Bodega)
 * y transferencias de stock entre ellas.
 * Conecta con locations.routes.js del backend.
 * En modo local, delega en el locationSlice del store.
 */
import { api, USE_API, ok, fail, gs, delay } from './_base'

export const locationService = {

  // ── Listar ubicaciones ────────────────────────────────────────────────────
  async getAll() {
    await delay(150)
    if (USE_API) {
      try {
        const { data } = await api.get('/locations')
        // Sincronizar store local con los datos del backend
        data.data.forEach(loc => {
          const exists = gs().locations.find(l => l.id === loc.id)
          if (exists) gs().updateLocation(loc.id, loc)
          else gs().addLocation(loc)
        })
        return ok(data.data, data.meta?.total)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al obtener ubicaciones')
      }
    }
    const locations = gs().locations.filter(l => l.isActive !== false)
    return ok(locations, locations.length)
  },

  // ── Crear ubicación ───────────────────────────────────────────────────────
  async create(payload) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.post('/locations', payload)
        const location = data.data
        gs().addLocation(location)
        return ok(location)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al crear ubicación')
      }
    }
    // Modo local: usa el locationSlice
    return gs().addLocation(payload)
  },

  // ── Actualizar ubicación ──────────────────────────────────────────────────
  async update(id, updates) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.put(`/locations/${id}`, updates)
        gs().updateLocation(id, data.data)
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al actualizar ubicación')
      }
    }
    return gs().updateLocation(id, updates)
  },

  // ── Eliminar ubicación ────────────────────────────────────────────────────
  async remove(id) {
    await delay()
    if (USE_API) {
      try {
        await api.delete(`/locations/${id}`)
        gs().deleteLocation(id)
        return ok({ id, deleted: true })
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al eliminar ubicación')
      }
    }
    return gs().deleteLocation(id)
  },

  // ── Stock de productos en una ubicación ───────────────────────────────────
  async getStock(locationId) {
    await delay(150)
    if (USE_API) {
      try {
        const { data } = await api.get(`/locations/${locationId}/stock`)
        return ok(data.data, data.meta?.total)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al obtener stock por ubicación')
      }
    }
    // Modo local: filtrar productos que tienen esta ubicación
    const location = gs().locations.find(l => l.id === locationId)
    if (!location) return fail('Ubicación no encontrada')
    const products = gs().products.filter(
      p => p.isActive && (p.location === location.name || p.locationId === locationId)
    )
    return ok(products, products.length)
  },

  // ── Transferir stock entre ubicaciones ───────────────────────────────────
  async transfer({ fromId, toId, productId, quantity, reason = 'Transferencia interna' }) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.post('/locations/transfer', { fromId, toId, productId, quantity, reason })
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al realizar transferencia')
      }
    }
    // Modo local: la transferencia solo actualiza el campo location del producto
    const locations = gs().locations
    const from = locations.find(l => l.id === fromId)
    const to   = locations.find(l => l.id === toId)
    if (!from) return fail('Ubicación origen no encontrada')
    if (!to)   return fail('Ubicación destino no encontrada')

    const product = gs().products.find(p => p.id === productId)
    if (!product) return fail('Producto no encontrado')

    // En modo local no hay stock por ubicación — simplemente cambiamos la ubicación del producto
    gs().updateProduct(productId, { location: to.name })
    gs().addAuditLog({
      action:   'UPDATE',
      module:   'Ubicaciones',
      detail:   `Transferencia: ${product.name} · ${quantity} unid. de "${from.name}" a "${to.name}"`,
      entityId: productId,
    })

    return ok({
      id:          crypto.randomUUID(),
      productId,
      productName: product.name,
      fromId,
      toId,
      quantity,
      reason,
      status:      'completada',
      createdAt:   new Date().toISOString(),
    })
  },

  // ── Historial de transferencias ───────────────────────────────────────────
  async getTransfers(filters = {}) {
    await delay(150)
    if (USE_API) {
      try {
        const { data } = await api.get('/locations/transfers', { params: filters })
        return ok(data.data, data.meta?.total)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al obtener transferencias')
      }
    }
    // Modo local: sin historial de transferencias persistido
    return ok([], 0)
  },

  // ── Anular transferencia ──────────────────────────────────────────────────
  async anularTransfer(transferId) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.delete(`/locations/transfers/${transferId}`)
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al anular transferencia')
      }
    }
    return ok({ id: transferId, status: 'anulada' })
  },
}
