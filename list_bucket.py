from backend.app.services.tos_service import TOSService
import sys

print("Initializing TOSService...")
svc = TOSService()
if not svc.client:
    print("Error: TOS Client not initialized. Please configure AK/SK in the UI.")
    sys.exit(1)

bucket = "yoyo-images"
print(f"Listing objects in bucket '{bucket}'...")

try:
    # List first 10 objects
    out = svc.client.list_objects(bucket, limit=10)
    if not out.contents:
        print("Bucket is empty or no objects found.")
    for obj in out.contents:
        print(f"Key: {obj.key}")
except Exception as e:
    print(f"Error listing objects: {e}")
