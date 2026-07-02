from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import BusinessError
from app.core.responses import build_meta
from app.models.categoria import Categoria
from app.models.movimiento_inventario import MovimientoInventario
from app.models.producto import Producto
from app.schemas.producto import ProductoCreate, ProductoUpdate
from app.services.query_service import parse_limit, parse_search


class ProductoService:
    """Maneja productos, filtros de catálogo y estado activo/inactivo."""

    def list(self, db: Session, q: str | None, limit: int | None, categoria: int | None, activo: bool | None) -> tuple[list[Producto], dict]:
        """Lista productos con búsqueda, categoría y estado para la pantalla de venta."""
        parsed_limit = parse_limit(limit)
        search = parse_search(q)
        stmt = select(Producto).options(selectinload(Producto.categoria)).order_by(Producto.id.desc()).limit(parsed_limit)
        count_stmt = select(func.count()).select_from(Producto)
        conditions = []
        if search:
            conditions.append(Producto.nombre.ilike(f"%{search}%"))
        if categoria is not None:
            if categoria < 1:
                raise BusinessError("La categoria debe ser un identificador valido")
            conditions.append(Producto.Categoria_id == categoria)
        if activo is not None:
            conditions.append(Producto.activo == activo)
        for condition in conditions:
            stmt = stmt.where(condition)
            count_stmt = count_stmt.where(condition)
        rows = list(db.scalars(stmt).all())
        total = int(db.scalar(count_stmt) or 0)
        return rows, build_meta(total, parsed_limit, len(rows))

    def get(self, db: Session, producto_id: int) -> Producto:
        """Devuelve un producto con su categoría o lanza error controlado."""
        producto = db.scalar(select(Producto).where(Producto.id == producto_id).options(selectinload(Producto.categoria)))
        if not producto:
            raise BusinessError("Producto no encontrado", 404)
        return producto

    def _validate_category(self, db: Session, categoria_id: int | None) -> None:
        """Evita guardar productos apuntando a categorías inexistentes."""
        if categoria_id is not None and not db.get(Categoria, categoria_id):
            raise BusinessError("La categoria indicada no existe")

    def create(self, db: Session, payload: ProductoCreate) -> Producto:
        """Crea el producto y registra abastecimiento inicial si parte con stock."""
        self._validate_category(db, payload.Categoria_id)
        producto = Producto(**payload.model_dump())
        db.add(producto)
        db.flush()
        if producto.stock > 0:
            db.add(MovimientoInventario(cantidad=producto.stock, tipo_movimiento="abastecimiento", Producto_id=producto.id))
        db.commit()
        return self.get(db, producto.id)

    def update(self, db: Session, producto_id: int, payload: ProductoUpdate) -> Producto:
        """Actualiza solo campos enviados para no pisar datos existentes."""
        producto = self.get(db, producto_id)
        data = payload.model_dump(exclude_unset=True)
        if "Categoria_id" in data:
            self._validate_category(db, data["Categoria_id"])
        for key, value in data.items():
            setattr(producto, key, value)
        db.commit()
        return self.get(db, producto.id)

    def deactivate(self, db: Session, producto_id: int) -> Producto:
        """Borrado lógico: mantiene historial de ventas e inventario asociado."""
        producto = self.get(db, producto_id)
        producto.activo = False
        db.commit()
        return self.get(db, producto.id)

    def set_status(self, db: Session, producto_id: int, activo: bool) -> Producto:
        """Permite reactivar o desactivar un producto desde administración."""
        producto = self.get(db, producto_id)
        producto.activo = activo
        db.commit()
        return self.get(db, producto.id)
