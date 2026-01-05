I will investigate the 404 error for the image generation API.
1.  **Test Connectivity**: I will run a `curl` command to the API endpoint `https://ark.cn-beijing.volces.com/api/v3/images/generations` to see if it returns 404 and inspect the response body.
2.  **Debug Logging**: I will modify `backend/app/services/volc_image_client.py` to log the response body when an HTTP error occurs, which helps identify if the 404 comes with a specific error message from the backend.
3.  **Verify Configuration**: I will check if the correct model name/endpoint is being used.

This will help pinpoint whether the issue is the URL, the model parameter, or the environment.