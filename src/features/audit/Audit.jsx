import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { formatDateTime, exportCSV } from '../../shared/utils/helpers'
import { exportToExcel, exportToPDF } from '../../shared/utils/export'
import { AUDIT_ACTIONS } from '../../config/app'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { EmptyState } from '../../shared/components/ui/Skeleton'

const MODULES = ['Todos','Ventas','Catálogo','Inventario','Compras','Caja','Clientes','Proveedores','Usuarios','Cobranza','Configuración','Config Sistema','Auth']
const ACTIONS  = ['Todas','CREATE','UPDATE','DELETE','CANCEL','LOGIN','LOGOUT','EXPORT']

export default function Audit() {
  const { auditLog, businessConfig, addAuditLog } = useStore()
  const [search, setSearch]         = useState('')
  const [moduleF, setModuleF]       = useState('Todos')
  const [actionF, setActionF]       = useState('Todas')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const dq = useDebounce(search, 200)

  const filtered = useMemo(() => {
    let list = auditLog || []
    if (moduleF !== 'Todos')  list = list.filter(e => e.module === moduleF)
    if (actionF !== 'Todas')  list = list.filter(e => e.action === actionF)
    if (dateFrom) list = list.filter(e => new Date(e.timestamp) >= new Date(dateFrom))
    if (dateTo)   list = list.filter(e => new Date(e.timestamp) <= new Date(dateTo + 'T23:59:59'))
    if (dq) {
      const q = dq.toLowerCase()
      list = list.filter(e =>
        e.detail?.toLowerCase().includes(q) ||
        e.userName?.toLowerCase().includes(q) ||
        e.module?.toLowerCase().includes(q) ||
        e.entityId?.toLowerCase().includes(q)
      )
    }
    return list
  }, [auditLog, moduleF, actionF, dateFrom, dateTo, dq])

  // KPIs
  const kpis = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const todayEntries = (auditLog||[]).filter(e => e.timestamp?.startsWith(today))
    const users = [...new Set((auditLog||[]).map(e => e.userId))].length
    const byModule = {}
    ;(auditLog||[]).forEach(e => { byModule[e.module] = (byModule[e.module]||0)+1 })
    const topModule = Object.entries(byModule).sort((a,b)=>b[1]-a[1])[0]
    return { total: (auditLog||[]).length, todayCount: todayEntries.length, users, topModule: topModule?.[0] || '—' }
  }, [auditLog])

  const handleExport = () => {
    addAuditLog({ action: 'EXPORT', module: 'Auditoría', detail: `Exportación: ${filtered.length} registros` })
    exportToExcel(
      filtered.map(e => ({ Fecha: formatDateTime(e.timestamp), Usuario: e.userName, Rol: e.userRole, Acción: e.action, Módulo: e.module, Detalle: e.detail, EntityId: e.entityId || '' })),
      'auditoria'
    )
  }

  const handleExportPDF = () => {
    addAuditLog({ action: 'EXPORT', module: 'Auditoría', detail: `PDF: ${filtered.length} registros` })
    exportToPDF(
      'Log de Auditoría del Sistema',
      ['Fecha/Hora', 'Usuario', 'Rol', 'Acción', 'Módulo', 'Detalle'],
      filtered.slice(0, 200).map(e => [formatDateTime(e.timestamp), e.userName, e.userRole, e.action, e.module, e.detail]),
      businessConfig?.name
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Auditoría del sistema</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">{filtered.length} de {kpis.total} registros · trazabilidad completa de operaciones</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport}    className="px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">📊 Excel</button>
          <button onClick={handleExportPDF} className="px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">📄 PDF</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4"><p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Total de eventos</p><p className="text-2xl font-medium text-gray-800 dark:text-slate-100">{kpis.total}</p></div>
        <div className="bg-blue-50 rounded-xl p-4"><p className="text-xs text-blue-600 mb-1">Eventos hoy</p><p className="text-2xl font-medium text-blue-700">{kpis.todayCount}</p></div>
        <div className="bg-purple-50 rounded-xl p-4"><p className="text-xs text-purple-600 mb-1">Usuarios activos</p><p className="text-2xl font-medium text-purple-700">{kpis.users}</p></div>
        <div className="bg-teal-50 rounded-xl p-4"><p className="text-xs text-teal-600 mb-1">Módulo más activo</p><p className="text-lg font-medium text-teal-700 truncate">{kpis.topModule}</p></div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar en detalle, usuario, módulo..." className="flex-1 min-w-48 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <select value={moduleF} onChange={e => setModuleF(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={actionF} onChange={e => setActionF(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <button onClick={() => { setSearch(''); setModuleF('Todos'); setActionF('Todas'); setDateFrom(''); setDateTo('') }} className="px-3 py-2 text-xs text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">Limpiar</button>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="Sin registros de auditoría" message="Las operaciones del sistema aparecerán aquí automáticamente."/>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                {['Fecha / Hora','Usuario','Rol','Acción','Módulo','Detalle','ID Entidad'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {filtered.slice(0, 200).map(entry => {
                const actionCfg = AUDIT_ACTIONS[entry.action] || { label: entry.action, color: 'bg-gray-100 dark:bg-slate-700 text-gray-600' }
                return (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatDateTime(entry.timestamp)}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-medium text-gray-800 dark:text-slate-100">{entry.userName || 'Sistema'}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{entry.userRole}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${actionCfg.color}`}>{actionCfg.label}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{entry.module}</span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-slate-300 max-w-xs">{entry.detail}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-400 dark:text-slate-500 max-w-[100px] truncate">{entry.entityId ? entry.entityId.slice(-8) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 text-center text-xs text-gray-400 dark:text-slate-500">
              Mostrando 200 de {filtered.length} registros. Exporta a Excel para ver todos.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
