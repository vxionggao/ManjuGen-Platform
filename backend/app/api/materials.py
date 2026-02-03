from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import StreamingResponse, RedirectResponse
from typing import Dict, Any, List
from ..services.material_source_service import MaterialSourceService
from ..services.tos_service import TOSService

router = APIRouter(prefix="/api/materials", tags=["materials"])

DEFAULT_USER = {"id": 0, "username": "anonymous", "role": "user"}

@router.get("/proxy")
def proxy_material_image(bucket: str, key: str):
    # Step 1: Safety net - Strip duplicate bucket prefix if present
    if key.startswith(f"{bucket}/"):
        key = key[len(bucket)+1:]

    # Step 2: Stream response (No Redirect)
    service = TOSService()
    if not service.client:
         raise HTTPException(500, "TOS Client not init")
         
    try:
        out = service.client.get_object(bucket, key)
        
        # Simple content-type detection
        media_type = "image/jpeg"
        if key.lower().endswith(".png"):
            media_type = "image/png"
        elif key.lower().endswith(".webp"):
            media_type = "image/webp"
        elif key.lower().endswith(".gif"):
            media_type = "image/gif"
            
        return StreamingResponse(out.content, media_type=media_type)
    except Exception as e:
        print(f"Proxy error: {e}")
        # Return 404 so frontend shows placeholder
        raise HTTPException(404, f"Image not found: {e}")

@router.post("/search")
def search_materials(payload: Dict[str, Any] = Body(...)):
    query = payload.get("query", "")
    limit = payload.get("limit", 10)
    service = MaterialSourceService()
    return service.search(query, limit)

@router.post("/import_from_vikingdb")
def import_material(
    payload: Dict[str, Any] = Body(...),
    user: Dict[str, Any] = Depends(lambda: DEFAULT_USER)
):
    service = MaterialSourceService()
    return service.import_asset(payload, user_id=user["id"])

@router.get("/debug_one")
def debug_one_asset():
    """Debug API: Return one signed URL from VikingDB search"""
    service = MaterialSourceService()
    results = service.search("girl", limit=1) # Use 'girl' as likely to match
    
    if not results:
        return {"error": "No results found for query 'girl'"}
    
    item = results[0]
    return {
        "pk": item["pk"],
        "image_name": item["image_name"],
        "original_uri": item["image_uri"],
        "preview_url": item["preview_url"],
        "message": "Copy preview_url to browser to verify."
    }
