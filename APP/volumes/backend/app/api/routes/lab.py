import mimetypes
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Cookie, HTTPException, Query
from fastapi.responses import FileResponse

from api.deps import ensure_module_access, ensure_session, model_to_dict, raise_auth_error
from modules.auth.service import AuthenticationError
from modules.auth.service import get_runtime_token
from modules.lab.service import (
    create_lab_signature_session,
    create_lab_record,
    finalize_lab_closure,
    generate_lab_document,
    get_lab_bootstrap,
    get_lab_document_file,
    get_lab_evidence_file,
    get_lab_record_detail,
    get_lab_signature_session,
    get_public_lab_signature_document,
    get_public_lab_signature_session,
    list_lab_records,
    rollback_lab_phase,
    submit_public_lab_signature,
    update_lab_record,
    upload_lab_evidences,
)
from modules.handover.service import get_public_signature_branding
from schemas.lab import (
    LabEvidenceUploadRequest,
    LabRecordCreateRequest,
    LabRecordUpdateRequest,
    LabSignatureSubmitRequest,
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


@router.post("/records/{record_id}/rollback/{phase}")
def lab_record_rollback(
    record_id: int,
    phase: str,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        _ensure_lab_access(session_id, write=True)
        return {"item": rollback_lab_phase(record_id, phase)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible revertir la fase: {exc}") from exc


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


@router.post("/records/{record_id}/signature-session")
def lab_signature_session_create(
    record_id: int,
    force_new: bool = Query(default=False),
    phase: str = Query(default=""),
    workflow_kind: str = Query(default=""),
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = _ensure_lab_access(session_id, write=True)
        return {"item": create_lab_signature_session(record_id, session_user, phase=phase, workflow_kind=workflow_kind, force_new=force_new)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible abrir la sesión QR de firma: {exc}") from exc


@router.get("/records/{record_id}/signature-session")
def lab_signature_session_detail(
    record_id: int,
    phase: str = Query(default=""),
    workflow_kind: str = Query(default=""),
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        _ensure_lab_access(session_id)
        return {"item": get_lab_signature_session(record_id, phase=phase, workflow_kind=workflow_kind)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible consultar la sesión QR de firma: {exc}") from exc


@router.post("/records/{record_id}/finalize-closure")
def lab_finalize_closure(
    record_id: int,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = _ensure_lab_access(session_id, write=True)
        runtime_token = get_runtime_token(session_id)
        return {"item": finalize_lab_closure(record_id, session_user, runtime_token)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible finalizar el cierre del acta: {exc}") from exc


@router.get("/signature-sessions/{signature_token}")
def lab_public_signature_session_detail(
    signature_token: str,
    claim_token: str = Query(default=""),
) -> dict[str, Any]:
    try:
        return {
            "item": get_public_lab_signature_session(
                signature_token,
                claim_token=claim_token,
            )
        }
    except HTTPException as exc:
        raw_detail = exc.detail
        message = raw_detail if isinstance(raw_detail, str) else (raw_detail.get("message") if isinstance(raw_detail, dict) else str(raw_detail))
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": message, "brand": get_public_signature_branding()},
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar la sesión pública de firma: {exc}") from exc


@router.post("/signature-sessions/{signature_token}/submit")
def lab_public_signature_session_submit(
    signature_token: str,
    payload: LabSignatureSubmitRequest,
) -> dict[str, Any]:
    try:
        return {
            "item": submit_public_lab_signature(
                signature_token,
                signature_data_url=payload.signatureDataUrl,
                signer_name=payload.signerName,
                signer_role=payload.signerRole,
                observation=payload.observation,
                claim_token=payload.claimToken,
            )
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible registrar la firma digital: {exc}") from exc


@router.get("/signature-sessions/{signature_token}/documents/{document_kind}")
def lab_public_signature_document_download(
    signature_token: str,
    document_kind: str,
    claim_token: str = Query(default=""),
) -> FileResponse:
    try:
        file_path, safe_name = get_public_lab_signature_document(
            signature_token,
            document_kind,
            claim_token=claim_token,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible descargar el documento de firma: {exc}") from exc

    media_type, _ = mimetypes.guess_type(file_path.name)
    return FileResponse(
        path=str(file_path),
        filename=safe_name,
        media_type=media_type or "application/pdf",
    )
