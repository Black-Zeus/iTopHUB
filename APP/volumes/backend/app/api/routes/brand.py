from typing import Any

from fastapi import APIRouter, Cookie, HTTPException

from api.deps import ensure_session, raise_auth_error
from modules.auth.service import AuthenticationError
from modules.settings.service import get_organization_brand

router = APIRouter(prefix="/v1/brand", tags=["brand"])


@router.get("")
def brand_get(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    try:
        ensure_session(hub_session_id)
        return get_organization_brand()
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible cargar el branding: {exc}") from exc
