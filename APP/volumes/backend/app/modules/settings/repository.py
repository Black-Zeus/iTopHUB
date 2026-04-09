import json
from typing import Any

from infrastructure.db import get_db_connection


def fetch_settings_panels() -> dict[str, dict[str, Any]]:
    query = """
        SELECT panel_code, config_json
        FROM hub_settings_panels
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)
            rows = cursor.fetchall()

    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        raw_config = row.get("config_json") or "{}"
        try:
            result[row["panel_code"]] = json.loads(raw_config)
        except json.JSONDecodeError:
            result[row["panel_code"]] = {}
    return result


def upsert_settings_panel(panel_code: str, config: dict[str, Any]) -> None:
    payload = json.dumps(config, ensure_ascii=True)
    query = """
        INSERT INTO hub_settings_panels (panel_code, config_json)
        VALUES (%s, %s)
        ON DUPLICATE KEY UPDATE
            config_json = VALUES(config_json)
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (panel_code, payload))


def fetch_sync_tasks() -> list[dict[str, Any]]:
    query = """
        SELECT
            id,
            schedule_expression,
            description,
            task_type,
            command_source,
            command_value,
            is_active,
            created_at,
            updated_at
        FROM hub_sync_tasks
        ORDER BY id DESC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)
            return cursor.fetchall()


def fetch_sync_task_by_id(task_id: int) -> dict[str, Any] | None:
    query = """
        SELECT
            id,
            schedule_expression,
            description,
            task_type,
            command_source,
            command_value,
            is_active,
            created_at,
            updated_at
        FROM hub_sync_tasks
        WHERE id = %s
        LIMIT 1
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (task_id,))
            return cursor.fetchone()


def create_sync_task(
    schedule_expression: str,
    description: str,
    task_type: str,
    command_source: str,
    command_value: str,
    is_active: bool,
) -> int:
    query = """
        INSERT INTO hub_sync_tasks (
            schedule_expression,
            description,
            task_type,
            command_source,
            command_value,
            is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                query,
                (schedule_expression, description, task_type, command_source, command_value, int(is_active)),
            )
            return cursor.lastrowid


def update_sync_task(
    task_id: int,
    schedule_expression: str,
    description: str,
    task_type: str,
    command_source: str,
    command_value: str,
    is_active: bool,
) -> None:
    query = """
        UPDATE hub_sync_tasks
        SET
            schedule_expression = %s,
            description = %s,
            task_type = %s,
            command_source = %s,
            command_value = %s,
            is_active = %s
        WHERE id = %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                query,
                (schedule_expression, description, task_type, command_source, command_value, int(is_active), task_id),
            )


def delete_sync_task(task_id: int) -> None:
    query = "DELETE FROM hub_sync_tasks WHERE id = %s"
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (task_id,))


def fetch_profiles() -> list[dict[str, Any]]:
    query = """
        SELECT
            r.id,
            r.code,
            r.name,
            r.description,
            r.is_admin,
            r.status,
            rm.module_code,
            rm.can_view,
            rm.can_write
        FROM hub_roles r
        LEFT JOIN hub_role_modules rm ON rm.role_id = r.id
        ORDER BY r.name, rm.module_code
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)
            return cursor.fetchall()


def fetch_profile_by_code(role_code: str) -> list[dict[str, Any]]:
    query = """
        SELECT
            r.id,
            r.code,
            r.name,
            r.description,
            r.is_admin,
            r.status,
            rm.module_code,
            rm.can_view,
            rm.can_write
        FROM hub_roles r
        LEFT JOIN hub_role_modules rm ON rm.role_id = r.id
        WHERE r.code = %s
        ORDER BY rm.module_code
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (role_code,))
            return cursor.fetchall()


def create_profile(code: str, name: str, description: str, is_admin: bool, status: str) -> int:
    query = """
        INSERT INTO hub_roles (code, name, description, is_admin, status)
        VALUES (%s, %s, %s, %s, %s)
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (code, name, description or None, int(is_admin), status))
            return cursor.lastrowid


def update_profile(role_id: int, name: str, description: str, is_admin: bool, status: str) -> None:
    query = """
        UPDATE hub_roles
        SET name = %s,
            description = %s,
            is_admin = %s,
            status = %s
        WHERE id = %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (name, description or None, int(is_admin), status, role_id))


def replace_profile_modules(role_id: int, modules: list[dict[str, Any]]) -> None:
    delete_query = "DELETE FROM hub_role_modules WHERE role_id = %s"
    insert_query = """
        INSERT INTO hub_role_modules (role_id, module_code, can_view, can_write)
        VALUES (%s, %s, %s, %s)
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(delete_query, (role_id,))
            for module in modules:
                cursor.execute(
                    insert_query,
                    (role_id, module["moduleCode"], int(module["canView"]), int(module["canWrite"])),
                )
