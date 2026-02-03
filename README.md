# 飞星漫剧 (ManjuGen Platform) 🚀

**飞星漫剧** 是一个一站式 AI 漫剧创作平台，旨在帮助创作者通过人工智能技术快速生成高质量的漫画与漫剧视频。平台集成了剧本创作、分镜设计、角色一致性控制、图像生成以及视频合成等全流程功能。

![Platform Screenshot](frontend/public/placeholder.png)

## ✨ 核心功能

*   **📝 智能剧本创作**：基于大语言模型（LLM）自动生成剧本大纲、角色设定和分场脚本。
*   **🎨 角色一致性控制**：通过 AI 代理（Agent）确保不同分镜中的角色形象保持高度一致。
*   **🎬 自动分镜生成**：根据剧本自动规划分镜画面，生成提示词并调用绘图模型。
*   **🎥 漫剧视频合成**：将生成的静态分镜转化为动态视频，支持运镜效果（推拉摇移）和语音朗读。
*   **🛠️ 可视化工作台**：提供直观的 Web 界面，支持对剧本、分镜和生成的素材进行实时编辑与调整。

## 🛠️ 技术栈

*   **后端**：Python, FastAPI, SQLAlchemy, AgentKit
*   **前端**：React, TypeScript, Vite, TailwindCSS
*   **AI 模型集成**：火山引擎 (Doubao, Seedance, Seedream)
*   **视频处理**：FFmpeg

## 🚀 快速开始

### 1. 环境准备

确保您的系统已安装以下软件：
*   **Python** (3.10 或更高版本)
*   **Node.js** (用于前端构建，可选)
*   **FFmpeg** (必须安装并添加到系统 PATH，用于视频合成)
*   **Git**

### 2. 克隆项目

```bash
git clone https://github.com/vxionggao/ManjuGen-Platform.git
cd ManjuGen-Platform
```

### 3. 安装依赖

```bash
# 安装 Python 依赖
pip install -r requirements.txt
```

### 4. 配置环境变量

在项目根目录运行前，请确保设置了以下环境变量（用于调用 AI 能力）：

```bash
export VOLC_ACCESSKEY="您的火山引擎AK"
export VOLC_SECRETKEY="您的火山引擎SK"
export ARK_API_KEY="您的Ark API Key"
```

或者在数据库 `app.db` 的 `system_configs` 表中配置。

### 5. 启动服务

```bash
python run.py
```

服务启动后，访问浏览器打开：`http://localhost:8888`

## 📂 项目结构

```
.
├── backend/            # 后端核心代码 (FastAPI)
├── frontend/           # 前端源代码 (React)
├── agent_skills/       # AgentKit 技能插件
├── static/             # 静态资源文件
├── app.db              # SQLite 数据库 (存储项目与任务数据)
├── run.py              # 项目启动入口
└── requirements.txt    # Python 依赖列表
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT License](LICENSE)
