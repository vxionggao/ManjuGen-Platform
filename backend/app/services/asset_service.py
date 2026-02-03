from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from ..repositories.asset_repo import AssetRepo
from ..schemas.asset import AssetCreate, AssetUpdate
from ..services.storage_service import StorageService
from ..services.viking_db_service import VikingDBService
import time

class AssetService:
    def __init__(self, db: Optional[Session] = None):
        self.db = db
        self.repo = AssetRepo()
        self.storage = StorageService(db) if db else None
        self.viking_db = VikingDBService()
    
    def create_asset(self, user_id: int, asset_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建新素材"""
        if not self.db:
            raise ValueError("Database session is required")
        
        # 处理文件上传
        cover_image = asset_data.get("cover_image", "")
        gallery = asset_data.get("gallery", [])
        
        # 保存素材到数据库
        asset = self.repo.create(
            self.db,
            user_id=user_id,
            name=asset_data["name"],
            type=asset_data["type"],
            aliases=asset_data.get("aliases", []),
            description=asset_data.get("description", ""),
            tags=asset_data.get("tags", []),
            cover_image=cover_image,
            gallery=gallery,
            metadata=asset_data.get("metadata", {}),
            source=asset_data.get("source", "user_upload")
        )
        
        # 添加到VikingDB
        asset_info = {
            "id": asset.id,
            "asset_id": asset.asset_id,
            "name": asset.name,
            "type": asset.type,
            "aliases": asset.aliases,
            "description": asset.description,
            "tags": asset.tags,
            "cover_image": asset.cover_image,
            "gallery": asset.gallery,
            "metadata": asset.asset_metadata,
            "source": asset.source,
            "tenant_id": str(user_id),
            "created_at": asset.created_at,
            "updated_at": asset.updated_at
        }
        
        self.viking_db.add_asset(asset_info)
        
        # 返回素材信息
        return asset_info
    
    def get_asset_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """通过name获取素材"""
        if not self.db:
            raise ValueError("Database session is required")
        
        asset = self.repo.get_by_name(self.db, name)
        if not asset:
            return None
        
        return {
            "id": asset.id,
            "asset_id": asset.asset_id,
            "name": asset.name,
            "type": asset.type,
            "aliases": asset.aliases,
            "description": asset.description,
            "tags": asset.tags,
            "cover_image": asset.cover_image,
            "gallery": asset.gallery,
            "metadata": asset.asset_metadata,
            "source": asset.source,
            "created_at": asset.created_at,
            "updated_at": asset.updated_at
        }
    
    def get_asset(self, asset_id: str) -> Optional[Dict[str, Any]]:
        """通过asset_id获取素材"""
        if not self.db:
            raise ValueError("Database session is required")
        
        asset = self.repo.get_by_asset_id(self.db, asset_id)
        if not asset:
            return None
        
        return {
            "id": asset.id,
            "asset_id": asset.asset_id,
            "name": asset.name,
            "type": asset.type,
            "aliases": asset.aliases,
            "description": asset.description,
            "tags": asset.tags,
            "cover_image": asset.cover_image,
            "gallery": asset.gallery,
            "metadata": asset.asset_metadata,
            "source": asset.source,
            "created_at": asset.created_at,
            "updated_at": asset.updated_at
        }
    
    def list_assets(self, user_id: int, asset_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """列出用户的素材"""
        if not self.db:
            raise ValueError("Database session is required")
        
        assets = self.repo.list(self.db, user_id, asset_type)
        return [
            {
                "id": asset.id,
                "asset_id": asset.asset_id,
                "name": asset.name,
                "type": asset.type,
                "aliases": asset.aliases,
                "description": asset.description,
                "tags": asset.tags,
                "cover_image": asset.cover_image,
                "gallery": asset.gallery,
                "metadata": asset.asset_metadata,
                "source": asset.source,
                "created_at": asset.created_at,
                "updated_at": asset.updated_at
            }
            for asset in assets
        ]
    
    def search_assets(self, user_id: int, query: str, asset_type: Optional[str] = None, topk: int = 10) -> List[Dict[str, Any]]:
        """搜索素材"""
        if not self.db:
            raise ValueError("Database session is required")
        
        # 使用VikingDB进行向量搜索
        asset_ids = self.viking_db.search_assets(query, asset_type, topk)
        
        # 根据搜索结果获取素材详情
        assets = []
        for asset_id in asset_ids:
            asset = self.get_asset(asset_id)
            if asset:
                assets.append(asset)
        
        # 如果VikingDB搜索失败，回退到数据库搜索
        if not assets:
            db_assets = self.repo.search(self.db, user_id, query, asset_type, topk)
            assets = [
                {
                    "id": asset.id,
                    "asset_id": asset.asset_id,
                    "name": asset.name,
                    "type": asset.type,
                    "aliases": asset.aliases,
                    "description": asset.description,
                    "tags": asset.tags,
                    "cover_image": asset.cover_image,
                    "gallery": asset.gallery,
                    "metadata": asset.metadata,
                    "source": asset.source,
                    "created_at": asset.created_at,
                    "updated_at": asset.updated_at
                }
                for asset in db_assets
            ]
        
        return assets
    
    def update_asset(self, asset_id: str, asset_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """更新素材信息"""
        if not self.db:
            raise ValueError("Database session is required")
        
        asset = self.repo.get_by_asset_id(self.db, asset_id)
        if not asset:
            return None
        
        # 更新素材信息
        updated_asset = self.repo.update(
            self.db,
            asset.id,
            **asset_data
        )
        
        # 更新VikingDB
        updated_asset_info = {
            "id": updated_asset.id,
            "asset_id": updated_asset.asset_id,
            "name": updated_asset.name,
            "type": updated_asset.type,
            "aliases": updated_asset.aliases,
            "description": updated_asset.description,
            "tags": updated_asset.tags,
            "cover_image": updated_asset.cover_image,
            "gallery": updated_asset.gallery,
            "metadata": updated_asset.asset_metadata,
            "source": updated_asset.source,
            "tenant_id": str(updated_asset.user_id),
            "created_at": updated_asset.created_at,
            "updated_at": updated_asset.updated_at
        }
        self.viking_db.update_asset(updated_asset_info)
        
        return updated_asset_info
    
    def delete_asset(self, asset_id: str) -> bool:
        """删除素材"""
        if not self.db:
            raise ValueError("Database session is required")
        
        # 从数据库中删除
        # Note: Repo delete method now accepts asset_id string
        deleted = self.repo.delete(self.db, asset_id)
        
        if deleted:
            try:
                # 从VikingDB中删除
                self.viking_db.delete_asset(asset_id)
            except Exception as e:
                print(f"VikingDB delete warning: {e}")
                
        return deleted
