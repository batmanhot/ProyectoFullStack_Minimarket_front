/**
 * Tests unitarios: configSlice
 * Usa la misma fábrica set/get que authSlice.test.js
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createConfigSlice } from '../../store/slices/configSlice'

// ─── Fábrica de store ─────────────────────────────────────────────────────────
function makeStore(overrides = {}) {
  let state = {
    addAuditLog: vi.fn(),
    ...overrides,
  }

  const get = () => state
  const set = (updater) => {
    const partial = typeof updater === 'function' ? updater(state) : updater
    state = { ...state, ...partial }
  }

  const slice = createConfigSlice(set, get)
  state = { ...state, ...slice }
  return { get }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Valores iniciales
// ═══════════════════════════════════════════════════════════════════════════════
describe('configSlice — valores por defecto', () => {
  it('systemConfig tiene igvRate 0.18 y los demás defaults', () => {
    const { get } = makeStore()
    expect(get().systemConfig.igvRate).toBe(0.18)
    expect(get().systemConfig).toHaveProperty('auditEnabled')
    expect(get().systemConfig).toHaveProperty('currencySymbol')
    expect(get().systemConfig).toHaveProperty('allowDiscounts')
  })

  it('alertRules comienza vacío', () => {
    const { get } = makeStore()
    expect(Array.isArray(get().alertRules)).toBe(true)
    expect(get().alertRules).toHaveLength(0)
  })

  it('notifications comienza vacío', () => {
    const { get } = makeStore()
    expect(Array.isArray(get().notifications)).toBe(true)
    expect(get().notifications).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// updateSystemConfig
// ═══════════════════════════════════════════════════════════════════════════════
describe('configSlice.updateSystemConfig', () => {
  it('actualiza solo el campo indicado (merge parcial)', () => {
    const { get } = makeStore()
    const original = { ...get().systemConfig }
    get().updateSystemConfig({ igvRate: 0.10 })
    expect(get().systemConfig.igvRate).toBe(0.10)
    // El resto se conserva
    expect(get().systemConfig.roundingMode).toBe(original.roundingMode)
    expect(get().systemConfig.auditEnabled).toBe(original.auditEnabled)
  })

  it('actualiza múltiples campos a la vez', () => {
    const { get } = makeStore()
    get().updateSystemConfig({ igvRate: 0.08, auditEnabled: true })
    expect(get().systemConfig.igvRate).toBe(0.08)
    expect(get().systemConfig.auditEnabled).toBe(true)
  })

  it('agrega entrada en el audit log', () => {
    const { get } = makeStore()
    get().updateSystemConfig({ igvRate: 0.10 })
    expect(get().addAuditLog).toHaveBeenCalledOnce()
    const logEntry = get().addAuditLog.mock.calls[0][0]
    expect(logEntry).toHaveProperty('action')
    expect(logEntry).toHaveProperty('module')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// updateBusinessConfig
// ═══════════════════════════════════════════════════════════════════════════════
describe('configSlice.updateBusinessConfig', () => {
  it('actualiza businessConfig por merge parcial', () => {
    const { get } = makeStore()
    get().updateBusinessConfig({ businessName: 'Mi Minimarket' })
    expect(get().businessConfig.businessName).toBe('Mi Minimarket')
  })

  it('conserva los demás campos de businessConfig', () => {
    const { get } = makeStore()
    get().updateBusinessConfig({ businessName: 'Nombre 1' })
    get().updateBusinessConfig({ ruc: '20123456789' })
    expect(get().businessConfig.businessName).toBe('Nombre 1')
    expect(get().businessConfig.ruc).toBe('20123456789')
  })

  it('agrega entrada en el audit log', () => {
    const { get } = makeStore()
    get().updateBusinessConfig({ businessName: 'Test' })
    expect(get().addAuditLog).toHaveBeenCalledOnce()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// alertRules — CRUD
// ═══════════════════════════════════════════════════════════════════════════════
describe('configSlice — alertRules CRUD', () => {
  it('addAlertRule agrega una regla al array', () => {
    const { get } = makeStore()
    const rule = { type: 'stock_bajo', threshold: 5, productId: 'prd-001' }
    get().addAlertRule(rule)
    expect(get().alertRules).toHaveLength(1)
    expect(get().alertRules[0]).toMatchObject(rule)
  })

  it('addAlertRule asigna un id único', () => {
    const { get } = makeStore()
    get().addAlertRule({ type: 'stock_bajo', threshold: 3 })
    get().addAlertRule({ type: 'vencimiento', threshold: 7 })
    const ids = get().alertRules.map(r => r.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('updateAlertRule modifica la regla indicada por id', () => {
    const { get } = makeStore()
    get().addAlertRule({ type: 'stock_bajo', threshold: 5 })
    const id = get().alertRules[0].id
    get().updateAlertRule(id, { threshold: 10 })
    expect(get().alertRules[0].threshold).toBe(10)
    expect(get().alertRules[0].type).toBe('stock_bajo')
  })

  it('updateAlertRule no afecta otras reglas', () => {
    const { get } = makeStore()
    // addAlertRule prepende → [rule2(30), rule1(5)] tras agregar ambas
    get().addAlertRule({ type: 'stock_bajo', threshold: 5 })
    get().addAlertRule({ type: 'vencimiento', threshold: 30 })
    // Actualizamos la segunda (rule1, threshold=5)
    const secondId = get().alertRules[1].id
    get().updateAlertRule(secondId, { threshold: 99 })
    // La primera (rule2, threshold=30) no debe cambiar
    expect(get().alertRules[0].threshold).toBe(30)
  })

  it('deleteAlertRule elimina la regla por id', () => {
    const { get } = makeStore()
    get().addAlertRule({ type: 'stock_bajo', threshold: 5 })
    const id = get().alertRules[0].id
    get().deleteAlertRule(id)
    expect(get().alertRules).toHaveLength(0)
  })

  it('deleteAlertRule deja las demás reglas intactas', () => {
    const { get } = makeStore()
    // addAlertRule prepende → tras agregar A y B: [B, A]
    get().addAlertRule({ type: 'tipo-A', threshold: 1 })
    get().addAlertRule({ type: 'tipo-B', threshold: 2 })
    // Eliminamos la segunda (tipo-A, está en índice 1)
    const secondId = get().alertRules[1].id
    get().deleteAlertRule(secondId)
    expect(get().alertRules).toHaveLength(1)
    expect(get().alertRules[0].type).toBe('tipo-B')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// notifications
// ═══════════════════════════════════════════════════════════════════════════════
describe('configSlice — notifications', () => {
  it('addNotification agrega una notificación con read=false', () => {
    const { get } = makeStore()
    get().addNotification({ title: 'Stock bajo', body: 'Arroz sin stock' })
    expect(get().notifications).toHaveLength(1)
    expect(get().notifications[0].read).toBe(false)
    expect(get().notifications[0].title).toBe('Stock bajo')
  })

  it('addNotification inserta al principio (más reciente primero)', () => {
    const { get } = makeStore()
    get().addNotification({ title: 'Primera' })
    get().addNotification({ title: 'Segunda' })
    expect(get().notifications[0].title).toBe('Segunda')
    expect(get().notifications[1].title).toBe('Primera')
  })

  it('markNotifRead marca la notificación como leída', () => {
    const { get } = makeStore()
    get().addNotification({ title: 'Stock bajo' })
    const id = get().notifications[0].id
    get().markNotifRead(id)
    expect(get().notifications[0].read).toBe(true)
  })

  it('markNotifRead no afecta otras notificaciones', () => {
    const { get } = makeStore()
    get().addNotification({ title: 'A' })
    get().addNotification({ title: 'B' })
    const idB = get().notifications[0].id // B es la más reciente (índice 0)
    get().markNotifRead(idB)
    expect(get().notifications[0].read).toBe(true)
    expect(get().notifications[1].read).toBe(false)
  })

  it('markAllNotifsRead marca todas como leídas', () => {
    const { get } = makeStore()
    get().addNotification({ title: 'A' })
    get().addNotification({ title: 'B' })
    get().addNotification({ title: 'C' })
    get().markAllNotifsRead()
    get().notifications.forEach(n => expect(n.read).toBe(true))
  })

  it('no supera el límite de 200 notificaciones', () => {
    const { get } = makeStore()
    for (let i = 0; i < 210; i++) {
      get().addNotification({ title: `Notif ${i}` })
    }
    expect(get().notifications.length).toBeLessThanOrEqual(200)
  })

  it('la notificación más reciente se conserva al recortar', () => {
    const { get } = makeStore()
    for (let i = 0; i < 205; i++) {
      get().addNotification({ title: `Notif ${i}` })
    }
    // La última agregada debe seguir siendo la primera en el array
    expect(get().notifications[0].title).toBe('Notif 204')
  })
})
