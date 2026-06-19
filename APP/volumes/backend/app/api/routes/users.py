from typing import Any

from fastapi import APIRouter, Cookie, HTTPException

from api.deps import ensure_module_access, ensure_session, model_to_dict, raise_auth_error
from modules.auth.schema import ensure_token_storage_supported
from modules.auth.service import AuthenticationError, get_runtime_token, refresh_session, register_user_token
from schemas.users import UserCreateRequest, UserUpdateRequest
from modules.users.service import create_user, get_user, list_roles, list_users, sync_user_email_from_itop, update_user


router = APIRouter(prefix="/v1/users", tags=["users"])


def _ensure_users_access(session_id: str, write: bool = False) -> dict[str, Any]:
    session_user = ensure_module_access(session_id, "users", write=write)
    if write and not session_user.get("isAdmin"):
        raise HTTPException(status_code=403, detail="Solo administradores pueden administrar usuarios.")
    return session_user


@router.get("")
def users_list(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        _ensure_users_access(session_id)
        return {"items": list_users()}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load users: {exc}") from exc


@router.get("/roles")
def users_roles(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        _ensure_users_access(session_id)
        return {"items": list_roles()}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load roles: {exc}") from exc


@router.put("/{user_id}")
def users_update(user_id: int, payload: UserUpdateRequest, hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    if payload.statusCode not in {"active", "inactive", "blocked"}:
        raise HTTPException(status_code=422, detail="Invalid user status.")

    try:
        session_user = _ensure_users_access(session_id, write=True)
        updated_user = update_user(user_id, model_to_dict(payload))
        if payload.tokenChanged:
            ensure_token_storage_supported()
            register_user_token(
                user_id=user_id,
                raw_token=payload.tokenValue,
                session_id=session_id if session_user["id"] == user_id else None,
            )
            updated_user = get_user(user_id)
        if session_user["id"] == user_id:
            session = refresh_session(session_id)
        else:
            session = None
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to update user: {exc}") from exc

    if not updated_user:
        raise HTTPException(status_code=404, detail="User or role not found.")

    response_payload: dict[str, Any] = {"item": updated_user}
    if session:
        response_payload["session"] = {
            "user": session["user"],
            "expiresAt": session["expiresAt"],
            "warningSeconds": session["warningSeconds"],
        }
    return response_payload


@router.post("")
def users_create(payload: UserCreateRequest, hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    if payload.statusCode not in {"active", "inactive", "blocked"}:
        raise HTTPException(status_code=422, detail="Invalid user status.")

    try:
        _ensure_users_access(session_id, write=True)
        created_user = create_user(model_to_dict(payload))
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to create user: {exc}") from exc

    if not created_user:
        raise HTTPException(status_code=404, detail="Role not found.")

    return {"item": created_user}


@router.post("/{user_id}/sync-itop-email")
def users_sync_itop_email(user_id: int, hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = _ensure_users_access(session_id, write=True)
        runtime_token = get_runtime_token(session_id)
        updated_user = sync_user_email_from_itop(user_id, runtime_token)
        if session_user["id"] == user_id:
            session = refresh_session(session_id)
        else:
            session = None
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to sync user email: {exc}") from exc

    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found.")

    response_payload: dict[str, Any] = {"item": updated_user}
    if session:
        response_payload["session"] = {
            "user": session["user"],
            "expiresAt": session["expiresAt"],
            "warningSeconds": session["warningSeconds"],
        }
    return response_payload
