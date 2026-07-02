from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Categoria(Base):
    """Agrupa productos para filtros y organización del catálogo."""
    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)

    productos = relationship("Producto", back_populates="categoria")
