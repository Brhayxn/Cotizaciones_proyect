from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.responses import success
from app.schemas.inventario import MovimientoCreate, MovimientoRead
from app.services.inventario_service import InventarioService
from app.services.realtime_service import emit_stock_updates

router = APIRouter(prefix="/api/inventario", tags=["inventario"])
service = InventarioService()


@router.get("/resumen")
def obtener_resumen(db: Session = Depends(get_db)):
    """Resumen rápido de productos, stock total y stock bajo."""
    return success(service.summary(db))


@router.get("/movimientos")
def listar_movimientos(
    q: str | None = None,
    limit: int | None = Query(default=None),
    producto: int | None = None,
    tipo: str | None = None,
    db: Session = Depends(get_db),
):
    """Lista movimientos de inventario con filtros para auditoría."""
    rows, meta = service.list_movements(db, q, limit, producto, tipo)
    return success([MovimientoRead.model_validate(row).model_dump(mode="json") for row in rows], meta)


@router.post("/movimientos", status_code=status.HTTP_201_CREATED)
async def registrar_movimiento_manual(payload: MovimientoCreate, db: Session = Depends(get_db)):
    """Registra ajuste/abastecimiento manual y avisa el cambio de stock."""
    movimiento, product_id = service.create_manual_movement(db, payload)
    await emit_stock_updates(db, [product_id], payload.tipo_movimiento)
    return success(MovimientoRead.model_validate(movimiento).model_dump(mode="json"))
