from app.core.errors import BusinessError

DEFAULT_LIMIT = 40
MAX_LIMIT = 40
MAX_SEARCH_LENGTH = 100


def parse_limit(value: int | None, *, optional: bool = False) -> int | None:
    """Normaliza límites para evitar respuestas demasiado grandes."""
    if value is None:
        return None if optional else DEFAULT_LIMIT
    if value < 1 or value > MAX_LIMIT:
        raise BusinessError("El limite debe ser un entero entre 1 y 40")
    return value


def parse_search(value: str | None) -> str:
    """Limpia búsquedas y limita longitud antes de armar consultas SQL."""
    if value is None:
        return ""
    search = value.strip()
    if len(search) > MAX_SEARCH_LENGTH:
        raise BusinessError("La busqueda no puede superar 100 caracteres")
    return search
