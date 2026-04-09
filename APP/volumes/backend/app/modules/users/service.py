import os
from typing import Any

from infrastructure.crypto_service import decrypt_token, encrypt_token, mask_token_from_fingerprint
from infrastructure.db import get_db_connection
from integrations.itop_cmdb_connector import iTopCMDBConnector
from modules.auth.repository import upsert_user_token
from modules.auth.schema import build_auth_select_fragment, ensure_token_storage_supported


AREA_BY_ROLE = {
    "administrator": "Administracion",
    "support_general": "Mesa de Ayuda",
    "support_lab": "Laboratorio",
    "support_field": "Terreno",
    "viewer": "Consulta",
}

STATUS_LABELS = {
    "active": "Activo",
    "inactive": "Inactivo",
    "blocked": "Bloqueado",
}


def _read_bool(name: str, default: bool = True) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _read_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _build_user_row(row: dict[str, Any]) -> dict[str, Any]:
    masked = ""
    if row.get("cipher_token") and row.get("token_nonce"):
        try:
            masked = mask_token_from_fingerprint(decrypt_token(row["cipher_token"], row["token_nonce"]))
        except Exception:
            masked = "***token-error***"

    return {
        "id": row["id"],
        "code": f"USR-{int(row['id']):03d}",
        "username": row["username"],
        "person": row["full_name"],
        "asset": row["email"],
        "area": AREA_BY_ROLE.get(row["role_code"], "General"),
        "date": row["updated_at"].strftime("%Y-%m-%d") if row.get("updated_at") else "",
        "status": STATUS_LABELS.get(row["user_status"], row["user_status"]),
        "statusCode": row["user_status"],
        "role": row["role_name"],
        "roleCode": row["role_code"],
        "tokenMasked": masked,
        "hasToken": bool(row.get("cipher_token")) and row.get("auth_status") == "active",
        "isAdmin": bool(row.get("is_admin")),
    }


def list_users() -> list[dict[str, Any]]:
    auth_columns = build_auth_select_fragment("a")
    query = f"""
        SELECT
            u.id,
            u.username,
            u.email,
            u.full_name,
            u.status AS user_status,
            u.updated_at,
            r.code AS role_code,
            r.name AS role_name,
            r.is_admin,
{auth_columns}
        FROM hub_users u
        INNER JOIN hub_roles r ON r.id = u.role_id
        LEFT JOIN hub_user_auth a ON a.user_id = u.id
        ORDER BY u.full_name, u.username
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)
            return [_build_user_row(row) for row in cursor.fetchall()]


def list_roles() -> list[dict[str, Any]]:
    query = """
        SELECT id, code, name, is_admin
        FROM hub_roles
        WHERE status = 'active'
        ORDER BY name
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)
            return [
                {
                    "id": row["id"],
                    "code": row["code"],
                    "name": row["name"],
                    "isAdmin": bool(row["is_admin"]),
                }
                for row in cursor.fetchall()
            ]


def update_user(user_id: int, payload: dict[str, Any]) -> dict[str, Any] | None:
    role_query = "SELECT id FROM hub_roles WHERE code = %s LIMIT 1"
    user_query = """
        UPDATE hub_users
        SET full_name = %s,
            role_id = %s,
            status = %s
        WHERE id = %s
    """
    auth_columns = build_auth_select_fragment("a")
    fetch_query = f"""
        SELECT
            u.id,
            u.username,
            u.email,
            u.full_name,
            u.status AS user_status,
            u.updated_at,
            r.code AS role_code,
            r.name AS role_name,
            r.is_admin,
{auth_columns}
        FROM hub_users u
        INNER JOIN hub_roles r ON r.id = u.role_id
        LEFT JOIN hub_user_auth a ON a.user_id = u.id
        WHERE u.id = %s
        LIMIT 1
    """

    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(role_query, (payload["roleCode"],))
            role_row = cursor.fetchone()
            if not role_row:
                return None

            cursor.execute(
                user_query,
                (payload["fullName"].strip(), role_row["id"], payload["statusCode"], user_id),
            )

            cursor.execute(fetch_query, (user_id,))
            row = cursor.fetchone()

    return _build_user_row(row) if row else None


def create_user(payload: dict[str, Any]) -> dict[str, Any] | None:
    role_query = "SELECT id FROM hub_roles WHERE code = %s LIMIT 1"
    existing_query = "SELECT id FROM hub_users WHERE LOWER(username) = LOWER(%s) LIMIT 1"
    insert_user_query = """
        INSERT INTO hub_users (role_id, username, email, full_name, password_hash, status, itop_person_key)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    insert_auth_query = """
        INSERT INTO hub_user_auth (user_id, auth_status)
        VALUES (%s, %s)
    """
    auth_columns = build_auth_select_fragment("a")
    fetch_query = f"""
        SELECT
            u.id,
            u.username,
            u.email,
            u.full_name,
            u.status AS user_status,
            u.updated_at,
            r.code AS role_code,
            r.name AS role_name,
            r.is_admin,
{auth_columns}
        FROM hub_users u
        INNER JOIN hub_roles r ON r.id = u.role_id
        LEFT JOIN hub_user_auth a ON a.user_id = u.id
        WHERE u.id = %s
        LIMIT 1
    """

    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(role_query, (payload["roleCode"],))
            role_row = cursor.fetchone()
            if not role_row:
                return None

            cursor.execute(existing_query, (payload["username"],))
            if cursor.fetchone():
                raise ValueError("El usuario ya esta vinculado al Hub.")

            username = payload["username"].strip()
            cursor.execute(
                insert_user_query,
                (
                    role_row["id"],
                    username,
                    f"{username}@itophub.local",
                    payload["fullName"].strip() or username,
                    "0" * 64,
                    payload["statusCode"],
                    None,
                ),
            )
            user_id = cursor.lastrowid

            token_value = payload.get("tokenValue", "").strip()
            cursor.execute(insert_auth_query, (user_id, "inactive"))

            if token_value:
                ensure_token_storage_supported()
                encrypted = encrypt_token(token_value)
                upsert_user_token(
                    user_id=user_id,
                    auth_status="active",
                    cipher_token=encrypted.cipher_token,
                    token_nonce=encrypted.token_nonce,
                    token_kek_version=encrypted.token_kek_version,
                    token_fingerprint=encrypted.token_fingerprint,
                )

            cursor.execute(fetch_query, (user_id,))
            row = cursor.fetchone()

    return _build_user_row(row) if row else None


def get_user(user_id: int) -> dict[str, Any] | None:
    auth_columns = build_auth_select_fragment("a")
    query = f"""
        SELECT
            u.id,
            u.username,
            u.email,
            u.full_name,
            u.status AS user_status,
            u.updated_at,
            r.code AS role_code,
            r.name AS role_name,
            r.is_admin,
{auth_columns}
        FROM hub_users u
        INNER JOIN hub_roles r ON r.id = u.role_id
        LEFT JOIN hub_user_auth a ON a.user_id = u.id
        WHERE u.id = %s
        LIMIT 1
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (user_id,))
            row = cursor.fetchone()

    return _build_user_row(row) if row else None


def search_itop_users(query: str, runtime_token: str) -> list[dict[str, Any]]:
    normalized = query.strip()
    if len(normalized) < 2:
        return []

    connector = iTopCMDBConnector(
        base_url=os.getenv("ITOP_URL", ""),
        token=runtime_token,
        username="hub-session-user",
        verify_ssl=_read_bool("ITOP_VERIFY_SSL", True),
        timeout=_read_int("ITOP_TIMEOUT_SECONDS", 30),
    )

    items_by_username: dict[str, dict[str, Any]] = {}
    safe = normalized.replace("\\", "\\\\").replace("'", "\\'")

    try:
        for class_name in ["UserLocal", "UserLDAP", "UserExternal"]:
            try:
                items = connector.oql(
                    f"SELECT {class_name} WHERE login LIKE '%{safe}%'",
                    output_fields="login,status,friendlyname",
                )
            except Exception:
                continue

            for item in items:
                username = str(item.get("login") or item.get("friendlyname") or "").strip()
                if not username:
                    continue
                items_by_username[username.lower()] = {
                    "username": username,
                    "fullName": str(item.get("friendlyname") or username).strip(),
                    "status": str(item.get("status") or "").strip(),
                    "itopClass": item.itop_class,
                }
    finally:
        connector.close()

    return sorted(items_by_username.values(), key=lambda item: item["username"].lower())[:20]
