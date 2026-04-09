from typing import Any

from fastapi import APIRouter, HTTPException

from core.config import settings
from integrations.pdq_sqlite import (
    PDQDatabaseUnavailableError,
    PDQError,
    PDQSchemaUnsupportedError,
    get_pdq_status,
    search_devices,
)


router = APIRouter(prefix="/v1/integrations", tags=["integrations"])


@router.get("/itop/config")
def itop_config() -> dict[str, Any]:
    return {
        "itop_url": settings.itop_url,
        "verify_ssl": settings.itop_verify_ssl,
        "timeout_seconds": settings.itop_timeout_seconds,
        "rest_user_configured": bool(settings.itop_rest_user),
        "rest_password_configured": bool(settings.itop_rest_password),
        "token_configured": bool(settings.itop_auth_token),
    }


@router.get("/itop/ping")
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


@router.get("/pdq/config")
def pdq_config() -> dict[str, Any]:
    return get_pdq_status()


@router.get("/pdq/search")
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
