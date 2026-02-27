# 素材库（Material Library）功能文档

## 1. 功能介绍

素材库是一个统一管理并复用角色、场景、风格三类多模态素材的模块，用于AI漫画创作平台。用户可以在提示词中通过@素材名直接引用素材，系统会在生成前自动解析所有@素材，从VikingDB中精确取回对应素材，并将其结构化注入到生成请求中。

### 1.1 核心功能

- **素材管理**：支持内置素材和用户上传素材的管理
- **素材搜索**：基于关键词和类型的素材搜索
- **@-Mention功能**：在提示词中通过@素材名引用素材
- **素材解析**：自动解析提示词中的@素材引用，生成结构化注入块
- **向量搜索**：集成VikingDB向量数据库，支持语义搜索

## 2. 技术架构

### 2.1 后端架构

- **FastAPI**：构建RESTful API
- **SQLAlchemy**：ORM框架，用于数据库操作
- **Pydantic**：数据验证和模式定义
- **VikingDB**：向量数据库，用于素材的向量索引和搜索

### 2.2 前端架构

- **React**：前端框架
- **TypeScript**：类型系统
- **Vite**：构建工具

### 2.3 数据流向

1. 用户在前端素材库面板浏览或搜索素材
2. 用户在提示词输入框中通过@符号引用素材
3. 前端将@素材引用转换为@role:{asset_id}格式
4. 前端发送提示词到后端的/prompt/resolve接口
5. 后端Asset Resolver解析提示词中的素材引用
6. 后端从数据库和VikingDB中获取素材详情
7. 后端生成结构化注入块，返回给前端
8. 前端将解析后的提示词发送到生成接口

## 3. 核心模块说明

### 3.1 Asset数据模型

定义在`backend/app/models/asset.py`中，核心字段包括：

- `asset_id`：素材唯一标识符（UUID）
- `type`：素材类型（role、scene、style）
- `name`：素材名称
- `aliases`：素材别名列表
- `description`：素材描述
- `tags`：素材标签列表
- `cover_image`：素材封面图
- `gallery`：素材图片画廊
- `asset_metadata`：素材元数据
- `source`：素材来源（built_in、user_upload）

### 3.2 Asset服务

定义在`backend/app/services/asset_service.py`中，核心功能包括：

- `create_asset`：创建新素材
- `get_asset`：获取素材详情
- `list_assets`：列出素材
- `update_asset`：更新素材
- `delete_asset`：删除素材
- `search_assets`：搜索素材

### 3.3 VikingDB服务

定义在`backend/app/services/viking_db_service.py`中，核心功能包括：

- `add_asset`：添加素材到向量数据库
- `search_assets`：基于向量的素材搜索
- `delete_asset`：从向量数据库删除素材

### 3.4 Asset Resolver

定义在`backend/app/services/asset_resolver.py`中，核心功能包括：

- `resolve_prompt`：解析提示词中的素材引用
- `generate_injection_block`：生成素材的结构化注入块

### 3.5 素材初始化器

定义在`backend/app/services/asset_initializer.py`中，核心功能包括：

- `initialize_built_in_assets`：初始化内置素材

## 4. API接口文档

### 4.1 素材管理接口

#### POST /api/assets/ingest

- **功能**：创建新素材
- **请求体**：
  ```json
  {
    "name": "小雨",
    "type": "role",
    "aliases": ["xiaoyu", "少女"],
    "description": "年轻动漫女性角色，黑长直，学生气质",
    "tags": ["anime", "female", "student"],
    "cover_image": "oss://...",
    "gallery": ["oss://..."],
    "metadata": {
      "gender": "female",
      "age_range": "teen",
      "hair": "black long"
    },
    "source": "built_in"
  }
  ```
- **响应**：
  ```json
  {
    "id": 1,
    "asset_id": "uuid",
    "name": "小雨",
    "type": "role",
    "aliases": ["xiaoyu", "少女"],
    "description": "年轻动漫女性角色，黑长直，学生气质",
    "tags": ["anime", "female", "student"],
    "cover_image": "oss://...",
    "gallery": ["oss://..."],
    "metadata": {
      "gender": "female",
      "age_range": "teen",
      "hair": "black long"
    },
    "source": "built_in",
    "created_at": 1234567890,
    "updated_at": 1234567890
  }
  ```

#### GET /api/assets/{asset_id}

- **功能**：获取素材详情
- **响应**：与创建素材的响应格式相同

#### GET /api/assets/search

- **功能**：搜索素材
- **查询参数**：
  - `q`：搜索关键词
  - `type`：素材类型（role、scene、style）
  - `topk`：返回结果数量
- **响应**：素材列表

### 4.2 提示词解析接口

#### POST /api/prompt/resolve

- **功能**：解析提示词中的素材引用
- **请求体**：
  ```json
  {
    "prompt": "帮我生成一个动漫女角色 @小雨 @日系教室 @赛璐璐风格"
  }
  ```
- **响应**：
  ```json
  {
    "resolved_prompt": "帮我生成一个动漫女角色 [ROLE_REF]\nName: 小雨\nIdentity: 年轻女性，学生气质\nKey Features: 黑色长直发，清秀五官\nConsistency Rules:\n- 保持发型与气质一致\n- 面部风格统一\nReference Images:\n- oss://...\n\n[SCENE_REF]\nName: 日系教室\nDescription: 明亮的教室场景，有桌椅和黑板\nAtmosphere: 学习氛围\nReference Images:\n- oss://...\n\n[STYLE_REF]\nName: 赛璐璐风格\nDescription: 经典的赛璐璐动画风格，色彩鲜明，线条清晰\nCharacteristics: 色彩鲜明，线条清晰\nReference Images:\n- oss://...",
    "assets": [
      {
        "id": 1,
        "asset_id": "uuid",
        "name": "小雨",
        "type": "role",
        ...
      },
      ...
    ]
  }
  ```

## 5. 前端使用说明

### 5.1 素材库面板

素材库面板位于左侧栏，与生成配置同级，包含三个标签页：

- **Role**：角色素材
- **Scene**：场景素材
- **Style**：风格素材

每个素材以卡片形式展示，包含封面图、名称、标签、简要描述和来源（内置/用户）。

### 5.2 提示词输入框增强

在提示词输入框中输入@符号时，会弹出素材联想下拉框，支持：

- **模糊搜索**：基于输入的关键词搜索素材
- **按类型分组**：素材按角色、场景、风格分组展示
- **素材选择**：选择素材后，显示给用户@小雨，内部真实存储@role:{asset_id}

### 5.3 素材上传

用户可以通过素材库面板上传自己的素材，包括：

- **上传图片**：上传素材的封面图和画廊图片
- **填写元数据**：填写素材的名称、类型、别名、描述、标签等信息
- **提交**：提交后素材会被保存到数据库，并同步到VikingDB

## 6. 常见问题解答

### 6.1 为什么提示词中的@素材引用没有被解析？

- **原因**：可能是素材ID不存在或格式不正确
- **解决方案**：检查素材ID是否正确，或重新在素材库中选择素材

### 6.2 为什么素材搜索结果不准确？

- **原因**：可能是关键词不够准确，或素材的标签和描述不够完善
- **解决方案**：使用更准确的关键词，或为素材添加更详细的标签和描述

### 6.3 为什么素材上传失败？

- **原因**：可能是图片格式不正确，或元数据填写不完整
- **解决方案**：检查图片格式是否为支持的格式（如PNG、JPG等），并确保所有必填字段都已填写

### 6.4 为什么@-Mention功能没有弹出下拉框？

- **原因**：可能是前端代码未正确加载，或浏览器兼容性问题
- **解决方案**：刷新页面，或使用支持的浏览器（如Chrome、Firefox等）

## 7. 开发与部署

### 7.1 开发环境搭建

1. **后端**：
   ```bash
   cd backend
   pip install -r requirements.txt
   python -m uvicorn app.main:app --host 0.0.0.0 --port 6666 --reload
   ```

2. **前端**：
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### 7.2 部署

1. **构建前端**：
   ```bash
   cd frontend
   npm run build
   ```

2. **启动后端**：
   ```bash
   cd backend
   python -m uvicorn app.main:app --host 0.0.0.0 --port 6666
   ```

### 7.3 内置素材初始化

项目首次启动时，会自动导入30个内置素材（10个角色、10个场景、10个风格），并生成embedding写入VikingDB。

## 8. 技术实现细节

### 8.1 素材数据模型

素材数据模型定义在`backend/app/models/asset.py`中，核心字段包括：

- `asset_id`：UUID格式的素材唯一标识符
- `type`：素材类型，支持role、scene、style三种类型
- `name`：素材名称
- `aliases`：素材别名列表，用于搜索
- `description`：素材描述，用于生成注入块
- `tags`：素材标签列表，用于搜索和分类
- `cover_image`：素材封面图，用于前端展示
- `gallery`：素材图片画廊，用于提供参考图片
- `asset_metadata`：素材元数据，存储素材的详细属性
- `source`：素材来源，区分内置素材和用户上传素材

### 8.2 向量搜索实现

向量搜索通过VikingDB实现，核心步骤包括：

1. **生成embedding**：将素材的name、description和tags组合成文本，生成向量embedding
2. **向量存储**：将向量embedding和素材的标量字段存储到VikingDB
3. **向量搜索**：根据用户输入的关键词生成查询向量，在VikingDB中进行相似度搜索
4. **结果排序**：根据相似度分数对搜索结果进行排序，返回topK结果

### 8.3 @-Mention功能实现

@-Mention功能的前端实现包括：

1. **事件监听**：监听提示词输入框的键盘事件，当输入@符号时触发
2. **素材搜索**：根据当前输入的关键词调用后端的/assets/search接口搜索素材
3. **下拉框展示**：将搜索结果按类型分组展示在下拉框中
4. **素材选择**：用户选择素材后，将素材名称显示在输入框中，同时存储素材的ID

### 8.4 素材解析实现

素材解析的核心逻辑在Asset Resolver模块中，步骤包括：

1. **正则匹配**：使用正则表达式从提示词中提取@素材引用
2. **素材获取**：根据素材ID从数据库和VikingDB中获取素材详情
3. **注入块生成**：根据素材类型生成对应的结构化注入块
4. **提示词替换**：将原始提示词中的@素材引用替换为生成的注入块

## 9. 未来规划

### 9.1 功能增强

- **素材版本管理**：支持素材的版本控制，避免历史任务失效
- **素材共享**：支持用户之间分享素材
- **素材推荐**：基于用户历史使用记录推荐素材
- **素材分类**：支持更细粒度的素材分类

### 9.2 性能优化

- **缓存优化**：增加素材解析结果的缓存，提高解析速度
- **向量搜索优化**：优化VikingDB的索引和查询性能
- **前端性能优化**：优化前端素材库的加载和渲染性能

### 9.3 扩展性

- **支持更多素材类型**：扩展支持更多类型的素材，如道具、背景等
- **集成更多向量数据库**：支持集成其他向量数据库，如Milvus、Faiss等
- **开放API**：提供开放API，支持第三方应用集成

## 10. 总结

素材库功能为AI漫画创作平台提供了一个统一管理和复用素材的解决方案，通过@-Mention功能和向量搜索，大大提高了用户的创作效率和体验。同时，模块化的设计和清晰的架构，为后续的功能扩展和性能优化奠定了基础。