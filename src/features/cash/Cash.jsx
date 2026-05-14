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
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-gray-800 dark:text-slate-100">Apertura de caja</h2>
        <div><label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Monto inicial (S/) *</label><input type="number" step="0.50" {...register('openingAmount')} className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>{errors.openingAmount && <p className="text-xs text-red-500 mt-1">{errors.openingAmount.message}</p>}</div>
        <div><label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Notas</label><textarea {...register('notes')} rows={2} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/></div>
        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">Cancelar</button>
          <button onClick={handleSubmit(onSubmit)} disabled={loading} className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">{loading ? 'Aperturando...' : 'Aperturar caja'}</button>
        </div>
      </div>
    </div>
  )
}

function CloseForm({ session, sessionTotals, sessionSales, sessionDebtPayments, onBack }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({ resolver: zodResolver(closeCashSchema) })
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const counted        = parseFloat(watch('countedAmount') || 0)
  const cashTotal      = sessionTotals.byMethod?.efectivo || 0
  const debtCash       = (sessionDebtPayments || []).filter(p => p.method === 'efectivo').reduce((a, p) => a + (p.amount || 0), 0)
  const totalDebt      = (sessionDebtPayments || []).reduce((a, p) => a + (p.amount || 0), 0)
  const expected       = formatNumber(session.openingAmount + cashTotal + debtCash)
  const difference     = formatNumber(counted - expected)

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
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-gray-800 dark:text-slate-100">Cierre de caja — Arqueo</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3"><p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Monto inicial</p><p className="font-medium text-sm">{formatCurrency(session.openingAmount)}</p></div>
          <div className="bg-green-50 rounded-lg p-3"><p className="text-xs text-green-600 mb-1">Total ventas turno</p><p className="font-medium text-green-700 text-sm">{formatCurrency(sessionTotals.total)}</p><p className="text-xs text-green-500">{sessionSales.length} transacciones</p></div>
        </div>
        <div className="border border-gray-100 dark:border-slate-700 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-medium text-gray-600 dark:text-slate-300 mb-2">Desglose por método — valores de cierre</p>
          {PAYMENT_METHODS.map(m => {
            const v = sessionTotals.byMethod?.[m.value] || 0
            if (v === 0) return null
            return (
              <div key={m.value} className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-slate-300">{m.icon} {m.label}</span>
                <span className="font-medium text-gray-800 dark:text-slate-100">{formatCurrency(v)}</span>
              </div>
            )
          })}
          <div className="border-t border-gray-100 dark:border-slate-700 pt-2 mt-2 flex justify-between font-semibold text-sm"><span>TOTAL GENERAL</span><span>{formatCurrency(sessionTotals.total)}</span></div>
        </div>
        {totalDebt > 0 && (
          <div className="bg-amber-50 rounded-lg p-3 flex justify-between items-center text-sm">
            <div>
              <p className="text-xs text-amber-600 font-medium mb-0.5">Cobros de deuda en este turno</p>
              <p className="text-xs text-amber-500">{sessionDebtPayments.length} pago{sessionDebtPayments.length !== 1 ? 's' : ''} · {debtCash > 0 ? `S/${debtCash.toFixed(2)} en efectivo` : 'Sin efectivo'}</p>
            </div>
            <span className="font-bold text-amber-700">{formatCurrency(totalDebt)}</span>
          </div>
        )}
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-600 mb-1">Efectivo esperado en caja</p>
          <p className="text-lg font-semibold text-blue-700">{formatCurrency(expected)}</p>
          <p className="text-xs text-blue-400">
            Apertura ({formatCurrency(session.openingAmount)}) + ventas efectivo ({formatCurrency(cashTotal)})
            {debtCash > 0 ? ` + cobros deuda efectivo (${formatCurrency(debtCash)})` : ''}
          </p>
        </div>
        <div><label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Monto contado físicamente (S/) *</label><input type="number" step="0.50" {...register('countedAmount')} className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00"/>{errors.countedAmount && <p className="text-xs text-red-500 mt-1">{errors.countedAmount.message}</p>}</div>
        {counted > 0 && (
          <div className={`rounded-lg p-3 text-sm font-medium flex justify-between ${Math.abs(difference) < 0.01 ? 'bg-green-50 text-green-700' : difference > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-600'}`}>
            <span>{difference > 0 ? 'Sobrante' : difference < 0 ? 'Faltante' : '✓ Sin diferencia'}</span>
            {Math.abs(difference) >= 0.01 && <span>{difference >= 0 ? '+' : ''}{formatCurrency(difference)}</span>}
          </div>
        )}
        <div><label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Observaciones</label><textarea {...register('notes')} rows={2} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/></div>
        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">Cancelar</button>
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
        <div><p className="text-xs text-gray-400 dark:text-slate-500">Apertura</p><p className="text-gray-700">{formatDateTime(session.openedAt)}</p></div>
        <div><p className="text-xs text-gray-400 dark:text-slate-500">Cierre</p><p className="text-gray-700">{session.closedAt ? formatDateTime(session.closedAt) : '—'}</p></div>
        <div><p className="text-xs text-gray-400 dark:text-slate-500">Cajero</p><p className="font-medium text-gray-800 dark:text-slate-100">{session.userName || session.userId}</p></div>
        <div><p className="text-xs text-gray-400 dark:text-slate-500">N° transacciones</p><p className="text-gray-700">{session.salesCount || 0}</p></div>
      </div>
      <div className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wide mb-3">Desglose de cierre por método de pago</p>
        {PAYMENT_METHODS.map(m => {
          const v = byMethod[m.value] || 0
          return (
            <div key={m.value} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
              <span className="text-gray-600 dark:text-slate-300">{m.icon} {m.label}</span>
              <span className={`font-medium ${v > 0 ? 'text-gray-800' : 'text-gray-300'}`}>{formatCurrency(v)}</span>
            </div>
          )
        })}
        <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200 dark:border-slate-600 mt-2"><span>TOTAL VENTAS</span><span className="text-green-700">{formatCurrency(session.totalSales || 0)}</span></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3"><p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Monto inicial</p><p className="font-semibold text-sm">{formatCurrency(session.openingAmount || 0)}</p></div>
        <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-blue-500 mb-1">Contado físico</p><p className="font-semibold text-sm text-blue-700">{formatCurrency(session.closingAmount || 0)}</p></div>
        <div className={`rounded-lg p-3 ${(session.difference||0) === 0 ? 'bg-green-50' : (session.difference||0) > 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
          <p className={`text-xs mb-1 ${(session.difference||0) === 0 ? 'text-green-600' : (session.difference||0) > 0 ? 'text-blue-600' : 'text-red-500'}`}>Diferencia</p>
          <p className={`font-semibold text-sm ${(session.difference||0) === 0 ? 'text-green-700' : (session.difference||0) > 0 ? 'text-blue-700' : 'text-red-600'}`}>{(session.difference||0) >= 0 ? '+' : ''}{formatCurrency(session.difference || 0)}</p>
        </div>
      </div>
      {session.notes && <div className="text-sm text-gray-600 dark:text-slate-300"><p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Observaciones</p><p>{session.notes}</p></div>}
    </div>
  )
}

export default function Cash() {
  const { activeCashSession, cashSessions, sales, debtPayments, currentUser } = useStore()
  const [view, setView] = useState('main')
  const [detailSession, setDetailSession] = useState(null)

  const sessionSales = useMemo(() => {
    if (!activeCashSession) return []
    return sales.filter(s => s.status === 'completada' && new Date(s.createdAt) >= new Date(activeCashSession.openedAt))
  }, [activeCashSession, sales])

  const sessionDebtPayments = useMemo(() => {
    if (!activeCashSession) return []
    return (debtPayments || []).filter(p => new Date(p.createdAt) >= new Date(activeCashSession.openedAt))
  }, [activeCashSession, debtPayments])

  const sessionTotals = useMemo(() => {
    const total = formatNumber(sessionSales.reduce((a, s) => a + s.total, 0))
    const byMethod = {}
    sessionSales.forEach(s => { s.payments?.forEach(p => { byMethod[p.method] = formatNumber((byMethod[p.method] || 0) + p.amount) }) })
    return { total, byMethod }
  }, [sessionSales])

  if (view === 'open')  return <OpenForm currentUser={currentUser} onBack={() => setView('main')}/>
  if (view === 'close' && activeCashSession) return <CloseForm session={activeCashSession} sessionTotals={sessionTotals} sessionSales={sessionSales} sessionDebtPayments={sessionDebtPayments} onBack={() => setView('main')}/>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Control de Caja</h1>
          <p className="text-sm">{activeCashSession ? <span className="text-green-600 font-medium">● Caja abierta — {formatDateTime(activeCashSession.openedAt)}</span> : <span className="text-red-400">● Caja cerrada</span>}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('history')} className="px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">Historial</button>
          {!activeCashSession
            ? <button onClick={() => setView('open')}  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">Aperturar caja</button>
            : <button onClick={() => setView('close')} className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600">Cerrar caja</button>
          }
        </div>
      </div>

      {activeCashSession && view === 'main' && (
        <>
          {/* CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4"><p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Monto inicial</p><p className="text-xl font-medium">{formatCurrency(activeCashSession.openingAmount)}</p></div>
            <div className="bg-green-50 rounded-xl p-4"><p className="text-xs text-green-600 mb-1">Total ventas turno</p><p className="text-xl font-medium text-green-700">{formatCurrency(sessionTotals.total)}</p><p className="text-xs text-green-500">{sessionSales.length} transacciones</p></div>
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-blue-600 mb-1">Ventas en efectivo</p>
              <p className="text-xl font-medium text-blue-700">{formatCurrency(sessionTotals.byMethod?.efectivo || 0)}</p>
              <p className="text-xs text-blue-400">💵 Efectivo del turno</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-xs text-amber-600 mb-1">Cobros de deuda</p>
              <p className="text-xl font-medium text-amber-700">{formatCurrency(sessionDebtPayments.reduce((a, p) => a + (p.amount || 0), 0))}</p>
              <p className="text-xs text-amber-400">💰 {sessionDebtPayments.length} pago{sessionDebtPayments.length !== 1 ? 's' : ''} cobrado{sessionDebtPayments.length !== 1 ? 's' : ''}</p>
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
              {sessionTotals.byMethod?.transferencia > 0 && <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4"><p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Transferencia</p><p className="text-lg font-medium text-gray-700">{formatCurrency(sessionTotals.byMethod.transferencia)}</p></div>}
            </div>
          )}

          {/* Desglose por método */}
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Desglose por método de pago — turno actual</h3>
            <div className="space-y-2">
              {PAYMENT_METHODS.filter(m => (sessionTotals.byMethod?.[m.value] || 0) > 0).map(m => {
                const v = sessionTotals.byMethod?.[m.value] || 0
                const pct = sessionTotals.total > 0 ? (v / sessionTotals.total * 100).toFixed(0) : 0
                return (
                  <div key={m.value} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 w-28">{m.icon} {m.label}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden"><div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${pct}%` }}/></div>
                    <span className="text-sm font-medium text-gray-700 w-24 text-right">{formatCurrency(v)}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500 w-8 text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Últimas ventas del turno */}
          {sessionSales.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                <h3 className="text-sm font-medium text-gray-700 dark:text-slate-200">Ventas del turno</h3>
              </div>
              <table className="w-full">
                <thead><tr className="bg-gray-50 dark:bg-slate-800/50"><th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Boleta</th><th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Hora</th><th className="text-center text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Método</th><th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Total</th></tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {sessionSales.slice(0, 15).map(s => {
                    const m = PAYMENT_METHODS.find(pm => pm.value === s.payments?.[0]?.method)
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">
                        <td className="px-4 py-2 text-xs font-mono text-gray-600 dark:text-slate-300">{s.invoiceNumber}</td>
                        <td className="px-4 py-2 text-xs text-gray-500 dark:text-slate-400">{new Date(s.createdAt).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</td>
                        <td className="px-4 py-2 text-center text-xs text-gray-500 dark:text-slate-400">{m?.icon} {m?.label}</td>
                        <td className="px-4 py-2 text-sm font-medium text-right text-gray-800 dark:text-slate-100">{formatCurrency(s.total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Cobros de deuda del turno */}
          {sessionDebtPayments.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-900/40 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
                <h3 className="text-sm font-medium text-amber-700 dark:text-amber-400">💰 Cobros de deuda del turno</h3>
                <span className="text-xs text-amber-600 dark:text-amber-500 font-semibold">
                  {sessionDebtPayments.length} pago{sessionDebtPayments.length !== 1 ? 's' : ''} · {formatCurrency(sessionDebtPayments.reduce((a, p) => a + (p.amount || 0), 0))}
                </span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-amber-50 dark:bg-amber-900/10">
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">N° Recibo</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Cliente</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Hora</th>
                    <th className="text-center text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Método</th>
                    <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-2">Monto cobrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {sessionDebtPayments.map(p => {
                    const m = PAYMENT_METHODS.find(pm => pm.value === p.method)
                    return (
                      <tr key={p.id} className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10">
                        <td className="px-4 py-2.5 text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">{p.receiptNumber}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-slate-200 font-medium">{p.clientName}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400">{new Date(p.createdAt).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-500 dark:text-slate-400">{m?.icon} {m?.label}</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-right text-amber-700 dark:text-amber-400">{formatCurrency(p.amount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-amber-50 dark:bg-amber-900/20 border-t border-amber-100 dark:border-amber-900/40">
                    <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400">TOTAL COBRADO EN DEUDAS</td>
                    <td className="px-4 py-2 text-sm font-bold text-right text-amber-700 dark:text-amber-400">
                      {formatCurrency(sessionDebtPayments.reduce((a, p) => a + (p.amount || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {!activeCashSession && view === 'main' && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="text-6xl">🔐</div>
          <h2 className="text-xl font-medium text-gray-700">No hay caja abierta</h2>
          <p className="text-sm text-gray-400 dark:text-slate-500">Apertura la caja para comenzar a registrar ventas</p>
          <button onClick={() => setView('open')} className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Aperturar ahora</button>
        </div>
      )}

      {/* HISTORIAL con detalle de cierre — punto 8 */}
      {view === 'history' && (
        <div className="space-y-4">
          <button onClick={() => setView('main')} className="text-sm text-blue-600 hover:underline">← Volver</button>
          {cashSessions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">Sin cierres registrados</div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead><tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">{['Apertura','Cierre','Cajero','Inicial','Ventas','Cobranzas','Contado','Diferencia','Detalle'].map(h => <th key={h} className={`text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3 ${['Inicial','Ventas','Cobranzas','Contado','Diferencia'].includes(h)?'text-right':h==='Detalle'?'text-center':'text-left'}`}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {cashSessions.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-300">{formatDateTime(s.openedAt)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-300">{s.closedAt ? formatDateTime(s.closedAt) : '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-300">{s.userName || s.userId}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(s.openingAmount)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{formatCurrency(s.totalSales || 0)}</td>
                      <td className="px-4 py-3 text-sm text-right text-amber-600 font-medium">{formatCurrency(s.totalDebtCollected || 0)}</td>
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
              <div><h2 className="font-semibold text-gray-800 dark:text-slate-100">Detalle de cierre de caja</h2><p className="text-xs text-gray-400 dark:text-slate-500">{formatDateTime(detailSession.closedAt || detailSession.openedAt)}</p></div>
              <button onClick={() => setDetailSession(null)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-300"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="p-6"><SessionDetail session={detailSession} onClose={() => setDetailSession(null)}/></div>
          </div>
        </div>
      )}
    </div>
  )
}
