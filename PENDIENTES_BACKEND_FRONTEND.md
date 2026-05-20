# Pendientes — Fase Backend Django + Features Frontend anticipables

> Documento generado: 2026-05-19
> Contexto: Sistema POS Minimarket — Frontend React (Vite + Zustand + Tailwind)

---

## Estado actual del frontend (resumen sesión)

Antes de entrar a los pendientes, en esta sesión se completaron:

- ✅ `ProductKardex` aplica `costMethod` (PEPS/CPP) usando `getUnitCost` de helpers
- ✅ `getUnitCost` extraída a `src/shared/utils/helpers.js` — fuente única de verdad
- ✅ Kardex y Reporte "Inventario Valorizado" usan la misma función → valores coinciden
- ✅ `systemConfig` agregado al destructuring de `useStore()` en `Inventory.jsx`

---

## 6 Features pendientes — Diagnóstico completo

### 1. Control de Almacén vs Góndola (Transferencias internas)

| | |
|---|---|
| **Frontend hoy** | 0% — solo existe campo `location` en schema (sin UI) |
| **Backend** | 0% — sin modelos ni endpoints |
| **Riesgo** | Crítico para negocios con depósito físico separado |

**Backend necesita:**
- Modelo `Location` (almacén central, góndola 1, góndola 2…)
- Modelo `StockTransfer` con origen, destino, productos, cantidades, estado
- `POST /inventory/transfers`
- Stock del producto pasa a tener **stock por ubicación**

**Frontend puede adelantar (SIN backend):**
- Ajustes → gestionar ubicaciones con store local
- Inventario → mostrar stock desglosado por ubicación
- Módulo Transferencias → formulario + historial con Zustand/localStorage
- Kardex → campo `locationFrom / locationTo` en movimientos

---

### 2. Reserva de stock para múltiples cajas simultáneas

| | |
|---|---|
| **Frontend hoy** | 0% — stock se descuenta al confirmar venta, sin reserva previa |
| **Backend** | 0% |
| **Riesgo** | CRÍTICO — stock negativo posible en uso real multi-caja |

**Backend necesita:**
- `POST /carts/{id}/reserve` — reserva temporal con TTL 30 min
- `POST /carts/{id}/commit` — consume la reserva al confirmar
- Liberación automática de reservas expiradas
- Gestión de conflictos entre cajas

**Frontend puede adelantar:** ❌ Nada — el problema es concurrencia entre usuarios reales, es 100% backend.

---

### 3. Control por número de serie — Validación única en BD

| | |
|---|---|
| **Frontend hoy** | 30% — motor de inventario asigna/limpia serial, trazabilidad registra movimiento |
| **Backend** | Vacío — sin índice UNIQUE ni validación |
| **Riesgo** | Alto — serie podría repetirse en conflictos offline |

**Backend necesita:**
- Índice UNIQUE en BD: `(tenantId, serialNumber)`
- `GET /products/serial/{serial}` — verificar disponibilidad
- Constraint en ventas para rechazar duplicados

**Frontend puede adelantar (SIN backend):**
- Compras → al recibir con `stockControl = serie`, pedir un serial por unidad (lista dinámica)
- Catálogo → ver/editar seriales registrados por producto
- POS → mostrar serial asignado al vender, permitir escanear para confirmar
- Validación de unicidad contra store local (backend agrega la capa final)

---

### 4. Cola SUNAT asíncrona — Emisión electrónica real

| | |
|---|---|
| **Frontend hoy** | 0% operativo — solo template visual del ticket |
| **Backend** | 0% |
| **Riesgo** | CRÍTICO LEGAL — sin esto el sistema no es válido ante SUNAT |

**Backend necesita:**
- Credenciales SUNAT (RUC, clave SOL, certificado digital)
- Generación + firma de XML en formato UBL 2.1
- Cola asíncrona (Celery + Redis) para reintentos
- `POST /sunat/cpe/emit`, `GET /sunat/cpe/status/{id}`
- Almacenamiento de CDR (Constancia de Recepción)

**Frontend puede adelantar (SIN backend):**
- Estados del comprobante: `pendiente / enviado / aceptado / rechazado / error_sunat`
- Cola visual en módulo "Comprobantes" con estado por boleta/factura
- Acción "Reintentar emisión" para rechazados
- Generación del XML UBL 2.1 en frontend (formateo de datos — ya existen todos los campos)

---

### 5. Variantes de producto (tallas/colores)

| | |
|---|---|
| **Frontend hoy** | 50% — modelo `productVariants` en store, schema con `attributes`, carrito acepta `variantId` |
| **Backend** | Vacío — sin endpoints ni tabla de variantes |
| **Riesgo** | Medio — bloquea mercado boutique/zapatería/óptica |

**Backend necesita:**
- Tabla `ProductVariant` vinculada a `Product`
- `GET/POST /products/{id}/variants`
- Stock por variante (no solo por producto padre)
- SKU/barcode único por combinación producto+variante

**Frontend puede adelantar (SIN backend) → puede quedar 100% funcional:**
- Catálogo → pestaña "Variantes" en formulario de producto (agregar/editar con talla, color, SKU, precio, stock)
- POS → selector de variante al agregar al carrito (chips o dropdown)
- Inventario → stock desglosado por variante
- Compras → ingresar cantidad por variante al recibir

---

### 6. Sincronización offline-first

| | |
|---|---|
| **Frontend hoy** | 40% — SW configurado (caché assets, Network-First/Cache-First), hook detecta online/offline. `syncPendingSales()` es función vacía |
| **Backend** | 0% |
| **Riesgo** | Alto — POS cae si se corta internet durante una venta |

**Backend necesita:**
- `POST /sync/pending-sales` — recibe lote de ventas offline
- Resolución de conflictos (stock ya vendido por otra caja)

**Frontend puede adelantar (SIN backend):**
- **IndexedDB**: persistir carrito activo, carritos suspendidos y catálogo para sobrevivir cierre de navegador
- **Cola de ventas pendientes**: guardar venta en cola local cuando está offline
- **Banner de sincronización**: "3 ventas pendientes de sincronizar" al volver online
- Llenar `syncPendingSales()` con lógica IndexedDB → listo para conectar endpoint

---

## Orden de trabajo recomendado (Frontend anticipado)

| # | Feature | Esfuerzo | Valor | Estado actual |
|---|---|---|---|---|
| 1 | **Variantes (tallas/colores)** | Medio | Alto — abre boutique/zapatería | 50% listo |
| 2 | **Almacén vs Góndola (UI)** | Medio | Medio — negocios con depósito | 0% |
| 3 | **Series — UI completa** | Bajo | Alto — motor ya funciona | 30% |
| 4 | **Offline — IndexedDB** | Alto | Crítico confiabilidad POS | 40% |
| 5 | **SUNAT — estados/cola UI** | Bajo | Medio — módulo listo para conectar | 0% |

---

## Próxima sesión — Por dónde empezar

**Recomendación:** empezar por **Variantes de producto** porque:
1. Ya tiene el 50% del modelo de datos implementado en el store
2. El carrito ya acepta `variantId`
3. Es el que más mercado abre (boutique, zapatería, óptica, ropa)
4. Puede quedar 100% funcional sin esperar backend

**Alternativa rápida:** completar **Control por Serie** (3) — es el más rápido (el motor ya existe, solo falta UI en Compras, Catálogo y POS).

---

## Notas técnicas para el Backend Django

- Arquitectura SaaS multitenant: path-based `/app/:tenantSlug`, todos los modelos deben incluir `tenant` FK
- Frontend usa Zustand con localStorage — al integrar backend, los slices se convierten en llamadas a la API REST
- Método de costeo (`peps` / `cpp`) ya está en `systemConfig` del frontend — el backend debe respetarlo al calcular valorización
- `getUnitCost(product, fallbackPrice, costMethod)` en `src/shared/utils/helpers.js` es la referencia de la fórmula que debe replicar el backend
- Devoluciones NUNCA van a merma — son conceptualmente distintos aunque operativamente coincidan (decisión contable ya registrada)
