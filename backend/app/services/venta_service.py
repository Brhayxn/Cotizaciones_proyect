from __future__ import annotations

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.core.errors import BusinessError
from app.core.responses import build_meta
from app.models.cliente import Cliente
from app.models.detalle_venta import DetalleVenta
from app.models.movimiento_inventario import MovimientoInventario
from app.models.pago_venta import PagoVenta
from app.models.producto import Producto
from app.models.venta import Venta
from app.schemas.venta import PagoVentaCreate, VentaCreate
from app.services.date_service import chile_start_of_day
from app.services.payment_service import calculate_payment_totals, is_valid_payment_method
from app.services.query_service import parse_limit

ESTADOS_VENTA = {"cotizada", "confirmada", "anulada"}


class VentaService:
    """Agrupa reglas de cotizaciones, ventas y descuento de stock."""

    def _full_sale_options(self):
        """Carga relaciones necesarias para responder una venta completa sin consultas extra."""
        return (
            selectinload(Venta.cliente),
            selectinload(Venta.detalles).selectinload(DetalleVenta.producto).selectinload(Producto.categoria),
            selectinload(Venta.movimientosInventario).selectinload(MovimientoInventario.producto).selectinload(Producto.categoria),
            selectinload(Venta.pagos),
        )

    def get(self, db: Session, venta_id: int) -> Venta:
        """Busca una venta por id y falla con error legible si no existe."""
        venta = db.scalar(select(Venta).where(Venta.id == venta_id).options(*self._full_sale_options()))
        if not venta:
            raise BusinessError("Venta no encontrada", 404)
        return venta

    def list(self, db: Session, estado: str | None, limit: int | None) -> tuple[list[Venta], dict]:
        """Lista ventas con paginación simple y filtro opcional por estado."""
        parsed_limit = parse_limit(limit)
        stmt = select(Venta).options(*self._full_sale_options()).order_by(Venta.fecha.desc(), Venta.id.desc()).limit(parsed_limit)
        count_stmt = select(func.count()).select_from(Venta)
        if estado:
            if estado not in ESTADOS_VENTA:
                raise BusinessError("Estado de venta invalido")
            stmt = stmt.where(Venta.estado == estado)
            count_stmt = count_stmt.where(Venta.estado == estado)
        rows = list(db.scalars(stmt).all())
        total = int(db.scalar(count_stmt) or 0)
        return rows, build_meta(total, parsed_limit, len(rows))

    def list_from_days(self, db: Session, days_ago: int, limit: int | None) -> tuple[list[Venta], dict | None]:
        """Obtiene ventas o pagos desde el inicio del día indicado en zona horaria chilena."""
        parsed_limit = parse_limit(limit, optional=True)
        start = chile_start_of_day(days_ago)
        paid_in_period = select(PagoVenta.Venta_id).where(PagoVenta.fecha >= start)
        period_condition = or_(Venta.fecha >= start, Venta.id.in_(paid_in_period))
        stmt = select(Venta).where(period_condition).options(*self._full_sale_options()).order_by(Venta.fecha.desc(), Venta.id.desc())
        if parsed_limit:
            stmt = stmt.limit(parsed_limit)
        rows = list(db.scalars(stmt).all())
        if not parsed_limit:
            return rows, None
        total = int(db.scalar(select(func.count()).select_from(Venta).where(period_condition)) or 0)
        return rows, build_meta(total, parsed_limit, len(rows))

    def create(self, db: Session, payload: VentaCreate) -> tuple[Venta, list[int] | None]:
        """Crea una cotización y, si llega confirmada, descuenta stock en la misma operación."""
        if payload.estado not in {"cotizada", "confirmada"}:
            raise BusinessError("Una venta nueva solo puede iniciar como cotizada o confirmada")
        if payload.metodo_pago and not is_valid_payment_method(payload.metodo_pago):
            raise BusinessError("El metodo de pago no es valido")

        try:
            cliente = self._resolve_client(db, payload)
            detalles = self._prepare_details(db, payload)
            # El total se recalcula en backend para no confiar en montos enviados desde la UI.
            total_sin_redondeo = sum(detalle["subtotal"] for detalle in detalles)
            venta = Venta(
                totalVenta=total_sin_redondeo,
                total_sin_redondeo=total_sin_redondeo,
                ajuste_redondeo=0,
                metodo_pago=None,
                estado="cotizada",
                Cliente_id=cliente.id if cliente else None,
            )
            db.add(venta)
            db.flush()
            for detalle_data in detalles:
                db.add(DetalleVenta(**detalle_data, Venta_id=venta.id))
            db.flush()
            updated_product_ids = None
            if payload.estado == "confirmada":
                updated_product_ids = self._confirm_in_transaction(db, venta, payload.metodo_pago, payload.monto_pagado)
            db.commit()
            return self.get(db, venta.id), updated_product_ids
        except Exception:
            db.rollback()
            raise

    def confirm(self, db: Session, venta_id: int, metodo_pago: str | None, monto_pagado: int | None = None) -> tuple[Venta, list[int]]:
        """Convierte una cotización en venta real y devuelve productos afectados."""
        try:
            venta = db.get(Venta, venta_id)
            if not venta:
                raise BusinessError("Venta no encontrada", 404)
            updated_product_ids = self._confirm_in_transaction(db, venta, metodo_pago, monto_pagado)
            db.commit()
            return self.get(db, venta_id), updated_product_ids
        except Exception:
            db.rollback()
            raise

    def register_payment(self, db: Session, venta_id: int, payload: PagoVentaCreate) -> Venta:
        """Registra un pago posterior sin tocar inventario."""
        if not is_valid_payment_method(payload.metodo_pago):
            raise BusinessError("El metodo de pago no es valido")
        try:
            venta = db.scalar(select(Venta).where(Venta.id == venta_id).options(selectinload(Venta.pagos)))
            if not venta:
                raise BusinessError("Venta no encontrada", 404)
            if venta.estado != "confirmada":
                raise BusinessError("Solo se pueden registrar pagos en ventas confirmadas")
            if payload.monto > venta.saldo_pendiente:
                raise BusinessError("El pago supera el saldo pendiente")
            venta.pagos.append(PagoVenta(
                monto=payload.monto,
                metodo_pago=payload.metodo_pago,
                nota=payload.nota.strip() if payload.nota else None,
            ))
            if not venta.metodo_pago:
                venta.metodo_pago = payload.metodo_pago
            db.flush()
            self._update_payment_state(venta)
            db.commit()
            return self.get(db, venta_id)
        except Exception:
            db.rollback()
            raise

    def cancel(self, db: Session, venta_id: int) -> tuple[Venta, list[int]]:
        """Anula una venta; si ya descontó stock, lo restaura con movimientos de inventario."""
        try:
            venta = db.scalar(select(Venta).where(Venta.id == venta_id).options(selectinload(Venta.detalles)))
            if not venta:
                raise BusinessError("Venta no encontrada", 404)
            if venta.estado == "anulada":
                raise BusinessError("La venta ya esta anulada")
            restored_ids = []
            if venta.estado == "confirmada":
                # Solo las ventas confirmadas tocaron inventario, por eso son las únicas que restauran stock.
                for detalle in venta.detalles:
                    producto = db.get(Producto, detalle.Producto_id)
                    if not producto:
                        raise BusinessError("Error al anular venta", 500)
                    producto.stock += detalle.cantidad
                    db.add(MovimientoInventario(
                        cantidad=detalle.cantidad,
                        tipo_movimiento="anulacion",
                        Producto_id=producto.id,
                        Venta_id=venta.id,
                        DetalleVenta_id=detalle.id,
                    ))
                    restored_ids.append(producto.id)
            venta.estado = "anulada"
            db.commit()
            return self.get(db, venta_id), restored_ids
        except Exception:
            db.rollback()
            raise

    def delete(self, db: Session, venta_id: int) -> dict:
        """Elimina solo cotizaciones o ventas no confirmadas para no perder historial real."""
        venta = db.get(Venta, venta_id)
        if not venta:
            raise BusinessError("Venta no encontrada", 404)
        if venta.estado == "confirmada":
            raise BusinessError("No se puede eliminar una venta confirmada; debe anularse")
        db.delete(venta)
        db.commit()
        return {"id": venta_id}

    def _resolve_client(self, db: Session, payload: VentaCreate) -> Cliente | None:
        """Usa un cliente existente o crea uno mínimo desde los datos de la cotización."""
        if payload.Cliente_id:
            cliente = db.get(Cliente, payload.Cliente_id)
            if not cliente:
                raise BusinessError("El cliente indicado no existe")
            return cliente
        if not payload.cliente or not payload.cliente.nombre.strip():
            return None
        nombre = payload.cliente.nombre.strip()
        telefono = payload.cliente.telefono or None
        cliente = db.scalar(select(Cliente).where(Cliente.nombre == nombre, Cliente.telefono == telefono))
        if cliente:
            return cliente
        cliente = Cliente(nombre=nombre, telefono=telefono)
        db.add(cliente)
        db.flush()
        return cliente

    def _prepare_details(self, db: Session, payload: VentaCreate) -> list[dict]:
        """Prepara snapshots de productos para que la venta conserve precio y nombre históricos."""
        if not payload.items:
            raise BusinessError("La venta debe tener al menos un item")
        # Se consultan todos los productos juntos para validar existencia y evitar N consultas.
        product_ids = sorted({item.Producto_id for item in payload.items})
        products = db.scalars(select(Producto).where(Producto.id.in_(product_ids), Producto.activo.is_(True))).all()
        products_by_id = {product.id: product for product in products}
        if len(products_by_id) != len(product_ids):
            raise BusinessError("Uno o mas productos no existen o estan inactivos")
        detalles = []
        for item in payload.items:
            product = products_by_id[item.Producto_id]
            if item.descuento_aplicado > product.descuento_maximo:
                raise BusinessError("El descuento aplicado supera el maximo permitido para un producto")
            subtotal = self._calculate_subtotal(item.cantidad, product.precio, item.descuento_aplicado)
            detalles.append({
                "cantidad": item.cantidad,
                "nombre_producto": product.nombre,
                "precio_unitario": product.precio,
                "subtotal": subtotal,
                "descuento_aplicado": item.descuento_aplicado,
                "Producto_id": product.id,
            })
        return detalles

    def _confirm_in_transaction(self, db: Session, venta: Venta, metodo_pago: str | None, monto_pagado: int | None) -> list[int]:
        """Aplica reglas finales de confirmación y descuenta stock de forma atómica."""
        venta = db.scalar(select(Venta).where(Venta.id == venta.id).options(selectinload(Venta.detalles), selectinload(Venta.pagos)))
        if not venta:
            raise BusinessError("Venta no encontrada", 404)
        if venta.estado != "cotizada":
            raise BusinessError("Solo una venta cotizada puede confirmarse")

        updated_product_ids = []
        for detalle in venta.detalles:
            product = db.get(Producto, detalle.Producto_id)
            if not product or not product.activo:
                raise BusinessError("Uno o mas productos no existen o estan inactivos")
            if detalle.descuento_aplicado > product.descuento_maximo:
                raise BusinessError("El descuento aplicado supera el maximo permitido para un producto")
            # El UPDATE valida stock en la misma sentencia para reducir carreras entre vendedores.
            result = db.execute(
                update(Producto)
                .where(Producto.id == detalle.Producto_id, Producto.activo.is_(True), Producto.stock >= detalle.cantidad)
                .values(stock=Producto.stock - detalle.cantidad)
            )
            if result.rowcount != 1:
                raise BusinessError("Stock insuficiente para confirmar la venta")
            db.add(MovimientoInventario(
                cantidad=detalle.cantidad,
                tipo_movimiento="venta",
                Producto_id=detalle.Producto_id,
                Venta_id=venta.id,
                DetalleVenta_id=detalle.id,
            ))
            updated_product_ids.append(detalle.Producto_id)

        total_sin_redondeo = sum(detalle.subtotal for detalle in venta.detalles)
        totals = calculate_payment_totals(total_sin_redondeo, metodo_pago)
        initial_payment = totals["finalTotal"] if monto_pagado is None else int(monto_pagado)
        if initial_payment < 0:
            raise BusinessError("El monto pagado no puede ser negativo")
        if initial_payment > totals["finalTotal"]:
            raise BusinessError("El pago supera el total de la venta")
        if initial_payment > 0:
            if not metodo_pago:
                raise BusinessError("Debes seleccionar un metodo de pago para registrar el pago")
            if not is_valid_payment_method(metodo_pago):
                raise BusinessError("El metodo de pago no es valido")
        elif metodo_pago and not is_valid_payment_method(metodo_pago):
            raise BusinessError("El metodo de pago no es valido")

        venta.estado = "confirmada"
        venta.metodo_pago = metodo_pago
        venta.total_sin_redondeo = totals["unroundedTotal"]
        venta.ajuste_redondeo = totals["roundingAdjustment"]
        venta.totalVenta = totals["finalTotal"]
        if initial_payment > 0:
            venta.pagos.append(PagoVenta(monto=initial_payment, metodo_pago=metodo_pago))
        db.flush()
        self._update_payment_state(venta)
        return updated_product_ids

    @staticmethod
    def _update_payment_state(venta: Venta) -> None:
        """Deriva estado financiero desde pagos vigentes."""
        paid = venta.total_pagado
        if paid <= 0:
            venta.estado_pago = "pendiente"
        elif paid < venta.totalVenta:
            venta.estado_pago = "parcial"
        else:
            venta.estado_pago = "pagada"

    @staticmethod
    def _calculate_subtotal(cantidad: int, precio_unitario: int, descuento_aplicado: int) -> int:
        """Calcula subtotal con redondeo entero consistente con el frontend."""
        numerator = cantidad * precio_unitario * (100 - descuento_aplicado)
        return (numerator + 50) // 100
