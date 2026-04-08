import json
import os
from typing import Any

import redis


def _read_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def get_redis_client() -> redis.Redis:
    return redis.Redis(
        host=os.getenv("REDIS_HOST", "redis"),
        port=_read_int("REDIS_PORT", 6379),
        db=_read_int("REDIS_DB", 0),
        decode_responses=True,
    )


def session_meta_key(session_id: str) -> str:
    return f"hub:session:{session_id}:meta"


def session_token_key(session_id: str) -> str:
    return f"hub:session:{session_id}:token"


def load_session_to_redis(session_id: str, meta: dict[str, Any], ttl_seconds: int) -> None:
    client = get_redis_client()
    client.setex(session_meta_key(session_id), ttl_seconds, json.dumps(meta))


def load_runtime_token(session_id: str, encoded_token: str, ttl_seconds: int) -> None:
    client = get_redis_client()
    client.setex(session_token_key(session_id), ttl_seconds, encoded_token)


def get_session_meta(session_id: str) -> dict[str, Any] | None:
    client = get_redis_client()
    raw = client.get(session_meta_key(session_id))
    return json.loads(raw) if raw else None


def get_runtime_token(session_id: str) -> str | None:
    client = get_redis_client()
    return client.get(session_token_key(session_id))


def expire_session(session_id: str, ttl_seconds: int) -> None:
    client = get_redis_client()
    client.expire(session_meta_key(session_id), ttl_seconds)


def expire_runtime_token(session_id: str, ttl_seconds: int) -> None:
    client = get_redis_client()
    client.expire(session_token_key(session_id), ttl_seconds)


def logout_session(session_id: str) -> None:
    client = get_redis_client()
    client.delete(session_meta_key(session_id), session_token_key(session_id))
