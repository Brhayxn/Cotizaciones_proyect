def success(data=None, meta=None) -> dict:
    """Formato estándar de respuestas exitosas para todo el backend."""
    payload = {"ok": True, "data": data}
    if meta is not None:
        payload["meta"] = meta
    return payload


def build_meta(total: int, limit: int | None, count: int) -> dict:
    """Metadata de listados para avisar si hay más resultados disponibles."""
    return {"limit": limit, "total": total, "hasMore": total > count}
