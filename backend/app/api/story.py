from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from ..agents.story_agent import StoryAgent
from ..agents.storyboard_agent import StoryboardAgent

router = APIRouter()

# Initialize Agent (Singleton for now)
agent = StoryAgent()
sb_agent = StoryboardAgent()

class StoryRequest(BaseModel):
    prompt: str
    model: Optional[str] = "gpt-4o"

class VideoPlanRequest(BaseModel):
    scenes: List[Dict[str, Any]]

class RefineRequest(BaseModel):
    scenes: List[Dict[str, Any]]

class Character(BaseModel):
    name: str
    desc: str

class Scene(BaseModel):
    id: int
    desc: str
    prompt: str

class StoryResponse(BaseModel):
    title: str
    script: str
    characters: List[Character]
    scenes: List[Scene]

@router.post("/generate", response_model=StoryResponse)
async def generate_story(req: StoryRequest):
    """
    Generate a full story package using the StoryAgent.
    """
    # Delegate complex logic to the Intelligent Agent
    result = await agent.run(req.prompt)
    
    return result

@router.post("/video_plan")
async def generate_video_plan(req: VideoPlanRequest):
    """
    Get intelligent video parameters from StoryAgent.
    """
    plan = await agent.analyze_video_motion(req.scenes)
    return plan

@router.post("/refine_prompts")
async def refine_storyboard_prompts(req: RefineRequest):
    """
    Refine storyboard prompts using StoryboardAgent.
    """
    refined = await sb_agent.refine_scenes(req.scenes)
    return refined
