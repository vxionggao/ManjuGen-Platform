from typing import List, Dict, Any, Optional
from ..services.viking_db_service import VikingDBService
from ..services.tos_service import TOSService
from ..services.asset_service import AssetService
from ..db import SessionLocal
from ..repositories.system_config_repo import SystemConfigRepo

class MaterialSourceService:
    def __init__(self):
        self.viking_service = VikingDBService()
        self.tos_service = TOSService()
        self.asset_service = AssetService(SessionLocal()) # Need DB session for AssetService
        
        # Load bucket name
        db = SessionLocal()
        repo = SystemConfigRepo()
        c = repo.get(db, "tos_bucket_name")
        self.bucket_name = c.value if c else "hmtos"
        db.close()

    def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search in VikingDB using the bound collection/index.
        Returns formatted results with signed URLs.
        """
        if not self.viking_service.service:
            return []

        try:
            index = self.viking_service.service.get_index(
                self.viking_service.collection_name, 
                self.viking_service.index_name
            )
            
            results = []
            try:
                # Try Raw Search (T2I)
                results = index.search(
                    order_by_raw={"image": query},
                    limit=limit,
                    output_fields=["image", "image_name", "text"]
                )
            except Exception as e:
                print(f"Raw search failed, trying vector search: {e}")
                # Fallback to Vector Search
                vector = self.viking_service.generate_embedding(query)
                results = index.search(
                    order_by_vector={"vector": vector},
                    limit=limit,
                    output_fields=["image_uri", "image_name", "text", "type"]
                )
            
            # 3. Format results
            formatted_results = []
            for item in results:
                fields = item.fields
                image_uri = fields.get("image", "")
                
                # Construct TOS URI if missing but image_name exists
                if not image_uri and fields.get("image_name"):
                    val = fields['image_name']
                    if not val.startswith("tos://"):
                        image_uri = f"tos://{self.bucket_name}/{val}"
                    else:
                        image_uri = val
                
                # Use Proxy URL to centralize signing logic and handle expiration
                import urllib.parse
                preview_url = ""
                if image_uri and image_uri.startswith("tos://"):
                    try:
                        parts = image_uri[6:].split("/", 1)
                        if len(parts) == 2:
                            b, k = parts
                            # key might contain / which needs to be preserved or quoted?
                            k_safe = urllib.parse.quote(k) 
                            preview_url = f"/api/materials/proxy?bucket={b}&key={k_safe}"
                    except Exception:
                        pass
                
                if not preview_url:
                    print(f"Warning: Failed to generate proxy URL for {image_uri}")

                formatted_results.append({
                    "pk": item.id, # __AUTO_ID__ or primary key
                    "image_uri": image_uri,
                    "preview_url": preview_url,
                    "image_name": fields.get("image_name", "Unknown"),
                    "text": fields.get("text", ""),
                    "type": fields.get("type", "image")
                })
                
            return formatted_results
            
        except Exception as e:
            print(f"Material search failed: {e}")
            return []

    def import_asset(self, item: Dict[str, Any], user_id: int = 0) -> Dict[str, Any]:
        """
        Import a VikingDB record as a local asset.
        """
        remote_pk = item.get("pk")
        
        # Check for duplicates
        if remote_pk:
            # Get all assets for this user (inefficient but safe for now)
            existing_assets = self.asset_service.list_assets(user_id)
            for asset in existing_assets:
                meta = asset.get("metadata", {})
                # Check both string and int equality for PK just in case
                if str(meta.get("remote_pk")) == str(remote_pk) and asset.get("source") == "vikingdb":
                    print(f"[IMPORT] remote_pk={remote_pk} status=exists material_id={asset['asset_id']}")
                    return {
                        "ok": True,
                        "status": "exists",
                        "material_id": asset["asset_id"],
                        "asset": asset
                    }

        # Map fields to Asset schema
        target_type = item.get("target_type") or item.get("type") or "image"
        asset_data = {
            "name": item.get("image_name") or item.get("pk"),
            "type": target_type,
            "description": item.get("text", ""),
            "cover_image": item.get("image_uri", ""),
            "source": "vikingdb",
            "metadata": {
                "remote_pk": item.get("pk"),
                "source_name": self.viking_service.collection_name
            },
            "tags": ["imported"]
        }
        
        # Create asset
        result = self.asset_service.create_asset(user_id, asset_data)
        print(f"[IMPORT] remote_pk={remote_pk} inserted_id={result['asset_id']} rows_affected=1")
        
        return {
            "ok": True,
            "status": "created",
            "material_id": result["asset_id"],
            "asset": result
        }
