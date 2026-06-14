# Backend Catalogo, Ventas e Inventario

API REST para administrar clientes, categorias, productos, ventas e inventario.
Incluye Socket.io para enviar una venta o carrito desde el panel vendedor hacia una pantalla cliente.

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
npm run reset-db
npm run seed
```

`npm run reset-db` elimina la estructura anterior y recrea la base con el modelo nuevo.
`npm run seed` hace lo mismo, pero ademas carga 3 categorias, 5 productos, stock inicial y movimientos de abastecimiento.

## Modelo de datos actual

### Cliente

- `id`
- `nombre`
- `telefono`

### Categoria

- `id`
- `nombre`

### Producto

- `id`
- `nombre`
- `precio`
- `descuento_maximo`
- `stock`
- `activo`
- `Categoria_id`

`descuento_maximo` se maneja como porcentaje entre `0` y `100`.
`stock` guarda el stock actual para lectura rapida. El historial queda en `movimientos_inventario`.

### Venta

- `id`
- `totalVenta`
- `fecha`
- `estado`
- `Cliente_id`

Estados permitidos:

- `cotizada`: no descuenta inventario.
- `confirmada`: descuenta inventario y registra movimientos tipo `venta`.
- `anulada`: cancela la operacion. Si estaba confirmada, devuelve stock y registra movimientos tipo `anulacion`.

Transiciones validas:

- `cotizada -> confirmada`
- `cotizada -> anulada`
- `confirmada -> anulada`

### DetalleVenta

- `id`
- `cantidad`
- `nombre_producto`
- `precio_unitario`
- `subtotal`
- `descuento_aplicado`
- `Venta_id`
- `Producto_id`

`descuento_aplicado` se maneja como porcentaje. El backend valida:

```text
descuento_aplicado <= Producto.descuento_maximo
```

El subtotal se calcula asi:

```text
subtotal = cantidad * precio_unitario * (100 - descuento_aplicado) / 100
```

`nombre_producto` y `precio_unitario` quedan congelados en el detalle para mantener historial aunque el producto cambie despues.

### MovimientoInventario

- `id`
- `cantidad`
- `tipo_movimiento`
- `fecha_hora`
- `Producto_id`
- `Venta_id`
- `DetalleVenta_id`

Tipos permitidos:

- `abastecimiento`: aumenta stock.
- `ajuste`: fija manualmente el stock de un producto.
- `venta`: salida generada al confirmar una venta.
- `anulacion`: entrada generada al anular una venta confirmada.

## Ejecutar con PM2

```bash
npm install -g pm2
cd backend
pm2 start ecosystem.config.js
pm2 status
pm2 logs catalogo-ventas-backend
```

Para detener:

```bash
pm2 stop catalogo-ventas-backend
```

## Endpoints principales

### Clientes

- `GET /api/clientes`
- `GET /api/clientes/:id`
- `GET /api/clientes/:id/ventas`
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
  "descuento_maximo": 10,
  "stock": 25,
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

### Ventas

- `GET /api/ventas`
- `GET /api/ventas?estado=cotizada`
- `GET /api/ventas/:id`
- `POST /api/ventas`
- `PATCH /api/ventas/:id/confirmar`
- `PATCH /api/ventas/:id/anular`
- `DELETE /api/ventas/:id`

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
      "cantidad": 2,
      "descuento_aplicado": 5
    },
    {
      "Producto_id": 3,
      "cantidad": 5,
      "descuento_aplicado": 0
    }
  ]
}
```

Una venta nueva nace como `cotizada` si no se envia estado.
Tambien puede crearse directamente como confirmada:

```json
{
  "estado": "confirmada",
  "Cliente_id": 1,
  "items": [
    {
      "Producto_id": 1,
      "cantidad": 2,
      "descuento_aplicado": 0
    }
  ]
}
```

Al confirmar, el backend valida stock, valida descuentos, descuenta inventario y crea movimientos.

### Inventario

- `GET /api/inventario/movimientos`
- `GET /api/inventario/movimientos?producto=1`
- `GET /api/inventario/movimientos?tipo=venta`
- `POST /api/inventario/movimientos`

Ejemplo de abastecimiento:

```json
{
  "Producto_id": 1,
  "cantidad": 10,
  "tipo_movimiento": "abastecimiento"
}
```

Ejemplo de ajuste:

```json
{
  "Producto_id": 1,
  "cantidad": 25,
  "tipo_movimiento": "ajuste"
}
```

En un `ajuste`, `cantidad` pasa a ser el stock final del producto. En un `abastecimiento`, `cantidad` se suma al stock actual.

## Socket.io

La pantalla cliente se une a una sala:

```js
socket.emit('screen:join', { screenId: 'pantalla-1' });
```

El panel vendedor envia una venta:

```js
socket.emit('sale:show', {
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
socket.on('sale:update', (sale) => {
  console.log(sale);
});
```

Para limpiar la pantalla:

```js
socket.emit('sale:clear', { screenId: 'pantalla-1' });
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
