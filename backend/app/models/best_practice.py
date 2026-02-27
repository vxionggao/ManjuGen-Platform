from sqlalchemy import Column, Integer, String, Text
import time
from ..db import Base

class BestPractice(Base):
    __tablename__ = "best_practices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    url = Column(String)  # Image URL (TOS or local)
    category = Column(String)  # role, scene, item, style, etc.
    prompt = Column(Text)
    model_name = Column(String)
    created_at = Column(Integer, default=lambda: int(time.time()))
