import sys
import os
sys.path.append(os.getcwd())
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.models.system_config import SystemConfig

db_path = "/Users/bytedance/python_projects/app.db"
engine = create_engine(f"sqlite:///{db_path}")
Session = sessionmaker(bind=engine)
db = Session()

def set_conf(key, value):
    c = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    if c:
        c.value = value
    else:
        c = SystemConfig(key=key, value=value, description="Auto Configured")
        db.add(c)
    print(f"Set {key} = {value}")

set_conf("badcase_agent_id", "simple_agent-yqen3ryw")
db.commit()
db.close()
