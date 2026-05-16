import { useState } from 'react'
import { useStore } from '../../store/index'
import { useTenantSafe } from '../../context/TenantContext'
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
    loadDemoData, clearUserData,
  } = useStore()

  const tenantCtx  = useTenantSafe()
  const tenantSlug = tenantCtx?.tenantSlug ?? 'demo'
  const isDemo     = tenantSlug === 'demo'
  const storeKey   = `mm_store_v5_${tenantSlug}`

  const [biz, setBiz]         = useState({ ...businessConfig })
  const [sys, setSys]         = useState({ ...systemConfig })
  const [saved, setSaved]     = useState(false)
  const [activeTab, setActiveTab] = useState('business')
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [clearingData, setClearingData] = useState(false)

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

  const handleClearData = () => {
    const answer = window.prompt(
      '⚠️ Esta acción eliminará TODOS los productos, ventas, clientes y demás datos registrados.\n\nEscribe LIMPIAR para confirmar:'
    )
    if (answer !== 'LIMPIAR') {
      if (answer !== null) toast.error('Texto incorrecto — escribe exactamente: LIMPIAR')
      return
    }
    setClearingData(true)
    try {
      clearUserData()
      toast.success('✅ Datos eliminados — el sistema quedó en blanco listo para tu información', { duration: 6000 })
    } catch {
      toast.error('Error al limpiar los datos')
    } finally {
      setClearingData(false)
    }
  }

  // ── Backup — incluye store Zustand + clave separada de Cotizaciones ──────────
  const handleBackup = () => {
    try {
      const storeData = localStorage.getItem(storeKey)
      if (!storeData) { toast.error('No hay datos para respaldar en este negocio'); return }

      const backupObj = {
        _meta: { version: 2, tenant: tenantSlug, exportedAt: new Date().toISOString() },
        store:      JSON.parse(storeData),
        quotations: JSON.parse(localStorage.getItem('pos_quotations') || '[]'),
      }

      const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `minimarket-backup-${tenantSlug}-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup descargado correctamente')
    } catch {
      toast.error('Error al generar el backup')
    }
  }

  // ── Restore — soporta formato v2 (con cotizaciones) y v1/legacy ───────────
  const handleRestore = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw    = ev.target?.result
        const parsed = JSON.parse(raw)
        const REQUIRED_KEYS = ['products','sales','clients','categories']

        // Detecta formato: wrapper v2 (con _meta) vs legacy (Zustand raw)
        let storeObj, quotationsArr
        if (parsed?._meta?.version >= 2 && parsed.store) {
          storeObj      = parsed.store
          quotationsArr = parsed.quotations || []
        } else {
          storeObj      = parsed   // formato legacy: el JSON era el estado directo
          quotationsArr = null
        }

        const hasRequiredKeys = storeObj?.state &&
          REQUIRED_KEYS.some(k => k in storeObj.state)
        if (!hasRequiredKeys) {
          toast.error('El archivo no es un backup válido de MiniMarket POS — verifica que sea el archivo correcto', { duration: 7000 })
          return
        }

        localStorage.setItem(storeKey, JSON.stringify(storeObj))
        if (quotationsArr !== null) {
          localStorage.setItem('pos_quotations', JSON.stringify(quotationsArr))
        }
        toast.success(`✅ Restore completado para "${tenantSlug}" — recargando en 3 segundos...`, { duration: 8000 })
        setTimeout(() => window.location.reload(), 3000)
      } catch {
        toast.error('Error al leer el archivo de backup — verifica que el archivo no esté corrupto')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
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

          {/* ── 1. Copia de seguridad ─────────────────────────────────────────── */}
          <div className="rounded-xl overflow-hidden border border-blue-200 dark:border-blue-900">
            <div className="bg-blue-600 px-5 py-3 flex items-center gap-2">
              <span className="text-white text-base">💾</span>
              <span className="text-white text-sm font-bold tracking-wide">Copia de seguridad completa</span>
              <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-medium">{tenantSlug}</span>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 p-5 space-y-4">
              <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                Descarga un archivo <strong>.json</strong> con <strong>todos</strong> los datos del negocio <strong>{tenantSlug}</strong>.
                Guárdalo antes de hacer cambios importantes, limpiar datos de demo o migrar a otro equipo.
              </p>

              {/* 2 cards en una fila — cada uno con 2 columnas internas (sección izq | sección der) */}
              <div className="grid grid-cols-2 gap-3">

                {/* ── CARD 1: Principal (col izq) | Operaciones (col der) ── */}
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-blue-100 dark:border-blue-900/50 overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-blue-100 dark:divide-blue-900/40">

                    {/* columna izquierda — Principal */}
                    <div>
                      <div className="bg-blue-600 px-3 py-1.5">
                        <span className="text-white text-xs font-bold uppercase tracking-wider">Principal</span>
                      </div>
                      <div className="p-3 space-y-2.5">
                        <div>
                          <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 mb-1">🖥️ Punto de Venta</p>
                          <div className="space-y-0.5 pl-3">
                            {['Ventas / boletas','Carrito actual','Contador de facturas'].map(t => (
                              <div key={t} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400"><span className="text-blue-400">✓</span>{t}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* columna derecha — Operaciones */}
                    <div>
                      <div className="bg-blue-600 px-3 py-1.5">
                        <span className="text-white text-xs font-bold uppercase tracking-wider">Operaciones</span>
                      </div>
                      <div className="p-3 space-y-2.5">
                        {[
                          { menu: '🗂️ Catálogo',    tables: ['Productos','Variantes de producto','Categorías','Marcas'] },
                          { menu: '📦 Inventario',   tables: ['Movimientos de stock'] },
                          { menu: '⚠️ Merma',        tables: ['Registros de merma'] },
                          { menu: '🔍 Trazabilidad', tables: ['Vista transversal — datos de Inventario, Ventas, Merma y Devoluciones'] },
                          { menu: '🏭 Proveedores',  tables: ['Proveedores'] },
                          { menu: '🛍️ Compras',      tables: ['Compras a proveedor'] },
                        ].map(({ menu, tables }) => (
                          <div key={menu}>
                            <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 mb-1">{menu}</p>
                            <div className="space-y-0.5 pl-3">
                              {tables.map(t => (
                                <div key={t} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400"><span className="text-blue-400">✓</span>{t}</div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

                {/* ── CARD 2: Comercial (col izq) | Sistema (col der) ── */}
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-blue-100 dark:border-blue-900/50 overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-blue-100 dark:divide-blue-900/40">

                    {/* columna izquierda — Comercial */}
                    <div>
                      <div className="bg-blue-600 px-3 py-1.5">
                        <span className="text-white text-xs font-bold uppercase tracking-wider">Comercial</span>
                      </div>
                      <div className="p-3 space-y-2.5">
                        {[
                          { menu: '💰 Caja',                 tables: ['Sesiones de caja','Caja activa actual'] },
                          { menu: '👥 Clientes',             tables: ['Clientes','Pagos de deuda','Puntos de fidelidad por cliente'] },
                          { menu: '📋 Cotizaciones',         tables: ['Cotizaciones / preventa (pos_quotations)'] },
                          { menu: '🏷️ Gestión Descuentos',   tables: ['Campañas de descuento'] },
                          { menu: '🎟️ Descuentos por Vales', tables: ['Tickets / vales'] },
                          { menu: '↩️ Devoluciones',         tables: ['Devoluciones / notas de crédito'] },
                        ].map(({ menu, tables }) => (
                          <div key={menu}>
                            <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 mb-1">{menu}</p>
                            <div className="space-y-0.5 pl-3">
                              {tables.map(t => (
                                <div key={t} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400"><span className="text-blue-400">✓</span>{t}</div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* columna derecha — Sistema */}
                    <div>
                      <div className="bg-blue-600 px-3 py-1.5">
                        <span className="text-white text-xs font-bold uppercase tracking-wider">Sistema</span>
                      </div>
                      <div className="p-3 space-y-2.5">
                        {[
                          { menu: '🔔 Alertas',           tables: ['Reglas de alerta','Notificaciones'] },
                          { menu: '⭐ Programa de Puntos', tables: ['Config. de puntos (en Configuración del sistema)','Puntos acumulados (en Clientes)'] },
                          { menu: '🔍 Auditoría',          tables: ['Registro de auditoría / trazabilidad'] },
                          { menu: '⚙️ Usuarios',           tables: ['Usuarios del sistema','Sesiones activas','Historial de sesiones'] },
                          { menu: '🛠️ Configuración',      tables: [
                            'Negocio — nombre, RUC, dirección, logo, sector',
                            'Fiscal — IGV, prefijo de boleta, moneda, descuentos',
                            'Inventario — stock mínimo, alertas, días de vencimiento',
                            'POS / Caja — caja requerida, impresión, pie de ticket',
                            'Auditoría — habilitada, zona horaria',
                          ] },
                        ].map(({ menu, tables }) => (
                          <div key={menu}>
                            <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 mb-1">{menu}</p>
                            <div className="space-y-0.5 pl-3">
                              {tables.map(t => (
                                <div key={t} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400"><span className="text-blue-400">✓</span>{t}</div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              <div className="flex justify-end">
                <button onClick={handleBackup}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Descargar backup — {tenantSlug}
                </button>
              </div>
            </div>
          </div>

          {/* ── 2. Restaurar datos ───────────────────────────────────────────── */}
          <div className="rounded-xl overflow-hidden border border-amber-200 dark:border-amber-900">
            <div className="bg-amber-500 px-5 py-3 flex items-center gap-2">
              <span className="text-white text-base">📂</span>
              <span className="text-white text-sm font-bold tracking-wide">Restaurar datos</span>
              <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-medium">Reemplaza todo</span>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 p-5 space-y-3">
              <div className="flex items-start gap-2 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
                <span className="text-base leading-none">⚠️</span>
                <span>
                  <strong>Atención:</strong> Restaurar reemplaza <strong>todos los datos actuales</strong> de <strong>{tenantSlug}</strong> — incluyendo los 6 módulos descritos arriba — con los del archivo seleccionado.
                  Esta acción no se puede deshacer. La página se recargará automáticamente al finalizar.
                </span>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                Selecciona el archivo <strong>.json</strong> generado con "Descargar backup" para el negocio <strong>{tenantSlug}</strong>.
                No uses backups de otros negocios — los datos no son compatibles entre tenants.
              </p>
              <div className="flex justify-end">
                <label className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"/>
                  </svg>
                  Seleccionar archivo .json
                  <input type="file" accept=".json" className="hidden" onChange={handleRestore}/>
                </label>
              </div>
            </div>
          </div>

          {/* ── 3. Datos demo completos ──────────────────────────────────────── */}
          <div className="rounded-xl overflow-hidden border border-indigo-200 dark:border-indigo-900">
            <div className="bg-indigo-600 px-5 py-3 flex items-center gap-2">
              <span className="text-white text-base">🎯</span>
              <span className="text-white text-sm font-bold tracking-wide">Cargar datos demo completos</span>
              <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-medium">Para presentaciones</span>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-950/30 p-5 space-y-3">
              <p className="text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed">
                Inyecta el <strong>conjunto completo de datos demo</strong>: catálogo de productos, clientes, proveedores, marcas, categorías y <strong>30 días de ventas históricas</strong> con Yape, efectivo, tarjeta y descuentos.
                El IGV se ajusta al configurado en este negocio ({Math.round((sys.igvRate ?? 0.18) * 100)}%). La configuración del negocio y el usuario activo no cambian.
              </p>

              {/* Leyenda de estados */}
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400">
                <span className="flex items-center gap-1"><span className="text-indigo-400 font-bold">✓</span> Datos demo cargados</span>
                <span className="flex items-center gap-1"><span className="text-green-500 font-bold">✓</span> Preservado sin cambios</span>
                <span className="flex items-center gap-1"><span className="text-gray-300 dark:text-slate-600 font-bold">—</span> Limpiado / vacío</span>
              </div>

              {/* 2 cards en una fila — cada uno con 2 columnas internas */}
              {(() => {
                const Row = ({ t, s }) => (
                  <div className={`flex items-center gap-1.5 text-xs ${s === 'keep' ? 'text-gray-500 dark:text-slate-400' : s === 'demo' ? 'text-gray-500 dark:text-slate-400' : 'text-gray-400 dark:text-slate-500'}`}>
                    <span className={s === 'demo' ? 'text-indigo-400 font-bold' : s === 'keep' ? 'text-green-500 font-bold' : 'text-gray-300 dark:text-slate-600 font-bold'}>
                      {s === 'clear' ? '—' : '✓'}
                    </span>
                    {t}
                  </div>
                )
                const Menu = ({ label, rows }) => (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 mb-1">{label}</p>
                    <div className="space-y-0.5 pl-3">{rows.map(r => <Row key={r.t} {...r} />)}</div>
                  </div>
                )
                return (
                  <div className="grid grid-cols-2 gap-3">

                    {/* ── CARD 1: Principal | Operaciones ── */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-indigo-100 dark:border-indigo-900/50 overflow-hidden">
                      <div className="grid grid-cols-2 divide-x divide-indigo-100 dark:divide-indigo-900/40">

                        <div>
                          <div className="bg-indigo-600 px-3 py-1.5">
                            <span className="text-white text-xs font-bold uppercase tracking-wider">Principal</span>
                          </div>
                          <div className="p-3 space-y-2.5">
                            <Menu label="🖥️ Punto de Venta" rows={[
                              { t: 'Ventas / boletas (~750 en 30 días)', s: 'demo' },
                              { t: 'Contador de facturas',               s: 'demo' },
                              { t: 'Carrito actual',                     s: 'clear' },
                            ]} />
                          </div>
                        </div>

                        <div>
                          <div className="bg-indigo-600 px-3 py-1.5">
                            <span className="text-white text-xs font-bold uppercase tracking-wider">Operaciones</span>
                          </div>
                          <div className="p-3 space-y-2.5">
                            <Menu label="🗂️ Catálogo" rows={[
                              { t: 'Productos (35)',           s: 'demo'  },
                              { t: 'Variantes de producto',   s: 'clear' },
                              { t: 'Categorías (7)',          s: 'demo'  },
                              { t: 'Marcas (15)',             s: 'demo'  },
                            ]} />
                            <Menu label="📦 Inventario"  rows={[{ t: 'Movimientos de stock',   s: 'clear' }]} />
                            <Menu label="⚠️ Merma"       rows={[{ t: 'Registros de merma',     s: 'clear' }]} />
                            <Menu label="🔍 Trazabilidad" rows={[{ t: 'Vista transversal — ventas demo disponibles', s: 'demo' }]} />
                            <Menu label="🏭 Proveedores" rows={[{ t: 'Proveedores (5)',         s: 'demo'  }]} />
                            <Menu label="🛍️ Compras"     rows={[{ t: 'Compras a proveedor',    s: 'clear' }]} />
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* ── CARD 2: Comercial | Sistema ── */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-indigo-100 dark:border-indigo-900/50 overflow-hidden">
                      <div className="grid grid-cols-2 divide-x divide-indigo-100 dark:divide-indigo-900/40">

                        <div>
                          <div className="bg-indigo-600 px-3 py-1.5">
                            <span className="text-white text-xs font-bold uppercase tracking-wider">Comercial</span>
                          </div>
                          <div className="p-3 space-y-2.5">
                            <Menu label="💰 Caja" rows={[
                              { t: 'Sesiones de caja',  s: 'clear' },
                              { t: 'Caja activa',       s: 'clear' },
                            ]} />
                            <Menu label="👥 Clientes" rows={[
                              { t: 'Clientes (7)',               s: 'demo'  },
                              { t: 'Pagos de deuda',             s: 'clear' },
                              { t: 'Puntos de fidelidad',        s: 'clear' },
                            ]} />
                            <Menu label="📋 Cotizaciones"       rows={[{ t: 'Cotizaciones / preventa',       s: 'keep'  }]} />
                            <Menu label="🏷️ Gestión Descuentos" rows={[{ t: 'Campañas de descuento',         s: 'clear' }]} />
                            <Menu label="🎟️ Descuentos por Vales" rows={[{ t: 'Tickets / vales',             s: 'clear' }]} />
                            <Menu label="↩️ Devoluciones"       rows={[{ t: 'Devoluciones / notas de crédito', s: 'clear' }]} />
                          </div>
                        </div>

                        <div>
                          <div className="bg-indigo-600 px-3 py-1.5">
                            <span className="text-white text-xs font-bold uppercase tracking-wider">Sistema</span>
                          </div>
                          <div className="p-3 space-y-2.5">
                            <Menu label="🔔 Alertas" rows={[
                              { t: 'Reglas de alerta',  s: 'keep'  },
                              { t: 'Notificaciones',    s: 'clear' },
                            ]} />
                            <Menu label="⭐ Programa de Puntos" rows={[
                              { t: 'Config. de puntos (en Configuración)', s: 'keep'  },
                              { t: 'Puntos acumulados (en Clientes)',      s: 'clear' },
                            ]} />
                            <Menu label="🔍 Auditoría"  rows={[{ t: 'Registro de auditoría',           s: 'clear' }]} />
                            <Menu label="⚙️ Usuarios" rows={[
                              { t: 'Usuarios del sistema (5)', s: 'demo' },
                              { t: 'Sesiones activas',         s: 'keep' },
                              { t: 'Historial de sesiones',    s: 'keep' },
                            ]} />
                            <Menu label="🛠️ Configuración" rows={[
                              { t: 'Negocio — nombre, RUC, logo',              s: 'keep' },
                              { t: 'Fiscal — IGV, prefijo, moneda',            s: 'keep' },
                              { t: 'Inventario — stock mínimo, alertas',       s: 'keep' },
                              { t: 'POS / Caja — impresión, pie de ticket',    s: 'keep' },
                              { t: 'Auditoría — habilitada, zona horaria',     s: 'keep' },
                            ]} />
                          </div>
                        </div>

                      </div>
                    </div>

                  </div>
                )
              })()}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                  ⚠️ Los productos, clientes y ventas actuales serán reemplazados por los datos demo.
                </p>
                <button onClick={async () => {
                  setLoadingDemo(true)
                  try {
                    loadDemoData?.()
                    toast.success('✅ Datos demo cargados — Dashboard y Reportes ya tienen información completa', { duration: 5000 })
                  }
                  catch { toast.error('Error al cargar demo') }
                  finally { setLoadingDemo(false) }
                }} disabled={loadingDemo}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0">
                  {loadingDemo
                    ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Cargando...</>
                    : <>🚀 Cargar demo completo</>
                  }
                </button>
              </div>
            </div>
          </div>

          {/* ── 4. Zona de limpieza — solo DEMO ──────────────────────────────── */}
          {isDemo && (
            <div className="rounded-xl overflow-hidden border border-red-200 dark:border-red-900">
              <div className="bg-red-600 px-5 py-3 flex items-center gap-2">
                <span className="text-white text-base">🧹</span>
                <span className="text-white text-sm font-bold tracking-wide">Limpiar todos los datos</span>
                <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-semibold">Solo modo DEMO</span>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 p-5 space-y-4">
                <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">
                  Elimina <strong>toda la información operativa</strong> registrada en el sistema para que puedas ingresar tu propia data desde cero: tus productos, tus clientes, tus ventas.
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-red-600 dark:text-red-400">
                  {[
                    'Productos y variantes','Ventas y boletas',
                    'Clientes y deudas',   'Proveedores',
                    'Compras',             'Sesiones de caja',
                    'Movimientos de stock','Campañas de descuento',
                    'Tickets de descuento','Devoluciones',
                    'Auditoría y logs',    'Notificaciones',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-1.5">
                      <span className="text-red-400">✕</span><span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg px-4 py-3 border border-red-100 dark:border-red-900">
                  <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5">Se conserva</p>
                  <div className="flex flex-wrap gap-2">
                    {['Configuración del negocio','Tasas fiscales (IGV)','Usuarios del sistema','Categorías y marcas'].map(item => (
                      <span key={item} className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">✓ {item}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-xs text-red-500 dark:text-red-400">
                    ⚠️ <strong>Irreversible.</strong> Deberás escribir <code className="px-1 py-0.5 bg-red-100 dark:bg-red-900/50 rounded font-mono">LIMPIAR</code> para confirmar.
                  </p>
                  <button onClick={handleClearData} disabled={clearingData}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0">
                    {clearingData
                      ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Limpiando...</>
                      : <>🧹 Limpiar todos los datos</>
                    }
                  </button>
                </div>
              </div>
            </div>
          )}
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
