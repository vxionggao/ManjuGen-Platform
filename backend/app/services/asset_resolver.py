import re
from typing import List, Dict, Any, Tuple
from ..services.asset_service import AssetService
from sqlalchemy.orm import Session

class AssetResolver:
    def __init__(self, db: Session):
        self.db = db
        self.asset_service = AssetService(db)
    
    def parse_prompt(self, prompt: str) -> List[Tuple[str, str, str]]:
        """解析prompt中的素材引用
        格式：@role:{asset_id}、@scene:{asset_id}、@style:{asset_id}
        或者 @role:asset_id、@scene:asset_id、@style:asset_id
        """
        # 匹配 @type:{id}
        pattern_braces = r"@(role|scene|style):\{([^}]+)\}"
        matches_braces = re.findall(pattern_braces, prompt)
        results = [(match[0], match[1], f"@{match[0]}:{{{match[1]}}}") for match in matches_braces]
        
        # 匹配 @type:id (无花括号，但在非单词字符前)
        # 注意：避免匹配到 @role:{id} 中的 id 部分，所以我们可以分两步，或者使用更复杂的正则
        # 简单起见，我们假设前端统一使用一种格式，或者我们先替换掉带花括号的，再匹配剩下的
        
        # 这里为了兼容，我们使用一个能够同时匹配两者的正则，或者分别匹配
        # 匹配 @type:id，其中id由字母数字下划线横线组成
        pattern_plain = r"@(role|scene|style):([a-zA-Z0-9_-]+)"
        
        # 为了避免重复，我们先处理带花括号的，将其临时替换，然后处理不带花括号的
        # 但实际上，parse_prompt 只是提取，resolve_prompt 才是替换。
        # 如果 prompt 同时包含两种格式，findall 会分别找到。
        # @role:{123} 会被 pattern_plain 匹配为 @role:{ (如果不限制字符)
        # pattern_plain 限定了 [a-zA-Z0-9_-]+，所以 {123} 中的 { 不会被匹配，除非 id 包含 {
        
        matches_plain = re.findall(pattern_plain, prompt)
        # 过滤掉已经是带花括号格式的一部分的匹配（这比较难，不如直接在 resolve 里处理）
        
        # 更好的策略：只支持一种，或者正则更精确
        # 假设前端使用 @type:id
        for match in matches_plain:
             # 排除掉前面已经匹配到的带花括号的
             # 简单的做法：如果 match[1] 被包含在任何 matches_braces 的 id 中... 不太对
             
             # 让我们假设 id 不包含 { 或 }
             token = f"@{match[0]}:{match[1]}"
             # 检查这个 token 是否是 @type:{id} 的一部分
             # 例如 @role:123 是 @role:{123} 的一部分吗？不是，因为 {123}
             
             # 直接添加
             results.append((match[0], match[1], token))
             
        # 去重
        return list(set(results))
    
    def resolve_prompt(self, prompt: str) -> Dict[str, Any]:
        """解析并解析prompt中的素材引用"""
        # 解析素材引用
        asset_references = self.parse_prompt(prompt)
        
        # 解析出的素材
        resolved_assets = []
        
        # 替换prompt中的素材引用为友好显示
        display_prompt = prompt
        resolved_prompt = prompt
        
        for asset_type, asset_id, reference in asset_references:
            # 获取素材信息
            asset = self.asset_service.get_asset(asset_id)
            if not asset:
                # 尝试通过名称获取
                asset = self.asset_service.get_asset_by_name(asset_id)
                
            if asset:
                # 生成注入块
                injection_block = self.generate_injection_block(asset)
                
                # 替换prompt中的引用为注入块
                resolved_prompt = resolved_prompt.replace(reference, injection_block)
                
                # 替换为友好显示
                display_prompt = display_prompt.replace(reference, f"@{asset['name']}")
                
                # 添加到解析结果
                resolved_assets.append(asset)
        
        return {
            "original_prompt": prompt,
            "display_prompt": display_prompt,
            "resolved_prompt": resolved_prompt,
            "assets": resolved_assets
        }
    
    def generate_injection_block(self, asset: Dict[str, Any]) -> str:
        """生成素材的稳定注入块"""
        asset_type = asset["type"]
        
        if asset_type == "role":
            return self._generate_role_injection(asset)
        elif asset_type == "scene":
            return self._generate_scene_injection(asset)
        elif asset_type == "style":
            return self._generate_style_injection(asset)
        else:
            return ""
    
    def _generate_role_injection(self, asset: Dict[str, Any]) -> str:
        """生成角色素材的注入块"""
        injection = f"[ROLE_REF]\n"
        injection += f"Name: {asset['name']}\n"
        
        # 生成Identity
        identity_parts = []
        metadata = asset.get("metadata", {})
        
        if metadata.get("gender"):
            identity_parts.append(metadata["gender"])
        if metadata.get("age_range"):
            identity_parts.append(metadata["age_range"])
        if asset.get("description"):
            identity_parts.append(asset["description"])
        
        if identity_parts:
            injection += f"Identity: {', '.join(identity_parts)}\n"
        
        # 生成Key Features
        key_features = []
        if metadata.get("hair"):
            key_features.append(f"{metadata['hair']}")
        if metadata.get("eye_color"):
            key_features.append(f"{metadata['eye_color']} eyes")
        if metadata.get("clothing"):
            key_features.append(f"{metadata['clothing']}")
        
        if key_features:
            injection += f"Key Features: {', '.join(key_features)}\n"
        
        # 生成Consistency Rules
        injection += "Consistency Rules:\n"
        injection += "- 保持发型与气质一致\n"
        injection += "- 面部风格统一\n"
        
        # 添加参考图片
        if asset.get("cover_image"):
            injection += "Reference Images:\n"
            injection += f"- {asset['cover_image']}\n"
        
        injection += "[/ROLE_REF]"
        return injection
    
    def _generate_scene_injection(self, asset: Dict[str, Any]) -> str:
        """生成场景素材的注入块"""
        injection = f"[SCENE_REF]\n"
        injection += f"Name: {asset['name']}\n"
        
        # 生成Description
        if asset.get("description"):
            injection += f"Description: {asset['description']}\n"
        
        # 生成Key Elements
        key_elements = []
        metadata = asset.get("metadata", {})
        
        if metadata.get("environment"):
            key_elements.append(metadata["environment"])
        if metadata.get("lighting"):
            key_elements.append(f"{metadata['lighting']} lighting")
        if metadata.get("atmosphere"):
            key_elements.append(metadata["atmosphere"])
        
        if key_elements:
            injection += f"Key Elements: {', '.join(key_elements)}\n"
        
        # 添加参考图片
        if asset.get("cover_image"):
            injection += "Reference Images:\n"
            injection += f"- {asset['cover_image']}\n"
        
        injection += "[/SCENE_REF]"
        return injection
    
    def _generate_style_injection(self, asset: Dict[str, Any]) -> str:
        """生成风格素材的注入块"""
        injection = f"[STYLE_REF]\n"
        injection += f"Name: {asset['name']}\n"
        
        # 生成Description
        if asset.get("description"):
            injection += f"Description: {asset['description']}\n"
        
        # 生成Key Characteristics
        key_characteristics = []
        metadata = asset.get("metadata", {})
        
        if metadata.get("art_style"):
            key_characteristics.append(metadata["art_style"])
        if metadata.get("color_palette"):
            key_characteristics.append(f"{metadata['color_palette']} color palette")
        if metadata.get("brushwork"):
            key_characteristics.append(metadata["brushwork"])
        
        if key_characteristics:
            injection += f"Key Characteristics: {', '.join(key_characteristics)}\n"
        
        # 添加参考图片
        if asset.get("cover_image"):
            injection += "Reference Images:\n"
            injection += f"- {asset['cover_image']}\n"
        
        injection += "[/STYLE_REF]"
        return injection
