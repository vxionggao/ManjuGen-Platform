
from backend.app.db import SessionLocal
from backend.app.repositories.project_repo import ProjectRepo

def cleanup():
    db = SessionLocal()
    repo = ProjectRepo()
    
    projects = repo.list(db)
    deleted_count = 0
    
    print(f"Found {len(projects)} projects.")
    
    for p in projects:
        if "Test Project" in p.title:
            print(f"Deleting project: {p.title} (ID: {p.id})")
            repo.delete(db, p.id)
            deleted_count += 1
            
    print(f"Deleted {deleted_count} test projects.")
    db.close()

if __name__ == "__main__":
    cleanup()
