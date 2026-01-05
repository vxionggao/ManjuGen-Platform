from sqlalchemy import Column, Integer, String
from ..db import Base

class QuotaUsage(Base):
    __tablename__ = "quota_usage"
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer)
    date = Column(String)
    count = Column(Integer)
