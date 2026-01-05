from sqlalchemy.orm import Session
from ..models.system_config import SystemConfig

class SystemConfigRepo:
    def get(self, db: Session, key: str):
        return db.query(SystemConfig).filter(SystemConfig.key == key).first()

    def list(self, db: Session):
        return db.query(SystemConfig).all()

    def set(self, db: Session, key: str, value: str, description: str = None):
        config = self.get(db, key)
        if config:
            config.value = value
            if description:
                config.description = description
        else:
            config = SystemConfig(key=key, value=value, description=description)
            db.add(config)
        db.commit()
        db.refresh(config)
        return config
