import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Cookie, FastAPI, HTTPException, Response
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from pydantic import BaseModel

from auth_service import (
    AuthenticationError,
    get_runtime_token,
    get_session_user,
    keep_alive_session,
    login_user,
    logout_user,
    refresh_session,
    register_user_token,
    revalidate_user,
)
from session_service import get_session_ttl_seconds
from users_service import create_user, list_roles, list_users, search_itop_users, update_user

from integrations.pdq_sqlite import (
    PDQDatabaseUnavailableError,
    PDQError,
    PDQSchemaUnsupportedError,
    get_pdq_status,
    search_devices,
)


def _read_bool(name: str, default: bool = True) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _read_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


class Settings:
    def __init__(self) -> None:
        self.env_name = os.getenv("ENV_NAME", "dev")
        self.project_name = os.getenv("PROJECT_NAME", "itophub")
        self.itop_url = os.getenv("ITOP_URL", "")
        self.itop_rest_user = os.getenv("ITOP_REST_USER", "")
        self.itop_rest_password = os.getenv("ITOP_REST_PASSWORD", "")
        self.itop_auth_token = os.getenv("ITOP_AUTH_TOKEN", "")
        self.itop_verify_ssl = _read_bool("ITOP_VERIFY_SSL", default=True)
        self.itop_timeout_seconds = _read_int("ITOP_TIMEOUT_SECONDS", default=30)
        self.pdq_enabled = _read_bool("PDQ_ENABLED", default=True)
        self.pdq_sqlite_dir = os.getenv("PDQ_SQLITE_DIR", "/app/data/pdq")
        self.pdq_sqlite_file_name = os.getenv("PDQ_SQLITE_FILE_NAME", "")
        self.pdq_sqlite_file_glob = os.getenv("PDQ_SQLITE_FILE_GLOB", "*.db;*.sqlite;*.sqlite3")
        self.pdq_search_min_chars = _read_int("PDQ_SEARCH_MIN_CHARS", default=2)


settings = Settings()


def _model_to_dict(model: BaseModel) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


class LoginRequest(BaseModel):
    username: str
    password: str


class RevalidateRequest(BaseModel):
    password: str


class UserUpdateRequest(BaseModel):
    fullName: str
    roleCode: str
    statusCode: str
    tokenValue: str = ""
    tokenChanged: bool = False


class UserCreateRequest(BaseModel):
    username: str
    fullName: str
    roleCode: str
    statusCode: str
    tokenValue: str = ""


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(
    title=f"{settings.project_name} API",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url="/v1/openapi.json" if settings.env_name != "prod" else None,
    servers=[{"url": "/api", "description": "API Gateway (nginx)"}],
    lifespan=lifespan,
)


def _raise_auth_error(exc: AuthenticationError) -> None:
    raise HTTPException(status_code=exc.status_code, detail={"message": exc.message, "code": exc.code}) from exc


def _ensure_session(hub_session_id: str | None) -> str:
    if not hub_session_id:
        raise HTTPException(
            status_code=401,
            detail={"message": "Sesion inexistente.", "code": "SESSION_EXPIRED"},
        )
    return hub_session_id


@app.get("/")
def read_root() -> dict[str, str]:
    return {
        "service": "backend",
        "status": "ok",
        "message": "iTop Hub backend bootstrap activo",
    }


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {
        "service": "backend",
        "status": "healthy",
        "env": settings.env_name,
    }


@app.get("/meta")
def meta() -> dict[str, str]:
    return {
        "app_db_name": os.getenv("APP_DB_NAME", ""),
        "itop_url": os.getenv("ITOP_URL", ""),
        "redis_host": os.getenv("REDIS_HOST", ""),
        "smtp_host": os.getenv("SMTP_HOST", ""),
        "pdq_sqlite_dir": settings.pdq_sqlite_dir,
    }


@app.post("/v1/auth/login")
def login(payload: LoginRequest, response: Response) -> dict[str, Any]:
    try:
        session = login_user(payload.username, payload.password)
    except AuthenticationError as exc:
        _raise_auth_error(exc)
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


@app.get("/v1/auth/session")
def auth_session_refresh(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        session = refresh_session(session_id)
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to refresh session: {exc}") from exc

    return {
        "user": session["user"],
        "expiresAt": session["expiresAt"],
        "warningSeconds": session["warningSeconds"],
    }


@app.post("/v1/auth/keep-alive")
def auth_keep_alive(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        session = keep_alive_session(session_id)
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to extend session: {exc}") from exc

    return {
        "user": session["user"],
        "expiresAt": session["expiresAt"],
        "warningSeconds": session["warningSeconds"],
    }


@app.post("/v1/auth/revalidate")
def auth_revalidate(payload: RevalidateRequest, hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        session = revalidate_user(session_id, payload.password)
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    return {
        "user": session["user"],
        "expiresAt": session["expiresAt"],
        "warningSeconds": session["warningSeconds"],
    }


@app.post("/v1/auth/logout")
def auth_logout(response: Response, hub_session_id: str | None = Cookie(default=None)) -> dict[str, bool]:
    if hub_session_id:
        logout_user(hub_session_id)
    response.delete_cookie("hub_session_id")
    return {"ok": True}


@app.get("/v1/users")
def users_list(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        get_session_user(session_id)
        return {"items": list_users()}
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load users: {exc}") from exc


@app.get("/v1/users/itop/search")
def users_itop_search(q: str, hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        session_user = get_session_user(session_id)
        runtime_token = get_runtime_token(session_id)
        return {"items": search_itop_users(q, runtime_token), "sessionUser": session_user["username"]}
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to search iTop users: {exc}") from exc


@app.get("/v1/users/roles")
def users_roles(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        get_session_user(session_id)
        return {"items": list_roles()}
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load roles: {exc}") from exc


@app.put("/v1/users/{user_id}")
def users_update(user_id: int, payload: UserUpdateRequest, hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    if payload.statusCode not in {"active", "inactive", "blocked"}:
        raise HTTPException(status_code=422, detail="Invalid user status.")

    try:
        session_user = get_session_user(session_id)
        updated_user = update_user(user_id, _model_to_dict(payload))
        if payload.tokenChanged:
            register_user_token(
                user_id=user_id,
                raw_token=payload.tokenValue,
                session_id=session_id if session_user["id"] == user_id else None,
            )
        if session_user["id"] == user_id:
            session = refresh_session(session_id)
        else:
            session = None
    except AuthenticationError as exc:
        _raise_auth_error(exc)
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


@app.post("/v1/users")
def users_create(payload: UserCreateRequest, hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    if payload.statusCode not in {"active", "inactive", "blocked"}:
        raise HTTPException(status_code=422, detail="Invalid user status.")

    try:
        get_session_user(session_id)
        created_user = create_user(_model_to_dict(payload))
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to create user: {exc}") from exc

    if not created_user:
        raise HTTPException(status_code=404, detail="Role not found.")

    return {"item": created_user}


@app.get("/v1/integrations/itop/config")
def itop_config() -> dict[str, Any]:
    return {
        "itop_url": settings.itop_url,
        "verify_ssl": settings.itop_verify_ssl,
        "timeout_seconds": settings.itop_timeout_seconds,
        "rest_user_configured": bool(settings.itop_rest_user),
        "rest_password_configured": bool(settings.itop_rest_password),
        "token_configured": bool(settings.itop_auth_token),
    }


@app.get("/v1/integrations/itop/ping")
def itop_ping() -> dict[str, Any]:
    try:
        from integrations.itop_cmdb_connector import build_env_token_store, iTopCMDBConnector
    except ModuleNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"iTop connector dependency missing: {exc}. Recreate backend container to install requirements.",
        ) from exc

    if not settings.itop_url:
        raise HTTPException(status_code=503, detail="Missing ITOP_URL.")
    if not settings.itop_rest_user or not settings.itop_rest_password:
        raise HTTPException(status_code=503, detail="Missing ITOP_REST_USER or ITOP_REST_PASSWORD.")

    try:
        result = iTopCMDBConnector.authenticate(
            base_url=settings.itop_url,
            username=settings.itop_rest_user,
            password=settings.itop_rest_password,
            token_store=build_env_token_store(default_token=settings.itop_auth_token),
            verify_ssl=settings.itop_verify_ssl,
            timeout=settings.itop_timeout_seconds,
        )
    except ConnectionError as exc:
        raise HTTPException(status_code=502, detail=f"iTop connection failed: {exc}") from exc

    if not result.ok:
        status_code = 401 if not result.authorized else 503
        raise HTTPException(status_code=status_code, detail=result.error)

    try:
        operations = result.connector.list_operations() if result.connector else None
    finally:
        if result.connector:
            result.connector.close()

    return {
        "service": "itop",
        "status": "healthy",
        "username": result.username,
        "operations_count": len(operations.raw.get("operations", {})) if operations else 0,
    }


@app.get("/v1/integrations/pdq/config")
def pdq_config() -> dict[str, Any]:
    return get_pdq_status()


@app.get("/v1/integrations/pdq/search")
def pdq_search(query: str) -> dict[str, Any]:
    try:
        return search_devices(query)
    except PDQDatabaseUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PDQSchemaUnsupportedError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except PDQError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDQ search failed: {exc}") from exc


if settings.env_name != "prod":
    @app.get("/v1/docs", include_in_schema=False)
    def swagger_ui():
        return get_swagger_ui_html(
            openapi_url="./openapi.json",
            title=f"{settings.project_name} API - Swagger UI",
        )


    @app.get("/v1/redoc", include_in_schema=False)
    def redoc_ui():
        return get_redoc_html(
            openapi_url="./openapi.json",
            title=f"{settings.project_name} API - ReDoc",
        )
