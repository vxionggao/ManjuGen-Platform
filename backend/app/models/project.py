
from sqlalchemy import Column, String, Integer, Text, DateTime
from ..db import Base
from datetime import datetime
import json

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, index=True) # UUID
    title = Column(String, index=True)
    cover_image = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    data = Column(Text) # Store full JSON state: story, characters, scenes, etc.

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "cover_image": self.cover_image,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M"),
            "data": json.loads(self.data) if self.data else {}
        }
