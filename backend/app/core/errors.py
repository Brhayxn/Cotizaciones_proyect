from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class BusinessError(Exception):
    """Error controlado para reglas de negocio y respuestas claras al frontend."""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


def register_error_handlers(app: FastAPI) -> None:
    """Normaliza errores para que el frontend siempre reciba `{ ok, message }`."""
    @app.exception_handler(BusinessError)
    async def business_error_handler(_request: Request, error: BusinessError):
        return JSONResponse(status_code=error.status_code, content={"ok": False, "message": error.message})

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_request: Request, _error: RequestValidationError):
        return JSONResponse(status_code=400, content={"ok": False, "message": "Datos de entrada invalidos"})

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_request: Request, error: StarletteHTTPException):
        message = error.detail if isinstance(error.detail, str) else "Ruta no encontrada"
        return JSONResponse(status_code=error.status_code, content={"ok": False, "message": message})

    @app.exception_handler(Exception)
    async def unexpected_error_handler(_request: Request, _error: Exception):
        return JSONResponse(status_code=500, content={"ok": False, "message": "Error interno del servidor"})
