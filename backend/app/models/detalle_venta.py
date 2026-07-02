from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DetalleVenta(Base):
    """Línea de venta guardada como snapshot del producto al momento de cotizar."""
    __tablename__ = "detalle_ventas"
    __table_args__ = (
        # Se validan cantidades y descuentos para proteger reportes y totales históricos.
        CheckConstraint("cantidad > 0", name="ck_detalle_cantidad"),
        CheckConstraint("precio_unitario > 0", name="ck_detalle_precio"),
        CheckConstraint("subtotal >= 0", name="ck_detalle_subtotal"),
        CheckConstraint("descuento_aplicado >= 0 AND descuento_aplicado <= 100", name="ck_detalle_descuento"),
        Index("idx_detalles_venta_id", "Venta_id", "id"),
        Index("idx_detalles_producto_id", "Producto_id", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    nombre_producto: Mapped[str] = mapped_column(String(255), nullable=False)
    precio_unitario: Mapped[int] = mapped_column(Integer, nullable=False)
    subtotal: Mapped[int] = mapped_column(Integer, nullable=False)
    descuento_aplicado: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    Venta_id: Mapped[int] = mapped_column(ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False)
    Producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"), nullable=False)

    venta = relationship("Venta", back_populates="detalles")
    producto = relationship("Producto", back_populates="detallesVenta")
    movimientosInventario = relationship("MovimientoInventario", back_populates="detalleVenta")
