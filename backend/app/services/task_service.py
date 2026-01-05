import time
import random
from sqlalchemy.orm import Session
from ..repositories.task_repo import TaskRepo
from ..models.task import Task

class TaskService:
    def __init__(self, repo: TaskRepo):
        self.repo = repo
        
    def generate_id(self, user_id: int) -> int:
        # Generate 64-bit ID based on Snowflake algorithm
        # Use a custom epoch to reduce the timestamp size
        # Epoch: 2024-01-01 00:00:00 UTC = 1704067200000 ms
        EPOCH = 1704067200000
        
        # 41 bits for timestamp delta (ms) - good for ~69 years from epoch
        # 10 bits for user_id (max 1023)
        # 12 bits for random sequence (max 4095)
        
        timestamp = int(time.time() * 1000) - EPOCH
        
        # Ensure user_id fits in 10 bits
        uid = user_id % 1024
        rnd = random.randint(0, 4095)
        
        # Structure: [Timestamp 41][User 10][Random 12]
        # Total bits: 41 + 10 + 12 = 63 bits (fits in signed 64-bit integer)
        new_id = (timestamp << 22) | (uid << 12) | rnd
        return new_id

    def create_task(self, db: Session, data: dict):
        if "id" not in data:
            data["id"] = self.generate_id(data.get("user_id", 0))
        return self.repo.create(db, data)
        
    def advance_status(self, db: Session, task_id: int, status: str):
        updates = {Task.status: status}
        if status in ["succeeded", "failed", "cancelled", "expired"]:
            updates[Task.finished_at] = int(time.time())
        db.query(Task).filter(Task.id == task_id).update(updates)
        db.commit()
