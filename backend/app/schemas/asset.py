from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class AssetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: str = Field(..., pattern="^(role|scene|style|image|video|script|item)$")
    aliases: Optional[List[str]] = []
    description: Optional[str] = ""
    tags: Optional[List[str]] = []
    cover_image: Optional[str] = ""
    gallery: Optional[List[str]] = []
    metadata: Optional[Dict[str, Any]] = {}
    source: Optional[str] = Field(default="user_upload", pattern="^(built_in|user_upload|vikingdb)$")

class AssetCreate(AssetBase):
    pass

class AssetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    aliases: Optional[List[str]] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    cover_image: Optional[str] = None
    gallery: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None

class AssetOut(AssetBase):
    id: int
    asset_id: str
    created_at: int
    updated_at: int
    
    class Config:
        from_attributes = True

class AssetSearchRequest(BaseModel):
    q: Optional[str] = ""
    type: Optional[str] = None
    topk: Optional[int] = 10

class AssetResolverRequest(BaseModel):
    prompt: str

class AssetResolverResponse(BaseModel):
    resolved_prompt: str
    assets: List[AssetOut]
