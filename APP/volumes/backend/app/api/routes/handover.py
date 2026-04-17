import mimetypes
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Cookie, HTTPException
from fastapi.responses import FileResponse

from api.deps import ensure_module_access, ensure_session, model_to_dict, raise_auth_error
from modules.auth.service import AuthenticationError, get_runtime_token
from modules.handover.service import (
    HANDOVER_EVIDENCE_ROOT,
    GENERATED_DOCUMENT_KINDS,
    attach_handover_document_evidence,
    create_handover_document,
    emit_handover_document,
    get_handover_bootstrap,
    get_handover_document_detail,
    list_handover_documents,
    rollback_handover_document,
    update_handover_document,
)
from modules.handover.pdf_pipeline import HANDOVER_DOCUMENT_ROOT
from schemas.handover import HandoverEvidenceUploadRequest, HandoverSaveRequest


router = APIRouter(prefix="/v1/handover", tags=["handover"])


@router.get("/bootstrap")
def handover_bootstrap(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_module_access(session_id, "handover")
        runtime_token = get_runtime_token(session_id)
        return get_handover_bootstrap(session_user, runtime_token)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar el modulo de entrega: {exc}") from exc


@router.get("/documents")
def handover_documents_list(
    q: str = "",
    status: str = "",
    handover_type: str = "",
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_module_access(session_id, "handover")
        return list_handover_documents(q, status, handover_type)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar las actas de entrega: {exc}") from exc


@router.get("/documents/{document_id}")
def handover_document_detail(
    document_id: int,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_module_access(session_id, "handover")
        return {"item": get_handover_document_detail(document_id)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar el detalle del acta: {exc}") from exc


@router.post("/documents")
def handover_document_create(
    payload: HandoverSaveRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_module_access(session_id, "handover", write=True)
        return {"item": create_handover_document(model_to_dict(payload), session_user)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible crear el acta de entrega: {exc}") from exc


@router.put("/documents/{document_id}")
def handover_document_update(
    document_id: int,
    payload: HandoverSaveRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_module_access(session_id, "handover", write=True)
        return {"item": update_handover_document(document_id, model_to_dict(payload), session_user)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible actualizar el acta de entrega: {exc}") from exc


@router.post("/documents/{document_id}/emit")
def handover_document_emit(
    document_id: int,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_module_access(session_id, "handover", write=True)
        return {"item": emit_handover_document(document_id, session_user)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible emitir el acta de entrega: {exc}") from exc


@router.post("/documents/{document_id}/rollback")
def handover_document_rollback(
    document_id: int,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_module_access(session_id, "handover", write=True)
        return {"item": rollback_handover_document(document_id, session_user)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cancelar la emision del acta: {exc}") from exc


@router.post("/documents/{document_id}/evidence")
def handover_document_attach_evidence(
    document_id: int,
    payload: HandoverEvidenceUploadRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_module_access(session_id, "handover", write=True)
        normalized_files = [
            {
                "name": item.name,
                "mimeType": item.mimeType,
                "contentBase64": item.contentBase64,
                "observation": item.observation,
            }
            for item in payload.files
        ]
        return {"item": attach_handover_document_evidence(document_id, normalized_files, session_user)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar la evidencia del acta: {exc}") from exc


@router.get("/documents/{document_id}/evidence/{stored_name}")
def handover_document_evidence_download(
    document_id: int,
    stored_name: str,
    hub_session_id: str | None = Cookie(default=None),
) -> FileResponse:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_module_access(session_id, "handover")
    except AuthenticationError as exc:
        raise_auth_error(exc)

    safe_name = Path(stored_name).name
    file_path = HANDOVER_EVIDENCE_ROOT / f"document_{document_id}" / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Adjunto no encontrado.")

    media_type, _ = mimetypes.guess_type(safe_name)
    return FileResponse(
        path=str(file_path),
        filename=safe_name,
        media_type=media_type or "application/octet-stream",
    )


@router.get("/documents/{document_id}/pdf/{document_kind}")
def handover_document_pdf_download(
    document_id: int,
    document_kind: str,
    hub_session_id: str | None = Cookie(default=None),
) -> FileResponse:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_module_access(session_id, "handover")
    except AuthenticationError as exc:
        raise_auth_error(exc)

    normalized_kind = Path(document_kind).name.lower()
    if normalized_kind not in GENERATED_DOCUMENT_KINDS:
        raise HTTPException(status_code=404, detail="Tipo de PDF no encontrado.")

    document = get_handover_document_detail(document_id)
    metadata = next(
        (item for item in document.get("generatedDocuments") or [] if item.get("kind") == normalized_kind),
        None,
    )
    if metadata is None:
        raise HTTPException(status_code=404, detail="PDF no generado para esta acta.")

    safe_name = Path(metadata.get("storedName") or metadata.get("name") or "").name
    if not safe_name:
        raise HTTPException(status_code=404, detail="PDF no encontrado.")

    file_path = HANDOVER_DOCUMENT_ROOT / f"document_{document_id}" / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF no encontrado.")

    return FileResponse(
        path=str(file_path),
        filename=safe_name,
        media_type="application/pdf",
    )
