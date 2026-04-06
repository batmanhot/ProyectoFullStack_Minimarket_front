import { APP_CONFIG } from '../../config/app'

// ─── IDs ──────────────────────────────────────────────────────────────────────
export const generateId = () => crypto.randomUUID()

export function subtractDays(days, hours = 12, minutes = 0) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hours, minutes, 0, 0)
  return d.toISOString()
}

// ─── MONEDA ───────────────────────────────────────────────────────────────────
export const formatCurrency = (amount) =>
  new Intl.NumberFormat(APP_CONFIG.locale, {
    style: 'currency',
    currency: APP_CONFIG.currency,
  }).format(amount ?? 0)

export const formatNumber = (n, decimals = 2) =>
  parseFloat((n ?? 0).toFixed(decimals))

// ─── FECHAS ───────────────────────────────────────────────────────────────────
export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export const formatTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—'

export const getHour = (iso) => new Date(iso).getHours()

export const isToday = (iso) => {
  const d = new Date(iso), now = new Date()
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

export const isThisWeek = (iso) => {
  const d = new Date(iso), now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  return d >= weekStart
}

export const isThisMonth = (iso) => {
  const d = new Date(iso), now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

export const daysUntil = (iso) => {
  if (!iso) return null
  const diff = new Date(iso) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ─── INVOICE ──────────────────────────────────────────────────────────────────
export const formatInvoice = (n) => `B001-${String(n).padStart(6, '0')}`

// ─── CÁLCULOS POS ─────────────────────────────────────────────────────────────
export const calcCartTotals = (items) => {
  const subtotal  = formatNumber(items.reduce((acc, i) => acc + i.subtotal, 0))
  const discount  = formatNumber(items.reduce((acc, i) => acc + (i.discount || 0), 0))
  const base      = formatNumber(subtotal - discount)
  const baseImpon = formatNumber(base / (1 + APP_CONFIG.igvRate))
  const tax       = formatNumber(base - baseImpon)
  return { subtotal, discount, base, tax, total: base }
}

export const calcChange = (total, received) =>
  formatNumber(Math.max(0, (received ?? 0) - (total ?? 0)))

// Sugerir desglose de vuelto en billetes/monedas peruanas
export const calcBilletes = (amount) => {
  const denominations = [200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10]
  const result = []
  let remaining = Math.round(amount * 100) / 100
  for (const d of denominations) {
    const count = Math.floor(remaining / d)
    if (count > 0) {
      result.push({ denomination: d, count })
      remaining = Math.round((remaining - d * count) * 100) / 100
    }
  }
  return result
}

// ─── STOCK ────────────────────────────────────────────────────────────────────
export const isLowStock  = (p) => p.stock > 0 && p.stock <= p.stockMin
export const isOutOfStock = (p) => p.stock === 0
export const isExpired   = (p) => p.expiryDate && new Date(p.expiryDate) < new Date()
export const isNearExpiry = (p, days = 30) => {
  if (!p.expiryDate) return false
  const d = daysUntil(p.expiryDate)
  return d !== null && d >= 0 && d <= days
}

// Proyección de días de stock basado en promedio de salidas (últimos 7 días)
export const stockDaysLeft = (product, stockMovements) => {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const exits = stockMovements
    .filter(m => m.productId === product.id && m.type === 'salida' && new Date(m.createdAt) >= sevenDaysAgo)
    .reduce((acc, m) => acc + m.quantity, 0)
  const avgPerDay = exits / 7
  if (avgPerDay <= 0) return null
  return Math.floor(product.stock / avgPerDay)
}

// ─── BÚSQUEDA ─────────────────────────────────────────────────────────────────
export const fuzzySearch = (query, items, fields = ['name', 'barcode', 'description', 'sku']) => {
  if (!query?.trim()) return items
  const q = query.toLowerCase().trim()
  return items.filter(item =>
    fields.some(f => {
      const val = item[f]
      if (!val) return false
      if (typeof val === 'string') return val.toLowerCase().includes(q)
      if (typeof val === 'object') return Object.values(val).some(v => String(v).toLowerCase().includes(q))
      return false
    })
  )
}

// ─── EXPORTAR CSV ─────────────────────────────────────────────────────────────
export const exportCSV = (data, filename) => {
  if (!data?.length) return
  const keys = Object.keys(data[0])
  const csv = [keys.join(','), ...data.map(row =>
    keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(',')
  )].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${filename}_${formatDate(new Date().toISOString())}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ─── KPIs DASHBOARD ───────────────────────────────────────────────────────────
export const calcDashboardKPIs = (sales, products, stockMovements) => {
  const completed = sales.filter(s => s.status === 'completada')
  const todaySales = completed.filter(s => isToday(s.createdAt))
  const weekSales  = completed.filter(s => isThisWeek(s.createdAt))
  const monthSales = completed.filter(s => isThisMonth(s.createdAt))

  // Ayer para comparativo
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yesterdaySales = completed.filter(s => {
    const d = new Date(s.createdAt)
    return d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear()
  })

  const ventasHoy       = formatNumber(todaySales.reduce((a, s) => a + s.total, 0))
  const ventasAyer      = formatNumber(yesterdaySales.reduce((a, s) => a + s.total, 0))
  const transaccionesHoy = todaySales.length
  const ticketPromedio  = transaccionesHoy > 0 ? formatNumber(ventasHoy / transaccionesHoy) : 0
  const ventasSemana    = formatNumber(weekSales.reduce((a, s) => a + s.total, 0))
  const ventasMes       = formatNumber(monthSales.reduce((a, s) => a + s.total, 0))

  // Tendencia hoy vs ayer
  const tendenciaHoy = ventasAyer > 0
    ? formatNumber(((ventasHoy - ventasAyer) / ventasAyer) * 100, 1)
    : null

  // Utilidad neta estimada del mes (ventas - costo de lo vendido)
  const utilidadMes = formatNumber(monthSales.reduce((acc, s) => {
    return acc + (s.payments?.find(p => p.method !== 'credito') ? 1 : 1) * s.items.reduce((a2, item) => {
      const p = products.find(pr => pr.id === item.productId)
      return a2 + (item.unitPrice - (p?.priceBuy || item.unitPrice * 0.7)) * item.quantity
    }, 0)
  }, 0))

  // Valor del inventario
  const valorInventarioCosto  = formatNumber(products.filter(p => p.isActive).reduce((a, p) => a + p.priceBuy * p.stock, 0))
  const valorInventarioVenta  = formatNumber(products.filter(p => p.isActive).reduce((a, p) => a + p.priceSell * p.stock, 0))

  const productosAlerta    = products.filter(p => p.isActive && (isLowStock(p) || isOutOfStock(p))).length
  const productosPorVencer = products.filter(p => p.isActive && isNearExpiry(p, 30)).length

  // Top 5
  const productQty = {}
  completed.forEach(s => {
    s.items?.forEach(i => {
      productQty[i.productId] = (productQty[i.productId] || 0) + i.quantity
    })
  })
  const top5 = Object.entries(productQty)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, qty]) => {
      const p = products.find(pr => pr.id === id)
      return { id, name: p?.name || 'Producto', qty }
    })

  // Métodos de pago del mes
  const paymentTotals = {}
  monthSales.forEach(s => {
    s.payments?.forEach(p => {
      paymentTotals[p.method] = (paymentTotals[p.method] || 0) + p.amount
    })
  })

  // Gráfico ventas por hora hoy
  const ventasPorHora = Array.from({ length: 14 }, (_, i) => {
    const h = i + 7
    const total = todaySales.filter(s => getHour(s.createdAt) === h).reduce((a, s) => a + s.total, 0)
    return { hora: `${h}:00`, total: formatNumber(total) }
  })

  // Últimos 7 días
  const ventasUltimos7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const dayStr = d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })
    const dayTotal = completed.filter(s => {
      const sd = new Date(s.createdAt)
      return sd.getDate() === d.getDate() && sd.getMonth() === d.getMonth()
    }).reduce((a, s) => a + s.total, 0)
    return { dia: dayStr, total: formatNumber(dayTotal) }
  })

  return {
    ventasHoy, ventasAyer, tendenciaHoy, transaccionesHoy, ticketPromedio,
    ventasSemana, ventasMes, utilidadMes,
    valorInventarioCosto, valorInventarioVenta,
    productosAlerta, productosPorVencer,
    top5, paymentTotals, ventasPorHora, ventasUltimos7,
  }
}
