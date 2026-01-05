from fastapi import Header, HTTPException
from typing import Optional
from ..db import SessionLocal
from ..repositories.user_repo import UserRepo

def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401)
    # Simple token format "username:token"
    parts = authorization.split(":")
    if len(parts) != 2 or parts[1] != "token":
        raise HTTPException(status_code=401)
    
    username = parts[0]
    db = SessionLocal()
    repo = UserRepo()
    u = repo.get_by_username(db, username)
    db.close()
    
    if not u:
        raise HTTPException(status_code=401)
        
    return {"id": u.id, "username": u.username, "role": u.role}
