from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.producto import Producto
from app.websockets.socketio import sio


async def emit_stock_updates(db: Session, product_ids: list[int], reason: str, socket_id: str | None = None) -> None:
    """Notifica cambios de stock para sincronizar carritos abiertos en tiempo real."""
    ids = sorted({int(product_id) for product_id in product_ids if product_id})
    if not ids:
        return

    # Forzamos recarga desde la BD para emitir el stock final después del commit/flush.
    db.expire_all()
    products = db.scalars(select(Producto).where(Producto.id.in_(ids))).all()
    payload = {
        "reason": reason,
        "products": [
            {"id": product.id, "nombre": product.nombre, "stock": product.stock, "activo": product.activo}
            for product in products
        ],
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    await sio.emit("inventory:stock", payload, skip_sid=socket_id)
