from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.errors import BusinessError
from app.models.categoria import Categoria
from app.schemas.categoria import CategoriaCreate, CategoriaUpdate


class CategoriaService:
    """Mantiene categorías usadas para ordenar y filtrar productos."""

    def list(self, db: Session) -> list[Categoria]:
        """Ordena por nombre para mostrar selects predecibles en el frontend."""
        return list(db.scalars(select(Categoria).order_by(Categoria.nombre.asc())).all())

    def get(self, db: Session, categoria_id: int) -> Categoria:
        """Obtiene categoría con productos para vistas de detalle."""
        categoria = db.scalar(
            select(Categoria).where(Categoria.id == categoria_id).options(selectinload(Categoria.productos))
        )
        if not categoria:
            raise BusinessError("Categoria no encontrada", 404)
        return categoria

    def create(self, db: Session, payload: CategoriaCreate) -> Categoria:
        """Crea categoría y traduce nombres duplicados a mensaje simple."""
        categoria = Categoria(nombre=payload.nombre)
        db.add(categoria)
        try:
            db.commit()
        except IntegrityError as error:
            db.rollback()
            raise BusinessError("Ya existe una categoria con ese nombre") from error
        db.refresh(categoria)
        return categoria

    def update(self, db: Session, categoria_id: int, payload: CategoriaUpdate) -> Categoria:
        """Actualiza nombre validando duplicados con la restricción de BD."""
        categoria = db.get(Categoria, categoria_id)
        if not categoria:
            raise BusinessError("Categoria no encontrada", 404)
        if payload.nombre is not None:
            categoria.nombre = payload.nombre
        try:
            db.commit()
        except IntegrityError as error:
            db.rollback()
            raise BusinessError("Ya existe una categoria con ese nombre") from error
        db.refresh(categoria)
        return categoria

    def delete(self, db: Session, categoria_id: int) -> dict:
        """Elimina la categoría cuando no existen productos dependientes."""
        categoria = db.get(Categoria, categoria_id)
        if not categoria:
            raise BusinessError("Categoria no encontrada", 404)
        db.delete(categoria)
        db.commit()
        return {"id": categoria_id}
