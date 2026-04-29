from __future__ import annotations

import csv
import io
import logging
import math
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


_ITOP_STATUS_LABELS: dict[str, str] = {
    "production": "Produccion",
    "stock": "En stock",
    "implementation": "En implementacion",
    "obsolete": "Obsoleto",
    "repair": "En reparacion",
    "test": "En prueba",
    "inactive": "Inactivo",
    "disposed": "Eliminado",
}


def _fetch_itop_asset_states(runtime_token: str) -> list[dict[str, Any]]:
    from integrations.itop_cmdb_connector import iTopCMDBConnector
    from integrations.itop_runtime import get_itop_runtime_config

    itop_config = get_itop_runtime_config()
    connector = iTopCMDBConnector(
        base_url=itop_config["integrationUrl"],
        token=runtime_token,
        username="hub-reports",
        verify_ssl=itop_config["verifySsl"],
        timeout=itop_config["timeoutSeconds"],
    )
    try:
        response = connector.get("PhysicalDevice", "SELECT PhysicalDevice", output_fields="id,status")
        if not response.ok:
            return []
        statuses = sorted({
            str(item.get("status") or "").strip()
            for item in response.items()
            if str(item.get("status") or "").strip()
        })
        return [
            {"label": _ITOP_STATUS_LABELS.get(s, s), "value": s}
            for s in statuses
        ]
    finally:
        connector.close()


def get_filter_options(source_key: str, runtime_token: str | None = None) -> list[dict[str, Any]]:
    if source_key == "cmdb_enabled_asset_types":
        from modules.settings.service import get_settings_panel
        cmdb = get_settings_panel("cmdb")
        options: list[dict[str, Any]] = []
        for item_str in cmdb.get("enabledAssetTypes", []):
            item_str = item_str.strip()
            paren_idx = item_str.rfind("(")
            if paren_idx > 0 and item_str.endswith(")"):
                label = item_str[:paren_idx].strip()
                value = item_str[paren_idx + 1:-1].strip()
            else:
                label = item_str
                value = item_str
            if label and value:
                options.append({"label": label, "value": value})
        return options

    if source_key == "itop_asset_states":
        if runtime_token:
            try:
                states = _fetch_itop_asset_states(runtime_token)
                if states:
                    return states
            except Exception:
                logger.warning("Could not fetch itop_asset_states from iTop, falling back to default list")
        return [{"label": v, "value": k} for k, v in _ITOP_STATUS_LABELS.items()]

    return []


def _apply_cmdb_scope(definition: dict, submitted_filters: dict[str, Any]) -> dict[str, Any]:
    augmented = dict(submitted_filters)
    for f in definition.get("filters", []):
        if not f.get("enabled", True):
            continue
        name = f["name"]
        if name in augmented:
            continue
        source_cfg = f.get("options_source") or {}
        if source_cfg.get("source") == "cmdb_enabled_asset_types":
            options = get_filter_options("cmdb_enabled_asset_types")
            values = [o["value"] for o in options if o.get("value")]
            if values:
                augmented[name] = values
    return augmented


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

    scoped_filters = _apply_cmdb_scope(definition, submitted_filters)
    rows, total = report_engine.execute_report(definition, scoped_filters, pagination, runtime_token)

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
            "link": c.get("link"),
        }
        for c in columns
    ]

    page = max(1, int(pagination.get("page", 1)))
    page_size = max(1, min(1000, int(pagination.get("page_size", 100))))
    total_pages = max(1, math.ceil(total / page_size)) if total > 0 else 0

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
        "total_pages": total_pages,
        "page": page,
        "page_size": page_size,
    }


def export_report_csv(
    report_code: str,
    submitted_filters: dict[str, Any],
    runtime_token: str,
    scope: str = "all",
    pagination: dict[str, Any] | None = None,
) -> tuple[str, str]:
    report = _require_active_report(report_code)
    version = _get_active_version_or_raise(report["id"])
    definition = version["definition_json"]
    if not isinstance(definition, dict):
        raise ReportDefinitionInvalidError()

    export_pagination = pagination if scope == "current_page" and pagination else {"page": 1, "page_size": 0}
    scoped_filters = _apply_cmdb_scope(definition, submitted_filters)

    try:
        rows, _ = report_engine.execute_report(
            definition, scoped_filters, export_pagination, runtime_token
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

    csv_content = output.getvalue()

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
