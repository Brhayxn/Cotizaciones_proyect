import socketio

from app.core.config import get_settings

settings = get_settings()

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.parsed_socket_origins(),
)


@sio.event
async def connect(sid, environ):
    """Acepta conexiones; la autorización puede agregarse aquí si se necesita."""
    return True


@sio.on("screen:join")
async def screen_join(sid, payload=None):
    """Une una pantalla de cliente a su sala para recibir una cotización específica."""
    payload = payload or {}
    screen_id = payload.get("screenId")
    if not screen_id:
        return
    await sio.enter_room(sid, screen_id)
    await sio.emit("screen:joined", {"ok": True, "screenId": screen_id}, to=sid)


@sio.on("sale:show")
async def sale_show(sid, payload=None):
    """Reenvía la cotización del vendedor a la pantalla del cliente."""
    payload = payload or {}
    screen_id = payload.get("screenId")
    if not screen_id:
        return
    await sio.emit(
        "sale:update",
        {
            "cliente": payload.get("cliente"),
            "items": payload.get("items", []),
            "total": payload.get("total", 0),
        },
        room=screen_id,
    )


@sio.on("sale:clear")
async def sale_clear(sid, payload=None):
    """Limpia la pantalla del cliente cuando el vendedor borra el carrito."""
    payload = payload or {}
    screen_id = payload.get("screenId")
    if not screen_id:
        return
    await sio.emit("sale:update", {"cliente": None, "items": [], "total": 0}, room=screen_id)
