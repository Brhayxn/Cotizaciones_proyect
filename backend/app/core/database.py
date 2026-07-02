from collections.abc import Generator

from sqlalchemy import create_engine, text
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
    create_database_optimizations()


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
