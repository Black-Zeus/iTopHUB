from typing import Any

from fastapi import APIRouter, Cookie, HTTPException

from api.deps import ensure_session, model_to_dict, raise_auth_error
from modules.auth.schema import ensure_token_storage_supported
from modules.auth.service import AuthenticationError, get_session_user, refresh_session, register_user_token
from schemas.users import UserCreateRequest, UserUpdateRequest
from modules.users.service import create_user, get_user, list_roles, list_users, update_user


router = APIRouter(prefix="/v1/users", tags=["users"])


@router.get("")
def users_list(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        get_session_user(session_id)
        return {"items": list_users()}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load users: {exc}") from exc


@router.get("/roles")
def users_roles(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        get_session_user(session_id)
        return {"items": list_roles()}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load roles: {exc}") from exc


@router.put("/{user_id}")
def users_update(user_id: int, payload: UserUpdateRequest, hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    if payload.statusCode not in {"active", "inactive", "blocked"}:
        raise HTTPException(status_code=422, detail="Invalid user status.")

    try:
        session_user = get_session_user(session_id)
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
        get_session_user(session_id)
        created_user = create_user(model_to_dict(payload))
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to create user: {exc}") from exc

    if not created_user:
        raise HTTPException(status_code=404, detail="Role not found.")

    return {"item": created_user}
