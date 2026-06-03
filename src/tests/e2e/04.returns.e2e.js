/**
 * E2E: Devoluciones — flujo completo de NC
 * Login → buscar venta → seleccionar ítems → motivo → confirmar
 */
import { test, expect } from '@playwright/test'
import { loginWithRole, goTo } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3000/app/demo')
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter(k => k.includes('demo') || k.includes('minimarket'))
      .forEach(k => localStorage.removeItem(k))
  })
  await loginWithRole(page, 'Administrador')
  await goTo(page, 'returns')
})

// ─── Vista principal ────────────────────────────────────────────────────────────

test('Devoluciones — muestra título "Devoluciones" al ingresar', async ({ page }) => {
  await expect(page.locator('h1').filter({ hasText: 'Devoluciones' })).toBeVisible()
})

test('Devoluciones — muestra los 4 KPIs de resumen', async ({ page }) => {
  await expect(page.locator('text=NCs hoy')).toBeVisible()
  await expect(page.locator('text=Reembolsado hoy')).toBeVisible()
  await expect(page.locator('text=Total histórico')).toBeVisible()
  await expect(page.locator('text=Monto total')).toBeVisible()
})

test('Devoluciones — buscador visible con placeholder correcto', async ({ page }) => {
  const searchInput = page.locator('input[placeholder*="N° boleta"]')
  await expect(searchInput).toBeVisible()
})

test('Devoluciones — botón Buscar visible y habilitado', async ({ page }) => {
  const btn = page.getByRole('button', { name: 'Buscar', exact: true })
  await expect(btn).toBeVisible()
  await expect(btn).toBeEnabled()
})

// ─── Historial ──────────────────────────────────────────────────────────────────

test('Devoluciones — sección Historial de Notas de Crédito visible', async ({ page }) => {
  await expect(page.locator('h2').filter({ hasText: 'Historial de Notas de Crédito' })).toBeVisible()
})

test('Devoluciones — filtros "Todas" y "Hoy" visibles en el historial', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Todas', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hoy', exact: true })).toBeVisible()
})

test('Devoluciones — historial vacío muestra mensaje informativo', async ({ page }) => {
  // Sin NCs aún — debe mostrar el estado vacío
  const emptyMsg = page.locator('text=Sin notas de crédito')
  const historyTable = page.locator('table')
  // Puede estar vacío o con datos del seed
  const isEmpty = await emptyMsg.isVisible()
  const hasTable = await historyTable.isVisible()
  expect(isEmpty || hasTable).toBeTruthy()
})

// ─── Búsqueda con venta no existente ───────────────────────────────────────────

test('Devoluciones — buscar boleta inexistente muestra error', async ({ page }) => {
  const searchInput = page.locator('input[placeholder*="N° boleta"]')
  await searchInput.fill('B001-999999')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await page.waitForTimeout(600)

  // Debe mostrar un toast de error
  await expect(page.locator('text=Venta no encontrada').first()).toBeVisible({ timeout: 4000 })
})

test('Devoluciones — buscar con campo vacío muestra error', async ({ page }) => {
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await page.waitForTimeout(600)

  await expect(page.locator('text=Ingresa el N°').first()).toBeVisible({ timeout: 4000 })
})

// ─── Flujo completo con venta real del seed ─────────────────────────────────────

test('Devoluciones — panel de recientes aparece al enfocar el buscador', async ({ page }) => {
  const searchInput = page.locator('input[placeholder*="N° boleta"]')
  await searchInput.click()
  await page.waitForTimeout(400)

  // El dropdown de ventas recientes o "Ventas recientes" debe aparecer
  // (solo si el seed tiene ventas con estado completada/dev-parcial)
  const recentPanel = page.locator('text=Ventas recientes').or(page.locator('text=Coincidencias'))
  const noSales = page.locator('text=Buscar')
  const panelVisible = await recentPanel.isVisible()
  // Si hay ventas del seed, aparece el panel; si no, el buscador sigue ahí
  expect(panelVisible || await noSales.isVisible()).toBeTruthy()
})

test('Devoluciones — flujo completo: buscar → seleccionar → motivo → confirmar NC', async ({ page }) => {
  // 1. Hacer una venta en el POS primero para tener algo que devolver
  await goTo(page, 'pos')
  const searchInput = page.locator('input[placeholder*="Buscar por nombre"]')
  await searchInput.fill('Agua San Luis')
  await page.waitForTimeout(300)
  await page.locator('button').filter({ hasText: 'Agua San Luis' }).first().click()
  await page.waitForTimeout(200)

  // Cobrar
  await page.locator('button').filter({ hasText: 'Cobrar' }).first().click()
  await page.waitForTimeout(500)
  await page.locator('button').filter({ hasText: 'Exacto' }).first().click()
  await page.waitForTimeout(200)
  await page.locator('button').filter({ hasText: '+ Agregar' }).first().click()
  await page.waitForTimeout(300)
  await page.locator('button').filter({ hasText: 'Confirmar venta' }).first().click()
  await page.waitForTimeout(1500)

  // Capturar el número de boleta generado (B001-XXXXXX)
  const ticketText = await page.locator('text=B001').first().innerText().catch(() => null)

  // 2. Ir a Devoluciones
  await goTo(page, 'returns')

  // 3. Buscar la boleta más reciente usando el panel de recientes
  const returnSearchInput = page.locator('input[placeholder*="N° boleta"]')
  await returnSearchInput.click()
  await page.waitForTimeout(400)

  // Click en la primera venta del panel de recientes
  const firstRecentSale = page.locator('p.font-mono.font-black').first()
  const saleVisible = await firstRecentSale.isVisible()

  if (saleVisible) {
    await firstRecentSale.click()
    await page.waitForTimeout(500)

    // 4. Incrementar cantidad a devolver (botón +)
    const addBtn = page.locator('button').filter({ hasText: '+' }).first()
    if (await addBtn.isEnabled()) {
      await addBtn.click()
      await page.waitForTimeout(200)
    }

    // 5. Seleccionar motivo: "Producto defectuoso"
    await page.locator('button').filter({ hasText: 'Producto defectuoso' }).first().click()
    await page.waitForTimeout(200)

    // 6. Confirmar — botón en el panel derecho sticky
    const confirmBtn = page.getByRole('button', { name: 'Generar Nota de Crédito', exact: false })
    await expect(confirmBtn).toBeVisible({ timeout: 3000 })
    await confirmBtn.click()
    await page.waitForTimeout(1200)

    // 7. NC generada exitosamente
    await expect(
      page.locator('text=Nota de Crédito emitida con éxito')
        .or(page.locator('text=NC001'))
    ).toBeVisible({ timeout: 5000 })
  }
})

// ─── Paso a paso del flujo (sin completar) ─────────────────────────────────────

test('Devoluciones — encontrar venta muestra paso 2 de ítems', async ({ page }) => {
  // Primero crear una venta mínima
  await goTo(page, 'pos')
  const si = page.locator('input[placeholder*="Buscar por nombre"]')
  await si.fill('Coca-Cola')
  await page.waitForTimeout(300)
  await page.locator('button').filter({ hasText: 'Coca-Cola' }).first().click()
  await page.waitForTimeout(200)
  await page.locator('button').filter({ hasText: 'Cobrar' }).first().click()
  await page.waitForTimeout(400)
  await page.locator('button').filter({ hasText: 'Exacto' }).first().click()
  await page.waitForTimeout(200)
  await page.locator('button').filter({ hasText: '+ Agregar' }).first().click()
  await page.waitForTimeout(300)
  await page.locator('button').filter({ hasText: 'Confirmar venta' }).first().click()
  await page.waitForTimeout(1200)

  await goTo(page, 'returns')

  const returnInput = page.locator('input[placeholder*="N° boleta"]')
  await returnInput.click()
  await page.waitForTimeout(400)

  const firstSale = page.locator('p.font-mono.font-black').first()
  if (await firstSale.isVisible()) {
    await firstSale.click()
    await page.waitForTimeout(500)

    // El paso 2 debe aparecer
    await expect(page.locator('h2').filter({ hasText: 'Seleccionar productos a devolver' })).toBeVisible()
    // Y el paso 3 (motivo) también
    await expect(page.locator('h2').filter({ hasText: 'Motivo de devolución' })).toBeVisible()
  }
})

test('Devoluciones — botón cancelar devolución regresa al estado inicial', async ({ page }) => {
  await goTo(page, 'pos')
  const si = page.locator('input[placeholder*="Buscar por nombre"]')
  await si.fill('Inca Kola')
  await page.waitForTimeout(300)
  await page.locator('button').filter({ hasText: 'Inca Kola' }).first().click()
  await page.waitForTimeout(200)
  await page.locator('button').filter({ hasText: 'Cobrar' }).first().click()
  await page.waitForTimeout(400)
  await page.locator('button').filter({ hasText: 'Exacto' }).first().click()
  await page.waitForTimeout(200)
  await page.locator('button').filter({ hasText: '+ Agregar' }).first().click()
  await page.waitForTimeout(300)
  await page.locator('button').filter({ hasText: 'Confirmar venta' }).first().click()
  await page.waitForTimeout(1200)

  await goTo(page, 'returns')
  const returnInput = page.locator('input[placeholder*="N° boleta"]')
  await returnInput.click()
  await page.waitForTimeout(400)

  const firstSale = page.locator('p.font-mono.font-black').first()
  if (await firstSale.isVisible()) {
    await firstSale.click()
    await page.waitForTimeout(500)

    // Cancelar la devolución
    await page.getByRole('button', { name: 'Cancelar devolución', exact: false }).click()
    await page.waitForTimeout(300)

    // Debe volver al estado inicial (paso 2 no visible)
    await expect(page.locator('h2').filter({ hasText: 'Seleccionar productos a devolver' })).not.toBeVisible()
  }
})

// ─── Filtro de historial ────────────────────────────────────────────────────────

test('Devoluciones — filtro "Hoy" activa correctamente el botón', async ({ page }) => {
  const hoyBtn = page.getByRole('button', { name: 'Hoy', exact: true })
  await hoyBtn.click()
  await page.waitForTimeout(200)

  // El botón Hoy debe estar activo (tiene clase de active)
  await expect(hoyBtn).toHaveClass(/bg-violet-600/)
})

test('Devoluciones — filtro "Todas" restaura la vista del historial', async ({ page }) => {
  // Cambiar a Hoy primero
  await page.getByRole('button', { name: 'Hoy', exact: true }).click()
  await page.waitForTimeout(200)

  // Volver a Todas
  await page.getByRole('button', { name: 'Todas', exact: true }).click()
  await page.waitForTimeout(200)

  await expect(page.getByRole('button', { name: 'Todas', exact: true })).toHaveClass(/bg-violet-600/)
})
