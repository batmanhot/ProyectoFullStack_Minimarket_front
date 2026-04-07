import { useState } from 'react'
import { useStore } from '../../store/index'
import { SECTORS } from '../../config/app'
import toast from 'react-hot-toast'

const Section = ({ title, children }) => (
  <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
    <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3">{title}</h3>
    {children}
  </div>
)

const Field = ({ label, sub, children }) => (
  <div className="flex items-start justify-between gap-4">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
)

const Toggle = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-200'}`}>
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`}/>
  </button>
)

const Input = ({ value, onChange, type='text', step, min, max, suffix, className }) => (
  <div className="flex items-center gap-1">
    <input type={type} value={value} onChange={e => onChange(type==='number' ? parseFloat(e.target.value)||0 : e.target.value)}
      step={step} min={min} max={max}
      className={`px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 ${className||''}`}/>
    {suffix && <span className="text-xs text-gray-400">{suffix}</span>}
  </div>
)

export default function Settings() {
  const { businessConfig, systemConfig, updateBusinessConfig, updateSystemConfig } = useStore()

  const [biz, setBiz] = useState({ ...businessConfig })
  const [sys, setSys] = useState({ ...systemConfig })
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    updateBusinessConfig(biz)
    updateSystemConfig(sys)
    setSaved(true)
    toast.success('Configuración guardada correctamente')
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800">Configuración del sistema</h1>
          <p className="text-sm text-gray-400">Variables globales que afectan todo el sistema</p>
        </div>
        <button onClick={handleSave}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          {saved ? '✓ Guardado' : 'Guardar configuración'}
        </button>
      </div>

      {/* NEGOCIO */}
      <Section title="🏪 Datos del negocio">
        <Field label="Nombre del negocio" sub="Aparece en tickets y reportes">
          <input value={biz.name||''} onChange={e => setBiz({...biz, name: e.target.value})} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"/>
        </Field>
        <Field label="RUC" sub="Número de contribuyente">
          <input value={biz.ruc||''} onChange={e => setBiz({...biz, ruc: e.target.value})} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"/>
        </Field>
        <Field label="Dirección" sub="Dirección del local">
          <input value={biz.address||''} onChange={e => setBiz({...biz, address: e.target.value})} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"/>
        </Field>
        <Field label="Teléfono" sub="Número de contacto">
          <input value={biz.phone||''} onChange={e => setBiz({...biz, phone: e.target.value})} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"/>
        </Field>
        <Field label="Logo (URL)" sub="URL de imagen para tickets y reportes">
          <input value={biz.logoUrl||''} onChange={e => setBiz({...biz, logoUrl: e.target.value})} placeholder="https://..." className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"/>
        </Field>
        <Field label="Rubro del negocio" sub="Tipo de negocio para el demo">
          <select value={biz.sector||'bodega'} onChange={e => setBiz({...biz, sector: e.target.value})} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {SECTORS.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
          </select>
        </Field>
      </Section>

      {/* FISCAL */}
      <Section title="💰 Configuración fiscal y comercial">
        <Field label="Tasa IGV" sub="Porcentaje de impuesto general a las ventas (Perú: 18%)">
          <Input type="number" value={(sys.igvRate||0.18)*100} onChange={v => setSys({...sys, igvRate: v/100})} step="0.5" min="0" max="50" suffix="%"/>
        </Field>
        <Field label="Prefijo de boleta" sub="Prefijo para el número de comprobante (ej: B001)">
          <input value={sys.invoicePrefix||'B001'} onChange={e => setSys({...sys, invoicePrefix: e.target.value})} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"/>
        </Field>
        <Field label="Moneda" sub="Símbolo de moneda en pantalla">
          <input value={sys.currencySymbol||'S/'} onChange={e => setSys({...sys, currencySymbol: e.target.value})} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-20"/>
        </Field>
        <Field label="Descuentos habilitados" sub="Permite aplicar descuentos en el POS">
          <Toggle value={sys.allowDiscounts !== false} onChange={v => setSys({...sys, allowDiscounts: v})}/>
        </Field>
        {sys.allowDiscounts !== false && (
          <Field label="Descuento máximo permitido" sub="Porcentaje máximo que puede aplicar un cajero">
            <Input type="number" value={sys.maxDiscountPct||50} onChange={v => setSys({...sys, maxDiscountPct: v})} min="0" max="100" suffix="%"/>
          </Field>
        )}
      </Section>

      {/* INVENTARIO */}
      <Section title="📦 Inventario y stock">
        <Field label="Stock mínimo por defecto" sub="Valor inicial de stockMin para nuevos productos">
          <Input type="number" value={sys.lowStockDefault||5} onChange={v => setSys({...sys, lowStockDefault: v})} min="0"/>
        </Field>
        <Field label="Alertas de stock habilitadas" sub="Muestra alertas cuando el stock cae al mínimo">
          <Toggle value={sys.stockAlertEnabled !== false} onChange={v => setSys({...sys, stockAlertEnabled: v})}/>
        </Field>
        <Field label="Días de alerta por vencimiento" sub="Días antes del vencimiento para mostrar alerta">
          <Input type="number" value={sys.expiryAlertDays||30} onChange={v => setSys({...sys, expiryAlertDays: v})} min="1" suffix="días"/>
        </Field>
        <Field label="Permitir stock negativo" sub="Permite vender aunque el stock llegue a cero">
          <Toggle value={sys.allowNegativeStock === true} onChange={v => setSys({...sys, allowNegativeStock: v})}/>
        </Field>
      </Section>

      {/* VENTAS / CAJA */}
      <Section title="🖥️ Punto de venta y caja">
        <Field label="Requerir caja abierta para vender" sub="Bloquea el POS si la caja no está aperturada">
          <Toggle value={sys.requireCashToSell !== false} onChange={v => setSys({...sys, requireCashToSell: v})}/>
        </Field>
        <Field label="Imprimir ticket automáticamente" sub="Abre ventana de impresión al completar la venta">
          <Toggle value={sys.printAutomatically === true} onChange={v => setSys({...sys, printAutomatically: v})}/>
        </Field>
        <Field label="Pie del ticket" sub="Texto que aparece al final de cada boleta">
          <input value={sys.ticketFooter||''} onChange={e => setSys({...sys, ticketFooter: e.target.value})} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" placeholder="¡Gracias por su compra!"/>
        </Field>
      </Section>

      {/* AUDITORÍA */}
      <Section title="🔍 Auditoría y seguridad">
        <Field label="Auditoría habilitada" sub="Registra todas las operaciones del sistema con trazabilidad completa">
          <Toggle value={sys.auditEnabled !== false} onChange={v => setSys({...sys, auditEnabled: v})}/>
        </Field>
        <Field label="Zona horaria" sub="Para cálculos de fechas y reportes">
          <select value={sys.timeZone||'America/Lima'} onChange={e => setSys({...sys, timeZone: e.target.value})} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="America/Lima">Lima (UTC-5)</option>
            <option value="America/Bogota">Bogotá (UTC-5)</option>
            <option value="America/Santiago">Santiago (UTC-4/-3)</option>
            <option value="America/Buenos_Aires">Buenos Aires (UTC-3)</option>
            <option value="America/Mexico_City">Ciudad de México (UTC-6/-5)</option>
          </select>
        </Field>
      </Section>

      {/* Vista previa */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-600 mb-3">Vista previa — encabezado del ticket</p>
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-4 font-mono text-xs text-center text-gray-700 space-y-1">
          <div className="font-bold text-sm">{biz.name || 'MI NEGOCIO'}</div>
          {biz.ruc     && <div>RUC: {biz.ruc}</div>}
          {biz.address && <div>{biz.address}</div>}
          {biz.phone   && <div>Tel: {biz.phone}</div>}
          <div className="border-t border-dashed border-gray-300 pt-1 mt-1">{sys.ticketFooter || '¡Gracias por su compra!'}</div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          {saved ? '✓ Configuración guardada' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  )
}
