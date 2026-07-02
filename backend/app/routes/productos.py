from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.responses import success
from app.schemas.producto import ProductoCreate, ProductoEstadoUpdate, ProductoRead, ProductoUpdate
from app.services.producto_service import ProductoService

router = APIRouter(prefix="/api/productos", tags=["productos"])
service = ProductoService()


@router.get("")
def listar_productos(
    q: str | None = None,
    limit: int | None = Query(default=None),
    categoria: int | None = None,
    activo: bool | None = None,
    db: Session = Depends(get_db),
):
    """GET /api/productos: catálogo filtrable para administración y venta."""
    rows, meta = service.list(db, q, limit, categoria, activo)
    return success([ProductoRead.model_validate(row).model_dump() for row in rows], meta)


@router.get("/{producto_id}")
def obtener_producto(producto_id: int, db: Session = Depends(get_db)):
    """Devuelve un producto individual para validar stock fresco desde el frontend."""
    producto = service.get(db, producto_id)
    return success(ProductoRead.model_validate(producto).model_dump())


@router.post("", status_code=status.HTTP_201_CREATED)
def crear_producto(payload: ProductoCreate, db: Session = Depends(get_db)):
    """Crea producto y deja el servicio registrar stock inicial si aplica."""
    producto = service.create(db, payload)
    return success(ProductoRead.model_validate(producto).model_dump())


@router.put("/{producto_id}")
def actualizar_producto(producto_id: int, payload: ProductoUpdate, db: Session = Depends(get_db)):
    """Actualiza datos editables del producto."""
    producto = service.update(db, producto_id, payload)
    return success(ProductoRead.model_validate(producto).model_dump())


@router.delete("/{producto_id}")
def eliminar_producto(producto_id: int, db: Session = Depends(get_db)):
    """Desactiva el producto sin borrar historial."""
    producto = service.deactivate(db, producto_id)
    return success(ProductoRead.model_validate(producto).model_dump())


@router.patch("/{producto_id}/estado")
def cambiar_estado_producto(producto_id: int, payload: ProductoEstadoUpdate, db: Session = Depends(get_db)):
    """Reactiva o desactiva un producto desde la interfaz."""
    producto = service.set_status(db, producto_id, payload.activo)
    return success(ProductoRead.model_validate(producto).model_dump())
