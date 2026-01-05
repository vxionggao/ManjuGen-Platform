from sqlalchemy import Column, Integer, String
from ..db import Base

class ModelConfig(Base):
    __tablename__ = "models"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    endpoint_id = Column(String)
    type = Column(String)
    concurrency_quota = Column(Integer)
    request_quota = Column(Integer)
