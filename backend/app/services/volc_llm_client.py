import httpx
import asyncio
import json
import os
from typing import Optional, Dict, Any, List
from ..settings import ARK_API_KEY
from openai import AsyncOpenAI

class VolcLLMClient:
    def __init__(self):
        self.base_url = "https://ark.cn-beijing.volces.com/api/v3"

    async def chat_completion(
        self, 
        messages: List[Dict[str, str]], 
        model: str, 
        api_key: str = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        
        # Priority: explicit api_key > env var > settings > default
        key = api_key
        
        # If no explicit key provided, check env var
        if not key:
            key = os.getenv("ARK_API_KEY")
            
        # If still no key, check settings
        if not key:
            key = ARK_API_KEY
            
        if not key:
            raise ValueError("API Key is required")

        print(f"VolcLLMClient: Using model={model}")
        masked_key = key[:6] + "..." + key[-4:] if key and len(key) > 10 else "******"
        print(f"VolcLLMClient Debug: API Key in use: {masked_key}")
        
        # Initialize OpenAI Client (Async)
        client = AsyncOpenAI(
            api_key=key,
            base_url=self.base_url
        )
        
        try:
            # Call API using OpenAI SDK
            # Note: Volcengine's 'responses' API is compatible with chat completions structure
            # but for simplicity and standard compatibility we use client.chat.completions.create
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                extra_body={
                    "thinking": {"type": "disabled"}  # Explicitly disable deep thinking if not needed
                }
            )
            
            if response.choices and len(response.choices) > 0:
                content = response.choices[0].message.content
                return content
            return ""

        except Exception as e:
            print(f"VolcLLMClient Error: {e}")
            import traceback
            traceback.print_exc()
            raise
