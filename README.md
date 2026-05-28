# 🛒 Minimarket POS Frontend

Aplicación web de **Punto de Venta (POS)** para minimarkets y comercios retail de proximidad. Este frontend centraliza operaciones clave como ventas en caja, inventario, caja/arqueo, compras, clientes, reportes y descuentos, con una interfaz moderna construida para velocidad operativa y escalabilidad modular.

---

## 🧰 Stack Tecnológico

### Frontend
- **React 19** (`react`, `react-dom`)
- **Vite 7** (bundler y entorno de desarrollo)
- **React Router DOM 7** (enrutamiento)
- **Tailwind CSS 3** + **PostCSS** + **Autoprefixer** (estilos)

### Estado, formularios y validación
- **Zustand** (estado global)
- **React Hook Form**
- **Zod** + `@hookform/resolvers`

### Servicios y utilidades
- **Axios** (HTTP client)
- **decimal.js** (precisión en cálculos)
- **react-hot-toast** (notificaciones)

### Reportería y documentos
- **Recharts** (gráficos)
- **xlsx** (importación/exportación Excel)
- **jsPDF** + **html2canvas** (generación de PDF)

### Tooling de desarrollo
- **ESLint 9**
- **@vitejs/plugin-react**
- **Playwright** (testing/e2e tooling instalado en el proyecto)

---

## ✨ Características Principales (Features)

- Módulo de **POS** con flujo de venta, carrito y emisión de ticket.
- **Gestión de caja**: apertura/cierre, arqueo y reportes de turno.
- **Catálogo e inventario**: productos, stock, toma de inventario y mermas.
- **Compras, proveedores y clientes** para operación comercial integral.
- **Descuentos y campañas** (tickets promocionales y reglas de aplicación).
- **Devoluciones**, **cotizaciones** y **trazabilidad/auditoría**.
- **Dashboard y reportes** con métricas operativas.
- Soporte de capacidades **PWA** (Service Worker, offline fallback, instalación).

---

## ✅ Requisitos Previos

Instala lo siguiente en tu entorno local:

- **Node.js** (recomendado: **v20 LTS** o superior)
- **npm** (incluido con Node.js, recomendado npm 10+)
- **Git** (para clonar el repositorio)

> Este repositorio corresponde al **frontend**. No incluye motor de base de datos ni servicio backend embebido.

---

## 🏗️ Arquitectura del Proyecto

Estructura principal (resumen):

- `src/main.jsx`: punto de entrada de la app.
- `src/App.jsx`: composición principal de vistas/rutas.
- `src/features/`: módulos funcionales por dominio (POS, inventario, reportes, etc.).
- `src/services/`: capa de acceso a API y servicios HTTP.
- `src/store/`: estado global y slices de dominio.
- `src/shared/`: componentes, hooks, utilidades y esquemas reutilizables.
- `src/config/`: configuración de app y parámetros de entorno.
- `public/`: assets estáticos, `sw.js`, `offline.html`, íconos PWA.

Patrón general:
- **Arquitectura modular por features**, con separación de UI, lógica compartida y capa de servicios.
- Preparado para alternar entre modo mock/local y consumo de API vía variables de entorno.

---

## ⚙️ Configuración e Instalación

### 1) Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd minimarket
```

### 2) Instalar dependencias

```bash
npm install
```

### 3) Configurar variables de entorno (`.env`)

Crea un archivo `.env` en la raíz del proyecto con valores base:

```env
VITE_COMPANY_NAME=Mi Negocio
VITE_COMPANY_RUC=20000000000
VITE_COMPANY_ADDRESS=Av. Principal 123
VITE_COMPANY_PHONE=01-000-0000
VITE_USE_API=false
VITE_API_URL=http://localhost:3000/api
```

### 4) Ejecutar migraciones (si aplica)

```bash
# No aplica en este repositorio (frontend).
# Las migraciones se ejecutan en el proyecto backend correspondiente.
```

### 5) Iniciar servidor en modo desarrollo

```bash
npm run dev
```

La app corre con Vite en:

- **http://localhost:3000**

---

## 📜 Scripts Disponibles

| Script | Comando | Descripción |
|---|---|---|
| `dev` | `npm run dev` | Inicia el servidor de desarrollo con Vite (HMR). |
| `build` | `npm run build` | Genera el build de producción. |
| `preview` | `npm run preview` | Levanta una vista previa del build generado. |
| `lint` | `npm run lint` | Ejecuta análisis estático con ESLint. |
| `build:pwa` | `npm run build:pwa` | Build de producción + post-proceso PWA (`scripts/post-build.js`). |

---

## 📌 Notas Operativas

- El proyecto está enfocado en frontend SPA para operación POS retail.
- La integración con backend se controla por `VITE_USE_API` y `VITE_API_URL`.
- Los recursos PWA y offline están en `public/sw.js` y `public/offline.html`.
