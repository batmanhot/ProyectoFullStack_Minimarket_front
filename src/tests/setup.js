import '@testing-library/jest-dom'

// URL methods — jsdom no los implementa
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Silenciar errores esperados en consola durante tests
const originalError = console.error.bind(console)
beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) return
    originalError(...args)
  }
})
afterAll(() => { console.error = originalError })
