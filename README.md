# 飞星漫剧 (ManjuGen Platform) 🚀

飞星漫剧 (ManjuGen Platform) 是一个一站式 AI 漫剧创作平台，旨在帮助创作者通过人工智能技术快速生成高质量的漫画与漫剧视频。平台集成了剧本创作、分镜设计、角色一致性控制、图像生成以及视频合成等全流程功能。

## ✨ 核心功能

*   **📝 智能剧本创作**：基于大语言模型（Doubao）自动生成剧本大纲、角色设定和分场脚本。
*   **🎨 角色一致性控制**：确保不同分镜中的角色形象保持高度一致。
*   **🎬 自动分镜生成**：根据剧本自动规划分镜画面，生成提示词并调用绘图模型（Seedream）。
*   **🎥 漫剧视频合成**：将生成的静态分镜转化为动态视频，支持运镜效果（Seedance）。
*   **🛠️ 可视化工作台**：提供直观的 Web 界面，支持对剧本、分镜和生成的素材进行实时编辑与调整。
*   **☁️ 混合存储支持**：支持本地存储及火山引擎 TOS 对象存储。

## 🛠️ 技术栈

*   **后端**：Python 3.10+, FastAPI, SQLAlchemy, Uvicorn
*   **前端**：React, TypeScript, Vite (已编译为静态资源)
*   **AI 模型集成**：火山引擎 (Doubao Pro, Seedance, Seedream)
*   **视频处理**：FFmpeg
*   **打包工具**：PyInstaller

## 🚀 快速开始

### 1. 环境准备

确保您的系统已安装以下软件：

*   **Python** (3.10 或更高版本)
*   **FFmpeg** (必须安装并添加到系统 PATH，用于视频合成。项目内置了 `ffmpeg_bin` 目录支持)
*   **Git**

### 2. 克隆项目

```bash
git clone https://github.com/vxionggao/ManjuGen-Platform.git
cd ManjuGen-Platform
```

### 3. 安装依赖

建议使用虚拟环境：

```bash
python -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

pip install -r requirements.txt
```

### 4. 配置环境变量

在项目根目录创建 `.env` 文件，并填入您的火山引擎密钥：

```ini
# 火山引擎鉴权配置
VOLCENGINE_ACCESS_KEY=your_ak
VOLCENGINE_SECRET_KEY=your_sk
ARK_API_KEY=your_ark_api_key

# (可选) TOS 对象存储配置，如果不配置将默认使用本地存储
# STORAGE_TYPE=tos
# STORAGE_BUCKET=your_bucket_name
# STORAGE_REGION=cn-beijing
# STORAGE_ENDPOINT=tos-cn-beijing.volces.com
```

### 5. 启动服务

```bash
python run.py
```

服务启动后，请访问浏览器打开：[http://localhost:8888](http://localhost:8888)

## 📂 项目结构

```text
.
├── backend/            # 后端核心代码 (FastAPI)
│   ├── app/
│   │   ├── api/        # API 路由定义
│   │   ├── models/     # 数据库模型
│   │   ├── services/   # 业务逻辑服务
│   │   └── ...
├── frontend/           # 前端源代码 (React)
├── agent_skills/       # AgentKit 技能插件
├── static/             # 静态资源文件
├── app.db              # SQLite 数据库 (自动生成)
├── run.py              # 项目启动入口
├── requirements.txt    # Python 依赖列表
└── .env                # 环境变量配置 (需手动创建)
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
