import httpx
from typing import Optional, List
from ..settings import ARK_API_KEY

class VolcImageClient:
    def __init__(self):
        self.url = "https://ark.cn-beijing.volces.com/api/v3/images/generations"
    async def create_image_task(self, model: str, prompt: str, images: Optional[List[str]], size: Optional[str], api_key: str = None) -> List[str]:
        payload = {"model": model, "prompt": prompt}
        if images:
            payload["image"] = images
        if size:
            payload["size"] = size
        
        key = api_key or ARK_API_KEY
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        
        log_payload = payload.copy()
        if "image" in log_payload:
            log_payload["image"] = [f"<base64_data_len_{len(img)}>" if len(img) > 100 else img for img in log_payload["image"]]
        print(f"VolcImageClient Request: {log_payload}")
        
        async with httpx.AsyncClient() as client:
            r = await client.post(self.url, json=payload, headers=headers, timeout=60)
            print(f"VolcImageClient Response: {r.status_code} {r.text}")
            if r.is_error:
                print(f"VolcImageClient Error: {r.status_code} {r.text}")
            r.raise_for_status()
            data = r.json()
            urls = []
            if isinstance(data, dict) and "data" in data:
                for item in data["data"]:
                    u = item.get("url") or item.get("image_url")
                    if u:
                        urls.append(u)
            return urls
