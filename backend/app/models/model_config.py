from sqlalchemy import Column, Integer, String
from ..db import Base

class ModelConfig(Base):
    __tablename__ = "models"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))
    endpoint_id = Column(String(255))
    type = Column(String(50))
    concurrency_quota = Column(Integer)
    request_quota = Column(Integer)
