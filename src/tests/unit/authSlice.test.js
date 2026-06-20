/**
 * Tests unitarios: authSlice
 * Usa una fábrica de store mínima que simula set/get de Zustand.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createAuthSlice } from '../../store/slices/authSlice'

// ─── Fábrica de store ─────────────────────────────────────────────────────────
function makeStore(overrides = {}) {
  let state = {
    currentUser:      null,
    activeCashSession: null,
    cart:             [],
    recordLogin:      vi.fn(),
    recordLogout:     vi.fn(),
    addAuditLog:      vi.fn(),
    ...overrides,
  }

  const get = () => state
  const set = (updater) => {
    const partial = typeof updater === 'function' ? updater(state) : updater
    state = { ...state, ...partial }
  }

  const slice = createAuthSlice(set, get)
  // overrides van AL FINAL para no ser pisados por los defaults del slice
  state = { ...state, ...slice, ...overrides }

  return {
    get,
    setCurrentUser: (u) => state.setCurrentUser(u),
    logout:         ()  => state.logout(),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// setCurrentUser
// ═══════════════════════════════════════════════════════════════════════════════
describe('authSlice.setCurrentUser', () => {
  it('establece el usuario actual', () => {
    const store = makeStore()
    const user  = { id: 'u1', name: 'Ana', role: 'admin' }
    store.setCurrentUser(user)
    expect(store.get().currentUser).toEqual(user)
  })

  it('llama a recordLogin cuando hay un usuario nuevo (prevUser era null)', () => {
    const store = makeStore()
    const user  = { id: 'u1', name: 'Ana', role: 'admin' }
    store.setCurrentUser(user)
    expect(store.get().recordLogin).toHaveBeenCalledWith(user)
    expect(store.get().recordLogin).toHaveBeenCalledOnce()
  })

  it('NO llama a recordLogin si se actualiza el mismo usuario (misma id)', () => {
    const user  = { id: 'u1', name: 'Ana', role: 'admin' }
    const store = makeStore({ currentUser: user })
    store.setCurrentUser({ ...user, name: 'Ana García' })
    expect(store.get().recordLogin).not.toHaveBeenCalled()
  })

  it('es un no-op completo si se pasa el mismo id (ni set ni recordLogin)', () => {
    const user = { id: 'u1', name: 'Ana' }
    const store = makeStore({ currentUser: user })
    store.setCurrentUser({ id: 'u1', name: 'Ana Actualizada' })
    // El slice tiene guard: same id → return sin hacer nada
    expect(store.get().currentUser.name).toBe('Ana')
    expect(store.get().recordLogin).not.toHaveBeenCalled()
  })

  it('acepta null como usuario (cierra sesión vía setCurrentUser)', () => {
    const user  = { id: 'u1', name: 'Ana' }
    const store = makeStore({ currentUser: user })
    store.setCurrentUser(null)
    expect(store.get().currentUser).toBeNull()
  })

  it('al cambiar entre dos usuarios distintos: actualiza currentUser pero NO llama recordLogin', () => {
    // recordLogin solo se dispara cuando prevUser era null (primer login de la sesión)
    const user1 = { id: 'u1', name: 'Ana' }
    const user2 = { id: 'u2', name: 'Carlos' }
    const store = makeStore({ currentUser: user1 })
    store.setCurrentUser(user2)
    expect(store.get().currentUser.id).toBe('u2')
    expect(store.get().recordLogin).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// logout
// ═══════════════════════════════════════════════════════════════════════════════
describe('authSlice.logout', () => {
  it('limpia currentUser, cart y activeCashSession', () => {
    const user  = { id: 'u1', name: 'Ana' }
    const store = makeStore({
      currentUser: user,
      activeCashSession: { id: 'cs-1' },
      cart: [{ id: 'item-1', quantity: 2 }],
    })
    store.logout()
    expect(store.get().currentUser).toBeNull()
    expect(store.get().activeCashSession).toBeNull()
    expect(store.get().cart).toHaveLength(0)
  })

  it('llama a recordLogout con el id del usuario que cierra sesión', () => {
    const user  = { id: 'u99', name: 'Bob' }
    const store = makeStore({ currentUser: user })
    store.logout()
    expect(store.get().recordLogout).toHaveBeenCalledWith('u99')
  })

  it('registra LOGOUT en el audit log', () => {
    const user  = { id: 'u1', name: 'Ana' }
    const store = makeStore({ currentUser: user })
    store.logout()
    expect(store.get().addAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGOUT', module: 'Auth' })
    )
  })

  it('no llama a recordLogout si no hay usuario activo', () => {
    const store = makeStore({ currentUser: null })
    store.logout()
    expect(store.get().recordLogout).not.toHaveBeenCalled()
  })

  it('aun sin usuario activo vacía cart y activeCashSession', () => {
    const store = makeStore({
      currentUser: null,
      activeCashSession: { id: 'cs-1' },
      cart: [{ id: 'item-1' }],
    })
    store.logout()
    expect(store.get().activeCashSession).toBeNull()
    expect(store.get().cart).toHaveLength(0)
  })
})
