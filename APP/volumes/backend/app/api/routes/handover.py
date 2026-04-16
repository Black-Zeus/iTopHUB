from typing import Any

from fastapi import APIRouter, Cookie, HTTPException

from api.deps import ensure_module_access, ensure_session, model_to_dict, raise_auth_error
from modules.auth.service import AuthenticationError, get_runtime_token
from modules.handover.service import (
    attach_handover_document_evidence,
    create_handover_document,
    emit_handover_document,
    get_handover_bootstrap,
    get_handover_document_detail,
    list_handover_documents,
    rollback_handover_document,
    update_handover_document,
)
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
