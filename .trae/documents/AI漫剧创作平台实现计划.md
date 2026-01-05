## 总述
- 后端使用 Python（FastAPI + SQLAlchemy + Pydantic + asyncio），先完成功能抽象与模块骨架，再逐步实现并对接方舟 HTTP API。
- 前端与文档按上一版计划保持不变，但此轮优先落地后端结构、接口契约与并发控制。

## 后端模块与功能抽象
### 网关（Gateway）
- 责任：路由入口、CORS、鉴权中间件、角色控制、异常统一处理。
- 抽象：
  - `def register_routes(app: FastAPI) -> None`
  - `class AuthMiddleware`：解析简单 token，注入 `current_user`。

### 用户管理（Users）
- 责任：登录、用户信息查询。
- 接口：
  - `POST /api/users/login`：`{username, password}` → `{token, role}`。
  - `GET /api/users/me`：返回当前用户信息。
- 抽象：
  - `class UserRepo`：`get_by_username()`、`create()`。
  - `class UserService`：`login(username, password)`。

### 配置管理（Models）
- 责任：管理员配置模型与配额。
- 接口：
  - `GET/POST/PUT/DELETE /api/admin/models`。
- 抽象：
  - `class ModelConfigRepo`：CRUD。
  - `class ModelQuotaService`：`get_concurrency(model_id)`、`get_request_quota(model_id)`、`consume_request(model_id)`。

### 任务管理（Tasks）
- 责任：任务创建、状态更新、列表查询。
- 接口：
  - `POST /api/tasks`：创建任务（图片/视频）。
  - `PUT /api/tasks/{id}/status`：内部更新状态与结果。
  - `GET /api/tasks`：筛选分页。
- 抽象：
  - `class TaskRepo`：`create()`、`update_status()`、`list_by_user()`、`set_result()`。
  - `class TaskService`：`create_task(dto)`、`advance_status(task, new_status)`。

### 队列管理（Queue）
- 责任：并发控制、外部 API 调用、状态推进、回调与轮询。
- 接口：
  - `POST /api/queue/callback`：被模型回调（主要用于视频任务）。
- 抽象：
  - `class TokenBucket`（每模型一个）：`acquire()`、`release()`（内部用 `asyncio.Semaphore`）。
  - `class QueueWorker`：
    - `enqueue(task)`：根据模型类型分派。
    - `run_image(task)`：调用 Seedream 4.5；根据返回推进状态。
    - `run_video(task)`：调用 Seedance 1.0 pro；记录 `external_id` 并轮询查询。
  - `class VolcImageClient`：`create_image_task(prompt, images, size, model)`。
  - `class VolcVideoClient`：`create_video_task(content, model)`、`get_task_status(id)`、`cancel_or_delete(id)`。

### WebSocket 推送（WS）
- 责任：向前端推送任务状态与结果。
- 接口：
  - `GET /ws/tasks`：按用户连接。
- 抽象：
  - `class ConnectionManager`：`connect(user_id, ws)`、`disconnect(user_id)`、`publish(user_id, event)`。

## 数据结构与状态机
- 任务类型：`image | video`。
- 状态枚举：`queued | running | succeeded | failed | cancelled | expired`。
- `Task` 字段：`id, user_id, type, model_id, prompt, input_images(JSON), external_id, status, result_urls(JSON), video_url, last_frame_url, ratio, resolution, duration/frames, created_at, updated_at`。

## API 契约（部分）
- 创建图片任务：
  - Request：`{ type:"image", model_id, prompt, images:[url/base64], size:"2048x2048"|"1K" }`
  - Response：`{ id, status:"queued" }`
- 创建视频任务：
  - Request：`{ type:"video", model_id, prompt?, images:[url/base64], params:{ resolution, ratio, duration|frames, generate_audio? } }`
  - Response：`{ id, status:"queued" }`
- WebSocket 事件：
  - `task_update`：`{ id, status, progress?, result_urls?, video_url?, last_frame_url? }`

## 外部 API 细化
- Seedream 4.5（图片）：`POST /api/v3/images/generations`
  - 必填：`model, prompt`；可选：`image(1-14)`, `size(1K/2K/4K 或 像素值)`；图片格式与像素/宽高比需满足文档约束。
  - 返回：生成单图或组图 URL（同步）。若耗时较长，任务先置 `running`。
- Seedance 1.0 pro（视频）：
  - 创建：`POST /api/v3/contents/generations/tasks`（`content[]` 支持文本与图片 URL/Base64）。
  - 查询：`GET /api/v3/contents/generations/tasks/{id}`（返回 `video_url` 与可选 `last_frame_url`）。
  - 取消/删除：`DELETE /api/v3/contents/generations/tasks/{id}`（按状态执行）。

## 并发与配额控制
- 每模型 `TokenBucket` 初始化于服务启动：`Semaphore(concurrency_quota)`。
- 请求配额：`ModelQuotaService.consume_request(model_id)` 进行天级计数与拒绝超限。
- 队列推进伪代码：
```python
async def enqueue(task):
    bucket = buckets[task.model_id]
    await bucket.acquire()
    try:
        task_service.advance_status(task, "running")
        if task.type == "image":
            urls = await image_client.create_image_task(...)
            task_repo.set_result(task.id, urls)
            task_service.advance_status(task, "succeeded")
        else:
            ext_id = await video_client.create_video_task(...)
            task_repo.update_external_id(task.id, ext_id)
            await poll_until_done(task.id, ext_id)
    except Exception as e:
        task_service.advance_status(task, "failed")
    finally:
        bucket.release()
```

## 安全与配置
- 环境变量：`ARK_API_KEY`、`DATABASE_URL`（默认 SQLite）、`CORS_ORIGINS`、`WS_ALLOWED_ORIGINS`。
- 角色控制：管理员路由保护；任务只允许作者读取。
- 输入校验：图片数量/尺寸、视频宽高比/分辨率/时长，与文档约束一致。

## 落地步骤（后端优先）
1. 初始化后端目录与依赖，创建 `main.py` 与路由骨架。
2. 建表与仓储实现（`users/models/tasks/quota_usage`）。
3. 实现网关与登录（Demo token）。
4. 实现 `TaskService/TaskRepo` 与 `POST /api/tasks`。
5. 实现 `TokenBucket` 与 `QueueWorker.enqueue`（图片先打通）。
6. 接入 Seedream 4.5（图片）并完成状态与结果写库、WS 推送。
7. 接入 Seedance 1.0 pro（视频）创建与查询轮询、回调处理、WS 推送。
8. 管理员模型配置 CRUD 与配额生效。
9. 单元/集成测试与本地联调。

## 暂停点与所需信息
- 必需：`ARK_API_KEY`；如使用 Endpoint 调用，还需 `Endpoint ID`。
- 初始配额：每模型并发与日请求配额。
- 是否需要更严格登录（当前 Demo）。
- 是否需要持久转存生成结果到对象存储。

请确认以上“后端使用 Python”的优先实现计划。确认后我将开始创建项目骨架并逐步实现后端模块与接口。