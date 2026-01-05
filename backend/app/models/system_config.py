from sqlalchemy import Column, String
from ..db import Base

class SystemConfig(Base):
    __tablename__ = "system_configs"
    key = Column(String, primary_key=True, index=True)
    value = Column(String)
    description = Column(String, nullable=True)
