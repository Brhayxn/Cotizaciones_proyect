from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MovimientoInventario(Base):
    """Registro auditable de todo cambio de stock."""
    __tablename__ = "movimientos_inventario"
    __table_args__ = (
        # Los tipos permitidos explican de dónde viene cada cambio de inventario.
        CheckConstraint("cantidad > 0", name="ck_movimientos_cantidad"),
        CheckConstraint("tipo_movimiento IN ('ajuste', 'venta', 'abastecimiento', 'anulacion')", name="ck_movimientos_tipo"),
        Index("idx_movimientos_fecha_id", "fecha_hora", "id"),
        Index("idx_movimientos_tipo_fecha_id", "tipo_movimiento", "fecha_hora", "id"),
        Index("idx_movimientos_producto_fecha_id", "Producto_id", "fecha_hora", "id"),
        Index("idx_movimientos_venta_id", "Venta_id", "id"),
        Index("idx_movimientos_detalle_id", "DetalleVenta_id", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    tipo_movimiento: Mapped[str] = mapped_column(String(20), nullable=False)
    fecha_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    Producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"), nullable=False)
    Venta_id: Mapped[int | None] = mapped_column(ForeignKey("ventas.id"), nullable=True)
    DetalleVenta_id: Mapped[int | None] = mapped_column(ForeignKey("detalle_ventas.id"), nullable=True)

    producto = relationship("Producto", back_populates="movimientosInventario")
    venta = relationship("Venta", back_populates="movimientosInventario")
    detalleVenta = relationship("DetalleVenta", back_populates="movimientosInventario")
