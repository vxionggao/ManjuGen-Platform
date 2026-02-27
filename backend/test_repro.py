
import asyncio
import sys
import os
from unittest.mock import MagicMock, AsyncMock

# Add project root to sys.path
sys.path.append("/Users/bytedance/python_projects/et_副本/backend")

# Mock dependencies before importing StoryAgent
sys.modules["app.services.volc_llm_client"] = MagicMock()
sys.modules["app.repositories.system_config_repo"] = MagicMock()
sys.modules["app.models.model_config"] = MagicMock()
sys.modules["app.db"] = MagicMock()

# Now import StoryAgent
from app.agents.story_agent import StoryAgent

async def test_fallback():
    agent = StoryAgent()
    
    # Mock client to raise Exception
    agent.client = AsyncMock()
    # Simulate a 403 error (just a generic Exception for now as we want to see if it catches Exception)
    agent.client.chat_completion.side_effect = Exception("403 Forbidden details")
    
    # Mock DB session to avoid errors
    mock_db = MagicMock()
    sys.modules["app.db"].SessionLocal.return_value = mock_db
    
    print("Running agent...")
    result = await agent.run("test prompt")
    print("Result keys:", result.keys())
    print("Title:", result.get("title"))

if __name__ == "__main__":
    asyncio.run(test_fallback())
