
from sqlalchemy.orm import Session
from ..models.project import Project
import json
import uuid

class ProjectRepo:
    def create(self, db: Session, title: str, cover_image: str, data: dict):
        project_id = str(uuid.uuid4())
        db_project = Project(
            id=project_id,
            title=title,
            cover_image=cover_image,
            data=json.dumps(data)
        )
        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        return db_project

    def update(self, db: Session, project_id: str, title: str, cover_image: str, data: dict):
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            project.title = title
            if cover_image:
                project.cover_image = cover_image
            project.data = json.dumps(data)
            db.commit()
            db.refresh(project)
        return project

    def list(self, db: Session, skip: int = 0, limit: int = 100):
        return db.query(Project).order_by(Project.created_at.desc()).offset(skip).limit(limit).all()

    def get(self, db: Session, project_id: str):
        return db.query(Project).filter(Project.id == project_id).first()
    
    def delete(self, db: Session, project_id: str):
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            db.delete(project)
            db.commit()
            return True
        return False
