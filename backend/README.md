# Backend Catalogo y Cotizaciones

API REST simple para administrar clientes, categorias, productos y cotizaciones.
Incluye Socket.io para enviar una cotizacion o carrito desde el panel vendedor hacia una pantalla cliente.

## Stack

- Node.js
- Express
- Sequelize
- SQLite
- Socket.io
- PM2

## Instalacion

```bash
cd backend
npm install
```

## Variables de entorno

El puerto por defecto es `3000`. Puedes crear un archivo `.env`:

```env
PORT=3000
```

## Comandos

```bash
npm run dev
npm start
npm run seed
```

`npm run seed` reinicia la base de datos y carga 3 categorias y 5 productos de ejemplo.

## Ejecutar con PM2

```bash
npm install -g pm2
cd backend
pm2 start ecosystem.config.js
pm2 status
pm2 logs catalogo-cotizaciones-backend
```

Para detener:

```bash
pm2 stop catalogo-cotizaciones-backend
```

## Endpoints principales

### Clientes

- `GET /api/clientes`
- `GET /api/clientes/:id`
- `POST /api/clientes`
- `PUT /api/clientes/:id`
- `DELETE /api/clientes/:id`

Ejemplo:

```json
{
  "nombre": "Juan Perez",
  "telefono": "912345678"
}
```

### Categorias

- `GET /api/categorias`
- `GET /api/categorias/:id`
- `POST /api/categorias`
- `PUT /api/categorias/:id`
- `DELETE /api/categorias/:id`

Ejemplo:

```json
{
  "nombre": "Maderas"
}
```

### Productos

- `GET /api/productos`
- `GET /api/productos/:id`
- `POST /api/productos`
- `PUT /api/productos/:id`
- `DELETE /api/productos/:id`
- `PATCH /api/productos/:id/estado`

Filtros:

- `GET /api/productos?categoria=1`
- `GET /api/productos?activo=true`

Ejemplo:

```json
{
  "nombre": "Terciado estructural 18mm",
  "precio": 18990,
  "Categoria_id": 1
}
```

Cambiar estado:

```json
{
  "activo": false
}
```

El `DELETE /api/productos/:id` no borra fisicamente el producto. Solo cambia `activo` a `false`.

### Cotizaciones

- `GET /api/cotizaciones`
- `GET /api/cotizaciones/:id`
- `POST /api/cotizaciones`
- `DELETE /api/cotizaciones/:id`

Ejemplo:

```json
{
  "cliente": {
    "nombre": "Juan Perez",
    "telefono": "912345678"
  },
  "items": [
    {
      "Producto_id": 1,
      "cantidad": 2
    },
    {
      "Producto_id": 3,
      "cantidad": 5
    }
  ]
}
```

La cotizacion guarda `nombre_producto` y `precio_unitario` en el detalle para conservar el historial aunque el producto cambie despues.

## Socket.io

La pantalla cliente se une a una sala:

```js
socket.emit('screen:join', { screenId: 'pantalla-1' });
```

El panel vendedor envia una cotizacion:

```js
socket.emit('quote:show', {
  screenId: 'pantalla-1',
  cliente: {
    nombre: 'Juan Perez',
    telefono: '912345678'
  },
  items: [
    {
      nombre_producto: 'Terciado estructural 18mm',
      precio_unitario: 18990,
      cantidad: 2,
      subtotal: 37980
    }
  ],
  total: 37980
});
```

La pantalla cliente recibe:

```js
socket.on('quote:update', (quote) => {
  console.log(quote);
});
```

Para limpiar la pantalla:

```js
socket.emit('quote:clear', { screenId: 'pantalla-1' });
```

## Formato de respuestas

Exito:

```json
{
  "ok": true,
  "data": {}
}
```

Error:

```json
{
  "ok": false,
  "message": "Descripcion del error"
}
```
