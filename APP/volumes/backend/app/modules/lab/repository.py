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
            r.requested_actions,
            r.status,
            r.asset_itop_id,
            r.asset_code,
            r.asset_name,
            r.asset_class,
            r.asset_serial,
            r.asset_organization,
            r.asset_location,
            r.asset_status,
            r.asset_assigned_user,
            r.owner_user_id,
            r.owner_name,
            r.requester_admin_user_id,
            r.requester_admin_name,
            r.requester_admin_itop_person_key,
            r.entry_date,
            r.entry_observations,
            r.entry_condition_notes,
            r.entry_received_notes,
            r.processing_date,
            r.exit_date,
            r.marked_obsolete,
            r.normalization_act_code,
            r.entry_generated_document,
            r.processing_generated_document,
            r.exit_generated_document,
            r.signature_workflow,
            r.itop_ticket_summary,
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
            "requested_actions": _json_loads_safe(row.get("requested_actions")) or [],
            "entry_generated_document": _json_loads_safe(row.get("entry_generated_document")),
            "processing_generated_document": _json_loads_safe(row.get("processing_generated_document")),
            "exit_generated_document": _json_loads_safe(row.get("exit_generated_document")),
            "signature_workflow": _json_loads_safe(row.get("signature_workflow")) or {},
            "itop_ticket_summary": _json_loads_safe(row.get("itop_ticket_summary")) or {},
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
        "requested_actions": _json_loads_safe(row.get("requested_actions")) or [],
        "entry_evidences": _json_loads_safe(row.get("entry_evidences")) or [],
        "entry_generated_document": _json_loads_safe(row.get("entry_generated_document")),
        "processing_evidences": _json_loads_safe(row.get("processing_evidences")) or [],
        "processing_generated_document": _json_loads_safe(row.get("processing_generated_document")),
        "processing_checklists": _json_loads_safe(row.get("processing_checklists")) or [],
        "exit_evidences": _json_loads_safe(row.get("exit_evidences")) or [],
        "exit_generated_document": _json_loads_safe(row.get("exit_generated_document")),
        "signature_workflow": _json_loads_safe(row.get("signature_workflow")) or {},
        "itop_ticket_summary": _json_loads_safe(row.get("itop_ticket_summary")) or {},
    }


def fetch_lab_record_row_by_signature_token(signature_token: str) -> dict[str, Any] | None:
    normalized_token = str(signature_token or "").strip()
    if not normalized_token:
        return None

    sql = """
        SELECT *
        FROM hub_lab_records
        WHERE signature_workflow LIKE %s
        ORDER BY id DESC
        LIMIT 1
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, (f'%"token": "{normalized_token}"%',))
            row = cursor.fetchone()
    if not row:
        return None
    return {
        **row,
        "requested_actions": _json_loads_safe(row.get("requested_actions")) or [],
        "entry_evidences": _json_loads_safe(row.get("entry_evidences")) or [],
        "entry_generated_document": _json_loads_safe(row.get("entry_generated_document")),
        "processing_evidences": _json_loads_safe(row.get("processing_evidences")) or [],
        "processing_generated_document": _json_loads_safe(row.get("processing_generated_document")),
        "processing_checklists": _json_loads_safe(row.get("processing_checklists")) or [],
        "exit_evidences": _json_loads_safe(row.get("exit_evidences")) or [],
        "exit_generated_document": _json_loads_safe(row.get("exit_generated_document")),
        "signature_workflow": _json_loads_safe(row.get("signature_workflow")) or {},
        "itop_ticket_summary": _json_loads_safe(row.get("itop_ticket_summary")) or {},
    }


def save_lab_record(
    record_id: int | None,
    record: dict[str, Any],
) -> int:
    insert_sql = """
        INSERT INTO hub_lab_records (
            document_number,
            reason,
            requested_actions,
            status,
            asset_itop_id,
            asset_code,
            asset_name,
            asset_class,
            asset_serial,
            asset_organization,
            asset_location,
            asset_status,
            asset_assigned_user,
            owner_user_id,
            owner_name,
            requester_admin_user_id,
            requester_admin_name,
            requester_admin_itop_person_key,
            entry_date,
            entry_observations,
            entry_condition_notes,
            entry_received_notes,
            entry_evidences,
            entry_generated_document,
            processing_date,
            processing_observations,
            processing_evidences,
            processing_generated_document,
            processing_checklists,
            exit_date,
            exit_observations,
            work_performed,
            exit_evidences,
            exit_generated_document,
            signature_workflow,
            itop_ticket_summary,
            marked_obsolete,
            obsolete_notes,
            normalization_act_code
        )
        VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s
        )
    """
    update_sql = """
        UPDATE hub_lab_records
        SET
            reason = %s,
            requested_actions = %s,
            status = %s,
            asset_itop_id = %s,
            asset_code = %s,
            asset_name = %s,
            asset_class = %s,
            asset_serial = %s,
            asset_organization = %s,
            asset_location = %s,
            asset_status = %s,
            asset_assigned_user = %s,
            owner_user_id = %s,
            owner_name = %s,
            requester_admin_user_id = %s,
            requester_admin_name = %s,
            requester_admin_itop_person_key = %s,
            entry_date = %s,
            entry_observations = %s,
            entry_condition_notes = %s,
            entry_received_notes = %s,
            entry_evidences = %s,
            entry_generated_document = %s,
            processing_date = %s,
            processing_observations = %s,
            processing_evidences = %s,
            processing_generated_document = %s,
            processing_checklists = %s,
            exit_date = %s,
            exit_observations = %s,
            work_performed = %s,
            exit_evidences = %s,
            exit_generated_document = %s,
            signature_workflow = %s,
            itop_ticket_summary = %s,
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
                        _json_str(record.get("requested_actions", [])),
                        record.get("status", "draft"),
                        record.get("asset_itop_id"),
                        record.get("asset_code"),
                        record.get("asset_name"),
                        record.get("asset_class"),
                        record.get("asset_serial"),
                        record.get("asset_organization"),
                        record.get("asset_location"),
                        record.get("asset_status"),
                        record.get("asset_assigned_user"),
                        record.get("owner_user_id"),
                        record.get("owner_name"),
                        record.get("requester_admin_user_id"),
                        record.get("requester_admin_name"),
                        record.get("requester_admin_itop_person_key"),
                        record.get("entry_date"),
                        record.get("entry_observations"),
                        record.get("entry_condition_notes"),
                        record.get("entry_received_notes"),
                        _json_str(record.get("entry_evidences", [])),
                        _json_str(record.get("entry_generated_document")),
                        record.get("processing_date"),
                        record.get("processing_observations"),
                        _json_str(record.get("processing_evidences", [])),
                        _json_str(record.get("processing_generated_document")),
                        _json_str(record.get("processing_checklists", [])),
                        record.get("exit_date"),
                        record.get("exit_observations"),
                        record.get("work_performed"),
                        _json_str(record.get("exit_evidences", [])),
                        _json_str(record.get("exit_generated_document")),
                        _json_str(record.get("signature_workflow") or {}),
                        _json_str(record.get("itop_ticket_summary") or {}),
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
                        _json_str(record.get("requested_actions", [])),
                        record.get("status", "draft"),
                        record.get("asset_itop_id"),
                        record.get("asset_code"),
                        record.get("asset_name"),
                        record.get("asset_class"),
                        record.get("asset_serial"),
                        record.get("asset_organization"),
                        record.get("asset_location"),
                        record.get("asset_status"),
                        record.get("asset_assigned_user"),
                        record.get("owner_user_id"),
                        record.get("owner_name"),
                        record.get("requester_admin_user_id"),
                        record.get("requester_admin_name"),
                        record.get("requester_admin_itop_person_key"),
                        record.get("entry_date"),
                        record.get("entry_observations"),
                        record.get("entry_condition_notes"),
                        record.get("entry_received_notes"),
                        _json_str(record.get("entry_evidences", [])),
                        _json_str(record.get("entry_generated_document")),
                        record.get("processing_date"),
                        record.get("processing_observations"),
                        _json_str(record.get("processing_evidences", [])),
                        _json_str(record.get("processing_generated_document")),
                        _json_str(record.get("processing_checklists", [])),
                        record.get("exit_date"),
                        record.get("exit_observations"),
                        record.get("work_performed"),
                        _json_str(record.get("exit_evidences", [])),
                        _json_str(record.get("exit_generated_document")),
                        _json_str(record.get("signature_workflow") or {}),
                        _json_str(record.get("itop_ticket_summary") or {}),
                        int(bool(record.get("marked_obsolete", False))),
                        record.get("obsolete_notes"),
                        record.get("normalization_act_code"),
                        record_id,
                    ),
                )
                return record_id
