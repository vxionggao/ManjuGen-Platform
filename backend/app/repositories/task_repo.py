import json
from sqlalchemy.orm import Session
from typing import Optional, List
from ..models.task import Task

class TaskRepo:
    def create(self, db: Session, data: dict) -> Task:
        t = Task(**data)
        db.add(t)
        db.commit()
        db.refresh(t)
        return t
    def update_status(self, db: Session, task_id: int, status: str, finished_at: Optional[int] = None) -> None:
        data = {Task.status: status}
        if finished_at:
            data[Task.finished_at] = finished_at
        db.query(Task).filter(Task.id == task_id).update(data)
        db.commit()
    def set_result(self, db: Session, task_id: int, urls: List[str]) -> None:
        db.query(Task).filter(Task.id == task_id).update({Task.result_urls: json.dumps(urls)})
        db.commit()
    def update_external_id(self, db: Session, task_id: int, external_id: str) -> None:
        db.query(Task).filter(Task.id == task_id).update({Task.external_id: external_id})
        db.commit()
    def set_video_result(self, db: Session, task_id: int, video_url: str, last_frame_url: Optional[str]) -> None:
        values = {Task.video_url: video_url}
        if last_frame_url:
            values[Task.last_frame_url] = last_frame_url
        db.query(Task).filter(Task.id == task_id).update(values)
        db.commit()
    def list_by_user(self, db: Session, user_id: int) -> List[Task]:
        return db.query(Task).filter(Task.user_id == user_id).all()
    def clear_all(self, db: Session, user_id: int) -> None:
        db.query(Task).filter(Task.user_id == user_id).delete()
        db.commit()
