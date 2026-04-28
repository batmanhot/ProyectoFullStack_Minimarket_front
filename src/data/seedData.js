import { subtractDays, formatInvoice } from '../shared/utils/helpers'

// ─── PROVEEDORES ──────────────────────────────────────────────────────────────
export const SEED_SUPPLIERS = [
  { id: 'sup-001', name: 'Alicorp S.A.A.',          contact: 'Carlos Ríos',    phone: '01-315-0800', email: 'ventas@alicorp.com.pe',    taxId: '20100055237', isActive: true, createdAt: subtractDays(120) },
  { id: 'sup-002', name: 'Backus & Johnston',        contact: 'María Flores',   phone: '01-213-0000', email: 'dist@backus.pe',           taxId: '20100008658', isActive: true, createdAt: subtractDays(115) },
  { id: 'sup-003', name: 'Gloria S.A.',              contact: 'Juan Paredes',   phone: '054-386-100', email: 'ventas@gloria.com.pe',     taxId: '20100190797', isActive: true, createdAt: subtractDays(110) },
  { id: 'sup-004', name: 'Procter & Gamble Perú',   contact: 'Ana Castillo',   phone: '01-612-0000', email: 'ventas.pe@pg.com',         taxId: '20100012965', isActive: true, createdAt: subtractDays(100) },
  { id: 'sup-005', name: 'Distribuidora Lima Norte', contact: 'Pedro Sánchez',  phone: '01-527-4400', email: 'pedidos@disnorte.pe',      taxId: '20456789012', isActive: true, createdAt: subtractDays(90)  },
]

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────────
export const SEED_CATEGORIES = [
  { id: 'cat-001', name: 'Abarrotes',       description: 'Productos de primera necesidad' },
  { id: 'cat-002', name: 'Bebidas',         description: 'Gaseosas, jugos y agua' },
  { id: 'cat-003', name: 'Lácteos',         description: 'Leche, yogurt, queso y mantequilla' },
  { id: 'cat-004', name: 'Limpieza',        description: 'Productos de limpieza del hogar' },
  { id: 'cat-005', name: 'Snacks',          description: 'Galletas, golosinas y aperitivos' },
  { id: 'cat-006', name: 'Panadería',       description: 'Pan y productos horneados' },
  { id: 'cat-007', name: 'Higiene personal',description: 'Jabón, shampoo y cuidado personal' },
]

// ─── PRODUCTOS (con nuevos campos) ────────────────────────────────────────────
const p = (id, barcode, name, desc, catId, supId, buy, sell, stock, stockMin, unit, extra = {}) => ({
  id, barcode, name, description: desc, categoryId: catId, supplierId: supId,
  priceBuy: buy, priceSell: sell, stock, stockMin, stockMax: stockMin * 12,
  unit: unit || 'unidad', hasVariants: false, expiryDate: null, serialNumber: '',
  location: '', attributes: {}, sku: '', brand: '', isActive: true,
  createdAt: subtractDays(90), ...extra,
})

const futureDate = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0] }

export const SEED_PRODUCTS = [
  // ABARROTES
  p('prd-001','7751010012459','Arroz Costeño Extra 5kg','Arroz extra calidad premium','cat-001','sup-001',15.50,19.90,42,10),
  p('prd-002','7750282010052','Aceite Primor 1L','Aceite vegetal de girasol','cat-001','sup-001',6.80,9.50,28,8),
  p('prd-003','7751151000013','Azúcar Rubia 1kg','Azúcar rubia refinada','cat-001','sup-005',3.20,4.50,55,15),
  p('prd-004','7750130100019','Sal Marina Emsal 1kg','Sal yodada de mesa','cat-001','sup-005',1.10,1.80,70,20),
  p('prd-005','7750282003269','Fideos Don Vittorio Spag 500g','Fideos de trigo semolado','cat-001','sup-001',2.80,4.20,38,10),
  p('prd-007','7750282041032','Mayonesa Alacena 500g','Mayonesa con limón','cat-001','sup-001',5.90,8.50,18,6),
  p('prd-008','7750282041049','Mayonesa Alacena 1kg','Mayonesa familiar','cat-001','sup-001',10.50,14.90,4,5), // stock bajo
  p('prd-010','7750003440010','Avena Quaker 400g','Avena integral hojuelas','cat-001','sup-005',3.80,5.90,22,8),
  // BEBIDAS
  p('prd-011','7751537100010','Inca Kola 500ml','Gaseosa original','cat-002','sup-002',1.80,2.50,96,24),
  p('prd-012','7751537100027','Inca Kola 1.5L','Gaseosa familiar','cat-002','sup-002',4.20,5.90,48,12),
  p('prd-013','7751537200016','Coca-Cola 500ml','Gaseosa cola clásica','cat-002','sup-002',1.80,2.50,84,24),
  p('prd-014','7751537200023','Coca-Cola 1.5L','Gaseosa cola familiar','cat-002','sup-002',4.20,5.90,36,12),
  p('prd-016','7750282100401','Agua San Luis 625ml','Agua mineral sin gas','cat-002','sup-005',0.90,1.50,120,36),
  p('prd-017','7750282100418','Agua San Luis 2.5L','Agua mineral familiar','cat-002','sup-005',2.20,3.50,72,18),
  p('prd-018','7750282060552','Frugos Naranja 1L','Jugo de naranja néctar','cat-002','sup-001',3.50,5.20,3,10, null, { expiryDate: futureDate(8) }), // próximo a vencer
  p('prd-019','7750282060569','Frugos Durazno 1L','Jugo de durazno néctar','cat-002','sup-001',3.50,5.20,24,10, null, { expiryDate: futureDate(45) }),
  // LÁCTEOS
  p('prd-021','7790168000027','Leche Gloria Entera 1L','Leche fresca UHT','cat-003','sup-003',3.80,5.20,60,18, null, { expiryDate: futureDate(25) }),
  p('prd-022','7790168000034','Leche Gloria Semidesg 1L','Leche semidescremada','cat-003','sup-003',3.90,5.50,30,12, null, { expiryDate: futureDate(20) }),
  p('prd-023','7790168010019','Yogurt Gloria Fresa 1kg','Yogurt frutado fresa','cat-003','sup-003',5.20,7.50,2,8, null, { expiryDate: futureDate(5) }), // stock bajo + por vencer
  p('prd-024','7790168010026','Yogurt Gloria Natural 1kg','Yogurt natural','cat-003','sup-003',5.20,7.50,14,8, null, { expiryDate: futureDate(15) }),
  p('prd-025','7790168020018','Mantequilla Gloria 200g','Mantequilla sin sal','cat-003','sup-003',4.50,6.90,18,6),
  // LIMPIEZA
  p('prd-027','7750195000016','Detergente Ariel 2.5kg','Detergente en polvo','cat-004','sup-004',18.50,25.90,16,6),
  p('prd-028','7750195000023','Detergente Ariel 1kg','Detergente polvo 1kg','cat-004','sup-004',8.50,12.50,24,8),
  p('prd-029','7750195010015','Lejía Clorox 1L','Lejía desinfectante','cat-004','sup-004',3.20,4.90,30,10),
  p('prd-030','7750195020014','Lavavajillas Ayudín 500g','Lavavajillas en crema','cat-004','sup-004',2.80,4.20,22,8),
  p('prd-031','7750195030013','Suavizante Downy 1.5L','Suavizante floral','cat-004','sup-004',9.80,14.90,3,6), // stock bajo
  p('prd-032','7750195040012','Papel Higiénico Elite 4u','Doble hoja suave','cat-004','sup-005',4.50,6.90,48,12),
  // SNACKS
  p('prd-033','7750282200201','Papas Lays Clásicas 42g','Papas fritas original','cat-005','sup-001',1.50,2.50,60,20),
  p('prd-034','7750282200218','Papas Lays BBQ 42g','Papas fritas BBQ','cat-005','sup-001',1.50,2.50,55,20),
  p('prd-036','7750282210200','Galleta Oreo 36g','Galleta chocolate crema','cat-005','sup-001',1.20,2.00,72,24),
  p('prd-038','7750282210224','Chocolate Sublime 30g','Chocolate con maní','cat-005','sup-001',1.00,1.80,84,30),
  // HIGIENE
  p('prd-044','7750195100013','Shampoo H&S 375ml','Shampoo anticaspa','cat-007','sup-004',12.50,18.90,14,5),
  p('prd-045','7750195100020','Shampoo Pantene 400ml','Shampoo reparación','cat-007','sup-004',13.50,20.50,2,5), // stock bajo
  p('prd-046','7750195110012','Jabón Camay 90g','Jabón floral','cat-007','sup-004',1.80,2.90,48,15),
  p('prd-048','7750195120011','Desodorante Rexona Men 90g','Desodorante hombre','cat-007','sup-004',8.50,13.90,18,6),
  p('prd-050','7750195130010','Pasta Dental Colgate 75ml','Crema dental flúor','cat-007','sup-004',4.80,7.50,0,8), // sin stock
  p('prd-052','7750195140019','Pañales Huggies M x20','Pañales talla M','cat-007','sup-004',22.50,32.90,8,4),
]

// ─── CLIENTES ─────────────────────────────────────────────────────────────────
export const SEED_CLIENTS = [
  { id: 'cli-001', name: 'Rosa Quispe Mamani',         documentType: 'DNI', documentNumber: '47832156', phone: '987654321', email: 'rquispe@gmail.com',      address: 'Jr. Las Rosas 234, Los Olivos',     creditLimit: 200,  currentDebt: 0,   isActive: true, createdAt: subtractDays(60) },
  { id: 'cli-002', name: 'José Huanca Paredes',         documentType: 'DNI', documentNumber: '32145678', phone: '976543218', email: 'jhuanca@hotmail.com',    address: 'Av. Próceres 1560, SJL',           creditLimit: 500,  currentDebt: 85.50, isActive: true, createdAt: subtractDays(55) },
  { id: 'cli-003', name: 'Rest. El Buen Sabor',         documentType: 'RUC', documentNumber: '20512345678', phone: '01-523-4567', email: 'compras@buensabor.pe', address: 'Av. Universitaria 3400, Comas',  creditLimit: 2000, currentDebt: 350, isActive: true, createdAt: subtractDays(50) },
  { id: 'cli-004', name: 'María Torres Vilca',          documentType: 'DNI', documentNumber: '52341876', phone: '965432187', email: 'mtorres@gmail.com',      address: 'Calle Los Pinos 89, Puente Piedra', creditLimit: 300,  currentDebt: 0,   isActive: true, createdAt: subtractDays(45) },
  { id: 'cli-005', name: 'Bodega La Esquina S.R.L.',    documentType: 'RUC', documentNumber: '20498765432', phone: '01-567-8901', email: 'pedidos@laesquina.pe', address: 'Jr. Mercaderes 456, Independencia', creditLimit: 1500, currentDebt: 120, isActive: true, createdAt: subtractDays(40) },
  { id: 'cli-006', name: 'Luis Mendoza García',         documentType: 'DNI', documentNumber: '61234567', phone: '954321876', email: '', address: 'Av. Naranjal 789, Independencia', creditLimit: 150, currentDebt: 0, isActive: true, createdAt: subtractDays(35) },
  { id: 'cli-007', name: 'Carmen Soto Llanos',          documentType: 'DNI', documentNumber: '43218765', phone: '943218765', email: '', address: 'Calle Los Sauces 23, Los Olivos', creditLimit: 200, currentDebt: 45, isActive: true, createdAt: subtractDays(30) },
]

// ─── USUARIOS ─────────────────────────────────────────────────────────────────
export const SEED_USERS = [
  { id: 'usr-001', username: 'admin',      fullName: 'Administrador General',   email: 'admin@negocio.pe',      role: 'admin',      isActive: true, createdAt: subtractDays(120) },
  { id: 'usr-002', username: 'cajero1',    fullName: 'Rosa Sánchez López',       email: 'rsanchez@negocio.pe',   role: 'cajero',     isActive: true, createdAt: subtractDays(90)  },
  { id: 'usr-003', username: 'cajero2',    fullName: 'Jorge Torres Huanca',      email: 'jtorres@negocio.pe',    role: 'cajero',     isActive: true, createdAt: subtractDays(60)  },
  { id: 'usr-004', username: 'supervisor', fullName: 'Patricia Mendoza Gil',     email: 'pmendoza@negocio.pe',   role: 'supervisor', isActive: true, createdAt: subtractDays(100) },
  { id: 'usr-005', username: 'gerente',    fullName: 'Carlos Rimac Paredes',     email: 'crimac@negocio.pe',     role: 'gerente',    isActive: true, createdAt: subtractDays(120) },
]

// ─── VENTAS HISTÓRICAS (30 días, con payments array) ─────────────────────────
function generateSales() {
  const sales = []
  const activePrds = SEED_PRODUCTS.filter(p => p.isActive && p.stock > 0)
  const methods = ['efectivo','efectivo','efectivo','yape','plin','tarjeta','transferencia']
  const users = ['usr-002','usr-002','usr-003']
  const clients = [null,null,null,'cli-001','cli-002','cli-003']
  let invoice = 1000

  for (let dayOff = 30; dayOff >= 1; dayOff--) {
    const cnt = Math.floor(Math.random() * 14) + 4
    for (let s = 0; s < cnt; s++) {
      const items = []
      const used = new Set()
      const itemCount = Math.floor(Math.random() * 4) + 1
      for (let i = 0; i < itemCount; i++) {
        let prd
        do { prd = activePrds[Math.floor(Math.random() * activePrds.length)] }
        while (used.has(prd.id))
        used.add(prd.id)
        const qty = Math.floor(Math.random() * 3) + 1
        items.push({
          id: crypto.randomUUID(),
          productId: prd.id,
          productName: prd.name,
          barcode: prd.barcode,
          quantity: qty,
          unitPrice: prd.priceSell,
          discount: 0,
          subtotal: parseFloat((qty * prd.priceSell).toFixed(2)),
          unit: prd.unit,
        })
      }
      const total = parseFloat(items.reduce((a, i) => a + i.subtotal, 0).toFixed(2))
      const method = methods[Math.floor(Math.random() * methods.length)]
      const date = new Date()
      date.setDate(date.getDate() - dayOff)
      date.setHours(Math.floor(Math.random() * 13) + 8, Math.floor(Math.random() * 60))

      sales.push({
        id: crypto.randomUUID(),
        invoiceNumber: formatInvoice(invoice++),
        clientId: clients[Math.floor(Math.random() * clients.length)],
        userId: users[Math.floor(Math.random() * users.length)],
        items,
        subtotal: total, discount: 0, tax: parseFloat((total - total / 1.18).toFixed(2)), total,
        payments: [{ method, amount: total, reference: method !== 'efectivo' ? String(Math.floor(Math.random() * 900000) + 100000) : '' }],
        status: 'completada',
        notes: '',
        createdAt: date.toISOString(),
      })
    }
  }
  return sales
}

export const SEED_SALES = generateSales()

// ─── ESTADO INICIAL ───────────────────────────────────────────────────────────
export function getInitialDemoState() {
  return {
    suppliers:         [...SEED_SUPPLIERS],
    categories:        [...SEED_CATEGORIES],
    brands:            [...SEED_BRANDS],
    products:          SEED_PRODUCTS.map(p => ({ ...p })),
    clients:           [...SEED_CLIENTS],
    users:             [...SEED_USERS],
    sales:             SEED_SALES,
    cashSessions:      [],
    activeCashSession: null,
    cart:              [],
    currentUser:       null,
    stockMovements:    [],
    purchases:         [],
    businessConfig: {
      name: 'Mi Negocio', ruc: '', address: '', phone: '', logoUrl: '', sector: 'bodega', igvRate: 0.18,
    },
    nextInvoice: Math.max(...SEED_SALES.map(s => parseInt(s.invoiceNumber.split('-')[1] || '0'))) + 1,
  }
}

// ─── MARCAS ───────────────────────────────────────────────────────────────────
export const SEED_BRANDS = [
  { id: 'brn-001', name: 'Alicorp',       description: 'Corporación alimentaria peruana',   color: '#f97316', isActive: true, createdAt: subtractDays(120) },
  { id: 'brn-002', name: 'Gloria',        description: 'Lácteos y derivados',                color: '#3b82f6', isActive: true, createdAt: subtractDays(115) },
  { id: 'brn-003', name: 'Backus',        description: 'Bebidas y gaseosas',                 color: '#eab308', isActive: true, createdAt: subtractDays(110) },
  { id: 'brn-004', name: 'Procter & Gamble', description: 'Higiene y limpieza del hogar',   color: '#8b5cf6', isActive: true, createdAt: subtractDays(105) },
  { id: 'brn-005', name: 'Quaker',        description: 'Cereales y avenas',                  color: '#ef4444', isActive: true, createdAt: subtractDays(100) },
  { id: 'brn-006', name: 'Nestlé',        description: 'Alimentos y bebidas globales',       color: '#ec4899', isActive: true, createdAt: subtractDays(95)  },
  { id: 'brn-007', name: 'Coca-Cola',     description: 'Bebidas carbonatadas y jugos',       color: '#dc2626', isActive: true, createdAt: subtractDays(90)  },
  { id: 'brn-008', name: 'Colgate',       description: 'Higiene dental y personal',          color: '#06b6d4', isActive: true, createdAt: subtractDays(85)  },
  { id: 'brn-009', name: 'Ariel',         description: 'Detergentes y limpieza de ropa',     color: '#10b981', isActive: true, createdAt: subtractDays(80)  },
  { id: 'brn-010', name: 'Clorox',        description: 'Productos de desinfección',          color: '#f59e0b', isActive: true, createdAt: subtractDays(75)  },
  { id: 'brn-011', name: 'Huggies',       description: 'Pañales y cuidado del bebé',         color: '#6366f1', isActive: true, createdAt: subtractDays(70)  },
  { id: 'brn-012', name: 'Don Vittorio',  description: 'Pastas y fideos',                    color: '#f97316', isActive: true, createdAt: subtractDays(65)  },
  { id: 'brn-013', name: 'San Luis',      description: 'Agua mineral',                       color: '#0ea5e9', isActive: true, createdAt: subtractDays(60)  },
  { id: 'brn-014', name: 'Frugos',        description: 'Jugos y néctares de frutas',         color: '#84cc16', isActive: true, createdAt: subtractDays(55)  },
  { id: 'brn-015', name: 'Lays',          description: 'Snacks y papas fritas',              color: '#fbbf24', isActive: true, createdAt: subtractDays(50)  },
]
