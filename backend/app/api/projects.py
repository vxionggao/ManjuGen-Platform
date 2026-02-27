
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from ..db import get_db
from ..repositories.project_repo import ProjectRepo

router = APIRouter()
repo = ProjectRepo()

class ProjectCreate(BaseModel):
    title: str
    cover_image: Optional[str] = None
    data: Dict[str, Any]

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    cover_image: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

@router.post("", response_model=Dict[str, Any])
def create_project(req: ProjectCreate, db: Session = Depends(get_db)):
    return repo.create(db, req.title, req.cover_image, req.data).to_dict()

@router.get("", response_model=List[Dict[str, Any]])
def list_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return [p.to_dict() for p in repo.list(db, skip, limit)]

@router.get("/{project_id}", response_model=Dict[str, Any])
def get_project(project_id: str, db: Session = Depends(get_db)):
    p = repo.get(db, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p.to_dict()

@router.put("/{project_id}", response_model=Dict[str, Any])
def update_project(project_id: str, req: ProjectUpdate, db: Session = Depends(get_db)):
    # Fetch existing to merge data if needed, or just overwrite
    # For simplicity, we require title in update or fallback
    p = repo.get(db, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    
    title = req.title or p.title
    cover = req.cover_image or p.cover_image
    data = req.data or {} # In real app, might want to merge
    
    return repo.update(db, project_id, title, cover, data).to_dict()

@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    success = repo.delete(db, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "success"}
