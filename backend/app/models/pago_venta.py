from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PagoVenta(Base):
    """Pago recibido para una venta confirmada."""
    __tablename__ = "pagos_venta"
    __table_args__ = (
        CheckConstraint("monto > 0", name="ck_pagos_venta_monto"),
        CheckConstraint("metodo_pago IN ('transferencia', 'debito_credito', 'efectivo')", name="ck_pagos_venta_metodo"),
        Index("idx_pagos_venta_venta_id", "Venta_id", "id"),
        Index("idx_pagos_venta_fecha_id", "fecha", "id"),
        Index("idx_pagos_venta_metodo_fecha_id", "metodo_pago", "fecha", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    monto: Mapped[int] = mapped_column(Integer, nullable=False)
    metodo_pago: Mapped[str] = mapped_column(String(30), nullable=False)
    nota: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    Venta_id: Mapped[int] = mapped_column(ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False)

    venta = relationship("Venta", back_populates="pagos")
