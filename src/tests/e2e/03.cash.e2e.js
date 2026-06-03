/**
 * E2E: Caja — apertura, cierre y flujo completo de turno
 * Login como Cajero → Cash → Aperturar → Cerrar
 */
import { test, expect } from '@playwright/test'
import { loginWithRole, goTo } from './helpers.js'

test.beforeEach(async ({ page }) => {
  // Limpiar estado de caja anterior
  await page.goto('http://localhost:3000/app/demo')
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter(k => k.includes('demo') || k.includes('minimarket'))
      .forEach(k => localStorage.removeItem(k))
  })
  await loginWithRole(page, 'Administrador')
  await goTo(page, 'cash')
})

// ─── Vista principal de Caja ───────────────────────────────────────────────────

test('Caja — muestra "Control de Caja" al ingresar', async ({ page }) => {
  await expect(page.locator('h1').filter({ hasText: 'Control de Caja' })).toBeVisible()
})

test('Caja — muestra indicador "Caja cerrada" al inicio (sin sesión activa)', async ({ page }) => {
  await expect(page.locator('text=Caja cerrada')).toBeVisible()
})

test('Caja — botón "Aperturar caja" visible cuando no hay sesión activa', async ({ page }) => {
  const openBtn = page.getByRole('button', { name: 'Aperturar caja', exact: true }).first()
  await expect(openBtn).toBeVisible()
  await expect(openBtn).toBeEnabled()
})

// ─── Apertura de caja ──────────────────────────────────────────────────────────

test('Caja — formulario de apertura se muestra al hacer click', async ({ page }) => {
  await page.getByRole('button', { name: 'Aperturar caja', exact: true }).first().click()
  await page.waitForTimeout(300)

  await expect(page.locator('h2').filter({ hasText: 'Apertura de caja' })).toBeVisible()
  await expect(page.locator('input[type="number"]').first()).toBeVisible()
})

test('Caja — apertura con monto S/200 por defecto', async ({ page }) => {
  await page.getByRole('button', { name: 'Aperturar caja', exact: true }).first().click()
  await page.waitForTimeout(300)

  // El campo tiene el valor por defecto 200
  const input = page.locator('input[type="number"]').first()
  await expect(input).toHaveValue('200')
})

test('Caja — apertura exitosa con monto personalizado', async ({ page }) => {
  // Navegar al formulario
  await page.getByRole('button', { name: 'Aperturar caja', exact: true }).first().click()
  await page.waitForTimeout(300)

  // Cambiar el monto a 500
  const montoInput = page.locator('input[type="number"]').first()
  await montoInput.fill('500')

  // Confirmar apertura
  const submitBtn = page.locator('button').filter({ hasText: 'Aperturar caja' }).last()
  await submitBtn.click()
  await page.waitForTimeout(1000)

  // Toast de éxito debe aparecer
  await expect(page.locator('text=Caja aperturada').first()).toBeVisible({ timeout: 5000 })
})

test('Caja — después de apertura muestra sesión activa', async ({ page }) => {
  // Abrir caja con el valor por defecto
  await page.getByRole('button', { name: 'Aperturar caja', exact: true }).first().click()
  await page.waitForTimeout(300)

  const submitBtn = page.locator('button').filter({ hasText: 'Aperturar caja' }).last()
  await submitBtn.click()
  await page.waitForTimeout(1200)

  // Debe mostrar "Caja abierta"
  await goTo(page, 'cash')
  await expect(page.locator('text=Caja abierta').first()).toBeVisible({ timeout: 5000 })
})

// ─── Cierre de caja ────────────────────────────────────────────────────────────

test('Caja — formulario de cierre se muestra tras apertura', async ({ page }) => {
  // Abrir caja primero
  await page.getByRole('button', { name: 'Aperturar caja', exact: true }).first().click()
  await page.waitForTimeout(300)
  await page.locator('button').filter({ hasText: 'Aperturar caja' }).last().click()
  await page.waitForTimeout(1200)

  // Regresar a la vista principal
  await goTo(page, 'cash')

  // El botón "Cerrar caja" debe estar visible
  const closeBtn = page.getByRole('button', { name: 'Cerrar caja', exact: true }).first()
  await expect(closeBtn).toBeVisible({ timeout: 5000 })
})

test('Caja — formulario de cierre muestra campo de monto contado', async ({ page }) => {
  // Abrir caja
  await page.getByRole('button', { name: 'Aperturar caja', exact: true }).first().click()
  await page.waitForTimeout(300)
  await page.locator('button').filter({ hasText: 'Aperturar caja' }).last().click()
  await page.waitForTimeout(1200)

  // Volver y abrir formulario de cierre
  await goTo(page, 'cash')
  await page.getByRole('button', { name: 'Cerrar caja', exact: true }).first().click()
  await page.waitForTimeout(400)

  // Formulario de cierre visible con campo de monto
  await expect(page.locator('h2').filter({ hasText: 'Cierre de caja' })).toBeVisible()
  await expect(page.locator('text=Arqueo')).toBeVisible()
})

// ─── Flujo completo: apertura → ventas 0 → cierre ─────────────────────────────

test('Caja — flujo completo: apertura → cierre con S/200 contados', async ({ page }) => {
  // 1. Aperturar caja con S/200
  await page.getByRole('button', { name: 'Aperturar caja', exact: true }).first().click()
  await page.waitForTimeout(300)
  await page.locator('button').filter({ hasText: 'Aperturar caja' }).last().click()
  await page.waitForTimeout(1200)

  // 2. Volver a la vista de caja
  await goTo(page, 'cash')

  // 3. Abrir formulario de cierre
  await page.getByRole('button', { name: 'Cerrar caja', exact: true }).first().click()
  await page.waitForTimeout(400)

  // 4. Ingresar monto contado (S/200 = sin diferencia)
  const countedInput = page.locator('input').filter({ hasNot: page.locator('textarea') }).last()
  await countedInput.fill('200')
  await page.waitForTimeout(300)

  // 5. Click "Cerrar caja"
  await page.locator('button').filter({ hasText: 'Cerrar caja' }).first().click()
  await page.waitForTimeout(500)

  // 6. Confirmar en el modal de confirmación
  const confirmBtn = page.locator('button').filter({ hasText: 'Sí, cerrar caja' }).first()
  if (await confirmBtn.isVisible()) {
    await confirmBtn.click()
    await page.waitForTimeout(1000)
  }

  // 7. Toast de éxito
  await expect(page.locator('text=Caja cerrada').first()).toBeVisible({ timeout: 5000 })
})
