import { z } from 'zod'

// ─── PRODUCTO ─────────────────────────────────────────────────────────────────
export const productSchema = z.object({
  name:         z.string().min(2, 'Nombre requerido').max(200),
  barcode:      z.string().min(1, 'Código requerido').max(50),
  sku:          z.string().max(50).optional().default(''),
  description:  z.string().max(500).optional().default(''),
  brand:        z.string().max(100).optional().default(''),
  categoryId:   z.string().min(1, 'Selecciona una categoría'),
  supplierId:   z.string().min(1, 'Selecciona un proveedor'),
  priceBuy:     z.coerce.number().positive('Precio de compra requerido'),
  priceSell:    z.coerce.number().positive('Precio de venta requerido'),
  stock:        z.coerce.number().min(0, 'Stock no puede ser negativo').default(0),
  stockMin:     z.coerce.number().int().min(0).default(5),
  stockMax:     z.coerce.number().int().min(1).default(100),
  unit:         z.enum(['unidad','kg','g','litro','ml','metro','cm','docena','caja','paquete']).default('unidad'),
  hasVariants:  z.boolean().default(false),
  expiryDate:   z.string().optional().nullable(),
  serialNumber: z.string().max(100).optional().default(''),
  location:     z.string().max(100).optional().default(''),
  attributes:   z.record(z.string()).optional().default({}),
  isActive:     z.boolean().default(true),
  imageUrl:     z.string().url('URL de imagen inválida').optional().or(z.literal('')).default(''),
  useBatches:   z.boolean().default(false),

  // ── Estrategia de control de inventario ────────────────────────────────────
  // 'simple'    → stock manual, sin lotes (ropa, plásticos, librería)
  // 'lote_fefo' → lotes con vencimiento, sale el que vence antes (alimentos, medicamentos)
  // 'lote_fifo' → lotes sin vencimiento, sale el que entró antes (ferretería, repuestos)
  // 'serie'     → cada unidad con número de serie único (electrónica, óptica)
  stockControl: z.enum(['simple','lote_fefo','lote_fifo','serie']).default('simple'),

}).refine(d => d.priceSell >= d.priceBuy, {
  message: 'El precio de venta debe ser ≥ al precio de compra',
  path: ['priceSell'],
})

// ─── VARIANTE DE PRODUCTO ─────────────────────────────────────────────────────
export const productVariantSchema = z.object({
  productId:  z.string(),
  barcode:    z.string().min(1, 'Código requerido').max(50),
  sku:        z.string().max(50).optional().default(''),
  attributes: z.record(z.string()).default({}), // { talla: 'M', color: 'rojo' }
  stock:      z.coerce.number().int().min(0).default(0),
  stockMin:   z.coerce.number().int().min(0).default(2),
  priceSell:  z.coerce.number().positive().optional().nullable(),
})

// ─── CLIENTE ──────────────────────────────────────────────────────────────────
export const clientSchema = z.object({
  name:           z.string().min(2, 'Nombre requerido').max(150),
  documentType:   z.enum(['DNI','RUC','CE','Pasaporte']).default('DNI'),
  documentNumber: z.string().min(8, 'Número requerido').max(20),
  phone:          z.string().max(20).optional().default(''),
  email:          z.string().email('Email inválido').optional().or(z.literal('')).default(''),
  address:        z.string().max(300).optional().default(''),
  creditLimit:    z.coerce.number().min(0).default(0),
  notes:          z.string().max(500).optional().default(''),
})

// ─── PROVEEDOR ────────────────────────────────────────────────────────────────
export const supplierSchema = z.object({
  name:    z.string().min(2, 'Nombre requerido').max(150),
  contact: z.string().max(100).optional().default(''),
  phone:   z.string().max(20).optional().default(''),
  email:   z.string().email('Email inválido').optional().or(z.literal('')).default(''),
  address: z.string().max(300).optional().default(''),
  taxId:   z.string().max(20).optional().default(''),
  notes:   z.string().max(500).optional().default(''),
})

// ─── USUARIO ──────────────────────────────────────────────────────────────────
export const userSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y _'),
  fullName: z.string().min(3).max(100),
  email:    z.string().email('Email inválido'),
  role:     z.enum(['admin','gerente','supervisor','cajero']),
  isActive: z.boolean().default(true),
})

// ─── PAGO (item dentro de una venta) ─────────────────────────────────────────
export const paymentItemSchema = z.object({
  method:    z.enum(['efectivo','yape','plin','tarjeta','qr','transferencia','link','credito']),
  amount:    z.coerce.number().positive('Ingresa el monto'),
  reference: z.string().max(100).optional().default(''),
})

// ─── CARRITO ITEM ─────────────────────────────────────────────────────────────
export const cartItemSchema = z.object({
  productId:   z.string(),
  variantId:   z.string().optional().nullable(),
  productName: z.string(),
  barcode:     z.string(),
  quantity:    z.number().positive('Cantidad debe ser mayor a 0'),
  unitPrice:   z.number().positive(),
  discount:    z.number().min(0).default(0),
  subtotal:    z.number().nonnegative(),
  unit:        z.string().optional().default('unidad'),
})

// ─── CAJA ─────────────────────────────────────────────────────────────────────
export const openCashSchema = z.object({
  openingAmount: z.coerce.number().min(0, 'Ingresa el monto inicial').max(999999),
  notes:         z.string().max(300).optional().default(''),
})

export const closeCashSchema = z.object({
  countedAmount: z.coerce.number().min(0, 'Ingresa el monto contado'),
  notes:         z.string().max(300).optional().default(''),
})

// ─── AJUSTE DE STOCK ─────────────────────────────────────────────────────────
export const stockAdjustSchema = z.object({
  quantity: z.coerce.number().positive('Cantidad mínima > 0'),
  type:     z.enum(['entrada','salida','ajuste','merma']),
  reason:   z.string().min(3, 'Describe el motivo').max(200),
})

// ─── COMPRA A PROVEEDOR ───────────────────────────────────────────────────────
export const purchaseSchema = z.object({
  supplierId: z.string().min(1, 'Selecciona un proveedor'),
  notes:      z.string().max(500).optional().default(''),
})

export const purchaseItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional().nullable(),
  quantity:  z.coerce.number().positive('Cantidad requerida'),
  priceBuy:  z.coerce.number().positive('Precio de compra requerido'),
})

// ─── CONFIGURACIÓN DEL NEGOCIO ────────────────────────────────────────────────
export const businessConfigSchema = z.object({
  name:    z.string().min(2).max(100),
  ruc:     z.string().max(20).optional().default(''),
  address: z.string().max(300).optional().default(''),
  phone:   z.string().max(20).optional().default(''),
  logoUrl: z.string().url().optional().or(z.literal('')).default(''),
  sector:  z.string().optional().default('bodega'),
  igvRate: z.coerce.number().min(0).max(1).default(0.18),
})
