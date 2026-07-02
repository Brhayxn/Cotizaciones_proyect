from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Producto(Base):
    """Producto vendible con precio, descuento permitido, stock y categoría opcional."""
    __tablename__ = "productos"
    __table_args__ = (
        # Estas reglas evitan datos imposibles aunque un cliente externo salte la validación Pydantic.
        CheckConstraint("precio > 0", name="ck_productos_precio_positivo"),
        CheckConstraint("descuento_maximo >= 0 AND descuento_maximo <= 100", name="ck_productos_descuento"),
        CheckConstraint("stock >= 0", name="ck_productos_stock"),
        Index("idx_productos_activo_id", "activo", "id"),
        Index("idx_productos_categoria_activo_id", "Categoria_id", "activo", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    precio: Mapped[int] = mapped_column(Integer, nullable=False)
    descuento_maximo: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    Categoria_id: Mapped[int | None] = mapped_column(ForeignKey("categorias.id"), nullable=True)

    # Relaciones usadas para mostrar categoría, historial de ventas y movimientos de stock.
    categoria = relationship("Categoria", back_populates="productos")
    detallesVenta = relationship("DetalleVenta", back_populates="producto")
    movimientosInventario = relationship("MovimientoInventario", back_populates="producto")
