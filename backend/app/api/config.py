from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from ..schemas.model import ModelConfigIn, ModelConfigOut
from ..db import SessionLocal
from ..repositories.model_repo import ModelConfigRepo
from ..models.model_config import ModelConfig
from ..services.worker_singleton import worker
from ..services.token_bucket import TokenBucket
from ..repositories.system_config_repo import SystemConfigRepo
from ..schemas.system_config import SystemConfigOut, SystemConfigIn
from ..services.llm_models.manager import model_manager

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/models", response_model=list[ModelConfigOut])
def list_models():
    db: Session = SessionLocal()
    repo = ModelConfigRepo()
    ms = repo.list(db)
    out = []
    for m in ms:
        validation = model_manager.get_model_validation_info(m.name, m.type)
        out.append(ModelConfigOut(
            id=m.id, 
            name=m.name, 
            endpoint_id=m.endpoint_id, 
            type=m.type, 
            concurrency_quota=m.concurrency_quota, 
            request_quota=m.request_quota,
            validation_info=validation
        ))
    db.close()
    return out

@router.post("/models", response_model=ModelConfigOut)
def create_model(payload: ModelConfigIn):
    db: Session = SessionLocal()
    repo = ModelConfigRepo()
    mc = repo.create(db, payload.dict())
    worker.buckets[mc.id] = TokenBucket(mc.concurrency_quota)
    db.close()
    return ModelConfigOut(id=mc.id, name=mc.name, endpoint_id=mc.endpoint_id, type=mc.type, concurrency_quota=mc.concurrency_quota, request_quota=mc.request_quota)

@router.put("/models/{model_id}", response_model=ModelConfigOut)
def update_model(model_id: int, payload: ModelConfigIn):
    db: Session = SessionLocal()
    repo = ModelConfigRepo()
    mc = repo.update(db, model_id, payload.dict())
    if not mc:
        db.close()
        raise HTTPException(status_code=404, detail="Model not found")
    
    # Update token bucket if concurrency quota changed
    if mc.concurrency_quota:
         worker.buckets[mc.id] = TokenBucket(mc.concurrency_quota)
         
    db.close()
    return ModelConfigOut(id=mc.id, name=mc.name, endpoint_id=mc.endpoint_id, type=mc.type, concurrency_quota=mc.concurrency_quota, request_quota=mc.request_quota)

@router.get("/system-configs", response_model=list[SystemConfigOut])
def list_system_configs():
    db: Session = SessionLocal()
    repo = SystemConfigRepo()
    configs = repo.list(db)
    out = [SystemConfigOut(key=c.key, value=c.value, description=c.description) for c in configs]
    db.close()
    return out

@router.post("/system-configs", response_model=SystemConfigOut)
def update_system_config(payload: SystemConfigIn):
    db: Session = SessionLocal()
    repo = SystemConfigRepo()
    c = repo.set(db, payload.key, payload.value, payload.description)
    db.close()
    return SystemConfigOut(key=c.key, value=c.value, description=c.description)
