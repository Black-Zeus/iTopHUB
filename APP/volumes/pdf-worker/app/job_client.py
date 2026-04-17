import json
import os
import time
from typing import Any

import redis


def _get_redis_client() -> redis.Redis:
    return redis.Redis(
        host=os.getenv("REDIS_HOST", "redis"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        db=int(os.getenv("REDIS_DB", 0)),
        decode_responses=True,
    )


def _job_key(job_id: str) -> str:
    return f"hub:job:{job_id}"


def _job_pending_key(job_type: str) -> str:
    return f"hub:jobs:pending:{job_type}"


def _job_channel(job_id: str) -> str:
    return f"hub:jobs:{job_id}"


def poll_pending_jobs(job_type: str, poll_interval: float = 2.0) -> dict[str, Any] | None:
    client = _get_redis_client()

    job_id = client.lpop(_job_pending_key(job_type))
    if not job_id:
        return None

    data = client.hgetall(_job_key(job_id))
    if not data or data.get("status") != "pending":
        if job_id:
            client.rpush(_job_pending_key(job_type), job_id)
        return None

    client.hset(_job_key(job_id), "status", "processing")
    client.hset(_job_key(job_id), "updated_at", time.strftime("%Y-%m-%dT%H:%M"))
    client.expire(_job_key(job_id), 300)

    return {
        "job_id": data.get("job_id"),
        "document_id": data.get("document_id"),
        "job_type": data.get("job_type"),
        "payload": json.loads(data.get("payload", "{}")),
    }


def update_job_status(
    job_id: str,
    status: str,
    result: dict[str, Any] | None = None,
    error_code: str | None = None,
    error_detail: str | None = None,
) -> None:
    client = _get_redis_client()
    now = time.strftime("%Y-%m-%dT%H:%M")

    updates = {"status": status, "updated_at": now}

    if result is not None:
        updates["result"] = json.dumps(result)

    if error_code is not None:
        updates["error_code"] = error_code

    if error_detail is not None:
        updates["error_detail"] = error_detail

    client.hset(_job_key(job_id), mapping=updates)
    client.expire(_job_key(job_id), 300)

    event_data = {
        "job_id": job_id,
        "status": status,
        "result": result,
        "error": {"code": error_code, "detail": error_detail} if error_code else None,
        "timestamp": now,
    }

    client.publish(_job_channel(job_id), json.dumps(event_data))


def get_job_payload(job_id: str) -> dict[str, Any] | None:
    client = _get_redis_client()
    data = client.hgetall(_job_key(job_id))

    if not data:
        return None

    return {
        "job_id": data.get("job_id"),
        "document_id": data.get("document_id"),
        "job_type": data.get("job_type"),
        "payload": json.loads(data.get("payload", "{}")),
    }
