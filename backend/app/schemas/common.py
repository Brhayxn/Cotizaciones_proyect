from pydantic import BaseModel


class ApiMeta(BaseModel):
    """Metadata común para listados paginados."""
    limit: int | None
    total: int
    hasMore: bool
