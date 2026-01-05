import asyncio
import websockets
import sys

async def test_ws():
    uri = "ws://localhost:8000/ws/tasks"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected to WebSocket successfully")
            await websocket.close()
    except Exception as e:
        print(f"Failed to connect: {e}")
        sys.exit(1)

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(test_ws())
