from typing import List, Dict, Any, Optional
import asyncio
import json

class StoryAgent:
    """
    StoryAgent: 专注于剧本创作与分镜设计的智能体
    Capabilities:
    1. Analyze user prompt (Theme/Genre)
    2. Generate Script Structure
    3. Extract Characters
    4. Design Storyboard Prompts
    """
    
    def __init__(self, model_name: str = "gpt-4o"):
        self.model_name = model_name
        self.system_prompt = "You are a professional movie director and screenwriter."

    async def run(self, user_prompt: str) -> Dict[str, Any]:
        """
        Execute the full story generation pipeline.
        """
        # 1. Simulate "Thinking" / Planning
        await asyncio.sleep(1.5)
        
        # 2. Generate Content (Mocking LLM output for now)
        # In a real scenario, this would call OpenAI/Doubao API
        result = self._mock_llm_generation(user_prompt)
        
        return result

    async def analyze_video_motion(self, scenes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Analyze scenes and suggest video motion parameters.
        """
        await asyncio.sleep(1)
        
        results = []
        for scene in scenes:
            desc = scene.get("desc", "").lower()
            prompt = scene.get("prompt", "").lower()
            
            # Simple keyword-based logic (simulating Agent reasoning)
            motion_strength = 5
            camera_movement = "static"
            
            if "run" in desc or "chase" in desc or "fight" in desc or "fly" in desc:
                motion_strength = 8
                camera_movement = "pan_right" if "run" in desc else "zoom_in"
            elif "talk" in desc or "stand" in desc:
                motion_strength = 3
                camera_movement = "static"
            elif "landscape" in desc or "view" in desc:
                motion_strength = 4
                camera_movement = "pan_left"
                
            results.append({
                "scene_id": scene.get("id"),
                "motion_strength": motion_strength,
                "camera_movement": camera_movement,
                "duration": 5
            })
            
        return results

    def _mock_llm_generation(self, prompt_text: str) -> Dict[str, Any]:
        prompt_text = prompt_text.lower()
        
        title = "未命名故事"
        script = ""
        characters = []
        scenes = []
        
        if "赛博" in prompt_text or "cyber" in prompt_text or "未来" in prompt_text:
            title = "霓虹之城：觉醒"
            script = """在未来的2077年，霓虹灯闪烁的“夜之城”下，主角艾拉（Ayla）是一名拥有机械义肢的地下快递员。
            
            [场景一：夜雨中的街道]
            艾拉骑着重型机车穿梭在拥挤的高架桥下，雨水打在她的全息风镜上。城市的霓虹灯光在积水的路面上反射出迷离的色彩。
            
            [场景二：暗巷交易]
            她来到约定的地点，一个废弃的义体诊所。反派首领已经在那里等候，他的机械义眼在黑暗中闪烁着红光。
            
            [场景三：突围]
            交易是个陷阱。无数无人机从空中袭来，艾拉启动了她的战斗模式，手中的能量刃划破黑暗。"""
            
            characters = [
                {"name": "艾拉 (Ayla)", "desc": "机械义肢少女，冷酷但内心正义"},
                {"name": "反派首领", "desc": "公司高管，穿着考究的西装，眼神阴鸷"}
            ]
            scenes = [
                {"id": 1, "desc": "艾拉骑车穿梭", "prompt": "cyberpunk city street, raining night, female cyborg riding motorcycle, neon lights, cinematic lighting, 8k, masterpiece"},
                {"id": 2, "desc": "暗巷交易", "prompt": "dark alley, abandoned clinic entrance, mysterious man in suit standing in shadows, red glowing mechanical eye, suspense atmosphere"},
                {"id": 3, "desc": "无人机袭击", "prompt": "swarm of drones attacking, female cyborg fighting with energy blade, dynamic action pose, explosion sparks, high contrast"}
            ]
        elif "古风" in prompt_text or "武侠" in prompt_text or "仙侠" in prompt_text:
            title = "剑影江湖"
            script = """江湖传闻，得天书者得天下。少年剑客李逍遥，无意中卷入了一场惊天阴谋。
            
            [场景一：竹林听风]
            李逍遥在竹林中练剑，剑气激荡，竹叶纷飞。一位神秘女子在远处抚琴。
            
            [场景二：客栈风云]
            悦来客栈内，各路豪杰齐聚。李逍遥察觉到酒中有毒，拔剑而起。"""
            
            characters = [
                {"name": "李逍遥", "desc": "少年剑客，眉清目秀，身手不凡"},
                {"name": "神秘女子", "desc": "抚琴女子，白衣胜雪，身份成谜"}
            ]
            scenes = [
                {"id": 1, "desc": "竹林练剑", "prompt": "bamboo forest, young chinese swordsman practicing sword, flying leaves, dynamic pose, wuxia style, ink painting aesthetic"},
                {"id": 2, "desc": "客栈对峙", "prompt": "ancient chinese inn interior, crowded with martial artists, tense atmosphere, swordsman drawing sword, dramatic lighting"}
            ]
        else:
            title = "奇幻森林冒险"
            script = """在一个古老的魔法森林中，年轻的精灵莉莉发现了一颗发光的种子。
            
            [场景一：发现种子]
            莉莉在巨大的发光蘑菇下避雨，突然看到草丛中微弱的光芒。那是一颗跳动着的金色种子。
            
            [场景二：守护者的考验]
            森林守护者现身，巨大的树人缓缓睁开眼睛，告诉她这颗种子关乎森林的存亡。"""
            
            characters = [
                {"name": "莉莉 (Lily)", "desc": "森林精灵，拥有治愈魔法，银发绿眼"},
                {"name": "森林守护者", "desc": "古老的树人，充满智慧，身上覆盖着苔藓"}
            ]
            scenes = [
                {"id": 1, "desc": "发现种子", "prompt": "magical forest, giant glowing mushrooms, young elf girl looking at golden glowing seed, fantasy art style, soft lighting, ethereal"},
                {"id": 2, "desc": "守护者现身", "prompt": "ancient ent treeman, mossy texture, speaking to elf girl, mystical atmosphere, forest background, sun rays"}
            ]
            
        return {
            "title": title,
            "script": script,
            "characters": characters,
            "scenes": scenes
        }
