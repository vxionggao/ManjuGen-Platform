I need to fix the issue where refreshing the page causes an error or loss of state, while ensuring that the task list is re-fetched.

1. **Analyze Issue**: The user says "refreshing page errors". This might be due to `JSON.parse` failing on empty/invalid `localStorage` data in `useState` initialization, or the asynchronous `listModels` call not finishing before `modelId` state logic runs, or `useEffect` dependencies causing infinite loops or race conditions.

   * Specifically, `JSON.parse` in `useState` for `images` is already wrapped in try-catch.

   * However, if `localStorage` has `undefined` or `null` stringified, it might be an issue.

   * The user says "keep original page content but re-fetch results". This means `localStorage` persistence is working (or desired), but the *execution* of restoring state + fetching new data is buggy.

2. **Potential Bug**: In `ArtStudio.tsx`, inside `useEffect` for fetching models:

   ```javascript
   if (!modelId && imgModels.length > 0) setModelId(imgModels[0].id)
   ```

   If `modelId` was restored from `localStorage` (e.g. `1`), but the new `listModels` returns objects with IDs, this logic is fine.
   But if `localStorage` had a stale ID that doesn't exist in the new list, the UI might show empty or error.

   **Crucial Bug**: The user previously mentioned "Array.split" error. Although fixed, maybe there's another render error.
   Wait, "刷新了页面会报错" (Refreshed page and it errored).
   If I refresh, `tasks` are initially empty `[]`. Then `useEffect` calls `listTasks`.
   If `listTasks` fails or returns data that breaks rendering, that's a problem.

   **Another Possibility**: The `images` state restoration from `localStorage`.
   If `localStorage` has invalid Base64 strings or huge data that got truncated/corrupted, `JSON.parse` might succeed (if valid JSON) but the `src` attribute in `img` tag might get garbage, causing a browser console error (but not a React crash usually).
   However, if `JSON.parse` throws, the `useState` initializer returns `[]`.

   **Likely Cause**: The user might be referring to the fact that when refreshing, the **WebSocket connection** might be re-established, or `listTasks` might be returning `null` for some fields that are expected.

   **Wait**, I see a potential issue in `ArtStudio.tsx`'s `useEffect`:

   ```javascript
   useEffect(() => { 
       try { localStorage.setItem('art_images', JSON.stringify(images)) } ... 
   }, [images])
   ```

   On first render (refresh), `images` is initialized from `localStorage`. Then `useEffect` runs. It saves it back. This is fine.

   **What if the error is "ReferenceError: localStorage is not defined"?** No, it's a browser.

   **Let's look at the User's input again**: "hope that after refreshing the page, the original page content is kept, but results are re-fetched".
   This implies that currently, refreshing might be **clearing** the content or showing an error.
   If it's showing an error, I need to find it.
   If it's clearing content, then my persistence logic failed.

   **Checking** **`useState`** **initialization**:

   ```javascript
   const [modelId, setModelId] = useState<number | null>(() => {
       const saved = localStorage.getItem('art_model')
       return saved ? Number(saved) : null
   })
   ```

   If `localStorage` has "null" (string), `Number("null")` is `NaN`.
   If `modelId` is `NaN`, `Select` component might complain or `!modelId` check might fail weirdly.
   I should validate `saved`.

   **Fix Plan**:

   1. Robustify `useState` initializers in `ArtStudio.tsx` to handle `NaN` or invalid values.
   2. Ensure `listTasks` is called *after* component mount (it is in `useEffect`).
   3. Add a check: if `modelId` from storage is not found in the fetched `models` list, default to the first available model.
   4. **Important**: The user said "refreshing page errors". I will wrap the main component render in a simple Error Boundary (or just add try-catch blocks around sensitive render parts) if I can't find a specific bug, but usually it's better to fix the root cause.
   5. **Refine** **`setAuth`** **in** **`AppLayout`**: The user previously mentioned a linter error `setAuth(null, null)`. I should fix that too to be clean.

   **Let's look at the** **`localStorage`** **logic again.**
   If `localStorage.getItem('art_model')` returns `undefined` (if key missing), `Number(undefined)` is `NaN`.
   `saved ? ...` handles null/undefined/empty string.
   But if `saved` is "NaN", `Number` returns `NaN`.
   I'll use `parseInt` or strictly check.

   **One more thing**: The `images` array contains Base64 strings. `localStorage` has a limit (\~5MB). If user uploaded many images, `setItem` throws quota error (caught). But if it saved a **partial** string? `JSON.stringify` is atomic usually.
   But maybe the `JSON.parse` is failing on a large string if it was corrupted?
   I'll add safer parsing.

   **Let's implement the fixes.**

