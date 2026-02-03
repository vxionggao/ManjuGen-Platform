import time
import asyncio
import json
import os
import aiofiles
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..schemas.task import CreateTaskRequest, TaskOut
from .deps import get_current_user
from ..db import SessionLocal
from ..repositories.task_repo import TaskRepo
from ..services.task_service import TaskService
from ..models.model_config import ModelConfig
from ..services.worker_singleton import worker
from ..services.storage_service import StorageService
import base64

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.post("", response_model=TaskOut)
async def create_task(payload: CreateTaskRequest, user=Depends(get_current_user)):
    db: Session = SessionLocal()
    repo = TaskRepo()
    service = TaskService(repo)
    data = {
        "user_id": 1,
        "type": payload.type,
        "model_id": payload.model_id,
        "prompt": payload.prompt or "",
        "input_images": "[]", # Placeholder, will update after upload
        "status": "queued",
        "created_at": int(time.time()),
    }
    t = service.create_task(db, data)
    
    # Upload inputs to Storage
    storage = StorageService(db)
    uploaded_images = []
    
    # Upload Prompt
    if payload.prompt:
        await storage.upload_content(payload.prompt, t.id, payload.type, "prompt.txt")
    
    # Upload Images
    content_images = []
    if payload.images:
        for i, img_str in enumerate(payload.images):
            # Check if base64
            if img_str.startswith("data:image"):
                # Decode base64
                try:
                    header, encoded = img_str.split(",", 1)
                    
                    # Ensure MIME type is lowercase (e.g. data:image/PNG -> data:image/png)
                    # Volcengine requires lowercase image format
                    mime_part = header.split(";")[0]
                    if mime_part != mime_part.lower():
                        header = mime_part.lower() + ";base64"
                        
                    # Remove newlines/carriage returns from base64 string
                    encoded = encoded.replace("\n", "").replace("\r", "")
                    
                    # Reconstruct standardized Data URI
                    img_str = f"{header},{encoded}"
                    
                    image_data = base64.b64decode(encoded)
                    ext = header.split(";")[0].split("/")[1]
                    filename = f"input_{i}.{ext}"
                    url = await storage.upload_content(image_data, t.id, payload.type, filename)
                    uploaded_images.append(url)
                    # User requirement: Pass base64 directly to API, keeping the prefix
                    # Documentation says: data:image/<type>;base64,<data>
                    # Note <type> must be lowercase.
                    # Frontend usually sends "data:image/png;base64,...", which is correct.
                    content_images.append(img_str)
                except Exception as e:
                    print(f"Failed to upload image {i}: {e}")
                    # Even if upload fails, we try to pass base64 to API
                    content_images.append(img_str)
            else:
                # Not a base64 string, reject it.
                # User requirement: Backend accepts only base64 data.
                print(f"Error: Received non-base64 image input at index {i}")
                # We do NOT append to content_images, effectively dropping it.
                # Or better, we could raise HTTPException, but that might be too harsh if user just wants to see error in log?
                # But to strictly follow "Front end must pass image data", we should ignore non-image data.
                pass
    
    # Update DB with uploaded URLs
    t.input_images = json.dumps(uploaded_images)
    db.commit()
    
    m = db.query(ModelConfig).get(payload.model_id)
    if m:
        if payload.type == "image":
            p = {"model": m.name, "prompt": payload.prompt or "", "images": content_images, "size": payload.size}
        else:
            # Construct content payload for video tasks
            content = []
            
            # 1. Add text prompt
            if payload.prompt:
                content.append({"type": "text", "text": payload.prompt})
            
            # 2. Add images with roles (first_frame, last_frame)
            # Logic: If 1 image -> first_frame
            #        If 2 images -> first_frame, last_frame
            if content_images:
                if len(content_images) >= 1:
                    content.append({
                        "type": "image_url", 
                        "image_url": {"url": content_images[0]},
                        "role": "first_frame"
                    })
                if len(content_images) >= 2:
                    content.append({
                        "type": "image_url", 
                        "image_url": {"url": content_images[1]},
                        "role": "last_frame"
                    })
            
            p = {"model": m.name, "content": content}
            if payload.params:
                p.update(payload.params)
        asyncio.create_task(worker.enqueue(t.id, payload.model_id, payload.type, p))
    db.close()
    return TaskOut(id=str(t.id), status="queued", type=payload.type, created_at=data["created_at"], prompt=data["prompt"], input_images=uploaded_images)

@router.get("", response_model=list[TaskOut])
def list_tasks(user=Depends(get_current_user)):
    db: Session = SessionLocal()
    repo = TaskRepo()
    storage = StorageService(db)
    tasks = repo.list_by_user(db, 1)
    out = []
    for t in tasks:
        try:
            urls = json.loads(t.result_urls) if t.result_urls else None
        except:
            urls = t.result_urls.split(",") if t.result_urls else None
            
        # Refresh result URLs
        if urls:
            urls = [storage.refresh_signed_url(u) for u in urls]
            
        try:
            in_imgs = json.loads(t.input_images) if t.input_images else None
        except:
            in_imgs = t.input_images.split(",") if t.input_images else None
            
        # Refresh input URLs
        if in_imgs:
            in_imgs = [storage.refresh_signed_url(u) for u in in_imgs]

        # Refresh video URLs
        video_url = storage.refresh_signed_url(t.video_url)
        last_frame_url = storage.refresh_signed_url(t.last_frame_url)

        out.append(TaskOut(
            id=str(t.id), 
            status=t.status, 
            type=t.type,
            model_id=t.model_id,
            result_urls=urls, 
            video_url=video_url, 
            last_frame_url=last_frame_url,
            created_at=t.created_at,
            finished_at=t.finished_at,
            input_images=in_imgs,
            prompt=t.prompt,
            resolution=t.resolution,
            ratio=t.ratio,
            duration=t.duration
        ))
    out.reverse() # Show newest first
    db.close()
    return out

@router.delete("")
def clear_tasks(type: Optional[str] = None, user=Depends(get_current_user)):
    db: Session = SessionLocal()
    repo = TaskRepo()
    # TODO: Also delete files from storage for all tasks?
    # Current implementation only clears DB records.
    repo.clear_all(db, 1, type)
    db.close()
    return {"message": "All tasks cleared"}

@router.delete("/{task_id}")
async def delete_task(task_id: int, user=Depends(get_current_user)):
    db: Session = SessionLocal()
    repo = TaskRepo()
    storage = StorageService(db)
    
    # 1. Get task info to find associated files
    task = repo.get(db, task_id)
    if not task:
        db.close()
        return {"message": "Task not found"}
        
    # 2. Delete files from storage
    try:
        # Handle result_urls
        if task.result_urls:
            try:
                urls = json.loads(task.result_urls)
            except:
                urls = task.result_urls.split(",")
            for url in urls:
                await storage.delete_file(url)
                
        # Handle input_images
        if task.input_images:
            try:
                inputs = json.loads(task.input_images)
            except:
                inputs = task.input_images.split(",")
            for url in inputs:
                await storage.delete_file(url)
                
        # Handle video files
        if task.video_url:
            await storage.delete_file(task.video_url)
        if task.last_frame_url:
            await storage.delete_file(task.last_frame_url)
    except Exception as e:
        print(f"Warning: Failed to delete some files for task {task_id}: {e}")
        # Proceed to delete DB record anyway

    # 3. Delete from DB
    repo.delete(db, task_id)
    db.close()
    return {"message": f"Task {task_id} deleted"}
