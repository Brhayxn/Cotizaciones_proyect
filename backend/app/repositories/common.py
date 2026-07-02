from sqlalchemy.orm import Session


class BaseRepository:
    """Repositorio base mínimo para CRUD compartido si se agregan repositorios concretos."""
    def __init__(self, model):
        self.model = model

    def get(self, db: Session, item_id: int):
        """Obtiene por clave primaria usando el modelo configurado."""
        return db.get(self.model, item_id)

    def add(self, db: Session, item):
        """Agrega y hace flush para disponer del id antes del commit."""
        db.add(item)
        db.flush()
        return item

    def delete(self, db: Session, item) -> None:
        """Elimina y hace flush para detectar errores antes del commit externo."""
        db.delete(item)
        db.flush()
