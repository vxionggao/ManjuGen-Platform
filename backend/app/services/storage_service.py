import os
import asyncio
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
        If TOS is configured, upload to TOS.
        Otherwise, fallback to LOCAL storage (to prevent 500 errors if TOS is missing).
        """
        # 1. Local Cache (Always keep for internal use)
        app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        # Determine local path
        if file_type == "video":
            local_rel_path = f"static/cache/{task_id}_{filename}"
        else:
            # Default structure for images/others
            local_rel_path = f"static/uploads/{task_id}_{filename}"
            
        local_abs_path = os.path.join(app_dir, local_rel_path)
        os.makedirs(os.path.dirname(local_abs_path), exist_ok=True)
        
        # Write to local disk
        try:
            mode = 'wb' if isinstance(content, bytes) else 'w'
            async with aiofiles.open(local_abs_path, mode) as f:
                await f.write(content)
            print(f"Saved local file to {local_abs_path}")
        except Exception as e:
            print(f"Failed to save local file: {e}")
            
        # 2. Try TOS Upload
        try:
            client = self._get_tos_client()
            bucket = self._get_config("storage_bucket")
            
            if client and bucket:
                remote_key = f"anime_platform/project/default/{file_type}/{task_id}/{filename}"
                client.put_object(bucket, remote_key, content=content)
                
                # Generate Pre-signed URL
                out = client.pre_signed_url(
                    tos.HttpMethodType.Http_Method_Get, 
                    bucket, 
                    remote_key, 
                    expires=3600,
                    response_content_disposition='inline'
                )
                if hasattr(out, 'signed_url'):
                     return out.signed_url
                return out
        except Exception as e:
            print(f"TOS Upload skipped/failed: {e}")
            # Do NOT raise exception here, fallback to local URL
            
        # 3. Fallback to Local URL
        # URL should be relative to backend root, e.g. /static/cache/...
        return f"/{local_rel_path}"

    async def save_file(self, url: str, task_id: int, file_type: str, filename: str = None) -> str:
        """
        Download file from url and save it to storage.
        """
        if not url: return ""
        
        # Download content with simple retry
        content = None
        attempts = 3
        async with aiohttp.ClientSession() as session:
            for _ in range(attempts):
                try:
                    async with session.get(url) as resp:
                        if resp.status == 200:
                            content = await resp.read()
                            break
                except Exception as e:
                    pass
                await asyncio.sleep(0.5)
        
        if not content:
            return url # Failed to download
            
        if not filename:
            filename = os.path.basename(urlparse(url).path)
            if "?" in filename:
                filename = filename.split("?")[0]
            if not filename:
                filename = f"{int(time.time())}.bin"
        
        return await self.upload_content(content, task_id, file_type, filename)

    async def delete_file(self, url: str) -> bool:
        """
        Delete file from storage (TOS or local).
        Smartly detects storage type based on URL format.
        Suppresses all exceptions to prevent blocking deletion flows.
        """
        if not url: return True
        
        try:
            # Case 1: Local File (/static/...)
            if url.startswith("/static/"):
                try:
                    local_path = url.lstrip("/")
                    if os.path.exists(local_path):
                        os.remove(local_path)
                        print(f"Deleted local file: {local_path}")
                    return True
                except Exception as e:
                    print(f"Local delete failed for {url}: {e}")
                    return False
            
            # Case 2: TOS File (http...)
            # We try to delete from TOS if we have config, regardless of current storage_type setting.
            # This handles cases where user switched from Local to TOS or vice versa.
            if url.startswith("http"):
                try:
                    # Parse key from URL
                    parsed = urlparse(url)
                    path = parsed.path.lstrip("/")
                    
                    # Heuristic: If we have TOS creds, try to delete.
                    client = self._get_tos_client()
                    if client:
                        bucket = self._get_config("storage_bucket")
                        if bucket:
                            # If the URL contains the bucket name or endpoint, it's likely ours.
                            # Even if not, trying to delete doesn't hurt (unless key conflict, unlikely).
                            print(f"Attempting TOS delete: bucket={bucket}, key={path}")
                            client.delete_object(bucket, path)
                            return True
                except Exception as e:
                    print(f"TOS Delete failed for {url}: {e}")
                    return False
                    
            return True # Unknown format, treat as success (nothing to delete)
            
        except Exception as e:
            print(f"Unexpected error in delete_file for {url}: {e}")
            return False
