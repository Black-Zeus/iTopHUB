import asyncio
import json
from typing import Any

import redis.asyncio as redis
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/v1/events", tags=["events"])


async def _get_redis_client() -> redis.Redis:
    import os
    return redis.Redis(
        host=os.getenv("REDIS_HOST", "redis"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        db=int(os.getenv("REDIS_DB", 0)),
        decode_responses=True,
    )


async def event_generator(job_id: str, timeout: int = 300):
    client = await _get_redis_client()
    pubsub = client.pubsub()
    channel = f"hub:jobs:{job_id}"
    await pubsub.subscribe(channel)

    try:
        start_time = asyncio.get_event_loop().time()
        while True:
            if asyncio.get_event_loop().time() - start_time > timeout:
                yield "data: {\"status\": \"timeout\", \"error\": {\"code\": \"TIMEOUT\", \"detail\": \"Tiempo de espera agotado.\"}}\n\n"
                break

            message = await pubsub.get_message(timeout=1.0)
            if message and message["type"] == "message":
                yield f"data: {message['data']}\n\n"

                try:
                    data = json.loads(message["data"])
                    if data.get("status") in ("completed", "failed", "timeout"):
                        break
                except json.JSONDecodeError:
                    pass

            await asyncio.sleep(0.1)
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await client.aclose()


@router.get("/job/{job_id}")
async def stream_job_events(job_id: str):
    return StreamingResponse(
        event_generator(job_id, timeout=300),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/job/{job_id}/status")
async def get_job_status(job_id: str):
    from infrastructure.job_manager import get_job
    job = get_job(job_id)
    if not job:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Job no encontrado.")
    return {"item": job}
