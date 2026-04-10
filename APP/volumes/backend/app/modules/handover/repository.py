from __future__ import annotations

from typing import Any

from infrastructure.db import get_db_connection


def fetch_handover_document_rows(
    query: str = "",
    status: str = "",
    handover_type: str = "",
) -> list[dict[str, Any]]:
    filters: list[str] = []
    params: list[Any] = []

    normalized_query = str(query or "").strip().lower()
    if normalized_query:
        like = f"%{normalized_query}%"
        filters.append(
            """
            (
                LOWER(d.document_number) LIKE %s
                OR LOWER(d.receiver_name) LIKE %s
                OR EXISTS (
                    SELECT 1
                    FROM hub_handover_document_items search_item
                    WHERE search_item.document_id = d.id
                      AND (
                          LOWER(search_item.asset_code) LIKE %s
                          OR LOWER(search_item.asset_name) LIKE %s
                          OR LOWER(COALESCE(search_item.asset_serial, '')) LIKE %s
                      )
                )
            )
            """
        )
        params.extend([like, like, like, like, like])

    if status:
        filters.append("d.status = %s")
        params.append(status)

    if handover_type:
        filters.append("d.handover_type = %s")
        params.append(handover_type)

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
    query_sql = f"""
        SELECT
            d.id,
            d.document_number,
            d.generated_at,
            d.owner_user_id,
            d.owner_name,
            d.status,
            d.handover_type,
            d.reason,
            d.notes,
            d.receiver_person_id,
            d.receiver_code,
            d.receiver_name,
            d.receiver_email,
            d.receiver_phone,
            d.receiver_role,
            d.receiver_status,
            COUNT(i.id) AS asset_count,
            SUBSTRING_INDEX(
                GROUP_CONCAT(i.asset_name ORDER BY i.sort_order ASC SEPARATOR '||'),
                '||',
                1
            ) AS first_asset_name
        FROM hub_handover_documents d
        LEFT JOIN hub_handover_document_items i
            ON i.document_id = d.id
        {where_clause}
        GROUP BY
            d.id,
            d.document_number,
            d.generated_at,
            d.owner_user_id,
            d.owner_name,
            d.status,
            d.handover_type,
            d.reason,
            d.notes,
            d.receiver_person_id,
            d.receiver_code,
            d.receiver_name,
            d.receiver_email,
            d.receiver_phone,
            d.receiver_role,
            d.receiver_status
        ORDER BY d.generated_at DESC, d.id DESC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query_sql, tuple(params))
            return cursor.fetchall()


def fetch_handover_document_row(document_id: int) -> dict[str, Any] | None:
    query = """
        SELECT
            id,
            document_number,
            generated_at,
            owner_user_id,
            owner_name,
            status,
            handover_type,
            reason,
            notes,
            receiver_person_id,
            receiver_code,
            receiver_name,
            receiver_email,
            receiver_phone,
            receiver_role,
            receiver_status,
            created_at,
            updated_at
        FROM hub_handover_documents
        WHERE id = %s
        LIMIT 1
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (document_id,))
            return cursor.fetchone()


def fetch_handover_item_rows(document_id: int) -> list[dict[str, Any]]:
    query = """
        SELECT
            id,
            document_id,
            asset_itop_id,
            asset_code,
            asset_name,
            asset_class_name,
            asset_brand,
            asset_model,
            asset_serial,
            asset_status,
            assigned_user_name,
            notes,
            sort_order,
            created_at,
            updated_at
        FROM hub_handover_document_items
        WHERE document_id = %s
        ORDER BY sort_order ASC, id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (document_id,))
            return cursor.fetchall()


def fetch_handover_item_checklist_rows(document_id: int) -> list[dict[str, Any]]:
    query = """
        SELECT
            c.id,
            c.item_id,
            c.template_id,
            c.template_name,
            c.template_description,
            c.sort_order,
            i.document_id
        FROM hub_handover_item_checklists c
        INNER JOIN hub_handover_document_items i
            ON i.id = c.item_id
        WHERE i.document_id = %s
        ORDER BY i.sort_order ASC, c.sort_order ASC, c.id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (document_id,))
            return cursor.fetchall()


def fetch_handover_checklist_answer_rows(document_id: int) -> list[dict[str, Any]]:
    query = """
        SELECT
            a.id,
            a.item_checklist_id,
            a.checklist_item_id,
            a.check_name,
            a.check_description,
            a.input_type,
            a.option_a,
            a.option_b,
            a.response_value,
            a.sort_order,
            c.item_id,
            c.template_id
        FROM hub_handover_checklist_answers a
        INNER JOIN hub_handover_item_checklists c
            ON c.id = a.item_checklist_id
        INNER JOIN hub_handover_document_items i
            ON i.id = c.item_id
        WHERE i.document_id = %s
        ORDER BY i.sort_order ASC, c.sort_order ASC, a.sort_order ASC, a.id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (document_id,))
            return cursor.fetchall()


def fetch_handover_template_rows(include_inactive: bool = False) -> list[dict[str, Any]]:
    filters = ["module_code = 'handover'"]
    if not include_inactive:
        filters.append("status = 'active'")

    query = f"""
        SELECT
            id,
            module_code,
            name,
            description,
            status,
            sort_order
        FROM hub_checklist_templates
        WHERE {' AND '.join(filters)}
        ORDER BY sort_order ASC, id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)
            return cursor.fetchall()


def fetch_handover_template_item_rows(template_ids: list[int]) -> list[dict[str, Any]]:
    if not template_ids:
        return []

    placeholders = ", ".join(["%s"] * len(template_ids))
    query = f"""
        SELECT
            id,
            template_id,
            name,
            description,
            input_type,
            option_a,
            option_b,
            sort_order
        FROM hub_checklist_items
        WHERE template_id IN ({placeholders})
        ORDER BY template_id ASC, sort_order ASC, id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, tuple(template_ids))
            return cursor.fetchall()


def get_next_handover_sequence(prefix: str, year: int) -> int:
    query = """
        SELECT
            COALESCE(
                MAX(
                    CAST(SUBSTRING_INDEX(document_number, '-', -1) AS UNSIGNED)
                ),
                0
            ) + 1 AS next_sequence
        FROM hub_handover_documents
        WHERE document_number LIKE %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (f"{prefix}-{year}-%",))
            row = cursor.fetchone() or {}
    return int(row.get("next_sequence") or 1)


def save_handover_document(
    document_id: int | None,
    document: dict[str, Any],
    items: list[dict[str, Any]],
) -> int:
    insert_document_query = """
        INSERT INTO hub_handover_documents (
            document_number,
            generated_at,
            owner_user_id,
            owner_name,
            status,
            handover_type,
            reason,
            notes,
            receiver_person_id,
            receiver_code,
            receiver_name,
            receiver_email,
            receiver_phone,
            receiver_role,
            receiver_status
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    update_document_query = """
        UPDATE hub_handover_documents
        SET
            generated_at = %s,
            status = %s,
            handover_type = %s,
            reason = %s,
            notes = %s,
            receiver_person_id = %s,
            receiver_code = %s,
            receiver_name = %s,
            receiver_email = %s,
            receiver_phone = %s,
            receiver_role = %s,
            receiver_status = %s
        WHERE id = %s
    """
    delete_items_query = "DELETE FROM hub_handover_document_items WHERE document_id = %s"
    insert_item_query = """
        INSERT INTO hub_handover_document_items (
            document_id,
            asset_itop_id,
            asset_code,
            asset_name,
            asset_class_name,
            asset_brand,
            asset_model,
            asset_serial,
            asset_status,
            assigned_user_name,
            notes,
            sort_order
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    insert_item_checklist_query = """
        INSERT INTO hub_handover_item_checklists (
            item_id,
            template_id,
            template_name,
            template_description,
            sort_order
        )
        VALUES (%s, %s, %s, %s, %s)
    """
    insert_answer_query = """
        INSERT INTO hub_handover_checklist_answers (
            item_checklist_id,
            checklist_item_id,
            check_name,
            check_description,
            input_type,
            option_a,
            option_b,
            response_value,
            sort_order
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    with get_db_connection() as connection:
        connection.autocommit(False)
        try:
            with connection.cursor() as cursor:
                if document_id is None:
                    cursor.execute(
                        insert_document_query,
                        (
                            document["document_number"],
                            document["generated_at"],
                            document["owner_user_id"],
                            document["owner_name"],
                            document["status"],
                            document["handover_type"],
                            document["reason"],
                            document["notes"],
                            document["receiver_person_id"],
                            document["receiver_code"],
                            document["receiver_name"],
                            document["receiver_email"],
                            document["receiver_phone"],
                            document["receiver_role"],
                            document["receiver_status"],
                        ),
                    )
                    saved_document_id = int(cursor.lastrowid)
                else:
                    cursor.execute(
                        update_document_query,
                        (
                            document["generated_at"],
                            document["status"],
                            document["handover_type"],
                            document["reason"],
                            document["notes"],
                            document["receiver_person_id"],
                            document["receiver_code"],
                            document["receiver_name"],
                            document["receiver_email"],
                            document["receiver_phone"],
                            document["receiver_role"],
                            document["receiver_status"],
                            document_id,
                        ),
                    )
                    saved_document_id = document_id
                    cursor.execute(delete_items_query, (saved_document_id,))

                for item_index, item in enumerate(items):
                    cursor.execute(
                        insert_item_query,
                        (
                            saved_document_id,
                            item["asset_itop_id"],
                            item["asset_code"],
                            item["asset_name"],
                            item["asset_class_name"],
                            item["asset_brand"],
                            item["asset_model"],
                            item["asset_serial"],
                            item["asset_status"],
                            item["assigned_user_name"],
                            item["notes"],
                            (item_index + 1) * 10,
                        ),
                    )
                    saved_item_id = int(cursor.lastrowid)

                    for checklist_index, checklist in enumerate(item["checklists"]):
                        cursor.execute(
                            insert_item_checklist_query,
                            (
                                saved_item_id,
                                checklist["template_id"],
                                checklist["template_name"],
                                checklist["template_description"],
                                (checklist_index + 1) * 10,
                            ),
                        )
                        saved_item_checklist_id = int(cursor.lastrowid)

                        for answer_index, answer in enumerate(checklist["answers"]):
                            cursor.execute(
                                insert_answer_query,
                                (
                                    saved_item_checklist_id,
                                    answer["checklist_item_id"],
                                    answer["check_name"],
                                    answer["check_description"],
                                    answer["input_type"],
                                    answer["option_a"],
                                    answer["option_b"],
                                    answer["response_value"],
                                    (answer_index + 1) * 10,
                                ),
                            )

            connection.commit()
            return saved_document_id
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.autocommit(True)
