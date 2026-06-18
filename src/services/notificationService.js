/**
 * notificationService.js
 * Servicio de notificaciones por email para alertas críticas.
 * Conecta con notifications.routes.js del backend.
 * En modo local, simula el envío con un log en consola.
 */
import { api, USE_API, ok, fail, gs, delay } from './_base'

export const notificationService = {

  // ── Enviar email de prueba ────────────────────────────────────────────────
  // Verifica que la configuración SMTP del servidor funciona.
  async sendTest(toEmail) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.post('/notifications/email/test', { toEmail })
        return ok(data.data)
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Error al enviar email de prueba'
        // 503 = SMTP no configurado en el servidor — mensaje específico para el admin
        if (err.response?.status === 503) {
          return fail('SMTP no configurado en el servidor. Configura SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS en el archivo .env del backend y reinicia el servidor.')
        }
        return fail(msg)
      }
    }
    // Modo local: simular envío
    console.info(`[notificationService] Modo demo — email de prueba a: ${toEmail}`)
    return ok({ sent: true, to: toEmail, demo: true })
  },

  // ── Enviar alerta puntual por email ───────────────────────────────────────
  // Útil para disparar alertas desde el módulo de Alertas.
  async sendAlert(toEmail, alert) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.post('/notifications/email/alert', { toEmail, alert })
        return ok(data.data)
      } catch (err) {
        if (err.response?.status === 503) return fail('SMTP no configurado en el servidor')
        return fail(err.response?.data?.error || err.message || 'Error al enviar alerta')
      }
    }
    console.info(`[notificationService] Modo demo — alerta "${alert.title}" a: ${toEmail}`)
    return ok({ sent: true, to: toEmail, demo: true })
  },

  // ── Enviar resumen diario de alertas ──────────────────────────────────────
  // El backend recolecta todas las alertas activas y las envía en un email.
  async sendDailySummary(toEmail) {
    await delay()
    if (USE_API) {
      try {
        const { data } = await api.post('/notifications/email/summary', { toEmail })
        // Si no hay alertas activas, el backend devuelve { sent: false }
        if (!data.data?.sent) {
          return ok({ sent: false, reason: 'Sin alertas activas' })
        }
        return ok(data.data)
      } catch (err) {
        if (err.response?.status === 503) return fail('SMTP no configurado en el servidor')
        return fail(err.response?.data?.error || err.message || 'Error al enviar resumen')
      }
    }
    // Modo local: calcular alertas desde el store y simular
    const state    = gs()
    const products = state.products.filter(p => p.isActive)
    const critical = products.filter(p => p.stock <= 0).length
    const warning  = products.filter(p => p.stock > 0 && p.stock <= p.stockMin).length
    const total    = critical + warning
    if (total === 0) return ok({ sent: false, reason: 'Sin alertas activas en modo demo' })
    console.info(`[notificationService] Modo demo — resumen diario a: ${toEmail} · ${total} alertas`)
    return ok({ sent: true, to: toEmail, alertCount: total, demo: true })
  },
}
