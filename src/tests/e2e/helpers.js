/**
 * Helpers compartidos para los tests E2E.
 * Encapsula login, limpieza de estado y navegación.
 */

const BASE = 'http://localhost:3000'
const DEMO = `${BASE}/app/demo`

/**
 * Limpia el localStorage del tenant demo y recarga la app.
 * Garantiza estado limpio entre tests (sin sesión activa, carrito vacío, etc.).
 */
export async function resetDemoState(page) {
  await page.goto(DEMO)
  await page.evaluate(() => {
    // Eliminar solo las claves del tenant demo (no toda la storage, para no afectar otras cosas)
    Object.keys(localStorage)
      .filter(k => k.includes('demo') || k.includes('minimarket') || k.includes('pos'))
      .forEach(k => localStorage.removeItem(k))
  })
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
}

/**
 * Hace login con el rol demo indicado (Admin, Cajero, Gerente, Supervisor).
 * @param {import('@playwright/test').Page} page
 * @param {'Administrador'|'Cajero'|'Gerente'|'Supervisor'} roleLabel
 */
export async function loginWithRole(page, roleLabel = 'Administrador') {
  await page.goto(DEMO)
  await page.waitForLoadState('networkidle')
  // El botón de rol muestra el label del rol (ej: "Administrador")
  await page.getByRole('button', { name: roleLabel, exact: false }).first().click()
  // Esperar que el toast de bienvenida aparezca o que navegue fuera del login
  await page.waitForTimeout(800)
}

/**
 * Login con credenciales manuales.
 */
export async function loginWithCredentials(page, username, password) {
  await page.goto(DEMO)
  await page.waitForLoadState('networkidle')
  await page.fill('input[placeholder="Usuario"]', username)
  await page.fill('input[placeholder="Contraseña"]', password)
  await page.getByRole('button', { name: 'Ingresar al sistema', exact: false }).click()
  await page.waitForTimeout(800)
}

/**
 * Navega a una sección del tenant demo.
 * @param {import('@playwright/test').Page} page
 * @param {'pos'|'cash'|'returns'|'dashboard'|'catalog'} section
 */
export async function goTo(page, section) {
  await page.goto(`${DEMO}/${section}`)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(400)
}
