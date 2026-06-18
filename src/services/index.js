/**
 * Barrel de servicios — re-exporta todo desde archivos individuales.
 * Los imports existentes (`from '../../services/index'`) siguen funcionando sin cambios.
 */
export { api }                      from './_base'
export { authService }              from './authService'
export { productService }           from './productService'
export { saleService }              from './saleService'
export { cashService }              from './cashService'
export { clientService }            from './clientService'
export { supplierService }          from './supplierService'
export { purchaseService }          from './purchaseService'
export { returnService }            from './returnService'
export { discountCampaignService }  from './discountCampaignService'
export { discountTicketService }    from './discountTicketService'
export { tenantService }            from './tenantService'
export { paymentService }           from './paymentService'
export { categoryService }          from './categoryService'
export { brandService }             from './brandService'
export { userService }              from './userService'
export { mermaService }             from './mermaService'
export { auditService }             from './auditService'
export { quotationService }         from './quotationService'
export { reportService }            from './reportService'
export { dashboardService }         from './dashboardService'
// Servicios nuevos
export { serialService }            from './serialService'
export { locationService }          from './locationService'
export { notificationService }      from './notificationService'
