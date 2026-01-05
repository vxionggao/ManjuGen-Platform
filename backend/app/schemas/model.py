from pydantic import BaseModel
from typing import Optional

class ModelConfigIn(BaseModel):
    name: str
    endpoint_id: Optional[str] = None
    type: str
    concurrency_quota: int
    request_quota: int

class ModelConfigOut(ModelConfigIn):
    id: int
    validation_info: Optional[dict] = None
