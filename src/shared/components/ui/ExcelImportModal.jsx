/**
 * ExcelImportModal.jsx — Importación masiva desde Excel
 * Entidades soportadas: products | categories | brands | suppliers | clients
 *
 * Flujo: Cargar archivo → Revisar/Validar → Importar → Resultado
 */
import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { useStore } from '../../../store/index'
import { productService, supplierService, clientService } from '../../../services/index'
import toast from 'react-hot-toast'

// ── Paleta de colores para categorías/marcas creadas automáticamente ──────────
const AUTO_COLORS = [
  '#3b82f6','#8b5cf6','#ec4899','#f59e0b',
  '#10b981','#ef4444','#6366f1','#14b8a6',
  '#f97316','#06b6d4','#84cc16','#a855f7',
]
const autoColor = (i) => AUTO_COLORS[i % AUTO_COLORS.length]

// ── Normaliza un string para comparación sin acento ni mayúsculas ─────────────
const norm = (s) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// ── Configuraciones por entidad ───────────────────────────────────────────────
const ENTITY_CONFIG = {
  products: {
    label: 'Catálogo de Productos',
    icon: '📦',
    color: 'blue',
    templateHeaders: [
      'Codigo Barras *','Nombre *','Descripcion','SKU',
      'Categoria *','Proveedor *','Marca',
      'Precio Compra *','Precio Venta *',
      'Stock Inicial','Stock Minimo','Unidad',
    ],
    sampleRows: [
      ['7751234567890','Arroz Extra 1kg','Arroz de grano largo','ARR-001',
       'Abarrotes','Distribuidora ABC','Costeño','3.50','5.90','100','10','kg'],
      ['7750001122334','Aceite Vegetal 1L','','ACE-001',
       'Abarrotes','Distribuidora ABC','Primor','4.00','6.50','50','5','litro'],
    ],
    fieldAliases: {
      'codigo barras':    'barcode',  'codigo de barras': 'barcode',
      'barcode':          'barcode',  'codigo':           'barcode',
      'ean':              'barcode',  'upc':              'barcode',
      'nombre':           'name',     'producto':         'name',
      'descripcion':      'desc',     'description':      'desc',
      'sku':              'sku',      'referencia':       'sku',
      'categoria':        'catName',  'category':         'catName',
      'proveedor':        'supName',  'supplier':         'supName',
      'marca':            'brand',    'brand':            'brand',
      'precio compra':    'priceBuy', 'costo':            'priceBuy',
      'precio de compra': 'priceBuy', 'purchase price':   'priceBuy',
      'precio venta':     'priceSell','precio de venta':  'priceSell',
      'precio':           'priceSell','sale price':       'priceSell',
      'stock':            'stock',    'stock inicial':    'stock',
      'cantidad':         'stock',    'existencias':      'stock',
      'stock minimo':     'stockMin', 'stock min':        'stockMin',
      'unidad':           'unit',     'um':               'unit',
    },
    required: ['barcode','name','priceBuy','priceSell'],
  },

  categories: {
    label: 'Categorías',
    icon: '🗂️',
    color: 'purple',
    templateHeaders: ['Nombre *','Descripcion','Color'],
    sampleRows: [
      ['Abarrotes','Productos de abarrotes en general','#3b82f6'],
      ['Bebidas','Bebidas y refrescos','#10b981'],
    ],
    fieldAliases: {
      'nombre':      'name', 'name':        'name', 'categoria': 'name',
      'descripcion': 'desc', 'description': 'desc',
      'color':       'color',
    },
    required: ['name'],
  },

  brands: {
    label: 'Marcas',
    icon: '🏷️',
    color: 'orange',
    templateHeaders: ['Nombre *','Descripcion','Color'],
    sampleRows: [
      ['Costeño','Marca de arroz y menestras','#f59e0b'],
      ['Gloria','Lácteos y derivados','#3b82f6'],
    ],
    fieldAliases: {
      'nombre':      'name', 'name':        'name', 'marca': 'name',
      'descripcion': 'desc', 'description': 'desc',
      'color':       'color',
    },
    required: ['name'],
  },

  suppliers: {
    label: 'Proveedores',
    icon: '🏭',
    color: 'teal',
    templateHeaders: ['Nombre *','RUC','Contacto','Telefono','Email','Direccion','Notas'],
    sampleRows: [
      ['Distribuidora ABC','20123456789','Juan Pérez','999888777','ventas@abc.com','Av. Lima 123','Entrega los lunes'],
      ['Importaciones XYZ','20987654321','María García','988776655','','Jr. Callao 456',''],
    ],
    fieldAliases: {
      'nombre':       'name',    'name':       'name',    'razon social': 'name',
      'ruc':          'taxId',   'nit':        'taxId',   'ruc / n tributario': 'taxId',
      'contacto':     'contact', 'contact':    'contact',
      'telefono':     'phone',   'phone':      'phone',   'celular': 'phone',
      'email':        'email',   'correo':     'email',
      'direccion':    'address', 'address':    'address', 'dir': 'address',
      'notas':        'notes',   'notes':      'notes',   'observaciones': 'notes',
    },
    required: ['name'],
  },

  clients: {
    label: 'Clientes',
    icon: '👥',
    color: 'green',
    templateHeaders: [
      'Nombre *','Tipo Documento','N Documento',
      'Telefono','Email','Direccion','Limite Credito','Notas',
    ],
    sampleRows: [
      ['María López','DNI','45678901','987654321','maria@email.com','Jr. Flores 123','500','Cliente frecuente'],
      ['Bodega El Sol','RUC','20123456789','012345678','','Av. Principal 456','1000',''],
    ],
    fieldAliases: {
      'nombre':           'name',       'name':           'name',
      'tipo documento':   'docType',    'tipo doc':        'docType',
      'tipo de documento':'docType',    'document type':   'docType',
      'n documento':      'docNum',     'numero documento':'docNum',
      'n de documento':   'docNum',     'dni':             'docNum',
      'ruc':              'docNum',     'documento':       'docNum',
      'telefono':         'phone',      'phone':           'phone',   'celular': 'phone',
      'email':            'email',      'correo':          'email',
      'direccion':        'address',    'address':         'address',
      'limite credito':   'creditLimit','credito':         'creditLimit',
      'credit limit':     'creditLimit',
      'notas':            'notes',      'notes':           'notes',
    },
    required: ['name'],
  },
}

// ── Descarga la plantilla Excel para la entidad ───────────────────────────────
function downloadTemplate(entityType) {
  const cfg = ENTITY_CONFIG[entityType]
  const wb  = XLSX.utils.book_new()
  // Cabeceras + 2 filas de muestra
  const ws  = XLSX.utils.aoa_to_sheet([cfg.templateHeaders, ...cfg.sampleRows])
  // Ancho automático de columnas
  ws['!cols'] = cfg.templateHeaders.map(() => ({ wch: 22 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  // Hoja de instrucciones
  const inst = XLSX.utils.aoa_to_sheet([
    [`Plantilla de importación — ${cfg.label}`],
    [''],
    ['INSTRUCCIONES:'],
    ['1. No elimines la primera fila (encabezados).'],
    ['2. Las columnas marcadas con * son obligatorias.'],
    ['3. No modifiques los nombres de los encabezados.'],
    ['4. Guarda el archivo como .xlsx antes de importar.'],
    ['5. Las filas en blanco serán ignoradas.'],
  ])
  inst['!cols'] = [{ wch: 60 }]
  XLSX.utils.book_append_sheet(wb, inst, 'Instrucciones')
  XLSX.writeFile(wb, `plantilla_${entityType}.xlsx`)
}

// ── Mapea cabeceras del Excel a campos de la entidad ─────────────────────────
function mapHeaders(rawHeaders, aliases) {
  return rawHeaders.map(h => {
    const normalized = norm(String(h).replace(/\*/g, ''))
    return aliases[normalized] ?? null
  })
}

// ── Parsea el archivo Excel/CSV y retorna filas ───────────────────────────────
async function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb   = XLSX.read(data, { type: 'array', cellDates: true })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        resolve(rows.filter(r => r.some(c => String(c).trim() !== '')))
      } catch (err) {
        reject(new Error('No se pudo leer el archivo. Asegúrate de que sea un Excel válido.'))
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsArrayBuffer(file)
  })
}

// ── Transforma y valida filas según la entidad ────────────────────────────────
function processRows(rawRows, fieldMap, entityType, store) {
  const cfg = ENTITY_CONFIG[entityType]

  return rawRows.map((raw, idx) => {
    const mapped = {}
    fieldMap.forEach((field, colIdx) => {
      if (field) mapped[field] = String(raw[colIdx] ?? '').trim()
    })

    // Normaliza campos específicos por entidad
    let entity = {}, errors = []

    if (entityType === 'products') {
      entity = {
        barcode:   mapped.barcode  || '',
        name:      mapped.name     || '',
        desc:      mapped.desc     || '',
        sku:       mapped.sku      || '',
        catName:   mapped.catName  || '',
        supName:   mapped.supName  || '',
        brand:     mapped.brand    || '',
        priceBuy:  parseFloat(String(mapped.priceBuy  || '0').replace(',','.')) || 0,
        priceSell: parseFloat(String(mapped.priceSell || '0').replace(',','.')) || 0,
        stock:     parseInt(mapped.stock   || '0') || 0,
        stockMin:  parseInt(mapped.stockMin || '5') || 5,
        unit:      mapped.unit || 'unidad',
      }
      if (!entity.barcode)           errors.push('Código de barras requerido')
      if (!entity.name)              errors.push('Nombre requerido')
      if (!entity.catName)           errors.push('Categoría requerida')
      if (!entity.supName)           errors.push('Proveedor requerido')
      if (entity.priceBuy  <= 0)     errors.push('Precio de compra debe ser > 0')
      if (entity.priceSell <= 0)     errors.push('Precio de venta debe ser > 0')
      // Check duplicate barcode in existing store
      const dup = store.products.find(p => p.barcode === entity.barcode && p.isActive)
      if (dup) errors.push(`Código '${entity.barcode}' ya existe (${dup.name})`)
    }

    else if (entityType === 'categories') {
      entity = {
        name:  mapped.name  || '',
        desc:  mapped.desc  || '',
        color: mapped.color || '',
      }
      if (!entity.name) errors.push('Nombre requerido')
      const dup = store.categories.find(c => norm(c.name) === norm(entity.name))
      if (dup) errors.push(`Categoría '${entity.name}' ya existe`)
    }

    else if (entityType === 'brands') {
      entity = {
        name:  mapped.name  || '',
        desc:  mapped.desc  || '',
        color: mapped.color || '',
      }
      if (!entity.name) errors.push('Nombre requerido')
      const dup = (store.brands || []).find(b => norm(b.name) === norm(entity.name))
      if (dup) errors.push(`Marca '${entity.name}' ya existe`)
    }

    else if (entityType === 'suppliers') {
      entity = {
        name:    mapped.name    || '',
        taxId:   mapped.taxId   || '',
        contact: mapped.contact || '',
        phone:   mapped.phone   || '',
        email:   mapped.email   || '',
        address: mapped.address || '',
        notes:   mapped.notes   || '',
      }
      if (!entity.name) errors.push('Nombre requerido')
      const dup = store.suppliers.find(s => norm(s.name) === norm(entity.name))
      if (dup) errors.push(`Proveedor '${entity.name}' ya existe`)
    }

    else if (entityType === 'clients') {
      entity = {
        name:        mapped.name        || '',
        documentType:mapped.docType     || 'DNI',
        documentNumber:mapped.docNum    || '',
        phone:       mapped.phone       || '',
        email:       mapped.email       || '',
        address:     mapped.address     || '',
        creditLimit: parseFloat(String(mapped.creditLimit || '0').replace(',','.')) || 0,
        notes:       mapped.notes       || '',
      }
      if (!entity.name) errors.push('Nombre requerido')
      const dup = store.clients?.find(c => norm(c.name) === norm(entity.name))
      if (dup) errors.push(`Cliente '${entity.name}' ya existe`)
    }

    return { rowIndex: idx + 2, entity, errors, raw: mapped }
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export default function ExcelImportModal({ entityType, onClose }) {
  const store = useStore()
  const { addCategory, addBrand, addSupplier, addClient, addAuditLog } = store

  const cfg = ENTITY_CONFIG[entityType]

  // step: 'upload' | 'preview' | 'importing' | 'done'
  const [step,       setStep]       = useState('upload')
  const [dragging,   setDragging]   = useState(false)
  const [fileName,   setFileName]   = useState('')
  const [rows,       setRows]       = useState([])      // processed rows
  const [fieldMap,   setFieldMap]   = useState([])      // col index → field name
  const [rawHeaders, setRawHeaders] = useState([])
  const [progress,   setProgress]   = useState(0)
  const [results,    setResults]    = useState({ ok: 0, errors: [] })
  const [showErrors, setShowErrors] = useState(false)
  const fileRef = useRef()

  // ── Carga y procesa el archivo ─────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx','xls','csv'].includes(ext)) {
      toast.error('Formato no soportado. Usa .xlsx, .xls o .csv'); return
    }
    setFileName(file.name)
    try {
      const allRows = await parseFile(file)
      if (allRows.length < 2) { toast.error('El archivo está vacío o solo tiene encabezados'); return }

      const headers = allRows[0]
      const fMap    = mapHeaders(headers, cfg.fieldAliases)
      const dataRows = allRows.slice(1).filter(r => r.some(c => String(c).trim()))

      setRawHeaders(headers)
      setFieldMap(fMap)
      setRows(processRows(dataRows, fMap, entityType, store))
      setStep('preview')
    } catch (err) {
      toast.error(err.message)
    }
  }, [cfg, entityType, store])

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ── Importa las filas válidas ──────────────────────────────────────────────
  const handleImport = async () => {
    const validRows = rows.filter(r => r.errors.length === 0)
    if (!validRows.length) { toast.error('No hay filas válidas para importar'); return }

    setStep('importing')
    setProgress(0)

    let okCount = 0
    const errorList = []

    // Para productos: pre-crear categorías y proveedores que no existan
    if (entityType === 'products') {
      const freshState   = useStore.getState()
      const catNamesNeeded  = [...new Set(validRows.map(r => r.entity.catName).filter(Boolean))]
      const supNamesNeeded  = [...new Set(validRows.map(r => r.entity.supName).filter(Boolean))]

      catNamesNeeded.forEach((catName, i) => {
        const exists = freshState.categories.find(c => norm(c.name) === norm(catName))
        if (!exists) {
          addCategory({ id: crypto.randomUUID(), name: catName, description: '', color: autoColor(i), isActive: true, createdAt: new Date().toISOString() })
        }
      })
      supNamesNeeded.forEach((supName) => {
        const exists = freshState.suppliers.find(s => norm(s.name) === norm(supName))
        if (!exists) {
          addSupplier?.({ id: crypto.randomUUID(), name: supName, isActive: true, createdAt: new Date().toISOString() })
        }
      })
    }

    for (let i = 0; i < validRows.length; i++) {
      const { entity, rowIndex } = validRows[i]
      setProgress(Math.round(((i + 1) / validRows.length) * 100))

      try {
        if (entityType === 'products') {
          const freshState = useStore.getState()
          const cat = freshState.categories.find(c => norm(c.name) === norm(entity.catName))
          const sup = freshState.suppliers.find(s => norm(s.name) === norm(entity.supName))
          const payload = {
            barcode: entity.barcode, name: entity.name,
            description: entity.desc, sku: entity.sku,
            categoryId: cat?.id || '', supplierId: sup?.id || '',
            brand: entity.brand,
            priceBuy: entity.priceBuy, priceSell: entity.priceSell,
            stock: entity.stock, stockMin: entity.stockMin,
            stockMax: entity.stock * 3 || 100,
            unit: entity.unit, isActive: true,
            hasVariants: false, useBatches: false,
            stockControl: 'simple', type: 'simple',
            components: [], imageUrl: '',
          }
          const r = await productService.create(payload)
          if (r.error) throw new Error(r.error)

        } else if (entityType === 'categories') {
          addCategory({
            id: crypto.randomUUID(), name: entity.name,
            description: entity.desc,
            color: entity.color || autoColor(i),
            isActive: true, createdAt: new Date().toISOString(),
          })

        } else if (entityType === 'brands') {
          addBrand?.({
            id: crypto.randomUUID(), name: entity.name,
            description: entity.desc,
            color: entity.color || autoColor(i),
            isActive: true, createdAt: new Date().toISOString(),
          })

        } else if (entityType === 'suppliers') {
          const r = await supplierService.create(entity)
          if (r.error) throw new Error(r.error)

        } else if (entityType === 'clients') {
          const payload = {
            ...entity, isActive: true,
            loyaltyPoints: 0, loyaltyLevel: 'Bronce',
            currentDebt: 0, loyaltyTransactions: [],
          }
          const r = await clientService.create(payload)
          if (r.error) throw new Error(r.error)
        }

        okCount++
      } catch (err) {
        errorList.push({ rowIndex, message: err.message || 'Error desconocido' })
      }

      // Pequeña pausa para no bloquear el UI
      if (i % 10 === 9) await new Promise(r => setTimeout(r, 10))
    }

    addAuditLog?.({
      action: 'IMPORT', module: cfg.label,
      detail: `Excel: ${okCount} importados, ${errorList.length} errores`,
    })

    setResults({ ok: okCount, errors: errorList })
    setStep('done')
  }

  const valid   = rows.filter(r => r.errors.length === 0)
  const invalid = rows.filter(r => r.errors.length > 0)

  // ── COLOR CLASSES ──────────────────────────────────────────────────────────
  const colorMap = {
    blue:   { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',   btn: 'bg-blue-600 hover:bg-blue-700' },
    purple: { badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', btn: 'bg-purple-600 hover:bg-purple-700' },
    orange: { badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', btn: 'bg-orange-600 hover:bg-orange-700' },
    teal:   { badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',   btn: 'bg-teal-600 hover:bg-teal-700' },
    green:  { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', btn: 'bg-green-600 hover:bg-green-700' },
  }
  const colors = colorMap[cfg.color]

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{cfg.icon}</span>
            <div>
              <h2 className="text-base font-semibold text-gray-800 dark:text-slate-100">
                Importar {cfg.label}
              </h2>
              <p className="text-xs text-gray-400 dark:text-slate-500">desde archivo Excel</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-0 px-6 pt-4 shrink-0">
          {[['upload','1','Cargar'],['preview','2','Revisar'],['done','3','Resultado']].map(([s, n, lbl], idx) => {
            const steps = ['upload','preview','importing','done']
            const cur = steps.indexOf(step)
            const mine = steps.indexOf(s === 'done' ? 'done' : s)
            const active = cur >= mine
            return (
              <div key={s} className="flex items-center">
                <div className={`flex items-center gap-1.5 ${active ? 'opacity-100' : 'opacity-40'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${active ? colors.btn + ' text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-500'}`}>{n}</div>
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-300">{lbl}</span>
                </div>
                {idx < 2 && <div className="w-8 h-px bg-gray-200 dark:bg-slate-600 mx-2"/>}
              </div>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── STEP: UPLOAD ─────────────────────────────────────────────── */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Zona de carga */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  dragging
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-slate-600 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                }`}>
                <input
                  ref={fileRef} type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files[0])}/>
                <div className="text-4xl mb-3">📂</div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
                  Arrastra tu archivo aquí o <span className="text-blue-600 dark:text-blue-400">haz clic para seleccionar</span>
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  Formatos aceptados: .xlsx, .xls, .csv
                </p>
              </div>

              {/* Descarga de plantilla */}
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">📋</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                      ¿Primera vez? Descarga la plantilla
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
                      Llena la plantilla con tus datos y luego cárgala aquí.
                      Las columnas con * son obligatorias.
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadTemplate(entityType) }}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg ${colors.btn} transition-colors`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      Descargar plantilla {cfg.label}
                    </button>
                  </div>
                </div>
              </div>

              {/* Columnas esperadas */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">
                  Columnas de la plantilla:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {cfg.templateHeaders.map(h => (
                    <span key={h} className={`text-xs px-2 py-1 rounded-full font-medium ${
                      h.includes('*')
                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {h}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                  <span className="text-red-500">*</span> = obligatorio
                </p>
              </div>
            </div>
          )}

          {/* ── STEP: PREVIEW ────────────────────────────────────────────── */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{valid.length}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Filas válidas</p>
                </div>
                <div className={`flex-1 rounded-xl p-3 text-center ${invalid.length > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-slate-700/50'}`}>
                  <p className={`text-2xl font-bold ${invalid.length > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-400'}`}>{invalid.length}</p>
                  <p className={`text-xs ${invalid.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-slate-500'}`}>Con errores</p>
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">Archivo</p>
                  <p className="text-xs font-medium text-gray-600 dark:text-slate-300 truncate">{fileName}</p>
                </div>
              </div>

              {/* Mapeo de columnas detectado */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Columnas detectadas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {rawHeaders.map((h, i) => (
                    <span key={i} className={`text-xs px-2 py-1 rounded-full ${
                      fieldMap[i]
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500 line-through'
                    }`}>
                      {String(h)} {fieldMap[i] ? `→ ${fieldMap[i]}` : '(ignorada)'}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tabla de previsualización */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                    Vista previa ({Math.min(rows.length, 8)} de {rows.length} filas)
                  </p>
                  {invalid.length > 0 && (
                    <button
                      onClick={() => setShowErrors(!showErrors)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium">
                      {showErrors ? 'Ver todas' : `Ver ${invalid.length} con errores`}
                    </button>
                  )}
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-700/50">
                          <th className="px-3 py-2 text-left text-gray-500 dark:text-slate-400 font-medium w-10">#</th>
                          <th className="px-3 py-2 text-left text-gray-500 dark:text-slate-400 font-medium">Estado</th>
                          {rawHeaders.filter((_, i) => fieldMap[i]).map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left text-gray-500 dark:text-slate-400 font-medium whitespace-nowrap">{String(h)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                        {(showErrors ? invalid : rows).slice(0, 8).map((row, i) => (
                          <tr key={i} className={row.errors.length > 0 ? 'bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'}>
                            <td className="px-3 py-2 text-gray-400 dark:text-slate-500">{row.rowIndex}</td>
                            <td className="px-3 py-2">
                              {row.errors.length === 0
                                ? <span className="text-green-600 dark:text-green-400">✓</span>
                                : (
                                  <span className="text-red-500" title={row.errors.join(', ')}>
                                    ✗ {row.errors[0]}{row.errors.length > 1 && ` +${row.errors.length - 1}`}
                                  </span>
                                )
                              }
                            </td>
                            {rawHeaders.map((_, ci) => fieldMap[ci] ? (
                              <td key={ci} className="px-3 py-2 text-gray-700 dark:text-slate-300 max-w-[120px] truncate">
                                {String(row.raw[fieldMap[ci]] ?? '')}
                              </td>
                            ) : null)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Advertencia si hay filas con errores */}
              {invalid.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    <strong>⚠️ {invalid.length} fila{invalid.length !== 1 ? 's' : ''} con errores</strong> serán omitidas.
                    Solo se importarán las <strong>{valid.length} válidas</strong>.
                    Puedes corregir el archivo y cargar nuevamente.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: IMPORTING ──────────────────────────────────────────── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
              <div className="text-5xl animate-bounce">📥</div>
              <div className="w-full max-w-xs">
                <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-2">
                  <span>Importando {cfg.label}...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-300 ${colors.btn}`}
                    style={{ width: `${progress}%` }}/>
                </div>
              </div>
              <p className="text-sm text-gray-400 dark:text-slate-500">Por favor espera...</p>
            </div>
          )}

          {/* ── STEP: DONE ───────────────────────────────────────────────── */}
          {step === 'done' && (
            <div className="space-y-4">
              <div className="text-center py-6">
                <div className="text-5xl mb-4">{results.ok > 0 ? '✅' : '❌'}</div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
                  {results.ok > 0 ? 'Importación completada' : 'Ningún registro importado'}
                </h3>
                {results.ok > 0 && (
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                    <strong className="text-green-600 dark:text-green-400">{results.ok} registro{results.ok !== 1 ? 's' : ''}</strong> importados exitosamente
                  </p>
                )}
              </div>

              {results.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                    {results.errors.length} registro{results.errors.length !== 1 ? 's' : ''} fallidos:
                  </p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {results.errors.map((e, i) => (
                      <li key={i} className="text-xs text-red-600 dark:text-red-400">
                        Fila {e.rowIndex}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-slate-700 shrink-0">
          {step === 'upload' && (
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
              Cancelar
            </button>
          )}

          {step === 'preview' && (
            <>
              <button onClick={() => { setStep('upload'); setRows([]); setFileName('') }}
                className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
                ← Cargar otro archivo
              </button>
              <button onClick={handleImport} disabled={valid.length === 0}
                className={`flex-1 py-2.5 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colors.btn}`}>
                Importar {valid.length} registro{valid.length !== 1 ? 's' : ''} →
              </button>
            </>
          )}

          {step === 'done' && (
            <button onClick={onClose}
              className={`flex-1 py-2.5 text-white rounded-lg text-sm font-medium ${colors.btn}`}>
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
