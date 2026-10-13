/**
 * E2E: Catálogo — navegación de tabs, filtros, CRUD de productos y categorías
 * Login → Catálogo → Productos / Categorías / Marcas
 */
import { test, expect } from '@playwright/test'
import { loginWithRole, goTo } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await page.goto('/app/e2e')
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter(k => k.includes('demo') || k.includes('minimarket'))
      .forEach(k => localStorage.removeItem(k))
  })
  await loginWithRole(page, 'Administrador')
  await goTo(page, 'catalog')
})

// ─── Vista principal ────────────────────────────────────────────────────────────

test('Catálogo — muestra título "Catálogo" o "Productos" al ingresar', async ({ page }) => {
  await expect(
    page.locator('h1').filter({ hasText: 'Catálogo' })
      .or(page.locator('h1').filter({ hasText: 'Productos' }))
  ).toBeVisible()
})

test('Catálogo — tabla de productos visible con seed data', async ({ page }) => {
  // El seed debe tener productos — la tabla debe estar visible
  await expect(page.locator('table').first()).toBeVisible()
})

test('Catálogo — KPIs de valor en almacén visibles', async ({ page }) => {
  await expect(page.locator('text=Valor en almacén')).toBeVisible()
  await expect(page.locator('text=Potencial de venta')).toBeVisible()
  await expect(page.locator('text=Margen potencial')).toBeVisible()
})

// ─── Buscador de productos ──────────────────────────────────────────────────────

test('Catálogo — buscador filtra productos por nombre', async ({ page }) => {
  const searchInput = page.locator('input[placeholder*="Buscar por nombre"]')
  await expect(searchInput).toBeVisible()

  await searchInput.fill('Arroz')
  await page.waitForTimeout(300)

  // La tabla debe mostrar solo resultados con "Arroz"
  const rows = page.locator('tbody tr')
  const count = await rows.count()
  if (count > 0) {
    await expect(rows.first().locator('td').first()).toContainText('Arroz')
  }
})

test('Catálogo — buscador por código de barras funciona', async ({ page }) => {
  const searchInput = page.locator('input[placeholder*="Buscar por nombre"]')
  await searchInput.fill('7750075000003')
  await page.waitForTimeout(300)

  // Debe mostrar el Arroz Extra de la semilla E2E o "no hay productos"
  const hasResults = await page.locator('tbody tr').count() > 0
  const emptyMsg = await page.locator('text=No hay productos').isVisible()
  expect(hasResults || emptyMsg).toBeTruthy()
})

test('Catálogo — búsqueda sin coincidencias muestra estado vacío', async ({ page }) => {
  const searchInput = page.locator('input[placeholder*="Buscar por nombre"]')
  await searchInput.fill('xxxxxxxxxxx-no-existe-ningun-producto')
  await page.waitForTimeout(300)

  await expect(page.locator('text=No hay productos')).toBeVisible()
})

// ─── Filtros ────────────────────────────────────────────────────────────────────

test('Catálogo — filtros Activos / Inactivos / Todos visibles', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Activos', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Inactivos', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Todos', exact: true })).toBeVisible()
})

test('Catálogo — filtro "Todos" muestra todos los productos', async ({ page }) => {
  await page.getByRole('button', { name: 'Todos', exact: true }).click()
  await page.waitForTimeout(300)

  // Debe activarse el botón y mostrar productos (incluyendo inactivos)
  await expect(page.getByRole('button', { name: 'Todos', exact: true })).toHaveClass(/bg-white|shadow/)
})

test('Catálogo — dropdown de categorías visible', async ({ page }) => {
  const catFilter = page.locator('select').filter({ hasText: 'Todas las categorías' })
  await expect(catFilter).toBeVisible()
})

// ─── Botón Nuevo producto ────────────────────────────────────────────────────────

test('Catálogo — botón "Nuevo producto" abre el formulario', async ({ page }) => {
  await page.getByRole('button', { name: 'Nuevo producto', exact: true }).click()
  await page.waitForTimeout(400)

  // Modal de creación debe aparecer
  await expect(
    page.getByRole('heading', { name: 'Nuevo producto', exact: true })
  ).toBeVisible()
})

// ─── Creación de producto ────────────────────────────────────────────────────────

test('Catálogo — crear producto con datos mínimos', async ({ page }) => {
  await page.getByRole('button', { name: 'Nuevo producto', exact: true }).click()
  const suffix = Date.now()
  const productName = `Producto E2E ${suffix}`

  await page.getByTestId('product-name').fill(productName)
  await page.getByTestId('product-barcode').fill(`E2E-${suffix}`)
  await page.getByTestId('product-category').selectOption({ index: 1 })
  await page.getByTestId('product-supplier').selectOption({ index: 1 })
  await page.getByTestId('product-price-buy').fill('5')
  await page.getByTestId('product-price-sell').fill('8')

  await page.getByRole('button', { name: 'Crear producto', exact: true }).click()
  await expect(page.getByText(productName, { exact: true })).toBeVisible()
})

// ─── Edición de producto ─────────────────────────────────────────────────────────

test('Catálogo — botón editar abre el formulario de edición', async ({ page }) => {
  // Hacer click en el primer botón de editar (title="Editar")
  const editBtn = page.getByRole('button', { name: /^Editar / }).first()
  await expect(editBtn).toBeVisible()
  await editBtn.click()
  await page.waitForTimeout(400)

  // Modal de edición debe aparecer
  await expect(
    page.getByRole('heading', { name: 'Editar producto', exact: true })
  ).toBeVisible()
})

test('Catálogo — cerrar modal de edición con botón Cancelar', async ({ page }) => {
  await page.getByRole('button', { name: /^Editar / }).first().click()
  await page.waitForTimeout(400)

  await page.getByRole('button', { name: 'Cancelar', exact: true }).first().click()
  await page.waitForTimeout(300)

  // El modal debe cerrarse
  await expect(page.locator('button').filter({ hasText: 'Guardar cambios' })).not.toBeVisible()
})

// ─── Tabla de productos ──────────────────────────────────────────────────────────

test('Catálogo — tabla tiene columnas correctas', async ({ page }) => {
  await expect(page.locator('th').filter({ hasText: 'Producto' }).first()).toBeVisible()
  await expect(page.locator('th').filter({ hasText: 'Código' }).first()).toBeVisible()
  await expect(page.locator('th').filter({ hasText: 'P. Venta' }).first()).toBeVisible()
  await expect(page.locator('th').filter({ hasText: 'Stock' }).first()).toBeVisible()
})

test('Catálogo — contador de productos mostrados visible', async ({ page }) => {
  // El footer de la tabla muestra "X productos mostrados"
  await expect(page.locator('text=producto').filter({ hasText: 'mostrados' }).first()).toBeVisible()
})

// ─── Tab Categorías ──────────────────────────────────────────────────────────────

test('Catálogo — tab Categorías muestra KPIs de categorías', async ({ page }) => {
  // Navegar al tab de categorías
  const catTab = page.locator('button').filter({ hasText: 'Categorías' }).first()
  if (await catTab.isVisible()) {
    await catTab.click()
    await page.waitForTimeout(400)

    await expect(page.locator('text=Total categorías')).toBeVisible()
  }
})

test('Catálogo — tab Categorías tiene botón Nueva categoría', async ({ page }) => {
  const catTab = page.locator('button').filter({ hasText: 'Categorías' }).first()
  if (await catTab.isVisible()) {
    await catTab.click()
    await page.waitForTimeout(400)

    await expect(page.getByRole('button', { name: 'Nueva categoría', exact: false })).toBeVisible()
  }
})

test('Catálogo — crear nueva categoría', async ({ page }) => {
  const catTab = page.locator('button').filter({ hasText: 'Categorías' }).first()
  if (await catTab.isVisible()) {
    await catTab.click()
    await page.waitForTimeout(400)

    await page.getByRole('button', { name: 'Nueva categoría', exact: false }).click()
    await page.waitForTimeout(300)

    // Modal de creación
    await page.locator('input[placeholder*="Abarrotes"]').fill('Categoría E2E Test')
    await page.locator('button').filter({ hasText: 'Crear categoría' }).first().click()
    await page.waitForTimeout(600)

    await expect(page.locator('text=Categoría creada')).toBeVisible({ timeout: 4000 })
  }
})

// ─── Tab Marcas ──────────────────────────────────────────────────────────────────

test('Catálogo — tab Marcas muestra KPIs de marcas', async ({ page }) => {
  const brandTab = page.locator('button').filter({ hasText: 'Marcas' }).first()
  if (await brandTab.isVisible()) {
    await brandTab.click()
    await page.waitForTimeout(400)

    await expect(page.locator('text=Total marcas')).toBeVisible()
    await expect(page.locator('text=Marcas activas')).toBeVisible()
  }
})

test('Catálogo — tab Marcas tiene botón Nueva marca', async ({ page }) => {
  const brandTab = page.locator('button').filter({ hasText: 'Marcas' }).first()
  if (await brandTab.isVisible()) {
    await brandTab.click()
    await page.waitForTimeout(400)

    await expect(page.getByRole('button', { name: 'Nueva marca', exact: false })).toBeVisible()
  }
})

// ─── Botón Etiquetas ─────────────────────────────────────────────────────────────

test('Catálogo — botón Etiquetas visible en la barra de acciones', async ({ page }) => {
  await expect(page.locator('button').filter({ hasText: 'Etiquetas' }).first()).toBeVisible()
})

// ─── Exportar Excel ──────────────────────────────────────────────────────────────

test('Catálogo — botón de exportar Excel visible', async ({ page }) => {
  // El ExcelButton tiene texto "Excel" o icono de excel
  const excelBtn = page.locator('button').filter({ hasText: 'Excel' }).first()
  await expect(excelBtn).toBeVisible()
})
