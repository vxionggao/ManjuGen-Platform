from datetime import datetime
from sqlalchemy.orm import Session
from ..repositories.quota_repo import QuotaRepo
from ..repositories.model_repo import ModelConfigRepo
from ..models.model_config import ModelConfig

class ModelQuotaService:
    def __init__(self, model_repo: ModelConfigRepo, quota_repo: QuotaRepo):
        self.model_repo = model_repo
        self.quota_repo = quota_repo
    def consume_request(self, db: Session, model_id: int) -> bool:
        date = datetime.utcnow().strftime("%Y-%m-%d")
        count = self.quota_repo.inc(db, model_id, date)
        m = db.query(ModelConfig).get(model_id)
        if not m:
            return False
        return count <= m.request_quota
