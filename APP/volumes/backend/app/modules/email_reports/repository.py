from __future__ import annotations

import json
from typing import Any

from infrastructure.db import get_db_connection


def _decode_parameters(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return row
    raw = row.get("parameters_json")
    if isinstance(raw, str):
        try:
            row["parameters_json"] = json.loads(raw)
        except json.JSONDecodeError:
            row["parameters_json"] = []
    elif raw is None:
        row["parameters_json"] = []
    return row


def fetch_email_reports(include_inactive: bool = False) -> list[dict[str, Any]]:
    status_filter = "" if include_inactive else "WHERE status = 'active'"
    sql = f"""
        SELECT id, report_code, name, description, webhook_url, http_method, status,
               display_order, icon_name, logo_url, parameters_json, created_at, updated_at
        FROM hub_email_reports
        {status_filter}
        ORDER BY display_order ASC, name ASC
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
    return [_decode_parameters(row) for row in rows]


def fetch_email_report(report_id: int) -> dict[str, Any] | None:
    sql = """
        SELECT id, report_code, name, description, webhook_url, http_method, status,
               display_order, icon_name, logo_url, parameters_json, created_at, updated_at
        FROM hub_email_reports
        WHERE id = %s
        LIMIT 1
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (report_id,))
            return _decode_parameters(cur.fetchone())


def fetch_email_report_by_code(report_code: str) -> dict[str, Any] | None:
    sql = """
        SELECT id, report_code, name, description, webhook_url, http_method, status,
               display_order, icon_name, logo_url, parameters_json, created_at, updated_at
        FROM hub_email_reports
        WHERE report_code = %s
        LIMIT 1
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (report_code,))
            return _decode_parameters(cur.fetchone())


def fetch_active_email_report(report_id: int) -> dict[str, Any] | None:
    sql = """
        SELECT id, report_code, name, description, webhook_url, http_method, status,
               display_order, icon_name, logo_url, parameters_json, created_at, updated_at
        FROM hub_email_reports
        WHERE id = %s AND status = 'active'
        LIMIT 1
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (report_id,))
            return _decode_parameters(cur.fetchone())


def insert_email_report(payload: dict[str, Any], username: str) -> int:
    sql = """
        INSERT INTO hub_email_reports
            (report_code, name, description, webhook_url, http_method, status,
             display_order, icon_name, logo_url, parameters_json, created_by, updated_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    payload["report_code"],
                    payload["name"],
                    payload["description"],
                    payload["webhook_url"],
                    payload["http_method"],
                    payload["status"],
                    payload["display_order"],
                    payload["icon_name"],
                    payload["logo_url"],
                    json.dumps(payload["parameters_json"]),
                    username,
                    username,
                ),
            )
            return conn.insert_id()


def update_email_report(report_id: int, payload: dict[str, Any], username: str) -> None:
    sql = """
        UPDATE hub_email_reports
        SET report_code = %s,
            name = %s,
            description = %s,
            webhook_url = %s,
            http_method = %s,
            status = %s,
            display_order = %s,
            icon_name = %s,
            logo_url = %s,
            parameters_json = %s,
            updated_by = %s
        WHERE id = %s
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    payload["report_code"],
                    payload["name"],
                    payload["description"],
                    payload["webhook_url"],
                    payload["http_method"],
                    payload["status"],
                    payload["display_order"],
                    payload["icon_name"],
                    payload["logo_url"],
                    json.dumps(payload["parameters_json"]),
                    username,
                    report_id,
                ),
            )


def delete_email_report(report_id: int) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM hub_email_reports WHERE id = %s", (report_id,))
