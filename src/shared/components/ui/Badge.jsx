const VARIANTS = {
  red:    'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
  amber:  'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
  green:  'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  blue:   'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  purple: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  gray:   'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300',
  teal:   'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400',
}

export default function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  )
}

export function StockBadge({ product }) {
  if (product.stock === 0)               return <Badge variant="red">Sin stock</Badge>
  if (product.stock <= product.stockMin) return <Badge variant="amber">Bajo ({product.stock})</Badge>
  return <Badge variant="green">{product.stock} {product.unit || 'u.'}</Badge>
}

export function ExpiryBadge({ product }) {
  if (!product.expiryDate) return null
  const days = Math.ceil((new Date(product.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
  if (days < 0)   return <Badge variant="red">Vencido</Badge>
  if (days <= 7)  return <Badge variant="red">Vence en {days}d</Badge>
  if (days <= 30) return <Badge variant="amber">Vence en {days}d</Badge>
  return null
}

export function RoleBadge({ role }) {
  const map    = { admin: 'blue', gerente: 'purple', supervisor: 'amber', cajero: 'green' }
  const labels = { admin: 'Admin', gerente: 'Gerente', supervisor: 'Supervisor', cajero: 'Cajero' }
  return <Badge variant={map[role] || 'gray'}>{labels[role] || role}</Badge>
}
