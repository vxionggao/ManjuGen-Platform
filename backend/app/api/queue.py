from fastapi import APIRouter

router = APIRouter(prefix="/api/queue", tags=["queue"])

@router.post("/callback")
def callback():
    return {"ok": True}
