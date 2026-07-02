from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.responses import success
from app.schemas.categoria import CategoriaCreate, CategoriaRead, CategoriaUpdate
from app.services.categoria_service import CategoriaService

router = APIRouter(prefix="/api/categorias", tags=["categorias"])
service = CategoriaService()


@router.get("")
def listar_categorias(db: Session = Depends(get_db)):
    """Lista categorías para filtros y formularios de productos."""
    rows = service.list(db)
    return success([CategoriaRead.model_validate(row).model_dump() for row in rows])


@router.get("/{categoria_id}")
def obtener_categoria(categoria_id: int, db: Session = Depends(get_db)):
    """Devuelve categoría y productos asociados como ids simples."""
    categoria = service.get(db, categoria_id)
    data = CategoriaRead.model_validate(categoria).model_dump()
    data["productos"] = [producto.id for producto in categoria.productos]
    return success(data)


@router.post("", status_code=status.HTTP_201_CREATED)
def crear_categoria(payload: CategoriaCreate, db: Session = Depends(get_db)):
    """Crea una nueva categoría de productos."""
    categoria = service.create(db, payload)
    return success(CategoriaRead.model_validate(categoria).model_dump())


@router.put("/{categoria_id}")
def actualizar_categoria(categoria_id: int, payload: CategoriaUpdate, db: Session = Depends(get_db)):
    """Actualiza el nombre de una categoría existente."""
    categoria = service.update(db, categoria_id, payload)
    return success(CategoriaRead.model_validate(categoria).model_dump())


@router.delete("/{categoria_id}")
def eliminar_categoria(categoria_id: int, db: Session = Depends(get_db)):
    """Elimina categoría cuando no rompe relaciones con productos."""
    return success(service.delete(db, categoria_id))
