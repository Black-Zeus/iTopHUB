import json
from typing import Any

from fastapi import APIRouter, Cookie, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from api.deps import ensure_session, raise_auth_error
from infrastructure.job_manager import get_job
from infrastructure.notification_hub import (
    SSE_HEARTBEAT_SECONDS,
    SSE_RETRY_MS,
    get_async_redis_client,
    load_session_notifications,
    session_notification_channel,
    utc_now_iso,
)
from infrastructure.session_service import get_active_session
from modules.auth.service import AuthenticationError, get_session_user


router = APIRouter(prefix="/v1/events", tags=["events"])


def _parse_last_event_id(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _format_sse_event(
    payload: dict[str, Any],
    *,
    event_name: str | None = None,
    event_id: int | None = None,
    retry_ms: int | None = None,
) -> str:
    lines: list[str] = []
    if retry_ms is not None:
        lines.append(f"retry: {retry_ms}")
    if event_id is not None:
        lines.append(f"id: {event_id}")
    if event_name:
        lines.append(f"event: {event_name}")

    encoded = json.dumps(payload, ensure_ascii=False)
    for line in encoded.splitlines() or ["{}"]:
        lines.append(f"data: {line}")
    return "\n".join(lines) + "\n\n"


def _ensure_job_access(job_id: str, session_id: str) -> dict[str, Any]:
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado.")
    if not job.get("session_id") or job["session_id"] != session_id:
        raise HTTPException(status_code=403, detail="No puedes acceder a este job.")
    return job


async def _session_event_generator(
    request: Request,
    session_id: str,
    last_event_id: int | None = None,
):
    client = get_async_redis_client()
    pubsub = client.pubsub()
    await pubsub.subscribe(session_notification_channel(session_id))

    try:
        latest_event_id = last_event_id or 0
        history = await load_session_notifications(client, session_id, last_event_id=last_event_id)

        yield _format_sse_event(
            {"type": "sse.connected", "timestamp": utc_now_iso()},
            event_name="sse.connected",
            retry_ms=SSE_RETRY_MS,
        )

        for item in history:
            event_id = _parse_last_event_id(str(item.get("event_id")))
            if event_id is not None:
                latest_event_id = max(latest_event_id, event_id)
            yield _format_sse_event(
                item,
                event_name=str(item.get("type") or "message"),
                event_id=event_id,
            )

        while True:
            if await request.is_disconnected():
                break

            if get_active_session(session_id) is None:
                yield _format_sse_event(
                    {"type": "session.expired", "timestamp": utc_now_iso()},
                    event_name="session.expired",
                )
                break

            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=SSE_HEARTBEAT_SECONDS)
            if not message:
                yield ": keep-alive\n\n"
                continue

            try:
                payload = json.loads(message["data"])
            except (TypeError, json.JSONDecodeError):
                continue

            event_id = _parse_last_event_id(str(payload.get("event_id")))
            if event_id is not None and event_id <= latest_event_id:
                continue
            if event_id is not None:
                latest_event_id = event_id

            yield _format_sse_event(
                payload,
                event_name=str(payload.get("type") or "message"),
                event_id=event_id,
            )
    finally:
        await pubsub.unsubscribe(session_notification_channel(session_id))
        await pubsub.close()
        await client.aclose()


@router.get("/stream")
async def stream_session_events(
    request: Request,
    hub_session_id: str | None = Cookie(default=None),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
):
    session_id = ensure_session(hub_session_id)
    try:
        get_session_user(session_id)
    except AuthenticationError as exc:
        raise_auth_error(exc)

    return StreamingResponse(
        _session_event_generator(request, session_id, last_event_id=_parse_last_event_id(last_event_id)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/job/{job_id}")
async def stream_job_events(
    job_id: str,
    request: Request,
    hub_session_id: str | None = Cookie(default=None),
):
    session_id = ensure_session(hub_session_id)
    try:
        get_session_user(session_id)
    except AuthenticationError as exc:
        raise_auth_error(exc)

    _ensure_job_access(job_id, session_id)
    client = get_async_redis_client()
    pubsub = client.pubsub()
    await pubsub.subscribe(f"hub:jobs:{job_id}")

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=SSE_HEARTBEAT_SECONDS)
                if not message:
                    yield ": keep-alive\n\n"
                    continue
                yield f"data: {message['data']}\n\n"
        finally:
            await pubsub.unsubscribe(f"hub:jobs:{job_id}")
            await pubsub.close()
            await client.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/job/{job_id}/status")
async def get_job_status(
    job_id: str,
    hub_session_id: str | None = Cookie(default=None),
):
    session_id = ensure_session(hub_session_id)
    try:
        get_session_user(session_id)
    except AuthenticationError as exc:
        raise_auth_error(exc)

    job = _ensure_job_access(job_id, session_id)
    return {"item": job}
