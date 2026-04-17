import json
import os
import uuid
from datetime import datetime
from typing import Any

import redis

from infrastructure.notification_hub import publish_session_notification

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


def _build_job_event(
    job: dict[str, Any],
    status: str,
    timestamp: str,
    result: dict[str, Any] | None = None,
    error_code: str | None = None,
    error_detail: str | None = None,
) -> dict[str, Any]:
    return {
        "type": "job.updated",
        "job": {
            "jobId": job.get("job_id"),
            "jobType": job.get("job_type"),
            "status": status,
            "module": job.get("module_code"),
            "resourceType": job.get("resource_type"),
            "documentId": job.get("document_id"),
        },
        "job_id": job.get("job_id"),
        "status": status,
        "result": result,
        "error": {"code": error_code, "detail": error_detail} if error_code else None,
        "timestamp": timestamp,
    }


def _publish_job_event(client: redis.Redis, job: dict[str, Any], event_data: dict[str, Any]) -> None:
    client.publish(_job_channel(str(job.get("job_id"))), json.dumps(event_data))
    session_id = str(job.get("session_id") or "").strip()
    if session_id:
        publish_session_notification(session_id, event_data)


def create_job(
    document_id: int,
    job_type: str,
    payload: dict[str, Any] | None = None,
    *,
    session_id: str | None = None,
    owner_user_id: int | None = None,
    owner_name: str | None = None,
    module_code: str | None = None,
    resource_type: str | None = None,
) -> str:
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
        "session_id": session_id or "",
        "owner_user_id": str(owner_user_id or ""),
        "owner_name": owner_name or "",
        "module_code": module_code or "",
        "resource_type": resource_type or "",
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
        "session_id": data.get("session_id") or None,
        "owner_user_id": int(data["owner_user_id"]) if data.get("owner_user_id") else None,
        "owner_name": data.get("owner_name") or None,
        "module_code": data.get("module_code") or None,
        "resource_type": data.get("resource_type") or None,
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

    now = datetime.now().isoformat()
    client.hset(_job_key(job_id), "status", "processing")
    client.hset(_job_key(job_id), "updated_at", now)
    client.expire(_job_key(job_id), JOB_TTL_SECONDS)

    job["status"] = "processing"
    job["updated_at"] = now
    _publish_job_event(client, job, _build_job_event(job, "processing", now))

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
    job = get_job(job_id) or {"job_id": job_id}

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

    job.update(
        {
            "status": status,
            "result": result,
            "error": {"code": error_code, "detail": error_detail} if error_code else None,
            "updated_at": now,
        }
    )
    _publish_job_event(client, job, _build_job_event(job, status, now, result=result, error_code=error_code, error_detail=error_detail))


def publish_job_event(job_id: str, event: dict[str, Any]) -> None:
    client = _get_redis_client()
    job = get_job(job_id) or {"job_id": job_id}
    _publish_job_event(client, job, event)
