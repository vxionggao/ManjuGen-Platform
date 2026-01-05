I will modify the logging in `backend/app/services/volc_image_client.py` to truncate or omit the Base64 image data from the log output, preventing console flooding while still logging the rest of the payload and response.

1. **Modify** **`backend/app/services/volc_image_client.py`**:

   * Create a copy of the payload for logging purposes.

   * If the payload contains an `image` list, replace the Base64 strings with a placeholder (e.g., `<base64_image_truncated>`) or just log the count of images.

   * Log this sanitized payload instead of the raw payload.

