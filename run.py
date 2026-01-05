import uvicorn
import os
import sys
import multiprocessing

# Explicit imports to force PyInstaller to bundle WebSocket support
try:
    import websockets
    import wsproto
    from uvicorn.protocols.websockets import wsproto_impl, websockets_impl
except ImportError:
    pass

# Add backend directory to sys.path
if getattr(sys, 'frozen', False):
    base_dir = sys._MEIPASS
else:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.append(os.path.join(base_dir, 'backend'))

if __name__ == "__main__":
    multiprocessing.freeze_support() # For Windows
    # Import app after path setup
    try:
        # Use string import for reload support in dev, but module for frozen
        if getattr(sys, 'frozen', False):
            from backend.app.main import app
            uvicorn.run(app, host="0.0.0.0", port=8000)
        else:
            uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
    except Exception as e:
        print(f"Error starting app: {e}")
        input("Press Enter to exit...")
