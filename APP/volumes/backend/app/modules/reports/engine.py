from __future__ import annotations

import re
from typing import Any

from integrations.itop_cmdb_connector import iTopCMDBConnector
from integrations.itop_runtime import get_itop_runtime_config

from modules.reports.errors import (
    ReportDefinitionInvalidError,
    ReportFilterRequiredError,
    ReportFilterTypeError,
    ReportITopConnectionError,
    ReportLocalQueryError,
    ReportOQLError,
    ReportUnsupportedError,
)
from modules.reports.local_queries import QUERY_REGISTRY

_ALLOWED_OQL_OPERATORS = {"=", "!=", "contains", "starts_with", "<=", ">=", "<", ">"}
_SAFE_VALUE_RE = re.compile(r"^[^'\";\\\x00-\x1f]+$")

_MAX_OQL_RESULTS = 2000


def _sanitize_oql_value(value: str) -> str:
    if not _SAFE_VALUE_RE.match(str(value)):
        raise ReportFilterTypeError("value", "valor sin caracteres especiales")
    return str(value)


def _build_oql_query(definition: dict, active_filters: dict[str, Any]) -> tuple[str, str]:
    source = definition["source"]
    query_cfg = source.get("query", {})
    base = query_cfg.get("base_statement", "").strip()
    order_by = query_cfg.get("default_order_by", "")
    output_fields = query_cfg.get("output_fields", "*")

    if not base:
        raise ReportDefinitionInvalidError("La definicion OQL no tiene base_statement.")

    conditions: list[str] = []
    for f in definition.get("filters", []):
        if not f.get("enabled", True):
            continue

        name = f["name"]
        apply_when = f.get("apply_when", "always")
        value = active_filters.get(name)

        if apply_when == "has_value" and not value:
            continue

        target = f.get("target")
        if not target:
            continue

        field = target.get("field", "")
        operator = target.get("operator", "=")

        if operator not in _ALLOWED_OQL_OPERATORS:
            continue
        if not field or value is None:
            continue

        safe_val = _sanitize_oql_value(value)

        if operator == "=":
            conditions.append(f"{field} = '{safe_val}'")
        elif operator == "!=":
            conditions.append(f"{field} != '{safe_val}'")
        elif operator == "contains":
            conditions.append(f"{field} LIKE '%{safe_val}%'")
        elif operator == "starts_with":
            conditions.append(f"{field} LIKE '{safe_val}%'")
        elif operator in ("<=", ">=", "<", ">"):
            conditions.append(f"{field} {operator} '{safe_val}'")

    oql = base
    if conditions:
        has_where = "WHERE" in base.upper()
        conjunction = " AND " if has_where else " WHERE "
        oql += conjunction + " AND ".join(conditions)

    if order_by:
        oql += f" ORDER BY {order_by}"

    return oql, output_fields


def _normalize_oql_rows(itop_items: list, columns: list[dict]) -> list[dict[str, Any]]:
    rows = []
    for item in itop_items:
        row: dict[str, Any] = {}
        for col in columns:
            field = col["field"]
            row[field] = item.get(field, "") if hasattr(item, "get") else getattr(item, "fields", {}).get(field, "")
        rows.append(row)
    return rows


def execute_oql_report(
    definition: dict,
    active_filters: dict[str, Any],
    pagination: dict,
    runtime_token: str,
) -> tuple[list[dict], int]:
    oql, output_fields = _build_oql_query(definition, active_filters)
    columns = definition.get("columns", [])

    try:
        itop_config = get_itop_runtime_config()
        connector = iTopCMDBConnector(
            base_url=itop_config["integrationUrl"],
            token=runtime_token,
            username="hub-reports",
            verify_ssl=itop_config["verifySsl"],
            timeout=itop_config["timeoutSeconds"],
        )
    except Exception as exc:
        raise ReportITopConnectionError(str(exc)) from exc

    try:
        items = connector.oql(oql, output_fields=output_fields)
    except Exception as exc:
        error_str = str(exc)
        if "connect" in error_str.lower() or "timeout" in error_str.lower():
            raise ReportITopConnectionError(error_str) from exc
        raise ReportOQLError(error_str) from exc
    finally:
        connector.close()

    total = len(items)
    page = max(1, int(pagination.get("page", 1)))
    page_size = max(1, min(500, int(pagination.get("page_size", 50))))
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]

    rows = _normalize_oql_rows(page_items, columns)
    return rows, total


def execute_local_report(
    definition: dict,
    active_filters: dict[str, Any],
    pagination: dict,
) -> tuple[list[dict], int]:
    source = definition["source"]
    service_key = source.get("service_key", "")

    query_fn = QUERY_REGISTRY.get(service_key)
    if query_fn is None:
        raise ReportLocalQueryError(f"Clave de consulta '{service_key}' no registrada.")

    try:
        return query_fn(active_filters, pagination)
    except Exception as exc:
        raise ReportLocalQueryError(str(exc)) from exc


def validate_and_collect_filters(
    definition: dict,
    submitted_filters: dict[str, Any],
) -> dict[str, Any]:
    filter_defs = {f["name"]: f for f in definition.get("filters", [])}
    active: dict[str, Any] = {}

    for name, filter_def in filter_defs.items():
        if not filter_def.get("enabled", True):
            continue
        value = submitted_filters.get(name)
        is_required = filter_def.get("required", False)

        if is_required and not value:
            raise ReportFilterRequiredError(name)

        if value is not None:
            active[name] = value

    return active


def execute_report(
    definition: dict,
    submitted_filters: dict[str, Any],
    pagination: dict,
    runtime_token: str,
) -> tuple[list[dict], int]:
    source_mode = definition.get("source", {}).get("mode", "")

    if source_mode == "unsupported":
        reason = definition["source"].get("unsupported_reason", "")
        raise ReportUnsupportedError(definition.get("id", ""), reason)

    active_filters = validate_and_collect_filters(definition, submitted_filters)

    if source_mode == "oql":
        return execute_oql_report(definition, active_filters, pagination, runtime_token)
    if source_mode == "local":
        return execute_local_report(definition, active_filters, pagination)
    if source_mode == "mixed":
        raise ReportUnsupportedError(definition.get("id", ""), "El modo 'mixed' no esta disponible en Fase 1.")

    raise ReportDefinitionInvalidError(f"Modo de fuente desconocido: '{source_mode}'.")


def build_public_definition(definition: dict) -> dict:
    return {
        "filters": [
            {
                "name": f["name"],
                "label": f["label"],
                "type": f["type"],
                "required": f.get("required", False),
                "placeholder": f.get("placeholder"),
                "options": f.get("options"),
            }
            for f in definition.get("filters", [])
            if f.get("enabled", True)
        ],
        "columns": sorted(
            [
                {
                    "field": c["field"],
                    "label": c["label"],
                    "order": c.get("order", 0),
                    "visible": c.get("visible", True),
                    "export": c.get("export", True),
                    "format": c.get("format", "text"),
                    "align": c.get("align", "left"),
                }
                for c in definition.get("columns", [])
            ],
            key=lambda c: c["order"],
        ),
        "output": definition.get("output", {}),
    }
