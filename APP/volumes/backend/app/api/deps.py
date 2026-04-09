from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel

from modules.auth.service import AuthenticationError, get_session_user


def model_to_dict(model: BaseModel) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def raise_auth_error(exc: AuthenticationError) -> None:
    raise HTTPException(status_code=exc.status_code, detail={"message": exc.message, "code": exc.code}) from exc


def ensure_session(hub_session_id: str | None) -> str:
    if not hub_session_id:
        raise HTTPException(
            status_code=401,
            detail={"message": "Sesion inexistente.", "code": "SESSION_EXPIRED"},
        )
    return hub_session_id


def ensure_settings_access(session_id: str, write: bool = False) -> dict[str, Any]:
    session_user = get_session_user(session_id)
    permission_key = "writeModules" if write else "viewModules"
    allowed_modules = session_user.get("permissions", {}).get(permission_key, [])
    if "settings" not in allowed_modules:
        raise HTTPException(status_code=403, detail="Sin permisos para el modulo Configuracion.")
    return session_user


def ensure_module_access(session_id: str, module_code: str, write: bool = False) -> dict[str, Any]:
    session_user = get_session_user(session_id)
    permission_key = "writeModules" if write else "viewModules"
    allowed_modules = session_user.get("permissions", {}).get(permission_key, [])
    if module_code not in allowed_modules:
        raise HTTPException(status_code=403, detail=f"Sin permisos para el modulo {module_code}.")
    return session_user


def build_itop_api_url(integration_url: str) -> str:
    base = str(integration_url or "").strip().rstrip("/")
    return f"{base}/webservices/rest.php" if base else ""
