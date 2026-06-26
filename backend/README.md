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

La configuracion local se encuentra en `backend/.env`. Usa `.env.example` como
referencia para otros equipos o ambientes:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
DATABASE_PATH=./database/database.sqlite
DATABASE_LOGGING=false
SQLITE_JOURNAL_MODE=WAL
SQLITE_BUSY_TIMEOUT=5000
CORS_ORIGIN=*
SOCKET_CORS_ORIGIN=*
FRONTEND_DIST_PATH=../frontend/dist
```

Las rutas relativas se resuelven desde la carpeta `backend`. Para limitar CORS
a varios clientes, separa los origenes con comas. Por ejemplo:

```env
CORS_ORIGIN=http://localhost:5173,http://192.168.1.20:5173
```

El archivo `.env` no se versiona porque puede contener configuracion privada.
`SQLITE_BUSY_TIMEOUT` se expresa en milisegundos. El modo `WAL` mejora la
convivencia entre lecturas y escrituras concurrentes.

## Comandos

```bash
npm run dev
npm start
npm run backup-db
npm run reset-db
npm run seed
```

`npm run reset-db` elimina la estructura anterior y recrea la base con el modelo nuevo.
`npm run seed` hace lo mismo, pero ademas carga 3 categorias, 5 productos, stock inicial y movimientos de abastecimiento.

> **Importante:** ambos comandos son destructivos. Realiza un respaldo antes de
> ejecutarlos sobre una base con informacion real.

Al recrear la base se agregan indices compuestos para productos, clientes,
ventas, detalles y movimientos. Tambien se crean indices FTS5 con tokenizer
`trigram` para buscar fragmentos dentro del nombre de productos y dentro del
nombre o telefono de clientes. El servidor normal no altera indices al iniciar.

Las busquedas de tres o mas caracteres usan FTS5. Las entradas de uno o dos
caracteres conservan `LIKE` como compatibilidad. Si se inicia una base antigua
sin ejecutar el reset, la API funciona con `LIKE`, pero sin la mejora FTS5.

## Respaldo manual

Abre una terminal Git Bash y ejecuta:

```bash
cd backend
./backup-db.sh
```

Desde PowerShell puedes invocar Git Bash explicitamente:

```powershell
& "C:\Program Files\Git\bin\bash.exe" .\backup-db.sh
```

El script crea una copia consistente aunque SQLite este usando WAL, comprueba
su integridad y la guarda en `backend/backups/database`. Por defecto conserva
7 dias. Puedes cambiarlo con `DATABASE_BACKUP_RETENTION_DAYS` en `.env`; usa
`0` para no eliminar respaldos antiguos.

El respaldo contiene la estructura completa de SQLite, incluidos indices,
triggers y tablas virtuales FTS5.

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
- `total_sin_redondeo`
- `ajuste_redondeo`
- `metodo_pago`
- `fecha`
- `estado`
- `Cliente_id`

Estados permitidos:

- `cotizada`: no descuenta inventario.
- `confirmada`: descuenta inventario y registra movimientos tipo `venta`.
- `anulada`: cancela la operacion. Si estaba confirmada, devuelve stock y registra movimientos tipo `anulacion`.

Metodos de pago permitidos para ventas confirmadas:

- `transferencia`
- `debito_credito`
- `efectivo`

Las cotizaciones mantienen `metodo_pago` en `null`. En efectivo, `totalVenta`
guarda el monto final cobrado; `total_sin_redondeo` conserva la suma de los
detalles y `ajuste_redondeo` registra la diferencia aplicada al total.

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
- `GET /api/productos?q=terciado&limit=20`

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
- `GET /api/ventas/hoy`
- `GET /api/ventas/ultima-semana`
- `GET /api/ventas/ultimo-mes`
- `GET /api/ventas/:id`
- `POST /api/ventas`
- `PATCH /api/ventas/:id/confirmar`
- `PATCH /api/ventas/:id/anular`
- `DELETE /api/ventas/:id`

Los filtros `hoy`, `ultima-semana` y `ultimo-mes` usan la zona horaria
`America/Santiago` y consideran respectivamente 1, 7 y 30 dias calendario,
incluyendo el dia actual.

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
  "metodo_pago": "efectivo",
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

Para confirmar una cotizacion existente:

```json
{
  "metodo_pago": "debito_credito"
}
```

Al confirmar, el backend valida stock, valida descuentos, descuenta inventario y crea movimientos.

### Inventario

- `GET /api/inventario/resumen`
- `GET /api/inventario/movimientos`
- `GET /api/inventario/movimientos?producto=1`
- `GET /api/inventario/movimientos?tipo=venta`
- `GET /api/inventario/movimientos?q=terciado&limit=20`
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

## Listados operativos

Productos, clientes, ventas generales, historial por cliente y movimientos de
inventario devuelven como maximo 40 registros. Aceptan `limit` entre 1 y 40 y
las busquedas de productos, clientes y movimientos aceptan `q`.

Las respuestas incluyen metadatos sin cambiar el array `data`:

```json
{
  "ok": true,
  "data": [],
  "meta": {
    "limit": 40,
    "total": 85,
    "hasMore": true
  }
}
```

Los endpoints analiticos `/api/ventas/hoy` y `/api/ventas/ultima-semana`
siguen completos cuando no reciben `limit`. El modal operativo usa
`/api/ventas/hoy?limit=40`.

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

Cuando una venta, anulacion o movimiento manual cambia existencias, el backend
emite a los vendedores conectados:

```js
socket.on('inventory:stock', ({ reason, products }) => {
  console.log(reason, products);
});
```

Cada producto incluye `id`, `nombre`, `stock` y `activo`. El vendedor que
origina una venta puede enviar `socket_id`; el backend lo excluye del evento y
notifica solamente a los otros equipos. La confirmacion usa descuento atomico
de stock, por lo que dos ventas simultaneas no pueden consumir la misma unidad.

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
