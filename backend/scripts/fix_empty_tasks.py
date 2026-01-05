
from app.db import SessionLocal
from app.models.task import Task
import json

def fix_tasks():
    db = SessionLocal()
    tasks = db.query(Task).filter(Task.status == "succeeded").all()
    count = 0
    for t in tasks:
        # Check if result_urls is empty or "[]"
        is_empty = False
        if not t.result_urls:
            is_empty = True
        else:
            try:
                urls = json.loads(t.result_urls)
                if not urls:
                    is_empty = True
            except:
                if not t.result_urls.strip():
                    is_empty = True
        
        # Check video_url for video tasks
        if t.type == 'video' and not t.video_url:
             is_empty = True

        if is_empty:
            print(f"Marking task {t.id} as failed (was succeeded but no results)")
            t.status = "failed"
            count += 1
            
    db.commit()
    print(f"Fixed {count} tasks.")
    db.close()

if __name__ == "__main__":
    fix_tasks()
