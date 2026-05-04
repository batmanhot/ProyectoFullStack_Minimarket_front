# Guía de integración — Módulo de Devoluciones

## Archivos nuevos que debes crear

```
src/features/returns/
├── Returns.jsx                      ← Módulo principal
└── components/
    └── CreditNoteModal.jsx          ← Vista previa + impresión 80mm
```

---

## 1. Store — `src/store/index.js`

Busca el bloque de `discountTickets` y agrega el slice de devoluciones
**inmediatamente después** del método `redeemDiscountTicket`:

```js
// ── DEVOLUCIONES / NOTAS DE CRÉDITO ──────────────────────────────────────────
returns: [],

addReturn: (creditNote) => {
  get().addAuditLog({
    action: 'CREATE', module: 'Devoluciones',
    detail: `NC ${creditNote.ncNumber} · Boleta ${creditNote.invoiceNumber} · S/${creditNote.totalRefund}`,
    entityId: creditNote.id,
  })
  set((s) => ({ returns: [creditNote, ...s.returns] }))
},

updateReturn: (id, updates) => {
  get().addAuditLog({
    action: 'UPDATE', module: 'Devoluciones',
    detail: `NC actualizada: ID ${id}`, entityId: id,
  })
  set((s) => ({ returns: s.returns.map(r => r.id === id ? { ...r, ...updates } : r) }))
},

anularReturn: (id, motivo) => {
  get().addAuditLog({
    action: 'CANCEL', module: 'Devoluciones',
    detail: `NC anulada: ID ${id} · ${motivo}`, entityId: id,
  })
  set((s) => ({
    returns: s.returns.map(r => r.id === id
      ? { ...r, status: 'anulada', anuladaAt: new Date().toISOString(), anuladaMotivo: motivo }
      : r
    )
  }))
},
```

En la sección `partialize`, agrega `returns: s.returns,`:

```js
partialize: (s) => ({
  // ... los campos existentes ...
  discountCampaigns: s.discountCampaigns,
  discountTickets:   s.discountTickets,
  returns:           s.returns,          // ← AGREGA ESTA LÍNEA
}),
```

Al final del archivo agrega el selector:

```js
export const selectTodayReturns = (s) => {
  const today = new Date().toDateString()
  return (s.returns || []).filter(r =>
    new Date(r.createdAt).toDateString() === today && r.status !== 'anulada'
  )
}
```

---

## 2. App.jsx — `src/App.jsx`

### 2a. Importar el componente (lazy)

```js
// Después de la línea de Tickets:
const Tickets  = lazy(() => import('./features/tickets/Tickets'))
const Returns  = lazy(() => import('./features/returns/Returns'))   // ← AGREGA
```

### 2b. Registrar en el mapa de páginas

```js
const PAGES = {
  dashboard: Dashboard, pos: POS,
  catalog: Catalog, inventory: Inventory,
  suppliers: Suppliers, purchases: Purchases,
  cash: Cash, clients: Clients, reports: Reports,
  users: Users, audit: Audit, alerts: Alerts,
  discounts: Discounts, tickets: Tickets,
  returns: Returns,          // ← AGREGA
  settings: Settings,
}
```

---

## 3. Sidebar — `src/shared/components/ui/Sidebar.jsx`

Busca el grupo `'Comercial'` y agrega la entrada `returns`:

```js
{ label: 'Comercial', items: [
  { key: 'cash',      label: 'Caja',                 icon: '💰' },
  { key: 'clients',   label: 'Clientes',              icon: '👥' },
  { key: 'reports',   label: 'Reportes',              icon: '📈' },
  { key: 'discounts', label: 'Gestion Descuentos',    icon: '🏷️' },
  { key: 'tickets',   label: 'Descuentos por Vales',  icon: '🎟️' },
  { key: 'returns',   label: 'Devoluciones',          icon: '↩️' },  // ← AGREGA
]},
```

---

## 4. Permisos — `src/config/app.js`

Agrega `'returns'` a las páginas de cada rol que deba tener acceso:

```js
admin: {
  pages: [..., 'discounts', 'tickets', 'returns', 'settings'],
},
gerente: {
  pages: [..., 'discounts', 'tickets', 'returns'],
},
supervisor: {
  pages: [..., 'discounts', 'tickets', 'returns'],
},
cajero: {
  pages: ['dashboard', 'pos', 'cash', 'returns'],   // cajero SÍ puede hacer devoluciones
},
```

---

## Resumen de cambios por archivo

| Archivo | Tipo | Cambio |
|---|---|---|
| `src/features/returns/Returns.jsx` | NUEVO | Módulo completo |
| `src/features/returns/components/CreditNoteModal.jsx` | NUEVO | Modal NC + impresión |
| `src/store/index.js` | MODIFICAR | Slice `returns`, `addReturn`, `updateReturn`, `anularReturn`, partialize, selector |
| `src/App.jsx` | MODIFICAR | Import lazy + PAGES |
| `src/shared/components/ui/Sidebar.jsx` | MODIFICAR | Entrada nav `returns` |
| `src/config/app.js` | MODIFICAR | Permisos por rol |

---

## Flujo de datos de una devolución

```
Cliente presenta ticket
        ↓
Cajero busca por N° boleta (B001-000001)
        ↓
Returns.jsx localiza la venta en sales[]
        ↓
Muestra ítems con cantidad devolvible
(descuenta NCs previas sobre la misma venta)
        ↓
Cajero selecciona ítems + motivo
        ↓
handleConfirm() calcula monto neto pagado
(respeta descuentos originales de la venta)
        ↓
addReturn(nc)          → guarda NC en returns[]
updateProduct(...)     → restaura stock
updateSale(...)        → status: 'dev-parcial' | 'devolucion'
addAuditLog(...)       → registro de auditoría
        ↓
CreditNoteModal        → vista previa + impresión 80mm
```

---

## Lógica de cálculo del reembolso

El monto reembolsado se calcula sobre lo que el cliente **realmente pagó**,
no sobre el precio de lista:

```
netUnitPrice = (quantity × unitPrice - descuentos) / quantity
reembolso    = netUnitPrice × cantidad_devuelta
```

Ejemplo:
- Cliente compró 3 Arroz @ S/9.90 = S/29.70
- Con descuento 2×1: pagó S/19.80 → netUnitPrice = S/6.60
- Devuelve 1 unidad → reembolso = S/6.60 (no S/9.90)
