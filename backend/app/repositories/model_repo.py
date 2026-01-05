from typing import Optional, List
from sqlalchemy.orm import Session
from ..models.model_config import ModelConfig

class ModelConfigRepo:
    def list(self, db: Session) -> List[ModelConfig]:
        return db.query(ModelConfig).all()
    def create(self, db: Session, m: dict) -> ModelConfig:
        mc = ModelConfig(**m)
        db.add(mc)
        db.commit()
        db.refresh(mc)
        return mc
    def update(self, db: Session, id: int, data: dict) -> Optional[ModelConfig]:
        mc = db.query(ModelConfig).filter(ModelConfig.id == id).first()
        if not mc:
            return None
        for k, v in data.items():
            if hasattr(mc, k):
                setattr(mc, k, v)
        db.commit()
        db.refresh(mc)
        return mc
