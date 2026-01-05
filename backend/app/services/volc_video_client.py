import httpx
from ..settings import ARK_API_KEY

BASE = "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks"

class VolcVideoClient:
    async def create_video_task(self, payload: dict, api_key: str = None) -> str:
        """
        创建视频生成任务
        
        Args:
            payload: 完整的请求参数字典（JSON Template），包含 model, content 以及其他参数
            api_key: API密钥
            
        Returns:
            任务ID
        """
        # 复制一份 payload 以免修改原字典
        req_payload = payload.copy()

        # 处理resolution格式（确保使用*分隔）
        if "resolution" in req_payload:
            req_payload["resolution"] = req_payload["resolution"].replace("x", "*")
        
        key = api_key or ARK_API_KEY
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

        async with httpx.AsyncClient() as client:
            r = await client.post(BASE, json=req_payload, headers=headers, timeout=60)
            if r.is_error:
                print(f"VolcVideoClient Error: {r.status_code} {r.text}")
            r.raise_for_status()
            data = r.json()
            return str(data.get("id") or data.get("task_id") or "")
    
    async def get_task_status(self, task_id: str, api_key: str = None) -> dict:
        """获取任务状态"""
        key = api_key or ARK_API_KEY
        headers = {"Authorization": f"Bearer {key}"}
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/{task_id}", headers=headers, timeout=30)
            r.raise_for_status()
            return r.json()
    
    async def delete_task(self, task_id: str, api_key: str = None) -> None:
        """删除任务"""
        key = api_key or ARK_API_KEY
        headers = {"Authorization": f"Bearer {key}"}
        async with httpx.AsyncClient() as client:
            await client.delete(f"{BASE}/{task_id}", headers=headers, timeout=30)