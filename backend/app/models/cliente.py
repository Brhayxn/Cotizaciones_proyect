from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Cliente(Base):
    """Cliente asociado a cotizaciones y ventas."""
    __tablename__ = "clientes"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    telefono: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)

    # Permite consultar historial del cliente desde el módulo de clientes.
    ventas = relationship("Venta", back_populates="cliente")
