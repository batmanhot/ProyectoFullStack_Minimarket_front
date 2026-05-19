/**
 * useReportMetrics.js — Hook de métricas para el módulo de Reportes
 * Ruta: src/features/reports/hooks/useReportMetrics.js
 *
 * Extrae toda la lógica de cálculo que estaba en el useMemo gigante
 * dentro de Reports.jsx. Beneficios:
 *
 *  1. El componente Reports.jsx queda solo con UI — sin lógica de negocio
 *  2. El hook es testeable de forma independiente
 *  3. Cada métrica se memoiza por separado: si solo cambia `range`,
 *     solo se recalcula `filteredSales` y lo que depende de él,
 *     no el conteo de productos sin movimiento (que depende solo de `sales` y `products`)
 *  4. Preparado para migrar a Web Worker cuando el catálogo supere 1000 SKUs
 */

import { useMemo } from 'react'
import { formatDate, isToday, isThisWeek, isThisMonth, getUnitCost } from '../../../shared/utils/helpers'

// ─── Constante interna ────────────────────────────────────────────────────────
const IGV_RATE = 0.18

/**
 * @param {{
 *   sales:        Array,
 *   products:     Array,
 *   categories:   Array,
 *   returns:      Array,
 *   range:        'today'|'week'|'month'|'all',
 *   systemConfig: Object
 * }} param
 */

export function useReportMetrics({ sales, products, categories, returns = [], range, systemConfig }) {
  const costMethod = systemConfig?.costMethod || 'peps'

  // ── 1. Ventas filtradas por rango de fecha ─────────────────────────────────
  // Incluye 'completada', 'dev-parcial' y 'devolucion': todas son transacciones reales
  // que generaron un comprobante. Las NCs (devoluciones) se registran por separado en
  // returnMetrics y no eliminan el comprobante original del historial.
  // Solo se excluyen 'anulada' y 'cancelada'.
  const filteredSales = useMemo(() => {
    const ACTIVE_STATUSES = new Set(['completada', 'dev-parcial', 'devolucion'])
    const active = sales.filter((s) => ACTIVE_STATUSES.has(s.status))
    if (range === 'today') return active.filter((s) => isToday(s.createdAt))
    if (range === 'week')  return active.filter((s) => isThisWeek(s.createdAt))
    if (range === 'month') return active.filter((s) => isThisMonth(s.createdAt))
    return active
  }, [sales, range])

  // ── 2. KPIs de ventas ──────────────────────────────────────────────────────
  const salesKPIs = useMemo(() => {
    const total     = filteredSales.reduce((a, s) => a + s.total, 0)
    const count     = filteredSales.length
    const avgTicket = count > 0 ? total / count : 0
    const igv       = (total / (1 + IGV_RATE)) * IGV_RATE

    // Utilidad: precio venta - costo según método configurado (PEPS o CPP).
    const utilidad = filteredSales.reduce((acc, s) =>
      acc + s.items.reduce((a2, item) => {
        const product = products.find((pr) => pr.id === item.productId)
        const cost    = getUnitCost(product, item.unitPrice, costMethod)
        return a2 + (item.unitPrice - cost) * item.quantity
      }, 0), 0
    )

    // Descuentos totales del período
    const totalDescuentos = filteredSales.reduce((acc, s) =>
      acc + (s.totalDescuentos || s.discount || 0), 0
    )

    return {
      total:          parseFloat(total.toFixed(2)),
      count,
      avgTicket:      parseFloat(avgTicket.toFixed(2)),
      utilidad:       parseFloat(utilidad.toFixed(2)),
      igv:            parseFloat(igv.toFixed(2)),
      totalDescuentos: parseFloat(totalDescuentos.toFixed(2)),
    }
  }, [filteredSales, products])

  // ── 3. Por método de pago ──────────────────────────────────────────────────
  const byPayment = useMemo(() => {
    const map = {}
    filteredSales.forEach((s) =>
      s.payments?.forEach((p) => {
        map[p.method] = (map[p.method] || 0) + p.amount
      })
    )
    return Object.entries(map).map(([name, value]) => ({
      name:  name.charAt(0).toUpperCase() + name.slice(1),
      value: parseFloat(value.toFixed(2)),
    }))
  }, [filteredSales])

  // ── 4. Por categoría ───────────────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map = {}
    filteredSales.forEach((s) =>
      s.items?.forEach((item) => {
        const product = products.find((p) => p.id === item.productId)
        const catName = categories.find((c) => c.id === product?.categoryId)?.name || 'Sin categoría'
        map[catName] = (map[catName] || 0) + (item.subtotal || 0)
      })
    )
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
  }, [filteredSales, products, categories])

  // ── 5. Top 10 productos ────────────────────────────────────────────────────
  const topProducts = useMemo(() => {
    const map = {}
    filteredSales.forEach((s) =>
      s.items?.forEach((item) => {
        if (!map[item.productId]) {
          map[item.productId] = { name: item.productName, qty: 0, revenue: 0 }
        }
        map[item.productId].qty     += item.quantity
        map[item.productId].revenue += item.subtotal || 0
      })
    )
    return Object.values(map)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map((p) => ({ ...p, revenue: parseFloat(p.revenue.toFixed(2)) }))
  }, [filteredSales])

  // ── 6. Ventas por día (para gráfica de barras) ─────────────────────────────
  const dailyChart = useMemo(() => {
    const map = {}
    filteredSales.forEach((s) => {
      const day = formatDate(s.createdAt)
      map[day] = (map[day] || 0) + s.total
    })
    return Object.entries(map)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([dia, total]) => ({ dia, total: parseFloat(total.toFixed(2)) }))
  }, [filteredSales])

  // ── 7. Productos sin movimiento (últimos 30 días) ──────────────────────────
  // Depende de TODAS las ventas, no solo del rango — es un reporte de inventario.
  const sinMovimiento = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)

    const movedIds = new Set(
      sales
        .filter((s) => new Date(s.createdAt) >= cutoff)
        .flatMap((s) => s.items?.map((i) => i.productId) || [])
    )

    const lista = products.filter((p) => p.isActive && !movedIds.has(p.id))
    const capitalInmovilizado = lista.reduce((acc, p) =>
      acc + getUnitCost(p, p.priceSell || 0, costMethod) * (p.stock || 0), 0)

    return {
      lista:               lista.sort((a, b) => (b.priceBuy * b.stock) - (a.priceBuy * a.stock)),
      capitalInmovilizado: parseFloat(capitalInmovilizado.toFixed(2)),
    }
  }, [sales, products])

  // ── 8. Métricas de devoluciones del período ────────────────────────────────
  const returnMetrics = useMemo(() => {
    // Filtrar NCs activas dentro del mismo rango de fechas que las ventas
    const filteredReturns = (returns || []).filter((r) => {
      if (r.status === 'anulada') return false
      if (range === 'today') return isToday(r.createdAt)
      if (range === 'week')  return isThisWeek(r.createdAt)
      if (range === 'month') return isThisMonth(r.createdAt)
      return true
    })

    const totalReembolsado = filteredReturns.reduce((a, r) => a + r.totalRefund, 0)
    const count            = filteredReturns.length

    // Ventas netas = ventas - devoluciones
    const ventasNetas = parseFloat((salesKPIs.total - totalReembolsado).toFixed(2))

    // Tasa de devolución
    const tasaDevolucion = salesKPIs.count > 0
      ? parseFloat(((count / salesKPIs.count) * 100).toFixed(1))
      : 0

    // Top motivos de devolución
    const motivoMap = {}
    filteredReturns.forEach((r) => {
      motivoMap[r.reasonLabel || r.reason] = (motivoMap[r.reasonLabel || r.reason] || 0) + 1
    })
    const topMotivos = Object.entries(motivoMap)
      .sort((a, b) => b[1] - a[1])
      .map(([motivo, count]) => ({ motivo, count }))

    return {
      list:              filteredReturns,
      count,
      totalReembolsado:  parseFloat(totalReembolsado.toFixed(2)),
      ventasNetas,
      tasaDevolucion,
      topMotivos,
    }
  }, [returns, range, salesKPIs])

  // ── 9. Alertas de productos sin costo registrado ───────────────────────────
  const productsSinCosto = useMemo(() =>
    products.filter((p) => p.isActive && (!p.priceBuy || p.priceBuy <= 0)).length
  , [products])

  // ── 10. RENTABILIDAD POR PRODUCTO ─────────────────────────────────────────
  const rentabilidadProductos = useMemo(() => {
    const map = {}

    filteredSales.forEach(s => {
      s.items?.forEach(item => {
        const product   = products.find(p => p.id === item.productId)
        if (!product) return

        const qty       = item.quantity || 1
        const precioVta = item.unitPrice || 0
        const costo     = getUnitCost(product, precioVta, costMethod)
        const hasCost   = (costMethod === 'cpp')
          ? (product.costAverage > 0 || product.priceBuy > 0)
          : product.priceBuy > 0

        if (!map[item.productId]) {
          map[item.productId] = {
            id:         item.productId,
            name:       item.productName,
            barcode:    product.barcode,
            categoryId: product.categoryId,
            unitCost:   costo,
            unitPrice:  precioVta,
            qtySold:    0,
            revenue:    0,
            costTotal:  0,
            utilidad:   0,
            hasCost,
          }
        }

        map[item.productId].qtySold   += qty
        map[item.productId].revenue   += parseFloat((qty * precioVta).toFixed(2))
        map[item.productId].costTotal += parseFloat((qty * costo).toFixed(2))
        map[item.productId].utilidad  += parseFloat((qty * (precioVta - costo)).toFixed(2))
      })
    })

    return Object.values(map)
      .map(p => ({
        ...p,
        revenue:        parseFloat(p.revenue.toFixed(2)),
        costTotal:      parseFloat(p.costTotal.toFixed(2)),
        utilidad:       parseFloat(p.utilidad.toFixed(2)),
        margenPct:      p.revenue > 0
          ? parseFloat((p.utilidad / p.revenue * 100).toFixed(1))
          : 0,
        margenNegativo: p.utilidad < 0,
      }))
      .sort((a, b) => b.utilidad - a.utilidad)
  }, [filteredSales, products, costMethod])

  // ── 11. RENTABILIDAD POR CATEGORÍA ────────────────────────────────────────
  const rentabilidadCategorias = useMemo(() => {
    const map = {}

    rentabilidadProductos.forEach(p => {
      const cat = categories.find(c => c.id === p.categoryId)
      const catName = cat?.name || 'Sin categoría'
      if (!map[catName]) {
        map[catName] = {
          name:      catName,
          revenue:   0,
          costTotal: 0,
          utilidad:  0,
          productos: 0,
        }
      }
      map[catName].revenue   += p.revenue
      map[catName].costTotal += p.costTotal
      map[catName].utilidad  += p.utilidad
      map[catName].productos += 1
    })

    return Object.values(map)
      .map(c => ({
        ...c,
        revenue:   parseFloat(c.revenue.toFixed(2)),
        costTotal: parseFloat(c.costTotal.toFixed(2)),
        utilidad:  parseFloat(c.utilidad.toFixed(2)),
        margenPct: c.revenue > 0
          ? parseFloat((c.utilidad / c.revenue * 100).toFixed(1))
          : 0,
      }))
      .sort((a, b) => b.utilidad - a.utilidad)
  }, [rentabilidadProductos, categories])

  // ── 12. INVENTARIO VALORIZADO (snapshot contable actual) ─────────────────
  const inventarioValorizado = useMemo(() => {
    const activeProducts = products.filter(p => p.isActive && (p.stock || 0) > 0)

    const rows = activeProducts.map(p => {
      const unitCost   = getUnitCost(p, p.priceSell || 0, costMethod)
      const stockValue = parseFloat((unitCost * (p.stock || 0)).toFixed(2))
      const cat        = p.categoryId
      return {
        id:         p.id,
        name:       p.name,
        barcode:    p.barcode,
        categoryId: cat,
        stock:      p.stock || 0,
        unit:       p.unit || 'u',
        unitCost:   parseFloat(unitCost.toFixed(4)),
        stockValue,
        hasCost:    (costMethod === 'cpp')
          ? (p.costAverage > 0 || p.priceBuy > 0)
          : p.priceBuy > 0,
      }
    }).sort((a, b) => b.stockValue - a.stockValue)

    const totalValue   = parseFloat(rows.reduce((a, r) => a + r.stockValue, 0).toFixed(2))
    const totalSKUs    = rows.length
    const sinCosto     = rows.filter(r => !r.hasCost).length

    // Desglose por categoría
    const catMap = {}
    rows.forEach(r => {
      if (!catMap[r.categoryId]) catMap[r.categoryId] = { value: 0, skus: 0 }
      catMap[r.categoryId].value += r.stockValue
      catMap[r.categoryId].skus  += 1
    })

    return { rows, totalValue, totalSKUs, sinCosto, catMap }
  }, [products, costMethod])

  // ── 13. RESUMEN EJECUTIVO DE RENTABILIDAD ─────────────────────────────────
  const rentabilidadKPIs = useMemo(() => {
    const totalRevenue  = rentabilidadProductos.reduce((a,p) => a+p.revenue,   0)
    const totalCost     = rentabilidadProductos.reduce((a,p) => a+p.costTotal, 0)
    const totalUtil     = rentabilidadProductos.reduce((a,p) => a+p.utilidad,  0)
    const negativos     = rentabilidadProductos.filter(p => p.margenNegativo).length
    const sinCostoItems = rentabilidadProductos.filter(p => !p.hasCost).length
    const margenGlobal  = totalRevenue > 0
      ? parseFloat((totalUtil / totalRevenue * 100).toFixed(1)) : 0

    return {
      totalRevenue:  parseFloat(totalRevenue.toFixed(2)),
      totalCost:     parseFloat(totalCost.toFixed(2)),
      totalUtil:     parseFloat(totalUtil.toFixed(2)),
      margenGlobal,
      negativos,
      sinCostoItems,
    }
  }, [rentabilidadProductos])

  return {
    filteredSales,
    salesKPIs,
    byPayment,
    byCategory,
    topProducts,
    dailyChart,
    sinMovimiento,
    returnMetrics,
    productsSinCosto,
    costMethod,
    inventarioValorizado,
    // Rentabilidad
    rentabilidadProductos,
    rentabilidadCategorias,
    rentabilidadKPIs,
  }
}
