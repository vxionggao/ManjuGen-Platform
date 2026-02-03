from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..schemas.user import LoginRequest, LoginResponse, UserOut
from .deps import get_current_user
from ..db import SessionLocal
from ..repositories.user_repo import UserRepo
from ..services.user_service import UserService

router = APIRouter(prefix="/api/users", tags=["users"])

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    print(f"Login request for user: {payload.username}")
    db: Session = SessionLocal()
    repo = UserRepo()
    service = UserService(repo)
    res = service.login(db, payload.username, payload.password)
    db.close()
    if not res:
        print(f"Login failed for user: {payload.username}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    print(f"Login success for user: {payload.username}")
    return LoginResponse(token=res[0], role=res[1])

@router.get("/me", response_model=UserOut)
def me(user=Depends(get_current_user)):
    return UserOut(id=user["id"], username=user["username"], role=user["role"])
