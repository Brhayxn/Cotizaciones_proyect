from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.responses import success
from app.schemas.cliente import ClienteCreate, ClienteRead, ClienteUpdate
from app.schemas.venta import VentaRead
from app.services.cliente_service import ClienteService

router = APIRouter(prefix="/api/clientes", tags=["clientes"])
service = ClienteService()


@router.get("")
def listar_clientes(
    q: str | None = None,
    con_deuda: bool | None = None,
    limit: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Lista clientes y soporta búsqueda para autocompletar en cotizaciones."""
    rows, meta = service.list(db, q, limit, con_deuda)
    return success([ClienteRead.model_validate(row).model_dump() for row in rows], meta)


@router.get("/{cliente_id}/ventas")
def listar_ventas_cliente(cliente_id: int, limit: int | None = Query(default=None), db: Session = Depends(get_db)):
    """Muestra historial de compras/cotizaciones de un cliente."""
    rows, meta = service.list_sales(db, cliente_id, limit)
    return success([VentaRead.model_validate(row).model_dump(mode="json") for row in rows], meta)


@router.get("/{cliente_id}")
def obtener_cliente(cliente_id: int, db: Session = Depends(get_db)):
    """Obtiene datos básicos del cliente."""
    cliente = service.get(db, cliente_id)
    return success(ClienteRead.model_validate(cliente).model_dump())


@router.post("", status_code=status.HTTP_201_CREATED)
def crear_cliente(payload: ClienteCreate, db: Session = Depends(get_db)):
    """Crea cliente desde administración o flujos futuros."""
    cliente = service.create(db, payload)
    return success(ClienteRead.model_validate(cliente).model_dump())


@router.put("/{cliente_id}")
def actualizar_cliente(cliente_id: int, payload: ClienteUpdate, db: Session = Depends(get_db)):
    """Edita nombre/teléfono sin tocar ventas ya registradas."""
    cliente = service.update(db, cliente_id, payload)
    return success(ClienteRead.model_validate(cliente).model_dump())


@router.delete("/{cliente_id}")
def eliminar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    """Elimina cliente si no hay restricciones de datos relacionados."""
    return success(service.delete(db, cliente_id))
