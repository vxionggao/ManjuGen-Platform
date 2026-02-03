from fastapi import APIRouter, Body, HTTPException, Depends
from typing import Dict, Any, List, Optional
import httpx
import json
import os
import sys
import base64
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..db import get_db
from ..repositories.system_config_repo import SystemConfigRepo
from ..services.tos_service import TOSService
from ..services.storage_service import StorageService

import importlib.util

# Import Local Agent
# User requested: /Users/bytedance/python_projects/et_副本/badcase_optimizer_agent.py
AGENT_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "badcase_optimizer_agent.py")

router = APIRouter(prefix="/api/badcase", tags=["badcase"])

SYSTEM_PROMPT = """You are a professional Manga Adaptation Badcase Optimization Agent.
Your task is NOT to judge whether an image looks good.
Your task is to transform subjective visual problems into:
1. Structured failure diagnosis
2. Minimal-cost fix strategies
3. Reproducible regeneration instructions
4. Verification checklist
You will be given:
- A generation prompt
- A generated image
- A reference image (optional)
You must:
- Compare the generated image against the prompt and reference
- Identify where semantic, stylistic, or structural mismatch occurs
- Suggest the smallest prompt changes that can fix the problem
- Output a ready-to-use optimized prompt
Never be vague.
Never say "improve quality" or "make it better".
Every suggestion must be operational.
Return STRICT JSON with keys: diagnosis, fix_strategy, optimized_prompt, checklist.
diagnosis must include: style_mismatch, semantic_drift, structural_errors (arrays of strings).
fix_strategy must include: high_priority, optional (arrays of strings)."""

class OptimizeRequest(BaseModel):
    prompt: str
    image_url: str
    reference_url: Optional[str] = None

class OptimizeResponse(BaseModel):
    diagnosis: Dict[str, List[str]]
    fix_strategy: Dict[str, List[str]]
    optimized_prompt: str
    checklist: List[str]
    
    # Rich Agent Output
    overall_diagnosis: Optional[str] = None
    style_inference: Optional[str] = None
    badcase_tags: Optional[List[str]] = None
    severity_scores: Optional[List[Dict[str, Any]]] = None
    top_fixes: Optional[List[Dict[str, Any]]] = None
    master_prompt: Optional[str] = None
    diff_prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    edit_instructions: Optional[List[Dict[str, Any]]] = None

def get_image_payload(url: str):
    if not url:
        return None
        
    if url.startswith("tos://"):
        try:
            service = TOSService()
            signed_url = service.sign_url(url, expires=3600)
            return {"type": "image_url", "image_url": {"url": signed_url}}
        except Exception as e:
            print(f"Error signing TOS url: {e}")
            return None
            
    if url.startswith("/static/"):
        # Local file
        try:
            # Resolve path. Assume running from project root
            # url: /static/imported/xxx.png
            # path: backend/app/static/imported/xxx.png
            path = f"backend/app{url}"
            if os.path.exists(path):
                with open(path, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("utf-8")
                    return {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}}
        except Exception as e:
            print(f"Error reading local file: {e}")
            return None
            
    # Regular HTTP URL
    return {"type": "image_url", "image_url": {"url": url}}

@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_badcase(req: OptimizeRequest, db: Session = Depends(get_db)):
    # 1. Setup Env Vars from DB
    repo = SystemConfigRepo()
    ak = repo.get(db, "volc_access_key")
    sk = repo.get(db, "volc_secret_key")
    ark_key = repo.get(db, "volc_api_key")
    
    if ak and ak.value:
        print(f"DEBUG: Setting VOLC_ACCESSKEY from DB: {ak.value[:4]}...")
        os.environ["VOLC_ACCESSKEY"] = ak.value
        os.environ["VOLC_ACCESS_KEY"] = ak.value
    else:
        print("DEBUG: volc_access_key not found in DB")

    if sk and sk.value:
        os.environ["VOLC_SECRETKEY"] = sk.value
        os.environ["VOLC_SECRET_KEY"] = sk.value
    
    if ark_key and ark_key.value:
        os.environ["ARK_API_KEY"] = ark_key.value

    # Check for Custom Agent Endpoint first
    custom_ep = repo.get(db, "badcase_api_endpoint")
    should_use_local = True
    if custom_ep and custom_ep.value:
        should_use_local = False
        print(f"DEBUG: Custom Endpoint configured ({custom_ep.value}), skipping Local Agent.")

    # 2. Dynamic Import
    runner = None
    app_name = None
    
    if should_use_local and os.path.exists(AGENT_FILE_PATH):
        try:
            # Import dependencies locally
            from google.genai.types import Content, Part
            from google.adk.agents import RunConfig
            
            # Load Module
            module_name = "badcase_agent_dynamic"
            spec = importlib.util.spec_from_file_location(module_name, AGENT_FILE_PATH)
            if spec and spec.loader:
                mod = importlib.util.module_from_spec(spec)
                sys.modules[module_name] = mod
                spec.loader.exec_module(mod)
                runner = mod.runner
                app_name = mod.app_name
                print(f"Loaded Agent from {AGENT_FILE_PATH}")
        except Exception as e:
            print(f"Failed to load agent: {e}")
            print("Agent Load Failed. Falling back to legacy/mock logic.")
            runner = None
    
    if runner:
        try:
            print(f"Using Local Agent: {app_name}")
            user_id = "user_0"
            session_id = f"sess_{os.urandom(4).hex()}"
            
            prompt_text = req.prompt
            img_payload = get_image_payload(req.image_url)
            if img_payload:
                url_to_send = img_payload["image_url"]["url"]
                prompt_text = f"Badcase Image URL: {url_to_send}\n\nPrompt: {prompt_text}"
            
            session_service = runner.short_term_memory.session_service
            session = await session_service.get_session(app_name=app_name, user_id=user_id, session_id=session_id)
            if not session:
                await session_service.create_session(app_name=app_name, user_id=user_id, session_id=session_id)
            
            new_message = Content(role="user", parts=[Part(text=prompt_text)])
            
            response = await runner.run(
                user_id=user_id,
                session_id=session_id,
                message=new_message,
                run_config=RunConfig()
            )
            
            full_content = ""
            if response.content and response.content.parts:
                for part in response.content.parts:
                    if part.text:
                        full_content += part.text
            
            print(f"Agent Response: {full_content[:100]}...")
            
            content_str = full_content
            if "```json" in content_str:
                content_str = content_str.split("```json")[1].split("```")[0]
            elif "```" in content_str:
                content_str = content_str.split("```")[1].split("```")[0]
            
            result = json.loads(content_str)
            
            diagnosis = {
                "overall": [result.get("overall_diagnosis", "")],
                "style": [result.get("style_inference", "")]
            }
            if "badcase_tags" in result: diagnosis["tags"] = result["badcase_tags"]

            fixes = result.get("top_fixes", [])
            high_p = []
            optional = []
            if isinstance(fixes, list):
                for f in fixes:
                    if isinstance(f, dict):
                         action = f.get('action', '')
                         prio = f.get('priority', 2)
                         if prio == 1: high_p.append(action)
                         else: optional.append(action)
            
            return OptimizeResponse(
                diagnosis=diagnosis,
                fix_strategy={"high_priority": high_p, "optional": optional},
                optimized_prompt=result.get("master_prompt", req.prompt),
                checklist=result.get("verification_checklist", [])
            )
            
        except Exception as e:
            print(f"Local Agent Execution Error: {e}")
            print("Falling back to Mock data.")
            return OptimizeResponse(
                diagnosis={
                    "overall": ["(Mock) The generated image style deviates from the prompt's anime requirement."],
                    "style": ["Realistic shading detected instead of Cel-shading."],
                    "tags": ["style_inconsistency", "lighting_issue"]
                },
                fix_strategy={
                    "high_priority": ["Add 'anime style' and 'flat color' to prompt.", "Negative prompt: '3d', 'realistic'."],
                    "optional": ["Adjust lighting to 'flat lighting'."]
                },
                optimized_prompt=f"{req.prompt}, anime style, flat color, cel shading, high quality",
                checklist=["Verify flat coloring", "Check character eyes"]
            )

    repo = SystemConfigRepo()
    
    # 1. Check for Custom Agent Endpoint (User Provided)
    custom_ep = repo.get(db, "badcase_api_endpoint")
    custom_key = repo.get(db, "badcase_api_key")
    
    if custom_ep and custom_ep.value:
        url = custom_ep.value
        if "chat/completions" not in url:
             # Append standard Ark path if missing
             url = url.rstrip('/') + "/api/v3/chat/completions"
             
        api_key = custom_key.value if custom_key else ""
        print(f"Using Custom Agent Endpoint: {url}")
        
        agent_id_cfg = repo.get(db, "badcase_agent_id")
        llm_ep = agent_id_cfg.value if agent_id_cfg else "custom-agent"
    else:
        # Fallback to Ark
        api_key_cfg = repo.get(db, "volc_api_key")
        if not api_key_cfg or not api_key_cfg.value:
            # Fallback to env
            api_key = os.getenv("ARK_API_KEY")
            if not api_key:
                # Fallback to Mock if no key
                 print("No API Key found, using Mock.")
                 return OptimizeResponse(
                    diagnosis={
                        "overall": ["(Mock) The generated image style deviates from the prompt's anime requirement."],
                        "style": ["Realistic shading detected instead of Cel-shading."],
                        "tags": ["style_inconsistency", "lighting_issue"]
                    },
                    fix_strategy={
                        "high_priority": ["Add 'anime style' and 'flat color' to prompt.", "Negative prompt: '3d', 'realistic'."],
                        "optional": ["Adjust lighting to 'flat lighting'."]
                    },
                    optimized_prompt=f"{req.prompt}, anime style, flat color, cel shading, high quality",
                    checklist=["Verify flat coloring", "Check character eyes"]
                )
        else:
            api_key = api_key_cfg.value
            
        llm_ep_cfg = repo.get(db, "badcase_llm_endpoint")
        llm_ep = llm_ep_cfg.value if llm_ep_cfg else "ep-20250205183353-v7b9x" 
        url = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"

    # Construct messages
    content = [{"type": "text", "text": f"Prompt: {req.prompt}"}]
    
    img_payload = get_image_payload(req.image_url)
    if img_payload:
        content.append(img_payload)
    else:
        raise HTTPException(400, "Invalid image_url")
        
    if req.reference_url:
        ref_payload = get_image_payload(req.reference_url)
        if ref_payload:
            content.append({"type": "text", "text": "Reference Image:"})
            content.append(ref_payload)
            
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": content}
    ]
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": llm_ep,
        "messages": messages,
        "temperature": 0.7,
        "response_format": {"type": "json_object"} # Force JSON if supported, else rely on prompt
    }
    
    timeout = httpx.Timeout(60.0, connect=10.0, read=60.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
            
            # Fallback for Native AgentKit API (if OpenAI format fails with 404/400)
            if resp.status_code != 200 and custom_ep and custom_ep.value:
                print(f"OpenAI format failed ({resp.status_code}), trying Native AgentKit format...")
                
                # Construct Native Payload
                img_p = get_image_payload(req.image_url)
                final_url = ""
                
                if img_p:
                    final_url = img_p["image_url"]["url"]
                    # If Base64 (Local File), Upload to TOS
                    if final_url.startswith("data:") and req.image_url.startswith("/static/"):
                        try:
                            local_path = f"backend/app{req.image_url}"
                            if os.path.exists(local_path):
                                with open(local_path, "rb") as f:
                                    file_content = f.read()
                                storage = StorageService(db)
                                filename = os.path.basename(local_path)
                                # Use task_id=0, type='badcase_temp'
                                final_url = await storage.upload_content(file_content, 0, "badcase_temp", filename)
                                print(f"Uploaded local image to TOS: {final_url}")
                        except Exception as e:
                            print(f"Failed to upload local image to TOS: {e}")
                            # Fallback to Base64 (Agent might fail)
                
                native_payload = {
                    "prompt": req.prompt,
                    "media_url": final_url,
                    "media_type": "image"
                }
                
                # Headers for Native
                native_headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "user_id": "user_default",
                    "session_id": f"sess_{os.urandom(4).hex()}"
                }
                
                base_url = custom_ep.value
                # Try Base URL
                resp = await client.post(base_url, json=native_payload, headers=native_headers)
                
                # If failed, try common paths
                if resp.status_code == 404:
                    for path in ["/invoke", "/run", "/api/run", "/api/v1/run"]:
                        print(f"Retrying with path: {path}")
                        resp = await client.post(base_url.rstrip('/') + path, json=native_payload, headers=native_headers)
                        if resp.status_code != 404:
                            break

            resp.raise_for_status()
            
            # Handle SSE Stream
            if "text/event-stream" in resp.headers.get("content-type", ""):
                full_text = ""
                valid_result_found = False
                for line in resp.text.split('\n'):
                    line = line.strip()
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        if data_str == "[DONE]": break
                        try:
                            chunk = json.loads(data_str)
                            if "content" in chunk and "parts" in chunk["content"]:
                                for part in chunk["content"]["parts"]:
                                    if "text" in part:
                                        text_chunk = part["text"]
                                        full_text += text_chunk
                                        
                                        # Optimistic check: Is this chunk the FULL JSON?
                                        # If the agent returns the complete JSON in one text block
                                        try:
                                            # Try to clean markdown code block if present
                                            clean_chunk = text_chunk
                                            if "```json" in clean_chunk:
                                                clean_chunk = clean_chunk.split("```json")[1].split("```")[0]
                                            elif "```" in clean_chunk:
                                                 clean_chunk = clean_chunk.split("```")[1].split("```")[0]
                                                 
                                            potential_json = json.loads(clean_chunk)
                                            if isinstance(potential_json, dict) and ("overall_diagnosis" in potential_json or "diagnosis" in potential_json):
                                                full_text = clean_chunk # Use this as the final text
                                                valid_result_found = True
                                                break 
                                        except:
                                            pass
                        except:
                            pass
                    if valid_result_found: break
                content_str = full_text
            else:
                data = resp.json()
                
                content_str = ""
                if "choices" in data and len(data["choices"]) > 0:
                    content_str = data["choices"][0]["message"]["content"]
                elif "answer" in data:
                    content_str = data["answer"]
                else:
                    content_str = json.dumps(data)
             
             # Parse JSON
            try:
                result = json.loads(content_str)
                
                # Construct Legacy Diagnosis
                diag_legacy = {}
                if "overall_diagnosis" in result:
                    diag_legacy["overall"] = [result["overall_diagnosis"]]
                if "style_inference" in result:
                    diag_legacy["style"] = [result["style_inference"]]
                if "badcase_tags" in result:
                    diag_legacy["tags"] = result["badcase_tags"]
                    
                # Construct Legacy Fix Strategy
                fix_legacy = {"high_priority": [], "optional": []}
                if "top_fixes" in result:
                    for f in result["top_fixes"]:
                        action = f.get("action", "")
                        prio = f.get("priority", 2)
                        if prio == 1:
                            fix_legacy["high_priority"].append(action)
                        else:
                            fix_legacy["optional"].append(action)
                
                print(f"DEBUG: Final result: {result}")
                return OptimizeResponse(
                    diagnosis=diag_legacy,
                    fix_strategy=fix_legacy,
                    optimized_prompt=result.get("master_prompt", result.get("optimized_prompt", req.prompt)),
                    checklist=result.get("verification_checklist", []),
                    
                    # New Fields
                    overall_diagnosis=result.get("overall_diagnosis"),
                    style_inference=result.get("style_inference"),
                    badcase_tags=result.get("badcase_tags"),
                    severity_scores=result.get("severity_scores"),
                    top_fixes=result.get("top_fixes"),
                    master_prompt=result.get("master_prompt"),
                    diff_prompt=result.get("diff_prompt"),
                    negative_prompt=result.get("negative_prompt"),
                    edit_instructions=result.get("edit_instructions")
                )
            except json.JSONDecodeError:
                # Simple retry or fallback?
                # For now just return error or try to sanitize
                # Maybe remove markdown code blocks
                if "```json" in content_str:
                    content_str = content_str.split("```json")[1].split("```")[0]
                    return json.loads(content_str)
                elif "```" in content_str:
                    content_str = content_str.split("```")[1].split("```")[0]
                    return json.loads(content_str)
                raise ValueError("Invalid JSON format from LLM")
                
        except Exception as e:
            print(f"LLM API Failed, using MOCK fallback: {e}")
            mock = {
                "diagnosis": {
                    "style_mismatch": ["The generated image has a realistic rendering style with soft shading, whereas the prompt implies a Manga/Anime style which requires cel-shading and flatter colors.", "The lighting is too cinematic and volumetric for a typical manga panel."],
                    "semantic_drift": ["The character's expression is neutral, but manga adaptation usually benefits from more exaggerated or specific emotional cues."],
                    "structural_errors": ["No significant structural errors, but the composition is generic."]
                },
                "fix_strategy": {
                    "high_priority": ["Enforce 'anime style' and 'flat color' tags.", "Add negative prompts for 'realistic', '3d', 'photorealistic'.", "Specify 'cel shading'."],
                    "optional": ["Add 'dynamic angle' for better composition.", "Use specific artist style references if available."]
                },
                "optimized_prompt": f"{req.prompt}, anime style, flat color, cel shading, high quality, 2D --neg realistic, 3d, photorealistic, volumetric lighting",
                "checklist": ["Verify flat coloring", "Check character expression intensity", "Confirm cel-shading effect"]
            }
            return mock
