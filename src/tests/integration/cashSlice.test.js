/**
 * Tests de integración: cashSlice
 * Valida apertura, cierre de sesiones de caja e historial.
 */
import { describe, it, expect } from 'vitest'
import { create } from 'zustand'
import { createAuditSlice }  from '../../store/slices/auditSlice'
import { createCashSlice }   from '../../store/slices/cashSlice'

const createTestStore = () =>
  create((set, get) => ({
    activeCashSession: null,
    cashSessions:      [],
    systemConfig:      { auditEnabled: false },
    currentUser:       null,
    auditLog:          [],
    ...createAuditSlice(set, get),
    ...createCashSlice(set, get),
  }))

const makeSession = (id = 'session-1', overrides = {}) => ({
  id,
  openingAmount: 200,
  openedAt:      new Date().toISOString(),
  openedBy:      'cajero-test',
  totalSales:    0,
  difference:    0,
  ...overrides,
})

// ═══════════════════════════════════════════════════════════════════════════════
// openCashSession
// ═══════════════════════════════════════════════════════════════════════════════
describe('openCashSession', () => {
  it('establece la sesión activa', () => {
    const store = createTestStore()
    const session = makeSession()
    store.getState().openCashSession(session)

    expect(store.getState().activeCashSession).toEqual(session)
  })

  it('la sesión activa contiene el monto de apertura', () => {
    const store = createTestStore()
    store.getState().openCashSession(makeSession('s1', { openingAmount: 500 }))

    expect(store.getState().activeCashSession.openingAmount).toBe(500)
  })

  it('reemplaza una sesión activa previa (apertura sin cierre previo)', () => {
    const store = createTestStore()
    store.getState().openCashSession(makeSession('s1', { openingAmount: 100 }))
    store.getState().openCashSession(makeSession('s2', { openingAmount: 200 }))

    expect(store.getState().activeCashSession.id).toBe('s2')
    expect(store.getState().activeCashSession.openingAmount).toBe(200)
  })

  it('historial de sesiones NO cambia al abrir (solo al cerrar)', () => {
    const store = createTestStore()
    store.getState().openCashSession(makeSession())

    expect(store.getState().cashSessions).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// closeCashSession
// ═══════════════════════════════════════════════════════════════════════════════
describe('closeCashSession', () => {
  it('limpia la sesión activa', () => {
    const store = createTestStore()
    store.getState().openCashSession(makeSession())

    const closedSession = {
      ...makeSession(),
      closedAt:   new Date().toISOString(),
      totalSales: 500,
      difference: 0,
    }
    store.getState().closeCashSession(closedSession)

    expect(store.getState().activeCashSession).toBeNull()
  })

  it('agrega la sesión cerrada al historial', () => {
    const store = createTestStore()
    store.getState().openCashSession(makeSession('s1'))
    store.getState().closeCashSession({ ...makeSession('s1'), totalSales: 300, difference: -5 })

    expect(store.getState().cashSessions).toHaveLength(1)
    expect(store.getState().cashSessions[0].id).toBe('s1')
  })

  it('historial crece al cerrar múltiples sesiones', () => {
    const store = createTestStore()

    store.getState().openCashSession(makeSession('s1'))
    store.getState().closeCashSession({ ...makeSession('s1'), totalSales: 100 })

    store.getState().openCashSession(makeSession('s2'))
    store.getState().closeCashSession({ ...makeSession('s2'), totalSales: 200 })

    expect(store.getState().cashSessions).toHaveLength(2)
  })

  it('sesiones más recientes al frente del historial', () => {
    const store = createTestStore()

    store.getState().openCashSession(makeSession('s1'))
    store.getState().closeCashSession({ ...makeSession('s1'), totalSales: 100 })

    store.getState().openCashSession(makeSession('s2'))
    store.getState().closeCashSession({ ...makeSession('s2'), totalSales: 200 })

    expect(store.getState().cashSessions[0].id).toBe('s2')
    expect(store.getState().cashSessions[1].id).toBe('s1')
  })

  it('la sesión cerrada conserva todos sus campos (totalSales, difference)', () => {
    const store = createTestStore()
    store.getState().openCashSession(makeSession('s1'))

    const closed = {
      ...makeSession('s1'),
      totalSales: 850.50,
      difference: 10.00,
      closedAt: new Date().toISOString(),
    }
    store.getState().closeCashSession(closed)

    const saved = store.getState().cashSessions[0]
    expect(saved.totalSales).toBe(850.50)
    expect(saved.difference).toBe(10.00)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Flujo completo: abrir → cerrar → abrir nueva sesión
// ═══════════════════════════════════════════════════════════════════════════════
describe('flujo completo apertura → cierre → reapertura', () => {
  it('después de cerrar se puede abrir una nueva sesión', () => {
    const store = createTestStore()

    store.getState().openCashSession(makeSession('s1', { openingAmount: 100 }))
    store.getState().closeCashSession({ ...makeSession('s1'), totalSales: 500 })
    store.getState().openCashSession(makeSession('s2', { openingAmount: 200 }))

    expect(store.getState().activeCashSession.id).toBe('s2')
    expect(store.getState().cashSessions).toHaveLength(1)
    expect(store.getState().cashSessions[0].id).toBe('s1')
  })
})
