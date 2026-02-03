import json
import os
import base64
import uuid
import sys

# Setup path to import backend modules
sys.path.append(os.getcwd())

from backend.app.db import SessionLocal
from backend.app.services.asset_service import AssetService

# Configuration
JSON_FILE = "/Users/bytedance/python_projects/knowledge/提示词demo_vikingdb.json"
BASE_DIR = os.getcwd()
STATIC_DIR = os.path.join(BASE_DIR, "backend", "app", "static", "imported")
STATIC_URL_PREFIX = "/static/imported"

def save_base64_image(b64_str):
    if not b64_str or not isinstance(b64_str, str):
        return ""
    
    if "base64," in b64_str:
        header, data = b64_str.split("base64,", 1)
    else:
        data = b64_str
        
    try:
        img_data = base64.b64decode(data)
        filename = f"{uuid.uuid4()}.png"
        filepath = os.path.join(STATIC_DIR, filename)
        
        with open(filepath, "wb") as f:
            f.write(img_data)
            
        return f"{STATIC_URL_PREFIX}/{filename}"
    except Exception as e:
        print(f"Error saving image: {e}")
        return ""

def import_assets():
    print(f"Creating directory: {STATIC_DIR}")
    if not os.path.exists(STATIC_DIR):
        os.makedirs(STATIC_DIR)
        
    print(f"Reading JSON: {JSON_FILE}")
    try:
        with open(JSON_FILE, "r") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading JSON: {e}")
        return

    db = SessionLocal()
    service = AssetService(db)
    
    count = 0
    for i, item in enumerate(data):
        prompt = item.get("prompt")
        effect = item.get("effect")
        
        if not prompt and not effect:
            continue
            
        name = "Demo Asset"
        if prompt:
            name = prompt[:10] + ("..." if len(prompt) > 10 else "")
            
        description = prompt if prompt else "No description"
        
        model_tools = item.get("model_and_tools")
        asset_type = "image"
        if model_tools and "视频" in str(model_tools):
            asset_type = "video"
            
        print(f"Processing item {i+1}: {name} ({asset_type})")

        cover_image = save_base64_image(effect)
        
        asset_data = {
            "name": name,
            "type": asset_type,
            "description": description,
            "cover_image": cover_image,
            "source": "user_upload", 
            "metadata": {
                "model_and_tools": model_tools,
                "original_import": True
            },
            "tags": ["demo", "imported"]
        }
        
        try:
            service.create_asset(user_id=0, asset_data=asset_data)
            count += 1
            print("  Imported successfully")
        except Exception as e:
            print(f"  Failed to create asset: {e}")
            
    print(f"\nSuccessfully imported {count} assets.")
    db.close()

if __name__ == "__main__":
    import_assets()
