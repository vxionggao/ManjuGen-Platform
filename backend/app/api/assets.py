from fastapi import APIRouter, Depends, UploadFile, File, Form, Body, HTTPException
from typing import Optional, List, Dict, Any, Union
import shutil
import os
import uuid
from ..db import SessionLocal
# ... imports .....api.deps import get_current_user
from ..repositories.asset_repo import AssetRepo
from ..services.storage_service import StorageService
from ..services.asset_service import AssetService
from ..services.asset_resolver import AssetResolver
from ..schemas.asset import AssetCreate, AssetOut, AssetSearchRequest, AssetResolverRequest, AssetResolverResponse
from pydantic import BaseModel
import time

# 定义默认用户
DEFAULT_USER = {"id": 0, "username": "anonymous", "role": "user"}

router = APIRouter(prefix="/api/assets", tags=["assets"])

# 新增的API路由组
prompt_router = APIRouter(prefix="/api/prompt", tags=["prompt"])

class AssetIngestRequest(BaseModel):
    name: str
    type: str
    aliases: Optional[List[str]] = []
    description: Optional[str] = ""
    tags: Optional[List[str]] = []
    cover_image: Optional[str] = ""
    gallery: Optional[List[str]] = []
    metadata: Optional[Dict[str, Any]] = {}
    source: Optional[str] = "user_upload"

class AssetIngestResponse(BaseModel):
    asset: AssetOut

@router.post("/upload", response_model=AssetOut)
async def upload_asset_file(
    file: UploadFile = File(...),
    type: str = Form("script"),
    user: Optional[Dict[str, Any]] = Depends(lambda: DEFAULT_USER)
):
    """上传素材文件"""
    print(f"DEBUG: upload_asset_file called. filename={file.filename}, type={type}")
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    if type == "image":
        if ext not in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
             print(f"DEBUG: Invalid image format: {ext}")
             raise HTTPException(400, f"Invalid image format: {ext}")
    
    # Calculate absolute path to backend/app/static/uploads to match main.py mount
    current_dir = os.path.dirname(os.path.abspath(__file__)) # backend/app/api
    app_dir = os.path.dirname(current_dir) # backend/app
    upload_dir = os.path.join(app_dir, "static", "uploads")
    
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
    
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(upload_dir, unique_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    db = SessionLocal()
    asset_service = AssetService(db)
    try:
        url = f"/static/uploads/{unique_name}"
        
        # Determine if it is an image based on extension
        is_image = ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]

        asset_data = {
            "name": filename,
            "type": type,
            "source": "user_upload",
            "cover_image": url if is_image else "",
            "metadata": {
                "file_path": file_path,
                "url": url,
                "original_name": filename
            }
        }
        
        asset = asset_service.create_asset(
            user_id=user["id"],
            asset_data=asset_data
        )
        
        return AssetOut(
            id=asset["id"],
            asset_id=asset["asset_id"],
            name=asset["name"],
            type=asset["type"],
            aliases=asset["aliases"],
            description=asset["description"],
            tags=asset["tags"],
            cover_image=asset["cover_image"],
            gallery=asset["gallery"],
            metadata=asset["metadata"],
            source=asset["source"],
            created_at=asset["created_at"],
            updated_at=asset["updated_at"]
        )
    finally:
        db.close()

@router.post("/ingest", response_model=AssetOut)
async def ingest_asset(
    asset_data: AssetIngestRequest = Body(...),
    user: Optional[Dict[str, Any]] = Depends(lambda: DEFAULT_USER)
):
    """导入/创建素材"""
    db = SessionLocal()
    asset_service = AssetService(db)
    
    try:
        # 创建素材
        asset = asset_service.create_asset(
            user_id=user["id"],
            asset_data=asset_data.model_dump()
        )
        
        # 返回素材信息
        return AssetOut(
            id=asset["id"],
            asset_id=asset["asset_id"],
            name=asset["name"],
            type=asset["type"],
            aliases=asset["aliases"],
            description=asset["description"],
            tags=asset["tags"],
            cover_image=asset["cover_image"],
            gallery=asset["gallery"],
            metadata=asset["metadata"],
            source=asset["source"],
            created_at=asset["created_at"],
            updated_at=asset["updated_at"]
        )
    finally:
        db.close()

@router.get("/search", response_model=List[AssetOut])
def search_assets(
    q: Optional[str] = "",
    type: Optional[str] = None,
    topk: Optional[int] = 10,
    user: Optional[Dict[str, Any]] = Depends(lambda: DEFAULT_USER)
):
    """搜索素材"""
    db = SessionLocal()
    asset_service = AssetService(db)
    
    try:
        # 搜索素材
        assets = asset_service.search_assets(
            user_id=user["id"],
            query=q,
            asset_type=type,
            topk=topk
        )
        
        # 返回搜索结果
        return [
            AssetOut(
                id=asset["id"],
                asset_id=asset["asset_id"],
                name=asset["name"],
                type=asset["type"],
                aliases=asset["aliases"],
                description=asset["description"],
                tags=asset["tags"],
                cover_image=asset["cover_image"],
                gallery=asset["gallery"],
                metadata=asset["metadata"],
                source=asset["source"],
                created_at=asset["created_at"],
                updated_at=asset["updated_at"]
            )
            for asset in assets
        ]
    finally:
        db.close()

@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(
    asset_id: str,
    user: Optional[Dict[str, Any]] = Depends(lambda: DEFAULT_USER)
):
    """获取素材详情"""
    db = SessionLocal()
    asset_service = AssetService(db)
    
    try:
        # 获取素材
        asset = asset_service.get_asset(asset_id)
        if not asset:
            raise ValueError("Asset not found")
        
        # 返回素材信息
        return AssetOut(
            id=asset["id"],
            asset_id=asset["asset_id"],
            name=asset["name"],
            type=asset["type"],
            aliases=asset["aliases"],
            description=asset["description"],
            tags=asset["tags"],
            cover_image=asset["cover_image"],
            gallery=asset["gallery"],
            metadata=asset["metadata"],
            source=asset["source"],
            created_at=asset["created_at"],
            updated_at=asset["updated_at"]
        )
    finally:
        db.close()

@router.get("", response_model=List[AssetOut])
def list_assets(
    type: Optional[str] = None,
    user: Optional[Dict[str, Any]] = Depends(lambda: DEFAULT_USER)
):
    """列出素材"""
    db = SessionLocal()
    asset_service = AssetService(db)
    
    try:
        # 获取素材列表
        assets = asset_service.list_assets(
            user_id=user["id"],
            asset_type=type
        )
        
        # 返回素材列表
        return [
            AssetOut(
                id=asset["id"],
                asset_id=asset["asset_id"],
                name=asset["name"],
                type=asset["type"],
                aliases=asset["aliases"],
                description=asset["description"],
                tags=asset["tags"],
                cover_image=asset["cover_image"],
                gallery=asset["gallery"],
                metadata=asset["metadata"],
                source=asset["source"],
                created_at=asset["created_at"],
                updated_at=asset["updated_at"]
            )
            for asset in assets
        ]
    finally:
        db.close()

@router.delete("/{asset_id}")
async def delete_asset(
    asset_id: str,
    user: Optional[Dict[str, Any]] = Depends(lambda: DEFAULT_USER)
):
    """删除素材"""
    db = SessionLocal()
    asset_service = AssetService(db)
    
    try:
        # 删除素材
        success = asset_service.delete_asset(asset_id)
        if not success:
            raise HTTPException(404, "Asset not found")
        
        return {"message": "Asset deleted"}
    finally:
        db.close()

@prompt_router.post("/resolve", response_model=AssetResolverResponse)
def resolve_prompt(
    request: AssetResolverRequest = Body(...),
    user: Optional[Dict[str, Any]] = Depends(lambda: DEFAULT_USER)
):
    """解析prompt中的素材引用"""
    db = SessionLocal()
    asset_resolver = AssetResolver(db)
    
    try:
        # 解析prompt
        result = asset_resolver.resolve_prompt(request.prompt)
        
        # 返回解析结果
        return AssetResolverResponse(
            resolved_prompt=result["resolved_prompt"],
            assets=[
                AssetOut(
                    id=asset["id"],
                    asset_id=asset["asset_id"],
                    name=asset["name"],
                    type=asset["type"],
                    aliases=asset["aliases"],
                    description=asset["description"],
                    tags=asset["tags"],
                    cover_image=asset["cover_image"],
                    gallery=asset["gallery"],
                    metadata=asset["metadata"],
                    source=asset["source"],
                    created_at=asset["created_at"],
                    updated_at=asset["updated_at"]
                )
                for asset in result["assets"]
            ]
        )
    finally:
        db.close()

# 导出路由
__all__ = ["router", "prompt_router"]
