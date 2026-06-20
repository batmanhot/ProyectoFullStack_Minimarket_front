/**
 * Tests unitarios: Zod schemas de validación
 * Cubre: productSchema, clientSchema, userSchema, businessConfigSchema,
 *        openCashSchema, closeCashSchema, stockAdjustSchema, paymentItemSchema
 */
import { describe, it, expect } from 'vitest'
import {
  productSchema,
  clientSchema,
  userSchema,
  businessConfigSchema,
  openCashSchema,
  closeCashSchema,
  stockAdjustSchema,
  paymentItemSchema,
} from '../../shared/schemas/index'

// ═══════════════════════════════════════════════════════════════════════════════
// productSchema
// ═══════════════════════════════════════════════════════════════════════════════
describe('productSchema', () => {
  const valid = {
    name: 'Arroz Costeño 1kg',
    barcode: '123456789',
    priceSell: 5.5,
    priceBuy: 3.2,
    stockControl: 'simple',
    type: 'simple',
  }

  it('acepta un producto válido', () => {
    const r = productSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it('nombre demasiado corto → error', () => {
    const r = productSchema.safeParse({ ...valid, name: 'A' })
    expect(r.success).toBe(false)
    const msg = r.error.issues[0].message
    expect(msg).toBeDefined()
  })

  it('barcode vacío → error', () => {
    const r = productSchema.safeParse({ ...valid, barcode: '' })
    expect(r.success).toBe(false)
  })

  it('priceSell negativo → error', () => {
    const r = productSchema.safeParse({ ...valid, priceSell: -1 })
    expect(r.success).toBe(false)
  })

  it('priceBuy 0 es válido', () => {
    const r = productSchema.safeParse({ ...valid, priceBuy: 0 })
    expect(r.success).toBe(true)
  })

  it('stockControl inválido → error', () => {
    const r = productSchema.safeParse({ ...valid, stockControl: 'invalido' })
    expect(r.success).toBe(false)
  })

  it('stockControl=lote_fefo es válido', () => {
    const r = productSchema.safeParse({ ...valid, stockControl: 'lote_fefo' })
    expect(r.success).toBe(true)
  })

  it('stockControl=lote_fifo es válido', () => {
    const r = productSchema.safeParse({ ...valid, stockControl: 'lote_fifo' })
    expect(r.success).toBe(true)
  })

  it('stockControl=serie es válido', () => {
    const r = productSchema.safeParse({ ...valid, stockControl: 'serie' })
    expect(r.success).toBe(true)
  })

  it('type=bundle es válido', () => {
    const r = productSchema.safeParse({ ...valid, type: 'bundle' })
    expect(r.success).toBe(true)
  })

  it('type inválido → error', () => {
    const r = productSchema.safeParse({ ...valid, type: 'kit' })
    expect(r.success).toBe(false)
  })

  it('priceSell como string numérico es coercionado', () => {
    const r = productSchema.safeParse({ ...valid, priceSell: '7.50' })
    expect(r.success).toBe(true)
    expect(r.data?.priceSell).toBe(7.5)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// clientSchema
// ═══════════════════════════════════════════════════════════════════════════════
describe('clientSchema', () => {
  const valid = {
    name: 'Juan Pérez',
    documentType: 'DNI',
    documentNumber: '12345678',
  }

  it('acepta un cliente válido', () => {
    const r = clientSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it('nombre demasiado corto → error', () => {
    const r = clientSchema.safeParse({ ...valid, name: 'J' })
    expect(r.success).toBe(false)
  })

  it('documentType inválido → error', () => {
    const r = clientSchema.safeParse({ ...valid, documentType: 'PASAPORTE_INVALID' })
    expect(r.success).toBe(false)
  })

  it('documentNumber demasiado corto → error', () => {
    const r = clientSchema.safeParse({ ...valid, documentNumber: '1234' })
    expect(r.success).toBe(false)
  })

  it('documentType=RUC es válido', () => {
    const r = clientSchema.safeParse({ ...valid, documentType: 'RUC', documentNumber: '20123456789' })
    expect(r.success).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// userSchema
// ═══════════════════════════════════════════════════════════════════════════════
describe('userSchema', () => {
  const valid = {
    username:        'juan_admin',
    fullName:        'Juan Administrador',
    email:           'juan@test.com',
    role:            'cajero',
    password:        'secreto123',
    confirmPassword: 'secreto123',
  }

  it('acepta un usuario válido', () => {
    const r = userSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it('username con caracteres inválidos → error', () => {
    const r = userSchema.safeParse({ ...valid, username: 'juan@admin' })
    expect(r.success).toBe(false)
  })

  it('username con espacio → error', () => {
    const r = userSchema.safeParse({ ...valid, username: 'juan admin' })
    expect(r.success).toBe(false)
  })

  it('password y confirmPassword distintas → error', () => {
    const r = userSchema.safeParse({ ...valid, confirmPassword: 'otra-clave' })
    expect(r.success).toBe(false)
    const msgs = r.error.issues.map(i => i.message).join(' ')
    expect(msgs).toContain('coinciden')
  })

  it('username con guion bajo es válido', () => {
    const r = userSchema.safeParse({ ...valid, username: 'juan_2024' })
    expect(r.success).toBe(true)
  })

  it('username con números es válido', () => {
    const r = userSchema.safeParse({ ...valid, username: 'user123' })
    expect(r.success).toBe(true)
  })

  it('email inválido → error', () => {
    const r = userSchema.safeParse({ ...valid, email: 'no-es-email' })
    expect(r.success).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// businessConfigSchema
// ═══════════════════════════════════════════════════════════════════════════════
describe('businessConfigSchema', () => {
  it('acepta un objeto de config válido', () => {
    const r = businessConfigSchema.safeParse({
      name: 'Minimarket Don Juan',
      ruc: '20123456789',
    })
    expect(r.success).toBe(true)
  })

  it('nombre demasiado corto → error', () => {
    const r = businessConfigSchema.safeParse({ name: 'A' })
    expect(r.success).toBe(false)
  })

  it('sin nombre → error (name es requerido)', () => {
    const r = businessConfigSchema.safeParse({ ruc: '20123456789' })
    expect(r.success).toBe(false)
  })

  it('igvRate válido entre 0 y 1', () => {
    const r = businessConfigSchema.safeParse({ name: 'Mi Tienda', igvRate: 0.10 })
    expect(r.success).toBe(true)
    expect(r.data?.igvRate).toBe(0.10)
  })

  it('igvRate mayor a 1 → error', () => {
    const r = businessConfigSchema.safeParse({ name: 'Mi Tienda', igvRate: 1.5 })
    expect(r.success).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// openCashSchema — campo: openingAmount
// ═══════════════════════════════════════════════════════════════════════════════
describe('openCashSchema', () => {
  it('acepta apertura válida con monto inicial', () => {
    const r = openCashSchema.safeParse({ openingAmount: 200 })
    expect(r.success).toBe(true)
  })

  it('monto negativo → error', () => {
    const r = openCashSchema.safeParse({ openingAmount: -10 })
    expect(r.success).toBe(false)
  })

  it('monto 0 es válido (sin fondo de caja)', () => {
    const r = openCashSchema.safeParse({ openingAmount: 0 })
    expect(r.success).toBe(true)
  })

  it('notas opcionales son aceptadas', () => {
    const r = openCashSchema.safeParse({ openingAmount: 100, notes: 'Apertura temprana' })
    expect(r.success).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// closeCashSchema — campo: countedAmount
// ═══════════════════════════════════════════════════════════════════════════════
describe('closeCashSchema', () => {
  it('acepta cierre válido', () => {
    const r = closeCashSchema.safeParse({ countedAmount: 500 })
    expect(r.success).toBe(true)
  })

  it('monto negativo → error', () => {
    const r = closeCashSchema.safeParse({ countedAmount: -1 })
    expect(r.success).toBe(false)
  })

  it('monto 0 es válido (caja vacía)', () => {
    const r = closeCashSchema.safeParse({ countedAmount: 0 })
    expect(r.success).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// stockAdjustSchema — campos: quantity, type, reason
// ═══════════════════════════════════════════════════════════════════════════════
describe('stockAdjustSchema', () => {
  const valid = { quantity: 10, type: 'entrada', reason: 'Inventario físico' }

  it('acepta ajuste de stock válido', () => {
    const r = stockAdjustSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it('reason vacío → error', () => {
    const r = stockAdjustSchema.safeParse({ ...valid, reason: '' })
    expect(r.success).toBe(false)
  })

  it('reason muy corto (< 3 chars) → error', () => {
    const r = stockAdjustSchema.safeParse({ ...valid, reason: 'ok' })
    expect(r.success).toBe(false)
  })

  it('quantity negativa → error (debe ser positiva)', () => {
    const r = stockAdjustSchema.safeParse({ ...valid, quantity: -5 })
    expect(r.success).toBe(false)
  })

  it('quantity 0 → error (debe ser positiva)', () => {
    const r = stockAdjustSchema.safeParse({ ...valid, quantity: 0 })
    expect(r.success).toBe(false)
  })

  it('type=salida es válido', () => {
    const r = stockAdjustSchema.safeParse({ ...valid, type: 'salida' })
    expect(r.success).toBe(true)
  })

  it('type=merma es válido', () => {
    const r = stockAdjustSchema.safeParse({ ...valid, type: 'merma' })
    expect(r.success).toBe(true)
  })

  it('type inválido → error', () => {
    const r = stockAdjustSchema.safeParse({ ...valid, type: 'robo' })
    expect(r.success).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// paymentItemSchema
// ═══════════════════════════════════════════════════════════════════════════════
describe('paymentItemSchema', () => {
  it('acepta pago válido en efectivo', () => {
    const r = paymentItemSchema.safeParse({ method: 'efectivo', amount: 25.50 })
    expect(r.success).toBe(true)
  })

  it('método inválido → error', () => {
    const r = paymentItemSchema.safeParse({ method: 'criptomoneda', amount: 100 })
    expect(r.success).toBe(false)
  })

  it('monto negativo → error', () => {
    const r = paymentItemSchema.safeParse({ method: 'efectivo', amount: -5 })
    expect(r.success).toBe(false)
  })

  it('método=tarjeta es válido', () => {
    const r = paymentItemSchema.safeParse({ method: 'tarjeta', amount: 100 })
    expect(r.success).toBe(true)
  })

  it('método=credito es válido', () => {
    const r = paymentItemSchema.safeParse({ method: 'credito', amount: 200 })
    expect(r.success).toBe(true)
  })

  it('método=transferencia es válido', () => {
    const r = paymentItemSchema.safeParse({ method: 'transferencia', amount: 500 })
    expect(r.success).toBe(true)
  })
})
