from typing import Any

from fastapi import APIRouter, Cookie, HTTPException

from api.deps import ensure_module_access, ensure_session, model_to_dict, raise_auth_error
from modules.auth.service import AuthenticationError
from modules.checklists.service import create_checklist, list_checklists_payload, update_checklist
from schemas.checklists import ChecklistSaveRequest


router = APIRouter(prefix="/v1/checklists", tags=["checklists"])


@router.get("")
def checklists_list(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_module_access(session_id, "checklists")
        return list_checklists_payload()
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar los checklists: {exc}") from exc


@router.post("")
def checklists_create(
    payload: ChecklistSaveRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_module_access(session_id, "checklists", write=True)
        return {"item": create_checklist(model_to_dict(payload))}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible crear el checklist: {exc}") from exc


@router.put("/{template_id}")
def checklists_update(
    template_id: int,
    payload: ChecklistSaveRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_module_access(session_id, "checklists", write=True)
        return {"item": update_checklist(template_id, model_to_dict(payload))}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible actualizar el checklist: {exc}") from exc
