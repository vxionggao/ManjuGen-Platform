from pydantic import BaseModel
from typing import Optional

class SystemConfigBase(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

class SystemConfigOut(SystemConfigBase):
    pass

class SystemConfigIn(SystemConfigBase):
    pass
