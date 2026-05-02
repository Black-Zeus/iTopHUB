from __future__ import annotations

import json
from typing import Any

from infrastructure.db import get_db_connection


def _json_loads_safe(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(str(value))
    except Exception:
        return None


def get_next_lab_sequence(year: int) -> int:
    query = """
        SELECT
            COALESCE(
                MAX(CAST(SUBSTRING_INDEX(document_number, '-', -1) AS UNSIGNED)),
                0
            ) + 1 AS next_sequence
        FROM hub_lab_records
        WHERE document_number LIKE %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (f"LAB-{year}-%",))
            row = cursor.fetchone() or {}
    return int(row.get("next_sequence") or 1)


def fetch_lab_record_rows(
    query: str = "",
    status: str = "",
    reason: str = "",
) -> list[dict[str, Any]]:
    filters: list[str] = []
    params: list[Any] = []

    normalized_query = str(query or "").strip().lower()
    if normalized_query:
        like = f"%{normalized_query}%"
        filters.append(
            """
            (
                LOWER(r.document_number) LIKE %s
                OR LOWER(COALESCE(r.asset_code, '')) LIKE %s
                OR LOWER(COALESCE(r.asset_name, '')) LIKE %s
                OR LOWER(COALESCE(r.owner_name, '')) LIKE %s
            )
            """
        )
        params.extend([like, like, like, like])

    if status:
        filters.append("r.status = %s")
        params.append(status)

    if reason:
        filters.append("r.reason = %s")
        params.append(reason)

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
    sql = f"""
        SELECT
            r.id,
            r.document_number,
            r.reason,
            r.status,
            r.asset_itop_id,
            r.asset_code,
            r.asset_name,
            r.asset_class,
            r.asset_serial,
            r.asset_organization,
            r.asset_location,
            r.owner_user_id,
            r.owner_name,
            r.entry_date,
            r.exit_date,
            r.marked_obsolete,
            r.normalization_act_code,
            r.entry_generated_document,
            r.exit_generated_document,
            r.created_at,
            r.updated_at
        FROM hub_lab_records r
        {where_clause}
        ORDER BY r.id DESC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            rows = cursor.fetchall() or []

    result = []
    for row in rows:
        result.append({
            **row,
            "entry_generated_document": _json_loads_safe(row.get("entry_generated_document")),
            "exit_generated_document": _json_loads_safe(row.get("exit_generated_document")),
        })
    return result


def fetch_lab_record_row(record_id: int) -> dict[str, Any] | None:
    sql = """
        SELECT *
        FROM hub_lab_records
        WHERE id = %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, (record_id,))
            row = cursor.fetchone()
    if not row:
        return None
    return {
        **row,
        "entry_evidences": _json_loads_safe(row.get("entry_evidences")) or [],
        "entry_generated_document": _json_loads_safe(row.get("entry_generated_document")),
        "exit_evidences": _json_loads_safe(row.get("exit_evidences")) or [],
        "exit_generated_document": _json_loads_safe(row.get("exit_generated_document")),
    }


def save_lab_record(
    record_id: int | None,
    record: dict[str, Any],
) -> int:
    insert_sql = """
        INSERT INTO hub_lab_records (
            document_number,
            reason,
            status,
            asset_itop_id,
            asset_code,
            asset_name,
            asset_class,
            asset_serial,
            asset_organization,
            asset_location,
            owner_user_id,
            owner_name,
            entry_date,
            entry_observations,
            entry_evidences,
            entry_generated_document,
            exit_date,
            exit_observations,
            work_performed,
            exit_evidences,
            exit_generated_document,
            marked_obsolete,
            obsolete_notes,
            normalization_act_code
        )
        VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s
        )
    """
    update_sql = """
        UPDATE hub_lab_records
        SET
            reason = %s,
            status = %s,
            asset_itop_id = %s,
            asset_code = %s,
            asset_name = %s,
            asset_class = %s,
            asset_serial = %s,
            asset_organization = %s,
            asset_location = %s,
            owner_user_id = %s,
            owner_name = %s,
            entry_date = %s,
            entry_observations = %s,
            entry_evidences = %s,
            entry_generated_document = %s,
            exit_date = %s,
            exit_observations = %s,
            work_performed = %s,
            exit_evidences = %s,
            exit_generated_document = %s,
            marked_obsolete = %s,
            obsolete_notes = %s,
            normalization_act_code = %s
        WHERE id = %s
    """

    def _json_str(value: Any) -> str | None:
        if value is None:
            return None
        return json.dumps(value, ensure_ascii=False)

    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            if record_id is None:
                cursor.execute(
                    insert_sql,
                    (
                        record.get("document_number", ""),
                        record.get("reason", "maintenance"),
                        record.get("status", "draft"),
                        record.get("asset_itop_id"),
                        record.get("asset_code"),
                        record.get("asset_name"),
                        record.get("asset_class"),
                        record.get("asset_serial"),
                        record.get("asset_organization"),
                        record.get("asset_location"),
                        record.get("owner_user_id"),
                        record.get("owner_name"),
                        record.get("entry_date"),
                        record.get("entry_observations"),
                        _json_str(record.get("entry_evidences", [])),
                        _json_str(record.get("entry_generated_document")),
                        record.get("exit_date"),
                        record.get("exit_observations"),
                        record.get("work_performed"),
                        _json_str(record.get("exit_evidences", [])),
                        _json_str(record.get("exit_generated_document")),
                        int(bool(record.get("marked_obsolete", False))),
                        record.get("obsolete_notes"),
                        record.get("normalization_act_code"),
                    ),
                )
                return connection.insert_id()
            else:
                cursor.execute(
                    update_sql,
                    (
                        record.get("reason", "maintenance"),
                        record.get("status", "draft"),
                        record.get("asset_itop_id"),
                        record.get("asset_code"),
                        record.get("asset_name"),
                        record.get("asset_class"),
                        record.get("asset_serial"),
                        record.get("asset_organization"),
                        record.get("asset_location"),
                        record.get("owner_user_id"),
                        record.get("owner_name"),
                        record.get("entry_date"),
                        record.get("entry_observations"),
                        _json_str(record.get("entry_evidences", [])),
                        _json_str(record.get("entry_generated_document")),
                        record.get("exit_date"),
                        record.get("exit_observations"),
                        record.get("work_performed"),
                        _json_str(record.get("exit_evidences", [])),
                        _json_str(record.get("exit_generated_document")),
                        int(bool(record.get("marked_obsolete", False))),
                        record.get("obsolete_notes"),
                        record.get("normalization_act_code"),
                        record_id,
                    ),
                )
                return record_id
