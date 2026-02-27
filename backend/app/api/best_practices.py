from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.best_practice import BestPractice
from pydantic import BaseModel
from typing import Optional, List
import time
import shutil
import os
import uuid

router = APIRouter(prefix="/api/best_practices", tags=["best_practices"])

class BestPracticeCreate(BaseModel):
    name: str
    url: str
    category: List[str]
    prompt: Optional[str] = ""
    model_name: Optional[str] = ""

class BestPracticeRead(BaseModel):
    id: int
    name: str
    url: str
    category: str
    prompt: Optional[str] = ""
    model_name: Optional[str] = ""
    created_at: int
    class Config:
        orm_mode = True

@router.get("", response_model=List[BestPracticeRead])
def list_best_practices(category: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(BestPractice)
    if category and category != "all":
        q = q.filter(BestPractice.category.like(f"%{category}%"))
    return q.order_by(BestPractice.created_at.desc()).all()

@router.post("/upload")
async def upload_best_practice_file(file: UploadFile = File(...)):
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    allowed_exts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".webm", ".avi"]
    if ext not in allowed_exts:
        raise HTTPException(400, "Invalid file format. Allowed: Image/Video")
    
    # Path: backend/app/static/best_practices
    current_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.dirname(current_dir)
    upload_dir = os.path.join(app_dir, "static", "best_practices")
    
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
        
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(upload_dir, unique_name)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        print(f"Upload failed: {e}")
        raise HTTPException(500, f"File save failed: {e}")
        
    return {"url": f"/static/best_practices/{unique_name}"}

@router.post("", response_model=BestPracticeRead)
def create_best_practice(item: BestPracticeCreate, db: Session = Depends(get_db)):
    print(f"DEBUG: create_best_practice called with {item}")
    try:
        data = item.dict()
        data["category"] = ",".join(data["category"])
        db_item = BestPractice(**data)
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        return db_item
    except Exception as e:
        print(f"DEBUG: Create failed: {e}")
        raise HTTPException(500, f"Create failed: {e}")

@router.delete("/{id}")
def delete_best_practice(id: int, db: Session = Depends(get_db)):
    item = db.query(BestPractice).filter(BestPractice.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
    return {"status": "success"}
