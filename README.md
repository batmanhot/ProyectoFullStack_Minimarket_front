# 🛒 Sistema POS Minimarket

![Minimarket Banner](https://img.shields.io/badge/Status-In%20Development-yellow?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

Aplicación web de Punto de Venta (POS) orientada a la operación diaria de minimarkets y tiendas de retail de proximidad.  
El sistema permite administrar ventas, inventario, caja, clientes, compras y reportes desde una interfaz moderna, rápida y preparada para uso intensivo en mostrador.

---

## 📌 Descripción del proyecto

Este proyecto implementa un **sistema POS frontend** para centralizar procesos comerciales y operativos en negocios de venta minorista.  
Incluye módulos integrados para:

- Venta en caja con cálculo de totales, descuentos e impuestos.
- Gestión de catálogo e inventario con control de stock.
- Control de caja (apertura, movimientos, cierre y arqueo).
- Clientes, proveedores, compras, devoluciones y cotizaciones.
- Reportes operativos y trazabilidad de movimientos.
- Capacidades PWA para experiencia de uso mejorada.

> Nota: este repositorio corresponde al **frontend** del sistema.

---

## 🏪 Tipo de negocios objetivo

El sistema está orientado principalmente a:

- Minimarkets y bodegas.
- Tiendas de conveniencia.
- Autoservicios de barrio.
- Pequeños supermercados.
- Comercios minoristas con alto flujo de tickets.

También puede adaptarse a otros negocios retail que requieran control de inventario y venta rápida por caja.

---

## 🚀 Stack tecnológico

### Frontend y arquitectura
- **React 19** (UI basada en componentes).
- **Vite** (desarrollo y build).
- **Tailwind CSS** (estilos utilitarios).
- **Zustand** + `persist` + `subscribeWithSelector` (estado global y persistencia local).
- **React Router DOM 7** (navegación).

### Formularios, validaciones y utilidades
- **React Hook Form** + **Zod** (`@hookform/resolvers`) para formularios y validación.
- **Axios** para consumo de servicios HTTP.
- **decimal.js** para cálculos numéricos precisos.
- **react-hot-toast** para notificaciones.

### Reportes, documentos y exportación
- **Recharts** para visualización de métricas.
- **xlsx** para exportación/importación en Excel.
- **jsPDF** + **html2canvas** para generación de PDF.

### PWA
- Service Worker y recursos offline (`public/sw.js`, `public/offline.html`).
- Componente de instalación de app (`InstallPWA`).
- Indicadores de estado online/offline en la interfaz.

---

## 🔄 Procesos principales del negocio

1. **Proceso de venta en POS**
   - Búsqueda de productos por nombre/código/SKU.
   - Agregado al carrito y ajuste de cantidades.
   - Aplicación de descuentos (manuales, campañas y tickets).
   - Cálculo de subtotal bruto, descuentos, base imponible e IGV.
   - Registro de pagos y emisión de ticket.
   - Gestión de ventas en espera (hold/recover) para atención simultánea.

2. **Proceso de caja**
   - Apertura de caja por turno.
   - Registro y control de movimientos.
   - Seguimiento de ventas del turno.
   - Cierre y arqueo de caja con control de diferencias.

3. **Proceso de inventario**
   - Administración de productos y categorías.
   - Control de stock mínimo y alertas.
   - Movimientos de inventario y kardex.
   - Toma de inventario (stocktaking) y ajustes.

4. **Proceso comercial y soporte**
   - Gestión de clientes y proveedores.
   - Registro de compras.
   - Gestión de devoluciones y notas relacionadas.
   - Cotizaciones y seguimiento.

5. **Proceso de control y análisis**
   - Dashboard con indicadores clave.
   - Reportes operativos/exportables.
   - Auditoría de acciones y trazabilidad.

---

## ✨ Funcionalidades por módulo

- **Dashboard:** indicadores operativos y resumen general.
- **POS:** venta rápida, descuentos, ticketing, pagos y pantalla cliente.
- **Catálogo:** gestión de productos, categorías y datos comerciales.
- **Inventario:** stock, movimientos, kardex y toma de inventario.
- **Caja:** apertura/cierre, arqueo y control diario de efectivo.
- **Clientes:** gestión de cartera y apoyo a fidelización.
- **Proveedores:** administración de terceros de compra.
- **Compras:** registro y control de abastecimiento.
- **Descuentos y Tickets:** campañas, cupones/tickets y reglas de aplicación.
- **Devoluciones:** control de devoluciones y documentos asociados.
- **Cotizaciones:** emisión y gestión de propuestas comerciales.
- **Reportes:** análisis de ventas e inventario con exportación.
- **Usuarios y roles:** control de accesos por perfil.
- **Auditoría:** historial de eventos y acciones.
- **Merma y Trazabilidad:** control operativo para pérdidas y seguimiento.

---

## 🛠️ Instalación y ejecución local

1. **Clonar el repositorio**
   ```bash
   git clone [url-del-repositorio]
   cd minimarket
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   Crear/ajustar archivo `.env` según tu entorno:
   ```env
   VITE_API_URL=http://localhost:3000
   ```

4. **Ejecutar en desarrollo**
   ```bash
   npm run dev
   ```

5. **Build de producción**
   ```bash
   npm run build
   ```

6. **Preview de build**
   ```bash
   npm run preview
   ```

7. **Build con flujo PWA**
   ```bash
   npm run build:pwa
   ```

---

## 📁 Estructura general del proyecto

```text
src/
  features/        # módulos funcionales del negocio
  shared/          # componentes, hooks y utilidades compartidas
  store/           # estado global (Zustand + slices)
  services/        # capa de servicios
  data/            # datos semilla/demo
  config/          # configuración de app y permisos
public/
  sw.js            # service worker
  offline.html     # fallback offline
```

---

## 📄 Licencia

MIT

---

Desarrollado para digitalizar y optimizar operaciones del sector retail de proximidad.
