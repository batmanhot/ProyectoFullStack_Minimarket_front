const VARIANTS = {
  red:    'bg-red-100 text-red-600',
  amber:  'bg-amber-100 text-amber-600',
  green:  'bg-green-100 text-green-700',
  blue:   'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  gray:   'bg-gray-100 text-gray-600',
  teal:   'bg-teal-100 text-teal-700',
}

export default function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  )
}

export function StockBadge({ product }) {
  if (product.stock === 0)            return <Badge variant="red">Sin stock</Badge>
  if (product.stock <= product.stockMin) return <Badge variant="amber">Bajo ({product.stock})</Badge>
  return <Badge variant="green">{product.stock} {product.unit || 'u.'}</Badge>
}

export function ExpiryBadge({ product }) {
  if (!product.expiryDate) return null
  const days = Math.ceil((new Date(product.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
  if (days < 0)    return <Badge variant="red">Vencido</Badge>
  if (days <= 7)   return <Badge variant="red">Vence en {days}d</Badge>
  if (days <= 30)  return <Badge variant="amber">Vence en {days}d</Badge>
  return null
}

export function RoleBadge({ role }) {
  const map = { admin: 'blue', gerente: 'purple', supervisor: 'amber', cajero: 'green' }
  const labels = { admin: 'Admin', gerente: 'Gerente', supervisor: 'Supervisor', cajero: 'Cajero' }
  return <Badge variant={map[role] || 'gray'}>{labels[role] || role}</Badge>
}
