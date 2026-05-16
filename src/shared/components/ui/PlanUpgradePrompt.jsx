/**
 * PlanUpgradePrompt
 * Se muestra cuando el usuario navega a un módulo que no está incluido
 * en el plan actual del tenant (razón: 'upgrade') o no tiene rol suficiente
 * (razón: 'permission').
 */

import { PLANS, PLAN_ORDER } from '../../../config/plans'
import { ROLES }             from '../../../config/app'

const PLAN_COLORS = {
  trial:      { bg: '#f8fafc', border: '#e2e8f0', badge: '#64748b' },
  basic:      { bg: '#eff6ff', border: '#bfdbfe', badge: '#2563eb' },
  pro:        { bg: '#f5f3ff', border: '#ddd6fe', badge: '#7c3aed' },
  enterprise: { bg: '#fdf4ff', border: '#f0abfc', badge: '#a21caf' },
}

const MODULE_LABELS = {
  dashboard:  'Dashboard',        pos:         'Punto de Venta',
  catalog:    'Catálogo',         inventory:   'Inventario',
  merma:      'Merma',            trazabilidad:'Trazabilidad',
  suppliers:  'Proveedores',      purchases:   'Compras',
  cash:       'Caja',             clients:     'Clientes',
  quotations: 'Cotizaciones',     reports:     'Reportes',
  discounts:  'Gestión Descuentos', tickets:   'Descuentos por Vales',
  returns:    'Devoluciones',     alerts:      'Alertas',
  loyalty:    'Programa de Puntos', audit:     'Auditoría',
  users:      'Usuarios',         settings:    'Configuración',
}

export default function PlanUpgradePrompt({ page, reason, currentPlan, minPlan }) {
  const isUpgrade    = reason === 'upgrade'
  const targetPlan   = minPlan && PLANS[minPlan]
  const currPlanCfg  = PLANS[currentPlan] ?? PLANS.trial
  const moduleName   = MODULE_LABELS[page] ?? page
  const colors       = PLAN_COLORS[minPlan] ?? PLAN_COLORS.pro

  // Planes que sí incluyen el módulo (para mostrar comparativa)
  const plansWithFeature = PLAN_ORDER
    .filter(p => {
      const cfg = PLANS[p]
      return cfg.features === 'all' || cfg.features?.includes(page)
    })
    .map(p => PLANS[p])

  if (!isUpgrade) {
    // Razón: rol sin permiso
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-96 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-3xl mb-4">🔒</div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-2">Sin acceso a este módulo</h2>
        <p className="text-sm text-gray-400 dark:text-slate-500 max-w-sm">
          Tu rol de <span className="font-medium text-gray-600 dark:text-slate-300">
            {ROLES[ROLES[page]?.role]?.label ?? 'usuario actual'}
          </span> no tiene permiso para acceder a <strong>{moduleName}</strong>.
          Contacta al administrador si crees que deberías tener acceso.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-96 p-6">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-3xl mb-4 mx-auto shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
            🚀
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-1">
            {moduleName} no está en tu plan
          </h2>
          <p className="text-sm text-gray-400 dark:text-slate-500">
            Tu plan actual <span className="font-semibold text-gray-600 dark:text-slate-300">
              {currPlanCfg.label}
            </span> no incluye este módulo.
          </p>
        </div>

        {/* Planes que incluyen el módulo */}
        <div className="space-y-2 mb-6">
          {plansWithFeature.map(plan => {
            const c = PLAN_COLORS[plan.id]
            const isCurrent = plan.id === currentPlan
            return (
              <div key={plan.id}
                style={{ background: c.bg, borderColor: c.border }}
                className="border rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-lg">
                  {plan.id === 'trial' ? '🆓' : plan.id === 'basic' ? '⭐' : plan.id === 'pro' ? '🚀' : '🏢'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">{plan.label}</span>
                    {plan.badge && (
                      <span style={{ background: c.badge }} className="text-xs text-white px-2 py-0.5 rounded-full font-medium">
                        {plan.badge}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-xs text-gray-400 dark:text-slate-500">(plan actual)</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{plan.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-gray-700 dark:text-slate-200">
                    {plan.price === 0 ? 'Gratis' : `S/ ${plan.price}`}
                  </span>
                  {plan.price > 0 && <span className="text-xs text-gray-400 dark:text-slate-500">/mes</span>}
                </div>
                <span className="text-green-500 font-bold text-lg shrink-0">✓</span>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        {targetPlan && (
          <div className="text-center space-y-2">
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Disponible desde el plan <strong className="text-gray-600 dark:text-slate-300">{targetPlan.label}</strong>
              {targetPlan.price > 0 ? ` — S/ ${targetPlan.price}/mes` : ''}
            </p>
            <button
              onClick={() => window.open('/#pricing', '_self')}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-indigo-200 dark:shadow-indigo-900/30">
              Ver planes y actualizar
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
              </svg>
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
