from pydantic import BaseModel, Field, field_validator


class CategoriaBase(BaseModel):
    """Nombre de categoría validado para catálogo de productos."""
    nombre: str = Field(min_length=1, max_length=255)

    @field_validator("nombre")
    @classmethod
    def trim_nombre(cls, value: str) -> str:
        """Evita guardar categorías vacías o con solo espacios."""
        value = value.strip()
        if not value:
            raise ValueError("nombre requerido")
        return value


class CategoriaCreate(CategoriaBase):
    pass


class CategoriaUpdate(BaseModel):
    """Actualización parcial de categoría."""
    nombre: str | None = None

    @field_validator("nombre")
    @classmethod
    def trim_nombre(cls, value: str | None) -> str | None:
        """Permite omitir nombre, pero si llega debe ser válido."""
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("nombre requerido")
        return value


class CategoriaRead(CategoriaBase):
    """Respuesta de categoría usada por selects y listados."""
    id: int

    model_config = {"from_attributes": True}
