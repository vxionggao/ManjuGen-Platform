I will investigate why the incorrect Endpoint ID is being used for Seedream and fix it.

1. **Analyze**: I suspect the issue lies in how the `ModelConfig` is retrieved or updated in the database, or perhaps the frontend is sending the wrong `model_id` or the backend is mapping it incorrectly.
2. **Inspect Database Initialization**: I will check `backend/app/main.py` where the models are initialized to ensure the correct IDs are assigned to the correct model names.
3. **Inspect Task Creation Logic**: I will check `backend/app/services/queue_worker.py` to ensure it's querying the correct model configuration based on the task payload.
4. **Fix**: I will correct the code to ensure `Seedream 4.5` uses `ep-20251210163826-t8lm8` and `Seedance 1.5 pro` uses `ep-20251223200430-djx9q`.
5. **Verify**: I will verify the fix by checking the database initialization logic again.

