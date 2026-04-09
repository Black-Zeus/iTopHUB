import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from infrastructure.crypto_service import decode_runtime_token, encode_runtime_token
from infrastructure.redis_cache import (
    delete_runtime_token,
    get_runtime_token,
    get_session_meta,
    load_runtime_token,
    load_session_to_redis,
    logout_session,
)
from modules.auth.repository import touch_last_used
from modules.settings.repository import fetch_settings_panels
from modules.settings.service import normalize_panel_config


def _read_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_itop_settings() -> dict[str, Any]:
    try:
        panels = fetch_settings_panels()
        return normalize_panel_config("itop", panels.get("itop", {}))
    except Exception:
        return {
            "sessionTtlMinutes": 240,
            "runtimeTokenTtlMinutes": 60,
            "sessionWarningMinutes": 1,
        }


def get_session_ttl_seconds() -> int:
    itop_settings = _get_itop_settings()
    minutes = int(itop_settings.get("sessionTtlMinutes") or 0)
    return minutes * 60 if minutes > 0 else _read_int("HUB_SESSION_TTL_SECONDS", 14400)


def get_runtime_token_ttl_seconds() -> int:
    itop_settings = _get_itop_settings()
    minutes = int(itop_settings.get("runtimeTokenTtlMinutes") or 0)
    return minutes * 60 if minutes > 0 else _read_int("HUB_RUNTIME_TOKEN_TTL_SECONDS", 3600)


def get_session_warning_seconds() -> int:
    itop_settings = _get_itop_settings()
    minutes = int(itop_settings.get("sessionWarningMinutes") or 0)
    return minutes * 60 if minutes > 0 else _read_int("HUB_SESSION_WARNING_SECONDS", 30)


def new_session_id() -> str:
    return secrets.token_urlsafe(32)


def _with_session_expiration(meta: dict[str, Any]) -> dict[str, Any]:
    updated = dict(meta)
    updated["expiresAt"] = (_now() + timedelta(seconds=get_session_ttl_seconds())).isoformat()
    updated["warningSeconds"] = get_session_warning_seconds()
    return updated


def _with_runtime_expiration(meta: dict[str, Any]) -> dict[str, Any]:
    updated = dict(meta)
    updated["tokenValidUntil"] = (_now() + timedelta(seconds=get_runtime_token_ttl_seconds())).isoformat()
    return updated


def build_session_meta(user: dict[str, Any], has_runtime_token: bool) -> dict[str, Any]:
    meta = {
        "user": user,
        "expiresAt": "",
        "tokenValidUntil": None,
        "warningSeconds": get_session_warning_seconds(),
    }
    meta = _with_session_expiration(meta)
    if has_runtime_token:
        meta = _with_runtime_expiration(meta)
    return meta


def _persist_session_meta(session_id: str, meta: dict[str, Any]) -> dict[str, Any]:
    load_session_to_redis(session_id, meta, get_session_ttl_seconds())
    return meta


def start_session(user: dict[str, Any], runtime_token: str | None) -> tuple[str, dict[str, Any]]:
    session_id = new_session_id()
    meta = build_session_meta(user, has_runtime_token=bool(runtime_token))
    _persist_session_meta(session_id, meta)
    if runtime_token:
        load_runtime_token(session_id, encode_runtime_token(runtime_token), get_runtime_token_ttl_seconds())
    return session_id, meta


def get_active_session(session_id: str) -> dict[str, Any] | None:
    meta = get_session_meta(session_id)
    if not meta:
        return None
    return meta


def update_session_user(session_id: str, meta: dict[str, Any], user: dict[str, Any]) -> dict[str, Any]:
    updated = dict(meta)
    updated["user"] = user
    updated = _with_session_expiration(updated)
    if user.get("hasRuntimeToken"):
        updated = _with_runtime_expiration(updated)
    elif not user.get("hasItopToken"):
        updated["tokenValidUntil"] = None
    return _persist_session_meta(session_id, updated)


def keep_session_alive(session_id: str, meta: dict[str, Any]) -> dict[str, Any]:
    updated = _with_session_expiration(meta)
    return _persist_session_meta(session_id, updated)


def refresh_runtime_token(session_id: str, token: str, meta: dict[str, Any]) -> dict[str, Any]:
    updated = dict(meta)
    user = dict(updated["user"])
    user["hasRuntimeToken"] = True
    updated["user"] = user
    updated = _with_session_expiration(updated)
    updated = _with_runtime_expiration(updated)
    _persist_session_meta(session_id, updated)
    load_runtime_token(session_id, encode_runtime_token(token), get_runtime_token_ttl_seconds())
    return updated


def get_runtime_token_for_session(
    session_id: str,
    user_id: int,
    meta: dict[str, Any],
) -> tuple[str | None, bool, dict[str, Any] | None]:
    encoded = get_runtime_token(session_id)
    if encoded:
        try:
            token = decode_runtime_token(encoded)
        except Exception:
            delete_runtime_token(session_id)
        else:
            touch_last_used(user_id)
            updated = refresh_runtime_token(session_id, token, meta)
            return token, False, updated

    if meta.get("user", {}).get("hasRuntimeToken") or meta.get("tokenValidUntil"):
        updated = dict(meta)
        user = dict(updated["user"])
        user["hasRuntimeToken"] = False
        updated["user"] = user
        updated["tokenValidUntil"] = None
        updated = _with_session_expiration(updated)
        _persist_session_meta(session_id, updated)
        return None, True, updated

    return None, True, None


def invalidate_session(session_id: str) -> None:
    logout_session(session_id)
