from functools import lru_cache

from db import get_db_connection


AUTH_SELECT_COLUMNS = (
    "auth_status",
    "cipher_token",
    "token_nonce",
    "token_kek_version",
    "token_fingerprint",
    "token_expires_at",
    "last_login_at",
    "last_revalidation_at",
    "last_used_at",
)

TOKEN_STORAGE_COLUMNS = (
    "cipher_token",
    "token_nonce",
    "token_kek_version",
    "token_fingerprint",
)


@lru_cache(maxsize=1)
def get_hub_user_auth_columns() -> frozenset[str]:
    query = """
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'hub_user_auth'
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)
            return frozenset(row["COLUMN_NAME"] for row in cursor.fetchall())


def has_hub_user_auth_column(column_name: str) -> bool:
    return column_name in get_hub_user_auth_columns()


def build_auth_select_fragment(alias: str = "a", indent: str = "            ") -> str:
    expressions = []
    for column_name in AUTH_SELECT_COLUMNS:
        if has_hub_user_auth_column(column_name):
            expressions.append(f"{indent}{alias}.{column_name}")
        else:
            expressions.append(f"{indent}NULL AS {column_name}")
    return ",\n".join(expressions)


def ensure_token_storage_supported() -> None:
    missing = [column_name for column_name in TOKEN_STORAGE_COLUMNS if not has_hub_user_auth_column(column_name)]
    if missing:
        joined = ", ".join(missing)
        raise RuntimeError(
            "La tabla hub_user_auth no tiene las columnas requeridas para guardar tokens cifrados: "
            f"{joined}."
        )


def build_touch_query(column_name: str) -> str | None:
    if not has_hub_user_auth_column(column_name):
        return None
    return f"""
        UPDATE hub_user_auth
        SET {column_name} = %s
        WHERE user_id = %s
    """
