import os
import smtplib
from contextlib import asynccontextmanager
from email.message import EmailMessage
from typing import Any

import requests
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
from auth_schema import ensure_token_storage_supported
from session_service import get_session_ttl_seconds
from settings_service import (
    create_settings_profile,
    create_settings_sync_task,
    list_settings_profiles,
    list_settings_payload,
    remove_settings_sync_task,
    update_settings_profile,
    update_settings_panel,
    update_settings_sync_task,
)
from assets_service import get_itop_asset_detail, list_itop_asset_catalog, search_itop_assets
from people_service import get_itop_person_detail, search_itop_people
from users_service import create_user, get_user, list_roles, list_users, search_itop_users, update_user

from integrations.pdq_sqlite import (
    PDQDatabaseUnavailableError,
    PDQError,
    PDQSchemaUnsupportedError,
    build_pdq_test_config,
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


class SettingsPanelUpdateRequest(BaseModel):
    config: dict[str, Any]


class SyncTaskRequest(BaseModel):
    schedule: str
    description: str
    taskType: str
    commandSource: str
    commandValue: str
    isActive: bool = True


class MailTestRequest(BaseModel):
    config: dict[str, Any]


class ItopTestRequest(BaseModel):
    config: dict[str, Any]


class PdqTestRequest(BaseModel):
    config: dict[str, Any]


class ProfileRequest(BaseModel):
    code: str = ""
    name: str
    description: str = ""
    isAdmin: bool = False
    status: str = "active"
    modules: list[dict[str, Any]] = []


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


def _ensure_settings_access(session_id: str, write: bool = False) -> dict[str, Any]:
    session_user = get_session_user(session_id)
    permission_key = "writeModules" if write else "viewModules"
    allowed_modules = session_user.get("permissions", {}).get(permission_key, [])
    if "settings" not in allowed_modules:
        raise HTTPException(status_code=403, detail="Sin permisos para el modulo Configuracion.")
    return session_user


def _ensure_module_access(session_id: str, module_code: str, write: bool = False) -> dict[str, Any]:
    session_user = get_session_user(session_id)
    permission_key = "writeModules" if write else "viewModules"
    allowed_modules = session_user.get("permissions", {}).get(permission_key, [])
    if module_code not in allowed_modules:
        raise HTTPException(status_code=403, detail=f"Sin permisos para el modulo {module_code}.")
    return session_user


def _build_itop_api_url(integration_url: str) -> str:
    base = str(integration_url or "").strip().rstrip("/")
    return f"{base}/webservices/rest.php" if base else ""


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


@app.get("/v1/people/itop/search")
def people_itop_search(
    q: str = "",
    status: str = "",
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        session_user = _ensure_module_access(session_id, "people")
        runtime_token = get_runtime_token(session_id)
        return {
            "items": search_itop_people(q, runtime_token, status=status),
            "sessionUser": session_user["username"],
        }
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to search iTop people: {exc}") from exc


@app.get("/v1/people/{person_id}")
def people_detail(person_id: int, hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        _ensure_module_access(session_id, "people")
        runtime_token = get_runtime_token(session_id)
        return {"item": get_itop_person_detail(person_id, runtime_token)}
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load iTop person detail: {exc}") from exc


@app.get("/v1/assets/itop/search")
def assets_itop_search(
    q: str = "",
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        session_user = _ensure_module_access(session_id, "assets")
        runtime_token = get_runtime_token(session_id)
        return {
            "items": search_itop_assets(q, runtime_token),
            "sessionUser": session_user["username"],
        }
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to search iTop assets: {exc}") from exc


@app.get("/v1/assets/itop/catalog")
def assets_itop_catalog(
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        _ensure_module_access(session_id, "assets")
        runtime_token = get_runtime_token(session_id)
        return list_itop_asset_catalog(runtime_token)
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load iTop asset catalog: {exc}") from exc


@app.get("/v1/assets/{asset_id}")
def asset_detail(asset_id: int, hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        _ensure_module_access(session_id, "assets")
        runtime_token = get_runtime_token(session_id)
        return {"item": get_itop_asset_detail(asset_id, runtime_token)}
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load iTop asset detail: {exc}") from exc


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


@app.get("/v1/settings")
def settings_list(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        _ensure_settings_access(session_id)
        return list_settings_payload()
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load settings: {exc}") from exc


@app.put("/v1/settings/{panel_code}")
def settings_update_panel(
    panel_code: str,
    payload: SettingsPanelUpdateRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        _ensure_settings_access(session_id, write=True)
        item = update_settings_panel(panel_code, payload.config)
        return {"panel": panel_code, "config": item}
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to update settings panel: {exc}") from exc


@app.post("/v1/settings/sync/tasks")
def settings_create_sync_task(
    payload: SyncTaskRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        _ensure_settings_access(session_id, write=True)
        return {"item": create_settings_sync_task(_model_to_dict(payload))}
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to create sync task: {exc}") from exc


@app.put("/v1/settings/sync/tasks/{task_id}")
def settings_update_sync_task(
    task_id: int,
    payload: SyncTaskRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        _ensure_settings_access(session_id, write=True)
        return {"item": update_settings_sync_task(task_id, _model_to_dict(payload))}
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to update sync task: {exc}") from exc


@app.delete("/v1/settings/sync/tasks/{task_id}")
def settings_delete_sync_task(
    task_id: int,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, bool]:
    session_id = _ensure_session(hub_session_id)
    try:
        _ensure_settings_access(session_id, write=True)
        remove_settings_sync_task(task_id)
        return {"ok": True}
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to delete sync task: {exc}") from exc


@app.post("/v1/settings/mail/test")
def settings_test_mail(
    payload: MailTestRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        session_user = _ensure_settings_access(session_id, write=True)
        config = payload.config or {}
        smtp_host = str(config.get("smtpHost") or "").strip()
        smtp_port = int(str(config.get("smtpPort") or "0").strip() or "0")
        sender_name = str(config.get("senderName") or "iTop Hub").strip()
        sender_email = str(config.get("senderEmail") or "").strip()
        smtp_security = str(config.get("smtpSecurity") or "none").strip().lower()
        mail_format = str(config.get("mailFormat") or "html").strip().lower()
        footer_note = str(config.get("footerNote") or "").strip()

        if not smtp_host:
            raise HTTPException(status_code=422, detail="El servidor SMTP es obligatorio.")
        if smtp_port <= 0:
            raise HTTPException(status_code=422, detail="El puerto SMTP es obligatorio.")
        if not sender_email:
            raise HTTPException(status_code=422, detail="El correo remitente es obligatorio.")
        if mail_format not in {"html", "txt"}:
            raise HTTPException(status_code=422, detail="El formato de correo no es valido.")

        message = EmailMessage()
        message["Subject"] = "Prueba SMTP iTop Hub"
        message["From"] = f"{sender_name} <{sender_email}>"
        message["To"] = sender_email
        text_body = (
            "Prueba de correo enviada desde iTop Hub.\n\n"
            f"Usuario: {session_user.get('username')}\n"
            f"Servidor: {smtp_host}:{smtp_port}\n"
            f"Seguridad: {smtp_security}\n"
            f"Formato: {'HTML' if mail_format == 'html' else 'Texto plano'}\n"
        )
        if footer_note:
            text_body = f"{text_body}\n{footer_note}\n"

        if mail_format == "html":
            message.set_content(text_body)
            html_parts = [
                "<html><body style=\"font-family:Arial,sans-serif;font-size:14px;color:#1f2933;\">",
                "<h2>Prueba de correo enviada desde iTop Hub</h2>",
                f"<p><strong>Usuario:</strong> {session_user.get('username')}</p>",
                f"<p><strong>Servidor:</strong> {smtp_host}:{smtp_port}</p>",
                f"<p><strong>Seguridad:</strong> {smtp_security}</p>",
                "<p><strong>Formato:</strong> HTML</p>",
            ]
            if footer_note:
                html_parts.append(f"<p>{footer_note}</p>")
            html_parts.append("</body></html>")
            message.add_alternative("".join(html_parts), subtype="html")
        else:
            message.set_content(text_body)

        if smtp_security == "ssl_tls":
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                server.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                if smtp_security == "starttls":
                    server.starttls()
                server.send_message(message)

        return {
            "ok": True,
            "message": f"Correo de prueba enviado a {sender_email}.",
        }
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible enviar el correo de prueba: {exc}") from exc


@app.post("/v1/settings/itop/test")
def settings_test_itop(
    payload: ItopTestRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        _ensure_settings_access(session_id)
        config = payload.config or {}
        integration_url = str(config.get("integrationUrl") or "").strip()
        verify_ssl = str(config.get("verifySsl")).strip().lower() not in {"false", "0", "no", "off"} if "verifySsl" in config else True
        timeout_seconds = int(str(config.get("timeoutSeconds") or "30").strip() or "30")
        api_url = _build_itop_api_url(integration_url)

        if not integration_url:
            raise HTTPException(status_code=422, detail="La URL de iTop es obligatoria.")
        if timeout_seconds <= 0:
            raise HTTPException(status_code=422, detail="El timeout debe ser mayor que cero.")

        response = requests.post(
            api_url,
            params={"version": "1.3"},
            data={"json_data": "{}"},
            verify=verify_ssl,
            timeout=timeout_seconds,
            allow_redirects=True,
        )

        if response.status_code == 404:
            raise HTTPException(
                status_code=422,
                detail=f"La ruta API no fue encontrada en {api_url}. Revisa la URL base de iTop.",
            )
        if response.status_code >= 500:
            raise HTTPException(
                status_code=502,
                detail=f"iTop respondio con error {response.status_code} al intentar acceder a {api_url}.",
            )

        return {
            "ok": True,
            "message": (
                f"Conexion valida con iTop en {api_url}. "
                f"HTTP {response.status_code} con SSL {'habilitado' if verify_ssl else 'deshabilitado'}."
            ),
            "apiUrl": api_url,
            "statusCode": response.status_code,
            "verifySsl": verify_ssl,
        }
    except requests.exceptions.SSLError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Fallo de SSL al conectar con iTop: {exc}",
        ) from exc
    except requests.exceptions.Timeout as exc:
        raise HTTPException(
            status_code=504,
            detail=f"iTop no respondio dentro de {timeout_seconds} segundos.",
        ) from exc
    except requests.exceptions.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"No fue posible conectar con iTop: {exc}",
        ) from exc
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible validar la conexion con iTop: {exc}") from exc


@app.post("/v1/settings/pdq/test")
def settings_test_pdq(
    payload: PdqTestRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        _ensure_settings_access(session_id)
        config = payload.config or {}
        pdq_config = build_pdq_test_config(config)
        status = get_pdq_status(pdq_config)

        if not status.get("directory_exists"):
            raise HTTPException(
                status_code=422,
                detail=f"La carpeta configurada no existe o no es accesible: {status.get('sqlite_dir')}.",
            )

        if not status.get("database_available"):
            configured_file_path = str(status.get("configured_file_path") or "").strip()
            detail = (
                f"No se encontro la base de datos PDQ en la ruta configurada: {configured_file_path}."
                if configured_file_path
                else f"No se encontro una base de datos PDQ valida en la carpeta configurada: {status.get('sqlite_dir')}."
            )
            raise HTTPException(status_code=422, detail=detail)

        selected_file = status.get("selected_file") or {}
        return {
            "ok": True,
            "message": f"Base PDQ disponible en {selected_file.get('path')}.",
            "status": status,
        }
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible validar la base PDQ: {exc}") from exc


@app.get("/v1/settings/profiles")
def settings_profiles_list(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        _ensure_settings_access(session_id)
        return {"items": list_settings_profiles()}
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load profiles: {exc}") from exc


@app.post("/v1/settings/profiles")
def settings_profiles_create(
    payload: ProfileRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        _ensure_settings_access(session_id, write=True)
        return {"item": create_settings_profile(_model_to_dict(payload))}
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to create profile: {exc}") from exc


@app.put("/v1/settings/profiles/{role_code}")
def settings_profiles_update(
    role_code: str,
    payload: ProfileRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = _ensure_session(hub_session_id)
    try:
        _ensure_settings_access(session_id, write=True)
        return {"item": update_settings_profile(role_code, _model_to_dict(payload))}
    except AuthenticationError as exc:
        _raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to update profile: {exc}") from exc


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
