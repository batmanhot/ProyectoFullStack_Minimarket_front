/**
 * CAPA DE SERVICIOS
 * VITE_USE_API=false  → localStorage / Zustand (modo demo)
 * VITE_USE_API=true   → API REST backend (modo producción)
 *
 * IMPORTANTE: se usa useStore.getState() — NO window.__MM_STORE__
 * Eso garantiza estado siempre fresco y elimina race conditions.
 */
import axios from 'axios'
import { useStore } from '../store/index'
import { formatNumber } from '../shared/utils/helpers'
import { APP_CONFIG } from '../config/app'

const USE_API = APP_CONFIG.useApi

// ─── AXIOS ────────────────────────────────────────────────────────────────────
export const api = axios.create({ baseURL: APP_CONFIG.apiUrl })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mm_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('mm_token')
      useStore.getState().logout()
    }
    return Promise.reject(err)
  }
)

// ─── HELPERS INTERNOS ─────────────────────────────────────────────────────────
const ok   = (data, total) => ({ data, meta: { total: total ?? (Array.isArray(data) ? data.length : 1) }, error: null })
const fail = (msg)         => ({ data: null, meta: null, error: msg })
const gs   = ()            => useStore.getState() // siempre fresco
const delay = (ms = 260)   => new Promise(r => setTimeout(r, ms))

// ═════════════════════════════════════════════════════════════════════════════
// AUTH SERVICE
// ═════════════════════════════════════════════════════════════════════════════
export const authService = {
  async login(role) {
    await delay(350)
    if (USE_API) {
      const { data } = await api.post('/auth/login', { role })
      localStorage.setItem('mm_token', data.token)
      return ok(data.user)
    }
    const user = gs().users.find(u => u.role === role && u.isActive)
    return user ? ok(user) : fail('Usuario no encontrado')
  },

  async loginWithCredentials(username) {
    await delay(350)
    const user = gs().users.find(u => u.username === username && u.isActive)
    return user ? ok(user) : fail('Usuario o contraseña incorrectos')
  },

  async logout() {
    localStorage.removeItem('mm_token')
    if (USE_API) await api.post('/auth/logout').catch(() => {})
    return ok(null)
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// PRODUCT SERVICE
// ═════════════════════════════════════════════════════════════════════════════
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
    if (filters.lowStock)    products = products.filter(p => p.stock <= p.stockMin)
    if (filters.nearExpiry)  products = products.filter(p => {
      if (!p.expiryDate) return false
      return Math.ceil((new Date(p.expiryDate) - new Date()) / 86400000) <= 30
    })
    if (filters.noMovement)  products = products.filter(p => {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - (filters.noMovementDays || 30))
      const movements = gs().stockMovements.filter(m => m.productId === p.id && new Date(m.createdAt) >= cutoff)
      return movements.length === 0
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
    return product ? ok(product) : fail('Producto no encontrado')
  },

  async create(payload) {
    await delay()
    if (USE_API) { const { data } = await api.post('/products', payload); return ok(data.data) }
    const product = { ...payload, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
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
    if (!product) return fail('Producto no encontrado')

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

// ═════════════════════════════════════════════════════════════════════════════
// SALE SERVICE
// ═════════════════════════════════════════════════════════════════════════════
export const saleService = {
  async getAll(filters = {}) {
    await delay()
    if (USE_API) {
      const { data } = await api.get('/sales', { params: filters })
      return ok(data.data, data.meta?.total)
    }
    let sales = gs().sales
    if (filters.status)   sales = sales.filter(s => s.status === filters.status)
    if (filters.dateFrom) sales = sales.filter(s => new Date(s.createdAt) >= new Date(filters.dateFrom))
    if (filters.dateTo)   sales = sales.filter(s => new Date(s.createdAt) <= new Date(filters.dateTo))
    if (filters.clientId) sales = sales.filter(s => s.clientId === filters.clientId)
    return ok(sales.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), sales.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) { const { data } = await api.post('/sales', payload); return ok(data.data) }

    // Descontar stock de CADA producto — leemos siempre estado fresco dentro del loop
    for (const item of payload.items) {
      const freshState  = useStore.getState()
      const product     = freshState.products.find(p => p.id === item.productId)
      if (!product) continue
      const prevStock   = product.stock
      const newStock    = Math.max(0, prevStock - item.quantity)
      freshState.updateProduct(item.productId, { stock: newStock })
      freshState.addStockMovement({
        id: crypto.randomUUID(), productId: item.productId, productName: product.name,
        type: 'salida', quantity: item.quantity, previousStock: prevStock, newStock,
        reason: `Venta ${payload.invoiceNumber}`, userId: payload.userId,
        createdAt: payload.createdAt || new Date().toISOString(),
      })
    }

    // Registrar deuda si hay pago a crédito
    if (payload.clientId) {
      const creditPayment = payload.payments?.find(p => p.method === 'credito')
      if (creditPayment) {
        const freshState = useStore.getState()
        const client = freshState.clients.find(c => c.id === payload.clientId)
        if (client) {
          freshState.updateClient(payload.clientId, {
            currentDebt: formatNumber((client.currentDebt || 0) + creditPayment.amount)
          })
        }
      }
    }

    // Normalizar ítems antes de guardar — garantiza que los campos de descuento
    // y totales por línea estén presentes para la boleta y los reportes
    const normalizedItems = payload.items.map(item => {
      const qty           = item.quantity || 1
      const pu            = item.unitPrice || 0
      const campaignDisc  = parseFloat((item.campaignDiscount || 0).toFixed(2))
      const manualDisc    = parseFloat((item.manualDiscount   || item.discount || 0).toFixed(2))
      const totalDiscount = parseFloat((item.totalDiscount    || campaignDisc + manualDisc).toFixed(2))
      const subtotal      = parseFloat((qty * pu).toFixed(2))
      const netTotal      = item.netTotal ?? parseFloat((subtotal - totalDiscount).toFixed(2))

      return {
        ...item,
        campaignDiscount: campaignDisc,
        manualDiscount:   manualDisc,
        discount:         manualDisc,       // compatibilidad con código legacy
        totalDiscount,
        subtotal,
        netTotal,
      }
    })

    const sale = {
      ...payload,
      items: normalizedItems,
      id: crypto.randomUUID(),
      status: 'completada',
      createdAt: new Date().toISOString(),
    }

    // ── Programa de Puntos — canje + acumulación consistente al completar venta ─
    if (payload.clientId) {
      const freshState = useStore.getState()
      const client = freshState.clients.find(c => c.id === payload.clientId)

      if (client) {
        const accumulated = client.loyaltyAccumulated || 0
        const available   = client.loyaltyPoints || 0
        const transactions = client.loyaltyTransactions || []

        const redeemedPoints   = Math.max(0, Math.floor(payload.redeemedPoints || 0))
        const loyaltyDiscount  = Math.max(0, Number(payload.loyaltyDiscount || 0))

        let nextPoints = available
        let nextTransactions = [...transactions]

        if (redeemedPoints > 0) {
          const safeRedeemed = Math.min(redeemedPoints, nextPoints)
          if (safeRedeemed > 0) {
            nextPoints = Math.max(0, nextPoints - safeRedeemed)
            nextTransactions = [{
              id:             crypto.randomUUID(),
              type:           'redeemed',
              points:         safeRedeemed,
              saleId:         sale.id,
              invoiceNumber:  sale.invoiceNumber,
              saleTotal:      sale.total,
              discountAmount: loyaltyDiscount,
              createdAt:      sale.createdAt,
              description:    `Canje en venta ${sale.invoiceNumber} · -${safeRedeemed} pts → S/${loyaltyDiscount.toFixed(2)} desc.`,
            }, ...nextTransactions]
          }
        }

        const multiplier = accumulated >= 4000 ? 2.0
                         : accumulated >= 1500 ? 1.5
                         : accumulated >= 500  ? 1.2 : 1.0

        const basePoints = Math.floor(sale.total / 10)
        const earned     = Math.floor(basePoints * multiplier)

        const newAccumulated = accumulated + Math.max(0, earned)
        const newLevel = newAccumulated >= 4000 ? 'Platino'
                       : newAccumulated >= 1500 ? 'Oro'
                       : newAccumulated >= 500  ? 'Plata' : 'Bronce'

        if (earned > 0) {
          nextPoints += earned
          nextTransactions = [{
            id:            crypto.randomUUID(),
            type:          'earned',
            points:        earned,
            saleId:        sale.id,
            invoiceNumber: sale.invoiceNumber,
            saleTotal:     sale.total,
            level:         client.loyaltyLevel || 'Bronce',
            multiplier,
            createdAt:     sale.createdAt,
            description:   `Compra ${sale.invoiceNumber} · S/${sale.total}`,
          }, ...nextTransactions]
        }

        freshState.updateClient(payload.clientId, {
          loyaltyPoints:       nextPoints,
          loyaltyAccumulated:  newAccumulated,
          loyaltyLevel:        newLevel,
          loyaltyTransactions: nextTransactions,
        })
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    useStore.getState().addSale(sale)
    useStore.getState().clearCart()
    return ok(sale)
  },

  async cancel(id, reason, userId) {
    await delay()
    if (USE_API) {
      const { data } = await api.patch(`/sales/${id}/cancel`, { reason, userId })
      return ok(data.data)
    }
    const state = gs()
    const sale  = state.sales.find(s => s.id === id)
    if (!sale) return fail('Venta no encontrada')
    if (sale.status !== 'completada') return fail('Solo se pueden cancelar ventas completadas')

    for (const item of sale.items) {
      const freshState = useStore.getState()
      const product    = freshState.products.find(p => p.id === item.productId)
      if (!product) continue
      freshState.updateProduct(item.productId, { stock: product.stock + item.quantity })
      freshState.addStockMovement({
        id: crypto.randomUUID(), productId: item.productId, productName: product.name,
        type: 'entrada', quantity: item.quantity,
        previousStock: product.stock, newStock: product.stock + item.quantity,
        reason: `Cancelación ${sale.invoiceNumber}`, userId,
        createdAt: new Date().toISOString(),
      })
    }

    // Revertir deuda de crédito
    if (sale.clientId) {
      const creditPayment = sale.payments?.find(p => p.method === 'credito')
      if (creditPayment) {
        const freshState = useStore.getState()
        const client = freshState.clients.find(c => c.id === sale.clientId)
        if (client) {
          freshState.updateClient(sale.clientId, {
            currentDebt: formatNumber(Math.max(0, (client.currentDebt || 0) - creditPayment.amount))
          })
        }
      }
    }

    useStore.getState().updateSale(id, { status: 'cancelada', cancelReason: reason, cancelledAt: new Date().toISOString() })
    return ok({ id, status: 'cancelada' })
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// CASH SERVICE
// ═════════════════════════════════════════════════════════════════════════════
export const cashService = {
  async open(payload) {
    await delay()
    if (USE_API) { const { data } = await api.post('/cash/open', payload); return ok(data.data) }
    const state = gs()
    if (state.activeCashSession) return fail('Ya existe una caja abierta')
    const session = { ...payload, id: crypto.randomUUID(), status: 'abierta', openedAt: new Date().toISOString() }
    state.openCashSession(session)
    return ok(session)
  },

  async close(id, payload) {
    await delay()
    if (USE_API) { const { data } = await api.post(`/cash/${id}/close`, payload); return ok(data.data) }
    const state = gs()
    if (!state.activeCashSession) return fail('No hay caja abierta')
    const session = state.activeCashSession

    const sessionSales = state.sales.filter(s =>
      s.status === 'completada' && new Date(s.createdAt) >= new Date(session.openedAt)
    )
    const cashTotal = sessionSales.reduce((acc, s) => {
      const cashAmt = s.payments?.filter(p => p.method === 'efectivo').reduce((a, p) => a + p.amount, 0) || s.total
      return acc + cashAmt
    }, 0)

    const expectedAmount = formatNumber(session.openingAmount + cashTotal)
    const difference     = formatNumber(payload.countedAmount - expectedAmount)

    const closedSession = {
      ...session, closingAmount: payload.countedAmount, expectedAmount, difference,
      status: 'cerrada', notes: payload.notes || '', closedAt: new Date().toISOString(),
      salesCount: sessionSales.length,
      totalSales: formatNumber(sessionSales.reduce((a, s) => a + s.total, 0)),
    }
    state.closeCashSession(closedSession)
    return ok(closedSession)
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// CLIENT SERVICE
// ═════════════════════════════════════════════════════════════════════════════
export const clientService = {
  async getAll(search = '') {
    await delay(180)
    if (USE_API) { const { data } = await api.get('/clients', { params: { search } }); return ok(data.data) }
    let clients = gs().clients.filter(c => c.isActive)
    if (search) {
      const q = search.toLowerCase()
      clients = clients.filter(c => c.name.toLowerCase().includes(q) || c.documentNumber.includes(q))
    }
    return ok(clients, clients.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) { const { data } = await api.post('/clients', payload); return ok(data.data) }
    const client = { ...payload, id: crypto.randomUUID(), currentDebt: 0, isActive: true, createdAt: new Date().toISOString() }
    gs().addClient(client)
    return ok(client)
  },

  async update(id, payload) {
    await delay()
    if (USE_API) { const { data } = await api.put(`/clients/${id}`, payload); return ok(data.data) }
    gs().updateClient(id, payload)
    return ok({ id, ...payload })
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// SUPPLIER SERVICE
// ═════════════════════════════════════════════════════════════════════════════
export const supplierService = {
  async getAll(search = '') {
    await delay(180)
    if (USE_API) { const { data } = await api.get('/suppliers', { params: { search } }); return ok(data.data) }
    let suppliers = gs().suppliers.filter(s => s.isActive !== false)
    if (search) {
      const q = search.toLowerCase()
      suppliers = suppliers.filter(s => s.name.toLowerCase().includes(q))
    }
    return ok(suppliers, suppliers.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) { const { data } = await api.post('/suppliers', payload); return ok(data.data) }
    const supplier = { ...payload, id: crypto.randomUUID(), isActive: true, createdAt: new Date().toISOString() }
    gs().addSupplier(supplier)
    return ok(supplier)
  },

  async update(id, payload) {
    await delay()
    if (USE_API) { const { data } = await api.put(`/suppliers/${id}`, payload); return ok(data.data) }
    gs().updateSupplier(id, payload)
    return ok({ id, ...payload })
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// PURCHASE SERVICE (Compras a proveedor)
// ═════════════════════════════════════════════════════════════════════════════
export const purchaseService = {
  async getAll() {
    if (USE_API) { const { data } = await api.get('/purchases'); return ok(data.data) }
    return ok(gs().purchases, gs().purchases.length)
  },

  

  async create(payload) {
    await delay()
    if (USE_API) { const { data } = await api.post('/purchases', payload); return ok(data.data) }

    const state   = gs()
    const purchase = {
      ...payload, id: crypto.randomUUID(), status: 'confirmada',
      createdAt: new Date().toISOString(),
      total: formatNumber(payload.items.reduce((a, i) => a + i.quantity * i.priceBuy, 0)),
    }

    // Actualizar stock y priceBuy de cada producto
    for (const item of payload.items) {
      const freshState = useStore.getState()
      const product    = freshState.products.find(p => p.id === item.productId)
      if (!product) continue
      const prevStock  = product.stock
      const newStock   = prevStock + item.quantity
      freshState.updateProduct(item.productId, {
        stock: newStock,
        priceBuy: item.priceBuy, // actualiza costo real
      })
      freshState.addStockMovement({
        id: crypto.randomUUID(), productId: item.productId, productName: product.name,
        type: 'entrada', quantity: item.quantity,
        previousStock: prevStock, newStock,
        reason: `Compra proveedor: ${payload.supplierName || ''}`,
        userId: payload.userId, createdAt: new Date().toISOString(),
      })
    }

    useStore.getState().addPurchase(purchase)
    return ok(purchase)
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// RETURN SERVICE — Devoluciones / Notas de Crédito
// ═════════════════════════════════════════════════════════════════════════════
// Endpoints esperados del backend:
//   POST   /returns          → crear NC
//   GET    /returns          → listar NCs (con filtros opcionales)
//   GET    /returns/:id      → detalle de una NC
//   PATCH  /returns/:id/anular → anular NC (con motivo)
// ─────────────────────────────────────────────────────────────────────────────
export const returnService = {

  /** Crea una Nota de Crédito y actualiza el stock + status de la venta original */
  async create(payload) {
    await delay()
    if (USE_API) {
      const { data } = await api.post('/returns', payload)
      return ok(data.data)
    }

    const state = gs()

    // 1. Guardar la NC
    const creditNote = {
      ...payload,
      id:        payload.id        || crypto.randomUUID(),
      status:    payload.status    || 'completada',
      createdAt: payload.createdAt || new Date().toISOString(),
    }
    state.addReturn(creditNote)

    // 2. Restaurar stock de cada ítem devuelto
    for (const item of payload.items || []) {
      const freshState = useStore.getState()
      const product    = freshState.products.find((p) => p.id === item.productId)
      if (!product) continue

      const newStock = product.stock + item.quantity
      freshState.updateProduct(item.productId, { stock: newStock })
      freshState.addStockMovement({
        id:            crypto.randomUUID(),
        productId:     item.productId,
        productName:   item.productName,
        type:          'entrada',
        quantity:      item.quantity,
        previousStock: product.stock,
        newStock,
        reason:        `Devolución NC ${creditNote.ncNumber}`,
        userId:        payload.userId,
        createdAt:     creditNote.createdAt,
      })
    }

    // 3. Actualizar status de la venta original
    if (payload.saleId) {
      const freshState       = useStore.getState()
      const originalSale     = freshState.sales.find((s) => s.id === payload.saleId)
      const allReturns       = freshState.returns || []

      if (originalSale) {
        const totalOriginalQty  = originalSale.items.reduce((a, i) => a + i.quantity, 0)
        const totalReturnedQty  = [
          ...allReturns.filter((r) => r.saleId === payload.saleId && r.status !== 'anulada'),
          creditNote,
        ].flatMap((r) => r.items).reduce((a, i) => a + i.quantity, 0)

        freshState.updateSale(payload.saleId, {
          status: totalReturnedQty >= totalOriginalQty ? 'devolucion' : 'dev-parcial',
        })
      }
    }

    return ok(creditNote)
  },

  /** Lista todas las NCs, con filtros opcionales */
  async getAll(filters = {}) {
    await delay(180)
    if (USE_API) {
      const { data } = await api.get('/returns', { params: filters })
      return ok(data.data, data.meta?.total)
    }

    let returns = gs().returns || []
    if (filters.status)   returns = returns.filter((r) => r.status === filters.status)
    if (filters.saleId)   returns = returns.filter((r) => r.saleId === filters.saleId)
    if (filters.dateFrom) returns = returns.filter((r) => new Date(r.createdAt) >= new Date(filters.dateFrom))
    if (filters.dateTo)   returns = returns.filter((r) => new Date(r.createdAt) <= new Date(filters.dateTo + 'T23:59:59'))

    return ok(
      returns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      returns.length
    )
  },

  /** Obtiene una NC por ID */
  async getById(id) {
    await delay(100)
    if (USE_API) {
      const { data } = await api.get(`/returns/${id}`)
      return ok(data.data)
    }
    const nc = (gs().returns || []).find((r) => r.id === id)
    return nc ? ok(nc) : fail('Nota de Crédito no encontrada')
  },

  /** Anula una NC (no la elimina — la marca como anulada con motivo) */
  async anular(id, motivo, userId) {
    await delay()
    if (USE_API) {
      const { data } = await api.patch(`/returns/${id}/anular`, { motivo, userId })
      return ok(data.data)
    }

    const nc    = (gs().returns || []).find((r) => r.id === id)
    if (!nc) return fail('Nota de Crédito no encontrada')
    if (nc.status === 'anulada') return fail('Esta NC ya fue anulada')

    // Revertir el stock que se había restaurado
    for (const item of nc.items || []) {
      const freshState = useStore.getState()
      const product    = freshState.products.find((p) => p.id === item.productId)
      if (!product) continue
      const newStock = Math.max(0, product.stock - item.quantity)
      freshState.updateProduct(item.productId, { stock: newStock })
    }

    // Revertir el status de la venta original
    if (nc.saleId) {
      const freshState = useStore.getState()
      const sale       = freshState.sales.find((s) => s.id === nc.saleId)
      if (sale && (sale.status === 'devolucion' || sale.status === 'dev-parcial')) {
        freshState.updateSale(nc.saleId, { status: 'completada' })
      }
    }

    gs().anularReturn(id, motivo)
    return ok({ id, status: 'anulada' })
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// DISCOUNT CAMPAIGN SERVICE — Campañas de descuento
// ═════════════════════════════════════════════════════════════════════════════
// Endpoints esperados del backend:
//   GET    /campaigns           → listar campañas (con filtros)
//   POST   /campaigns           → crear campaña
//   PUT    /campaigns/:id       → actualizar campaña
//   DELETE /campaigns/:id       → eliminar campaña
//   PATCH  /campaigns/:id/toggle → activar/desactivar
// ─────────────────────────────────────────────────────────────────────────────
export const discountCampaignService = {

  /** Lista todas las campañas, con filtros opcionales */
  async getAll(filters = {}) {
    await delay(150)
    if (USE_API) {
      const { data } = await api.get('/campaigns', { params: filters })
      return ok(data.data, data.meta?.total)
    }

    let campaigns = gs().discountCampaigns || []
    if (filters.type)     campaigns = campaigns.filter((c) => c.type === filters.type)
    if (filters.isActive !== undefined) {
      campaigns = campaigns.filter((c) => c.isActive === filters.isActive)
    }
    return ok(
      campaigns.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
      campaigns.length
    )
  },

  /** Crea una nueva campaña */
  async create(payload) {
    await delay()
    if (USE_API) {
      const { data } = await api.post('/campaigns', payload)
      return ok(data.data)
    }
    const campaign = {
      ...payload,
      id:        payload.id        || crypto.randomUUID(),
      createdAt: payload.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    gs().addDiscountCampaign(campaign)
    return ok(campaign)
  },

  /** Actualiza una campaña existente */
  async update(id, updates) {
    await delay()
    if (USE_API) {
      const { data } = await api.put(`/campaigns/${id}`, updates)
      return ok(data.data)
    }
    gs().updateDiscountCampaign(id, { ...updates, updatedAt: new Date().toISOString() })
    return ok({ id, ...updates })
  },

  /** Activa o desactiva una campaña */
  async toggle(id, isActive) {
    await delay(150)
    if (USE_API) {
      const { data } = await api.patch(`/campaigns/${id}/toggle`, { isActive })
      return ok(data.data)
    }
    gs().updateDiscountCampaign(id, { isActive, updatedAt: new Date().toISOString() })
    return ok({ id, isActive })
  },

  /** Elimina una campaña permanentemente */
  async remove(id) {
    await delay()
    if (USE_API) {
      await api.delete(`/campaigns/${id}`)
      return ok({ id, deleted: true })
    }
    gs().deleteDiscountCampaign(id)
    return ok({ id, deleted: true })
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// DISCOUNT TICKET SERVICE — Vales / Tickets de descuento
// ═════════════════════════════════════════════════════════════════════════════
// Endpoints esperados:
//   GET    /tickets           → listar tickets
//   POST   /tickets           → crear ticket
//   PUT    /tickets/:id       → actualizar ticket
//   DELETE /tickets/:id       → eliminar ticket
//   POST   /tickets/:code/redeem → canjear ticket
// ─────────────────────────────────────────────────────────────────────────────
export const discountTicketService = {

  async getAll(filters = {}) {
    await delay(150)
    if (USE_API) {
      const { data } = await api.get('/tickets', { params: filters })
      return ok(data.data, data.meta?.total)
    }
    let tickets = gs().discountTickets || []
    if (filters.used !== undefined) tickets = tickets.filter((t) => t.used === filters.used)
    if (filters.isActive !== undefined) tickets = tickets.filter((t) => t.isActive === filters.isActive)
    return ok(tickets, tickets.length)
  },

  async create(payload) {
    await delay()
    if (USE_API) {
      const { data } = await api.post('/tickets', payload)
      return ok(data.data)
    }
    const ticket = { ...payload, id: crypto.randomUUID(), used: false, createdAt: new Date().toISOString() }
    gs().addDiscountTicket(ticket)
    return ok(ticket)
  },

  async update(id, updates) {
    await delay()
    if (USE_API) {
      const { data } = await api.put(`/tickets/${id}`, updates)
      return ok(data.data)
    }
    gs().updateDiscountTicket(id, updates)
    return ok({ id, ...updates })
  },

  async remove(id) {
    await delay()
    if (USE_API) { await api.delete(`/tickets/${id}`); return ok({ id, deleted: true }) }
    gs().deleteDiscountTicket(id)
    return ok({ id, deleted: true })
  },

  /** Valida un código de ticket antes de aplicarlo en el POS */
  async validate(code) {
    await delay(100)
    if (USE_API) {
      const { data } = await api.get(`/tickets/validate/${code}`)
      return ok(data.data)
    }
    const ticket = (gs().discountTickets || []).find(
      (t) => t.code?.toUpperCase() === code?.toUpperCase()
    )
    if (!ticket)          return fail('Código no encontrado')
    if (!ticket.isActive) return fail('Ticket desactivado')
    if (ticket.used)      return fail('Ticket ya fue utilizado')
    const now = new Date()
    if (ticket.validFrom && now < new Date(ticket.validFrom))            return fail('Ticket aún no vigente')
    if (ticket.validTo   && now > new Date(ticket.validTo + 'T23:59:59')) return fail('Ticket vencido')
    return ok(ticket)
  },

  /** Canjea un ticket vinculándolo a una venta */
  async redeem(code, saleId, saleTotal, userId) {
    await delay()
    if (USE_API) {
      const { data } = await api.post(`/tickets/${code}/redeem`, { saleId, saleTotal, userId })
      return ok(data.data)
    }
    gs().redeemDiscountTicket(code, saleId, saleTotal, userId)
    return ok({ code, saleId, redeemed: true })
  },
}
