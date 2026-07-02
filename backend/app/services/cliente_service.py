from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import BusinessError
from app.core.responses import build_meta
from app.models.cliente import Cliente
from app.models.detalle_venta import DetalleVenta
from app.models.producto import Producto
from app.models.venta import Venta
from app.schemas.cliente import ClienteCreate, ClienteUpdate
from app.services.query_service import parse_limit, parse_search


class ClienteService:
    """Administra clientes y permite consultar su historial de ventas."""

    def list(self, db: Session, q: str | None, limit: int | None) -> tuple[list[Cliente], dict]:
        """Busca clientes por nombre o teléfono para formularios con autocompletado."""
        parsed_limit = parse_limit(limit)
        search = parse_search(q)
        stmt = select(Cliente).order_by(Cliente.id.desc()).limit(parsed_limit)
        count_stmt = select(func.count()).select_from(Cliente)
        if search:
            condition = or_(Cliente.nombre.ilike(f"%{search}%"), Cliente.telefono.ilike(f"%{search}%"))
            stmt = stmt.where(condition)
            count_stmt = count_stmt.where(condition)
        rows = list(db.scalars(stmt).all())
        total = int(db.scalar(count_stmt) or 0)
        return rows, build_meta(total, parsed_limit, len(rows))

    def get(self, db: Session, cliente_id: int) -> Cliente:
        """Obtiene un cliente o devuelve error de negocio si no existe."""
        cliente = db.get(Cliente, cliente_id)
        if not cliente:
            raise BusinessError("Cliente no encontrado", 404)
        return cliente

    def list_sales(self, db: Session, cliente_id: int, limit: int | None) -> tuple[list[Venta], dict]:
        """Lista ventas de un cliente con sus detalles para revisión rápida."""
        cliente = self.get(db, cliente_id)
        parsed_limit = parse_limit(limit)
        stmt = (
            select(Venta)
            .where(Venta.Cliente_id == cliente.id)
            .options(selectinload(Venta.detalles).selectinload(DetalleVenta.producto))
            .order_by(Venta.id.desc())
            .limit(parsed_limit)
        )
        rows = list(db.scalars(stmt).all())
        total = int(db.scalar(select(func.count()).select_from(Venta).where(Venta.Cliente_id == cliente.id)) or 0)
        return rows, build_meta(total, parsed_limit, len(rows))

    def create(self, db: Session, payload: ClienteCreate) -> Cliente:
        """Crea un cliente con los datos mínimos que usa la cotización."""
        cliente = Cliente(nombre=payload.nombre, telefono=payload.telefono)
        db.add(cliente)
        db.commit()
        db.refresh(cliente)
        return cliente

    def update(self, db: Session, cliente_id: int, payload: ClienteUpdate) -> Cliente:
        """Actualiza solo campos enviados desde el formulario."""
        cliente = self.get(db, cliente_id)
        data = payload.model_dump(exclude_unset=True)
        for key, value in data.items():
            setattr(cliente, key, value)
        db.commit()
        db.refresh(cliente)
        return cliente

    def delete(self, db: Session, cliente_id: int) -> dict:
        """Elimina un cliente; la BD protege si existen relaciones que lo impidan."""
        cliente = self.get(db, cliente_id)
        db.delete(cliente)
        db.commit()
        return {"id": cliente_id}
