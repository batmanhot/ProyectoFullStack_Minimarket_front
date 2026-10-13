/**
 * E2E: Login — flujos de autenticación (modo demo y credenciales)
 * URL base: la definida por Playwright (`baseURL`).
 */
import { test, expect } from '@playwright/test'
import { loginWithRole, goTo } from './helpers.js'

const DEMO_URL = '/app/e2e'

test.beforeEach(async ({ page }) => {
  // Limpiar estado anterior
  await page.goto(DEMO_URL)
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter(k => k.includes('e2e') || k.includes('minimarket'))
      .forEach(k => localStorage.removeItem(k))
  })
})

// ─── Login con roles demo ──────────────────────────────────────────────────────

test('login demo — rol Administrador muestra la app', async ({ page }) => {
  await page.goto(DEMO_URL)
  await page.locator('.login-card, .brand-name').first().waitFor({ state: 'visible' })

  // El panel de login debe estar visible
  await expect(page.locator('.login-card, .brand-name').first()).toBeVisible()

  // Click en el botón de rol Administrador
  const loginResponse = page.waitForResponse(response =>
    response.url().endsWith('/auth/login') && response.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Administrador', exact: false }).first().click()
  await expect((await loginResponse).status()).toBe(200)
  await expect(page.locator('.login-card')).not.toBeVisible()
})

test('login demo — rol Cajero accede con permisos reducidos', async ({ page }) => {
  await loginWithRole(page, 'Cajero')

  // Navegar al POS (Cajero tiene acceso al POS)
  await goTo(page, 'pos')
  await expect(page.getByRole('button', { name: 'Punto de Venta', exact: false })).toBeVisible()
  await expect(page.getByText('Caja no abierta')).toBeVisible()
})

test('login demo — rol Gerente accede correctamente', async ({ page }) => {
  await loginWithRole(page, 'Gerente')
  // Verificar que no hay pantalla de error
  await expect(page.locator('text=Error').or(page.locator('text=Acceso denegado'))).not.toBeVisible()
})

// ─── Login con credenciales manuales ──────────────────────────────────────────

test('login manual — admin@demo.com / admin123', async ({ page }) => {
  await page.goto(DEMO_URL)
  await page.locator('input[placeholder="Usuario"]').waitFor({ state: 'visible' })

  await page.fill('input[placeholder="Usuario"]', 'admin@demo.com')
  await page.fill('input[placeholder="Contraseña"]', 'admin123')
  const loginResponse = page.waitForResponse(response =>
    response.url().endsWith('/auth/login') && response.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Ingresar al sistema', exact: false }).click()
  await expect((await loginResponse).status()).toBe(200)

  // Debe haber ingresado — no más pantalla de login
  await expect(page.locator('.login-card')).not.toBeVisible()
})

test('login manual — cajero / cajero123', async ({ page }) => {
  await page.goto(DEMO_URL)
  await page.locator('input[placeholder="Usuario"]').waitFor({ state: 'visible' })

  await page.fill('input[placeholder="Usuario"]', 'cajero')
  await page.fill('input[placeholder="Contraseña"]', 'cajero123')
  const loginResponse = page.waitForResponse(response =>
    response.url().endsWith('/auth/login') && response.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Ingresar al sistema', exact: false }).click()
  await expect((await loginResponse).status()).toBe(200)

  await expect(page.locator('.login-card')).not.toBeVisible()
})

test('login manual — credenciales incorrectas muestran error', async ({ page }) => {
  await page.goto(DEMO_URL)
  await page.locator('input[placeholder="Usuario"]').waitFor({ state: 'visible' })

  await page.fill('input[placeholder="Usuario"]', 'noexiste')
  await page.fill('input[placeholder="Contraseña"]', 'wrongpass')
  await page.getByRole('button', { name: 'Ingresar al sistema', exact: false }).click()
  await page.waitForTimeout(800)

  // Debe mostrar un toast de error o seguir en el login
  await expect(page.locator('.login-card')).toBeVisible()
})

// ─── Botón submit deshabilitado cuando los campos están vacíos ─────────────────

test('botón Ingresar deshabilitado con campos vacíos', async ({ page }) => {
  await page.goto(DEMO_URL)
  await page.locator('input[placeholder="Usuario"]').waitFor({ state: 'visible' })

  // Ambos inputs vacíos → botón debe estar deshabilitado
  const submitBtn = page.locator('button.login-submit.inactive').first()
  await expect(submitBtn).toBeVisible()
  await expect(submitBtn).toBeDisabled()
})

test('botón Ingresar se activa al llenar usuario y contraseña', async ({ page }) => {
  await page.goto(DEMO_URL)
  await page.locator('input[placeholder="Usuario"]').waitFor({ state: 'visible' })

  await page.fill('input[placeholder="Usuario"]', 'admin')
  await page.fill('input[placeholder="Contraseña"]', 'cualquier')

  const submitBtn = page.locator('button.login-submit.active').first()
  await expect(submitBtn).toBeVisible()
  await expect(submitBtn).toBeEnabled()
})
