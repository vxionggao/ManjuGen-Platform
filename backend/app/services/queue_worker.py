import asyncio
import time
import os
import aiohttp
import aiofiles
from urllib.parse import urlparse
from sqlalchemy.orm import Session
from ..services.token_bucket import TokenBucket
from ..services.task_service import TaskService
from ..repositories.task_repo import TaskRepo
from ..repositories.model_repo import ModelConfigRepo
from ..repositories.system_config_repo import SystemConfigRepo
from ..models.model_config import ModelConfig
from ..db import SessionLocal
from .volc_image_client import VolcImageClient
from .volc_video_client import VolcVideoClient
from .manager_singleton import manager
from .storage_service import StorageService

async def download_file(url: str, save_dir: str) -> str:
    if not url: return ""
    try:
        os.makedirs(save_dir, exist_ok=True)
        filename = os.path.basename(urlparse(url).path)
        # Handle cases where url might have query params
        if "?" in filename:
            filename = filename.split("?")[0]
        if not filename:
            filename = f"{int(time.time())}.bin"
            
        save_path = os.path.join(save_dir, filename)
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                if resp.status == 200:
                    f = await aiofiles.open(save_path, mode='wb')
                    await f.write(await resp.read())
                    await f.close()
                    return f"/static/{filename}"
    except Exception as e:
        print(f"Download failed for {url}: {e}")
    return url # Fallback to remote url

class QueueWorker:
    def __init__(self):
        self.buckets: dict[int, TokenBucket] = {}
        self.task_repo = TaskRepo()
        self.task_service = TaskService(self.task_repo)
        self.image_client = VolcImageClient()
        self.video_client = VolcVideoClient()
        self.model_repo = ModelConfigRepo()
        self.storage = StorageService() # Will bind db on usage or init
        
    def init_buckets(self):
        db: Session = SessionLocal()
        models = db.query(ModelConfig).all()
        for m in models:
            self.buckets[m.id] = TokenBucket(m.concurrency_quota)
        db.close()
    async def enqueue(self, task_id: int, model_id: int, ttype: str, payload: dict):
        bucket = self.buckets.get(model_id)
        if not bucket:
            bucket = TokenBucket(1)
            self.buckets[model_id] = bucket
        await bucket.acquire()
        try:
            db: Session = SessionLocal()
            self.storage.db = db # Bind current session
            sys_repo = SystemConfigRepo()
            api_key_cfg = sys_repo.get(db, "volc_api_key")
            api_key = api_key_cfg.value if api_key_cfg else None
            
            self.task_repo.update_status(db, task_id, "running")
            print(f"Task {task_id} running...")
            if ttype == "image":
                m = db.query(ModelConfig).filter_by(name=payload["model"]).first()
                real_model = m.endpoint_id if m and m.endpoint_id else payload["model"]
                urls = await self.image_client.create_image_task(real_model, payload.get("prompt", ""), payload.get("images"), payload.get("size"), api_key=api_key)
                api_end = int(time.time())
                print(f"Task {task_id} got urls: {urls}")
                
                # Download images
                local_urls = []
                for i, u in enumerate(urls):
                    local = await self.storage.save_file(u, task_id, "image", f"output_{i}.png")
                    local_urls.append(local)
                
                self.task_repo.set_result(db, task_id, local_urls)
                self.task_repo.update_status(db, task_id, "succeeded", api_end)
                await manager.publish(1, {"type": "task_update", "id": str(task_id), "status": "succeeded", "result_urls": local_urls, "finished_at": api_end})
                print(f"Task {task_id} finished")
            else:
                m = db.query(ModelConfig).filter_by(name=payload["model"]).first()
                real_model = m.endpoint_id if m and m.endpoint_id else payload["model"]
                
                # Prepare full payload for video client
                # We construct the exact JSON body expected by the API
                # This ensures all parameters in 'payload' (from template) are preserved
                req_body = payload.copy()
                req_body["model"] = real_model
                
                # Ensure duration is int if present (legacy support)
                if "duration" in req_body and isinstance(req_body["duration"], (str, float)):
                    try:
                        req_body["duration"] = int(float(req_body["duration"]))
                    except:
                        pass

                # --- LOGGING START ---
                try:
                    import json
                    debug_body = req_body.copy()
                    # Truncate base64 strings in content
                    if "content" in debug_body and isinstance(debug_body["content"], list):
                        new_content = []
                        for item in debug_body["content"]:
                            if isinstance(item, dict):
                                new_item = item.copy()
                                if new_item.get("type") == "image_url" and "image_url" in new_item:
                                    if isinstance(new_item["image_url"], dict):
                                        url_obj = new_item["image_url"].copy()
                                        if "url" in url_obj and isinstance(url_obj["url"], str) and url_obj["url"].startswith("data:image"):
                                            url_obj["url"] = url_obj["url"][:50] + "...[truncated]"
                                        new_item["image_url"] = url_obj
                                new_content.append(new_item)
                            else:
                                new_content.append(item)
                        debug_body["content"] = new_content
                    print(f"Task {task_id} Request Body: {json.dumps(debug_body, ensure_ascii=False)}")
                except Exception as log_err:
                    print(f"Failed to log request body (JSON error): {log_err}")
                    print(f"Task {task_id} Request Body (raw): {req_body}")
                # --- LOGGING END ---

                ext_id = await self.video_client.create_video_task(req_body, api_key=api_key) 
                self.task_repo.update_external_id(db, task_id, ext_id)
                await self._poll_until_done(task_id, ext_id, api_key=api_key)
            db.close()
        except Exception as e:
            import traceback
            print("QueueWorker Error:")
            print(traceback.format_exc())
            try:
                self.task_repo.update_status(db, task_id, "failed")
                await manager.publish(1, {"type": "task_update", "id": str(task_id), "status": "failed"})
            except Exception:
                pass
            try:
                db.close()
            except Exception:
                pass
        finally:
            bucket.release()
    async def _poll_until_done(self, task_id: int, ext_id: str, api_key: str = None):
        db: Session = SessionLocal()
        self.storage.db = db
        while True:
            try:
                data = await self.video_client.get_task_status(ext_id, api_key=api_key)
                # Volcengine status: queued, running, succeeded, failed, cancelled, expired
                # We map them to our status.
                status = data.get("status")
                print(f"Task {task_id} polling status: {status}")

                # Update status in DB if it changed (e.g. queued -> running)
                # We can't easily check prev status here without querying DB, but we can just update.
                # Or better, we only update if it's running or done.
                if status == "running":
                     self.task_repo.update_status(db, task_id, "running")
                     await manager.publish(1, {"type": "task_update", "id": str(task_id), "status": "running"})

                if status in {"succeeded", "failed", "cancelled", "expired"}:
                    api_end = int(time.time())
                    if status == "succeeded":
                        content = data.get("content") or {}
                        video_url = content.get("video_url")
                        last_frame_url = content.get("last_frame_url")
                        
                        local_video = await self.storage.save_file(video_url, task_id, "video", "output_video.mp4")
                        local_cover = await self.storage.save_file(last_frame_url, task_id, "video", "output_cover.png")

                        if video_url:
                            self.task_repo.set_video_result(db, task_id, local_video, local_cover)
                            await manager.publish(1, {"type": "task_update", "id": str(task_id), "status": "succeeded", "video_url": local_video, "last_frame_url": local_cover, "finished_at": api_end})
                        else:
                            print(f"Task {task_id} succeeded but no video_url found")
                            status = "failed"
                    
                    final_status = status if status in ["succeeded", "failed"] else "failed"
                    self.task_repo.update_status(db, task_id, final_status, api_end)
                    if final_status == "failed":
                         await manager.publish(1, {"type": "task_update", "id": str(task_id), "status": "failed"})
                    break
                await asyncio.sleep(2)
            except Exception as e:
                import traceback
                print(f"Polling Error for task {task_id}:")
                print(traceback.format_exc())
                # Don't break immediately, maybe network blip. 
                # But if persistent, we should timeout. For now simple retry.
                await asyncio.sleep(2)
        db.close()
