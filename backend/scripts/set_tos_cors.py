import os
import sys
import tos
from tos.models2 import CORSRule

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.db import SessionLocal
from app.services.storage_service import StorageService

def set_cors():
    db = SessionLocal()
    storage = StorageService(db)
    
    client = storage._get_tos_client()
    if not client:
        print("TOS client not initialized. Please check config.")
        return

    bucket = storage._get_config("storage_bucket")
    if not bucket:
        print("Bucket not configured.")
        return

    print(f"Setting CORS for bucket: {bucket}")

    rule = CORSRule(
        allowed_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allowed_methods=["GET", "PUT", "POST", "DELETE", "HEAD"],
        allowed_headers=["*"],
        expose_headers=["ETag", "x-tos-request-id"],
        max_age_seconds=3600
    )

    try:
        # Check tos version compatibility, some versions might use different param name or positional args
        # Based on error, it seems 'cors_rules' kwarg is unexpected?
        # Let's try passing it as positional arg if kwarg fails, or check if it's 'rules'
        
        # Actually, looking at some SDK versions, it might be 'rules' or just positional.
        # But standard v2 is cors_rules.
        # Let's try inspecting the method signature or just try positional.
        
        client.put_bucket_cors(bucket, [rule])
        print("Successfully set CORS rules.")
    except Exception as e:
        print(f"Failed to set CORS: {e}")

if __name__ == "__main__":
    set_cors()
