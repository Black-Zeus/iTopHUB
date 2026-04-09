from __future__ import annotations

from typing import Any

from db import get_db_connection


def fetch_checklist_rows() -> list[dict[str, Any]]:
    query = """
        SELECT
            t.id AS template_id,
            t.module_code,
            t.name AS template_name,
            t.description AS template_description,
            t.status AS template_status,
            t.cmdb_class_label,
            t.sort_order AS template_sort_order,
            i.id AS item_id,
            i.name AS item_name,
            i.description AS item_description,
            i.input_type,
            i.option_a,
            i.option_b,
            i.sort_order AS item_sort_order
        FROM hub_checklist_templates t
        LEFT JOIN hub_checklist_items i ON i.template_id = t.id
        ORDER BY t.module_code, t.sort_order ASC, t.id ASC, i.sort_order ASC, i.id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)
            return cursor.fetchall()


def fetch_checklist_template_row(template_id: int) -> dict[str, Any] | None:
    query = """
        SELECT
            id,
            module_code,
            name,
            description,
            status,
            cmdb_class_label,
            sort_order,
            created_at,
            updated_at
        FROM hub_checklist_templates
        WHERE id = %s
        LIMIT 1
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (template_id,))
            return cursor.fetchone()


def fetch_checklist_item_rows(template_id: int) -> list[dict[str, Any]]:
    query = """
        SELECT
            id,
            template_id,
            name,
            description,
            input_type,
            option_a,
            option_b,
            sort_order,
            created_at,
            updated_at
        FROM hub_checklist_items
        WHERE template_id = %s
        ORDER BY sort_order ASC, id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (template_id,))
            return cursor.fetchall()


def get_next_template_sort_order(module_code: str) -> int:
    query = """
        SELECT COALESCE(MIN(sort_order), 10) - 10 AS next_sort_order
        FROM hub_checklist_templates
        WHERE module_code = %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (module_code,))
            row = cursor.fetchone() or {}
    return int(row.get("next_sort_order") or 0)


def create_checklist_template(
    module_code: str,
    name: str,
    description: str,
    status: str,
    cmdb_class_label: str | None,
    sort_order: int,
) -> int:
    query = """
        INSERT INTO hub_checklist_templates (
            module_code,
            name,
            description,
            status,
            cmdb_class_label,
            sort_order
        )
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                query,
                (module_code, name, description, status, cmdb_class_label, sort_order),
            )
            return cursor.lastrowid


def update_checklist_template(
    template_id: int,
    name: str,
    description: str,
    status: str,
    cmdb_class_label: str | None,
) -> None:
    query = """
        UPDATE hub_checklist_templates
        SET
            name = %s,
            description = %s,
            status = %s,
            cmdb_class_label = %s
        WHERE id = %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (name, description, status, cmdb_class_label, template_id))


def replace_checklist_items(template_id: int, items: list[dict[str, Any]]) -> None:
    delete_query = "DELETE FROM hub_checklist_items WHERE template_id = %s"
    insert_query = """
        INSERT INTO hub_checklist_items (
            template_id,
            name,
            description,
            input_type,
            option_a,
            option_b,
            sort_order
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    with get_db_connection() as connection:
        connection.autocommit(False)
        try:
            with connection.cursor() as cursor:
                cursor.execute(delete_query, (template_id,))
                for index, item in enumerate(items):
                    cursor.execute(
                        insert_query,
                        (
                            template_id,
                            item["name"],
                            item["description"],
                            item["input_type"],
                            item["option_a"],
                            item["option_b"],
                            (index + 1) * 10,
                        ),
                    )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.autocommit(True)
