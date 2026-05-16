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
