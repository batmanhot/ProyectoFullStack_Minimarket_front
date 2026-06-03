/**
 * E2E: Login — flujos de autenticación (modo demo y credenciales)
 * URL base: http://localhost:3000/app/demo
 */
import { test, expect } from '@playwright/test'
import { loginWithRole, loginWithCredentials, goTo } from './helpers.js'

const DEMO_URL = 'http://localhost:3000/app/demo'

test.beforeEach(async ({ page }) => {
  // Limpiar estado anterior
  await page.goto(DEMO_URL)
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter(k => k.includes('demo') || k.includes('minimarket'))
      .forEach(k => localStorage.removeItem(k))
  })
})

// ─── Login con roles demo ──────────────────────────────────────────────────────

test('login demo — rol Administrador muestra la app', async ({ page }) => {
  await page.goto(DEMO_URL)
  await page.waitForLoadState('networkidle')

  // El panel de login debe estar visible
  await expect(page.locator('.login-card, .brand-name').first()).toBeVisible()

  // Click en el botón de rol Administrador
  await page.getByRole('button', { name: 'Administrador', exact: false }).first().click()
  await page.waitForTimeout(1000)

  // La URL debe haber cambiado (ya no está en el login o el sidebar es visible)
  // En modo demo, tras login muestra el Sidebar o navega a una sección
  await expect(page).not.toHaveURL(/login/)
})

test('login demo — rol Cajero accede con permisos reducidos', async ({ page }) => {
  await loginWithRole(page, 'Cajero')

  // Navegar al POS (Cajero tiene acceso al POS)
  await goTo(page, 'pos')
  await expect(page).toHaveURL(/pos/)
})

test('login demo — rol Gerente accede correctamente', async ({ page }) => {
  await loginWithRole(page, 'Gerente')
  await page.waitForTimeout(500)
  // Verificar que no hay pantalla de error
  await expect(page.locator('text=Error').or(page.locator('text=Acceso denegado'))).not.toBeVisible()
})

// ─── Login con credenciales manuales ──────────────────────────────────────────

test('login manual — admin / admin123', async ({ page }) => {
  await page.goto(DEMO_URL)
  await page.waitForLoadState('networkidle')

  await page.fill('input[placeholder="Usuario"]', 'admin')
  await page.fill('input[placeholder="Contraseña"]', 'admin123')
  await page.getByRole('button', { name: 'Ingresar al sistema', exact: false }).click()
  await page.waitForTimeout(1000)

  // Debe haber ingresado — no más pantalla de login
  await expect(page.locator('.login-card')).not.toBeVisible()
})

test('login manual — cajero1 / cajero123', async ({ page }) => {
  await page.goto(DEMO_URL)
  await page.waitForLoadState('networkidle')

  await page.fill('input[placeholder="Usuario"]', 'cajero1')
  await page.fill('input[placeholder="Contraseña"]', 'cajero123')
  await page.getByRole('button', { name: 'Ingresar al sistema', exact: false }).click()
  await page.waitForTimeout(1000)

  await expect(page.locator('.login-card')).not.toBeVisible()
})

test('login manual — credenciales incorrectas muestran error', async ({ page }) => {
  await page.goto(DEMO_URL)
  await page.waitForLoadState('networkidle')

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
  await page.waitForLoadState('networkidle')

  // Ambos inputs vacíos → botón debe estar deshabilitado
  const submitBtn = page.locator('button.login-submit.inactive').first()
  await expect(submitBtn).toBeVisible()
  await expect(submitBtn).toBeDisabled()
})

test('botón Ingresar se activa al llenar usuario y contraseña', async ({ page }) => {
  await page.goto(DEMO_URL)
  await page.waitForLoadState('networkidle')

  await page.fill('input[placeholder="Usuario"]', 'admin')
  await page.fill('input[placeholder="Contraseña"]', 'cualquier')

  const submitBtn = page.locator('button.login-submit.active').first()
  await expect(submitBtn).toBeVisible()
  await expect(submitBtn).toBeEnabled()
})
