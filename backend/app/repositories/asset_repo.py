from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..models.asset import Asset
from typing import List, Optional

class AssetRepo:
    def create(self, db: Session, user_id: int, name: str, type: str, **kwargs) -> Asset:
        asset = Asset(
            user_id=user_id,
            name=name,
            type=type,
            aliases=kwargs.get("aliases", []),
            description=kwargs.get("description", ""),
            tags=kwargs.get("tags", []),
            cover_image=kwargs.get("cover_image", ""),
            gallery=kwargs.get("gallery", []),
            asset_metadata=kwargs.get("metadata", {}),
            source=kwargs.get("source", "user_upload")
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset

    def list(self, db: Session, user_id: int, asset_type: Optional[str] = None) -> List[Asset]:
        query = db.query(Asset).filter(
            or_(
                Asset.user_id == user_id,
                Asset.source == "built_in"
            )
        )
        if asset_type:
            query = query.filter(Asset.type == asset_type)
        return query.order_by(Asset.created_at.desc()).all()

    def delete(self, db: Session, asset_id: str) -> bool:
        result = db.query(Asset).filter(Asset.asset_id == asset_id).delete()
        db.commit()
        return result > 0
        
    def get(self, db: Session, asset_id: int) -> Asset:
        return db.query(Asset).filter(Asset.id == asset_id).first()
    
    def get_by_asset_id(self, db: Session, asset_id: str) -> Asset:
        return db.query(Asset).filter(Asset.asset_id == asset_id).first()

    def get_by_name(self, db: Session, name: str) -> Optional[Asset]:
        return db.query(Asset).filter(Asset.name == name).first()
    
    def search(self, db: Session, user_id: int, query: str, asset_type: Optional[str] = None, topk: int = 10) -> List[Asset]:
        search_query = db.query(Asset).filter(
            or_(
                Asset.user_id == user_id,
                Asset.source == "built_in"
            )
        )
        
        if asset_type:
            search_query = search_query.filter(Asset.type == asset_type)
        
        # 简单的模糊搜索
        if query:
            search_query = search_query.filter(
                or_(
                    Asset.name.ilike(f"%{query}%"),
                    Asset.description.ilike(f"%{query}%")
                )
            )
        
        return search_query.limit(topk).all()
    
    def update(self, db: Session, asset_id: int, **kwargs) -> Asset:
        asset = self.get(db, asset_id)
        if asset:
            for key, value in kwargs.items():
                if hasattr(asset, key):
                    setattr(asset, key, value)
            db.commit()
            db.refresh(asset)
        return asset
