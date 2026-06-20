/**
 * inventoryEngine.js — Motor de selección de artículos y actualización de stock
 * Ruta: src/shared/utils/inventoryEngine.js
 *
 * ESTRATEGIAS SOPORTADAS:
 *  simple     → stock directo en product.stock (ropa, plásticos, librería)
 *  lote_fefo  → FEFO: First Expired First Out (alimentos, medicamentos, cosméticos)
 *  lote_fifo  → FIFO: First In First Out (ferretería, repuestos, ropa con lotes)
 *  serie      → control por número de serie único (electrónica, óptica)
 *               La serie NO acumula stock — solo estado disponible/no disponible.
 *               El stock del producto = cantidad de seriales con status='disponible'.
 */

export const STOCK_CONTROL = {
  SIMPLE:    'simple',
  LOTE_FEFO: 'lote_fefo',
  LOTE_FIFO: 'lote_fifo',
  SERIE:     'serie',
}

export const SECTOR_STOCK_DEFAULTS = {
  bodega:       { defaultControl: 'lote_fefo', useBatches: true,  alertVencimiento: 30 },
  panaderia:    { defaultControl: 'lote_fefo', useBatches: true,  alertVencimiento: 3  },
  carniceria:   { defaultControl: 'lote_fefo', useBatches: true,  alertVencimiento: 5  },
  farmacia:     { defaultControl: 'lote_fefo', useBatches: true,  alertVencimiento: 60 },
  boutique:     { defaultControl: 'simple',    useBatches: false, alertVencimiento: 0  },
  ferreteria:   { defaultControl: 'lote_fifo', useBatches: false, alertVencimiento: 0  },
  electronica:  { defaultControl: 'serie',     useBatches: false, alertVencimiento: 0  },
  libreria:     { defaultControl: 'simple',    useBatches: false, alertVencimiento: 0  },
  optica:       { defaultControl: 'serie',     useBatches: false, alertVencimiento: 0  },
  repuestos:    { defaultControl: 'lote_fifo', useBatches: false, alertVencimiento: 0  },
  regalos:      { defaultControl: 'simple',    useBatches: false, alertVencimiento: 0  },
  otro:         { defaultControl: 'simple',    useBatches: false, alertVencimiento: 0  },
}

const today = () => new Date().toISOString().split('T')[0]

export function calcStockDisponible(product) {
  const control = product.stockControl || STOCK_CONTROL.SIMPLE

  if (control === STOCK_CONTROL.SIMPLE || control === STOCK_CONTROL.SERIE) {
    return product.stock || 0
  }

  const batches = (product.batches || []).filter(b => {
    if (b.status === 'agotado' || b.status === 'merma') return false
    if (control === STOCK_CONTROL.LOTE_FEFO && b.expiryDate) {
      if (b.expiryDate < today()) return false
    }
    return true
  })

  return batches.reduce((sum, b) => sum + (b.quantity || 0), 0)
}

function selectBatchesFEFO(batches, quantityNeeded) {
  const valid = batches
    .filter(b => b.status !== 'agotado' && b.status !== 'merma' && (b.quantity || 0) > 0)
    .filter(b => !b.expiryDate || b.expiryDate >= today())
    .sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return new Date(a.createdAt) - new Date(b.createdAt)
      if (!a.expiryDate) return 1
      if (!b.expiryDate) return -1
      return a.expiryDate.localeCompare(b.expiryDate)
    })
  return allocateFromBatches(valid, quantityNeeded)
}

function selectBatchesFIFO(batches, quantityNeeded) {
  const valid = batches
    .filter(b => b.status !== 'agotado' && b.status !== 'merma' && (b.quantity || 0) > 0)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  return allocateFromBatches(valid, quantityNeeded)
}

function allocateFromBatches(sortedBatches, quantityNeeded) {
  const allocations = []
  let remaining = quantityNeeded

  for (const batch of sortedBatches) {
    if (remaining <= 0) break
    const take = Math.min(remaining, batch.quantity || 0)
    if (take <= 0) continue
    allocations.push({
      batchId:     batch.id,
      batchNumber: batch.batchNumber,
      expiryDate:  batch.expiryDate || null,
      quantity:    take,
      unitCost:    batch.priceBuy || 0,
    })
    remaining -= take
  }

  return { allocations, satisfied: remaining <= 0, remaining }
}

/**
 * allocateStock — Motor central de asignación de inventario.
 *
 * Para productos tipo SERIE:
 *   - selectedSerial: número de serie elegido por el cajero en el POS.
 *   - El stock del producto es un contador de seriales disponibles.
 *   - El marcado real (disponible → vendido) lo hace serialService.markSold()
 *     desde saleService, después de confirmar la venta.
 *   - Este motor solo decrementa el contador de stock y genera el movimiento.
 */
export function allocateStock({ product, quantity, invoiceNumber, userId, selectedSerial }) {
  const control   = product.stockControl || STOCK_CONTROL.SIMPLE
  const available = calcStockDisponible(product)

  if (available < quantity) {
    return {
      error: `Stock insuficiente para "${product.name}". Disponible: ${available} ${product.unit || 'u'}. Solicitado: ${quantity}`,
      batchAllocations: [],
      stockUpdate: null,
      movement: null,
    }
  }

  // ── SIMPLE ──────────────────────────────────────────────────────────────────
  if (control === STOCK_CONTROL.SIMPLE) {
    const prevStock = product.stock || 0
    const newStock  = Math.max(0, prevStock - quantity)
    return {
      error: null,
      batchAllocations: [],
      stockUpdate: { stock: newStock },
      movement: {
        type:          'salida',
        quantity,
        previousStock: prevStock,
        newStock,
        reason:        `Venta ${invoiceNumber}`,
        stockControl:  'simple',
        unitCost:      product.priceBuy || 0,
        totalValue:    parseFloat(((product.priceBuy || 0) * quantity).toFixed(2)),
      },
    }
  }

  // ── SERIE ───────────────────────────────────────────────────────────────────
  // La serie NO acumula stock. El stock = cantidad de seriales disponibles.
  // selectedSerial: el número de serie elegido por el cajero en el modal del POS.
  // El marcado real (disponible → vendido) lo ejecuta serialService.markSold()
  // en saleService.create(), que es quien conoce el selectedSerial real.
  if (control === STOCK_CONTROL.SERIE) {
    const serialNumber = selectedSerial || ''
    const prevStock    = product.stock || 0
    const newStock     = Math.max(0, prevStock - 1)
    return {
      error: null,
      batchAllocations: [{ batchNumber: serialNumber, quantity: 1 }],
      stockUpdate: { stock: newStock, serialNumber: '' },
      movement: {
        type:          'salida',
        quantity:      1,
        previousStock: prevStock,
        newStock,
        reason:        `Venta ${invoiceNumber} · Serie: ${serialNumber}`,
        stockControl:  'serie',
        serialNumber,
        unitCost:      product.priceBuy || 0,
        totalValue:    parseFloat(((product.priceBuy || 0) * quantity).toFixed(2)),
      },
    }
  }

  // ── LOTE FEFO / FIFO ──────────────────────────────────────────────────────
  const batches = product.batches || []
  const { allocations, satisfied, remaining } =
    control === STOCK_CONTROL.LOTE_FEFO
      ? selectBatchesFEFO(batches, quantity)
      : selectBatchesFIFO(batches, quantity)

  if (!satisfied) {
    return {
      error: `Stock insuficiente en lotes para "${product.name}". Faltante: ${remaining} ${product.unit || 'u'}`,
      batchAllocations: [],
      stockUpdate: null,
      movement: null,
    }
  }

  const updatedBatches = batches.map(b => {
    const alloc = allocations.find(a => a.batchId === b.id)
    if (!alloc) return b
    const newQty = (b.quantity || 0) - alloc.quantity
    return { ...b, quantity: newQty, status: newQty <= 0 ? 'agotado' : b.status }
  })

  const newStock  = updatedBatches.filter(b => b.status !== 'agotado' && b.status !== 'merma').reduce((sum, b) => sum + (b.quantity || 0), 0)
  const prevStock = available
  const loteDesc  = allocations.map(a => `Lote ${a.batchNumber}${a.expiryDate ? ` (vence: ${a.expiryDate})` : ''}: ${a.quantity}`).join(' | ')
  const avgCost   = allocations.length > 0 ? parseFloat((allocations.reduce((s, a) => s + a.unitCost * a.quantity, 0) / quantity).toFixed(4)) : product.priceBuy || 0

  return {
    error: null,
    batchAllocations: allocations,
    stockUpdate: { batches: updatedBatches, stock: newStock },
    movement: {
      type:             'salida',
      quantity,
      previousStock:    prevStock,
      newStock,
      reason:           `Venta ${invoiceNumber} · ${control.toUpperCase()} · ${loteDesc}`,
      stockControl:     control,
      batchAllocations: allocations,
      unitCost:         avgCost,
      totalValue:       parseFloat((avgCost * quantity).toFixed(2)),
    },
  }
}

// ─── MOTOR DE MERMA ───────────────────────────────────────────────────────────
export function allocateMerma({ product, quantity, reason, batchId, userId }) {
  const control = product.stockControl || STOCK_CONTROL.SIMPLE

  if (control === STOCK_CONTROL.SIMPLE || control === STOCK_CONTROL.SERIE) {
    const prevStock = product.stock || 0
    const newStock  = Math.max(0, prevStock - quantity)
    return {
      error:       null,
      stockUpdate: { stock: newStock },
      mermaRecord: {
        id:          crypto.randomUUID(),
        productId:   product.id,
        productName: product.name,
        quantity,
        reason,
        status:      'en_merma',
        batchId:     null,
        batchNumber: null,
        createdAt:   new Date().toISOString(),
      },
      movement: {
        type:          'merma',
        quantity,
        previousStock: prevStock,
        newStock,
        reason:        `Merma: ${reason}`,
        stockControl:  control,
        unitCost:      product.priceBuy || 0,
        totalValue:    parseFloat(((product.priceBuy || 0) * quantity).toFixed(2)),
      },
    }
  }

  const batches = product.batches || []
  const batch   = batchId ? batches.find(b => b.id === batchId) : batches[0]

  if (!batch) {
    return { error: 'No se encontró el lote indicado', stockUpdate: null, mermaRecord: null, movement: null }
  }

  const take       = Math.min(quantity, batch.quantity || 0)
  const newBatQty  = (batch.quantity || 0) - take
  const updatedBatches = batches.map(b => b.id === batch.id
    ? { ...b, quantity: newBatQty, status: newBatQty <= 0 ? 'merma' : b.status }
    : b
  )
  const newStock  = updatedBatches.filter(b => b.status !== 'agotado' && b.status !== 'merma').reduce((sum, b) => sum + (b.quantity || 0), 0)
  const prevStock = calcStockDisponible(product)

  return {
    error:       null,
    stockUpdate: { batches: updatedBatches, stock: newStock },
    mermaRecord: {
      id:          crypto.randomUUID(),
      productId:   product.id,
      productName: product.name,
      quantity:    take,
      reason,
      status:      'en_merma',
      batchId:     batch.id,
      batchNumber: batch.batchNumber,
      expiryDate:  batch.expiryDate || null,
      createdAt:   new Date().toISOString(),
    },
    movement: {
      type:          'merma',
      quantity:      take,
      previousStock: prevStock,
      newStock,
      reason:        `Merma: ${reason} · Lote ${batch.batchNumber}`,
      stockControl:  control,
      batchId:       batch.id,
      batchNumber:   batch.batchNumber,
      unitCost:      batch.priceBuy || product.priceBuy || 0,
      totalValue:    parseFloat(((batch.priceBuy || product.priceBuy || 0) * take).toFixed(2)),
    },
  }
}

// ─── ALERTAS AUTOMÁTICAS ──────────────────────────────────────────────────────
export function detectStockAlerts(products, systemConfig) {
  const alerts    = []
  const expiryDays = systemConfig?.expiryAlertDays ?? 30

  for (const p of products) {
    if (!p.isActive) continue
    const control   = p.stockControl || 'simple'
    const available = calcStockDisponible(p)

    if (available <= (p.stockMin || 0) && available > 0) {
      alerts.push({ type: 'stock_bajo', productId: p.id, productName: p.name, available, stockMin: p.stockMin, control })
    }
    if (available <= 0) {
      alerts.push({ type: 'sin_stock', productId: p.id, productName: p.name, available: 0, control })
    }

    if (control === 'lote_fefo' && p.batches?.length) {
      for (const batch of p.batches) {
        if (!batch.expiryDate || batch.status === 'agotado' || batch.status === 'merma') continue
        const daysLeft = Math.ceil((new Date(batch.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
        if (daysLeft < 0) {
          alerts.push({ type: 'vencido',    productId: p.id, productName: p.name, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, daysLeft, control })
        } else if (daysLeft <= expiryDays) {
          alerts.push({ type: 'por_vencer', productId: p.id, productName: p.name, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, daysLeft, control })
        }
      }
    }
  }

  return alerts
}
