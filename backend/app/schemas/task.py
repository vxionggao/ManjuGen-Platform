from pydantic import BaseModel
from typing import Any, Optional, List, Dict

class CreateTaskRequest(BaseModel):
    type: str
    model_id: int
    prompt: Optional[str] = None
    images: Optional[List[str]] = None
    size: Optional[str] = None
    params: Optional[Dict[str, Any]] = None
    content: Optional[List[Dict[str, Any]]] = None # Support flexible content structure

class TaskOut(BaseModel):
    id: str # Return as string to handle 64-bit integers safely in JS
    status: str
    type: str
    model_id: Optional[int] = None
    result_urls: Optional[List[str]] = None
    video_url: Optional[str] = None
    last_frame_url: Optional[str] = None
    created_at: Optional[int] = None
    finished_at: Optional[int] = None
    input_images: Optional[List[str]] = None
    prompt: Optional[str] = None
    resolution: Optional[str] = None
    ratio: Optional[str] = None
    duration: Optional[int] = None
