from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Base común para todos los modelos SQLAlchemy del proyecto."""
    pass


settings = get_settings()
engine = create_engine(settings.database_url, echo=settings.database_echo, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Entrega una sesión por request y asegura su cierre al terminar."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    """Registra modelos, crea tablas faltantes y aplica optimizaciones básicas."""
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    apply_schema_updates()
    create_database_optimizations()


def apply_schema_updates() -> None:
    """Aplica cambios aditivos que create_all no incorpora en tablas existentes."""
    inspector = inspect(engine)
    if "ventas" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("ventas")}
    statements = []
    if "estado_pago" not in columns:
        statements.append("ALTER TABLE ventas ADD COLUMN estado_pago VARCHAR(20) NOT NULL DEFAULT 'pendiente'")
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def create_database_optimizations() -> None:
    """Crea índices de búsqueda usados por filtros frecuentes del frontend."""
    statements = [
        "CREATE EXTENSION IF NOT EXISTS pg_trgm",
        "CREATE INDEX IF NOT EXISTS idx_productos_nombre_trgm ON productos USING gin (nombre gin_trgm_ops)",
        "CREATE INDEX IF NOT EXISTS idx_clientes_nombre_trgm ON clientes USING gin (nombre gin_trgm_ops)",
        "CREATE INDEX IF NOT EXISTS idx_clientes_telefono_trgm ON clientes USING gin (telefono gin_trgm_ops)",
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
