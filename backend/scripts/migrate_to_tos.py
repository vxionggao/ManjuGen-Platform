import asyncio
import json
import os
import sys
import base64
import aiofiles

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.db import SessionLocal
from app.models.task import Task
from app.services.storage_service import StorageService

async def migrate():
    db = SessionLocal()
    storage = StorageService(db)
    
    # Check if TOS is configured
    tos_bucket = storage._get_config("storage_bucket")
    if not tos_bucket:
        print("TOS not configured. Please configure TOS in Admin UI first.")
        return

    print(f"Migrating to TOS bucket: {tos_bucket}")
    
    tasks = db.query(Task).all()
    print(f"Found {len(tasks)} tasks to check.")
    
    for t in tasks:
        print(f"Processing Task {t.id} ({t.type})...")
        changed = False
        
        # 1. Migrate Input Images
        if t.input_images:
            try:
                inputs = json.loads(t.input_images)
            except:
                inputs = []
            
            new_inputs = []
            inputs_changed = False
            for i, img in enumerate(inputs):
                # Check if already TOS URL (simple check)
                if tos_bucket in img and "tos-" in img: 
                    new_inputs.append(img)
                    continue
                
                new_url = img
                # Case A: Base64
                if img.startswith("data:image"):
                    try:
                        header, encoded = img.split(",", 1)
                        data = base64.b64decode(encoded)
                        ext = header.split(";")[0].split("/")[1]
                        filename = f"input_{i}.{ext}"
                        new_url = await storage.upload_content(data, t.id, t.type, filename)
                        print(f"  [Input] Uploaded base64 -> {new_url}")
                        inputs_changed = True
                    except Exception as e:
                        print(f"  [Input] Failed to upload base64: {e}")
                
                # Case B: Local file (/static/...)
                elif img.startswith("/static/"):
                    local_path = img.lstrip("/") # static/...
                    # Assuming script runs from backend/ or root? 
                    # We are in backend/scripts/.. so root is ../../
                    # But app is run from root usually. Let's assume absolute path relative to project root.
                    # We need to find the actual file on disk.
                    # Current cwd is likely project root when running via 'python backend/scripts/migrate.py'
                    # But let's check if file exists.
                    real_path = os.path.abspath(local_path)
                    if not os.path.exists(real_path):
                         # Try relative to backend
                         real_path = os.path.abspath(os.path.join("backend", local_path))
                    
                    if os.path.exists(real_path):
                        async with aiofiles.open(real_path, 'rb') as f:
                            data = await f.read()
                        filename = os.path.basename(local_path)
                        new_url = await storage.upload_content(data, t.id, t.type, filename)
                        print(f"  [Input] Uploaded local {local_path} -> {new_url}")
                        inputs_changed = True
                    else:
                        print(f"  [Input] Local file not found: {local_path}")
                
                new_inputs.append(new_url)
            
            if inputs_changed:
                t.input_images = json.dumps(new_inputs)
                changed = True

        # 2. Migrate Result URLs (Image Tasks)
        if t.type == "image" and t.result_urls:
            try:
                results = json.loads(t.result_urls)
            except:
                results = t.result_urls.split(",")
            
            new_results = []
            results_changed = False
            for i, img in enumerate(results):
                if not img: continue
                if tos_bucket in img and "tos-" in img:
                    new_results.append(img)
                    continue
                
                new_url = img
                if img.startswith("/static/"):
                    local_path = img.lstrip("/")
                    real_path = os.path.abspath(local_path)
                    if not os.path.exists(real_path):
                         real_path = os.path.abspath(os.path.join("backend", local_path))
                    
                    if os.path.exists(real_path):
                        async with aiofiles.open(real_path, 'rb') as f:
                            data = await f.read()
                        filename = f"output_{i}.png" # Standardize name
                        new_url = await storage.upload_content(data, t.id, t.type, filename)
                        print(f"  [Result] Uploaded local {local_path} -> {new_url}")
                        results_changed = True
                elif img.startswith("http"):
                    # Remote URL (e.g. Volcengine temp url), try to download and upload
                    try:
                        filename = f"output_{i}.png"
                        new_url = await storage.save_file(img, t.id, t.type, filename)
                        print(f"  [Result] Saved remote {img} -> {new_url}")
                        results_changed = True
                    except Exception as e:
                        print(f"  [Result] Failed to save remote: {e}")

                new_results.append(new_url)

            if results_changed:
                t.result_urls = json.dumps(new_results)
                changed = True

        # 3. Migrate Video URL (Video Tasks)
        if t.type == "video" and t.video_url:
            if not (tos_bucket in t.video_url and "tos-" in t.video_url):
                new_url = t.video_url
                if t.video_url.startswith("/static/"):
                    local_path = t.video_url.lstrip("/")
                    real_path = os.path.abspath(local_path)
                    if not os.path.exists(real_path):
                         real_path = os.path.abspath(os.path.join("backend", local_path))
                    
                    if os.path.exists(real_path):
                        async with aiofiles.open(real_path, 'rb') as f:
                            data = await f.read()
                        new_url = await storage.upload_content(data, t.id, t.type, "output_video.mp4")
                        print(f"  [Video] Uploaded local {local_path} -> {new_url}")
                        changed = True
                elif t.video_url.startswith("http"):
                     try:
                        new_url = await storage.save_file(t.video_url, t.id, t.type, "output_video.mp4")
                        print(f"  [Video] Saved remote -> {new_url}")
                        changed = True
                     except: pass
                t.video_url = new_url

        # 4. Migrate Last Frame URL (Video Tasks)
        if t.type == "video" and t.last_frame_url:
            if not (tos_bucket in t.last_frame_url and "tos-" in t.last_frame_url):
                new_url = t.last_frame_url
                if t.last_frame_url.startswith("/static/"):
                    local_path = t.last_frame_url.lstrip("/")
                    real_path = os.path.abspath(local_path)
                    if not os.path.exists(real_path):
                         real_path = os.path.abspath(os.path.join("backend", local_path))
                    
                    if os.path.exists(real_path):
                        async with aiofiles.open(real_path, 'rb') as f:
                            data = await f.read()
                        new_url = await storage.upload_content(data, t.id, t.type, "output_cover.png")
                        print(f"  [Cover] Uploaded local {local_path} -> {new_url}")
                        changed = True
                elif t.last_frame_url.startswith("http"):
                     try:
                        new_url = await storage.save_file(t.last_frame_url, t.id, t.type, "output_cover.png")
                        print(f"  [Cover] Saved remote -> {new_url}")
                        changed = True
                     except: pass
                t.last_frame_url = new_url

        if changed:
            db.add(t)
            db.commit()
            print(f"  Task {t.id} updated.")
            
    db.close()
    print("Migration completed.")

if __name__ == "__main__":
    asyncio.run(migrate())
