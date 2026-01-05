I see `400 Bad Request` errors in the backend logs (terminal 6) when calling the Volcengine Video API.
`QueueWorker Error: Client error '400 Bad Request' for url 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'`

This usually means the payload sent to the API is invalid.
The video API requires a specific structure for the `content` field.
In `backend/app/api/tasks.py`, I construct the content:
```python
content = []
if payload.prompt:
    content.append({"type": "input_text", "text": payload.prompt})
for u in payload.images or []:
    content.append({"type": "input_image", "image_url": {"url": u}})
p = {"model": m.name, "content": content}
```

The user recently added `params` (resolution, ratio, duration, generate_audio) in `MotionStudio.tsx`.
```javascript
const params = { resolution, ratio, duration, generate_audio: audio }
await createTask({ type:'video', model_id:modelId, prompt, images, params })
```

However, in `backend/app/api/tasks.py`, I am **ignoring** these `params`! I only look at `prompt` and `images`.
The Volcengine Video API documentation (Seedance) expects these parameters to be passed, possibly inside the payload or as separate fields depending on the exact model version.
But wait, the `VolcVideoClient` (which I read) takes `content` and sends it as `{"model": model, "content": content}`.

The `400` error suggests `content` might be malformed OR I'm missing required parameters.
Wait, if I look at the logs again:
`Task 9 running...`
`QueueWorker Error: Client error '400 Bad Request' ...`

If the user is trying to generate a video, they probably expect the resolution/ratio/duration to be respected.
But `backend/app/api/tasks.py` receives `CreateTaskRequest`. I need to check if `CreateTaskRequest` schema even has `params`.
I haven't updated `CreateTaskRequest` in `backend/app/schemas/task.py`.

**Hypothesis**:
1.  The frontend sends `params`.
2.  The backend schema `CreateTaskRequest` might not accept `params`, or if it does (as `extra` fields or if I didn't define it strict), it's available in `payload`.
3.  But `create_task` function in `tasks.py` **does not use** `params` when constructing the `p` dictionary for the worker.
4.  The `QueueWorker` receives `p` which only has `content`.
5.  Volcengine API for Seedance might default to something, or maybe the `content` I'm sending is somehow invalid (e.g. empty prompt?).

**Wait, let's look at the API docs link provided earlier**: `https://www.volcengine.com/docs/82379/1520757?lang=zh` (Create Task).
The structure for `content` is correct (`input_text`, `input_image`).
However, maybe the model expects `parameters` field?
For Seedance (Video), typically parameters like `width`, `height` (resolution), `fps`, etc. are passed.

**Plan**:
1.  Read `backend/app/schemas/task.py` to see if `params` is accepted.
2.  Update `backend/app/schemas/task.py` to accept `params` (dict).
3.  Update `backend/app/api/tasks.py` to pass `params` to the worker.
4.  Update `backend/app/services/queue_worker.py` to include `params` in the API call payload.
    *   Note: Volcengine API typically puts these in a `parameters` object, OR inside `content`?
    *   I need to check how to pass `resolution` / `duration`.
    *   Usually it's `parameters: { width: ..., height: ... }`.
    *   Frontend sends `resolution` string "1280x720". I need to parse this.

**Refined Plan**:
1.  Read `backend/app/schemas/task.py`.
2.  Modify `backend/app/schemas/task.py` to add `params: dict | None = None`.
3.  Modify `backend/app/api/tasks.py` to extract `params` and pass it to the worker payload `p`.
4.  Modify `backend/app/services/queue_worker.py` and `VolcVideoClient` to handle these parameters.
    *   Parse `resolution` (e.g. "1280x720") into `width` and `height`.
    *   Pass `duration` (if supported by model).
    *   Pass `generate_audio` (boolean).
    *   Construct the correct payload for `VolcVideoClient.create_video_task`.

Let's start by checking the schema.