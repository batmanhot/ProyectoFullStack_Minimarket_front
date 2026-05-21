import { useState, useMemo, useEffect } from 'react'
import { useStore } from '../../store/index'
import { formatCurrency, formatDateTime } from '../../shared/utils/helpers'
import { useDebounce } from '../../shared/hooks/useDebounce'
import SaleTicket from '../pos/components/SaleTicket'
import CreditNoteModal from '../returns/components/CreditNoteModal'

const PAGE_SIZE = 20

function getMonthRange() {
  const now  = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  return { from, to }
}

// ─── Config de estados SUNAT ──────────────────────────────────────────────────
const SUNAT_STATUS = {
  pendiente:   { label: 'Pendiente',  cls: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-400' },
  enviado:     { label: 'Enviado',    cls: 'bg-blue-100   dark:bg-blue-900/30   text-blue-700   dark:text-blue-300',   dot: 'bg-blue-400'   },
  aceptado:    { label: 'Aceptado',   cls: 'bg-green-100  dark:bg-green-900/30  text-green-700  dark:text-green-300',  dot: 'bg-green-400'  },
  rechazado:   { label: 'Rechazado',  cls: 'bg-red-100    dark:bg-red-900/30    text-red-700    dark:text-red-300',    dot: 'bg-red-400'    },
  error_sunat: { label: 'Error',      cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300', dot: 'bg-orange-400' },
}

const TIPO_CPE = {
  ticket:  { label: 'Ticket',     cls: 'bg-gray-100   dark:bg-gray-700      text-gray-600   dark:text-gray-300'   },
  boleta:  { label: 'Boleta',     cls: 'bg-sky-100    dark:bg-sky-900/30    text-sky-700    dark:text-sky-300'    },
  factura: { label: 'Factura',    cls: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' },
  nc:      { label: 'Nota Cred.', cls: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' },
}

function StatusBadge({ status }) {
  const cfg = SUNAT_STATUS[status] || SUNAT_STATUS.pendiente
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>
      {cfg.label}
    </span>
  )
}

function TipoBadge({ tipo }) {
  const cfg = TIPO_CPE[tipo] || TIPO_CPE.boleta
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Paginación ───────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, total, pageSize, onPrev, onNext, onPage }) {
  if (totalPages <= 1) return (
    <p className="text-xs text-gray-400 dark:text-slate-500">
      {total} comprobante{total !== 1 ? 's' : ''}
    </p>
  )

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <p className="text-xs text-gray-400 dark:text-slate-500">
        Mostrando {from}–{to} de {total} comprobantes
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(1)} disabled={page === 1}
          className="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          «
        </button>
        <button onClick={onPrev} disabled={page === 1}
          className="px-3 py-1 text-xs rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          ‹ Ant.
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
          .reduce((acc, p, i, arr) => {
            if (i > 0 && p - arr[i - 1] > 1) acc.push('...')
            acc.push(p)
            return acc
          }, [])
          .map((p, i) =>
            p === '...'
              ? <span key={`e-${i}`} className="px-2 text-xs text-gray-400">…</span>
              : <button key={p} onClick={() => onPage(p)}
                  className={`w-8 py-1 text-xs rounded-lg border transition-colors ${
                    p === page
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}>
                  {p}
                </button>
          )
        }

        <button onClick={onNext} disabled={page === totalPages}
          className="px-3 py-1 text-xs rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          Sig. ›
        </button>
        <button onClick={() => onPage(totalPages)} disabled={page === totalPages}
          className="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          »
        </button>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Comprobantes() {
  const { sales, clients, returns: ncRecords = [], businessConfig } = useStore()

  const { from: defaultFrom, to: defaultTo } = getMonthRange()

  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [filterTipo,   setFilterTipo]   = useState('todos')
  const [dateFrom,     setDateFrom]     = useState(defaultFrom)
  const [dateTo,       setDateTo]       = useState(defaultTo)
  const [page,         setPage]         = useState(1)
  const [ticketSale,   setTicketSale]   = useState(null)
  const [selectedNC,   setSelectedNC]   = useState(null)

  const dq = useDebounce(search, 150)

  useEffect(() => { setPage(1) }, [filterStatus, filterTipo, dateFrom, dateTo, dq])

  // Normalizar NC para que tengan la misma forma que las ventas en la tabla
  const normalizedNCs = useMemo(() =>
    ncRecords.map(nc => ({
      ...nc,
      _isNC:        true,
      _refInvoice:  nc.invoiceNumber,  // boleta/factura de origen (preservar antes de overwrite)
      invoiceNumber: nc.ncNumber,
      total:         nc.totalRefund,
      tipoComprobante: 'nc',
    }))
  , [ncRecords])

  // Fusionar ventas completadas + NC en una sola lista
  const allComprobantes = useMemo(() => {
    const ventas = sales.filter(s => s.status === 'completada')
    return [...ventas, ...normalizedNCs]
  }, [sales, normalizedNCs])

  const comprobantes = useMemo(() => {
    let list = allComprobantes

    if (filterStatus !== 'todos') {
      list = list.filter(s => {
        if (s.tipoComprobante === 'ticket') return false
        if (s.tipoComprobante === 'nc' && s.sunatStatus === null) return false
        return (s.sunatStatus || 'pendiente') === filterStatus
      })
    }
    if (filterTipo !== 'todos') list = list.filter(s => (s.tipoComprobante || 'boleta') === filterTipo)
    if (dateFrom) list = list.filter(s => new Date(s.createdAt) >= new Date(dateFrom))
    if (dateTo)   list = list.filter(s => new Date(s.createdAt) <= new Date(dateTo + 'T23:59:59'))

    if (dq) {
      const q = dq.toLowerCase()
      list = list.filter(s =>
        s.invoiceNumber?.toLowerCase().includes(q) ||
        clients.find(c => c.id === s.clientId)?.name?.toLowerCase().includes(q)
      )
    }

    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [allComprobantes, clients, filterStatus, filterTipo, dateFrom, dateTo, dq])

  const totalPages  = Math.max(1, Math.ceil(comprobantes.length / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const pagedItems  = comprobantes.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // KPIs — sobre todos los registros (no solo el mes filtrado)
  const kpis = useMemo(() => {
    const base  = sales.filter(s => s.status === 'completada')
    // CPE que van a SUNAT: boletas, facturas y NC (excepto los ticket-origen)
    const sunat = [
      ...base.filter(s => s.tipoComprobante !== 'ticket'),
      ...normalizedNCs.filter(nc => nc.sunatStatus !== null),
    ]
    return {
      pendiente:    sunat.filter(s => (s.sunatStatus || 'pendiente') === 'pendiente').length,
      enviado:      sunat.filter(s => s.sunatStatus === 'enviado').length,
      aceptado:     sunat.filter(s => s.sunatStatus === 'aceptado').length,
      rechazado:    sunat.filter(s => s.sunatStatus === 'rechazado' || s.sunatStatus === 'error_sunat').length,
      totalTicket:  base.filter(s => s.tipoComprobante === 'ticket').length,
      totalBoleta:  base.filter(s => (s.tipoComprobante || 'boleta') === 'boleta').length,
      totalFactura: base.filter(s => s.tipoComprobante === 'factura').length,
      totalNC:      ncRecords.length,
    }
  }, [sales, normalizedNCs, ncRecords])

  const handleLimpiar = () => {
    setSearch('')
    setFilterStatus('todos')
    setFilterTipo('todos')
    setDateFrom(defaultFrom)
    setDateTo(defaultTo)
  }

  const hayFiltrosExtra = search || filterStatus !== 'todos' || filterTipo !== 'todos' ||
    dateFrom !== defaultFrom || dateTo !== defaultTo

  const inputCls = 'px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="p-6 space-y-5">

      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Comprobantes Electrónicos</h1>
        <p className="text-sm text-gray-400 dark:text-slate-500">
          Cola de envío a SUNAT · Boletas, Facturas y Notas de Crédito electrónicas
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'pendiente',  label: 'Pendientes', icon: '⏳', color: 'yellow' },
          { key: 'enviado',    label: 'Enviados',   icon: '📤', color: 'blue'   },
          { key: 'aceptado',   label: 'Aceptados',  icon: '✅', color: 'green'  },
          { key: 'rechazado',  label: 'Con error',  icon: '❌', color: 'red'    },
        ].map(({ key, label, icon, color }) => (
          <button key={key}
            onClick={() => setFilterStatus(filterStatus === key ? 'todos' : key)}
            className={`rounded-xl p-4 text-left transition-all border-2 ${
              filterStatus === key
                ? `border-${color}-400 bg-${color}-50 dark:bg-${color}-900/20`
                : 'border-transparent bg-white dark:bg-slate-800 hover:border-gray-200 dark:hover:border-slate-600'
            }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">{icon}</span>
              <StatusBadge status={key}/>
            </div>
            <p className={`text-2xl font-bold ${
              color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
              color === 'blue'   ? 'text-blue-600   dark:text-blue-400'   :
              color === 'green'  ? 'text-green-600  dark:text-green-400'  :
                                   'text-red-600    dark:text-red-400'
            }`}>{kpis[key]}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Chips: resumen por tipo + alerta pendientes */}
      <div className="flex gap-3 flex-wrap">
        {kpis.totalTicket > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 text-sm">
            <TipoBadge tipo="ticket"/>
            <span className="font-semibold text-gray-700 dark:text-slate-200">{kpis.totalTicket}</span>
            <span className="text-gray-400 dark:text-slate-500">tickets</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 text-sm">
          <TipoBadge tipo="boleta"/>
          <span className="font-semibold text-gray-700 dark:text-slate-200">{kpis.totalBoleta}</span>
          <span className="text-gray-400 dark:text-slate-500">boletas</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 text-sm">
          <TipoBadge tipo="factura"/>
          <span className="font-semibold text-gray-700 dark:text-slate-200">{kpis.totalFactura}</span>
          <span className="text-gray-400 dark:text-slate-500">facturas</span>
        </div>
        {kpis.totalNC > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 text-sm">
            <TipoBadge tipo="nc"/>
            <span className="font-semibold text-gray-700 dark:text-slate-200">{kpis.totalNC}</span>
            <span className="text-gray-400 dark:text-slate-500">notas de crédito</span>
          </div>
        )}
        {kpis.pendiente > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-700 dark:text-yellow-300">
            <span>⚠️</span>
            <span><strong>{kpis.pendiente}</strong> comprobante{kpis.pendiente !== 1 ? 's' : ''} pendiente{kpis.pendiente !== 1 ? 's' : ''} de envío a SUNAT</span>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por N° comprobante o cliente..."
          className={`flex-1 min-w-48 placeholder-gray-400 ${inputCls}`}
        />
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className={inputCls}>
          <option value="todos">Todos los tipos</option>
          <option value="ticket">Tickets</option>
          <option value="boleta">Boletas</option>
          <option value="factura">Facturas</option>
          <option value="nc">Notas de Crédito</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls}>
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="enviado">Enviados</option>
          <option value="aceptado">Aceptados</option>
          <option value="rechazado">Rechazados</option>
          <option value="error_sunat">Con error</option>
        </select>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap">Desde</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className={inputCls} title="Desde"/>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap">Hasta</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className={inputCls} title="Hasta"/>
        </div>
        {hayFiltrosExtra && (
          <button onClick={handleLimpiar}
            className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
            Limpiar
          </button>
        )}
      </div>

      {/* Aviso backend pendiente */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm">
        <span className="text-blue-500 mt-0.5 shrink-0">ℹ️</span>
        <p className="text-blue-700 dark:text-blue-300">
          <strong>Integración SUNAT pendiente de backend.</strong> La cola visual está lista.
          Cuando el servidor Django esté disponible, los estados se actualizarán automáticamente
          y el botón "Reintentar" se activará para los rechazados.
        </p>
      </div>

      {/* Tabla */}
      {comprobantes.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-12 text-center">
          <p className="text-4xl mb-3">🧾</p>
          <p className="text-gray-500 dark:text-slate-400 text-sm">No hay comprobantes con los filtros seleccionados</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60">
                  {['Comprobante', 'Ref. / Cliente', 'Total', 'Estado SUNAT', 'Fecha', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {pagedItems.map(row => {
                  const client       = clients.find(c => c.id === row.clientId)
                  const isTicket     = row.tipoComprobante === 'ticket'
                  const isNC         = row._isNC === true
                  const tipo         = row.tipoComprobante || 'boleta'
                  const status       = (isTicket || (isNC && row.sunatStatus === null))
                                        ? null
                                        : (row.sunatStatus || 'pendiente')
                  const canRetry     = status === 'rechazado' || status === 'error_sunat'

                  return (
                    <tr key={row.id} className={`hover:bg-gray-50/60 dark:hover:bg-slate-700/30 transition-colors ${
                      isNC ? 'bg-violet-50/20 dark:bg-violet-900/5' : ''
                    }`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <TipoBadge tipo={tipo}/>
                          <span className="text-sm font-mono font-medium text-gray-800 dark:text-slate-100 whitespace-nowrap">
                            {row.invoiceNumber}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isNC ? (
                          <div>
                            <p className="text-xs text-gray-400 dark:text-slate-500">
                              Ref: <span className="font-mono text-violet-600 dark:text-violet-400">{row._refInvoice || '—'}</span>
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[180px]">
                              {client?.name || row.clientName || 'Consumidor final'}
                            </p>
                          </div>
                        ) : client ? (
                          <div>
                            <p className="text-sm text-gray-800 dark:text-slate-100 truncate max-w-[180px]">{client.name}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">{client.documentType} {client.documentNumber}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-slate-500 italic">Sin cliente</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-sm font-semibold ${isNC ? 'text-violet-700 dark:text-violet-300' : 'text-gray-800 dark:text-slate-100'}`}>
                          {isNC ? '-' : ''}{formatCurrency(row.total)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {status === null
                          ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"/>No aplica
                            </span>
                          : <StatusBadge status={status}/>
                        }
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-500 dark:text-slate-400">
                          {formatDateTime(row.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isNC ? (
                            <button
                              onClick={() => setSelectedNC(row)}
                              className="text-xs px-2.5 py-1 rounded-lg border border-violet-200 dark:border-violet-700 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors whitespace-nowrap">
                              Ver NC
                            </button>
                          ) : (
                            <button
                              onClick={() => setTicketSale(row)}
                              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
                              Ver ticket
                            </button>
                          )}
                          <button
                            disabled={!canRetry}
                            title={canRetry ? 'Reintentar envío a SUNAT' : 'Solo disponible para comprobantes rechazados'}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap ${
                              canRetry
                                ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer'
                                : 'border-gray-100 dark:border-slate-700 text-gray-300 dark:text-slate-600 cursor-not-allowed'
                            }`}>
                            Reintentar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pie con paginación */}
          <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40">
            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={comprobantes.length}
              pageSize={PAGE_SIZE}
              onPrev={() => setPage(p => Math.max(1, p - 1))}
              onNext={() => setPage(p => Math.min(totalPages, p + 1))}
              onPage={setPage}
            />
          </div>
        </div>
      )}

      {/* Modal ticket de venta */}
      {ticketSale && (
        <SaleTicket sale={ticketSale} onClose={() => setTicketSale(null)}/>
      )}

      {/* Modal nota de crédito */}
      {selectedNC && (
        <CreditNoteModal
          creditNote={selectedNC}
          businessConfig={businessConfig}
          onClose={() => setSelectedNC(null)}
        />
      )}
    </div>
  )
}
