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
    pages: ['dashboard','pos','catalog','inventory','merma','suppliers','purchases','cash','clients','reports','users','audit','alerts','discounts','tickets','settings', 'returns', 'loyalty', 'quotations'],
  },
  gerente: {
    label: 'Gerente', color: 'bg-purple-100 text-purple-700',
    pages: ['dashboard','pos','catalog','inventory','merma','suppliers','purchases','cash','clients','reports','audit','alerts','discounts','tickets', 'loyalty', 'quotations'],
  },
  supervisor: {
    label: 'Supervisor', color: 'bg-amber-100 text-amber-700',
    pages: ['dashboard','pos','catalog','inventory','merma','cash','clients','alerts','discounts','tickets','returns', 'loyalty', 'quotations'],
  },
  cajero: {
    label: 'Cajero', color: 'bg-green-100 text-green-700',
    pages: ['dashboard','pos','cash','returns', 'quotations'],    
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
  { value: 'bodega',      label: 'Bodega / Abarrotes',     icon: '🛒', stockDefault: 'lote_fefo', expiryAlert: 30  },
  { value: 'panaderia',   label: 'Panadería',              icon: '🍞', stockDefault: 'lote_fefo', expiryAlert: 3   },
  { value: 'carniceria',  label: 'Carnicería',             icon: '🥩', stockDefault: 'lote_fefo', expiryAlert: 5   },
  { value: 'farmacia',    label: 'Farmacia',               icon: '💊', stockDefault: 'lote_fefo', expiryAlert: 60  },
  { value: 'boutique',    label: 'Boutique / Ropa',        icon: '👗', stockDefault: 'simple',    expiryAlert: 0   },
  { value: 'optica',      label: 'Óptica',                 icon: '👓', stockDefault: 'serie',     expiryAlert: 0   },
  { value: 'ferreteria',  label: 'Ferretería',             icon: '🔧', stockDefault: 'lote_fifo', expiryAlert: 0   },
  { value: 'electronica', label: 'Electrónica',            icon: '📱', stockDefault: 'serie',     expiryAlert: 0   },
  { value: 'libreria',    label: 'Librería',               icon: '📚', stockDefault: 'simple',    expiryAlert: 0   },
  { value: 'repuestos',   label: 'Repuestos Automotrices', icon: '🚗', stockDefault: 'lote_fifo', expiryAlert: 0   },
  { value: 'regalos',     label: 'Regalos / Variedades',   icon: '🎁', stockDefault: 'simple',    expiryAlert: 0   },
  { value: 'otro',        label: 'Otro negocio',           icon: '🏪', stockDefault: 'simple',    expiryAlert: 0   },
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
