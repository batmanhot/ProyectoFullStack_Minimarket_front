/**
 * locationSlice.js — Maestro de Ubicaciones físicas
 *
 * Gestiona las ubicaciones donde se almacenan los productos
 * (Almacén, Góndola, Mostrador, Bodega, etc.).
 *
 * El campo `product.location` almacena el NOMBRE de la ubicación
 * (no el ID) para mantener compatibilidad con datos existentes y
 * facilitar la lectura directa sin lookups.
 *
 * ── Pendiente backend ────────────────────────────────────────────────
 * Cuando se integre el backend, este slice se reemplaza por llamadas
 * REST. El campo product.location pasará a ser product.locationId (FK).
 * La migración crea registros Location desde los nombres únicos
 * almacenados en product.location del frontend.
 * ────────────────────────────────────────────────────────────────────
 */

/** @param {Function} set @param {Function} get @returns {Object} */
export const createLocationSlice = (set, get) => ({

  // ── Estado ─────────────────────────────────────────────────────────
  locations: [],

  // ── Agregar ubicación ───────────────────────────────────────────────
  addLocation: ({ name, description = '' }) => {
    const trimmed = name?.trim()
    if (!trimmed) return { error: 'El nombre es requerido' }

    const duplicate = get().locations.some(
      (l) => l.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (duplicate) return { error: 'Ya existe una ubicación con ese nombre' }

    const location = {
      id:          crypto.randomUUID(),
      name:        trimmed,
      description: description.trim(),
      isActive:    true,
      createdAt:   new Date().toISOString(),
    }

    set((s) => ({ locations: [...s.locations, location] }))
    get().addAuditLog({
      action: 'CREATE',
      module: 'Ubicaciones',
      detail: `Nueva ubicación: ${trimmed}`,
    })
    return { error: null, location }
  },

  // ── Editar nombre / descripción / estado ────────────────────────────
  updateLocation: (id, updates) => {
    const trimmed = updates.name?.trim()

    if (trimmed) {
      const duplicate = get().locations.some(
        (l) => l.id !== id && l.name.toLowerCase() === trimmed.toLowerCase()
      )
      if (duplicate) return { error: 'Ya existe una ubicación con ese nombre' }
    }

    const prev = get().locations.find((l) => l.id === id)

    set((s) => ({
      locations: s.locations.map((l) =>
        l.id === id ? { ...l, ...updates, ...(trimmed ? { name: trimmed } : {}) } : l
      ),
    }))

    // Si cambió el nombre, actualizar todos los productos que la usan
    if (trimmed && prev && trimmed !== prev.name) {
      set((s) => ({
        products: s.products.map((p) =>
          p.location === prev.name ? { ...p, location: trimmed } : p
        ),
      }))
    }

    get().addAuditLog({
      action: 'UPDATE',
      module: 'Ubicaciones',
      detail: `Actualizada: ${trimmed || id}`,
    })
    return { error: null }
  },

  // ── Eliminar ubicación ──────────────────────────────────────────────
  deleteLocation: (id) => {
    const loc    = get().locations.find((l) => l.id === id)
    const inUse  = get().products.some((p) => p.location === loc?.name)

    if (inUse) {
      return { error: `La ubicación "${loc?.name}" tiene productos asignados. Reasígnalos antes de eliminarla.` }
    }

    set((s) => ({ locations: s.locations.filter((l) => l.id !== id) }))
    get().addAuditLog({
      action: 'DELETE',
      module: 'Ubicaciones',
      detail: `Eliminada: ${loc?.name}`,
    })
    return { error: null }
  },
})
