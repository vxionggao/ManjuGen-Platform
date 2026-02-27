import os
import tos
from ..db import SessionLocal
from ..repositories.system_config_repo import SystemConfigRepo

class TOSService:
    def __init__(self):
        # 从数据库加载配置，与 VikingDBService 保持一致
        db = SessionLocal()
        repo = SystemConfigRepo()
        
        def get_config(key, default):
            conf = repo.get(db, key)
            return conf.value if conf else default

        self.ak = get_config("vikingdb_ak", os.environ.get("VIKINGDB_AK", ""))
        self.sk = get_config("vikingdb_sk", os.environ.get("VIKINGDB_SK", ""))
        self.region = get_config("vikingdb_region", os.environ.get("VIKINGDB_REGION", "cn-beijing"))
        
        db.close()
        
        self.endpoint = f"tos-{self.region}.volces.com"
        
        if self.ak and self.sk:
            try:
                self.client = tos.TosClientV2(self.ak, self.sk, self.endpoint, self.region)
            except Exception as e:
                print(f"Failed to init TOS client: {e}")
                self.client = None
        else:
            self.client = None

    def sign_url(self, url: str, expires: int = 3600) -> str:
        """为 tos:// 开头的 URL 生成预签名 URL"""
        if not url or not url.startswith("tos://"):
            return url
        
        if not self.client:
            print("TOS client not initialized")
            return url
            
        # Enforce minimum expiration
        if expires < 600:
            expires = 600

        try:
            # Parse tos://bucket/key
            parts = url[6:].split("/", 1)
            if len(parts) != 2:
                print(f"Invalid TOS URL format: {url}")
                return url
            
            bucket, key = parts
            print(f"Signing URL for bucket={bucket}, key={key}, expires={expires}")
            
            # method, bucket, key, expires, headers=None, query=None
            # Force inline display
            query = {"response-content-disposition": "inline"}
            out = self.client.pre_signed_url(tos.HttpMethodType.Http_Method_Get, bucket, key, expires, query=query)
            return out.signed_url
        except Exception as e:
            print(f"Error signing TOS url {url}: {e}")
            return url
