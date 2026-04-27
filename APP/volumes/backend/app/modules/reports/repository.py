from __future__ import annotations

import json
from typing import Any

from infrastructure.db import get_db_connection


def fetch_report_catalog(include_inactive: bool = False) -> list[dict[str, Any]]:
    status_filter = "" if include_inactive else "WHERE rd.status = 'active'"
    sql = f"""
        SELECT
            rd.id,
            rd.report_code,
            rd.name,
            rd.description,
            rd.category,
            rd.type,
            rd.status,
            rd.current_version,
            JSON_EXTRACT(rdv.definition_json, '$.metadata.tags') AS tags_raw,
            JSON_EXTRACT(rdv.definition_json, '$.metadata.available') AS available_raw,
            rd.created_at,
            rd.updated_at
        FROM hub_report_definitions rd
        LEFT JOIN hub_report_definition_versions rdv
            ON rdv.report_definition_id = rd.id AND rdv.status = 'active'
        {status_filter}
        ORDER BY rd.category ASC, rd.name ASC
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

    result = []
    for row in rows:
        tags_raw = row.pop("tags_raw", None)
        available_raw = row.pop("available_raw", None)
        try:
            tags = json.loads(tags_raw) if isinstance(tags_raw, str) else (tags_raw if isinstance(tags_raw, list) else [])
        except (json.JSONDecodeError, TypeError):
            tags = []
        available = available_raw not in (0, False, "false") if available_raw is not None else True
        result.append({**row, "tags": tags if isinstance(tags, list) else [], "available": available})
    return result


def fetch_report_by_code(report_code: str) -> dict[str, Any] | None:
    sql = """
        SELECT id, report_code, name, description, category, type, status, current_version, created_at, updated_at
        FROM hub_report_definitions
        WHERE report_code = %s
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (report_code,))
            return cur.fetchone()


def fetch_active_version(report_definition_id: int) -> dict[str, Any] | None:
    sql = """
        SELECT id, report_definition_id, version, status, definition_json, change_reason, created_by, created_at, activated_at
        FROM hub_report_definition_versions
        WHERE report_definition_id = %s AND status = 'active'
        LIMIT 1
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (report_definition_id,))
            row = cur.fetchone()
            if row and isinstance(row.get("definition_json"), str):
                row["definition_json"] = json.loads(row["definition_json"])
            return row


def fetch_all_versions(report_definition_id: int) -> list[dict[str, Any]]:
    sql = """
        SELECT id, version, status, change_reason, created_by, created_at, activated_at
        FROM hub_report_definition_versions
        WHERE report_definition_id = %s
        ORDER BY version DESC
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (report_definition_id,))
            return cur.fetchall()


def fetch_version_by_number(report_definition_id: int, version: int) -> dict[str, Any] | None:
    sql = """
        SELECT id, report_definition_id, version, status, definition_json, change_reason, created_by, created_at, activated_at
        FROM hub_report_definition_versions
        WHERE report_definition_id = %s AND version = %s
        LIMIT 1
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (report_definition_id, version))
            row = cur.fetchone()
            if row and isinstance(row.get("definition_json"), str):
                row["definition_json"] = json.loads(row["definition_json"])
            return row


def fetch_next_version_number(report_definition_id: int) -> int:
    sql = "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM hub_report_definition_versions WHERE report_definition_id = %s"
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (report_definition_id,))
            row = cur.fetchone()
            return int(row["next_version"]) if row else 1


def insert_version(
    report_definition_id: int,
    version: int,
    definition_json: dict,
    change_reason: str,
    created_by: str,
) -> int:
    sql = """
        INSERT INTO hub_report_definition_versions
            (report_definition_id, version, status, definition_json, change_reason, created_by)
        VALUES (%s, %s, 'draft', %s, %s, %s)
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (report_definition_id, version, json.dumps(definition_json), change_reason, created_by))
            return conn.insert_id()


def activate_version(report_definition_id: int, version: int, activated_by: str) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Deprecate all other active/rollback versions for this report
            cur.execute(
                "UPDATE hub_report_definition_versions SET status = 'deprecated' WHERE report_definition_id = %s AND version != %s AND status IN ('active', 'rollback')",
                (report_definition_id, version),
            )
            # Activate the target version
            cur.execute(
                "UPDATE hub_report_definition_versions SET status = 'active', activated_at = NOW() WHERE report_definition_id = %s AND version = %s",
                (report_definition_id, version),
            )
            # Update current_version in report_definitions
            cur.execute(
                "UPDATE hub_report_definitions SET current_version = %s, updated_by = %s WHERE id = %s",
                (version, activated_by, report_definition_id),
            )


def rollback_version(report_definition_id: int, target_version: int, activated_by: str) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Mark all active as deprecated
            cur.execute(
                "UPDATE hub_report_definition_versions SET status = 'deprecated' WHERE report_definition_id = %s AND status = 'active'",
                (report_definition_id,),
            )
            # Restore target version with rollback status
            cur.execute(
                "UPDATE hub_report_definition_versions SET status = 'rollback', activated_at = NOW() WHERE report_definition_id = %s AND version = %s",
                (report_definition_id, target_version),
            )
            cur.execute(
                "UPDATE hub_report_definitions SET current_version = %s, updated_by = %s WHERE id = %s",
                (target_version, activated_by, report_definition_id),
            )


def update_report_status(report_code: str, status: str, updated_by: str) -> None:
    sql = "UPDATE hub_report_definitions SET status = %s, updated_by = %s WHERE report_code = %s"
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (status, updated_by, report_code))
