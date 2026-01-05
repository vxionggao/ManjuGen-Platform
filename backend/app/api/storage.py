import asyncio
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from ..db import SessionLocal
from ..services.storage_service import StorageService
from urllib.parse import urlparse, parse_qs

router = APIRouter(prefix="/api/storage", tags=["storage"])

@router.get("/redirect")
async def redirect_to_signed_url(url: str = Query(..., description="Original TOS URL or path")):
    """
    Takes a TOS URL (which might be expired), extracts the object key,
    generates a FRESH signed URL, and redirects the client to it.
    """
    if not url:
        raise HTTPException(status_code=400, detail="Missing url parameter")

    db: Session = SessionLocal()
    try:
        storage = StorageService(db)
        
        # Check if it's actually a TOS url or just a path
        # We can reuse refresh_signed_url logic but ensure we return the signed URL
        # instead of the proxy URL (to avoid infinite loop if we used that logic there)
        
        # Actually, let's look at StorageService.refresh_signed_url.
        # It currently does the signing.
        # We can just call it? 
        # But if we change refresh_signed_url to return PROXY url, then we can't call it here.
        # So we should duplicate the signing logic or extract it.
        
        # Extract logic from StorageService
        # 1. Parse URL to get Key
        parsed = urlparse(url)
        key = parsed.path.lstrip("/")
        
        # If key contains bucket name at start? No, TOS paths are usually /bucket/key or just /key depending on domain.
        # But our storage service uses path style or domain style?
        # Usually hmtos.tos-cn-beijing.volces.com/<key> (if bucket is in host) or /<bucket>/<key>
        # Let's check how we constructed it: "anime_platform/..."
        # So key is likely "anime_platform/..."
        # But if the input URL is full URL, parsed.path will be "/anime_platform/..."
        # So lstrip("/") gives "anime_platform/..." which is correct.
        
        # However, if the input URL was ALREADY signed, it has query params.
        # We ignore query params here and re-sign just the object key.
        
        # 2. Get Client
        client = storage._get_tos_client()
        if not client:
             # Fallback: maybe it's not TOS or config missing, just redirect to original
             return RedirectResponse(url)
             
        bucket = storage._get_config("storage_bucket")
        if not bucket:
            return RedirectResponse(url)

        # 3. Generate Signed URL (valid for 5 mins is enough for redirect)
        import tos
        # Ensure we don't have double slash if key starts with /
        # But we did lstrip.
        
        # Verify if key exists? No, just sign it.
        
        out = client.pre_signed_url(tos.HttpMethodType.Http_Method_Get, bucket, key, expires=300)
        
        signed_url = out.signed_url if hasattr(out, 'signed_url') else out
        
        # Add CORS headers to redirect?
        # RedirectResponse default 307.
        # Browser follows redirect. The final request to TOS needs CORS.
        # TOS bucket must have CORS configured.
        
        return RedirectResponse(signed_url)
        
    except Exception as e:
        print(f"Proxy redirect failed: {e}")
        # Fallback to original URL
        return RedirectResponse(url)
    finally:
        db.close()
