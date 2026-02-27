from sqlalchemy.orm import Session
from ..repositories.asset_repo import AssetRepo
from ..services.asset_service import AssetService
from ..services.viking_db_service import VikingDBService

class AssetInitializer:
    def __init__(self, db: Session):
        self.db = db
        self.asset_repo = AssetRepo()
        self.asset_service = AssetService(db)
        self.viking_db = VikingDBService()
    
    def initialize_built_in_assets(self):
        """初始化内置素材"""
        # 检查是否已经初始化
        built_in_assets = self.asset_repo.list(self.db, 0, None)
        if any(asset.source == "built_in" for asset in built_in_assets):
            print("Built-in assets already initialized, skipping...")
            return
        
        print("Initializing built-in assets...")
        
        # 内置角色素材
        role_assets = [
            {
                "name": "小雨",
                "type": "role",
                "aliases": ["xiaoyu", "少女"],
                "description": "年轻动漫女性角色，黑长直，学生气质",
                "tags": ["anime", "female", "student"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "gender": "female",
                    "age_range": "teen",
                    "hair": "black long"
                },
                "source": "built_in"
            },
            {
                "name": "小明",
                "type": "role",
                "aliases": ["xiaoming", "少年"],
                "description": "年轻动漫男性角色，短发，运动风格",
                "tags": ["anime", "male", "sporty"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "gender": "male",
                    "age_range": "teen",
                    "hair": "short"
                },
                "source": "built_in"
            },
            {
                "name": "李老师",
                "type": "role",
                "aliases": ["teacher", "instructor"],
                "description": "中年教师角色，戴着眼镜，温文尔雅",
                "tags": ["adult", "teacher", "professional"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "gender": "female",
                    "age_range": "adult",
                    "occupation": "teacher"
                },
                "source": "built_in"
            },
            {
                "name": "王医生",
                "type": "role",
                "aliases": ["doctor", "physician"],
                "description": "年轻医生角色，穿着白大褂，专业可靠",
                "tags": ["adult", "doctor", "professional"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "gender": "male",
                    "age_range": "adult",
                    "occupation": "doctor"
                },
                "source": "built_in"
            },
            {
                "name": "小美",
                "type": "role",
                "aliases": ["xiaomei", "young woman"],
                "description": "年轻女性角色，长发，时尚风格",
                "tags": ["female", "young adult", "fashion"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "gender": "female",
                    "age_range": "young adult",
                    "style": "fashion"
                },
                "source": "built_in"
            },
            {
                "name": "大壮",
                "type": "role",
                "aliases": ["strong man", "bodybuilder"],
                "description": "强壮男性角色，肌肉发达，运动健将",
                "tags": ["male", "adult", "muscular"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "gender": "male",
                    "age_range": "adult",
                    "build": "muscular"
                },
                "source": "built_in"
            },
            {
                "name": "小红",
                "type": "role",
                "aliases": ["xiaohong", "little girl"],
                "description": "可爱的小女孩角色，扎着马尾辫，活泼开朗",
                "tags": ["female", "child", "cute"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "gender": "female",
                    "age_range": "child",
                    "personality": "lively"
                },
                "source": "built_in"
            },
            {
                "name": "小华",
                "type": "role",
                "aliases": ["xiaohua", "little boy"],
                "description": "活泼的小男孩角色，短发，喜欢运动",
                "tags": ["male", "child", "active"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "gender": "male",
                    "age_range": "child",
                    "hobby": "sports"
                },
                "source": "built_in"
            },
            {
                "name": "奶奶",
                "type": "role",
                "aliases": ["grandma", "elderly woman"],
                "description": "慈祥的老奶奶角色，白发，和蔼可亲",
                "tags": ["female", "elderly", "kind"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "gender": "female",
                    "age_range": "elderly",
                    "personality": "kind"
                },
                "source": "built_in"
            },
            {
                "name": "爷爷",
                "type": "role",
                "aliases": ["grandpa", "elderly man"],
                "description": "慈祥的老爷爷角色，白发，精神矍铄",
                "tags": ["male", "elderly", "wise"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "gender": "male",
                    "age_range": "elderly",
                    "personality": "wise"
                },
                "source": "built_in"
            }
        ]
        
        # 内置场景素材
        scene_assets = [
            {
                "name": "教室",
                "type": "scene",
                "aliases": ["classroom", "school room"],
                "description": "明亮的教室场景，有桌椅和黑板",
                "tags": ["indoor", "school", "classroom"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "environment": "indoor",
                    "lighting": "bright",
                    "atmosphere": "study"
                },
                "source": "built_in"
            },
            {
                "name": "公园",
                "type": "scene",
                "aliases": ["park", "garden"],
                "description": "美丽的公园场景，有花草树木和长椅",
                "tags": ["outdoor", "nature", "park"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "environment": "outdoor",
                    "lighting": "natural",
                    "atmosphere": "peaceful"
                },
                "source": "built_in"
            },
            {
                "name": "咖啡馆",
                "type": "scene",
                "aliases": ["cafe", "coffee shop"],
                "description": "温馨的咖啡馆场景，有咖啡和甜点",
                "tags": ["indoor", "cafe", "cozy"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "environment": "indoor",
                    "lighting": "warm",
                    "atmosphere": "cozy"
                },
                "source": "built_in"
            },
            {
                "name": "办公室",
                "type": "scene",
                "aliases": ["office", "workplace"],
                "description": "现代办公室场景，有电脑和文件",
                "tags": ["indoor", "office", "professional"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "environment": "indoor",
                    "lighting": "bright",
                    "atmosphere": "professional"
                },
                "source": "built_in"
            },
            {
                "name": "卧室",
                "type": "scene",
                "aliases": ["bedroom", "room"],
                "description": "舒适的卧室场景，有床和衣柜",
                "tags": ["indoor", "home", "bedroom"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "environment": "indoor",
                    "lighting": "soft",
                    "atmosphere": "comfortable"
                },
                "source": "built_in"
            },
            {
                "name": "餐厅",
                "type": "scene",
                "aliases": ["restaurant", "dining room"],
                "description": "优雅的餐厅场景，有餐桌和餐具",
                "tags": ["indoor", "restaurant", "elegant"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "environment": "indoor",
                    "lighting": "warm",
                    "atmosphere": "elegant"
                },
                "source": "built_in"
            },
            {
                "name": "海滩",
                "type": "scene",
                "aliases": ["beach", "seaside"],
                "description": "美丽的海滩场景，有沙滩和海浪",
                "tags": ["outdoor", "beach", "seaside"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "environment": "outdoor",
                    "lighting": "sunny",
                    "atmosphere": "relaxing"
                },
                "source": "built_in"
            },
            {
                "name": "森林",
                "type": "scene",
                "aliases": ["forest", "wood"],
                "description": "茂密的森林场景，有树木和野生动物",
                "tags": ["outdoor", "nature", "forest"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "environment": "outdoor",
                    "lighting": "dappled",
                    "atmosphere": "mysterious"
                },
                "source": "built_in"
            },
            {
                "name": "城市夜景",
                "type": "scene",
                "aliases": ["city night", "urban夜景"],
                "description": "繁华的城市夜景，有高楼和霓虹灯",
                "tags": ["outdoor", "city", "night"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "environment": "outdoor",
                    "lighting": "neon",
                    "atmosphere": "vibrant"
                },
                "source": "built_in"
            },
            {
                "name": "图书馆",
                "type": "scene",
                "aliases": ["library", "bookstore"],
                "description": "安静的图书馆场景，有书架和书籍",
                "tags": ["indoor", "library", "quiet"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "environment": "indoor",
                    "lighting": "soft",
                    "atmosphere": "quiet"
                },
                "source": "built_in"
            }
        ]
        
        # 内置风格素材
        style_assets = [
            {
                "name": "赛璐璐风格",
                "type": "style",
                "aliases": ["cel shaded", "anime style"],
                "description": "经典的赛璐璐动画风格，色彩鲜明，线条清晰",
                "tags": ["anime", "cel shaded", "colorful"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "art_style": "cel shaded",
                    "color_palette": "vibrant",
                    "brushwork": "clean lines"
                },
                "source": "built_in"
            },
            {
                "name": "油画风格",
                "type": "style",
                "aliases": ["oil painting", "classical"],
                "description": "古典油画风格，色彩丰富，质感强烈",
                "tags": ["classical", "oil painting", "textured"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "art_style": "oil painting",
                    "color_palette": "rich",
                    "brushwork": "textured"
                },
                "source": "built_in"
            },
            {
                "name": "水彩风格",
                "type": "style",
                "aliases": ["watercolor", "soft"],
                "description": "柔和的水彩画风格，色彩透明，晕染自然",
                "tags": ["watercolor", "soft", "transparent"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "art_style": "watercolor",
                    "color_palette": "soft",
                    "brushwork": "blended"
                },
                "source": "built_in"
            },
            {
                "name": "像素风格",
                "type": "style",
                "aliases": ["pixel art", "retro"],
                "description": "复古的像素艺术风格，由像素点组成",
                "tags": ["pixel art", "retro", "digital"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "art_style": "pixel art",
                    "color_palette": "limited",
                    "brushwork": "pixelated"
                },
                "source": "built_in"
            },
            {
                "name": "漫画风格",
                "type": "style",
                "aliases": ["manga", "comic"],
                "description": "日本漫画风格，线条流畅，表情夸张",
                "tags": ["manga", "comic", "expressive"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "art_style": "manga",
                    "color_palette": "vibrant",
                    "brushwork": "dynamic lines"
                },
                "source": "built_in"
            },
            {
                "name": "写实风格",
                "type": "style",
                "aliases": ["realistic", "lifelike"],
                "description": "逼真的写实风格，细节丰富，光影自然",
                "tags": ["realistic", "detailed", "lifelike"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "art_style": "realistic",
                    "color_palette": "natural",
                    "brushwork": "detailed"
                },
                "source": "built_in"
            },
            {
                "name": "卡通风格",
                "type": "style",
                "aliases": ["cartoon", "animated"],
                "description": "夸张的卡通风格，造型简洁，色彩鲜艳",
                "tags": ["cartoon", "animated", "exaggerated"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "art_style": "cartoon",
                    "color_palette": "bright",
                    "brushwork": "simplified"
                },
                "source": "built_in"
            },
            {
                "name": "水墨风格",
                "type": "style",
                "aliases": ["ink painting", "oriental"],
                "description": "传统的水墨画风格，黑白为主，意境深远",
                "tags": ["ink painting", "oriental", "minimalist"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "art_style": "ink painting",
                    "color_palette": "monochrome",
                    "brushwork": "fluid"
                },
                "source": "built_in"
            },
            {
                "name": "蒸汽朋克风格",
                "type": "style",
                "aliases": ["steampunk", "victorian"],
                "description": "复古的蒸汽朋克风格，机械元素，工业感强",
                "tags": ["steampunk", "victorian", "mechanical"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "art_style": "steampunk",
                    "color_palette": "brass and copper",
                    "brushwork": "detailed mechanical"
                },
                "source": "built_in"
            },
            {
                "name": "未来主义风格",
                "type": "style",
                "aliases": ["futuristic", "sci-fi"],
                "description": "前卫的未来主义风格，科技感强，造型独特",
                "tags": ["futuristic", "sci-fi", "technological"],
                "cover_image": "",
                "gallery": [],
                "metadata": {
                    "art_style": "futuristic",
                    "color_palette": "neon and metallic",
                    "brushwork": "sleek and modern"
                },
                "source": "built_in"
            }
        ]
        
        # 导入所有内置素材
        all_assets = role_assets + scene_assets + style_assets
        
        for asset_data in all_assets:
            try:
                # 创建素材
                asset = self.asset_service.create_asset(
                    user_id=0,  # 0表示系统用户
                    asset_data=asset_data
                )
                print(f"Created built-in asset: {asset['name']} ({asset['type']})")
            except Exception as e:
                print(f"Error creating built-in asset {asset_data['name']}: {e}")
        
        print(f"Successfully initialized {len(all_assets)} built-in assets")
