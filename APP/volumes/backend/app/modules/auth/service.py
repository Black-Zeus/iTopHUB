from dataclasses import dataclass
from typing import Any

from infrastructure.crypto_service import decrypt_token, encrypt_token
from integrations.itop_runtime import get_itop_runtime_config
from infrastructure.session_service import (
    get_active_session,
    get_runtime_token_for_session,
    invalidate_session,
    keep_session_alive,
    refresh_runtime_token,
    start_session,
    update_session_user,
)
from modules.auth.repository import (
    count_hub_users,
    fetch_role_modules,
    fetch_user_by_id,
    fetch_user_by_identity,
    touch_login,
    touch_revalidation,
    upsert_user_token,
)
from integrations.itop_cmdb_connector import iTopCMDBConnector
from modules.settings.service import update_settings_panel


ADMIN_MODULES_WITHOUT_TOKEN = ["settings", "users"]


class AuthenticationError(Exception):
    def __init__(self, message: str, status_code: int = 401, code: str = "AUTH_ERROR") -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


@dataclass
class AuthenticatedSession:
    user: dict[str, Any]
    session_id: str
    session_meta: dict[str, Any]


def _decrypt_user_token(user_row: dict[str, Any]) -> str | None:
    if not user_row.get("cipher_token") or not user_row.get("token_nonce"):
        return None
    return decrypt_token(user_row["cipher_token"], user_row["token_nonce"])


def _get_itop_auth_config(overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    return get_itop_runtime_config(overrides)


def _validate_itop_credentials(username: str, password: str, overrides: dict[str, Any] | None = None) -> bool:
    itop_config = _get_itop_auth_config(overrides)
    try:
        result = iTopCMDBConnector.authenticate(
            base_url=itop_config["integrationUrl"],
            username=username,
            password=password,
            token_store=lambda _username: None,
            verify_ssl=itop_config["verifySsl"],
            timeout=itop_config["timeoutSeconds"],
        )
    except ConnectionError as exc:
        raise AuthenticationError(
            f"No fue posible validar el acceso con iTop: {exc}",
            status_code=503,
            code="ITOP_UNAVAILABLE",
        ) from exc

    return result.authorized


def _validate_personal_token(
    username: str,
    password: str,
    token: str,
    overrides: dict[str, Any] | None = None,
) -> None:
    itop_config = _get_itop_auth_config(overrides)
    try:
        result = iTopCMDBConnector.authenticate(
            base_url=itop_config["integrationUrl"],
            username=username,
            password=password,
            token_store=lambda _username: token,
            verify_ssl=itop_config["verifySsl"],
            timeout=itop_config["timeoutSeconds"],
        )
    except ConnectionError as exc:
        raise AuthenticationError(
            f"No fue posible validar el token con iTop: {exc}",
            status_code=503,
            code="ITOP_UNAVAILABLE",
        ) from exc

    if not result.authorized:
        raise AuthenticationError(
            "Usuario o contrasena incorrectos en iTop.",
            status_code=401,
            code="ITOP_LOGIN_FAILED",
        )
    if not result.has_token or not result.token_valid:
        raise AuthenticationError(
            "El token personal de iTop es invalido o no tiene acceso REST.",
            status_code=403,
            code="ITOP_TOKEN_INVALID",
        )
    if result.connector is not None:
        result.connector.close()


def _escape_oql(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


def _resolve_itop_user_full_name(connector: iTopCMDBConnector | None, username: str) -> str:
    if connector is None:
        return username

    safe_username = _escape_oql(username)
    for class_name in ["UserLocal", "UserLDAP", "UserExternal"]:
        try:
            items = connector.oql(
                f"SELECT {class_name} WHERE login = '{safe_username}'",
                output_fields="friendlyname,contactid_friendlyname,login",
            )
        except Exception:
            continue

        if not items:
            continue

        item = items[0]
        full_name = str(
            item.get("contactid_friendlyname")
            or item.get("friendlyname")
            or item.get("login")
            or username
        ).strip()
        if full_name:
            return full_name

    return username


def _get_token_state(user_row: dict[str, Any], has_runtime_token: bool) -> str:
    if has_runtime_token:
        return "valid"
    if user_row.get("cipher_token") and user_row.get("auth_status") == "active":
        return "stored"
    return "missing"


def _build_user_payload(user_row: dict[str, Any], token_state: str) -> dict[str, Any]:
    view_modules, write_modules = fetch_role_modules(user_row["role_code"])
    access_mode = "full"
    notice = ""

    if token_state == "missing":
        if user_row["is_admin"]:
            access_mode = "admin_limited"
            view_modules = ADMIN_MODULES_WITHOUT_TOKEN.copy()
            write_modules = ADMIN_MODULES_WITHOUT_TOKEN.copy()
            notice = (
                "Tu cuenta inicio sesion en iTop, pero no posee token personal registrado para el Hub. "
                "Debes registrar tu propio token desde el menu Usuarios. Mientras tanto, solo tendras acceso a "
                "Configuracion y Usuarios."
            )
    elif token_state == "invalid":
        if user_row["is_admin"]:
            access_mode = "admin_limited"
            view_modules = ADMIN_MODULES_WITHOUT_TOKEN.copy()
            write_modules = ADMIN_MODULES_WITHOUT_TOKEN.copy()
            notice = (
                "Tu cuenta inicio sesion en iTop, pero el token personal registrado para el Hub es invalido o ya no "
                "posee acceso REST. Debes actualizar tu propio token desde el menu Usuarios. Mientras tanto, solo "
                "tendras acceso a Configuracion y Usuarios."
            )
    return {
        "id": user_row["id"],
        "username": user_row["username"],
        "name": user_row["full_name"],
        "email": user_row["email"],
        "status": user_row["user_status"],
        "role": user_row["role_name"],
        "roleCode": user_row["role_code"],
        "isAdmin": bool(user_row["is_admin"]),
        "hasItopToken": bool(user_row.get("cipher_token")) and user_row.get("auth_status") == "active",
        "hasRuntimeToken": token_state == "valid",
        "itopPersonKey": user_row.get("itop_person_key"),
        "accessMode": access_mode,
        "notice": notice,
        "permissions": {
            "viewModules": view_modules,
            "writeModules": write_modules,
        },
    }


def login_user(username: str, password: str) -> AuthenticatedSession:
    identity = username.strip().lower()
    if not identity or not password:
        raise AuthenticationError("Credenciales incorrectas.", status_code=401, code="ITOP_LOGIN_FAILED")

    user_row = fetch_user_by_identity(identity)
    canonical_username = user_row["username"] if user_row else username.strip()

    if not _validate_itop_credentials(canonical_username, password):
        raise AuthenticationError(
            "Usuario o contrasena incorrectos en iTop.",
            status_code=401,
            code="ITOP_LOGIN_FAILED",
        )

    if not user_row:
        raise AuthenticationError(
            "Usuario autenticado en iTop, pero no habilitado en el Hub.",
            status_code=403,
            code="HUB_USER_NOT_FOUND",
        )

    if user_row["user_status"] != "active":
        raise AuthenticationError("Usuario sin acceso al Hub.", status_code=403, code="HUB_USER_INACTIVE")

    runtime_token = None
    token_state = "missing"
    try:
        decrypted_token = _decrypt_user_token(user_row)
    except Exception as exc:
        if user_row["is_admin"]:
            decrypted_token = None
            token_state = "invalid"
        else:
            raise AuthenticationError(
                "Usuario autenticado en iTop, pero no autorizado para ingresar a iTop-Hub porque su token "
                "personal registrado no pudo ser descifrado. Contacte a su administrador.",
                status_code=403,
                code="ITOP_TOKEN_INVALID",
            ) from exc

    if decrypted_token:
        try:
            _validate_personal_token(user_row["username"], password, decrypted_token)
            runtime_token = decrypted_token
            token_state = "valid"
            touch_revalidation(user_row["id"])
        except AuthenticationError:
            if user_row["is_admin"]:
                token_state = "invalid"
            else:
                raise AuthenticationError(
                    "Usuario autenticado en iTop, pero no autorizado para ingresar a iTop-Hub porque su token "
                    "personal es invalido o ya no posee acceso REST. Contacte a su administrador.",
                    status_code=403,
                    code="ITOP_TOKEN_INVALID",
                )
    else:
        if not user_row["is_admin"]:
            raise AuthenticationError(
                "Usuario autenticado en iTop, pero no autorizado para ingresar a iTop-Hub porque no tiene token "
                "personal registrado. Contacte a su administrador.",
                status_code=403,
                code="ITOP_TOKEN_MISSING",
            )

    user = _build_user_payload(user_row, token_state)
    session_id, session_meta = start_session(user, runtime_token)
    touch_login(user_row["id"])
    return AuthenticatedSession(user=user, session_id=session_id, session_meta=session_meta)


def get_bootstrap_status() -> dict[str, Any]:
    setup_required = count_hub_users() == 0
    itop_config = _get_itop_auth_config() if setup_required else _get_itop_auth_config({})
    return {
        "setupRequired": setup_required,
        "config": {
            "integrationUrl": itop_config["integrationUrl"] if setup_required else "",
            "verifySsl": itop_config["verifySsl"],
            "timeoutSeconds": itop_config["timeoutSeconds"],
        },
    }


def bootstrap_first_admin(
    integration_url: str,
    username: str,
    password: str,
    token: str,
    verify_ssl: bool = True,
    timeout_seconds: int = 30,
) -> AuthenticatedSession:
    if count_hub_users() > 0:
        raise AuthenticationError(
            "El bootstrap inicial ya no esta disponible porque el Hub ya posee usuarios.",
            status_code=409,
            code="BOOTSTRAP_NOT_AVAILABLE",
        )

    normalized_username = username.strip()
    normalized_password = password or ""
    normalized_token = token.strip()
    bootstrap_config = _get_itop_auth_config(
        {
            "integrationUrl": integration_url,
            "verifySsl": verify_ssl,
            "timeoutSeconds": timeout_seconds,
        }
    )

    if not bootstrap_config["integrationUrl"]:
        raise AuthenticationError(
            "La URL base de iTop es obligatoria para el bootstrap inicial.",
            status_code=422,
            code="BOOTSTRAP_INVALID_CONFIG",
        )
    if not normalized_username:
        raise AuthenticationError(
            "El usuario administrador de iTop es obligatorio.",
            status_code=422,
            code="BOOTSTRAP_INVALID_CONFIG",
        )
    if not normalized_password:
        raise AuthenticationError(
            "La contrasena del usuario administrador de iTop es obligatoria.",
            status_code=422,
            code="BOOTSTRAP_INVALID_CONFIG",
        )
    if not normalized_token:
        raise AuthenticationError(
            "El token personal del administrador es obligatorio.",
            status_code=422,
            code="BOOTSTRAP_INVALID_CONFIG",
        )

    try:
        result = iTopCMDBConnector.authenticate(
            base_url=bootstrap_config["integrationUrl"],
            username=normalized_username,
            password=normalized_password,
            token_store=lambda _username: normalized_token,
            verify_ssl=bootstrap_config["verifySsl"],
            timeout=bootstrap_config["timeoutSeconds"],
        )
    except ConnectionError as exc:
        raise AuthenticationError(
            f"No fue posible completar el bootstrap inicial contra iTop: {exc}",
            status_code=503,
            code="ITOP_UNAVAILABLE",
        ) from exc

    if not result.authorized:
        raise AuthenticationError(
            "Usuario o contrasena incorrectos en iTop.",
            status_code=401,
            code="ITOP_LOGIN_FAILED",
        )
    if not result.has_token or not result.token_valid:
        raise AuthenticationError(
            "El token personal de iTop es invalido o no tiene acceso REST.",
            status_code=403,
            code="ITOP_TOKEN_INVALID",
        )

    try:
        if count_hub_users() > 0:
            raise AuthenticationError(
                "El bootstrap inicial ya no esta disponible porque otro usuario ya fue creado.",
                status_code=409,
                code="BOOTSTRAP_NOT_AVAILABLE",
            )

        if fetch_user_by_identity(normalized_username):
            raise AuthenticationError(
                "El usuario administrador ya existe en el Hub.",
                status_code=409,
                code="HUB_USER_ALREADY_EXISTS",
            )

        full_name = _resolve_itop_user_full_name(result.connector, normalized_username)
        update_settings_panel("itop", bootstrap_config)

        from modules.users.service import create_user

        created_user = create_user(
            {
                "username": normalized_username,
                "fullName": full_name or normalized_username,
                "roleCode": "administrator",
                "statusCode": "active",
                "tokenValue": normalized_token,
            }
        )
        if not created_user:
            raise AuthenticationError(
                "No fue posible crear el primer administrador porque el rol base del Hub no esta disponible.",
                status_code=500,
                code="BOOTSTRAP_ROLE_MISSING",
            )
    finally:
        if result.connector is not None:
            result.connector.close()

    return login_user(normalized_username, normalized_password)


def get_session_user(session_id: str) -> dict[str, Any]:
    meta = get_active_session(session_id)
    if not meta:
        raise AuthenticationError("Sesion expirada o inexistente.", status_code=401, code="SESSION_EXPIRED")
    return meta["user"]


def refresh_session(session_id: str) -> dict[str, Any]:
    meta = get_active_session(session_id)
    if not meta:
        raise AuthenticationError("Sesion expirada o inexistente.", status_code=401, code="SESSION_EXPIRED")

    user_row = fetch_user_by_id(meta["user"]["id"])
    if not user_row or user_row["user_status"] != "active":
        invalidate_session(session_id)
        raise AuthenticationError("Usuario sin acceso al Hub.", status_code=403, code="HUB_USER_INACTIVE")

    token_state = _get_token_state(user_row, bool(meta["user"].get("hasRuntimeToken")))
    user = _build_user_payload(user_row, token_state)
    return update_session_user(session_id, meta, user)


def keep_alive_session(session_id: str) -> dict[str, Any]:
    meta = get_active_session(session_id)
    if not meta:
        raise AuthenticationError("Sesion expirada o inexistente.", status_code=401, code="SESSION_EXPIRED")
    return keep_session_alive(session_id, meta)


def revalidate_user(session_id: str, password: str) -> dict[str, Any]:
    meta = get_active_session(session_id)
    if not meta:
        raise AuthenticationError("Sesion expirada o inexistente.", status_code=401, code="SESSION_EXPIRED")

    user_row = fetch_user_by_id(meta["user"]["id"])
    if not user_row or user_row["user_status"] != "active":
        invalidate_session(session_id)
        raise AuthenticationError("Usuario sin acceso al Hub.", status_code=403, code="HUB_USER_INACTIVE")

    try:
        decrypted_token = _decrypt_user_token(user_row)
    except Exception as exc:
        raise AuthenticationError(
            "El token personal registrado no pudo ser descifrado. Debe volver a registrarse.",
            status_code=403,
            code="ITOP_TOKEN_INVALID",
        ) from exc

    if not decrypted_token:
        raise AuthenticationError(
            "No existe token personal registrado para este usuario.",
            status_code=403,
            code="ITOP_TOKEN_MISSING",
        )

    _validate_personal_token(user_row["username"], password, decrypted_token)
    updated_meta = refresh_runtime_token(session_id, decrypted_token, meta)
    touch_revalidation(user_row["id"])
    user = _build_user_payload(user_row, "valid")
    return update_session_user(session_id, updated_meta, user)


def get_runtime_token(session_id: str) -> str:
    meta = get_active_session(session_id)
    if not meta:
        raise AuthenticationError("Sesion expirada o inexistente.", status_code=401, code="SESSION_EXPIRED")

    token, revalidation_required, updated_meta = get_runtime_token_for_session(
        session_id=session_id,
        user_id=meta["user"]["id"],
        meta=meta,
    )
    if updated_meta:
        meta = updated_meta

    if token:
        return token
    if revalidation_required:
        raise AuthenticationError(
            "Se requiere confirmar tu contrasena para reactivar el token personal de iTop en esta sesion.",
            status_code=428,
            code="TOKEN_REVALIDATION_REQUIRED",
        )
    raise AuthenticationError(
        "No existe token personal disponible para esta sesion.",
        status_code=428,
        code="TOKEN_REVALIDATION_REQUIRED",
    )


def register_user_token(user_id: int, raw_token: str, session_id: str | None = None) -> dict[str, Any]:
    user_row = fetch_user_by_id(user_id)
    if not user_row:
        raise AuthenticationError("Usuario no encontrado en el Hub.", status_code=404, code="HUB_USER_NOT_FOUND")

    token_value = raw_token.strip()
    if token_value:
        encrypted = encrypt_token(token_value)
        upsert_user_token(
            user_id=user_id,
            auth_status="active",
            cipher_token=encrypted.cipher_token,
            token_nonce=encrypted.token_nonce,
            token_kek_version=encrypted.token_kek_version,
            token_fingerprint=encrypted.token_fingerprint,
        )
    else:
        upsert_user_token(
            user_id=user_id,
            auth_status="inactive",
            cipher_token=None,
            token_nonce=None,
            token_kek_version=None,
            token_fingerprint=None,
        )
        if session_id:
            invalidate_session(session_id)

    refreshed = fetch_user_by_id(user_id)
    token_state = _get_token_state(refreshed, has_runtime_token=False)
    user = _build_user_payload(refreshed, token_state)

    if session_id:
        meta = get_active_session(session_id)
        if meta and meta["user"]["id"] == user_id:
            update_session_user(session_id, meta, user)

    return user


def logout_user(session_id: str) -> None:
    invalidate_session(session_id)
