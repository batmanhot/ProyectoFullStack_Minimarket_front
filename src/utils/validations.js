import { z } from 'zod';

// Schema para login
export const loginSchema = z.object({
  username: z
    .string()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(50, 'El usuario no puede exceder 50 caracteres'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(100, 'La contraseña no puede exceder 100 caracteres'),
});

// Schema para crear usuario
export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(50, 'El usuario no puede exceder 50 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos'),
  email: z
    .string()
    .email('Ingresa un email válido')
    .min(1, 'El email es requerido'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(100, 'La contraseña no puede exceder 100 caracteres'),
  fullName: z
    .string()
    .min(3, 'El nombre completo debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  role: z.enum(['admin', 'gerente', 'supervisor', 'cajero'], {
    required_error: 'Selecciona un rol',
  }),
});

// Schema para productos
export const productSchema = z.object({
  barcode: z
    .string()
    .min(1, 'El código de barras es requerido')
    .max(50, 'El código no puede exceder 50 caracteres'),
  name: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
  description: z.string().max(500, 'La descripción no puede exceder 500 caracteres').optional().or(z.literal('')),
  categoryId: z.string().min(1, 'Selecciona una categoría').or(z.number()),
  priceBuy: z.coerce.number().min(0, 'El precio de compra no puede ser negativo'),
  priceSell: z.coerce.number().min(0, 'El precio de venta no puede ser negativo'),
  stock: z.coerce.number().min(0, 'El stock no puede ser negativo'),
  stockMin: z.coerce.number().min(0, 'El stock mínimo no puede ser negativo'),
  unit: z.string().min(1, 'La unidad es requerida'),
  supplierId: z.string().min(1, 'Selecciona un proveedor').or(z.number()).optional(),
});

// Schema para categorías
export const categorySchema = z.object({
  name: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  description: z.string().max(500, 'La descripción no puede exceder 500 caracteres').optional().or(z.literal('')),
});

// Schema para proveedores
export const supplierSchema = z.object({
  name: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(150, 'El nombre no puede exceder 150 caracteres'),
  contactName: z.string().max(100, 'El contacto no puede exceder 100 caracteres').optional().or(z.literal('')),
  phone: z.string().max(20, 'El teléfono no puede exceder 20 caracteres').optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().max(255, 'La dirección no puede exceder 255 caracteres').optional().or(z.literal('')),
  taxId: z.string().max(50, 'El RUC/NIT no puede exceder 50 caracteres').optional().or(z.literal('')),
});

// Schema para editar usuario
export const editUserSchema = z.object({
  username: z
    .string()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(50, 'El usuario no puede exceder 50 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos'),
  email: z
    .string()
    .email('Ingresa un email válido'),
  fullName: z
    .string()
    .min(3, 'El nombre completo debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  role: z.enum(['admin', 'gerente', 'supervisor', 'cajero'], {
    required_error: 'Selecciona un rol',
  }),
});

// Schema para tarjetas (Mercado Pago Ready)
export const cardSchema = z.object({
  cardNumber: z
    .string()
    .min(16, 'Número de tarjeta incompleto')
    .max(19, 'Número de tarjeta inválido'),
  cardName: z
    .string()
    .min(3, 'Nombre muy corto')
    .max(100, 'Nombre muy largo')
    .regex(/^[a-zA-Z\s]+$/, 'Solo letras'),
  expiryDate: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Formato MM/YY requerido'),
  cvv: z
    .string()
    .min(3, 'CVV debe tener 3-4 dígitos')
    .max(4, 'CVV debe tener 3-4 dígitos')
    .regex(/^\d+$/, 'Solo números'),
});