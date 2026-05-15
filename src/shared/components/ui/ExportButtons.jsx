/**
 * ExportButtons.jsx — Botones de exportación uniformes
 * Ruta: src/shared/components/ui/ExportButtons.jsx
 *
 * Uso:
 *   import { ExcelButton, PDFButton } from '../../shared/components/ui/ExportButtons'
 *   <ExcelButton onClick={handleExportExcel} />
 *   <PDFButton   onClick={handleExportPDF} />
 */

const ICON_EXCEL = (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M3 9h18M3 15h18M9 3v18"/>
  </svg>
)

const ICON_PDF = (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10,9 8,9 8,9"/>
  </svg>
)

export function ExcelButton({ onClick, label = 'Excel', className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/30 transition-colors ${className}`}
    >
      {ICON_EXCEL}
      {label}
    </button>
  )
}

const ICON_IMPORT = (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17,8 12,3 7,8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)

export function ImportButton({ onClick, label = 'Importar', className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-violet-50 text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-900/30 transition-colors ${className}`}
    >
      {ICON_IMPORT}
      {label}
    </button>
  )
}

export function PDFButton({ onClick, label = 'PDF', className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/30 transition-colors ${className}`}
    >
      {ICON_PDF}
      {label}
    </button>
  )
}
