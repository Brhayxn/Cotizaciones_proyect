from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Venta(Base):
    """Cabecera de cotización/venta; el estado define si afecta inventario."""
    __tablename__ = "ventas"
    __table_args__ = (
        # La BD refuerza reglas críticas para totales, estados y métodos de pago válidos.
        CheckConstraint('"totalVenta" >= 0', name="ck_ventas_total"),
        CheckConstraint("total_sin_redondeo >= 0", name="ck_ventas_total_sin_redondeo"),
        CheckConstraint("estado IN ('cotizada', 'confirmada', 'anulada')", name="ck_ventas_estado"),
        CheckConstraint("metodo_pago IS NULL OR metodo_pago IN ('transferencia', 'debito_credito', 'efectivo')", name="ck_ventas_metodo_pago"),
        Index("idx_ventas_fecha_id", "fecha", "id"),
        Index("idx_ventas_estado_fecha_id", "estado", "fecha", "id"),
        Index("idx_ventas_cliente_id", "Cliente_id", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    totalVenta: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_sin_redondeo: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ajuste_redondeo: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    metodo_pago: Mapped[str | None] = mapped_column(String(30), nullable=True)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="cotizada")
    Cliente_id: Mapped[int | None] = mapped_column(ForeignKey("clientes.id"), nullable=True)

    # El detalle guarda snapshots; movimientos registran los efectos sobre inventario.
    cliente = relationship("Cliente", back_populates="ventas")
    detalles = relationship("DetalleVenta", back_populates="venta", cascade="all, delete-orphan")
    movimientosInventario = relationship("MovimientoInventario", back_populates="venta")
