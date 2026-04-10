from datetime import datetime
from typing import Any

from infrastructure.db import get_db_connection
from modules.auth.schema import build_auth_select_fragment, build_touch_query, ensure_token_storage_supported


def count_hub_users() -> int:
    query = "SELECT COUNT(*) AS total FROM hub_users"
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)
            row = cursor.fetchone() or {}
    return int(row.get("total") or 0)


def fetch_user_by_identity(identity: str) -> dict[str, Any] | None:
    auth_columns = build_auth_select_fragment("a")
    query = f"""
        SELECT
            u.id,
            u.username,
            u.email,
            u.full_name,
            u.status AS user_status,
            u.itop_person_key,
            r.code AS role_code,
            r.name AS role_name,
            r.is_admin,
{auth_columns}
        FROM hub_users u
        INNER JOIN hub_roles r ON r.id = u.role_id
        LEFT JOIN hub_user_auth a ON a.user_id = u.id
        WHERE LOWER(u.username) = LOWER(%s) OR LOWER(u.email) = LOWER(%s)
        LIMIT 1
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (identity, identity))
            return cursor.fetchone()


def fetch_user_by_id(user_id: int) -> dict[str, Any] | None:
    auth_columns = build_auth_select_fragment("a")
    query = f"""
        SELECT
            u.id,
            u.username,
            u.email,
            u.full_name,
            u.status AS user_status,
            u.itop_person_key,
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
            return cursor.fetchone()


def fetch_role_modules(role_code: str) -> tuple[list[str], list[str]]:
    query = """
        SELECT rm.module_code, rm.can_view, rm.can_write
        FROM hub_role_modules rm
        INNER JOIN hub_roles r ON r.id = rm.role_id
        WHERE r.code = %s
        ORDER BY rm.module_code
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (role_code,))
            rows = cursor.fetchall()
    return (
        [row["module_code"] for row in rows if row["can_view"]],
        [row["module_code"] for row in rows if row["can_write"]],
    )


def upsert_user_token(
    user_id: int,
    auth_status: str,
    cipher_token: bytes | None,
    token_nonce: bytes | None,
    token_kek_version: str | None,
    token_fingerprint: str | None,
) -> None:
    ensure_token_storage_supported()
    now = datetime.utcnow()
    query = """
        INSERT INTO hub_user_auth (
            user_id,
            auth_status,
            cipher_token,
            token_nonce,
            token_kek_version,
            token_fingerprint,
            last_revalidation_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            auth_status = VALUES(auth_status),
            cipher_token = VALUES(cipher_token),
            token_nonce = VALUES(token_nonce),
            token_kek_version = VALUES(token_kek_version),
            token_fingerprint = VALUES(token_fingerprint),
            last_revalidation_at = VALUES(last_revalidation_at)
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (user_id, auth_status, cipher_token, token_nonce, token_kek_version, token_fingerprint, now))


def touch_login(user_id: int) -> None:
    now = datetime.utcnow()
    query = build_touch_query("last_login_at")
    if not query:
        return
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (now, user_id))


def touch_revalidation(user_id: int) -> None:
    now = datetime.utcnow()
    query = build_touch_query("last_revalidation_at")
    if not query:
        return
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (now, user_id))


def touch_last_used(user_id: int) -> None:
    now = datetime.utcnow()
    query = build_touch_query("last_used_at")
    if not query:
        return
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (now, user_id))
