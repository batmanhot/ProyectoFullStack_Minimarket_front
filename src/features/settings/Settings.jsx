import { useState } from 'react'
import { useStore } from '../../store/index'
import { SECTORS } from '../../config/app'
import toast from 'react-hot-toast'

const Section = ({ title, children }) => (
  <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-5 space-y-4">
    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700 pb-3">{title}</h3>
    {children}
  </div>
)

const Field = ({ label, sub, children }) => (
  <div className="flex items-start justify-between gap-4">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-700 dark:text-slate-200">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
)

const Toggle = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'}`}>
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`}/>
  </button>
)

const Input = ({ value, onChange, type='text', step, min, max, suffix, className }) => (
  <div className="flex items-center gap-1">
    <input type={type} value={value}
      onChange={e => onChange(type==='number' ? parseFloat(e.target.value)||0 : e.target.value)}
      step={step} min={min} max={max}
      className={`px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 dark:bg-slate-700 dark:text-slate-100 ${className||''}`}/>
    {suffix && <span className="text-xs text-gray-400 dark:text-slate-500">{suffix}</span>}
  </div>
)

export default function Settings() {
  const {
    businessConfig, systemConfig,
    updateBusinessConfig, updateSystemConfig,
    loadDemoData,
  } = useStore()

  const [biz, setBiz]         = useState({ ...businessConfig })
  const [sys, setSys]         = useState({ ...systemConfig })
  const [saved, setSaved]     = useState(false)
  const [activeTab, setActiveTab] = useState('business')
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [logoError, setLogoError] = useState(false)

  // ── FIX 1: guardar también persiste inmediatamente en el store ──────────────
  // El logo y el IGV se propagan a toda la app en el mismo ciclo de React
  const handleSave = () => {
    updateBusinessConfig(biz)
    // FIX IGV: propagarlo también a businessConfig.igvRate para que
    // el POS lo lea correctamente (lee de systemConfig.igvRate primero)
    updateSystemConfig({ ...sys, igvRate: parseFloat(sys.igvRate) || 0.18 })
    setSaved(true)
    toast.success('Configuración guardada — el IGV y el logo se aplican de inmediato')
    setTimeout(() => setSaved(false), 2500)
  }

  // ── FIX 2: Backup completo del localStorage ────────────────────────────────
  const handleBackup = () => {
    try {
      const storeKey = 'mm_store_v5'
      const data     = localStorage.getItem(storeKey)
      if (!data) { toast.error('No hay datos para respaldar'); return }

      const blob = new Blob([data], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `minimarket-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup descargado correctamente')
    } catch {
      toast.error('Error al generar el backup')
    }
  }

  // ── FIX 2: Restore desde archivo JSON ─────────────────────────────────────
  const handleRestore = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw = ev.target?.result
        // Validar que es JSON válido con la estructura correcta
        const parsed = JSON.parse(raw)
        if (!parsed.state?.products) {
          toast.error('El archivo no parece un backup válido del sistema')
          return
        }
        localStorage.setItem('mm_store_v5', raw)
        toast.success('Restore completado — recarga la página para aplicar los cambios', { duration: 8000 })
        setTimeout(() => window.location.reload(), 3000)
      } catch {
        toast.error('Error al leer el archivo de backup')
      }
    }
    reader.readAsText(file)
    e.target.value = '' // limpiar input
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Configuración del sistema</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">Variables globales que afectan todo el sistema</p>
        </div>
        <button onClick={handleSave}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          {saved ? '✓ Guardado' : 'Guardar configuración'}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-2 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {[
            { key: 'business',  label: '🏪 Negocio'     },
            { key: 'fiscal',    label: '💰 Fiscal'       },
            { key: 'inventory', label: '📦 Inventario'   },
            { key: 'pos',       label: '🖥️ POS / Caja'  },
            { key: 'audit',     label: '🔍 Auditoría'    },
            { key: 'backup',    label: '💾 Backup'       },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB NEGOCIO ─────────────────────────────────────────────────────── */}
      {activeTab === 'business' && (
        <Section title="🏪 Datos del negocio">
          <Field label="Nombre del negocio" sub="Aparece en tickets y reportes">
            <input value={biz.name||''} onChange={e => setBiz({...biz, name: e.target.value})}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 dark:bg-slate-700 dark:text-slate-100"/>
          </Field>
          <Field label="RUC" sub="Número de contribuyente">
            <input value={biz.ruc||''} onChange={e => setBiz({...biz, ruc: e.target.value})}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40 dark:bg-slate-700 dark:text-slate-100"/>
          </Field>
          <Field label="Dirección" sub="Dirección del local">
            <input value={biz.address||''} onChange={e => setBiz({...biz, address: e.target.value})}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 dark:bg-slate-700 dark:text-slate-100"/>
          </Field>
          <Field label="Teléfono" sub="Número de contacto">
            <input value={biz.phone||''} onChange={e => setBiz({...biz, phone: e.target.value})}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40 dark:bg-slate-700 dark:text-slate-100"/>
          </Field>

          {/* ── FIX LOGO: preview + guardar inmediato ──────────────────────── */}
          <div>
            <Field label="Logo del negocio" sub="URL de imagen para tickets, reportes y encabezados">
              <input value={biz.logoUrl||''} onChange={e => { setBiz({...biz, logoUrl: e.target.value}); setLogoError(false) }}
                placeholder="https://..."
                className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 dark:bg-slate-700 dark:text-slate-100"/>
            </Field>
            {biz.logoUrl && !logoError && (
              <div className="mt-3 flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl">
                <img src={biz.logoUrl} alt="Logo preview"
                  className="h-14 w-auto max-w-32 object-contain"
                  onError={() => setLogoError(true)}/>
                <div className="text-xs text-gray-500 dark:text-slate-400">
                  <p className="font-medium text-gray-700 dark:text-slate-300 mb-0.5">Vista previa del logo</p>
                  <p>Se aplicará en las boletas y reportes al guardar</p>
                </div>
              </div>
            )}
            {logoError && biz.logoUrl && (
              <p className="mt-1.5 text-xs text-red-500">⚠️ No se puede cargar la imagen — verifica la URL</p>
            )}
          </div>

          <Field label="Rubro del negocio" sub="Tipo de negocio para el demo">
            <select value={biz.sector||'bodega'} onChange={e => setBiz({...biz, sector: e.target.value})}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100">
              {SECTORS.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
            </select>
          </Field>

          {/* Preview del ticket */}
          <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-600 dark:text-slate-300 mb-3">Vista previa — encabezado del ticket</p>
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-4 font-mono text-xs text-center text-gray-700 space-y-1" style={{ colorScheme: 'light' }}>
              {biz.logoUrl && !logoError && (
                <div className="flex justify-center mb-2">
                  <img src={biz.logoUrl} alt="Logo" className="max-h-16 w-auto object-contain" onError={() => setLogoError(true)}/>
                </div>
              )}
              <div className="font-bold text-sm">{biz.name || 'MI NEGOCIO'}</div>
              {biz.ruc     && <div>RUC: {biz.ruc}</div>}
              {biz.address && <div>{biz.address}</div>}
              {biz.phone   && <div>Tel: {biz.phone}</div>}
              <div className="border-t border-dashed border-gray-300 pt-1 mt-1">{sys.ticketFooter || '¡Gracias por su compra!'}</div>
            </div>
          </div>
        </Section>
      )}

      {/* ── TAB FISCAL ─────────────────────────────────────────────────────── */}
      {activeTab === 'fiscal' && (
        <Section title="💰 Configuración fiscal y comercial">
          {/* FIX IGV: aviso de propagación inmediata */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-400">
            ℹ️ El cambio de IGV se aplica a <strong>todas las ventas nuevas</strong> desde el momento en que guardas. Las ventas ya registradas conservan el IGV con el que fueron emitidas.
          </div>
          <Field label="Tasa IGV" sub="Porcentaje de impuesto (Perú: 18% · Chile: 19% · Colombia: 19%)">
            <Input type="number" value={Math.round((sys.igvRate||0.18)*100*100)/100}
              onChange={v => setSys({...sys, igvRate: v/100})} step="0.5" min="0" max="50" suffix="%"/>
          </Field>
          <Field label="Prefijo de boleta" sub="Prefijo para el número de comprobante (ej: B001)">
            <input value={sys.invoicePrefix||'B001'} onChange={e => setSys({...sys, invoicePrefix: e.target.value})}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-24 dark:bg-slate-700 dark:text-slate-100"/>
          </Field>
          <Field label="Moneda" sub="Símbolo de moneda en pantalla">
            <input value={sys.currencySymbol||'S/'} onChange={e => setSys({...sys, currencySymbol: e.target.value})}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-20 dark:bg-slate-700 dark:text-slate-100"/>
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
      )}

      {/* ── TAB INVENTARIO ─────────────────────────────────────────────────── */}
      {activeTab === 'inventory' && (
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
      )}

      {/* ── TAB POS ─────────────────────────────────────────────────────────── */}
      {activeTab === 'pos' && (
        <Section title="🖥️ Punto de venta y caja">
          <Field label="Requerir caja abierta para vender" sub="Bloquea el POS si la caja no está aperturada">
            <Toggle value={sys.requireCashToSell !== false} onChange={v => setSys({...sys, requireCashToSell: v})}/>
          </Field>
          <Field label="Imprimir ticket automáticamente" sub="Abre ventana de impresión al completar la venta">
            <Toggle value={sys.printAutomatically === true} onChange={v => setSys({...sys, printAutomatically: v})}/>
          </Field>
          <Field label="Pie del ticket" sub="Texto que aparece al final de cada boleta">
            <input value={sys.ticketFooter||''} onChange={e => setSys({...sys, ticketFooter: e.target.value})}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 dark:bg-slate-700 dark:text-slate-100"
              placeholder="¡Gracias por su compra!"/>
          </Field>
        </Section>
      )}

      {/* ── TAB AUDITORÍA ───────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <Section title="🔍 Auditoría y seguridad">
          <Field label="Auditoría habilitada" sub="Registra todas las operaciones del sistema con trazabilidad completa">
            <Toggle value={sys.auditEnabled !== false} onChange={v => setSys({...sys, auditEnabled: v})}/>
          </Field>
          <Field label="Zona horaria" sub="Para cálculos de fechas y reportes">
            <select value={sys.timeZone||'America/Lima'} onChange={e => setSys({...sys, timeZone: e.target.value})}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100">
              <option value="America/Lima">Lima (UTC-5)</option>
              <option value="America/Bogota">Bogotá (UTC-5)</option>
              <option value="America/Santiago">Santiago (UTC-4/-3)</option>
              <option value="America/Buenos_Aires">Buenos Aires (UTC-3)</option>
              <option value="America/Mexico_City">Ciudad de México (UTC-6/-5)</option>
            </select>
          </Field>
        </Section>
      )}

      {/* ── TAB BACKUP ──────────────────────────────────────────────────────── */}
      {activeTab === 'backup' && (
        <div className="space-y-4">
          {/* Backup */}
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700 pb-3 mb-4">💾 Copia de seguridad</h3>
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex-1 min-w-60">
                <p className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Exportar datos</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  Descarga un archivo JSON con todos los datos del sistema: productos, ventas, clientes, configuración y más. Guárdalo como respaldo antes de hacer cambios importantes.
                </p>
              </div>
              <button onClick={handleBackup}
                className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Descargar backup
              </button>
            </div>
          </div>

          {/* Restore */}
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700 pb-3 mb-4">📂 Restaurar datos</h3>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4 text-xs text-amber-700 dark:text-amber-400">
              ⚠️ <strong>Atención:</strong> Restaurar reemplaza TODOS los datos actuales con los del archivo de backup. Esta acción no se puede deshacer. La página se recargará automáticamente.
            </div>
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex-1 min-w-60">
                <p className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Importar backup</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  Selecciona el archivo JSON descargado previamente con "Descargar backup".
                </p>
              </div>
              <label className="px-5 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors cursor-pointer flex items-center gap-2 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"/>
                </svg>
                Seleccionar archivo
                <input type="file" accept=".json" className="hidden" onChange={handleRestore}/>
              </label>
            </div>
          </div>

          {/* Demo data */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex-1 min-w-60">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🎯</span>
                  <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">Cargar datos demo completos</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-medium">Para presentaciones</span>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                  Inyecta <strong>30 días de ventas históricas</strong> con variedad de métodos de pago, descuentos y horarios realistas. El Dashboard y Reportes se ven completos desde el primer momento.
                </p>
              </div>
              <button onClick={async () => {
                setLoadingDemo(true)
                try { loadDemoData?.(); toast.success('✅ Datos demo cargados') }
                catch { toast.error('Error al cargar demo') }
                finally { setLoadingDemo(false) }
              }} disabled={loadingDemo}
                className="px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0">
                {loadingDemo ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Cargando...</> : <>🚀 Cargar demo completo</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={handleSave}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          {saved ? '✓ Configuración guardada' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  )
}
