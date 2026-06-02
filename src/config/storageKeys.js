// Fuente única de todas las keys de localStorage usadas en la app.
// Cambiar un key aquí lo actualiza en todos los consumidores.

export const STORAGE_KEYS = {
  authToken:   'mm_token',
  storePrefix: 'mm_store_v5_',

  // Mock de tenants (solo modo desarrollo, sin API real)
  mockTenants:         'mm_mock_tenants_v1',
  mockAccesses:        'mm_mock_accesses_v1',
  mockRenewals:        'mm_mock_renewals_v1',
  mockPrices:          'mm_mock_prices_v1',
  mockSite:            'mm_mock_site_v2',
  mockPlanLimits:      'mm_saas_plan_limits_v2',
  mockAlertThresholds: 'mm_alert_thresholds_v1',
}
