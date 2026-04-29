from __future__ import annotations

import logging
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
_OQL_SELECT_RE = re.compile(r"^\s*SELECT\s+([A-Za-z0-9_]+)\b", re.IGNORECASE)

_MAX_OQL_RESULTS = 2000
_COMPUTED_OQL_FIELDS = {"contact_id_friendlyname"}

logger = logging.getLogger(__name__)


def _sanitize_oql_value(value: str) -> str:
    if not _SAFE_VALUE_RE.match(str(value)):
        raise ReportFilterTypeError("value", "valor sin caracteres especiales")
    return str(value)


def _validate_definition(definition: dict[str, Any]) -> None:
    required_keys = {"metadata", "source", "filters", "columns", "output"}
    missing_keys = sorted(required_keys.difference(definition.keys()))
    if missing_keys:
        raise ReportDefinitionInvalidError(
            f"Faltan claves obligatorias en la definicion: {', '.join(missing_keys)}."
        )

    source = definition.get("source")
    if not isinstance(source, dict):
        raise ReportDefinitionInvalidError("La seccion 'source' debe ser un objeto.")

    source_mode = str(source.get("mode") or "").strip()
    if not source_mode:
        raise ReportDefinitionInvalidError("La seccion 'source.mode' es obligatoria.")

    if source_mode == "oql":
        if str(source.get("engine") or "").strip() != "itop":
            raise ReportDefinitionInvalidError("Los reportes OQL deben declarar source.engine='itop'.")
        if not str(source.get("alias") or "").strip():
            raise ReportDefinitionInvalidError("La seccion 'source.alias' es obligatoria para reportes OQL.")
        query_cfg = source.get("query")
        if not isinstance(query_cfg, dict):
            raise ReportDefinitionInvalidError("La seccion 'source.query' debe ser un objeto.")
        if not str(query_cfg.get("base_statement") or "").strip():
            raise ReportDefinitionInvalidError("La seccion 'source.query.base_statement' es obligatoria.")
    elif source_mode == "local":
        if not str(source.get("service_key") or "").strip():
            raise ReportDefinitionInvalidError("La seccion 'source.service_key' es obligatoria para reportes locales.")

    if not isinstance(definition.get("filters"), list):
        raise ReportDefinitionInvalidError("La seccion 'filters' debe ser una lista.")
    if not isinstance(definition.get("columns"), list) or not definition.get("columns"):
        raise ReportDefinitionInvalidError("La seccion 'columns' debe contener al menos una columna.")
    if not isinstance(definition.get("output"), dict):
        raise ReportDefinitionInvalidError("La seccion 'output' debe ser un objeto.")


def _extract_oql_class(base_statement: str) -> str:
    match = _OQL_SELECT_RE.match(base_statement.strip())
    if not match:
        raise ReportDefinitionInvalidError("La consulta OQL debe comenzar con 'SELECT Clase'.")
    return match.group(1)


def _build_report_output_fields(query_cfg: dict[str, Any], columns: list[dict[str, Any]]) -> str:
    configured_fields = [
        field.strip()
        for field in str(query_cfg.get("output_fields") or "*").split(",")
        if field.strip()
    ]
    if not configured_fields or configured_fields == ["*"]:
        return "*"

    filtered_fields = [field for field in configured_fields if field not in _COMPUTED_OQL_FIELDS]
    if any(col.get("field") in _COMPUTED_OQL_FIELDS for col in columns):
        filtered_fields = [field for field in filtered_fields if field not in _COMPUTED_OQL_FIELDS]

    order_by_fields = [
        chunk.strip().split()[0]
        for chunk in str(query_cfg.get("default_order_by") or "").split(",")
        if chunk.strip()
    ]
    filtered_fields.extend(field for field in order_by_fields if field)

    if "id" not in filtered_fields:
        filtered_fields.insert(0, "id")

    return ",".join(dict.fromkeys(filtered_fields))


def _parse_order_by(default_order_by: str) -> list[tuple[str, bool]]:
    order_clauses: list[tuple[str, bool]] = []
    for chunk in str(default_order_by or "").split(","):
        clause = chunk.strip()
        if not clause:
            continue
        parts = clause.split()
        field = parts[0].strip()
        direction = parts[1].strip().upper() if len(parts) > 1 else "ASC"
        order_clauses.append((field, direction == "DESC"))
    return order_clauses


def _sort_oql_items(items: list[Any], default_order_by: str) -> list[Any]:
    order_clauses = _parse_order_by(default_order_by)
    if not order_clauses:
        return items

    sorted_items = list(items)
    for field, reverse in reversed(order_clauses):
        sorted_items.sort(
            key=lambda item: str(item.get(field, "") if hasattr(item, "get") else getattr(item, field, "")).casefold(),
            reverse=reverse,
        )
    return sorted_items


def _build_oql_query(definition: dict, active_filters: dict[str, Any]) -> tuple[str, str]:
    source = definition["source"]
    query_cfg = source.get("query", {})
    base = query_cfg.get("base_statement", "").strip()
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

        if isinstance(value, list):
            if operator == "=" and value:
                parts = []
                for v in value:
                    try:
                        parts.append(f"{field} = '{_sanitize_oql_value(v)}'")
                    except Exception:
                        continue
                if parts:
                    conditions.append("(" + " OR ".join(parts) + ")")
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

    return oql, output_fields


def _normalize_oql_rows(
    itop_items: list,
    columns: list[dict[str, Any]],
    connector: iTopCMDBConnector,
) -> list[dict[str, Any]]:
    assigned_users_by_asset: dict[int, list[dict[str, str | int]]] = {}
    requested_fields = {str(col.get("field") or "").strip() for col in columns}
    if "contact_id_friendlyname" in requested_fields:
        from modules.assets.service import _load_asset_assigned_users

        asset_ids = [int(item.id) for item in itop_items if int(getattr(item, "id", 0) or 0) > 0]
        assigned_users_by_asset = _load_asset_assigned_users(connector, asset_ids)

    rows = []
    for item in itop_items:
        row: dict[str, Any] = {}
        for col in columns:
            field = col["field"]
            if field == "contact_id_friendlyname":
                contacts = assigned_users_by_asset.get(int(item.id), [])
                row[field] = ", ".join(
                    str(contact.get("name") or "").strip()
                    for contact in contacts
                    if str(contact.get("name") or "").strip()
                )
                continue
            row[field] = item.get(field, "") if hasattr(item, "get") else getattr(item, "fields", {}).get(field, "")
        rows.append(row)
    return rows


def execute_oql_report(
    definition: dict,
    active_filters: dict[str, Any],
    pagination: dict,
    runtime_token: str,
) -> tuple[list[dict], int]:
    oql, _ = _build_oql_query(definition, active_filters)
    columns = definition.get("columns", [])
    query_cfg = definition.get("source", {}).get("query", {})
    output_fields = _build_report_output_fields(query_cfg, columns)
    ci_class = _extract_oql_class(query_cfg.get("base_statement", ""))
    default_order_by = str(query_cfg.get("default_order_by") or "").strip()

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
        try:
            logger.info(
                "Report OQL execution prepared: source_mode=oql class=%s output_fields=%s filters=%s oql=%s",
                ci_class,
                output_fields,
                active_filters,
                oql,
            )
            response = connector.get(ci_class, oql, output_fields=output_fields)
            if not response.ok:
                raise ReportOQLError(response.message or "iTop rechazo la consulta OQL.")
            items = _sort_oql_items(response.items(), default_order_by)
        except Exception as exc:
            error_str = str(exc)
            if "connect" in error_str.lower() or "timeout" in error_str.lower():
                raise ReportITopConnectionError(error_str) from exc
            if isinstance(exc, ReportOQLError):
                raise
            raise ReportOQLError(error_str) from exc

        total = len(items)
        page = max(1, int(pagination.get("page", 1)))
        page_size_raw = int(pagination.get("page_size", 100))
        if page_size_raw <= 0:
            page_items = items
            page_size = total
        else:
            page_size = max(1, min(1000, page_size_raw))
            start = (page - 1) * page_size
            page_items = items[start : start + page_size]

        rows = _normalize_oql_rows(page_items, columns, connector)
    finally:
        connector.close()

    logger.info(
        "Report OQL execution completed: returned=%s normalized=%s page=%s page_size=%s",
        total,
        len(rows),
        page,
        page_size,
    )
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

        if isinstance(value, str):
            value = value.strip()
            if value == "":
                value = None

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
    _validate_definition(definition)
    source_mode = definition.get("source", {}).get("mode", "")

    if source_mode == "unsupported":
        reason = definition["source"].get("unsupported_reason", "")
        raise ReportUnsupportedError(definition.get("id", ""), reason)

    active_filters = validate_and_collect_filters(definition, submitted_filters)
    logger.info(
        "Executing report definition: report_id=%s source_mode=%s filters_received=%s filters_applied=%s pagination=%s",
        definition.get("id", ""),
        source_mode,
        submitted_filters,
        active_filters,
        pagination,
    )

    if source_mode == "oql":
        return execute_oql_report(definition, active_filters, pagination, runtime_token)
    if source_mode == "local":
        return execute_local_report(definition, active_filters, pagination)
    if source_mode == "mixed":
        raise ReportUnsupportedError(definition.get("id", ""), "El modo 'mixed' no esta disponible en Fase 1.")

    raise ReportDefinitionInvalidError(f"Modo de fuente desconocido: '{source_mode}'.")


def build_public_definition(definition: dict) -> dict:
    _validate_definition(definition)
    return {
        "filters": [
            {
                "name": f["name"],
                "label": f["label"],
                "type": f["type"],
                "required": f.get("required", False),
                "placeholder": f.get("placeholder"),
                "options": f.get("options"),
                "options_source": f.get("options_source"),
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
                    "wide": c.get("wide", False),
                    "link": c.get("link"),
                }
                for c in definition.get("columns", [])
            ],
            key=lambda c: c["order"],
        ),
        "output": definition.get("output", {}),
    }
