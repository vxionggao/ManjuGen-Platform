from sqlalchemy import Column, BigInteger, Integer, String, Text
from ..db import Base

class Task(Base):
    __tablename__ = "tasks"
    # Use BigInteger for 64-bit ID, and disable autoincrement to allow manual ID
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=False)
    user_id = Column(Integer)
    type = Column(String)
    model_id = Column(Integer)
    prompt = Column(Text)
    input_images = Column(Text)
    external_id = Column(String)
    status = Column(String)
    result_urls = Column(Text)
    video_url = Column(String)
    last_frame_url = Column(String)
    ratio = Column(String)
    resolution = Column(String)
    duration = Column(Integer)
    frames = Column(Integer)
    created_at = Column(Integer)
    finished_at = Column(Integer)
