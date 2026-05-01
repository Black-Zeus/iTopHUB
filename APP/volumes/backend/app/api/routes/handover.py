import mimetypes
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Cookie, HTTPException, Query, Request
from fastapi.responses import FileResponse

from api.deps import ensure_any_module_access, ensure_session, model_to_dict, raise_auth_error
from modules.auth.service import AuthenticationError, get_runtime_token
from modules.handover.service import (
    attach_handover_document_evidence,
    create_handover_signature_session,
    create_handover_document,
    emit_handover_document,
    get_handover_signature_session,
    get_handover_bootstrap,
    get_handover_document_detail,
    get_public_handover_signature_document,
    get_public_handover_signature_session,
    get_public_signature_branding,
    list_handover_documents,
    publish_signed_handover_document,
    rollback_handover_document,
    submit_public_handover_signature,
    update_handover_document,
)
from modules.handover.shared import GENERATED_DOCUMENT_KINDS
from modules.handover.storage_paths import resolve_existing_handover_storage_file
from schemas.handover import (
    HandoverEvidenceUploadRequest,
    HandoverSaveRequest,
    HandoverSignatureSubmitRequest,
    HandoverSignedPublicationRequest,
)


router = APIRouter(prefix="/v1/handover", tags=["handover"])


def _ensure_handover_family_access(session_id: str, *, write: bool = False) -> dict[str, Any]:
    return ensure_any_module_access(session_id, ("handover", "reassignment"), write=write)


@router.get("/bootstrap")
def handover_bootstrap(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = _ensure_handover_family_access(session_id)
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
        _ensure_handover_family_access(session_id)
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
        _ensure_handover_family_access(session_id)
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
        session_user = _ensure_handover_family_access(session_id, write=True)
        runtime_token = get_runtime_token(session_id)
        return {"item": create_handover_document(model_to_dict(payload), session_user, runtime_token=runtime_token)}
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
        session_user = _ensure_handover_family_access(session_id, write=True)
        runtime_token = get_runtime_token(session_id)
        return {"item": update_handover_document(document_id, model_to_dict(payload), session_user, runtime_token=runtime_token)}
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
        session_user = _ensure_handover_family_access(session_id, write=True)
        get_runtime_token(session_id)
        return {"item": emit_handover_document(document_id, session_user, session_id)}
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
        session_user = _ensure_handover_family_access(session_id, write=True)
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
        session_user = _ensure_handover_family_access(session_id, write=True)
        runtime_token = get_runtime_token(session_id)
        normalized_files = [
            {
                "name": item.name,
                "mimeType": item.mimeType,
                "contentBase64": item.contentBase64,
                "documentType": item.documentType,
            }
            for item in payload.files
        ]
        return {"item": attach_handover_document_evidence(document_id, normalized_files, session_user, runtime_token, payload.ticket)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar la evidencia del acta: {exc}") from exc


@router.post("/documents/{document_id}/signature-session")
def handover_document_signature_session_create(
    document_id: int,
    force_new: bool = Query(default=False),
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = _ensure_handover_family_access(session_id, write=True)
        return {"item": create_handover_signature_session(document_id, session_user, force_new=force_new)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible abrir la sesión QR de firma: {exc}") from exc


@router.get("/documents/{document_id}/signature-session")
def handover_document_signature_session_detail(
    document_id: int,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        _ensure_handover_family_access(session_id)
        return {"item": get_handover_signature_session(document_id)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible consultar la sesión QR de firma: {exc}") from exc


@router.post("/documents/{document_id}/publish-signed")
def handover_document_publish_signed(
    document_id: int,
    payload: HandoverSignedPublicationRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        _ensure_handover_family_access(session_id, write=True)
        runtime_token = get_runtime_token(session_id)
        return {"item": publish_signed_handover_document(document_id, runtime_token=runtime_token, ticket_payload=payload.ticket)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible publicar el ticket del acta firmada: {exc}") from exc


@router.get("/signature-sessions/{signature_token}")
def handover_public_signature_session_detail(
    signature_token: str,
    request: Request,
    claim_token: str = Query(default=""),
) -> dict[str, Any]:
    try:
        return {
            "item": get_public_handover_signature_session(
                signature_token,
                claim_token=claim_token,
                client_ip=request.client.host if request.client else "",
                user_agent=request.headers.get("user-agent", ""),
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
def handover_public_signature_session_submit(
    signature_token: str,
    payload: HandoverSignatureSubmitRequest,
    request: Request,
) -> dict[str, Any]:
    try:
        return {
            "item": submit_public_handover_signature(
                signature_token,
                signature_data_url=payload.signatureDataUrl,
                signer_name=payload.signerName,
                signer_role=payload.signerRole,
                observation=payload.observation,
                claim_token=payload.claimToken,
                client_ip=request.client.host if request.client else "",
                user_agent=request.headers.get("user-agent", ""),
                device_context=payload.deviceContext,
            )
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible registrar la firma digital: {exc}") from exc


@router.get("/signature-sessions/{signature_token}/documents/{document_kind}")
def handover_public_signature_session_document_download(
    signature_token: str,
    document_kind: str,
    claim_token: str = Query(default=""),
) -> FileResponse:
    try:
        file_path, safe_name = get_public_handover_signature_document(
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


@router.get("/documents/{document_id}/evidence/{stored_name}")
def handover_document_evidence_download(
    document_id: int,
    stored_name: str,
    hub_session_id: str | None = Cookie(default=None),
) -> FileResponse:
    session_id = ensure_session(hub_session_id)
    try:
        _ensure_handover_family_access(session_id)
    except AuthenticationError as exc:
        raise_auth_error(exc)

    document = get_handover_document_detail(document_id)
    file_path = resolve_existing_handover_storage_file(
        "evidence",
        document_id,
        stored_name,
        handover_type=document.get("handoverTypeCode") or document.get("handoverType"),
        include_legacy=True,
    )
    if file_path is None:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado.")

    media_type, _ = mimetypes.guess_type(file_path.name)
    return FileResponse(
        path=str(file_path),
        filename=file_path.name,
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
        _ensure_handover_family_access(session_id)
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

    file_path = resolve_existing_handover_storage_file(
        "documents",
        document_id,
        safe_name,
        handover_type=document.get("handoverTypeCode") or document.get("handoverType"),
        include_legacy=True,
    )
    if file_path is None:
        raise HTTPException(status_code=404, detail="PDF no encontrado.")

    return FileResponse(
        path=str(file_path),
        filename=safe_name,
        media_type="application/pdf",
    )
