import { useEffect, useState } from 'react'
import Modal from './Modal'
import { downloadExcel } from '../../utils/export'

export default function ExcelPreviewHost() {
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    const handlePreview = (event) => {
      const { rows = [], filename = 'reporte', title = 'Vista previa Excel' } = event.detail || {}
      setPreview({ rows, filename, title })
    }

    window.addEventListener('excel-preview', handlePreview)
    return () => window.removeEventListener('excel-preview', handlePreview)
  }, [])

  if (!preview) return null

  const columns = preview.rows.length ? Object.keys(preview.rows[0]) : []
  const filename = `${preview.filename}.xls`

  const handleDownload = () => {
    downloadExcel(preview.rows, preview.filename)
  }

  return (
    <Modal
      title={preview.title}
      subtitle={`${preview.rows.length} registro(s) listos para descargar`}
      size="xl"
      onClose={() => setPreview(null)}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Vista de solo lectura. El archivo se descargara como {filename}.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="px-4 py-2 text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!preview.rows.length}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              Descargar Excel
            </button>
          </div>
        </div>
      }>
      <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Hoja: Datos</span>
          </div>
          <span className="text-xs text-emerald-700/70 dark:text-emerald-300/70">Solo lectura</span>
        </div>

        <div className="max-h-[56vh] overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-10 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-2 py-2 text-right text-gray-400 font-medium">#</th>
                {columns.map((col) => (
                  <th key={col} className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 text-left text-gray-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-slate-500">
                    No hay datos para mostrar.
                  </td>
                </tr>
              ) : preview.rows.map((row, rowIndex) => (
                <tr key={`${preview.filename}-${rowIndex}`} className="hover:bg-blue-50/60 dark:hover:bg-slate-800/70">
                  <td className="bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 px-2 py-2 text-right text-gray-400 tabular-nums">
                    {rowIndex + 1}
                  </td>
                  {columns.map((col) => (
                    <td key={col} className="border border-gray-200 dark:border-slate-700 px-3 py-2 text-gray-700 dark:text-slate-200 whitespace-nowrap">
                      {row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}
