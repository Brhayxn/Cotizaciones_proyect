from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.responses import success
from app.schemas.venta import VentaAnular, VentaConfirmar, VentaCreate, VentaRead
from app.services.realtime_service import emit_stock_updates
from app.services.venta_service import VentaService

router = APIRouter(prefix="/api/ventas", tags=["ventas"])
service = VentaService()


@router.get("")
def listar_ventas(estado: str | None = None, limit: int | None = Query(default=None), db: Session = Depends(get_db)):
    """GET /api/ventas: listado general con estado opcional."""
    rows, meta = service.list(db, estado, limit)
    return success([VentaRead.model_validate(row).model_dump(mode="json") for row in rows], meta)


@router.get("/hoy")
def listar_ventas_hoy(limit: int | None = Query(default=None), db: Session = Depends(get_db)):
    """Ventas del día actual, usado por dashboard y revisiones rápidas."""
    rows, meta = service.list_from_days(db, 0, limit)
    return success([VentaRead.model_validate(row).model_dump(mode="json") for row in rows], meta)


@router.get("/ultima-semana")
def listar_ventas_ultima_semana(limit: int | None = Query(default=None), db: Session = Depends(get_db)):
    """Ventas de los últimos 7 días para el panel de ventas recientes."""
    rows, meta = service.list_from_days(db, 6, limit)
    return success([VentaRead.model_validate(row).model_dump(mode="json") for row in rows], meta)


@router.get("/ultimo-mes")
def listar_ventas_ultimo_mes(limit: int | None = Query(default=None), db: Session = Depends(get_db)):
    """Ventas de los últimos 30 días para reportes simples."""
    rows, meta = service.list_from_days(db, 29, limit)
    return success([VentaRead.model_validate(row).model_dump(mode="json") for row in rows], meta)


@router.get("/{venta_id}")
def obtener_venta(venta_id: int, db: Session = Depends(get_db)):
    """Obtiene una venta completa con cliente, detalle e inventario relacionado."""
    venta = service.get(db, venta_id)
    return success(VentaRead.model_validate(venta).model_dump(mode="json"))


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear_venta(payload: VentaCreate, db: Session = Depends(get_db)):
    """Crea cotización o venta; si descuenta stock, avisa a otros clientes por socket."""
    venta, product_ids = service.create(db, payload)
    if product_ids:
        await emit_stock_updates(db, product_ids, "venta", payload.socket_id)
    return success(VentaRead.model_validate(venta).model_dump(mode="json"))


@router.patch("/{venta_id}/confirmar")
async def confirmar_venta(venta_id: int, payload: VentaConfirmar, db: Session = Depends(get_db)):
    """Confirma una cotización existente y sincroniza el stock actualizado."""
    venta, product_ids = service.confirm(db, venta_id, payload.metodo_pago)
    await emit_stock_updates(db, product_ids, "venta", payload.socket_id)
    return success(VentaRead.model_validate(venta).model_dump(mode="json"))


@router.patch("/{venta_id}/anular")
async def anular_venta(venta_id: int, payload: VentaAnular | None = None, db: Session = Depends(get_db)):
    """Anula una venta y restaura stock si correspondía."""
    venta, product_ids = service.cancel(db, venta_id)
    socket_id = payload.socket_id if payload else None
    await emit_stock_updates(db, product_ids, "anulacion", socket_id)
    return success(VentaRead.model_validate(venta).model_dump(mode="json"))


@router.delete("/{venta_id}")
def eliminar_venta(venta_id: int, db: Session = Depends(get_db)):
    """Elimina cotizaciones no confirmadas; las ventas reales deben anularse."""
    return success(service.delete(db, venta_id))
