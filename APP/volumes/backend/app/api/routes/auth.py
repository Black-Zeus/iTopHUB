from typing import Any

from fastapi import APIRouter, Cookie, HTTPException, Response

from api.deps import ensure_session, raise_auth_error
from infrastructure.session_service import get_session_ttl_seconds
from modules.auth.service import (
    AuthenticationError,
    bootstrap_first_admin,
    get_bootstrap_status,
    keep_alive_session,
    login_user,
    logout_user,
    refresh_session,
    revalidate_user,
)
from schemas.auth import BootstrapFirstAdminRequest, LoginRequest, RevalidateRequest


router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.get("/bootstrap")
def auth_bootstrap_status() -> dict[str, Any]:
    try:
        return get_bootstrap_status()
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load bootstrap status: {exc}") from exc


@router.post("/bootstrap")
def auth_bootstrap_initialize(payload: BootstrapFirstAdminRequest, response: Response) -> dict[str, Any]:
    try:
        session = bootstrap_first_admin(
            integration_url=payload.integrationUrl,
            username=payload.username,
            password=payload.password,
            token=payload.tokenValue,
            verify_ssl=payload.verifySsl,
            timeout_seconds=payload.timeoutSeconds,
        )
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=f"Bootstrap failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Bootstrap failed: {exc}") from exc

    response.set_cookie(
        key="hub_session_id",
        value=session.session_id,
        httponly=True,
        samesite="lax",
        max_age=get_session_ttl_seconds(),
        secure=False,
    )
    return {
        "user": session.user,
        "expiresAt": session.session_meta["expiresAt"],
        "warningSeconds": session.session_meta["warningSeconds"],
    }


@router.post("/login")
def login(payload: LoginRequest, response: Response) -> dict[str, Any]:
    try:
        session = login_user(payload.username, payload.password)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=f"Authentication failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Authentication failed: {exc}") from exc

    response.set_cookie(
        key="hub_session_id",
        value=session.session_id,
        httponly=True,
        samesite="lax",
        max_age=get_session_ttl_seconds(),
        secure=False,
    )
    return {
        "user": session.user,
        "expiresAt": session.session_meta["expiresAt"],
        "warningSeconds": session.session_meta["warningSeconds"],
    }


@router.get("/session")
def auth_session_refresh(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session = refresh_session(session_id)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to refresh session: {exc}") from exc

    return {
        "user": session["user"],
        "expiresAt": session["expiresAt"],
        "warningSeconds": session["warningSeconds"],
    }


@router.post("/keep-alive")
def auth_keep_alive(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session = keep_alive_session(session_id)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to extend session: {exc}") from exc

    return {
        "user": session["user"],
        "expiresAt": session["expiresAt"],
        "warningSeconds": session["warningSeconds"],
    }


@router.post("/revalidate")
def auth_revalidate(payload: RevalidateRequest, hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session = revalidate_user(session_id, payload.password)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    return {
        "user": session["user"],
        "expiresAt": session["expiresAt"],
        "warningSeconds": session["warningSeconds"],
    }


@router.post("/logout")
def auth_logout(response: Response, hub_session_id: str | None = Cookie(default=None)) -> dict[str, bool]:
    if hub_session_id:
        logout_user(hub_session_id)
    response.delete_cookie("hub_session_id")
    return {"ok": True}
