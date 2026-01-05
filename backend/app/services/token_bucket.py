import asyncio

class TokenBucket:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.sem = None
    async def acquire(self):
        if self.sem is None:
            self.sem = asyncio.Semaphore(self.capacity)
        await self.sem.acquire()
    def release(self):
        if self.sem:
            self.sem.release()
