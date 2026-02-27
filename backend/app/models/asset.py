from sqlalchemy import Column, Integer, String, JSON, DateTime
from sqlalchemy.sql import func
from ..db import Base
import time
import uuid

class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(20), nullable=False) # 'role | scene | style'
    aliases = Column(JSON, default=list)
    description = Column(String(1024))
    tags = Column(JSON, default=list)
    cover_image = Column(String(1024))
    gallery = Column(JSON, default=list)
    asset_metadata = Column(JSON, default=dict)
    source = Column(String(20), default="user_upload") # 'built_in | user_upload'
    created_at = Column(Integer, default=lambda: int(time.time()))
    updated_at = Column(Integer, default=lambda: int(time.time()), onupdate=lambda: int(time.time()))
