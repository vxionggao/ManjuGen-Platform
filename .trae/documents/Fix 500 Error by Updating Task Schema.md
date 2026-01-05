The user reports a frontend error after task submission, and the task results are not displaying.
The provided log shows:

```
[error] Error: 500
[error] Warning: [antd: message] Static function can not consume context like dynamic theme. Please use 'App' component instead.
...
at submit (http://localhost:5173/src/pages/ArtStudio.tsx?t=1766925901251:73:14)
```

**Analysis:**

1. **Backend Status**: The backend logs (Terminal 6) show that `Task 3` ran successfully, received URLs from Volcengine, and finished. The backend returned 200 OK for the POST request.
2. **Frontend Error (500)**: The `Error: 500` in the browser console is misleading if the backend actually returned 200. However, if the *frontend* threw an error during the `submit` function (e.g. inside `createTask` or handling the response), it might be caught and logged as a failure.

   * Wait, `api.ts` throws `new Error(String(r.status))` if `!r.ok`. If the backend returned 200, this shouldn't trigger.

   * Is it possible the *previous* request failed? Or a different request?

   * The backend log shows `POST /api/tasks HTTP/1.1" 200 OK`.

   * Let's check `ArtStudio.tsx` line 73 (from the stack trace).

   * In the current file content, `submit` is around line 53. Line 73 is inside `handleReuse`.

   * The file might have been edited, shifting line numbers. In the current read, line 63 is `message.error('提交失败')`.

   * The stack trace mentions `submit` at line 73. This suggests the version of the file in the browser might be slightly different or I'm miscounting.
3. **Ant Design Warning**: `Static function can not consume context`. This is a known Ant Design 5.x issue when using `message.success/error` outside of an `<App>` context, but it's usually just a warning, not a crash. However, if it throws, it could interrupt execution.
4. **The Real Issue**: The user says "task results are not displaying".

   * The backend logs say `Task 3 finished`.

   * The frontend receives `task_update` via WebSocket.

   * If `listTasks` fails or returns data the frontend can't parse, it won't update.

**Hypothesis**:
The "Error: 500" might be coming from `listTasks` *after* the WebSocket update.
The backend logs don't show an error for `GET /api/tasks`.

Let's look at `backend/app/api/tasks.py` again.
I added a `try-except` block in `list_tasks` to handle JSON parsing.

```python
    for t in tasks:
        try:
            urls = json.loads(t.result_urls) if t.result_urls else None
        except:
            urls = t.result_urls.split(",") if t.result_urls else None
```

If `t.result_urls` is a JSON string `["url1"]`, `json.loads` works.
If it's `url1,url2`, `json.loads` fails, `split` works.

**Wait, I see a potential bug in** **`ArtStudio.tsx`**:

```typescript
const ws = connect(msg=>{ if(msg.type==='task_update') listTasks().then(setTasks).catch(console.error) });
```

If `listTasks` fails, it logs to console.

**Another possibility**:
The frontend `App.tsx` or `main.tsx` might not be wrapping the app in `<App>` from Ant Design, causing the `message` component to fail hard or behave unexpectedly, though the log says it's a warning.

**The "Error: 500"**:
If the backend returns 500, `api.ts` throws `Error: 500`.
Did `listTasks` return 500?
If `Task 3` was created with `finished_at` (integer), and `TaskOut` schema expects it.
In `backend/app/schemas/task.py` (I haven't read this file yet), if `finished_at` is defined as `int` but comes as `None` (for running tasks), or vice versa, Pydantic might validation error (500).
I modified `TaskOut` in `backend/app/api/tasks.py` to include `finished_at`.

```python
        out.append(TaskOut(
            ...
            finished_at=t.finished_at,
            ...
        ))
```

But did I update the **Schema Definition** in `backend/app/schemas/task.py`?
I have **NOT** read or edited `backend/app/schemas/task.py` in this session.
If `TaskOut` definition in `schemas/task.py` doesn't have `finished_at`, but I'm trying to pass it in `api/tasks.py`, that usually causes a Pydantic validation error or it just gets ignored.
However, if I'm passing it to the constructor `TaskOut(...)` and the field doesn't exist, Python will throw a `TypeError` (unexpected keyword argument).
This `TypeError` in the backend would result in a **500 Internal Server Error**.

**This explains everything**:

1. I updated `TaskRepo` and `QueueWorker` to save `finished_at`.
2. I updated `api/tasks.py` to pass `finished_at` to `TaskOut`.
3. **I forgot to update** **`schemas/task.py`** **to accept** **`finished_at`**.
4. When `list_tasks` is called (either on refresh or WebSocket update), the backend crashes with 500 because `TaskOut` doesn't accept `finished_at`.
5. Frontend receives 500, throws Error, and stops updating the list.

**Plan**:

1. Read `backend/app/schemas/task.py`.
2. Add `finished_at: int | None = None` to `TaskOut` class.
3. Restart backend (auto-reload should handle it, but I'll check).
4. Verify frontend works.

