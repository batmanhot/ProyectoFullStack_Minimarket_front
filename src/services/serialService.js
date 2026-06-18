/**
 * serialService.js
 * Gestión de números de serie para productos con stockControl = 'serie'.
 *
 * ARQUITECTURA CORRECTA (modo local):
 *   Los seriales NO viven en product.serials[] — eso nunca existió en el store.
 *   En modo local se usa el slice productSerials[] del store (array plano independiente).
 *   En modo API se llama a serials.routes.js del backend.
 *
 * REGLA DE NEGOCIO:
 *   - La serie NO acumula stock.
 *   - El stock del producto = cantidad de seriales con status='disponible'.
 *   - Al venderse: status → 'vendido', saleId, invoiceNumber, soldAt.
 *   - Al anularse: status → 'disponible', limpiar saleId/invoiceNumber/soldAt.
 */
import { api, USE_API, ok, fail, gs, delay } from './_base'

// ── Helpers internos modo local ────────────────────────────────────────────────
function getStore() { return gs() }

function recalcStock(productId) {
  const st   = getStore()
  const serials = (st.productSerials || []).filter(s => s.productId === productId)
  const count   = serials.filter(s => s.status === 'disponible').length
  st.updateProduct(productId, { stock: count })
  return count
}

export const serialService = {

  // ── Obtener seriales de un producto ───────────────────────────────────────
  async getByProduct(productId, filters = {}) {
    await delay(150)
    if (USE_API) {
      try {
        const { data } = await api.get(`/products/${productId}/serials`, { params: filters })
        // Sincronizar el store local con los datos del backend
        const st = getStore()
        if (st.setProductSerials) {
          const otherSerials = (st.productSerials || []).filter(s => s.productId !== productId)
          st.setProductSerials([...otherSerials, ...data.data])
        }
        return ok(data.data, data.meta?.total ?? data.data.length)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al obtener seriales')
      }
    }
    // Modo local: leer del slice productSerials
    const st      = getStore()
    const serials = (st.productSerials || []).filter(s => {
      if (s.productId !== productId) return false
      if (filters.status && s.status !== filters.status) return false
      return true
    })
    return ok(serials, serials.length)
  },

  // ── Registrar uno o varios seriales nuevos ────────────────────────────────
  async createBatch(productId, serials) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.post(`/products/${productId}/serials`, { serials })
        if (data.data?.stockUpdated != null) {
          getStore().updateProduct(productId, { stock: data.data.stockUpdated })
        }
        return ok(data.data)
      } catch (err) {
        const details = err.response?.data?.duplicates
          ? `Seriales duplicados: ${err.response.data.duplicates.slice(0, 3).join(', ')}${err.response.data.duplicates.length > 3 ? '...' : ''}`
          : err.response?.data?.error || err.message || 'Error al registrar seriales'
        return fail(details)
      }
    }
    // Modo local
    const st       = getStore()
    const existing = (st.productSerials || []).map(s => s.serialNumber)
    const incoming = serials.map(s => s.serialNumber)
    const conflicts = incoming.filter(sn => existing.includes(sn))
    if (conflicts.length > 0) {
      return fail(`Seriales ya registrados: ${conflicts.join(', ')}`)
    }
    const newSerials = serials.map(s => ({
      id:           crypto.randomUUID(),
      productId,
      serialNumber: s.serialNumber,
      notes:        s.notes || '',
      status:       'disponible',
      saleId:       '',
      invoiceNumber:'',
      soldAt:       null,
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    }))
    if (st.addProductSerials) {
      st.addProductSerials(newSerials)
    } else {
      // Fallback: usar setProductSerials
      st.setProductSerials?.([...(st.productSerials || []), ...newSerials])
    }
    const newStock = recalcStock(productId)
    return ok({ created: newSerials.length, stockUpdated: newStock })
  },

  // ── Validar un serial antes de vender ─────────────────────────────────────
  async validate(serialNumber) {
    await delay(100)
    if (USE_API) {
      try {
        const { data } = await api.get(`/products/serial/${encodeURIComponent(serialNumber)}`)
        return ok(data.data)
      } catch (err) {
        if (err.response?.status === 409) return fail(err.response.data?.error || 'Serial ya vendido o dado de baja')
        if (err.response?.status === 404) return fail(`Serial "${serialNumber}" no encontrado`)
        return fail(err.response?.data?.error || err.message || 'Error al validar serial')
      }
    }
    const st = getStore()
    const serial = (st.productSerials || []).find(
      s => s.serialNumber?.toUpperCase() === serialNumber?.toUpperCase()
    )
    if (!serial)                    return fail(`Serial "${serialNumber}" no encontrado`)
    if (serial.status === 'vendido')  return fail(`Serial ya vendido en comprobante ${serial.invoiceNumber || ''}`)
    if (serial.status === 'dado_baja') return fail('Este serial ha sido dado de baja')
    const product = st.products.find(p => p.id === serial.productId)
    return ok({ ...serial, product: { id: product?.id, name: product?.name, priceSell: product?.priceSell } })
  },

  // ── Cambiar estado de un serial ───────────────────────────────────────────
  async patchStatus(productId, serialId, status, notes) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.patch(`/products/${productId}/serials/${serialId}`, { status, ...(notes !== undefined && { notes }) })
        recalcStock(productId)
        return ok(data.data)
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al actualizar serial')
      }
    }
    const st = getStore()
    const updated = (st.productSerials || []).map(s =>
      s.id === serialId ? { ...s, status, ...(notes !== undefined && { notes }), updatedAt: new Date().toISOString() } : s
    )
    st.setProductSerials?.(updated)
    recalcStock(productId)
    return ok({ id: serialId, status })
  },

  // ── Eliminar serial (solo si no está vendido) ─────────────────────────────
  async remove(productId, serialId) {
    await delay()
    if (USE_API) {
      try {
        await api.delete(`/products/${productId}/serials/${serialId}`)
        const st       = getStore()
        const filtered = (st.productSerials || []).filter(s => s.id !== serialId)
        st.setProductSerials?.(filtered)
        recalcStock(productId)
        return ok({ id: serialId, deleted: true })
      } catch (err) {
        return fail(err.response?.data?.error || err.message || 'Error al eliminar serial')
      }
    }
    const st = getStore()
    const serial = (st.productSerials || []).find(s => s.id === serialId)
    if (!serial) return fail('Serial no encontrado')
    if (serial.status === 'vendido') return fail('No se puede eliminar un serial vendido')
    const filtered = (st.productSerials || []).filter(s => s.id !== serialId)
    st.setProductSerials?.(filtered)
    recalcStock(productId)
    return ok({ id: serialId, deleted: true })
  },

  // ── Marcar serial como vendido (llamado desde saleService al confirmar venta) ──
  async markSold(productId, serialNumber, saleId, invoiceNumber) {
    await delay(50)
    if (USE_API) {
      // El backend (sales.routes.js) ya lo marca via markSerialSold() exportado
      // Solo sincronizamos el store local para que SerialesView refleje el cambio
      const st = getStore()
      const updated = (st.productSerials || []).map(s =>
        s.serialNumber === serialNumber && s.productId === productId
          ? { ...s, status: 'vendido', saleId: saleId || '', invoiceNumber: invoiceNumber || '', soldAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : s
      )
      st.setProductSerials?.(updated)
      recalcStock(productId)
      return
    }
    // Modo local
    const st = getStore()
    const updated = (st.productSerials || []).map(s =>
      s.serialNumber === serialNumber && s.productId === productId
        ? { ...s, status: 'vendido', saleId: saleId || '', invoiceNumber: invoiceNumber || '', soldAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : s
    )
    st.setProductSerials?.(updated)
    // Recalcular stock: stock = cantidad de 'disponible'
    recalcStock(productId)
  },

  // ── Restaurar serial al cancelar una venta ────────────────────────────────
  async markAvailable(productId, serialNumber) {
    await delay(50)
    const st = getStore()
    const updated = (st.productSerials || []).map(s =>
      s.serialNumber === serialNumber && s.productId === productId
        ? { ...s, status: 'disponible', saleId: '', invoiceNumber: '', soldAt: null, updatedAt: new Date().toISOString() }
        : s
    )
    st.setProductSerials?.(updated)
    // Recalcular stock al restaurar
    recalcStock(productId)

    if (USE_API) {
      try {
        await api.patch(`/products/serial/${encodeURIComponent(serialNumber)}/available`, { productId })
      } catch (_) {
        // Ignorar error de red en anulación — el store ya fue actualizado
      }
    }
  },
}
