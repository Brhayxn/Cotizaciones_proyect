from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.cliente import ClienteRead
from app.schemas.producto import ProductoRead


class ClienteInline(BaseModel):
    """Cliente rápido enviado desde la cotización cuando no se selecciona uno existente."""
    nombre: str
    telefono: str | None = None


class VentaItemCreate(BaseModel):
    """Producto, cantidad y descuento solicitado para una línea de venta."""
    Producto_id: int
    cantidad: int = Field(gt=0)
    descuento_aplicado: int = Field(default=0, ge=0, le=100)


class VentaCreate(BaseModel):
    """Payload para guardar cotización o confirmar venta desde el carrito."""
    estado: str = "cotizada"
    metodo_pago: str | None = None
    Cliente_id: int | None = None
    cliente: ClienteInline | None = None
    items: list[VentaItemCreate]
    socket_id: str | None = None


class VentaConfirmar(BaseModel):
    """Datos mínimos para pasar una cotización a venta confirmada."""
    metodo_pago: str | None = None
    socket_id: str | None = None


class VentaAnular(BaseModel):
    socket_id: str | None = None


class DetalleVentaRead(BaseModel):
    """Detalle histórico de venta con producto actual cuando sigue disponible."""
    id: int
    cantidad: int
    nombre_producto: str
    precio_unitario: int
    subtotal: int
    descuento_aplicado: int
    Venta_id: int
    Producto_id: int
    producto: ProductoRead | None = None

    model_config = {"from_attributes": True}


class MovimientoVentaRead(BaseModel):
    """Movimiento de inventario asociado a una venta."""
    id: int
    cantidad: int
    tipo_movimiento: str
    fecha_hora: datetime
    Producto_id: int
    Venta_id: int | None = None
    DetalleVenta_id: int | None = None
    producto: ProductoRead | None = None

    model_config = {"from_attributes": True}


class VentaRead(BaseModel):
    """Respuesta completa de venta para listados, detalle e historial."""
    id: int
    totalVenta: int
    total_sin_redondeo: int
    ajuste_redondeo: int
    metodo_pago: str | None = None
    fecha: datetime
    estado: str
    Cliente_id: int | None = None
    cliente: ClienteRead | None = None
    detalles: list[DetalleVentaRead] = []
    movimientosInventario: list[MovimientoVentaRead] = []

    model_config = {"from_attributes": True}
