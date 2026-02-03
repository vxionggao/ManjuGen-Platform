from sqlalchemy import Column, BigInteger, Integer, String, Text
from ..db import Base

class Task(Base):
    __tablename__ = "tasks"
    # Use BigInteger for 64-bit ID, and disable autoincrement to allow manual ID
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=False)
    user_id = Column(Integer)
    type = Column(String(50))
    model_id = Column(Integer)
    prompt = Column(Text)
    input_images = Column(Text)
    external_id = Column(String(255))
    status = Column(String(50))
    result_urls = Column(Text)
    video_url = Column(String(1024))
    last_frame_url = Column(String(1024))
    ratio = Column(String(50))
    resolution = Column(String(50))
    duration = Column(Integer)
    frames = Column(Integer)
    created_at = Column(Integer)
    finished_at = Column(Integer)
