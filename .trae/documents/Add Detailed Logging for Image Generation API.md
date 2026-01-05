I will modify the backend code to log the full request payload and response body for the image generation API.

1. **Modify** **`backend/app/services/volc_image_client.py`**:

   * Add logging (print) of the `payload` dictionary before sending the request.

   * Add logging (print) of the response text, regardless of success or failure.
2. **Verify**: The backend will auto-reload. I will ask the user to trigger the request again to see the logs.

