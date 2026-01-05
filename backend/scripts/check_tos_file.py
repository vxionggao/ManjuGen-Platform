import os
import sys
import tos

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.db import SessionLocal
from app.services.storage_service import StorageService

def check_file():
    db = SessionLocal()
    storage = StorageService(db)
    
    client = storage._get_tos_client()
    bucket = storage._get_config("storage_bucket")
    
    key = "anime_platform/project/default/video/15/output_video.mp4"
    
    print(f"Checking {key} in {bucket}...")
    try:
        client.head_object(bucket, key)
        print("File exists!")
        
        # Generate a fresh URL to test
        # Fix the method enum usage if needed, or string "GET" works? 
        # The previous error "AttributeError: 'str' object has no attribute 'value'" suggests 
        # pre_signed_url might be expecting an Enum but got string, OR inside SDK it failed.
        # Let's try importing HttpMethodType
        from tos import HttpMethodType
        out = client.pre_signed_url(HttpMethodType.Http_Method_Get, bucket, key, expires=3600)
        
        url = out.signed_url if hasattr(out, 'signed_url') else out
        print(f"Fresh URL: {url}")
        
    except Exception as e:
        print(f"File check failed: {e}")

if __name__ == "__main__":
    check_file()
