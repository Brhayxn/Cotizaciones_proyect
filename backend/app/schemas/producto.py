from pydantic import BaseModel, Field, field_validator

from app.schemas.categoria import CategoriaRead


class ProductoBase(BaseModel):
    """Campos comunes para crear, leer y validar productos."""
    nombre: str = Field(min_length=1, max_length=255)
    precio: int = Field(gt=0)
    descuento_maximo: int = Field(default=0, ge=0, le=100)
    stock: int = Field(default=0, ge=0)
    activo: bool = True
    Categoria_id: int | None = None

    @field_validator("nombre")
    @classmethod
    def trim_nombre(cls, value: str) -> str:
        """Normaliza espacios para evitar productos con nombres vacíos."""
        value = value.strip()
        if not value:
            raise ValueError("nombre requerido")
        return value


class ProductoCreate(ProductoBase):
    pass


class ProductoUpdate(BaseModel):
    """Actualización parcial: todos los campos son opcionales."""
    nombre: str | None = None
    precio: int | None = Field(default=None, gt=0)
    descuento_maximo: int | None = Field(default=None, ge=0, le=100)
    stock: int | None = Field(default=None, ge=0)
    activo: bool | None = None
    Categoria_id: int | None = None

    @field_validator("nombre")
    @classmethod
    def trim_nombre(cls, value: str | None) -> str | None:
        """Permite omitir nombre, pero no guardarlo vacío."""
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("nombre requerido")
        return value


class ProductoEstadoUpdate(BaseModel):
    activo: bool


class ProductoRead(ProductoBase):
    """Respuesta enviada al frontend con id y categoría expandida."""
    id: int
    categoria: CategoriaRead | None = None

    model_config = {"from_attributes": True}
