from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import BusinessError
from app.core.responses import build_meta
from app.models.movimiento_inventario import MovimientoInventario
from app.models.producto import Producto
from app.schemas.inventario import MovimientoCreate
from app.services.query_service import parse_limit, parse_search


class InventarioService:
    """Consulta resumen de stock y registra movimientos manuales de inventario."""

    def summary(self, db: Session) -> dict:
        """Entrega métricas simples para tarjetas del dashboard/inventario."""
        productos = int(db.scalar(select(func.count()).select_from(Producto)) or 0)
        stock_total = int(db.scalar(select(func.coalesce(func.sum(Producto.stock), 0))) or 0)
        stock_bajo = int(db.scalar(select(func.count()).select_from(Producto).where(Producto.stock <= 3)) or 0)
        return {"productos": productos, "stockTotal": stock_total, "stockBajo": stock_bajo}

    def list_movements(
        self,
        db: Session,
        q: str | None,
        limit: int | None,
        producto: int | None,
        tipo: str | None,
    ) -> tuple[list[MovimientoInventario], dict]:
        """Lista movimientos con filtros para auditar entradas, ventas y anulaciones."""
        parsed_limit = parse_limit(limit)
        search = parse_search(q)
        stmt = (
            select(MovimientoInventario)
            .join(MovimientoInventario.producto)
            .options(selectinload(MovimientoInventario.producto).selectinload(Producto.categoria))
            .order_by(MovimientoInventario.fecha_hora.desc(), MovimientoInventario.id.desc())
            .limit(parsed_limit)
        )
        count_stmt = select(func.count()).select_from(MovimientoInventario).join(MovimientoInventario.producto)
        conditions = []
        if search:
            conditions.append(Producto.nombre.ilike(f"%{search}%"))
        if producto is not None:
            if producto < 1:
                raise BusinessError("El producto debe ser un identificador valido")
            conditions.append(MovimientoInventario.Producto_id == producto)
        if tipo is not None:
            if tipo not in {"ajuste", "venta", "abastecimiento", "anulacion"}:
                raise BusinessError("El tipo de movimiento no es valido")
            conditions.append(MovimientoInventario.tipo_movimiento == tipo)
        for condition in conditions:
            stmt = stmt.where(condition)
            count_stmt = count_stmt.where(condition)
        rows = list(db.scalars(stmt).all())
        total = int(db.scalar(count_stmt) or 0)
        return rows, build_meta(total, parsed_limit, len(rows))

    def create_manual_movement(self, db: Session, payload: MovimientoCreate) -> tuple[MovimientoInventario, int]:
        """Registra movimientos manuales; devuelve el producto afectado para notificar por socket."""
        if payload.tipo_movimiento not in {"abastecimiento", "ajuste"}:
            raise BusinessError("Solo se permiten movimientos manuales de abastecimiento o merma")
        producto = db.get(Producto, payload.Producto_id)
        if not producto:
            raise BusinessError("Producto no encontrado", 404)
        if payload.tipo_movimiento == "abastecimiento":
            producto.stock += payload.cantidad
        else:
            if producto.stock < payload.cantidad:
                raise BusinessError("La merma no puede superar el stock disponible")
            producto.stock -= payload.cantidad
        movimiento = MovimientoInventario(
            cantidad=payload.cantidad,
            tipo_movimiento=payload.tipo_movimiento,
            Producto_id=producto.id,
        )
        db.add(movimiento)
        db.commit()
        db.refresh(movimiento)
        return movimiento, producto.id
