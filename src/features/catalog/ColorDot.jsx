export function ColorDot({ color, size = 'sm' }) {
  const className = size === 'lg' ? 'w-5 h-5' : 'w-3 h-3'
  return <span className={`${className} rounded-full inline-block flex-shrink-0`} style={{ backgroundColor: color || '#94a3b8' }}/>
}
