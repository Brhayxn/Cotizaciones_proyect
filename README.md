# 🛠️ Sistema de Cotizaciones, Punto de Venta (POS) e Inventario

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0+-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791.svg?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.io-Realtime-010101.svg?style=flat&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)

Sistema integral de **Punto de Venta (POS), Emisión de Cotizaciones, Control de Inventario y Gestión de Créditos/Abonos de Clientes**, diseñado para operar en entornos comerciales de alto tráfico como ferreterías y comercios minoristas. Integra sincronización en tiempo real vía WebSockets para pantallas secundarias orientadas al cliente y actualización instantánea de stock entre múltiples terminales de venta.

---

## 📑 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Arquitectura y Tecnologías](#-arquitectura-y-tecnologías)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación y Despliegue con Docker (Recomendado)](#-instalación-y-despliegue-con-docker-recomendado)
- [Instalación Local para Desarrollo](#-instalación-local-para-desarrollo)
  - [1. Backend (FastAPI + PostgreSQL)](#1-backend-fastapi--postgresql)
  - [2. Frontend (React + Vite)](#2-frontend-react--vite)
- [Variables de Entorno](#-variables-de-entorno)
- [Módulos del Sistema](#-módulos-del-sistema)
- [Referencia de la API REST](#-referencia-de-la-api-rest)
- [Eventos en Tiempo Real (Socket.IO)](#-eventos-en-tiempo-real-socketio)
- [Suites de Pruebas](#-suites-de-pruebas)
- [Licencia](#-licencia)

---

## ✨ Características Principales

- **Punto de Venta Ágil (POS) y Cotizador:**
  - Búsqueda reactiva de productos por nombre, código o categoría con filtrado ultrarrápido.
  - Carrito de compras en tiempo real con soporte para cantidades decimales/enteras, descuentos por ítem o globales.
  - Emisión de ventas directas o cotizaciones formales.
  - Vista e impresión de cotizaciones en formato profesional (`/cotizacion/imprimir`).
  - Múltiples medios de pago: Efectivo (con redondeo conforme a normativa), Tarjeta de Débito/Crédito, Transferencia Bancaria y Venta a Crédito.

- **Pantalla Secundaria de Cliente (Customer Display):**
  - Muestra en tiempo real al cliente (`/pantalla/:screenId`) el detalle de los productos escaneados o ingresados en caja.
  - Sincronización instantánea mediante WebSockets (Socket.IO).

- **Gestión de Clientes, Cuentas Corrientes y Abonos:**
  - Registro de clientes (RUT/DNI, razón social, teléfono, dirección, email).
  - Trazabilidad de deuda: visualización de clientes con crédito pendiente.
  - Historial de compras asociadas al cliente.
  - Registro de abonos parciales o totales con actualización automática del saldo y estado de la venta.

- **Control de Inventario y Catálogo:**
  - Administración de productos y categorías con alertas visuales de bajo stock.
  - Registro y auditoría de movimientos de inventario: Entradas (compras/abastecimiento), Salidas (ventas/mermas) y Ajustes manuales justificados.
  - Notificaciones de stock en tiempo real entre cajas abiertas.

- **Dashboard Financiero y Métricas del Negocio:**
  - Resumen en tiempo real de ventas del día, ticket promedio y cantidad de operaciones.
  - Desglose de ingresos por método de pago.
  - Métricas de cartera de deudas pendientes de cobro.
  - Historial y detalle de ventas recientes (Hoy, Última semana, Último mes) con capacidad de anulación segura de transacciones.

- **Diseño Moderno y Responsivo:**
  - Interfaz de usuario "Glassmorphism" oscura y de alta legibilidad construida con Tailwind CSS.
  - Totalmente adaptable a tablets, dispositivos táctiles POS y computadoras de escritorio.

---

## 🏛️ Arquitectura y Tecnologías

```
┌────────────────────────────────────────────────────────┐
│                   Cliente / Navegador                  │
│       React 18 + Tailwind CSS + Vite + Lucide          │
└───────────────▲────────────────────────▲───────────────┘
                │ HTTP REST              │ WebSockets (Socket.IO)
┌───────────────▼────────────────────────▼───────────────┐
│                    FastAPI (ASGI)                      │
│             Uvicorn + Python-SocketIO                  │
├────────────────────────────────────────────────────────┤
│           SQLAlchemy 2.0 (ORM) + Pydantic v2           │
└───────────────────────────▲────────────────────────────┘
                            │ PostgreSQL Wire Protocol
┌───────────────────────────▼────────────────────────────┐
│              PostgreSQL 16 (Relacional)                │
│    Tablas transaccionales: Productos, Clientes,        │
│       Ventas, Pagos/Abonos, Movimientos Inventario     │
└────────────────────────────────────────────────────────┘
```

### Tecnologías Clave:
- **Backend:** Python 3.12, [FastAPI](https://fastapi.tiangolo.com/), [SQLAlchemy 2.0](https://www.sqlalchemy.org/), [Pydantic v2](https://docs.pydantic.dev/), [python-socketio](https://python-socketio.readthedocs.io/), [Uvicorn](https://www.uvicorn.org/), `psycopg3`.
- **Frontend:** [React 18](https://react.dev/), [Vite 6](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), [Socket.IO Client](https://socket.io/docs/v4/client-api/), [Lucide React](https://lucide.dev/), [React Router DOM v6](https://reactrouter.com/), [React Hot Toast](https://react-hot-toast.com/).
- **DevOps y Calidad:** Docker, Docker Compose, Vitest, Playwright, Testing Library, Supertest.

---

## 📂 Estructura del Proyecto

```plaintext
Cotizaciones_proyect/
├── backend/
│   ├── app/
│   │   ├── core/              # Configuración (.env), base de datos y respuestas
│   │   ├── models/            # Modelos SQLAlchemy (Venta, PagoVenta, Producto, Cliente, etc.)
│   │   ├── repositories/      # Capa de acceso a datos y consultas comunes
│   │   ├── routes/            # Endpoints API (ventas, clientes, inventario, productos, categorias)
│   │   ├── schemas/           # Validaciones y DTOs con Pydantic
│   │   ├── services/          # Lógica de negocio (ventas, pagos, stock, clientes)
│   │   ├── websockets/        # Servidor y eventos Socket.IO
│   │   └── main.py            # Entrada ASGI y montaje de frontend
│   ├── pyproject.toml         # Configuración del paquete Python
│   └── requirements.txt       # Dependencias backend
├── frontend/
│   ├── src/
│   │   ├── assets/            # Recursos estáticos e imágenes
│   │   ├── components/        # Componentes UI (CartPanel, RecentSalesModal, BottomNav, etc.)
│   │   ├── config/            # Clientes de Axios y Socket.IO
│   │   ├── hooks/             # Custom hooks (debouncing, etc.)
│   │   ├── pages/             # Vistas principales (QuotePage, ClientsPage, DashboardPage, etc.)
│   │   ├── services/          # Conexión con servicios de la API
│   │   └── utils/             # Helpers de cálculo de cotizaciones y formato de moneda
│   ├── package.json           # Dependencias frontend
│   └── vite.config.js         # Configuración de compilación Vite
├── tests/                     # Suites de pruebas (backend, frontend, e2e, concurrencia, estrés)
├── Docs/                      # Documentación comercial y respaldo de valor
├── docker-compose.yml         # Orquestación de contenedores (app + db)
├── Dockerfile                 # Construcción multi-stage (Node frontend + Python backend)
└── package.json               # Scripts de desarrollo y pruebas globales
```

---

## ⚙️ Requisitos Previos

- **Para despliegue contenerizado:**
  - [Docker](https://docs.docker.com/get-docker/) y [Docker Compose](https://docs.docker.com/compose/) v2+.
- **Para desarrollo local sin Docker:**
  - [Node.js](https://nodejs.org/) v18+ y `npm`.
  - [Python](https://www.python.org/) 3.12+.
  - Servidor [PostgreSQL](https://www.postgresql.org/) 15+ (o SQLite para pruebas).

---

## 🚀 Instalación y Despliegue con Docker (Recomendado)

El proyecto incluye un `docker-compose.yml` preconfigurado con una base de datos PostgreSQL 16 y el contenedor de la aplicación empaquetado en una sola imagen optimizada multi-stage.

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/Brhayxn/Cotizaciones_proyect.git
   cd Cotizaciones_proyect
   ```

2. **Levantar los servicios:**
   ```bash
   docker compose up --build -d
   ```

3. **Acceder a la aplicación:**
   - **Frontend & API:** [http://localhost:8000](http://localhost:8000)
   - **Documentación Interactiva (Swagger/OpenAPI):** [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Métricas de Salud:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

4. **Detener los servicios:**
   ```bash
   docker compose down
   ```

---

## 💻 Instalación Local para Desarrollo

Si deseas ejecutar los servicios de forma individual en tu entorno local:

### 1. Backend (FastAPI + PostgreSQL)

1. Ingresar a la carpeta de backend y crear el entorno virtual:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate    # En Windows: .venv\Scripts\activate
   ```

2. Instalar dependencias:
   ```bash
   pip install -r requirements.txt
   ```

3. Configurar variables de entorno:
   ```bash
   cp .env.example .env
   # Editar .env con la URL de conexión a tu base de datos PostgreSQL
   ```

4. Iniciar el servidor Uvicorn en modo desarrollo con recarga automática:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### 2. Frontend (React + Vite)

1. En una nueva terminal, ingresar al directorio de frontend e instalar paquetes:
   ```bash
   cd frontend
   npm install
   ```

2. Iniciar el servidor de desarrollo Vite:
   ```bash
   npm run dev
   ```

3. La aplicación estará accesible en `http://localhost:5173` y se conectará automáticamente a la API en `http://localhost:8000`.

---

## 🔐 Variables de Entorno

### Backend (`backend/.env`)

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `APP_ENV` | Entorno de ejecución (`development` o `production`) | `development` |
| `HOST` | Interfaz de escucha del servidor | `0.0.0.0` |
| `PORT` | Puerto de escucha de FastAPI / ASGI | `8000` |
| `DATABASE_URL` | URI de conexión a la base de datos PostgreSQL | `postgresql+psycopg://cotizaciones:cotizaciones@localhost:5432/cotizaciones` |
| `DATABASE_ECHO` | Imprime las sentencias SQL en consola (`true`/`false`) | `false` |
| `CORS_ORIGINS` | Orígenes HTTP permitidos (separados por coma o `*`) | `*` |
| `SOCKET_CORS_ORIGINS` | Orígenes permitidos para WebSockets | `*` |

### Frontend (`frontend/.env` opcional)

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `VITE_API_URL` | URL base de la API REST y Socket.IO | `http://localhost:8000` |

---

## 📦 Módulos del Sistema

| Ruta Frontend | Módulo | Descripción |
| :--- | :--- | :--- |
| `/dashboard` | **Dashboard** | Métricas del negocio en vivo: ventas de hoy, balance de caja por forma de pago, cuentas por cobrar y ventas recientes. |
| `/venta` | **Punto de Venta / Cotizador** | Terminal interactiva de venta. Selección de cliente, búsqueda de catálogo, carrito dinámico, pagos y emisión de cotizaciones. |
| `/clientes` | **Clientes y Cuentas por Cobrar** | Ficha de clientes, historial de transacciones, filtrado de morosidad y registro de abonos a cuentas de crédito. |
| `/productos` | **Catálogo de Productos** | Creación y edición de productos, categorización, precios de venta, costos y control de visibilidad. |
| `/inventario` | **Movimientos de Stock** | Registro de ingresos de mercadería, ajustes por mermas y auditoría de variaciones de stock en tiempo real. |
| `/pantalla/:screenId` | **Pantalla Cliente** | Pantalla secundaria para el mostrador. Muestra los productos y totales al comprador en tiempo real. |
| `/cotizacion/imprimir` | **Impresión / PDF** | Vista adaptada a impresoras térmicas o estándar para cotizaciones formales con logo de la empresa. |

---

## 📡 Referencia de la API REST

La documentación Swagger interactiva completa está disponible en `/docs`. A continuación se detallan los endpoints más relevantes:

### 💰 Ventas y Cotizaciones (`/api/ventas`)
- `GET /api/ventas` - Listado de ventas (con filtros por estado y paginación).
- `GET /api/ventas/hoy` - Listado de transacciones del día actual.
- `GET /api/ventas/ultima-semana` - Ventas acumuladas de los últimos 7 días.
- `GET /api/ventas/ultimo-mes` - Ventas acumuladas de los últimos 30 días.
- `POST /api/ventas` - Crear una nueva cotización o venta directa.
- `POST /api/ventas/{id}/confirmar` - Confirmar una cotización previa como venta formal.
- `POST /api/ventas/{id}/anular` - Anular una venta y reponer automáticamente el stock de inventario.
- `POST /api/ventas/{id}/pagos` - Registrar un abono o pago a una venta con saldo pendiente.

### 👥 Clientes (`/api/clientes`)
- `GET /api/clientes` - Listar clientes (soporta búsqueda `?q=` y filtro de deuda `?con_deuda=true`).
- `GET /api/clientes/{id}` - Obtener información detallada de un cliente.
- `GET /api/clientes/{id}/ventas` - Historial de ventas asociadas a un cliente.
- `POST /api/clientes` - Crear un nuevo cliente.
- `PUT /api/clientes/{id}` - Actualizar datos del cliente.
- `DELETE /api/clientes/{id}` - Eliminar un cliente.

### 📦 Productos y Categorías (`/api/productos`, `/api/categorias`)
- `GET /api/productos` - Catálogo de productos con filtros por categoría y búsqueda textual.
- `POST /api/productos` - Registrar un nuevo producto con código, precio y stock inicial.
- `PUT /api/productos/{id}` - Modificar datos de un producto.
- `GET /api/categorias` - Listar categorías registradas.
- `POST /api/categorias` - Registrar nueva categoría.

### 📋 Inventario (`/api/inventario`)
- `GET /api/inventario/movimientos` - Historial de movimientos de stock auditados.
- `POST /api/inventario/movimientos` - Registrar entrada, salida o ajuste manual de stock.

---

## ⚡ Eventos en Tiempo Real (Socket.IO)

El servidor expone un servicio WebSocket para sincronización instantánea:

| Evento | Dirección | Descripción |
| :--- | :--- | :--- |
| `screen:join` | Cliente ➔ Servidor | La pantalla secundaria se une a una sala identificada por `screenId`. |
| `sale:show` | Servidor ➔ Pantalla | Envía los datos de la venta o cotización activa a la pantalla del cliente. |
| `sale:clear` | Servidor ➔ Pantalla | Limpia la pantalla del cliente al finalizar o cancelar la operación. |
| `inventory:stock` | Servidor ➔ Cajas | Notifica a todos los terminales cuando el stock de uno o varios productos cambia. |

---

## 🧪 Suites de Pruebas

El repositorio cuenta con una batería de pruebas exhaustiva que abarca componentes de UI, lógica de cálculo, concurrencia y pruebas de carga:

```bash
# Ejecutar pruebas unitarias y de componentes en el frontend
npm run test:frontend

# Ejecutar pruebas de carga y concurrencia sobre la API FastAPI
npm run test:fastapi-concurrency
npm run test:fastapi-concurrency:mixed

# Pruebas de estrés y escala
npm run test:stress
npm run test:catalog
```

---

## 📄 Licencia

Este proyecto es de uso privado / comercial para la gestión operativa y comercial de ventas y cotizaciones. Todos los derechos reservados.
