from __future__ import annotations

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import BusinessError
from app.core.responses import build_meta
from app.models.cliente import Cliente
from app.models.detalle_venta import DetalleVenta
from app.models.pago_venta import PagoVenta
from app.models.producto import Producto
from app.models.venta import Venta
from app.schemas.cliente import ClienteCreate, ClienteUpdate
from app.services.query_service import parse_limit, parse_search


class ClienteService:
    """Administra clientes y permite consultar su historial de ventas."""

    def list(self, db: Session, q: str | None, limit: int | None, con_deuda: bool | None = None) -> tuple[list[Cliente], dict]:
        """Busca clientes por nombre o teléfono para formularios con autocompletado."""
        parsed_limit = parse_limit(limit)
        search = parse_search(q)
        paid_subq = (
            select(PagoVenta.Venta_id.label("venta_id"), func.coalesce(func.sum(PagoVenta.monto), 0).label("pagado"))
            .group_by(PagoVenta.Venta_id)
            .subquery()
        )
        debt = Venta.totalVenta - func.coalesce(paid_subq.c.pagado, 0)
        positive_debt = case((debt > 0, debt), else_=0)
        total_debt = func.coalesce(func.sum(positive_debt), 0)
        pending_sales = func.count(case((debt > 0, 1)))
        conditions = []
        if search:
            conditions.append(or_(Cliente.nombre.ilike(f"%{search}%"), Cliente.telefono.ilike(f"%{search}%")))

        base_stmt = (
            select(Cliente, total_debt.label("deuda_total"), pending_sales.label("ventas_pendientes"))
            .outerjoin(Venta, (Venta.Cliente_id == Cliente.id) & (Venta.estado == "confirmada"))
            .outerjoin(paid_subq, paid_subq.c.venta_id == Venta.id)
            .group_by(Cliente.id)
        )
        if conditions:
            base_stmt = base_stmt.where(*conditions)
        if con_deuda is True:
            base_stmt = base_stmt.having(total_debt > 0)
        elif con_deuda is False:
            base_stmt = base_stmt.having(total_debt <= 0)

        stmt = base_stmt.order_by(Cliente.id.desc()).limit(parsed_limit)
        count_subq = base_stmt.with_only_columns(Cliente.id).order_by(None).subquery()
        total = int(db.scalar(select(func.count()).select_from(count_subq)) or 0)
        rows = []
        for cliente, deuda_total, ventas_pendientes in db.execute(stmt).all():
            cliente.deuda_total = int(deuda_total or 0)
            cliente.ventas_pendientes = int(ventas_pendientes or 0)
            rows.append(cliente)
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
            .options(selectinload(Venta.detalles).selectinload(DetalleVenta.producto), selectinload(Venta.pagos))
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
