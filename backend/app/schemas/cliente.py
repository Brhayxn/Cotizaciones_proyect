from pydantic import BaseModel, Field, field_validator


class ClienteBase(BaseModel):
    """Datos mínimos que se usan para identificar al cliente en una cotización."""
    nombre: str = Field(min_length=1, max_length=255)
    telefono: str | None = None

    @field_validator("nombre")
    @classmethod
    def trim_nombre(cls, value: str) -> str:
        """Evita nombres compuestos solo por espacios."""
        value = value.strip()
        if not value:
            raise ValueError("nombre requerido")
        return value


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    """Actualización parcial de cliente."""
    nombre: str | None = None
    telefono: str | None = None

    @field_validator("nombre")
    @classmethod
    def trim_nombre(cls, value: str | None) -> str | None:
        """Si se envía nombre, debe tener contenido real."""
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("nombre requerido")
        return value


class ClienteRead(ClienteBase):
    id: int

    model_config = {"from_attributes": True}
