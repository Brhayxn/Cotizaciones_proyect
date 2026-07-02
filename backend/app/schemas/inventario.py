from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.producto import ProductoRead


class InventarioResumen(BaseModel):
    """Resumen agregado de inventario para tarjetas de la interfaz."""
    productos: int
    stockTotal: int
    stockBajo: int


class MovimientoCreate(BaseModel):
    """Entrada para ajustes o abastecimientos manuales de stock."""
    Producto_id: int
    cantidad: int = Field(gt=0)
    tipo_movimiento: str


class MovimientoRead(BaseModel):
    """Movimiento leído con producto opcional para mostrar historial claro."""
    id: int
    cantidad: int
    tipo_movimiento: str
    fecha_hora: datetime
    Producto_id: int
    Venta_id: int | None = None
    DetalleVenta_id: int | None = None
    producto: ProductoRead | None = None

    model_config = {"from_attributes": True}
