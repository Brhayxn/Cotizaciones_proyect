# Backend FastAPI

Backend paralelo para migrar el API actual a FastAPI y PostgreSQL sin eliminar el backend Express existente.

## Instalacion

```bash
cd backend_fastapi
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
```

## Base de datos

Crear PostgreSQL y ajustar `DATABASE_URL` en `.env`.

Por ahora las tablas se crean automaticamente al iniciar para facilitar la migracion inicial. Antes de produccion conviene reemplazar esto por Alembic.

## Ejecutar

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```bash
VITE_API_URL=http://localhost:8000 npm --prefix ../frontend run dev
```

## Compatibilidad

- Mantiene rutas `/api/...`.
- Mantiene respuesta `{ ok, data, meta }` y errores `{ ok: false, message }`.
- Mantiene Socket.IO para `screen:join`, `sale:show`, `sale:clear` e `inventory:stock`.
- Mantiene campos actuales como `Producto_id`, `Cliente_id` y `Categoria_id`.
