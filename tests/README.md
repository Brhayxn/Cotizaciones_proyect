# Pruebas del sistema

## Concurrencia SQLite

`npm run test:sqlite-concurrency` prueba por defecto 40 lecturas y 40 ventas
confirmadas en cada nivel `1,2,4,8,16,32`. Informa promedio, p95, solicitudes
por segundo, estados HTTP y el mayor nivel de escritura sin errores bajo el
objetivo de 2 segundos. Al terminar reconcilia stock, ventas y movimientos.

La prueba siempre usa una base temporal. Se puede ampliar así:

```powershell
$env:SQLITE_CONCURRENCY_LEVELS='1,2,4,8,16,32,64'
$env:SQLITE_REQUESTS_PER_LEVEL='100'
$env:SQLITE_TARGET_P95_MS='2000'
npm run test:sqlite-concurrency
```

Esta guía combina una pauta manual de aceptación y las suites automáticas. Las pruebas automáticas usan SQLite aislado y nunca deben apuntar a `backend/database/database.sqlite`.

## Comandos

Desde la raíz del proyecto:

```bash
npm run test:api
npm run test:frontend
npm run test:stress
npm run test:catalog
npm run test:scale
npm run test:accounting
npm run test:e2e
npm run test:all
```

- `test:api`: Vitest y Supertest contra una base temporal del sistema operativo.
- `test:frontend`: Vitest, jsdom y Testing Library con API y Socket.io simulados.
- `test:stress`: carga liviana sobre una API y base temporales; mezcla lecturas y creación de cotizaciones.
- `test:catalog`: carga 850 productos y mide API, renderizado completo y búsqueda desde Chromium.
- `test:scale`: benchmark pesado con 850 productos y 100.001 cotizaciones con detalle.
- `test:accounting`: reconcilia 5.000 ventas de un día contra un cálculo contable independiente.
- `test:e2e`: construye el frontend y ejecuta Playwright en escritorio y móvil contra `backend/database/test-e2e.sqlite`.
- `test:all`: ejecuta las tres capas en orden.

La primera instalación local requiere:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
npx playwright install chromium
```

## Preparación de una prueba manual

1. Respaldar la base real si contiene datos importantes.
2. Para una prueba descartable, definir `DATABASE_PATH` con una ruta distinta de `database.sqlite` antes de ejecutar `npm start` en `backend`.
3. Cargar datos conocidos: una categoría, un cliente y dos productos; uno con stock 5 y descuento máximo 10%, y otro sin stock.
4. Abrir el panel en escritorio, en un viewport móvil y la pantalla cliente en otra ventana mediante `/pantalla/pantalla-1`.
5. Registrar por caso: fecha, entorno, resultado esperado, resultado obtenido y captura si falla.

## Pauta manual de aceptación

### Navegación y dashboard

- Abrir `/dashboard` y recorrer Productos, Clientes, Inventario y Venta desde la navegación.
- Confirmar que no hay desbordes horizontales ni controles inaccesibles en escritorio y móvil.
- Tras confirmar una venta, comprobar cantidad de ventas, ingreso, productos vendidos y actividad reciente.
- Anular la venta y confirmar que los indicadores no la contabilizan como venta confirmada.

### Productos y categorías

- Crear, editar y desactivar un producto; comprobar nombre, precio, categoría, stock y descuento máximo.
- Buscar por nombre y filtrar por categoría.
- Crear y editar una categoría; intentar duplicarla y comprobar el mensaje de error.
- Verificar que un producto sin stock no se puede agregar a una cotización.

### Clientes

- Crear, buscar, editar y eliminar un cliente sin ventas.
- Crear una cotización asociada y revisar su historial desde la tarjeta del cliente.
- Confirmar que nombre vacío y recursos inexistentes muestran errores comprensibles.

### Inventario

- Abastecer un producto y comprobar que la cantidad se suma al stock actual.
- Ajustar el mismo producto y comprobar que la cantidad pasa a ser el stock final.
- Filtrar el historial por producto y tipo de movimiento.
- Intentar cantidad cero, negativa y producto inexistente; el stock debe permanecer igual.

### Cotización, venta e impresión

- Buscar y filtrar productos; agregar uno al carrito.
- Cambiar cantidad por debajo de 1 y por encima del stock; debe quedar dentro del rango permitido.
- Aplicar un descuento superior al máximo; debe limitarse al máximo permitido.
- Comprobar subtotal y total con una calculadora independiente.
- Guardar como cotización y revisar Ventas recientes.
- Confirmar una venta y comprobar que el stock baja exactamente en la cantidad vendida.
- Abrir PDF y revisar cliente, teléfono, productos, descuentos, total, fecha y legibilidad de impresión.
- Anular una venta confirmada y comprobar que el stock vuelve al valor anterior y aparece el movimiento de anulación.

### Pantalla cliente en tiempo real

- Mantener `/venta` y `/pantalla/pantalla-1` abiertas en ventanas separadas.
- Pulsar Mostrar y comprobar cliente, líneas, descuentos y total en la segunda ventana.
- Modificar cantidad, descuento y cliente; la pantalla debe actualizarse automáticamente.
- Limpiar el carrito; la segunda ventana debe volver a “Esperando cotización”.
- Desconectar temporalmente el servidor y comprobar que el estado cambia a “Sin conexión”.

## Criterio de salida

La versión es candidata a entrega cuando `npm run test:all` termina sin fallos y la pauta manual no contiene defectos críticos en ventas, inventario, impresión o pantalla cliente. Un fallo debe incluir pasos de reproducción, datos usados, resultado esperado, resultado obtenido y evidencia.

## Prueba de carga simple

`npm run test:stress` ejecuta 300 solicitudes de lectura con concurrencia 25 y 25 cotizaciones sostenidas. Las escrituras se serializan porque SQLite solo dispone de un escritor a la vez. La prueba exige cero respuestas fallidas y un percentil 95 inferior a 2 segundos. Los umbrales buscan detectar bloqueos o degradaciones grandes en un equipo de desarrollo; no representan todavía una certificación de capacidad productiva.

## Catálogo con más de 800 productos

`npm run test:catalog` crea 850 productos descartables y abre la pantalla Productos en Chromium. Comprueba que las 850 tarjetas aparezcan, mide el endpoint, el renderizado inicial y una búsqueda que reduce el catálogo a un resultado. Los límites predeterminados son 2 segundos para API, 10 segundos para renderizado y 1 segundo para búsqueda. Pueden ajustarse con `CATALOG_API_LIMIT_MS`, `CATALOG_RENDER_LIMIT_MS` y `CATALOG_SEARCH_LIMIT_MS`.

## Escala con más de 100.000 cotizaciones

`npm run test:scale` crea una base temporal con 850 productos, 100.001 operaciones y un detalle por operación. Mide el tiempo de siembra, el endpoint completo de ventas, el renderizado del catálogo y la carga/analítica del Dashboard en Chromium. Usa una mezcla determinista de estados: 70% cotizadas, 25% confirmadas y 5% anuladas.

Por su costo, este benchmark no forma parte de `test:all` ni de GitHub Actions. Sus límites duros son 120 segundos para la API, 15 segundos para el catálogo y 180 segundos para el Dashboard. Además, muestra advertencias cuando la API supera 5 segundos o el Dashboard supera 10 segundos, porque esos tiempos ya afectan la experiencia aunque el proceso termine correctamente. Los límites pueden ajustarse con las variables `SCALE_*_LIMIT_MS` y los objetivos con `SCALE_API_TARGET_MS` y `SCALE_DASHBOARD_TARGET_MS`.

## Reconciliación contable de 5.000 ventas

`npm run test:accounting` crea productos y 5.000 operaciones mediante la API: 3.500 confirmadas, 1.000 cotizadas y 500 confirmadas que luego se anulan. Usa precios, cantidades y descuentos deterministas, compara cada subtotal con aritmética entera independiente y exige igualdad exacta entre el oráculo, API, SQLite, inventario, movimientos y Dashboard. Todas las operaciones se asignan al mismo día y la base es temporal.

Este benchmark no forma parte de `test:all` ni de CI debido a su duración. Cualquier diferencia de $1, unidad de stock, estado o movimiento hace fallar la prueba.
