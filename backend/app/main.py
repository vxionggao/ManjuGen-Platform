from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os

# Ensure .env is loaded
from dotenv import load_dotenv
load_dotenv()

# DB Imports for Early Config Loading
from .db import Base, engine, SessionLocal
from .repositories.system_config_repo import SystemConfigRepo

# Load Env Vars EARLY (Before other imports might init veadk)
try:
    db = SessionLocal()
    sys_repo = SystemConfigRepo()
    ak = sys_repo.get(db, "volc_access_key")
    if ak and ak.value:
        os.environ["VOLC_ACCESSKEY"] = ak.value
        os.environ["VOLC_ACCESS_KEY"] = ak.value
        print(f"EARLY LOAD: VOLC_ACCESSKEY loaded")
    sk = sys_repo.get(db, "volc_secret_key")
    if sk and sk.value:
        os.environ["VOLC_SECRETKEY"] = sk.value
        os.environ["VOLC_SECRET_KEY"] = sk.value
    ark = sys_repo.get(db, "volc_api_key")
    if ark and ark.value:
         os.environ["ARK_API_KEY"] = ark.value
    db.close()
except Exception as e:
    print(f"EARLY LOAD FAILED: {e}")

from .api.users import router as users_router
from .api.tasks import router as tasks_router
from .api.config import router as config_router
from .api.queue import router as queue_router
from .api.storage import router as storage_router
from .api.assets import router as assets_router, prompt_router as prompt_router
from .api.materials import router as materials_router
from .api.badcase import router as badcase_router
from .api.best_practices import router as best_practices_router
from .api.story import router as story_router
from .api.video import router as video_router
from .api.projects import router as projects_router
from .services.manager_singleton import manager
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
        # Use backend/app/static
        base_path = os.path.dirname(os.path.abspath(__file__))
    
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
app.include_router(assets_router)
app.include_router(prompt_router)
app.include_router(materials_router)
app.include_router(badcase_router)
app.include_router(best_practices_router)
app.include_router(story_router, prefix="/api/story", tags=["story"])
app.include_router(video_router)
app.include_router(projects_router, prefix="/api/projects", tags=["projects"])

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
    # 先删除Asset表，然后重新创建，确保表结构是最新的
    from sqlalchemy import text
    from .models.asset import Asset
    from .models.project import Project
    
    # 检查Asset表是否存在
    # try:
    #     with engine.connect() as conn:
    #         result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='assets';"))
    #         if result.fetchone():
    #             print("Dropping existing assets table...")
    #             conn.execute(text("DROP TABLE assets;"))
    #             conn.commit()
    # except Exception as e:
    #     print(f"Error dropping assets table: {e}")
    
    # 创建所有表
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
        m = ModelConfig(name="Seedance 1.5 pro", endpoint_id="ep-20260211163333-s7hm7", type="video", concurrency_quota=10, request_quota=100)
        db.add(m)
    else:
        # Correct endpoint for video generation
        m.endpoint_id = "ep-20260211163333-s7hm7"
        
    db.commit()
    
    m_img = db.query(ModelConfig).filter_by(name="Seedream 4.5").first()
    if not m_img:
        m_img = ModelConfig(name="Seedream 4.5", endpoint_id="ep-20260211162310-447gb", type="image", concurrency_quota=100, request_quota=100)
        db.add(m_img)
    else:
        # Correct endpoint for image generation
        m_img.endpoint_id = "ep-20260211162310-447gb"
        
    # Also ensure doubao-seedream-4-5-251128 is configured
    m_seedream = db.query(ModelConfig).filter_by(name="doubao-seedream-4-5-251128").first()
    if not m_seedream:
        m_seedream = ModelConfig(name="doubao-seedream-4-5-251128", endpoint_id="ep-20260211162310-447gb", type="image", concurrency_quota=100, request_quota=100)
        db.add(m_seedream)
    else:
        m_seedream.endpoint_id = "ep-20260211162310-447gb"
        
    db.commit()
        
    # Add Doubao Model Config
    doubao_endpoint = "ep-20260211154202-kwk77"
    doubao_name = "doubao-seed-1-8-251228"
    
    # 1. Add/Update specific doubao model
    m_doubao = db.query(ModelConfig).filter_by(name=doubao_name).first()
    if not m_doubao:
        m_doubao = ModelConfig(name=doubao_name, endpoint_id=doubao_endpoint, type="llm", concurrency_quota=10, request_quota=100)
        db.add(m_doubao)
    else:
        m_doubao.endpoint_id = doubao_endpoint
    
    # 2. Add/Update gpt-4o alias to point to doubao (for frontend compatibility)
    m_gpt = db.query(ModelConfig).filter_by(name="gpt-4o").first()
    if not m_gpt:
        m_gpt = ModelConfig(name="gpt-4o", endpoint_id=doubao_endpoint, type="llm", concurrency_quota=10, request_quota=100)
        db.add(m_gpt)
    else:
        m_gpt.endpoint_id = doubao_endpoint
        
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
        # Force update DB with env var to ensure consistency
        print(f"EARLY LOAD: Updating DB volc_api_key from env")
        sys_repo.set(db, "volc_api_key", env_api_key, "Volcengine API Key")
    
    if not sys_repo.get(db, "storage_type"):
        sys_repo.set(db, "storage_type", "local", "Storage Type (local/s3/oss)")

    # Auto-configure TOS from env vars
    env_tos_ak = os.getenv("VOLCENGINE_ACCESS_KEY")
    env_tos_sk = os.getenv("VOLCENGINE_SECRET_KEY")
    # Explicitly set bucket from user input
    sys_repo.set(db, "storage_bucket", "hmtos", "TOS Bucket Name")
    
    if env_tos_ak and env_tos_sk:
        print("EARLY LOAD: Detected VOLCENGINE credentials, configuring TOS...")
        sys_repo.set(db, "storage_ak", env_tos_ak, "TOS Access Key")
        sys_repo.set(db, "storage_sk", env_tos_sk, "TOS Secret Key")
        
        # Set defaults if missing
        if not sys_repo.get(db, "storage_endpoint"):
            sys_repo.set(db, "storage_endpoint", "tos-cn-beijing.volces.com", "TOS Endpoint")
        if not sys_repo.get(db, "storage_region"):
            sys_repo.set(db, "storage_region", "cn-beijing", "TOS Region")
            
        # Switch to TOS if bucket exists, otherwise keep local (user needs to set bucket)
        if sys_repo.get(db, "storage_bucket"):
            sys_repo.set(db, "storage_type", "tos", "Storage Type")
            print("EARLY LOAD: Switched storage_type to 'tos'")
        else:
            print("EARLY LOAD: TOS credentials set, but 'storage_bucket' is missing. Keeping 'local' storage until bucket is configured.")

    # Initialize built-in assets
    # from .services.asset_initializer import AssetInitializer
    # asset_initializer = AssetInitializer(db)
    # asset_initializer.initialize_built_in_assets()

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
