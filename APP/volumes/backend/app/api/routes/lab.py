import mimetypes
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Cookie, HTTPException
from fastapi.responses import FileResponse

from api.deps import ensure_module_access, ensure_session, model_to_dict, raise_auth_error
from modules.auth.service import AuthenticationError
from modules.lab.service import (
    create_lab_record,
    generate_lab_document,
    get_lab_bootstrap,
    get_lab_document_file,
    get_lab_evidence_file,
    get_lab_record_detail,
    list_lab_records,
    update_lab_record,
    upload_lab_evidences,
)
from schemas.lab import (
    LabEvidenceUploadRequest,
    LabRecordCreateRequest,
    LabRecordUpdateRequest,
)


router = APIRouter(prefix="/v1/lab", tags=["lab"])


def _ensure_lab_access(session_id: str, *, write: bool = False) -> dict[str, Any]:
    return ensure_module_access(session_id, "lab", write=write)


@router.get("/bootstrap")
def lab_bootstrap(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = _ensure_lab_access(session_id)
        return get_lab_bootstrap(session_user)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar el modulo de laboratorio: {exc}") from exc


@router.get("/records")
def lab_records_list(
    q: str = "",
    status: str = "",
    reason: str = "",
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        _ensure_lab_access(session_id)
        return list_lab_records(q, status, reason)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar las actas de laboratorio: {exc}") from exc


@router.get("/records/{record_id}")
def lab_record_detail(
    record_id: int,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        _ensure_lab_access(session_id)
        return {"item": get_lab_record_detail(record_id)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar el detalle del acta: {exc}") from exc


@router.post("/records")
def lab_record_create(
    payload: LabRecordCreateRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = _ensure_lab_access(session_id, write=True)
        return {"item": create_lab_record(model_to_dict(payload), session_user)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible crear el acta de laboratorio: {exc}") from exc


@router.put("/records/{record_id}")
def lab_record_update(
    record_id: int,
    payload: LabRecordUpdateRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        _ensure_lab_access(session_id, write=True)
        raw = {k: v for k, v in model_to_dict(payload).items() if v is not None}
        return {"item": update_lab_record(record_id, raw)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible actualizar el acta: {exc}") from exc


@router.post("/records/{record_id}/documents/{phase}")
def lab_generate_document(
    record_id: int,
    phase: str,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        _ensure_lab_access(session_id, write=True)
        return generate_lab_document(record_id, phase)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible generar el documento: {exc}") from exc


@router.get("/records/{record_id}/documents/{stored_name}")
def lab_document_download(
    record_id: int,
    stored_name: str,
    hub_session_id: str | None = Cookie(default=None),
) -> FileResponse:
    session_id = ensure_session(hub_session_id)
    try:
        _ensure_lab_access(session_id)
        path = get_lab_document_file(record_id, stored_name)
        media_type = mimetypes.guess_type(str(path))[0] or "application/pdf"
        return FileResponse(path=str(path), media_type=media_type, filename=Path(stored_name).name)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible descargar el documento: {exc}") from exc


@router.post("/records/{record_id}/evidences")
def lab_evidence_upload(
    record_id: int,
    payload: LabEvidenceUploadRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        _ensure_lab_access(session_id, write=True)
        files = [
            {
                "name": f.name,
                "mimeType": f.mimeType,
                "contentBase64": f.contentBase64,
                "caption": f.caption,
            }
            for f in payload.files
        ]
        return upload_lab_evidences(record_id, payload.phase, files)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar las evidencias: {exc}") from exc


@router.get("/records/{record_id}/evidences/{stored_name}")
def lab_evidence_download(
    record_id: int,
    stored_name: str,
    hub_session_id: str | None = Cookie(default=None),
) -> FileResponse:
    session_id = ensure_session(hub_session_id)
    try:
        _ensure_lab_access(session_id)
        path = get_lab_evidence_file(record_id, stored_name)
        media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        return FileResponse(path=str(path), media_type=media_type, filename=Path(stored_name).name)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible descargar la evidencia: {exc}") from exc
