import { api, USE_API, ok, delay } from './_base'
import { BILLING_CYCLES, PLANS } from '../config/plans'
import { getStoredPrices } from './tenantService'

/**
 * paymentService.js
 *
 * Gestiona la integración con la pasarela de pagos (Mercado Pago).
 * Sigue el patrón de "Arquitectura Limpia": el frontend no conoce las llaves secretas.
 *
 * FLUJO:
 * 1. El usuario elige un plan en la Landing o Register.
 * 2. Este servicio llama al backend (Django) para crear una "Preferencia".
 * 3. El backend responde con un 'init_point' (URL de Mercado Pago).
 * 4. El frontend redirige al usuario a esa URL.
 *
 * NOTA SOBRE PRECIOS:
 * El monto se calcula siempre desde getStoredPrices() (precios configurados por el
 * SuperAdmin en localStorage), NO desde PLANS[x].price (valor compilado en el código).
 * Esto garantiza que el precio cobrado coincide con el precio mostrado al usuario.
 */

const calcAmount = (planId, billingCycle) => {
  const storedPrices = getStoredPrices()
  const base = storedPrices[planId] ?? PLANS[planId]?.price ?? 0
  if (base === 0) return 0
  const discountPct = BILLING_CYCLES[billingCycle]?.discountPct ?? 0
  const monthly = Math.round(base * (1 - discountPct / 100))
  const months  = BILLING_CYCLES[billingCycle]?.months ?? 1
  return monthly * months
}

export const paymentService = {
  /**
   * Crea una preferencia de pago en Mercado Pago.
   *
   * @param {Object} params
   * @param {string} params.planId       - trial, basic, pro, enterprise
   * @param {string} params.billingCycle - monthly, quarterly, semiannual, annual
   * @param {Object} params.userData     - { email, name, businessName }
   * @returns {Promise<{ data: { initPoint: string, preferenceId: string } }>}
   */
  async createPreference({ planId, billingCycle, userData }) {
    const amount = calcAmount(planId, billingCycle)

    if (USE_API) {
      try {
        const { data } = await api.post('/payments/mercado-pago/preference', {
          planId,
          billingCycle,
          amount,
          email: userData.email,
          metadata: {
            businessName: userData.businessName,
            planId,
          }
        })
        return ok(data)
      } catch (error) {
        console.error('[paymentService] Error creando preferencia:', error)
        throw error
      }
    }

    // Modo simulado — útil para probar el flujo de UI antes de tener el backend listo.
    await delay(600)
    console.log('--- SIMULACIÓN MERCADO PAGO ---', { planId, billingCycle, amount, user: userData.email })

    return ok({
      preferenceId: `mock_pref_${Math.random().toString(36).substr(2, 9)}`,
      initPoint: 'https://www.mercadopago.com.pe/congratulations',
    })
  },
}
