from sqlalchemy import Column, String
from ..db import Base

class SystemConfig(Base):
    __tablename__ = "system_configs"
    key = Column(String(255), primary_key=True, index=True)
    value = Column(String(1024))
    description = Column(String(1024), nullable=True)
