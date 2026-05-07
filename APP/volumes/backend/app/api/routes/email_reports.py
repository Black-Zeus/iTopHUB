from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Cookie, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from api.deps import ensure_any_module_access, ensure_module_access, ensure_session, model_to_dict, raise_auth_error
from modules.auth.service import AuthenticationError
from modules.email_reports.service import (
    EMAIL_REPORT_ASSET_ROOT,
    create_email_report,
    list_email_reports,
    remove_email_report,
    trigger_email_report,
    update_email_report,
)

router = APIRouter(prefix="/v1/email-reports", tags=["email-reports"])


class EmailReportRequest(BaseModel):
    reportCode: str = ""
    name: str
    description: str = ""
    webhookUrl: str
    httpMethod: str = "POST"
    status: str = "active"
    displayOrder: int = 100
    iconName: str = "mail"
    logoUrl: str = ""
    logoUpload: str = ""
    logoRemoved: bool = False
    parameters: list[dict[str, Any]] = Field(default_factory=list)


class TriggerEmailReportRequest(BaseModel):
    parameters: dict[str, Any] = Field(default_factory=dict)


@router.get("")
def email_reports_list(
    include_inactive: bool = False,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_any_module_access(session_id, ("email_reports", "settings"))
        if include_inactive and "settings" not in session_user.get("permissions", {}).get("viewModules", []):
            raise HTTPException(status_code=403, detail="Sin permisos para ver reportes por correo inactivos.")
        return {"items": list_email_reports(include_inactive=include_inactive)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar los reportes por correo: {exc}") from exc


@router.get("/assets/{asset_path:path}")
def email_report_asset_download(
    asset_path: str,
    hub_session_id: str | None = Cookie(default=None),
) -> FileResponse:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_any_module_access(session_id, ("email_reports", "settings"))
    except AuthenticationError as exc:
        raise_auth_error(exc)

    safe_relative = str(asset_path or "").strip().strip("/")
    resolved_path = (EMAIL_REPORT_ASSET_ROOT / safe_relative).resolve()
    root_path = EMAIL_REPORT_ASSET_ROOT.resolve()
    if root_path not in resolved_path.parents and resolved_path != root_path:
        raise HTTPException(status_code=404, detail="Logo no encontrado.")
    if not resolved_path.exists() or not resolved_path.is_file():
        raise HTTPException(status_code=404, detail="Logo no encontrado.")
    return FileResponse(path=str(resolved_path), media_type="image/png")


@router.post("")
def email_reports_create(
    payload: EmailReportRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_any_module_access(session_id, ("email_reports", "settings"), write=True)
        item = create_email_report(model_to_dict(payload), session_user.get("username", "unknown"))
        return {"item": item}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible crear el reporte por correo: {exc}") from exc


@router.put("/{report_id}")
def email_reports_update(
    report_id: int,
    payload: EmailReportRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_any_module_access(session_id, ("email_reports", "settings"), write=True)
        item = update_email_report(report_id, model_to_dict(payload), session_user.get("username", "unknown"))
        return {"item": item}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible actualizar el reporte por correo: {exc}") from exc


@router.delete("/{report_id}")
def email_reports_delete(
    report_id: int,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, bool]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_any_module_access(session_id, ("email_reports", "settings"), write=True)
        remove_email_report(report_id)
        return {"ok": True}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible eliminar el reporte por correo: {exc}") from exc


@router.post("/{report_id}/trigger")
def email_reports_trigger(
    report_id: int,
    payload: TriggerEmailReportRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_module_access(session_id, "email_reports")
        return trigger_email_report(report_id, payload.parameters, session_user)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible solicitar el reporte por correo: {exc}") from exc
