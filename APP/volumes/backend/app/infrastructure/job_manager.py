import json
import os
import uuid
from datetime import datetime
from typing import Any

import redis

JOB_TTL_SECONDS = 300


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


def create_job(document_id: int, job_type: str, payload: dict[str, Any] | None = None) -> str:
    job_id = str(uuid.uuid4())
    client = _get_redis_client()

    now = datetime.now().isoformat()
    job_data = {
        "job_id": job_id,
        "document_id": document_id,
        "job_type": job_type,
        "status": "pending",
        "payload": json.dumps(payload) if payload else "{}",
        "result": "",
        "error_code": "",
        "error_detail": "",
        "created_at": now,
        "updated_at": now,
    }

    client.hset(_job_key(job_id), mapping=job_data)
    client.expire(_job_key(job_id), JOB_TTL_SECONDS)

    client.rpush(_job_pending_key(job_type), job_id)

    return job_id


def get_job(job_id: str) -> dict[str, Any] | None:
    client = _get_redis_client()
    data = client.hgetall(_job_key(job_id))

    if not data:
        return None

    result = {
        "job_id": data.get("job_id"),
        "document_id": data.get("document_id"),
        "job_type": data.get("job_type"),
        "status": data.get("status"),
        "payload": json.loads(data.get("payload", "{}")),
        "result": json.loads(data["result"]) if data.get("result") else None,
        "error": {
            "code": data.get("error_code"),
            "detail": data.get("error_detail"),
        } if data.get("error_code") else None,
        "created_at": data.get("created_at"),
        "updated_at": data.get("updated_at"),
    }

    return result


def get_pending_job(job_type: str) -> dict[str, Any] | None:
    client = _get_redis_client()

    job_id = client.lpop(_job_pending_key(job_type))
    if not job_id:
        return None

    job = get_job(job_id)
    if not job or job["status"] != "pending":
        return None

    client.hset(_job_key(job_id), "status", "processing")
    client.hset(_job_key(job_id), "updated_at", datetime.now().isoformat())
    client.expire(_job_key(job_id), JOB_TTL_SECONDS)

    return job


def set_job_status(
    job_id: str,
    status: str,
    result: dict[str, Any] | None = None,
    error_code: str | None = None,
    error_detail: str | None = None,
) -> None:
    client = _get_redis_client()
    now = datetime.now().isoformat()

    updates = {
        "status": status,
        "updated_at": now,
    }

    if result is not None:
        updates["result"] = json.dumps(result)

    if error_code is not None:
        updates["error_code"] = error_code

    if error_detail is not None:
        updates["error_detail"] = error_detail

    client.hset(_job_key(job_id), mapping=updates)
    client.expire(_job_key(job_id), JOB_TTL_SECONDS)

    event_data = {
        "job_id": job_id,
        "status": status,
        "result": result,
        "error": {"code": error_code, "detail": error_detail} if error_code else None,
        "timestamp": now,
    }

    client.publish(_job_channel(job_id), json.dumps(event_data))


def publish_job_event(job_id: str, event: dict[str, Any]) -> None:
    client = _get_redis_client()
    client.publish(_job_channel(job_id), json.dumps(event))
