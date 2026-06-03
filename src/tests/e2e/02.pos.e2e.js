/**
 * E2E: POS — flujo completo de venta
 * Login → buscar producto → agregar al carrito → cobrar → confirmar
 */
import { test, expect } from '@playwright/test'
import { loginWithRole, goTo } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await loginWithRole(page, 'Administrador')
  await goTo(page, 'pos')
})

// ─── Buscador de productos ─────────────────────────────────────────────────────

test('POS — buscador muestra resultados al escribir', async ({ page }) => {
  const searchInput = page.locator('input[placeholder*="Buscar por nombre"]')
  await expect(searchInput).toBeVisible()

  await searchInput.fill('Arroz')
  await page.waitForTimeout(300) // debounce de 150ms

  // Deben aparecer resultados (el seed tiene "Arroz Costeño Extra 5kg")
  await expect(page.locator('button').filter({ hasText: 'Arroz' }).first()).toBeVisible()
})

test('POS — búsqueda por código de barras encuentra el producto', async ({ page }) => {
  const searchInput = page.locator('input[placeholder*="Buscar por nombre"]')
  // Barcode del Arroz Costeño: 7751010012459
  await searchInput.fill('7751010012459')
  await page.waitForTimeout(300)

  await expect(page.locator('button').filter({ hasText: 'Arroz' }).first()).toBeVisible()
})

test('POS — búsqueda sin coincidencias no muestra resultados', async ({ page }) => {
  const searchInput = page.locator('input[placeholder*="Buscar por nombre"]')
  await searchInput.fill('xxxxxx-producto-que-no-existe')
  await page.waitForTimeout(300)

  // No debe haber dropdown visible
  await expect(page.locator('button').filter({ hasText: 'xxxxxx' })).not.toBeVisible()
})

// ─── Agregar productos al carrito ──────────────────────────────────────────────

test('POS — agregar producto al carrito', async ({ page }) => {
  const searchInput = page.locator('input[placeholder*="Buscar por nombre"]')
  await searchInput.fill('Inca Kola')
  await page.waitForTimeout(300)

  // Click en el primer resultado
  await page.locator('button').filter({ hasText: 'Inca Kola' }).first().click()
  await page.waitForTimeout(300)

  // El carrito debe mostrar el producto
  await expect(page.locator('text=Inca Kola').first()).toBeVisible()
})

test('POS — el carrito acumula cantidad al agregar el mismo producto dos veces', async ({ page }) => {
  const searchInput = page.locator('input[placeholder*="Buscar por nombre"]')

  // Primera adición
  await searchInput.fill('Inca Kola 500')
  await page.waitForTimeout(300)
  await page.locator('button').filter({ hasText: 'Inca Kola 500ml' }).first().click()
  await page.waitForTimeout(200)

  // Segunda adición
  await searchInput.fill('Inca Kola 500')
  await page.waitForTimeout(300)
  await page.locator('button').filter({ hasText: 'Inca Kola 500ml' }).first().click()
  await page.waitForTimeout(200)

  // Debe mostrar cantidad 2
  await expect(page.locator('text=2').first()).toBeVisible()
})

test('POS — carrito vacío muestra mensaje de inicio', async ({ page }) => {
  // Sin agregar productos, el carrito muestra el mensaje de ayuda
  await expect(page.locator('text=Busca un producto para comenzar')).toBeVisible()
})

test('POS — se puede eliminar un producto del carrito', async ({ page }) => {
  const searchInput = page.locator('input[placeholder*="Buscar por nombre"]')
  await searchInput.fill('Azúcar')
  await page.waitForTimeout(300)
  await page.locator('button').filter({ hasText: 'Azúcar' }).first().click()
  await page.waitForTimeout(200)

  // Verificar que el producto está en el carrito
  await expect(page.locator('text=Azúcar').first()).toBeVisible()

  // Click en el botón eliminar (la X de la fila)
  await page.locator('[title="Eliminar"]').first().click()
  await page.waitForTimeout(200)

  // Carrito debe estar vacío nuevamente
  await expect(page.locator('text=Busca un producto para comenzar')).toBeVisible()
})

// ─── Panel de cobro ────────────────────────────────────────────────────────────

test('POS — botón Cobrar abre el panel de pago', async ({ page }) => {
  // Agregar un producto primero
  const searchInput = page.locator('input[placeholder*="Buscar por nombre"]')
  await searchInput.fill('Coca-Cola')
  await page.waitForTimeout(300)
  await page.locator('button').filter({ hasText: 'Coca-Cola' }).first().click()
  await page.waitForTimeout(200)

  // Click en Cobrar
  await page.locator('button').filter({ hasText: 'Cobrar' }).first().click()
  await page.waitForTimeout(400)

  // Panel de cobro debe abrirse
  await expect(page.locator('text=Cobrar venta')).toBeVisible()
})

test('POS — venta completa: buscar → carrito → cobrar exacto → confirmar', async ({ page }) => {
  // 1. Agregar producto
  const searchInput = page.locator('input[placeholder*="Buscar por nombre"]')
  await searchInput.fill('Agua San Luis 625')
  await page.waitForTimeout(300)
  await page.locator('button').filter({ hasText: 'Agua San Luis 625ml' }).first().click()
  await page.waitForTimeout(200)

  // 2. Abrir panel de pago
  await page.locator('button').filter({ hasText: 'Cobrar' }).first().click()
  await page.waitForTimeout(500)
  await expect(page.locator('text=Cobrar venta')).toBeVisible()

  // 3. Usar el botón "Exacto" para pagar el monto exacto
  await page.locator('button').filter({ hasText: 'Exacto' }).first().click()
  await page.waitForTimeout(200)

  // 4. Agregar el pago
  await page.locator('button').filter({ hasText: '+ Agregar' }).first().click()
  await page.waitForTimeout(300)

  // 5. Confirmar venta (activo cuando el pago está completo)
  const confirmBtn = page.locator('button').filter({ hasText: 'Confirmar venta' }).first()
  await expect(confirmBtn).toBeVisible()
  await confirmBtn.click()
  await page.waitForTimeout(1000)

  // 6. Ticket de venta debe mostrarse
  await expect(
    page.locator('text=completada').or(page.locator('text=Ticket').or(page.locator('text=B001')))
  ).toBeVisible()
})

// ─── Atajos de teclado ─────────────────────────────────────────────────────────

test('POS — F2 enfoca el buscador', async ({ page }) => {
  await page.keyboard.press('F2')
  await page.waitForTimeout(200)

  const searchInput = page.locator('input[placeholder*="Buscar por nombre"]')
  await expect(searchInput).toBeFocused()
})
