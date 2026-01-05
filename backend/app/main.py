from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from .api.users import router as users_router
from .api.tasks import router as tasks_router
from .api.config import router as config_router
from .api.queue import router as queue_router
from .api.storage import router as storage_router
from .services.manager_singleton import manager
from .db import Base, engine, SessionLocal
from .services.worker_singleton import worker

app = FastAPI(redirect_slashes=False)

# Mount static files
import os
import sys

def get_static_dir():
    if getattr(sys, 'frozen', False):
        # Running in PyInstaller bundle
        base_path = sys._MEIPASS
    else:
        # Running in dev mode
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    static_path = os.path.join(base_path, "static")
    if not os.path.exists(static_path):
        os.makedirs(static_path, exist_ok=True)
    return static_path

def get_frontend_dist():
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend")
    return os.path.join(base_path, "dist")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router)
app.include_router(tasks_router)
app.include_router(config_router)
app.include_router(queue_router)
app.include_router(storage_router)

@app.websocket("/ws/tasks")
async def ws_tasks(ws: WebSocket):
    await manager.connect(1, ws)
    try:
        while True:
            await ws.receive_text()
    except Exception:
        manager.disconnect(1, ws)

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    from .services.user_service import UserService
    from .repositories.user_repo import UserRepo
    from .repositories.model_repo import ModelConfigRepo
    from .models.model_config import ModelConfig
    user_repo = UserRepo()
    user_service = UserService(user_repo)
    admin = user_repo.get_by_username(db, "admin")
    if not admin:
        user_repo.create(db, "admin", "admin", "admin")
    
    model_repo = ModelConfigRepo()
    m = db.query(ModelConfig).filter_by(name="Seedance 1.5 pro").first()
    if not m:
        m = ModelConfig(name="Seedance 1.5 pro", endpoint_id="ep-20251223200430-djx9q", type="video", concurrency_quota=10, request_quota=100)
        db.add(m)
        db.commit()
    
    m_img = db.query(ModelConfig).filter_by(name="Seedream 4.5").first()
    if not m_img:
        m_img = ModelConfig(name="Seedream 4.5", endpoint_id="ep-20251210163826-t8lm8", type="image", concurrency_quota=100, request_quota=100)
        db.add(m_img)
        db.commit()
    else:
        m_img.endpoint_id = "ep-20251210163826-t8lm8"
        db.commit()
    
    from .services.token_bucket import TokenBucket
    ms = model_repo.list(db)
    for m in ms:
        worker.buckets[m.id] = TokenBucket(m.concurrency_quota)
    
    from .repositories.system_config_repo import SystemConfigRepo
    sys_repo = SystemConfigRepo()
    import os
    env_api_key = os.getenv("ARK_API_KEY")
    if env_api_key:
        if not sys_repo.get(db, "volc_api_key"):
            sys_repo.set(db, "volc_api_key", env_api_key, "Volcengine API Key")
    
    if not sys_repo.get(db, "storage_type"):
        sys_repo.set(db, "storage_type", "local", "Storage Type (local/s3/oss)")

    # Resume running tasks
    from .models.task import Task
    import asyncio
    
    running_tasks = db.query(Task).filter(Task.status == "running").all()
    for t in running_tasks:
        if t.external_id:
            print(f"Resuming task {t.id} with external_id {t.external_id}")
            api_key_cfg = sys_repo.get(db, "volc_api_key")
            api_key = api_key_cfg.value if api_key_cfg else None
            asyncio.create_task(worker._poll_until_done(t.id, t.external_id, api_key=api_key))

    db.close()

# Mount /static for backend static files
app.mount("/static", StaticFiles(directory=get_static_dir()), name="static")

# Mount frontend build
frontend_dist = get_frontend_dist()
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
    
    # Catch-all for SPA client-side routing
    from starlette.exceptions import HTTPException as StarletteHTTPException
    from starlette.requests import Request
    from starlette.responses import FileResponse, JSONResponse

    @app.exception_handler(404)
    async def spa_fallback(request: Request, exc: StarletteHTTPException):
        # Only handle GET/HEAD requests that don't start with /api
        if request.method in ["GET", "HEAD"] and not request.url.path.startswith("/api"):
            index_path = os.path.join(frontend_dist, "index.html")
            if os.path.exists(index_path):
                return FileResponse(index_path)
        return JSONResponse({"detail": "Not Found"}, status_code=404)
