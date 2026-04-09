from typing import Any

from fastapi import APIRouter, Cookie, HTTPException

from api.deps import ensure_module_access, ensure_session, raise_auth_error
from modules.auth.service import AuthenticationError, get_runtime_token
from modules.people.service import get_itop_person_detail, search_itop_people


router = APIRouter(prefix="/v1/people", tags=["people"])


@router.get("/itop/search")
def people_itop_search(
    q: str = "",
    status: str = "",
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_module_access(session_id, "people")
        runtime_token = get_runtime_token(session_id)
        return {
            "items": search_itop_people(q, runtime_token, status=status),
            "sessionUser": session_user["username"],
        }
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to search iTop people: {exc}") from exc


@router.get("/{person_id}")
def people_detail(person_id: int, hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_module_access(session_id, "people")
        runtime_token = get_runtime_token(session_id)
        return {"item": get_itop_person_detail(person_id, runtime_token)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load iTop person detail: {exc}") from exc
