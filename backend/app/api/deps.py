from fastapi import Header, HTTPException
from typing import Optional
from ..db import SessionLocal
from ..repositories.user_repo import UserRepo

def get_current_user(
    authorization: Optional[str] = Header(None),
    x_app_token: Optional[str] = Header(None, alias="X-App-Token")
) -> dict:
    print(f"DEBUG: get_current_user called")
    print(f"DEBUG: Authorization header: {authorization}")
    print(f"DEBUG: X-App-Token header: {x_app_token}")

    # Prioritize X-App-Token (to avoid conflict with Gateway Authorization)
    token_str = x_app_token or authorization
    
    if not token_str:
        print("DEBUG: No token string found in headers")
        raise HTTPException(status_code=401)
    
    # Handle Bearer prefix if present
    if token_str.startswith("Bearer "):
        token_str = token_str[7:]
    
    print(f"DEBUG: Processing token string: {token_str}")
    
    # Simple token format "username:token"
    # Allow loose parsing: try to find username part
    if ":" in token_str:
        username = token_str.split(":")[0]
    else:
        # Fallback: if no colon, assume the whole string might be username (or handle error)
        # For now, stick to the simple contract but be more flexible
        username = token_str
    
    print(f"DEBUG: Extracted username: {username}")

    db = SessionLocal()
    repo = UserRepo()
    u = repo.get_by_username(db, username)
    db.close()
    
    if not u:
        print(f"DEBUG: User {username} not found in DB")
        raise HTTPException(status_code=401)
        
    print(f"DEBUG: User {username} authenticated successfully")
    return {"id": u.id, "username": u.username, "role": u.role}
