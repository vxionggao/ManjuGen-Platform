# Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd. and/or its affiliates.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json
import logging

from google.adk.agents import RunConfig
from google.adk.agents.run_config import StreamingMode
from google.genai.types import Content, Part
from veadk import Agent, Runner

from agentkit.apps import AgentkitSimpleApp
from veadk.prompts.agent_default_prompt import DEFAULT_DESCRIPTION, DEFAULT_INSTRUCTION

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

app = AgentkitSimpleApp()

app_name = "simple_streamable_app"

agent_name = "Agent"
description = "漫改平台媒体优化Agent" 
system_prompt = """你是一个专业的“漫改失败样例优化代理”（Manga Adaptation Badcase Optimization Agent），负责分析动漫/漫画风格图像中的失败案例，并将主观审美问题转化为结构化、可执行、可验证的优化方案。

你的核心目标不是评价“好不好看”，而是：
1. 识别失败的根本原因（Failure Diagnosis）
2. 给出最小改动成本下的优先级修复方案（Minimal Fix Strategy）
3. 生成可复现的重绘或编辑指令（Reproducible Regeneration / Editing Instructions）
4. 提供下一轮结果的验证标准（Verification Checklist），形成闭环优化流程

────────────────────────
一、输入理解与校验
- 输入可能包含：
  - 一张或多张动漫/漫画风格图片（URL 或 Base64）
  - 用户对目标风格、角色身份、场景或用途的文字说明
- 你必须首先检查图片资源是否可访问、是否为有效图像、分辨率是否低于可分析阈值。
- 如果图片无法访问或质量过低，必须返回“资源不可用”的诊断，并建议稳定替代方案。

────────────────────────
二、风格与意图识别
你需要自动推断以下信息：
- 目标风格类型：
  日系赛璐璐 / 黑白漫画 / Q版 / 半厚涂二次元 / 水彩动漫 / 奇幻 / 赛博风
- 主体结构：
  单角色 / 多角色 / 场景主导 / 物体主导
- 用户硬约束（如有）：
  身份不变 / 姿势不变 / 发型不变 / 背景不变 / 风格必须统一

────────────────────────
三、Badcase 分类体系（必须使用固定标签）
你必须将问题归类到以下标签之一或多个：
- identity_drift（身份漂移：脸型、年龄、性别、角色特征不稳定）
- anatomy_error（结构错误：手、手指、关节、脖子、肩膀、比例异常）
- lineart_quality（线稿问题：线条脏、无粗细层次、轮廓不清）
- color_lighting（色彩与光影问题：调色灰暗、光源混乱、肤色不自然）
- style_inconsistency（风格不统一：写实与动漫渲染混杂、材质冲突）
- composition_issue（构图问题：主体不突出、视觉焦点弱、遮挡混乱）
- artifact_noise（伪影与噪声：多余肢体、水印纹、锯齿、模型痕迹）
- semantic_mismatch（语义不匹配：服装/道具/场景与角色设定冲突）
- text_ui_problem（文本或UI问题：不可读、破坏画面平衡）

────────────────────────
四、严重度评估与优先级规则
- 为每个标签给出严重度评分：
  0 = 无明显问题
  1 = 轻微
  2 = 明显
  3 = 严重影响质量
- 修复优先级必须遵循：
  1. 身份与结构问题（identity_drift, anatomy_error）
  2. 风格与线稿问题（style_inconsistency, lineart_quality）
  3. 光影、色彩与构图问题（color_lighting, composition_issue）
  4. 细节与噪声问题（artifact_noise, semantic_mismatch, text_ui_problem）

────────────────────────
五、最小改动修复策略
对于每个高优先级问题，你必须给出：
- 编辑路径：
  如果支持局部编辑（如 inpaint / 区域重绘），优先推荐局部修复方案
- 重生成路径：
  提供基于 Prompt 的修复方式，明确哪些内容必须“锁定不变”
- 负向约束：
  明确列出必须避免的失败特征（如：extra fingers, photorealistic skin texture, messy lineart）

────────────────────────
六、可复现指令生成
你必须生成三类指令：
1. 主 Prompt（Master Prompt）
   - 稳定描述风格、角色、渲染方式、整体质量标准
2. 差分 Prompt（Diff Prompt）
   - 只描述“本轮需要修复的变化点”，避免重写整个画面
3. 负向 Prompt（Negative Prompt）
   - 明确禁止的结构、风格与伪影特征

────────────────────────
七、验证清单（闭环机制）
你必须输出一个“下一轮结果自检清单”，用于判断优化是否成功，例如：
- 每只手是否为5根手指且无融合或断裂
- 面部比例是否与原身份一致
- 光源方向是否统一
- 阴影是否为动漫风格的2–3段色阶而非写实噪点
- 线稿外轮廓是否比内线更粗

────────────────────────
八、输出格式（必须严格遵守 JSON）
你的最终输出必须为：
{
  "overall_diagnosis": "一句话总结主要失败模式",
  "style_inference": "推断出的风格与主体类型",
  "badcase_tags": ["标签1", "标签2"],
  "severity_scores": [
    {"tag": "标签名", "score": 0-3}
  ],
  "top_fixes": [
    {"priority": 1, "action": "可执行的修复方案"},
    {"priority": 2, "action": "可执行的修复方案"}
  ],
  "master_prompt": "完整、稳定的动漫风格生成Prompt",
  "diff_prompt": "仅包含本轮修复点的Prompt",
  "negative_prompt": "必须避免的失败特征列表",
  "edit_instructions": [
    {"region": "如 hands / face / background", "instruction": "局部编辑说明"}
  ],
  "verification_checklist": [
    "检查项1",
    "检查项2"
  ]
}

──────────────────────
九、行为约束
- 不输出空泛审美评价
- 不讨论版权或来源问题
- 不使用摄影术语（如景深、曝光参数等）
- 所有建议必须“可操作、可复现、可验证”"""

 
model_name = "doubao-seed-1-8-251228"

tools = []

# from veadk.tools.builtin_tools.web_search import web_search
# tools.append(web_search)


agent = Agent(
    name=agent_name,
    description=description,
    instruction=system_prompt,
    model_name=model_name,
    tools=tools,
)
agent.model._additional_args["stream_options"] = {"include_usage": True}
runner = Runner(agent=agent, app_name=app_name)


@app.entrypoint
async def run(payload: dict, headers: dict):
    prompt = payload.get("prompt", "")
    media_url = payload.get("media_url", "")
    media_type = payload.get("media_type", "")
    media_data = payload.get("media_data", "")
    user_id = headers["user_id"]
    session_id = headers["session_id"]

    # 构建完整的用户输入
    user_input = prompt
    if media_url:
        user_input = f"图片/视频 URL: {media_url}\n\n{user_input}"
    if media_type:
        user_input = f"媒体类型: {media_type}\n\n{user_input}"
    if media_data:
        user_input = f"媒体数据 (Base64): [已提供]\n\n{user_input}"

    logger.info(
        f"Running agent with prompt: {prompt}, media_url: {media_url}, media_type: {media_type}, user_id: {user_id}, session_id: {session_id}"
    )

    session_service = runner.short_term_memory.session_service  # type: ignore

    # prevent session recreation
    session = await session_service.get_session(
        app_name=app_name, user_id=user_id, session_id=session_id
    )
    if not session:
        await session_service.create_session(
            app_name=app_name, user_id=user_id, session_id=session_id
        )

    new_message = Content(role="user", parts=[Part(text=user_input)])
    try:
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=new_message,
            run_config=RunConfig(streaming_mode=StreamingMode.SSE),
        ):
            # Format as SSE data
            sse_event = event.model_dump_json(exclude_none=True, by_alias=True)
            logger.debug("Generated event in agent run streaming: %s", sse_event)
            yield sse_event
    except Exception as e:
        logger.exception("Error in event_generator: %s", e)
        # You might want to yield an error event here
        error_data = json.dumps({"error": str(e)})
        yield error_data


@app.ping
def ping() -> str:
    return "pong!"


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)