from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Cookie, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from api.deps import ensure_module_access, ensure_session, raise_auth_error
from modules.auth.service import AuthenticationError, get_runtime_token
from modules.reports import service as report_service
from modules.reports.errors import ReportError

router = APIRouter(prefix="/v1/reports", tags=["reports"])


def _report_error_response(exc: ReportError) -> HTTPException:
    return HTTPException(
        status_code=422,
        detail={"success": False, "error": exc.to_dict()},
    )


class ExecuteReportRequest(BaseModel):
    filters: dict[str, Any] = {}
    pagination: dict[str, Any] = {}


class ExportReportRequest(BaseModel):
    filters: dict[str, Any] = {}
    pagination: dict[str, Any] = {}
    scope: str = "all"


class CreateVersionRequest(BaseModel):
    definition_json: dict[str, Any]
    change_reason: str = ""


class RollbackRequest(BaseModel):
    target_version: int


# ── Catalog ──────────────────────────────────────────────────────────────────

@router.get("/filter-options/{source}")
def get_filter_options(
    source: str,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_module_access(session_id, "reports")
        runtime_token = None
        try:
            runtime_token = get_runtime_token(session_id)
        except Exception:
            pass
        items = report_service.get_filter_options(source, runtime_token=runtime_token)
        return {"items": items}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar las opciones del filtro: {exc}") from exc


@router.get("")
def list_reports(
    include_inactive: bool = False,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_module_access(session_id, "reports")
        items = report_service.list_reports(include_inactive=include_inactive)
        return {"items": items}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ReportError as exc:
        raise _report_error_response(exc) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar el catalogo de reportes: {exc}") from exc


@router.get("/{report_code}")
def get_report_definition(
    report_code: str,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_module_access(session_id, "reports")
        item = report_service.get_report_definition(report_code)
        return {"item": item}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ReportError as exc:
        raise _report_error_response(exc) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar la definicion del reporte: {exc}") from exc


@router.get("/{report_code}/versions")
def list_report_versions(
    report_code: str,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_module_access(session_id, "reports")
        items = report_service.list_report_versions(report_code)
        return {"items": items}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ReportError as exc:
        raise _report_error_response(exc) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible listar las versiones del reporte: {exc}") from exc


# ── Execution ─────────────────────────────────────────────────────────────────

@router.post("/{report_code}/execute")
def execute_report(
    report_code: str,
    body: ExecuteReportRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_module_access(session_id, "reports")
        runtime_token = get_runtime_token(session_id)
        result = report_service.execute_report(
            report_code,
            submitted_filters=body.filters,
            pagination=body.pagination,
            runtime_token=runtime_token,
        )
        return {
            "success": True,
            "data": {
                "report_code": result["report_code"],
                "version": result["version"],
                "columns": result["columns"],
                "rows": result["rows"],
                "pagination": {
                    "page": result["page"],
                    "page_size": result["page_size"],
                    "total": result["total"],
                    "total_pages": result["total_pages"],
                },
            },
        }
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ReportError as exc:
        raise _report_error_response(exc) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al ejecutar el reporte: {exc}") from exc


@router.post("/{report_code}/export/csv")
def export_report_csv(
    report_code: str,
    body: ExportReportRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> Response:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_module_access(session_id, "reports")
        runtime_token = get_runtime_token(session_id)
        scope = body.scope if body.scope in {"all", "current_page"} else "all"
        csv_content, filename = report_service.export_report_csv(
            report_code,
            submitted_filters=body.filters,
            runtime_token=runtime_token,
            scope=scope,
            pagination=body.pagination or None,
        )
        return Response(
            content=csv_content.encode("utf-8-sig"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ReportError as exc:
        raise _report_error_response(exc) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al exportar el reporte: {exc}") from exc


# ── Version management ────────────────────────────────────────────────────────

@router.post("/{report_code}/versions")
def create_report_version(
    report_code: str,
    body: CreateVersionRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_module_access(session_id, "reports", write=True)
        result = report_service.create_report_version(
            report_code,
            definition_json=body.definition_json,
            change_reason=body.change_reason,
            created_by=session_user.get("username", "unknown"),
        )
        return {"success": True, **result}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ReportError as exc:
        raise _report_error_response(exc) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al crear la version del reporte: {exc}") from exc


@router.post("/{report_code}/versions/{version}/activate")
def activate_report_version(
    report_code: str,
    version: int,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_module_access(session_id, "reports", write=True)
        result = report_service.activate_report_version(
            report_code,
            version=version,
            activated_by=session_user.get("username", "unknown"),
        )
        return {"success": True, **result}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ReportError as exc:
        raise _report_error_response(exc) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al activar la version del reporte: {exc}") from exc


@router.post("/{report_code}/rollback")
def rollback_report(
    report_code: str,
    body: RollbackRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_module_access(session_id, "reports", write=True)
        result = report_service.rollback_report(
            report_code,
            target_version=body.target_version,
            activated_by=session_user.get("username", "unknown"),
        )
        return {"success": True, **result}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ReportError as exc:
        raise _report_error_response(exc) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al revertir el reporte: {exc}") from exc
