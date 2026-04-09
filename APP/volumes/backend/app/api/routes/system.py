import os
from contextlib import asynccontextmanager

from fastapi import APIRouter
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html

from core.config import settings


router = APIRouter(tags=["system"])


@asynccontextmanager
async def lifespan(_app):
    yield


@router.get("/")
def read_root() -> dict[str, str]:
    return {
        "service": "backend",
        "status": "ok",
        "message": "iTop Hub backend bootstrap activo",
    }


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {
        "service": "backend",
        "status": "healthy",
        "env": settings.env_name,
    }


@router.get("/meta")
def meta() -> dict[str, str]:
    return {
        "app_db_name": os.getenv("APP_DB_NAME", ""),
        "itop_url": os.getenv("ITOP_URL", ""),
        "redis_host": os.getenv("REDIS_HOST", ""),
        "smtp_host": os.getenv("SMTP_HOST", ""),
        "pdq_sqlite_dir": settings.pdq_sqlite_dir,
    }


if settings.env_name != "prod":
    @router.get("/v1/docs", include_in_schema=False)
    def swagger_ui():
        return get_swagger_ui_html(
            openapi_url="./openapi.json",
            title=f"{settings.project_name} API - Swagger UI",
        )


    @router.get("/v1/redoc", include_in_schema=False)
    def redoc_ui():
        return get_redoc_html(
            openapi_url="./openapi.json",
            title=f"{settings.project_name} API - ReDoc",
        )
