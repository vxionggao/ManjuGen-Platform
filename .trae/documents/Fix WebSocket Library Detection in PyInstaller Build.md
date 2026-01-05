I will fix the "No supported WebSocket library detected" warning by explicitly importing the required WebSocket libraries in the application's entry point. This forces PyInstaller to include them in the build, bypassing the dynamic import detection issues.

### Implementation Steps

1.  **Modify `run.py`**:
    *   Add explicit imports for `wsproto` and `websockets`.
    *   Add explicit imports for Uvicorn's WebSocket protocol implementations (`wsproto_impl` and `websockets_impl`).
    *   These imports will be "dummy" imports (unused in logic) but sufficient for PyInstaller's static analysis to pick them up.

2.  **Re-run Build**:
    *   Execute `python3 package_release.py` to create a new release with the updated dependency map.

3.  **Verification**:
    *   You will run the new executable to confirm the warning is gone and WebSocket functionality (task progress updates) works.
