import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html


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


settings = Settings()


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
    }


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
