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
import { formatDate } from '../../../shared/utils/helpers'
import { isToday, isThisWeek, isThisMonth } from '../../../shared/utils/helpers'

// ─── Constante interna ────────────────────────────────────────────────────────
const IGV_RATE = 0.18

/**
 * @param {{
 *   sales:      Array,
 *   products:   Array,
 *   categories: Array,
 *   returns:    Array,
 *   range:      'today'|'week'|'month'|'all'
 * }} param
 */
export function useReportMetrics({ sales, products, categories, returns = [], range }) {

  // ── 1. Ventas filtradas por rango de fecha ─────────────────────────────────
  const filteredSales = useMemo(() => {
    const completed = sales.filter((s) => s.status === 'completada')
    if (range === 'today') return completed.filter((s) => isToday(s.createdAt))
    if (range === 'week')  return completed.filter((s) => isThisWeek(s.createdAt))
    if (range === 'month') return completed.filter((s) => isThisMonth(s.createdAt))
    return completed
  }, [sales, range])

  // ── 2. KPIs de ventas ──────────────────────────────────────────────────────
  const salesKPIs = useMemo(() => {
    const total     = filteredSales.reduce((a, s) => a + s.total, 0)
    const count     = filteredSales.length
    const avgTicket = count > 0 ? total / count : 0
    const igv       = (total / (1 + IGV_RATE)) * IGV_RATE

    // Utilidad: precio venta - costo. Si priceBuy es 0, usa 70% del precio de venta.
    const utilidad = filteredSales.reduce((acc, s) =>
      acc + s.items.reduce((a2, item) => {
        const product = products.find((pr) => pr.id === item.productId)
        const cost    = product?.priceBuy > 0
          ? product.priceBuy
          : item.unitPrice * 0.7          // estimado conservador
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
    const capitalInmovilizado = lista.reduce((acc, p) => acc + (p.priceBuy || 0) * p.stock, 0)

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
  // Para avisar que la utilidad puede ser estimada y no real.
  const productsSinCosto = useMemo(() =>
    products.filter((p) => p.isActive && (!p.priceBuy || p.priceBuy <= 0)).length
  , [products])

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
  }
}
