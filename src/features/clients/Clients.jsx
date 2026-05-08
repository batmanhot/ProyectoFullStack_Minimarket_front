import { useState, useMemo } from 'react'
import { useStore } from '../../store/index'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clientSchema } from '../../shared/schemas/index'
import { clientService } from '../../services/index'
import { formatCurrency, formatDate, formatDateTime } from '../../shared/utils/helpers'
import { exportToExcel, exportToPDF } from '../../shared/utils/export'
import { useDebounce } from '../../shared/hooks/useDebounce'
import Modal from '../../shared/components/ui/Modal'
import { EmptyState } from '../../shared/components/ui/Skeleton'
import { PAYMENT_METHODS } from '../../config/app'
import toast from 'react-hot-toast'

function ClientForm({ client, onClose }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(clientSchema), defaultValues: client || { documentType: 'DNI', creditLimit: 0 } })
  const onSubmit = async (data) => {
    const result = client ? await clientService.update(client.id, data) : await clientService.create(data)
    if (result.error) { toast.error(result.error); return }
    toast.success(client ? 'Cliente actualizado' : 'Cliente registrado')
    onClose()
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Nombre / Razón social *</label><input {...register('name')} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>{errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}</div>
        <div><label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Tipo documento</label><select {...register('documentType')} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">{['DNI','RUC','CE','Pasaporte'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        <div><label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Número *</label><input {...register('documentNumber')} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>{errors.documentNumber && <p className="text-xs text-red-500 mt-1">{errors.documentNumber.message}</p>}</div>
        <div><label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Teléfono</label><input {...register('phone')} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
        <div><label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Email</label><input {...register('email')} type="email" className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>{errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}</div>
        <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Dirección</label><input {...register('address')} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
        <div><label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Límite de crédito (S/)</label><input type="number" step="50" {...register('creditLimit')} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">Cancelar</button>
        <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{client ? 'Guardar' : 'Registrar cliente'}</button>
      </div>
    </form>
  )
}

// ── PAGO DE DEUDA — punto 12 ───────────────────────────────────────────────────
function DebtPaymentForm({ client, onClose }) {
  const { updateClient, addDebtPayment, businessConfig, getNextInvoice, addAuditLog } = useStore()
  const [amount, setAmount]     = useState('')
  const [method, setMethod]     = useState('efectivo')
  const [reference, setRef]     = useState('')
  const [notes, setNotes]       = useState('')
  const [showTicket, setShowTicket] = useState(false)
  const [receipt, setReceipt]   = useState(null)

  const creditMethods = PAYMENT_METHODS.filter(m => m.value !== 'credito')
  const methodConfig  = creditMethods.find(m => m.value === method)
  const deuda         = client.currentDebt || 0
  const parsedAmount  = parseFloat(amount) || 0

  const handleConfirm = () => {
    if (parsedAmount <= 0)     { toast.error('Ingresa el monto a pagar'); return }
    if (parsedAmount > deuda)  { toast.error(`El monto supera la deuda (${formatCurrency(deuda)})`); return }
    if (methodConfig?.requiresRef && !reference.trim()) { toast.error(`Ingresa el ${methodConfig.refLabel}`); return }

    const receiptNumber = getNextInvoice()
    const newDebt       = parseFloat((deuda - parsedAmount).toFixed(2))

    const payment = {
      id:            crypto.randomUUID(),
      receiptNumber,
      clientId:      client.id,
      clientName:    client.name,
      amount:        parsedAmount,
      previousDebt:  deuda,
      newDebt,
      method,
      reference,
      notes,
      createdAt:     new Date().toISOString(),
    }

    addDebtPayment(payment)
    updateClient(client.id, { currentDebt: newDebt })
    addAuditLog({ action: 'UPDATE', module: 'Cobranza', detail: `Pago deuda: ${client.name} · S/${parsedAmount} · Deuda restante: S/${newDebt}`, entityId: client.id })

    setReceipt(payment)
    setShowTicket(true)
    toast.success(`Pago registrado · Deuda restante: ${formatCurrency(newDebt)}`)
  }

  if (showTicket && receipt) {
    const handlePrint = () => {
      const now = new Date().toLocaleString('es-PE')
      const m   = PAYMENT_METHODS.find(pm => pm.value === receipt.method)
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recibo ${receipt.receiptNumber}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:11px;width:80mm;padding:4mm}
.center{text-align:center}.bold{font-weight:bold}.divider{border-top:1px dashed #000;margin:3mm 0}.row{display:flex;justify-content:space-between;margin:1.5mm 0}
@media print{@page{size:80mm auto;margin:0}}</style></head><body>
<div class="center bold" style="font-size:14px;margin-bottom:2mm">${businessConfig?.name || 'Mi Negocio'}</div>
${businessConfig?.ruc ? `<div class="center">RUC: ${businessConfig.ruc}</div>` : ''}
<div class="divider"></div>
<div class="center bold">RECIBO DE PAGO DE DEUDA</div>
<div class="center" style="font-size:10px">${receipt.receiptNumber}</div>
<div class="divider"></div>
<div class="row"><span>Fecha:</span><span>${now}</span></div>
<div class="row"><span>Cliente:</span><span>${receipt.clientName}</span></div>
<div class="divider"></div>
<div class="row"><span>Deuda anterior:</span><span>${formatCurrency(receipt.previousDebt)}</span></div>
<div class="row bold"><span>PAGO RECIBIDO:</span><span>${formatCurrency(receipt.amount)}</span></div>
<div class="row"><span>Método:</span><span>${m?.icon || ''} ${m?.label || receipt.method}</span></div>
${receipt.reference ? `<div class="row"><span>Referencia:</span><span>${receipt.reference}</span></div>` : ''}
<div class="divider"></div>
<div class="row bold"><span>DEUDA RESTANTE:</span><span>${formatCurrency(receipt.newDebt)}</span></div>
${receipt.newDebt === 0 ? '<div class="center bold" style="margin-top:2mm">✓ DEUDA SALDADA COMPLETAMENTE</div>' : ''}
<div class="divider"></div>
<div class="center" style="font-size:10px">Comprobante de pago · Consérvelo</div>
<script>window.onload=()=>{window.print();}<\/script></body></html>`
      const win = window.open('','_blank','width=320,height=600')
      win.document.write(html)
      win.document.close()
    }

    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
          <div className="text-3xl mb-2">✅</div>
          <p className="font-semibold text-green-700">Pago registrado correctamente</p>
          <p className="text-sm text-green-600 mt-1">Recibo: {receipt.receiptNumber}</p>
        </div>
        <div className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500 dark:text-slate-400">Cliente</span><span className="font-medium">{receipt.clientName}</span></div>
          <div className="flex justify-between"><span className="text-gray-500 dark:text-slate-400">Monto pagado</span><span className="font-semibold text-green-600">{formatCurrency(receipt.amount)}</span></div>
          <div className="flex justify-between border-t border-gray-100 dark:border-slate-700 pt-2"><span className="text-gray-500 dark:text-slate-400">Deuda anterior</span><span>{formatCurrency(receipt.previousDebt)}</span></div>
          <div className="flex justify-between font-semibold text-base"><span>Deuda restante</span><span className={receipt.newDebt === 0 ? 'text-green-600' : 'text-red-500'}>{formatCurrency(receipt.newDebt)}</span></div>
          {receipt.newDebt === 0 && <p className="text-center text-green-600 text-xs font-medium">✓ Deuda saldada completamente</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">🖨️ Imprimir recibo</button>
          <button onClick={onClose}    className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">Cerrar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-100 rounded-xl p-4">
        <p className="text-xs text-red-600 mb-1">Deuda actual del cliente</p>
        <p className="text-2xl font-bold text-red-600">{formatCurrency(deuda)}</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Monto a pagar (S/) *</label>
        <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-slate-500">S/</span>
        <input type="number" min="0.01" step="0.01" max={deuda} value={amount} onChange={e => setAmount(e.target.value)} className="w-full pl-8 pr-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={deuda.toFixed(2)}/></div>
        <div className="flex gap-2 mt-2">
          <button onClick={() => setAmount(deuda.toFixed(2))} className="text-xs px-3 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">Pagar total ({formatCurrency(deuda)})</button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-2">Método de pago</label>
        <div className="grid grid-cols-4 gap-2">
          {creditMethods.slice(0,4).map(m => (
            <button key={m.value} onClick={() => setMethod(m.value)} className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-all ${method===m.value?'border-blue-500 bg-blue-50 text-blue-700':'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-gray-300'}`}>
              <span className="text-base">{m.icon}</span>{m.label}
            </button>
          ))}
        </div>
      </div>
      {methodConfig?.requiresRef && (
        <div><label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">{methodConfig.refLabel}</label><input value={reference} onChange={e => setRef(e.target.value)} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
      )}
      {parsedAmount > 0 && parsedAmount <= deuda && (
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3 text-sm flex justify-between">
          <span className="text-gray-500 dark:text-slate-400">Deuda restante después del pago</span>
          <span className="font-semibold text-gray-800 dark:text-slate-100">{formatCurrency(deuda - parsedAmount)}</span>
        </div>
      )}
      <div><label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Observaciones</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/></div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">Cancelar</button>
        <button onClick={handleConfirm} disabled={parsedAmount <= 0 || parsedAmount > deuda} className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40">Registrar pago y generar recibo</button>
      </div>
    </div>
  )
}

function ClientDetail({ client, sales, onClose }) {
  const clientSales = useMemo(() => sales.filter(s => s.clientId === client.id && s.status === 'completada').sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)), [sales, client.id])
  const totalComprado   = clientSales.reduce((a,s) => a+s.total, 0)
  const creditAvailable = (client.creditLimit||0) - (client.currentDebt||0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3"><p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Total comprado</p><p className="text-lg font-semibold text-gray-800 dark:text-slate-100">{formatCurrency(totalComprado)}</p></div>
        <div className="bg-blue-50 rounded-xl p-3"><p className="text-xs text-blue-600 mb-1">N° compras</p><p className="text-lg font-semibold text-blue-700">{clientSales.length}</p></div>
        <div className={`rounded-xl p-3 ${client.currentDebt>0?'bg-red-50':'bg-green-50'}`}>
          <p className={`text-xs mb-1 ${client.currentDebt>0?'text-red-600':'text-green-600'}`}>Deuda actual</p>
          <p className={`text-lg font-semibold ${client.currentDebt>0?'text-red-700':'text-green-700'}`}>{formatCurrency(client.currentDebt||0)}</p>
          {client.creditLimit>0 && <p className="text-xs text-gray-500 dark:text-slate-400">Límite: {formatCurrency(client.creditLimit)} · Disp: {formatCurrency(creditAvailable)}</p>}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Historial de compras</h3>
        {clientSales.length===0 ? <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">Sin compras registradas</p> : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {clientSales.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                <div><span className="font-mono text-xs text-gray-500 dark:text-slate-400">{s.invoiceNumber}</span><span className="text-gray-400 dark:text-slate-500 text-xs ml-2">{formatDate(s.createdAt)}</span></div>
                <span className="font-medium text-gray-800 dark:text-slate-100">{formatCurrency(s.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Clients() {
  const { clients, sales, debtPayments, businessConfig, addAuditLog } = useStore()
  const [search, setSearch]   = useState('')
  const [modal, setModal]     = useState(null)
  const [activeTab, setActiveTab] = useState('clientes')
  const dq = useDebounce(search, 150)

  const debtTotal = clients.filter(c => c.isActive && c.currentDebt>0).reduce((a,c) => a+(c.currentDebt||0), 0)
  const debtCount = clients.filter(c => c.isActive && c.currentDebt>0).length

  const filtered = useMemo(() => {
    let list = clients.filter(c => c.isActive)
    if (dq) { const q=dq.toLowerCase(); list=list.filter(c => c.name.toLowerCase().includes(q)||c.documentNumber.includes(q)||c.phone?.includes(q)) }
    return list
  }, [clients, dq])

  // Cuentas por cobrar con antigüedad de saldo
  const cxcList = useMemo(() => {
    return clients
      .filter(c => c.isActive && (c.currentDebt||0) > 0)
      .map(c => {
        // Buscar la venta a crédito más antigua sin cobrar completamente
        const creditSales = sales
          .filter(s => s.clientId === c.id && s.status === 'completada' &&
            s.payments?.some(p => p.method === 'credito'))
          .sort((a,b) => new Date(a.createdAt)-new Date(b.createdAt))

        const oldestSale  = creditSales[0]
        const diasVencido = oldestSale
          ? Math.floor((Date.now() - new Date(oldestSale.createdAt)) / (1000*60*60*24))
          : 0

        // Historial de pagos del cliente
        const pagos = (debtPayments||[])
          .filter(p => p.clientId === c.id)
          .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))

        const ultimoPago = pagos[0]

        return {
          ...c,
          diasVencido,
          oldestSale,
          ultimoPago,
          totalPagado: pagos.reduce((a,p) => a+(p.amount||0), 0),
          // Categoría de antigüedad
          categoria: diasVencido <= 30 ? 'corriente' : diasVencido <= 60 ? 'vencida30' : diasVencido <= 90 ? 'vencida60' : 'vencida90',
        }
      })
      .sort((a,b) => b.currentDebt - a.currentDebt)
  }, [clients, sales, debtPayments])

  const cxcStats = useMemo(() => ({
    corriente:  cxcList.filter(c => c.categoria === 'corriente').reduce((a,c) => a+(c.currentDebt||0), 0),
    vencida30:  cxcList.filter(c => c.categoria === 'vencida30').reduce((a,c) => a+(c.currentDebt||0), 0),
    vencida60:  cxcList.filter(c => c.categoria === 'vencida60').reduce((a,c) => a+(c.currentDebt||0), 0),
    vencida90:  cxcList.filter(c => c.categoria === 'vencida90').reduce((a,c) => a+(c.currentDebt||0), 0),
  }), [cxcList])

  const handleExportExcel = () => {
    addAuditLog({ action: 'EXPORT', module: 'Clientes', detail: `Excel: ${filtered.length} registros` })
    exportToExcel(filtered.map(c => ({ Nombre: c.name, Tipo: c.documentType, Documento: c.documentNumber, Teléfono: c.phone||'', Email: c.email||'', Crédito: c.creditLimit||0, Deuda: c.currentDebt||0 })), 'clientes')
  }
  const handleExportPDF = () => {
    addAuditLog({ action: 'EXPORT', module: 'Clientes', detail: `PDF: ${filtered.length} registros` })
    exportToPDF('Listado de Clientes', ['Nombre','Documento','Teléfono','Límite Crédito','Deuda Actual'],
      filtered.map(c => [c.name, `${c.documentType} ${c.documentNumber}`, c.phone||'—', formatCurrency(c.creditLimit||0), formatCurrency(c.currentDebt||0)]), businessConfig?.name)
  }

  const AGING_COLORS = {
    corriente: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    vencida30:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    vencida60:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    vencida90:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Clientes</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">
            {filtered.length} registros
            {debtTotal>0 && <span className="ml-2 text-red-400">· Por cobrar: {formatCurrency(debtTotal)} ({debtCount} clientes)</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExportExcel} className="px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">📊 Excel</button>
          <button onClick={handleExportPDF}   className="px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">📄 PDF</button>
          <button onClick={() => setModal({ type: 'form', data: null })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>Nuevo cliente
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1 w-fit">
        {[
          { key: 'clientes', label: '👥 Clientes' },
          { key: 'cxc',      label: `📒 Cuentas por cobrar${debtCount > 0 ? ` (${debtCount})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab === t.key ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400'
            }`}>{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: CLIENTES ── */}
      {activeTab === 'clientes' && (
        <>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, documento o teléfono..." className="w-full max-w-md px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>

          {filtered.length === 0 ? (
            <EmptyState icon="👥" title="No hay clientes" message="Registra tu primer cliente." action={{ label: 'Nuevo cliente', onClick: () => setModal({ type: 'form', data: null }) }}/>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
              <table className="w-full">
                <thead><tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">{['Cliente','Documento','Contacto','Puntos','Crédito disp.','Deuda','Acciones'].map(h => <th key={h} className={`text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3 ${['Crédito disp.','Deuda','Puntos'].includes(h)?'text-right':h==='Acciones'?'text-center':'text-left'}`}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {filtered.map(c => {
                    const cnt   = sales.filter(s => s.clientId===c.id && s.status==='completada').length
                    const avail = (c.creditLimit||0)-(c.currentDebt||0)
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">
                        <td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-semibold text-blue-600">{c.name[0]}</div><div><div className="text-sm font-medium text-gray-800 dark:text-slate-100">{c.name}</div><div className="text-xs text-gray-400 dark:text-slate-500">{cnt} compras · {c.loyaltyLevel||'Bronce'}</div></div></div></td>
                        <td className="px-4 py-3"><span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{c.documentType}</span><span className="text-xs text-gray-600 dark:text-slate-300 ml-1">{c.documentNumber}</span></td>
                        <td className="px-4 py-3"><div className="text-xs text-gray-600 dark:text-slate-300">{c.phone||'—'}</div><div className="text-xs text-gray-400 dark:text-slate-500">{c.email||''}</div></td>
                        <td className="px-4 py-3 text-right text-xs font-medium text-amber-600 dark:text-amber-400">{(c.loyaltyPoints||0).toLocaleString()} pts</td>
                        <td className="px-4 py-3 text-right">{c.creditLimit>0 ? <span className={`text-sm font-medium ${avail>0?'text-green-600':'text-red-500'}`}>{formatCurrency(avail)}</span> : <span className="text-xs text-gray-400 dark:text-slate-500">—</span>}</td>
                        <td className="px-4 py-3 text-right"><span className={`text-sm font-medium ${(c.currentDebt||0)>0?'text-red-500':'text-green-600'}`}>{formatCurrency(c.currentDebt||0)}</span></td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setModal({ type: 'detail', data: c })} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Ver historial"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>
                            <button onClick={() => setModal({ type: 'form', data: c })} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Editar"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                            {(c.currentDebt||0) > 0 && (
                              <button onClick={() => setModal({ type: 'debt', data: c })} className="p-1.5 text-red-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Registrar pago de deuda"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── TAB: CUENTAS POR COBRAR ── */}
      {activeTab === 'cxc' && (
        <div className="space-y-5">
          {/* Antigüedad de saldo — KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: '✅ Corriente (0-30d)', value: cxcStats.corriente, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
              { label: '⚠️ Vencida 31-60d',   value: cxcStats.vencida30,  color: 'text-amber-700 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
              { label: '🔴 Vencida 61-90d',   value: cxcStats.vencida60,  color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
              { label: '❌ Vencida +90d',      value: cxcStats.vencida90,  color: 'text-red-700 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
            ].map(k => (
              <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{k.label}</p>
                <p className={`text-xl font-bold ${k.color}`}>{formatCurrency(k.value)}</p>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl">
            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Total cuentas por cobrar</span>
            <span className="text-2xl font-black text-red-600 dark:text-red-400">{formatCurrency(debtTotal)}</span>
          </div>

          {/* Lista con antigüedad */}
          {cxcList.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-gray-500 dark:text-slate-400 font-medium">No hay cuentas por cobrar pendientes</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700/50">
                    {['Cliente','Deuda actual','Antigüedad','Último pago','Total pagado','Acciones'].map(h => (
                      <th key={h} className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-2.5 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {cxcList.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{c.name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{c.documentType} {c.documentNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(c.currentDebt)}</span>
                        {c.creditLimit > 0 && (
                          <p className="text-xs text-gray-400 dark:text-slate-500">Límite: {formatCurrency(c.creditLimit)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${AGING_COLORS[c.categoria]}`}>
                          {c.diasVencido === 0 ? 'Sin datos' : `${c.diasVencido} días`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                        {c.ultimoPago
                          ? <>{formatCurrency(c.ultimoPago.amount)}<br/>{formatDate(c.ultimoPago.createdAt)}</>
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300">
                        {formatCurrency(c.totalPagado)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setModal({ type: 'debt', data: c })}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors">
                          💰 Cobrar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modal?.type === 'form' && <Modal title={modal.data ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setModal(null)}><ClientForm client={modal.data} onClose={() => setModal(null)}/></Modal>}
      {modal?.type === 'detail' && <Modal title={modal.data.name} subtitle={`${modal.data.documentType}: ${modal.data.documentNumber}`} onClose={() => setModal(null)}><ClientDetail client={modal.data} sales={sales} onClose={() => setModal(null)}/></Modal>}
      {modal?.type === 'debt' && <Modal title="Registrar pago de deuda" subtitle={`Deuda actual: ${formatCurrency(modal.data.currentDebt||0)}`} onClose={() => setModal(null)}><DebtPaymentForm client={modal.data} onClose={() => setModal(null)}/></Modal>}
    </div>
  )
}
