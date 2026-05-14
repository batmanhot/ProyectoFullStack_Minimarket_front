/**
 * Audit.jsx — Auditoría del Sistema v2
 * Ruta: src/features/audit/Audit.jsx
 *
 * MEJORAS vs v1:
 *  1. Paginación real (25 registros/página) — ya no corta en 200 sin aviso claro
 *  2. Vista estadística: barras de actividad por módulo y por acción
 *  3. Filtros en línea con chips visuales activos
 *  4. Columna de detalle expandible (click en fila)
 *  5. Botón "Limpiar log" con confirmación (solo admin)
 *  6. MODULES dinámico derivado del propio auditLog (no hardcodeado)
 *  7. Badge de acción con icono además del color
 *  8. selectTodayReturns integrado para el KPI de devoluciones del día
 */

import { useState, useMemo, useCallback } from 'react'
import { useStore }                    from '../../store/index'
import { formatDateTime, exportCSV }    from '../../shared/utils/helpers'
import { exportToExcel, exportToPDF }   from '../../shared/utils/export'
import { ExcelButton, PDFButton }        from '../../shared/components/ui/ExportButtons'
import { AUDIT_ACTIONS }                from '../../config/app'
import { useDebounce }                  from '../../shared/hooks/useDebounce'
import { EmptyState }                   from '../../shared/components/ui/Skeleton'

// ─── Constantes ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 25
const ACTIONS   = ['Todas', 'CREATE', 'UPDATE', 'DELETE', 'CANCEL', 'LOGIN', 'LOGOUT', 'EXPORT']

const ACTION_ICONS = {
  CREATE: '＋', UPDATE: '✎', DELETE: '✕', CANCEL: '⊘',
  LOGIN:  '→',  LOGOUT: '←', EXPORT: '↑',
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-full font-medium">
      {label}
      <button onClick={onRemove} className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100 leading-none">✕</button>
    </span>
  )
}

function ActionBadge({ action }) {
  const cfg  = AUDIT_ACTIONS[action] || { label: action, color: 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300' }
  const icon = ACTION_ICONS[action] || '·'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cfg.color}`}>
      <span className="font-bold text-[10px]">{icon}</span>
      {cfg.label}
    </span>
  )
}

function ModuleBarChart({ data }) {
  const max = Math.max(...Object.values(data), 1)
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8)
  return (
    <div className="space-y-2">
      {sorted.map(([module, count]) => (
        <div key={module} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-slate-400 w-28 truncate shrink-0">{module}</span>
          <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full bg-blue-400 dark:bg-blue-500 transition-all"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-600 dark:text-slate-300 w-8 text-right shrink-0">{count}</span>
        </div>
      ))}
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Audit() {
  const { auditLog, businessConfig, currentUser, addAuditLog, clearAuditLog, returns: returnsList = [] } = useStore()

  const todayReturns = useMemo(() => {
    const today = new Date().toDateString()
    return returnsList.filter(
      (r) => new Date(r.createdAt).toDateString() === today && r.status !== 'anulada'
    )
  }, [returnsList])

  const [search, setSearch]       = useState('')
  const [moduleF, setModuleF]     = useState('Todos')
  const [actionF, setActionF]     = useState('Todas')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [page, setPage]           = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const dq = useDebounce(search, 200)

  // Módulos dinámicos derivados del propio log (no hardcodeados)
  const MODULES = useMemo(() => {
    const unique = [...new Set((auditLog || []).map((e) => e.module))].sort()
    return ['Todos', ...unique]
  }, [auditLog])

  // Filtrado
  const filtered = useMemo(() => {
    let list = auditLog || []
    if (moduleF !== 'Todos') list = list.filter((e) => e.module === moduleF)
    if (actionF !== 'Todas') list = list.filter((e) => e.action === actionF)
    if (dateFrom) list = list.filter((e) => new Date(e.timestamp) >= new Date(dateFrom))
    if (dateTo)   list = list.filter((e) => new Date(e.timestamp) <= new Date(dateTo + 'T23:59:59'))
    if (dq) {
      const q = dq.toLowerCase()
      list = list.filter((e) =>
        e.detail?.toLowerCase().includes(q)   ||
        e.userName?.toLowerCase().includes(q) ||
        e.module?.toLowerCase().includes(q)   ||
        e.entityId?.toLowerCase().includes(q)
      )
    }
    return list
  }, [auditLog, moduleF, actionF, dateFrom, dateTo, dq])

  // Paginación
  const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage  = Math.min(page, totalPages)
  const pageItems    = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Reset página cuando cambian filtros
  const resetPage = useCallback(() => setPage(1), [])

  // KPIs
  const kpis = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const all   = auditLog || []
    const todayEntries = all.filter((e) => e.timestamp?.startsWith(today))
    const users = [...new Set(all.map((e) => e.userId))].length

    const byModule = {}
    const byAction = {}
    all.forEach((e) => {
      byModule[e.module] = (byModule[e.module] || 0) + 1
      byAction[e.action] = (byAction[e.action] || 0) + 1
    })
    const topModule = Object.entries(byModule).sort((a, b) => b[1] - a[1])[0]
    const topAction = Object.entries(byAction).sort((a, b) => b[1] - a[1])[0]

    return {
      total:      all.length,
      todayCount: todayEntries.length,
      users,
      topModule:  topModule?.[0] || '—',
      topAction:  topAction?.[0] || '—',
      byModule,
      byAction,
    }
  }, [auditLog])

  // Chips de filtros activos
  const activeFilters = [
    moduleF !== 'Todos' && { label: `Módulo: ${moduleF}`, clear: () => { setModuleF('Todos'); resetPage() } },
    actionF !== 'Todas' && { label: `Acción: ${actionF}`, clear: () => { setActionF('Todas'); resetPage() } },
    dateFrom            && { label: `Desde: ${dateFrom}`, clear: () => { setDateFrom(''); resetPage() } },
    dateTo              && { label: `Hasta: ${dateTo}`,   clear: () => { setDateTo(''); resetPage() } },
    dq                  && { label: `Busca: "${dq}"`,     clear: () => { setSearch(''); resetPage() } },
  ].filter(Boolean)

  // Exportaciones
  const handleExportExcel = () => {
    addAuditLog({ action: 'EXPORT', module: 'Auditoría', detail: `Excel: ${filtered.length} registros` })
    exportToExcel(
      filtered.map((e) => ({
        Fecha:    formatDateTime(e.timestamp),
        Usuario:  e.userName,
        Rol:      e.userRole,
        Acción:   e.action,
        Módulo:   e.module,
        Detalle:  e.detail,
        EntityId: e.entityId || '',
      })),
      'auditoria'
    )
  }

  const handleExportPDF = () => {
    addAuditLog({ action: 'EXPORT', module: 'Auditoría', detail: `PDF: ${filtered.length} registros` })
    exportToPDF(
      'Log de Auditoría del Sistema',
      ['Fecha/Hora', 'Usuario', 'Rol', 'Acción', 'Módulo', 'Detalle'],
      filtered.slice(0, 200).map((e) => [
        formatDateTime(e.timestamp), e.userName, e.userRole, e.action, e.module, e.detail,
      ]),
      businessConfig?.name
    )
  }

  const handleClearLog = () => {
    clearAuditLog()
    setConfirmClear(false)
    setPage(1)
  }

  const isAdmin = currentUser?.role === 'admin'

  return (
    <div className="w-full p-6 space-y-5">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            🔍 Auditoría del sistema
          </h1>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-0.5">
            {filtered.length.toLocaleString()} de {kpis.total.toLocaleString()} eventos · trazabilidad completa de operaciones
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowStats((v) => !v)}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${showStats ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
            📊 Estadísticas
          </button>
          <ExcelButton onClick={handleExportExcel} />
          <PDFButton   onClick={handleExportPDF} />
          {isAdmin && (
            <button onClick={() => setConfirmClear(true)}
              className="px-3 py-2 text-sm border border-red-200 text-red-500 rounded-lg hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20">
              🗑 Limpiar log
            </button>
          )}
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total eventos',      value: kpis.total.toLocaleString(),      bg: 'bg-gray-50 dark:bg-slate-800/50',  text: 'text-gray-800 dark:text-slate-100' },
          { label: 'Eventos hoy',        value: kpis.todayCount.toLocaleString(), bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-700 dark:text-blue-300' },
          { label: 'Usuarios activos',   value: kpis.users,                       bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300' },
          { label: 'Módulo más activo',  value: kpis.topModule,                   bg: 'bg-teal-50 dark:bg-teal-900/20',   text: 'text-teal-700 dark:text-teal-300', small: true },
          { label: 'Devoluciones hoy',   value: todayReturns.length,              bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-300' },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4`}>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1 font-medium">{k.label}</p>
            <p className={`font-semibold ${k.small ? 'text-base truncate' : 'text-2xl'} ${k.text}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── PANEL DE ESTADÍSTICAS ────────────────────────────────────────────── */}
      {showStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Actividad por módulo</p>
            <ModuleBarChart data={kpis.byModule} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Eventos por tipo de acción</p>
            <div className="space-y-2">
              {Object.entries(kpis.byAction).sort((a, b) => b[1] - a[1]).map(([action, count]) => {
                const cfg  = AUDIT_ACTIONS[action] || { label: action, color: 'bg-gray-100 text-gray-600' }
                const max  = Math.max(...Object.values(kpis.byAction), 1)
                return (
                  <div key={action} className="flex items-center gap-3">
                    <ActionBadge action={action} />
                    <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-teal-400 dark:bg-teal-500" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 dark:text-slate-300 w-8 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── FILTROS ──────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage() }}
              placeholder="Buscar en detalle, usuario, módulo, ID..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            />
          </div>
          <select value={moduleF} onChange={(e) => { setModuleF(e.target.value); resetPage() }}
            className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100">
            {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={actionF} onChange={(e) => { setActionF(e.target.value); resetPage() }}
            className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100">
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPage() }}
            className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"/>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPage() }}
            className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"/>
          {activeFilters.length > 0 && (
            <button
              onClick={() => { setSearch(''); setModuleF('Todos'); setActionF('Todas'); setDateFrom(''); setDateTo(''); resetPage() }}
              className="px-3 py-2 text-xs text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700">
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Chips de filtros activos */}
        {activeFilters.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {activeFilters.map((f, i) => (
              <FilterChip key={i} label={f.label} onRemove={f.clear} />
            ))}
          </div>
        )}
      </div>

      {/* ── TABLA ────────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="Sin registros de auditoría" message="Las operaciones del sistema aparecerán aquí automáticamente."/>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                {['Fecha / Hora', 'Usuario · Rol', 'Acción', 'Módulo', 'Detalle', 'Entidad'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 px-4 py-3 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {pageItems.map((entry) => {
                const isExpanded = expandedId === entry.id
                return (
                  <tr
                    key={entry.id}
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="hover:bg-blue-50/40 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                  >
                    {/* Fecha */}
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap align-top">
                      {formatDateTime(entry.timestamp)}
                    </td>

                    {/* Usuario + Rol */}
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm font-medium text-gray-800 dark:text-slate-100 leading-tight">
                        {entry.userName || 'Sistema'}
                      </div>
                      <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
                        {entry.userRole}
                      </span>
                    </td>

                    {/* Acción */}
                    <td className="px-4 py-3 align-top">
                      <ActionBadge action={entry.action} />
                    </td>

                    {/* Módulo */}
                    <td className="px-4 py-3 align-top">
                      <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                        {entry.module}
                      </span>
                    </td>

                    {/* Detalle — expandible */}
                    <td className="px-4 py-3 align-top max-w-xs">
                      <p className={`text-sm text-gray-600 dark:text-slate-300 ${isExpanded ? '' : 'line-clamp-1'}`}>
                        {entry.detail}
                      </p>
                      {isExpanded && entry.entityId && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 font-mono">
                          ID: {entry.entityId}
                        </p>
                      )}
                    </td>

                    {/* ID entidad (últimos 8 caracteres) */}
                    <td className="px-4 py-3 text-xs font-mono text-gray-400 dark:text-slate-500 align-top">
                      {entry.entityId ? entry.entityId.slice(-8) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* ── PAGINACIÓN ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800">
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length.toLocaleString()} registros
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:cursor-not-allowed">
                ← Anterior
              </button>
              {/* Números de página */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
                const p = start + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-7 text-xs rounded-lg border transition-colors ${
                      p === currentPage
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}>
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:cursor-not-allowed">
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR LIMPIAR LOG ────────────────────────────────────── */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-2xl max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xl">🗑</div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-slate-100">¿Limpiar el log de auditoría?</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">Se eliminarán {kpis.total.toLocaleString()} registros. Esta acción quedará registrada.</p>
              </div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300 mb-4">
              ⚠️ Solo realizar si el log está lleno o antes de una demo limpia. No se puede deshacer.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmClear(false)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                Cancelar
              </button>
              <button onClick={handleClearLog}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">
                Limpiar log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
