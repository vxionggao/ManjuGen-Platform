import os
import aiohttp
import aiofiles
import time
import tos
from typing import Optional, Union
from urllib.parse import urlparse
from sqlalchemy.orm import Session
from ..repositories.system_config_repo import SystemConfigRepo

class StorageService:
    def __init__(self, db: Session = None):
        self.repo = SystemConfigRepo()
        self.db = db

    def _get_config(self, key: str) -> Optional[str]:
        if not self.db: return None
        cfg = self.repo.get(self.db, key)
        return cfg.value if cfg else None

    def _get_tos_client(self):
        ak = self._get_config("storage_ak")
        sk = self._get_config("storage_sk")
        endpoint = self._get_config("storage_endpoint")
        region = self._get_config("storage_region")
        if not (ak and sk and endpoint and region):
            return None
        return tos.TosClientV2(ak, sk, endpoint, region)

    def refresh_signed_url(self, url: str) -> str:
        """
        If url is a TOS url, refresh its signature.
        Otherwise return as is.
        """
        if not url: return url
        
        storage_type = self._get_config("storage_type")
        if storage_type != "tos":
            return url
            
        endpoint = self._get_config("storage_endpoint")
        bucket = self._get_config("storage_bucket")
        
        # Check if URL belongs to our bucket/endpoint
        # A simple check: contains endpoint and bucket name? 
        # Or just parse path.
        if endpoint not in url:
            return url
            
        try:
            parsed = urlparse(url)
            # Path usually starts with /
            # Key should not have leading /
            key = parsed.path.lstrip("/")
            
            client = self._get_tos_client()
            if not client: return url
            
            # Instead of returning a signed URL (which expires), return a proxy URL that redirects
            # This ensures the link in frontend is permanent
            # e.g. /api/storage/redirect?url=...
            # Note: The frontend needs to handle this relative URL or we return absolute.
            # Since frontend proxies /api to backend, relative path works.
            
            # We must encode the original URL properly? 
            # Actually, we can just pass the original signed URL (even if expired) as 'url' param,
            # and the endpoint will extract key and re-sign.
            
            # To avoid double encoding issues, let's reconstruct the url with key
            # But the 'url' arg here might be the full signed url from DB.
            # We want to return: /api/storage/redirect?url={url}
            
            # Use quote_plus to ensure all chars (like &) are encoded
            from urllib.parse import quote_plus as url_quote
            return f"/api/storage/redirect?url={url_quote(url)}"

        except Exception as e:
            print(f"Refresh sign failed for {url}: {e}")
            return url

    async def upload_content(self, content: Union[bytes, str], task_id: int, file_type: str, filename: str) -> str:
        """
        Upload content (bytes or string) to storage.
        path structure: anime_platform/project/default/<type>/<task_id>/<filename>
        """
        storage_type = self._get_config("storage_type") or "local"
        
        # Path logic
        # anime_platform/project/default/<type>/<taskid>/<filename>
        # type is usually 'image' or 'video'. We can infer from file_type or pass it.
        # file_type: 'image' or 'video' or 'text'
        remote_key = f"anime_platform/project/default/{file_type}/{task_id}/{filename}"
        
        if storage_type == "tos":
            try:
                client = self._get_tos_client()
                if client:
                    bucket = self._get_config("storage_bucket")
                    client.put_object(bucket, remote_key, content=content)
                    
                    # Generate Pre-signed URL (valid for 1 hour)
                    # This is safer than public access and works for private buckets too.
                    try:
                        # 3600 seconds = 1 hour
                        out = client.pre_signed_url(tos.HttpMethodType.Http_Method_Get, bucket, remote_key, expires=3600)
                        # Check if out is string or object
                        if hasattr(out, 'signed_url'):
                             return out.signed_url
                        return out # Older SDK might return string? Or new SDK returns object. 
                        # Based on docs: returns PreSignedUrlOutput object which has signed_url
                    except Exception as e:
                        print(f"Pre-sign failed: {e}")
                        # Fallback to constructing public URL if signing fails
                        endpoint = self._get_config("storage_endpoint")
                        return f"https://{bucket}.{endpoint}/{remote_key}"
            except Exception as e:
                print(f"TOS Upload failed: {e}")
                # Fallback to local if upload fails? Or raise?
                # User wants to reduce DB size, so failing here is critical.
                # But for now, let's fallback to local if TOS fails to avoid breaking flow completely, 
                # OR we can return empty string to indicate failure.
                pass
        
        # Local fallback
        # Save to static/anime_platform/...
        local_dir = f"static/anime_platform/project/default/{file_type}/{task_id}"
        os.makedirs(local_dir, exist_ok=True)
        local_path = os.path.join(local_dir, filename)
        
        mode = 'w' if isinstance(content, str) else 'wb'
        async with aiofiles.open(local_path, mode=mode) as f:
            await f.write(content)
            
        return f"/static/anime_platform/project/default/{file_type}/{task_id}/{filename}"

    async def save_file(self, url: str, task_id: int, file_type: str, filename: str = None) -> str:
        """
        Download file from url and save it to storage.
        """
        if not url: return ""
        
        # Download content
        content = None
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                if resp.status == 200:
                    content = await resp.read()
        
        if not content:
            return url # Failed to download
            
        if not filename:
            filename = os.path.basename(urlparse(url).path)
            if "?" in filename:
                filename = filename.split("?")[0]
            if not filename:
                filename = f"{int(time.time())}.bin"
        
        return await self.upload_content(content, task_id, file_type, filename)

