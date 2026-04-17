from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as redis_async

from core.config import settings
from infrastructure.redis_cache import get_redis_client


def _read_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


NOTIFICATION_TTL_SECONDS = settings.hub_notification_ttl_seconds
NOTIFICATION_HISTORY_LIMIT = settings.hub_notification_history_limit
SSE_HEARTBEAT_SECONDS = settings.hub_sse_heartbeat_seconds
SSE_RETRY_MS = settings.hub_sse_retry_ms


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def session_notification_channel(session_id: str) -> str:
    return f"hub:notifications:session:{session_id}"


def session_notification_history_key(session_id: str) -> str:
    return f"{session_notification_channel(session_id)}:recent"


def session_notification_sequence_key(session_id: str) -> str:
    return f"{session_notification_channel(session_id)}:seq"


def get_async_redis_client() -> redis_async.Redis:
    return redis_async.Redis(
        host=os.getenv("REDIS_HOST", "redis"),
        port=_read_int("REDIS_PORT", 6379),
        db=_read_int("REDIS_DB", 0),
        decode_responses=True,
    )


def publish_session_notification(session_id: str, event: dict[str, Any]) -> dict[str, Any]:
    client = get_redis_client()
    event_id = client.incr(session_notification_sequence_key(session_id))
    envelope = {
        **event,
        "event_id": event_id,
        "timestamp": event.get("timestamp") or utc_now_iso(),
    }
    encoded = json.dumps(envelope)

    pipeline = client.pipeline()
    pipeline.rpush(session_notification_history_key(session_id), encoded)
    pipeline.ltrim(session_notification_history_key(session_id), -NOTIFICATION_HISTORY_LIMIT, -1)
    pipeline.expire(session_notification_history_key(session_id), NOTIFICATION_TTL_SECONDS)
    pipeline.expire(session_notification_sequence_key(session_id), NOTIFICATION_TTL_SECONDS)
    pipeline.publish(session_notification_channel(session_id), encoded)
    pipeline.execute()

    return envelope


async def load_session_notifications(
    client: redis_async.Redis,
    session_id: str,
    last_event_id: int | None = None,
) -> list[dict[str, Any]]:
    raw_items = await client.lrange(session_notification_history_key(session_id), 0, -1)
    notifications: list[dict[str, Any]] = []

    for raw in raw_items:
        try:
            item = json.loads(raw)
        except json.JSONDecodeError:
            continue

        try:
            event_id = int(item.get("event_id"))
        except (TypeError, ValueError):
            continue

        if last_event_id is not None and event_id <= last_event_id:
            continue

        notifications.append(item)

    return notifications
