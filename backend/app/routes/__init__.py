from fastapi import APIRouter

from app.routes import categorias, clientes, health, inventario, productos, ventas


api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(clientes.router)
api_router.include_router(categorias.router)
api_router.include_router(productos.router)
api_router.include_router(ventas.router)
api_router.include_router(inventario.router)
