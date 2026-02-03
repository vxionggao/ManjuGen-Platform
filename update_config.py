from backend.app.db import SessionLocal
from backend.app.repositories.system_config_repo import SystemConfigRepo

db = SessionLocal()
repo = SystemConfigRepo()

configs = {
    "vikingdb_host": "api-vikingdb.volces.com",
    "vikingdb_region": "cn-beijing",
    "vikingdb_collection": "yoyo_images",
    "vikingdb_index": "yoyo_images_index",
    "tos_bucket_name": "hmtos"
}

for k, v in configs.items():
    repo.set(db, k, v, "Auto-configured by Assistant")

print("Config updated.")
db.close()
