from __future__ import annotations

import csv
import io
import logging
from typing import Any

from modules.reports import engine as report_engine
from modules.reports import repository
from modules.reports.errors import (
    ReportInactiveError,
    ReportNotFoundError,
    ReportVersionNotFoundError,
    ReportVersionActivationError,
    ReportVersionRollbackError,
    ReportDefinitionInvalidError,
    ReportExportError,
)

logger = logging.getLogger(__name__)


def _get_report_or_raise(report_code: str) -> dict[str, Any]:
    report = repository.fetch_report_by_code(report_code)
    if not report:
        raise ReportNotFoundError(report_code)
    return report


def _get_active_version_or_raise(report_definition_id: int) -> dict[str, Any]:
    version = repository.fetch_active_version(report_definition_id)
    if not version:
        raise ReportVersionNotFoundError()
    return version


def _require_active_report(report_code: str) -> dict[str, Any]:
    report = _get_report_or_raise(report_code)
    if report["status"] != "active":
        raise ReportInactiveError(report_code)
    return report


def list_reports(include_inactive: bool = False) -> list[dict[str, Any]]:
    return repository.fetch_report_catalog(include_inactive=include_inactive)


def get_report_definition(report_code: str) -> dict[str, Any]:
    report = _get_report_or_raise(report_code)
    version = _get_active_version_or_raise(report["id"])
    definition = version["definition_json"]
    if not isinstance(definition, dict):
        raise ReportDefinitionInvalidError()

    public = report_engine.build_public_definition(definition)
    return {
        "report_code": report["report_code"],
        "name": report["name"],
        "description": report["description"],
        "category": report["category"],
        "type": report["type"],
        "status": report["status"],
        "version": version["version"],
        "activated_at": str(version["activated_at"]) if version.get("activated_at") else None,
        **public,
    }


def list_report_versions(report_code: str) -> list[dict[str, Any]]:
    report = _get_report_or_raise(report_code)
    return repository.fetch_all_versions(report["id"])


def execute_report(
    report_code: str,
    submitted_filters: dict[str, Any],
    pagination: dict,
    runtime_token: str,
) -> dict[str, Any]:
    report = _require_active_report(report_code)
    version = _get_active_version_or_raise(report["id"])
    definition = version["definition_json"]
    if not isinstance(definition, dict):
        raise ReportDefinitionInvalidError()
    if int(report.get("current_version") or 0) != int(version.get("version") or 0):
        logger.warning(
            "Report version mismatch detected: report_code=%s current_version=%s active_version=%s",
            report_code,
            report.get("current_version"),
            version.get("version"),
        )

    rows, total = report_engine.execute_report(definition, submitted_filters, pagination, runtime_token)

    columns = sorted(definition.get("columns", []), key=lambda c: c.get("order", 0))
    public_columns = [
        {
            "field": c["field"],
            "label": c["label"],
            "order": c.get("order", 0),
            "visible": c.get("visible", True),
            "export": c.get("export", True),
            "format": c.get("format", "text"),
            "align": c.get("align", "left"),
            "wide": c.get("wide", False),
        }
        for c in columns
    ]

    page = max(1, int(pagination.get("page", 1)))
    page_size = max(1, min(500, int(pagination.get("page_size", 50))))

    logger.info(
        "Report executed successfully: report_code=%s version=%s page=%s page_size=%s total=%s rows=%s",
        report_code,
        version["version"],
        page,
        page_size,
        total,
        len(rows),
    )

    return {
        "report_code": report_code,
        "version": version["version"],
        "columns": public_columns,
        "rows": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def export_report_csv(
    report_code: str,
    submitted_filters: dict[str, Any],
    runtime_token: str,
) -> tuple[str, str]:
    report = _require_active_report(report_code)
    version = _get_active_version_or_raise(report["id"])
    definition = version["definition_json"]
    if not isinstance(definition, dict):
        raise ReportDefinitionInvalidError()

    try:
        rows, _ = report_engine.execute_report(
            definition, submitted_filters, {"page": 1, "page_size": 0}, runtime_token
        )
    except Exception as exc:
        raise ReportExportError(str(exc)) from exc

    columns = sorted(
        [c for c in definition.get("columns", []) if c.get("export", True)],
        key=lambda c: c.get("order", 0),
    )

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow([c["label"] for c in columns])
    for row in rows:
        writer.writerow([row.get(c["field"], "") for c in columns])

    csv_content = "﻿" + output.getvalue()

    output_cfg = definition.get("output", {}).get("export", {}).get("csv", {})
    from datetime import date
    filename_template = output_cfg.get("filename_template", f"{report_code}_{{date}}.csv")
    filename = filename_template.replace("{date}", date.today().isoformat())

    return csv_content, filename


def create_report_version(
    report_code: str,
    definition_json: dict,
    change_reason: str,
    created_by: str,
) -> dict[str, Any]:
    report = _get_report_or_raise(report_code)
    next_version = repository.fetch_next_version_number(report["id"])
    new_id = repository.insert_version(
        report["id"], next_version, definition_json, change_reason, created_by
    )
    return {"id": new_id, "version": next_version, "status": "draft"}


def activate_report_version(
    report_code: str,
    version: int,
    activated_by: str,
) -> dict[str, Any]:
    report = _get_report_or_raise(report_code)
    target = repository.fetch_version_by_number(report["id"], version)
    if not target:
        raise ReportVersionActivationError(version)
    if target["status"] == "archived":
        raise ReportVersionActivationError(version)

    repository.activate_version(report["id"], version, activated_by)
    return {"report_code": report_code, "activated_version": version}


def rollback_report(
    report_code: str,
    target_version: int,
    activated_by: str,
) -> dict[str, Any]:
    report = _get_report_or_raise(report_code)
    target = repository.fetch_version_by_number(report["id"], target_version)
    if not target:
        raise ReportVersionRollbackError(target_version)

    repository.rollback_version(report["id"], target_version, activated_by)
    return {"report_code": report_code, "restored_version": target_version}
