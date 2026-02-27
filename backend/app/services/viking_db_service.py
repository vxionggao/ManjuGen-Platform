from typing import List, Dict, Any, Optional
import json
import os
import hashlib
import time
from ..db import SessionLocal
from ..repositories.system_config_repo import SystemConfigRepo

try:
    from volcengine.viking_db import VikingDBService as SDKVikingDBService
    from volcengine.viking_db import Field, FieldType, VectorIndexParams
    # ScalarIndexParams 似乎不存在，可能是版本差异或不需要
    VIKINGDB_AVAILABLE = True
except ImportError as e:
    print(f"volcengine.viking_db import failed: {e}, using mock implementation")
    VIKINGDB_AVAILABLE = False

class VikingDBService:
    def __init__(self):
        self.load_config()
        self.vector_dim = 768 # 默认向量维度

        if VIKINGDB_AVAILABLE:
            self._init_sdk()
        else:
            self.service = None

    def load_config(self):
        """从数据库加载配置"""
        try:
            db = SessionLocal()
            repo = SystemConfigRepo()
            
            def get_config(key, default):
                conf = repo.get(db, key)
                return conf.value if conf else default

            self.host = get_config("vikingdb_host", os.environ.get("VIKINGDB_HOST", "api-vikingdb.volces.com"))
            self.region = get_config("vikingdb_region", os.environ.get("VIKINGDB_REGION", "cn-beijing"))
            self.scheme = get_config("vikingdb_scheme", os.environ.get("VIKINGDB_SCHEME", "https"))
            self.ak = get_config("vikingdb_ak", os.environ.get("VIKINGDB_AK", ""))
            self.sk = get_config("vikingdb_sk", os.environ.get("VIKINGDB_SK", ""))
            self.collection_name = get_config("vikingdb_collection", "material_assets")
            self.index_name = get_config("vikingdb_index", "material_assets_index")
            
            db.close()
        except Exception as e:
            print(f"Error loading VikingDB config: {e}")
            # Fallback defaults
            self.host = "api-vikingdb.volces.com"
            self.region = "cn-beijing"
            self.scheme = "https"
            self.ak = ""
            self.sk = ""
            self.collection_name = "material_assets"
            self.index_name = "material_assets_index"

    def _init_sdk(self):
        try:
            self.service = SDKVikingDBService(
                host=self.host,
                region=self.region,
                scheme=self.scheme,
                ak=self.ak,
                sk=self.sk
            )
            # 尝试初始化资源，但不阻塞启动（因为可能配置还没填）
            if self.ak and self.sk:
                self._ensure_resources()
        except Exception as e:
            print(f"Failed to initialize VikingDB SDK: {e}")
            self.service = None

    def reload_config(self):
        """重新加载配置并初始化SDK"""
        self.load_config()
        if VIKINGDB_AVAILABLE:
            self._init_sdk()

    def _ensure_resources(self):
        """确保Collection和Index存在"""
        if not self.service:
            return

        try:
            # 检查 Collection
            try:
                self.collection = self.service.get_collection(self.collection_name)
            except Exception:
                print(f"Collection {self.collection_name} not found, creating...")
                fields = [
                    Field(field_name="asset_id", field_type=FieldType.String, is_primary_key=True),
                    Field(field_name="vector", field_type=FieldType.Vector, dim=self.vector_dim),
                    Field(field_name="type", field_type=FieldType.String),
                    Field(field_name="name", field_type=FieldType.String),
                    Field(field_name="tags", field_type=FieldType.String), # JSON string
                    Field(field_name="source", field_type=FieldType.String),
                    Field(field_name="tenant_id", field_type=FieldType.String),
                    Field(field_name="description", field_type=FieldType.Text)
                ]
                self.collection = self.service.create_collection(
                    collection_name=self.collection_name,
                    fields=fields,
                    description="Material Assets Collection"
                )
            
            # 检查 Index
            try:
                self.index = self.service.get_index(self.collection_name, self.index_name)
            except Exception:
                print(f"Index {self.index_name} not found, creating...")
                # 尝试直接传列表给 scalar_index
                self.index = self.service.create_index(
                    collection_name=self.collection_name,
                    index_name=self.index_name,
                    vector_index=VectorIndexParams(index_type="HNSW", distance_metric="Cosine"),
                    scalar_index=["type", "source", "tenant_id"], 
                    description="Material Assets Index"
                )
        except Exception as e:
            print(f"Error ensuring VikingDB resources: {e}")


    def generate_embedding(self, text: str) -> List[float]:
        """
        生成文本的向量嵌入
        TODO: 请替换为真实的 Embedding 调用，例如调用豆包 Embedding 模型
        """
        # 这里使用简单的哈希方法生成伪嵌入作为占位符
        hash_obj = hashlib.md5(text.encode())
        hash_hex = hash_obj.hexdigest()
        embedding = []
        # 重复填充直到达到维度
        full_hex = hash_hex * (self.vector_dim // 32 + 1)
        for i in range(self.vector_dim):
            val = int(full_hex[i], 16)
            embedding.append(float(val) / 15.0) # Normalize to 0-1
        return embedding

    def add_asset(self, asset: Dict[str, Any]):
        """添加素材到 VikingDB"""
        if not self.service:
            print("VikingDB service not initialized")
            return

        try:
            # 1. 生成 Embedding
            text_content = f"{asset['name']} {asset['description']} {' '.join(asset.get('tags', []))}"
            vector = self.generate_embedding(text_content)
            
            # 2. 准备数据
            data = {
                "asset_id": str(asset['asset_id']),
                "vector": vector,
                "type": asset['type'],
                "name": asset['name'],
                "tags": json.dumps(asset.get('tags', [])),
                "source": asset.get('source', 'user_upload'),
                "tenant_id": str(asset.get('tenant_id', '0')),
                "description": asset.get('description', '')
            }
            
            # 3. Upsert 数据
            collection = self.service.get_collection(self.collection_name)
            collection.upsert_data(data=[data])
            print(f"Successfully added asset {asset['asset_id']} to VikingDB")
            
        except Exception as e:
            print(f"Error adding asset to VikingDB: {e}")

    def update_asset(self, asset: Dict[str, Any]):
        """更新素材 (Upsert)"""
        self.add_asset(asset)

    def get_asset(self, asset_id: str) -> Optional[Dict[str, Any]]:
        """获取素材"""
        if not self.service:
            return None
        
        try:
            collection = self.service.get_collection(self.collection_name)
            # 假设 SDK 支持 fetch_data，参数可能不同，这里仅作示例
            # 如果需要使用，请参考 SDK 文档
            return None
        except Exception as e:
            print(f"Error getting asset from VikingDB: {e}")
            return None

    def search_assets(self, query: str, asset_type: Optional[str] = None, topk: int = 10) -> List[str]:
        """搜索素材"""
        if not self.service:
            print("VikingDB service not initialized")
            return []

        try:
            # 1. 生成 Query Embedding
            vector = self.generate_embedding(query)
            
            # 2. 搜索
            index = self.service.get_index(self.collection_name, self.index_name)
            
            filter_dsl = None
            if asset_type:
                filter_dsl = {"type": {"$eq": asset_type}}

            results = index.search(
                order_by_vector={"vector": vector},
                filter=filter_dsl,
                limit=topk,
                output_fields=["asset_id"]
            )
            
            # 3. 解析结果
            return [item.fields["asset_id"] for item in results]
            
        except Exception as e:
            print(f"Error searching assets in VikingDB: {e}")
            return []

    def delete_asset(self, asset_id: str):
        """删除素材"""
        if not self.service:
            return

        try:
            collection = self.service.get_collection(self.collection_name)
            collection.delete_data(primary_keys=[asset_id])
            print(f"Deleted asset {asset_id} from VikingDB")
        except Exception as e:
            print(f"Error deleting asset from VikingDB: {e}")
