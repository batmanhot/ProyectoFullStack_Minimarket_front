import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { openCashSchema, closeCashSchema } from '../../shared/schemas/index'
import { cashService } from '../../services/index'
import { formatCurrency, formatDateTime, formatNumber } from '../../shared/utils/helpers'
import { PAYMENT_METHODS } from '../../config/app'
import ConfirmModal from '../../shared/components/ui/ConfirmModal'
import toast from 'react-hot-toast'

function OpenForm({ currentUser, onBack }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(openCashSchema), defaultValues: { openingAmount: 200 } })
  const [loading, setLoading] = useState(false)
  const onSubmit = async (data) => {
    setLoading(true)
    const result = await cashService.open({ ...data, userId: currentUser?.id, userName: currentUser?.fullName })
    setLoading(false)
    if (result.error) { toast.error(result.error); return }
    toast.success('Caja aperturada correctamente')
    onBack()
  }
  return (
    <div className="max-w-md mx-auto">
      <button onClick={onBack} className="text-sm text-blue-600 hover:underline mb-4">← Volver</button>
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Apertura de caja</h2>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Monto inicial (S/) *</label><input type="number" step="0.50" {...register('openingAmount')} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>{errors.openingAmount && <p className="text-xs text-red-500 mt-1">{errors.openingAmount.message}</p>}</div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Notas</label><textarea {...register('notes')} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/></div>
        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSubmit(onSubmit)} disabled={loading} className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">{loading ? 'Aperturando...' : 'Aperturar caja'}</button>
        </div>
      </div>
    </div>
  )
}

function CloseForm({ session, sessionTotals, sessionSales, onBack }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({ resolver: zodResolver(closeCashSchema) })
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const counted  = parseFloat(watch('countedAmount') || 0)
  const cashTotal  = sessionTotals.byMethod?.efectivo || 0
  const expected   = formatNumber(session.openingAmount + cashTotal)
  const difference = formatNumber(counted - expected)

  const doClose = async (data) => {
    setLoading(true)
    const result = await cashService.close(session.id, data)
    setLoading(false)
    if (result.error) { toast.error(result.error); return }
    toast.success('Caja cerrada correctamente')
    onBack()
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <button onClick={onBack} className="text-sm text-blue-600 hover:underline">← Volver</button>
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Cierre de caja — Arqueo</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500 mb-1">Monto inicial</p><p className="font-medium text-sm">{formatCurrency(session.openingAmount)}</p></div>
          <div className="bg-green-50 rounded-lg p-3"><p className="text-xs text-green-600 mb-1">Total ventas turno</p><p className="font-medium text-green-700 text-sm">{formatCurrency(sessionTotals.total)}</p><p className="text-xs text-green-500">{sessionSales.length} transacciones</p></div>
        </div>
        <div className="border border-gray-100 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-medium text-gray-600 mb-2">Desglose por método — valores de cierre</p>
          {PAYMENT_METHODS.map(m => {
            const v = sessionTotals.byMethod?.[m.value] || 0
            if (v === 0) return null
            return (
              <div key={m.value} className="flex justify-between items-center text-sm">
                <span className="text-gray-600">{m.icon} {m.label}</span>
                <span className="font-medium text-gray-800">{formatCurrency(v)}</span>
              </div>
            )
          })}
          <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between font-semibold text-sm"><span>TOTAL GENERAL</span><span>{formatCurrency(sessionTotals.total)}</span></div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-600 mb-1">Efectivo esperado en caja</p>
          <p className="text-lg font-semibold text-blue-700">{formatCurrency(expected)}</p>
          <p className="text-xs text-blue-400">Apertura ({formatCurrency(session.openingAmount)}) + ventas efectivo ({formatCurrency(cashTotal)})</p>
        </div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Monto contado físicamente (S/) *</label><input type="number" step="0.50" {...register('countedAmount')} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00"/>{errors.countedAmount && <p className="text-xs text-red-500 mt-1">{errors.countedAmount.message}</p>}</div>
        {counted > 0 && (
          <div className={`rounded-lg p-3 text-sm font-medium flex justify-between ${Math.abs(difference) < 0.01 ? 'bg-green-50 text-green-700' : difference > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-600'}`}>
            <span>{difference > 0 ? 'Sobrante' : difference < 0 ? 'Faltante' : '✓ Sin diferencia'}</span>
            {Math.abs(difference) >= 0.01 && <span>{difference >= 0 ? '+' : ''}{formatCurrency(difference)}</span>}
          </div>
        )}
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label><textarea {...register('notes')} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/></div>
        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSubmit(d => setConfirm(d))} disabled={loading} className="flex-1 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">Cerrar caja</button>
        </div>
      </div>
      {confirm && <ConfirmModal title="¿Confirmas el cierre de caja?" message="Esta acción no se puede deshacer. El turno quedará registrado." confirmLabel="Sí, cerrar caja" variant="danger" onConfirm={() => doClose(confirm)} onCancel={() => setConfirm(null)}/>}
    </div>
  )
}

// Vista detalle de un cierre histórico
function SessionDetail({ session, onClose }) {
  const byMethod = session.byMethod || {}
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-xs text-gray-400">Apertura</p><p className="text-gray-700">{formatDateTime(session.openedAt)}</p></div>
        <div><p className="text-xs text-gray-400">Cierre</p><p className="text-gray-700">{session.closedAt ? formatDateTime(session.closedAt) : '—'}</p></div>
        <div><p className="text-xs text-gray-400">Cajero</p><p className="font-medium text-gray-800">{session.userName || session.userId}</p></div>
        <div><p className="text-xs text-gray-400">N° transacciones</p><p className="text-gray-700">{session.salesCount || 0}</p></div>
      </div>
      <div className="border border-gray-100 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Desglose de cierre por método de pago</p>
        {PAYMENT_METHODS.map(m => {
          const v = byMethod[m.value] || 0
          return (
            <div key={m.value} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
              <span className="text-gray-600">{m.icon} {m.label}</span>
              <span className={`font-medium ${v > 0 ? 'text-gray-800' : 'text-gray-300'}`}>{formatCurrency(v)}</span>
            </div>
          )
        })}
        <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200 mt-2"><span>TOTAL VENTAS</span><span className="text-green-700">{formatCurrency(session.totalSales || 0)}</span></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400 mb-1">Monto inicial</p><p className="font-semibold text-sm">{formatCurrency(session.openingAmount || 0)}</p></div>
        <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-blue-500 mb-1">Contado físico</p><p className="font-semibold text-sm text-blue-700">{formatCurrency(session.closingAmount || 0)}</p></div>
        <div className={`rounded-lg p-3 ${(session.difference||0) === 0 ? 'bg-green-50' : (session.difference||0) > 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
          <p className={`text-xs mb-1 ${(session.difference||0) === 0 ? 'text-green-600' : (session.difference||0) > 0 ? 'text-blue-600' : 'text-red-500'}`}>Diferencia</p>
          <p className={`font-semibold text-sm ${(session.difference||0) === 0 ? 'text-green-700' : (session.difference||0) > 0 ? 'text-blue-700' : 'text-red-600'}`}>{(session.difference||0) >= 0 ? '+' : ''}{formatCurrency(session.difference || 0)}</p>
        </div>
      </div>
      {session.notes && <div className="text-sm text-gray-600"><p className="text-xs text-gray-400 mb-1">Observaciones</p><p>{session.notes}</p></div>}
    </div>
  )
}

export default function Cash() {
  const { activeCashSession, cashSessions, sales, currentUser } = useStore()
  const [view, setView] = useState('main')
  const [detailSession, setDetailSession] = useState(null)

  const sessionSales = useMemo(() => {
    if (!activeCashSession) return []
    return sales.filter(s => s.status === 'completada' && new Date(s.createdAt) >= new Date(activeCashSession.openedAt))
  }, [activeCashSession, sales])

  const sessionTotals = useMemo(() => {
    const total = formatNumber(sessionSales.reduce((a, s) => a + s.total, 0))
    const byMethod = {}
    sessionSales.forEach(s => { s.payments?.forEach(p => { byMethod[p.method] = formatNumber((byMethod[p.method] || 0) + p.amount) }) })
    return { total, byMethod }
  }, [sessionSales])

  if (view === 'open')  return <OpenForm currentUser={currentUser} onBack={() => setView('main')}/>
  if (view === 'close' && activeCashSession) return <CloseForm session={activeCashSession} sessionTotals={sessionTotals} sessionSales={sessionSales} onBack={() => setView('main')}/>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800">Control de Caja</h1>
          <p className="text-sm">{activeCashSession ? <span className="text-green-600 font-medium">● Caja abierta — {formatDateTime(activeCashSession.openedAt)}</span> : <span className="text-red-400">● Caja cerrada</span>}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('history')} className="px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Historial</button>
          {!activeCashSession
            ? <button onClick={() => setView('open')}  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">Aperturar caja</button>
            : <button onClick={() => setView('close')} className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600">Cerrar caja</button>
          }
        </div>
      </div>

      {activeCashSession && view === 'main' && (
        <>
          {/* CARDS — punto 7: añadir efectivo y tarjeta además del ticket promedio */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-gray-50 rounded-xl p-4"><p className="text-xs text-gray-500 mb-1">Monto inicial</p><p className="text-xl font-medium">{formatCurrency(activeCashSession.openingAmount)}</p></div>
            <div className="bg-green-50 rounded-xl p-4"><p className="text-xs text-green-600 mb-1">Total ventas turno</p><p className="text-xl font-medium text-green-700">{formatCurrency(sessionTotals.total)}</p><p className="text-xs text-green-500">{sessionSales.length} transacciones</p></div>
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-blue-600 mb-1">Ventas en efectivo</p>
              <p className="text-xl font-medium text-blue-700">{formatCurrency(sessionTotals.byMethod?.efectivo || 0)}</p>
              <p className="text-xs text-blue-400">💵 Efectivo del turno</p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-4">
              <p className="text-xs text-indigo-600 mb-1">Ventas con tarjeta</p>
              <p className="text-xl font-medium text-indigo-700">{formatCurrency(sessionTotals.byMethod?.tarjeta || 0)}</p>
              <p className="text-xs text-indigo-400">💳 Tarjeta del turno</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <p className="text-xs text-purple-600 mb-1">Ticket promedio</p>
              <p className="text-xl font-medium text-purple-700">{sessionSales.length > 0 ? formatCurrency(sessionTotals.total / sessionSales.length) : 'S/ 0.00'}</p>
              <p className="text-xs text-purple-400">Total ÷ N° ventas</p>
            </div>
          </div>

          {/* Yape/Plin cards si tienen movimiento */}
          {(sessionTotals.byMethod?.yape > 0 || sessionTotals.byMethod?.plin > 0) && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {sessionTotals.byMethod?.yape > 0 && <div className="bg-purple-50 rounded-xl p-4"><p className="text-xs text-purple-600 mb-1">Ventas Yape</p><p className="text-lg font-medium text-purple-700">{formatCurrency(sessionTotals.byMethod.yape)}</p></div>}
              {sessionTotals.byMethod?.plin > 0 && <div className="bg-blue-50 rounded-xl p-4"><p className="text-xs text-blue-600 mb-1">Ventas Plin</p><p className="text-lg font-medium text-blue-700">{formatCurrency(sessionTotals.byMethod.plin)}</p></div>}
              {sessionTotals.byMethod?.qr > 0 && <div className="bg-teal-50 rounded-xl p-4"><p className="text-xs text-teal-600 mb-1">QR / BIM</p><p className="text-lg font-medium text-teal-700">{formatCurrency(sessionTotals.byMethod.qr)}</p></div>}
              {sessionTotals.byMethod?.transferencia > 0 && <div className="bg-gray-50 rounded-xl p-4"><p className="text-xs text-gray-500 mb-1">Transferencia</p><p className="text-lg font-medium text-gray-700">{formatCurrency(sessionTotals.byMethod.transferencia)}</p></div>}
            </div>
          )}

          {/* Desglose por método */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Desglose por método de pago — turno actual</h3>
            <div className="space-y-2">
              {PAYMENT_METHODS.filter(m => (sessionTotals.byMethod?.[m.value] || 0) > 0).map(m => {
                const v = sessionTotals.byMethod?.[m.value] || 0
                const pct = sessionTotals.total > 0 ? (v / sessionTotals.total * 100).toFixed(0) : 0
                return (
                  <div key={m.value} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs font-medium text-gray-600 w-28">{m.icon} {m.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden"><div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${pct}%` }}/></div>
                    <span className="text-sm font-medium text-gray-700 w-24 text-right">{formatCurrency(v)}</span>
                    <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Últimas ventas del turno */}
          {sessionSales.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-medium text-gray-700">Ventas del turno</h3></div>
              <table className="w-full">
                <thead><tr className="bg-gray-50"><th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Boleta</th><th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Hora</th><th className="text-center text-xs font-medium text-gray-500 px-4 py-2">Método</th><th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Total</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {sessionSales.slice(0, 15).map(s => {
                    const m = PAYMENT_METHODS.find(pm => pm.value === s.payments?.[0]?.method)
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-xs font-mono text-gray-600">{s.invoiceNumber}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{new Date(s.createdAt).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</td>
                        <td className="px-4 py-2 text-center text-xs text-gray-500">{m?.icon} {m?.label}</td>
                        <td className="px-4 py-2 text-sm font-medium text-right text-gray-800">{formatCurrency(s.total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!activeCashSession && view === 'main' && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="text-6xl">🔐</div>
          <h2 className="text-xl font-medium text-gray-700">No hay caja abierta</h2>
          <p className="text-sm text-gray-400">Apertura la caja para comenzar a registrar ventas</p>
          <button onClick={() => setView('open')} className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Aperturar ahora</button>
        </div>
      )}

      {/* HISTORIAL con detalle de cierre — punto 8 */}
      {view === 'history' && (
        <div className="space-y-4">
          <button onClick={() => setView('main')} className="text-sm text-blue-600 hover:underline">← Volver</button>
          {cashSessions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Sin cierres registrados</div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead><tr className="bg-gray-50 border-b border-gray-100">{['Apertura','Cierre','Cajero','Inicial','Ventas','Contado','Diferencia','Detalle'].map(h => <th key={h} className={`text-xs font-medium text-gray-500 px-4 py-3 ${['Inicial','Ventas','Contado','Diferencia'].includes(h)?'text-right':h==='Detalle'?'text-center':'text-left'}`}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {cashSessions.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-600">{formatDateTime(s.openedAt)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{s.closedAt ? formatDateTime(s.closedAt) : '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{s.userName || s.userId}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(s.openingAmount)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{formatCurrency(s.totalSales || 0)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(s.closingAmount || 0)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        <span className={`${(s.difference||0)===0?'text-green-600':(s.difference||0)>0?'text-blue-600':'text-red-500'}`}>{(s.difference||0)>=0?'+':''}{formatCurrency(s.difference||0)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setDetailSession(s)} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">Ver detalle</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal detalle cierre */}
      {detailSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div><h2 className="font-semibold text-gray-800">Detalle de cierre de caja</h2><p className="text-xs text-gray-400">{formatDateTime(detailSession.closedAt || detailSession.openedAt)}</p></div>
              <button onClick={() => setDetailSession(null)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="p-6"><SessionDetail session={detailSession} onClose={() => setDetailSession(null)}/></div>
          </div>
        </div>
      )}
    </div>
  )
}
