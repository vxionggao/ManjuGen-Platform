from sqlalchemy.orm import Session
from typing import Optional
from ..models.quota_usage import QuotaUsage

class QuotaRepo:
    def get(self, db: Session, model_id: int, date: str) -> Optional[QuotaUsage]:
        return db.query(QuotaUsage).filter(QuotaUsage.model_id == model_id, QuotaUsage.date == date).first()
    def inc(self, db: Session, model_id: int, date: str) -> int:
        q = self.get(db, model_id, date)
        if not q:
            q = QuotaUsage(model_id=model_id, date=date, count=0)
            db.add(q)
        q.count += 1
        db.commit()
        db.refresh(q)
        return q.count
