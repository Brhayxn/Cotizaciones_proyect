from fastapi import APIRouter

from app.core.responses import success

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health_check():
    """Endpoint simple para verificar que el backend responde."""
    return success({"status": "running"})
