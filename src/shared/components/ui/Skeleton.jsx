export function TableSkeleton({ rows = 8, cols = 5 }) {
  return (
    <div className="animate-pulse">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-b border-gray-50 dark:border-slate-700/50" style={{ opacity: 1 - i * 0.08 }}>
          {[...Array(cols)].map((_, j) => (
            <div key={j} className="h-4 bg-gray-100 dark:bg-slate-700 rounded flex-1" style={{ maxWidth: j === 0 ? '200px' : undefined }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded w-16" />
          <div className="h-8 bg-gray-200 dark:bg-slate-600 rounded w-24" />
          <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded w-20" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon = '📦', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="text-5xl opacity-30">{icon}</div>
      <p className="text-base font-medium text-gray-500 dark:text-slate-400">{title}</p>
      {message && <p className="text-sm text-gray-400 dark:text-slate-500 max-w-xs">{message}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
