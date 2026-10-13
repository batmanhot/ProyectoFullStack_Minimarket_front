/**
 * Helpers compartidos para los tests E2E.
 * Encapsula login, limpieza de estado y navegación.
 */

const DEMO = '/app/e2e'

/**
 * Limpia el localStorage del tenant E2E y recarga la app.
 * Garantiza estado limpio entre tests (sin sesión activa, carrito vacío, etc.).
 */
export async function resetDemoState(page) {
  await page.goto(DEMO)
  await page.evaluate(() => {
    // Eliminar solo las claves de la aplicación E2E (no toda la storage).
    Object.keys(localStorage)
      .filter(k => k.includes('e2e') || k.includes('minimarket') || k.includes('pos'))
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
  // El servidor de desarrollo mantiene una conexión HMR abierta; `networkidle`
  // no llega a cumplirse aunque el login ya esté listo para interactuar.
  await page.getByRole('button', { name: roleLabel, exact: false }).first().waitFor({ state: 'visible' })
  // El botón de rol muestra el label del rol (ej: "Administrador")
  await page.getByRole('button', { name: roleLabel, exact: false }).first().click()
  await page.locator('.login-card').waitFor({ state: 'hidden' })
}

/**
 * Login con credenciales manuales.
 */
export async function loginWithCredentials(page, username, password) {
  await page.goto(DEMO)
  await page.locator('input[placeholder="Usuario"]').waitFor({ state: 'visible' })
  await page.fill('input[placeholder="Usuario"]', username)
  await page.fill('input[placeholder="Contraseña"]', password)
  await page.getByRole('button', { name: 'Ingresar al sistema', exact: false }).click()
  await page.locator('.login-card').waitFor({ state: 'hidden' })
}

/**
 * Navega a una sección del tenant E2E.
 * @param {import('@playwright/test').Page} page
 * @param {'pos'|'cash'|'returns'|'dashboard'|'catalog'} section
 */
export async function goTo(page, section) {
  const navigationLabels = {
    pos:       'Punto de Venta',
    cash:      'Caja',
    returns:   'Devoluciones',
    dashboard: 'Dashboard',
    catalog:   'Catálogo',
  }
  const label = navigationLabels[section]
  if (!label) throw new Error(`Sección E2E no soportada: ${section}`)

  // TenantApp usa navegación por estado; cambiar la URL no cambia la vista.
  // Se utiliza el mismo Sidebar que opera el usuario.
  await page.getByRole('button', { name: label, exact: false }).first().click()
}

/** Cierra el comprobante de una venta, si permanece abierto como modal. */
export async function closeSaleReceipt(page) {
  const closeReceiptButton = page.getByRole('button', { name: 'Cerrar Nueva venta', exact: false })
  if (!await closeReceiptButton.isVisible().catch(() => false)) return
  await closeReceiptButton.click()
  await closeReceiptButton.waitFor({ state: 'hidden' })
}

/** Cierra el panel de cobro si una prueba lo dejó abierto. */
export async function closePaymentPanel(page) {
  const closePaymentButton = page.getByRole('button', { name: 'Cerrar (Esc)', exact: true })
  if (!await closePaymentButton.isVisible().catch(() => false)) return
  await closePaymentButton.click()
  await closePaymentButton.waitFor({ state: 'hidden' })
}

/** Cierra una caja activa para que cada prueba comience desde un estado conocido. */
export async function closeActiveCash(page) {
  await closePaymentPanel(page)
  await closeSaleReceipt(page)
  await goTo(page, 'cash')
  await page.getByTestId('cash-status-sync').waitFor({ state: 'hidden' })
  const closeButton = page.getByRole('button', { name: 'Cerrar caja', exact: true }).first()
  if (!await closeButton.isVisible().catch(() => false)) return

  await closeButton.click()
  await page.getByTestId('cash-counted-amount').fill('0')
  await page.getByTestId('cash-close-submit').press('Enter')
  await page.getByRole('button', { name: 'Sí, cerrar caja', exact: true }).waitFor({ state: 'visible' })
  const [response] = await Promise.all([
    page.waitForResponse(response => /\/cash\/[^/]+\/close$/.test(new URL(response.url()).pathname)),
    page.getByRole('button', { name: 'Sí, cerrar caja', exact: true }).click(),
  ])
  if (!response.ok()) throw new Error(`No se pudo cerrar la caja de prueba (HTTP ${response.status()})`)
  await page.getByRole('button', { name: 'Aperturar caja', exact: true }).first().waitFor({ state: 'visible' })
}

/** Abre una caja limpia y espera el estado operativo antes de probar el POS. */
export async function openCashSession(page, amount = '200') {
  await closeActiveCash(page)
  await page.getByTestId('cash-status-sync').waitFor({ state: 'hidden' })
  // La acción del estado vacío no cambia mientras React actualiza la cabecera
  // después de un cierre. Es el mismo flujo disponible al usuario.
  const openButton = page.getByRole('button', { name: 'Aperturar caja', exact: true }).first()
  await openButton.click()
  await page.getByTestId('cash-opening-amount').fill(amount)
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/cash/open')),
    page.getByTestId('cash-open-submit').press('Enter'),
  ])
  if (!response.ok()) throw new Error(`No se pudo aperturar la caja de prueba (HTTP ${response.status()})`)
  await page.getByRole('button', { name: 'Cerrar caja', exact: true }).first().waitFor({ state: 'visible' })
}
