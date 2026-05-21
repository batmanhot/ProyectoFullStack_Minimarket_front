# Pendientes — Fase Backend Django + Features Frontend anticipables

> Documento generado: 2026-05-19
> Contexto: Sistema POS Minimarket — Frontend React (Vite + Zustand + Tailwind)

---

## Estado actual del frontend (resumen sesiones)

- ✅ `ProductKardex` aplica `costMethod` (PEPS/CPP) usando `getUnitCost` de helpers
- ✅ `getUnitCost` extraída a `src/shared/utils/helpers.js` — fuente única de verdad
- ✅ Kardex y Reporte "Inventario Valorizado" usan la misma función → valores coinciden
- ✅ Variantes de producto — 100% frontend (tab en Catálogo, selector en POS, stock por variante)
- ✅ Módulo SUNAT/Comprobantes — 100% UI lista para conectar backend
- ✅ Boleta/Factura en panel de cobro y en ticket de venta
- ✅ Devoluciones con soporte de variantes
- ✅ Maestro de Ubicaciones — `locationSlice`, pestaña en Settings, dropdown en Catálogo, badge en Inventario

---

## 6 Features pendientes — Diagnóstico completo

### 1. Control de Almacén vs Góndola (Transferencias internas)

| | |
|---|---|
| **Frontend hoy** | ✅ 70% — maestro de ubicaciones completo; `location` como dropdown en Catálogo; badge en Inventario |
| **Backend** | ⏳ Pendiente — modelos, endpoints y stock dividido por ubicación |
| **Riesgo** | Crítico para negocios con depósito físico separado |

**✅ Frontend completado (2026-05-20):**
- `locationSlice.js` — CRUD de ubicaciones (addLocation, updateLocation, deleteLocation) con audit log
- Settings → pestaña **Ubicaciones** — alta/baja/edición/activación de ubicaciones físicas
- Catálogo → campo `location` pasa de texto libre a **dropdown** del maestro; fallback a texto si el maestro está vacío
- Inventario → badge de ubicación con estilo diferenciado: azul = maestro / gris = texto legado
- Renombrar una ubicación propaga automáticamente el cambio a todos los productos asignados
- Eliminar una ubicación valida que no tenga productos asignados antes de borrar

**⏳ Backend necesita implementar (Django):**
- Modelo `Location` con FK `tenant` — campos: `id`, `name`, `description`, `isActive`
- Cambiar `product.location` (string) → `product.locationId` (FK a Location)
- Modelo `StockTransfer`: origen, destino, producto, cantidad, estado (`pendiente/confirmada/anulada`), usuario, fecha
- `GET  /locations` — listar ubicaciones del tenant
- `POST /locations` — crear ubicación
- `PATCH /locations/{id}` — editar / desactivar
- `DELETE /locations/{id}` — eliminar (validar que no tenga products ni transfers pendientes)
- `POST /inventory/transfers` — registrar transferencia entre ubicaciones
- `GET  /inventory/transfers` — historial con filtros por ubicación/producto/fecha
- `PATCH /inventory/transfers/{id}/confirm` — confirmar transferencia (descuenta origen, suma destino atómicamente)
- `PATCH /inventory/transfers/{id}/cancel` — anular
- Stock del producto pasa a `ProductLocation (productId, locationId, quantity, batches)` — stock total = suma de todas las ubicaciones
- Cuando esté listo: el frontend conecta `locationSlice` a los endpoints REST en vez de localStorage

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
| **Frontend hoy** | ✅ 100% UI lista — módulo Comprobantes implementado (2026-05-20) |
| **Backend** | 0% — pendiente de implementar |
| **Riesgo** | CRÍTICO LEGAL — sin esto el sistema no es válido ante SUNAT |

**✅ Frontend completado (2026-05-20):**
- Campo `sunatStatus` en ventas: `pendiente / enviado / aceptado / rechazado / error_sunat`
- Campo `tipoComprobante`: `boleta` (cliente DNI o sin cliente) / `factura` (cliente con RUC)
- Módulo "Comprobantes" en menú → ruta `comprobantes`
- KPIs: conteo por estado con colores
- Tabla con filtros por estado, tipo, fecha y búsqueda
- Botón "Reintentar" visible para rechazados (desactivado hasta backend)
- Acceso al ticket de venta desde la lista

**⏳ Backend necesita implementar (Django):**
- Credenciales SUNAT por tenant: RUC, clave SOL, certificado digital `.pfx`
- Generación y firma del XML UBL 2.1 (Boleta: `01`, Factura: `03`)
- `POST /sunat/cpe/emit` — enviar comprobante, devuelve `{ sunatStatus, cdrUrl, sunatCode, sunatMessage }`
- `GET /sunat/cpe/status/{saleId}` — consultar estado actual en SUNAT
- Cola asíncrona Celery + Redis para reintentos automáticos (hasta 3 intentos con backoff)
- Almacenamiento del CDR (Constancia de Recepción) y hash SHA-256 del XML
- Webhook o polling para actualizar `sunatStatus` en el frontend
- Cuando el backend esté listo: conectar el botón "Reintentar" de `Comprobantes.jsx` al endpoint `POST /sunat/cpe/emit`
- Generar código QR oficial SUNAT (URL de consulta con hash) e inyectarlo en `SaleTicket.jsx`

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

---

## Alertas por correo electrónico — Pendiente de backend

| | |
|---|---|
| **Frontend hoy** | ✅ Campo `businessConfig.email` implementado en Settings → Negocio (2026-05-20) |
| **Backend** | ❌ Pendiente — el envío real requiere servidor |

**⏳ Backend necesita implementar (Django):**
- Endpoint `POST /notifications/email` que reciba `{ to, subject, body }` y envíe vía SMTP / SendGrid / AWS SES
- Configuración de credenciales SMTP por tenant (host, port, user, password)
- Al detectar alertas críticas (`sin_stock`, `producto_vencido`, `caja_diferencia`) → disparar email automático al `businessConfig.email` del tenant
- Resumen diario programado (Celery beat): enviar consolidado de alertas activas a las 8am
- Cuando esté listo: en `src/features/alerts/Alerts.jsx` función `detectAlerts()`, reemplazar el toast actual por una llamada al endpoint de email para alertas de severidad `alta`

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
