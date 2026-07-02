from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from socketio import ASGIApp

from app.core.config import get_settings
from app.core.database import create_tables
from app.core.errors import register_error_handlers
from app.routes import api_router
from app.websockets.socketio import sio

settings = get_settings()
frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"

# FastAPI maneja la API REST; Socket.IO se monta al final sobre esta app.
fastapi_app = FastAPI(title="Cotizaciones API", version="0.1.0")
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.parsed_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(fastapi_app)
fastapi_app.include_router(api_router)

if frontend_dist.exists():
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        # Sirve los assets generados por Vite cuando el backend corre en modo producción.
        fastapi_app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    @fastapi_app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        """Entrega la SPA sin interceptar rutas inexistentes de la API."""
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")

        requested_file = frontend_dist / full_path
        if requested_file.is_file():
            return FileResponse(requested_file)

        return FileResponse(frontend_dist / "index.html")


@fastapi_app.on_event("startup")
def on_startup() -> None:
    """Crea tablas e índices al iniciar para simplificar despliegues pequeños."""
    create_tables()


# `app` es el punto ASGI final: primero Socket.IO, luego FastAPI como fallback.
app = ASGIApp(sio, other_asgi_app=fastapi_app)
