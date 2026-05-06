export const APP_CONFIG = {
  name: import.meta.env.VITE_COMPANY_NAME || 'Mi Negocio',
  ruc: import.meta.env.VITE_COMPANY_RUC || '20000000000',
  address: import.meta.env.VITE_COMPANY_ADDRESS || 'Av. Principal 123',
  phone: import.meta.env.VITE_COMPANY_PHONE || '01-000-0000',
  currency: 'PEN', locale: 'es-PE', igvRate: 0.18,
  useApi: import.meta.env.VITE_USE_API === 'true',
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
}

export const ROLES = {
  admin: {
    label: 'Administrador', color: 'bg-blue-100 text-blue-700',
    pages: ['dashboard','pos','catalog','inventory','suppliers','purchases','cash','clients','reports','users','audit','alerts','discounts','tickets','settings', 'returns', 'loyalty'],
  },
  gerente: {
    label: 'Gerente', color: 'bg-purple-100 text-purple-700',
    pages: ['dashboard','pos','catalog','inventory','suppliers','purchases','cash','clients','reports','audit','alerts','discounts','tickets', 'loyalty'],
  },
  supervisor: {
    label: 'Supervisor', color: 'bg-amber-100 text-amber-700',
    pages: ['dashboard','pos','catalog','inventory','cash','clients','alerts','discounts','tickets','returns', 'loyalty'],
  },
  cajero: {
    label: 'Cajero', color: 'bg-green-100 text-green-700',
    pages: ['dashboard','pos','cash','returns'],    
  },
}



export const canAccess = (role, page) => ROLES[role]?.pages?.includes(page) ?? false

export const PAYMENT_METHODS = [
  { value: 'efectivo',      label: 'Efectivo',     icon: '💵', requiresRef: false },
  { value: 'yape',          label: 'Yape',          icon: '💜', requiresRef: true, refLabel: 'Código de operación' },
  { value: 'plin',          label: 'Plin',          icon: '💙', requiresRef: true, refLabel: 'Código de operación' },
  { value: 'tarjeta',       label: 'Tarjeta',       icon: '💳', requiresRef: true, refLabel: 'Últimos 4 dígitos' },
  { value: 'qr',            label: 'QR / BIM',      icon: '🏦', requiresRef: true, refLabel: 'Código de operación' },
  { value: 'transferencia', label: 'Transferencia', icon: '🏛️', requiresRef: true, refLabel: 'N° de operación' },
  { value: 'link',          label: 'Link de pago',  icon: '🔗', requiresRef: true, refLabel: 'Referencia de pago' },
  { value: 'credito',       label: 'Crédito',       icon: '📒', requiresRef: false },
]

export const BILLETES_PEN = [10, 20, 50, 100, 200]

export const UNITS = [
  { value: 'unidad', label: 'Unidad', decimal: false },
  { value: 'kg',     label: 'Kilogramo', decimal: true },
  { value: 'g',      label: 'Gramo', decimal: true },
  { value: 'litro',  label: 'Litro', decimal: true },
  { value: 'ml',     label: 'Mililitro', decimal: true },
  { value: 'metro',  label: 'Metro', decimal: true },
  { value: 'cm',     label: 'Centímetro', decimal: true },
  { value: 'docena', label: 'Docena', decimal: false },
  { value: 'caja',   label: 'Caja', decimal: false },
  { value: 'paquete',label: 'Paquete', decimal: false },
]

export const SECTORS = [
  { value: 'bodega',      label: 'Bodega / Abarrotes',    icon: '🛒', group: 'alimentos' },
  { value: 'panaderia',   label: 'Panadería',              icon: '🍞', group: 'alimentos' },
  { value: 'carniceria',  label: 'Carnicería',             icon: '🥩', group: 'alimentos' },
  { value: 'farmacia',    label: 'Farmacia',               icon: '💊', group: 'salud' },
  { value: 'boutique',    label: 'Boutique / Ropa',        icon: '👗', group: 'moda' },
  { value: 'optica',      label: 'Óptica',                 icon: '👓', group: 'salud' },
  { value: 'ferreteria',  label: 'Ferretería',             icon: '🔧', group: 'hogar' },
  { value: 'electronica', label: 'Electrónica',            icon: '📱', group: 'hogar' },
  { value: 'libreria',    label: 'Librería',               icon: '📚', group: 'otros' },
  { value: 'repuestos',   label: 'Repuestos Automotrices', icon: '🚗', group: 'otros' },
  { value: 'regalos',     label: 'Regalos / Variedades',   icon: '🎁', group: 'otros' },
  { value: 'otro',        label: 'Otro negocio',           icon: '🏪', group: 'otros' },
]

export const AUDIT_ACTIONS = {
  CREATE: { label: 'Creación',      color: 'bg-green-100 text-green-700' },
  UPDATE: { label: 'Modificación',  color: 'bg-blue-100 text-blue-700' },
  DELETE: { label: 'Eliminación',   color: 'bg-red-100 text-red-600' },
  CANCEL: { label: 'Cancelación',   color: 'bg-orange-100 text-orange-700' },
  LOGIN:  { label: 'Inicio sesión', color: 'bg-purple-100 text-purple-700' },
  LOGOUT: { label: 'Cierre sesión', color: 'bg-gray-100 text-gray-600' },
  EXPORT: { label: 'Exportación',   color: 'bg-teal-100 text-teal-700' },
}
