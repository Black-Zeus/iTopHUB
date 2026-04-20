from __future__ import annotations

from typing import Any

from integrations.itop_cmdb_connector import iTopCMDBConnector
from integrations.itop_runtime import get_itop_runtime_config


REQUIREMENT_ORIGIN_OPTIONS = [
    {"value": "chat", "label": "Chat"},
    {"value": "mail", "label": "Correo-e"},
    {"value": "in_person", "label": "En persona"},
    {"value": "portal", "label": "Portal"},
    {"value": "phone", "label": "Telefono"},
]

REQUIREMENT_IMPACT_OPTIONS = [
    {"value": "person", "label": "Una Persona"},
    {"value": "department", "label": "Un Departamento"},
    {"value": "service", "label": "Un Servicio"},
]

REQUIREMENT_URGENCY_OPTIONS = [
    {"value": "low", "label": "Baja"},
    {"value": "medium", "label": "Media"},
    {"value": "high", "label": "Alta"},
]

REQUIREMENT_PRIORITY_OPTIONS = [
    {"value": "low", "label": "Baja"},
    {"value": "medium", "label": "Media"},
    {"value": "high", "label": "Alta"},
]


def _normalize_space(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def _build_connector(runtime_token: str) -> iTopCMDBConnector:
    runtime_config = get_itop_runtime_config()
    base_url = str(runtime_config.get("integrationUrl") or "").strip()
    if not base_url:
        raise ValueError("La URL de iTop no esta configurada.")
    return iTopCMDBConnector(
        base_url=base_url,
        token=runtime_token,
        verify_ssl=bool(runtime_config.get("verifySsl", True)),
        timeout=int(runtime_config.get("timeoutSeconds") or 30),
    )


def _is_active_status(value: Any) -> bool:
    normalized = str(value or "").strip().lower()
    return normalized in {"", "active", "production", "enabled"}


def _serialize_option(value: Any, label: Any, **extra: Any) -> dict[str, Any] | None:
    normalized_value = str(value or "").strip()
    normalized_label = _normalize_space(label)
    if not normalized_value or not normalized_label:
        return None
    return {
        "value": normalized_value,
        "label": normalized_label,
        **extra,
    }


def _list_active_organizations(connector: iTopCMDBConnector) -> list[dict[str, Any]]:
    items = connector.list_organizations(output_fields="id,name,friendlyname,code,status")
    options: list[dict[str, Any]] = []
    for item in items:
        if not _is_active_status(item.get("status")):
            continue
        option = _serialize_option(
            item.id,
            item.get("friendlyname") or item.get("name"),
            code=_normalize_space(item.get("code")),
            status=str(item.get("status") or "").strip().lower(),
        )
        if option:
            options.append(option)
    options.sort(key=lambda item: item["label"].casefold())
    return options


def _list_services(connector: iTopCMDBConnector) -> list[dict[str, Any]]:
    response = connector.oql("SELECT Service", output_fields="id,name,friendlyname,status")
    options: list[dict[str, Any]] = []
    for item in response:
        if not _is_active_status(item.get("status")):
            continue
        option = _serialize_option(
            item.id,
            item.get("friendlyname") or item.get("name"),
            status=str(item.get("status") or "").strip().lower(),
        )
        if option:
            options.append(option)
    options.sort(key=lambda item: item["label"].casefold())
    return options


def _list_service_subcategories(connector: iTopCMDBConnector) -> list[dict[str, Any]]:
    response = connector.oql(
        "SELECT ServiceSubcategory",
        output_fields="id,name,friendlyname,status,service_id,service_id_friendlyname",
    )
    options: list[dict[str, Any]] = []
    for item in response:
        if not _is_active_status(item.get("status")):
            continue
        service_id = str(item.get("service_id") or "").strip()
        option = _serialize_option(
            item.id,
            item.get("friendlyname") or item.get("name"),
            serviceId=service_id,
            serviceName=_normalize_space(item.get("service_id_friendlyname")),
            status=str(item.get("status") or "").strip().lower(),
        )
        if option:
            options.append(option)
    options.sort(key=lambda item: item["label"].casefold())
    return options


def get_requirement_itop_catalog(runtime_token: str) -> dict[str, Any]:
    connector = _build_connector(runtime_token)
    organizations = _list_active_organizations(connector)

    try:
        services = _list_services(connector)
    except Exception:
        services = []

    try:
        service_subcategories = _list_service_subcategories(connector)
    except Exception:
        service_subcategories = []

    return {
        "organizations": organizations,
        "origins": REQUIREMENT_ORIGIN_OPTIONS,
        "services": services,
        "serviceSubcategories": service_subcategories,
        "teams": [],
        "impacts": REQUIREMENT_IMPACT_OPTIONS,
        "urgencies": REQUIREMENT_URGENCY_OPTIONS,
        "priorities": REQUIREMENT_PRIORITY_OPTIONS,
    }
