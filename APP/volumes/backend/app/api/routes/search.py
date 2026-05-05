from typing import Any

from fastapi import APIRouter, Cookie, HTTPException, Query

from api.deps import ensure_session, raise_auth_error
from modules.auth.service import AuthenticationError, get_session_user
from modules.global_search.service import search_hub


router = APIRouter(prefix="/v1/search", tags=["search"])


@router.get("")
def global_search(
    q: str = Query(default="", min_length=0),
    limit: int = Query(default=50, ge=1, le=100),
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = get_session_user(session_id)
        return search_hub(q, session_user, limit)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible ejecutar la busqueda global: {exc}") from exc
