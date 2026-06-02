// Fuente única de límites por plan.
// Importado por plans.js (para getPlanLimit) y por tenantService.js (para SuperAdmin).
// null = ilimitado.

export const PLAN_LIMITS = {
  trial: {
    products: 100, users: 1, warehouses: 1, suppliers: 0,
    customers: 50, ordersPerMonth: 100, storageGB: 1,
    supportType: 'email',
    apiAccess: false, multiCompany: false, advancedExport: false, advancedReports: false,
    exportData: false, multiCash: false,
  },
  basic: {
    products: 500, users: 3, warehouses: 2, suppliers: 50,
    customers: 100, ordersPerMonth: 300, storageGB: 5,
    supportType: 'email',
    apiAccess: false, multiCompany: false, advancedExport: true, advancedReports: false,
    exportData: true, multiCash: false,
  },
  pro: {
    products: 2000, users: 10, warehouses: 5, suppliers: 200,
    customers: 500, ordersPerMonth: 1000, storageGB: 20,
    supportType: 'chat',
    apiAccess: true, multiCompany: false, advancedExport: true, advancedReports: true,
    exportData: true, multiCash: true,
  },
  enterprise: {
    products: null, users: null, warehouses: null, suppliers: null,
    customers: null, ordersPerMonth: null, storageGB: null,
    supportType: 'phone',
    apiAccess: true, multiCompany: true, advancedExport: true, advancedReports: true,
    exportData: true, multiCash: true,
  },
}
