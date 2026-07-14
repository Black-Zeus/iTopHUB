from __future__ import annotations

import hashlib
import time
from concurrent.futures import ThreadPoolExecutor
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
    {"value": "3", "label": "Una Persona"},
    {"value": "1", "label": "Un Departamento"},
    {"value": "2", "label": "Un Servicio"},
]

REQUIREMENT_URGENCY_OPTIONS = [
    {"value": "4", "label": "Baja"},
    {"value": "3", "label": "Media"},
    {"value": "2", "label": "Alta"},
    {"value": "1", "label": "Critica"},
]

REQUIREMENT_PRIORITY_OPTIONS = [
    {"value": "4", "label": "Baja"},
    {"value": "3", "label": "Media"},
    {"value": "2", "label": "Alta"},
    {"value": "1", "label": "Critica"},
]

ITOP_ASSET_STATUS_LABELS = {
    "production": "En produccion",
    "stock": "En stock",
    "implementation": "En implementacion",
    "obsolete": "Obsoleto",
    "repair": "En reparacion",
    "test": "En prueba",
    "inactive": "Inactivo",
}

_CATALOG_CACHE_TTL_SECONDS = 120
_catalog_cache: dict[tuple[str, str], tuple[float, Any]] = {}


def _cache_key(name: str, runtime_token: str) -> tuple[str, str]:
    token_hash = hashlib.sha256(str(runtime_token or "").encode("utf-8")).hexdigest()[:16]
    return name, token_hash


def _get_cached_catalog(name: str, runtime_token: str) -> Any:
    key = _cache_key(name, runtime_token)
    cached = _catalog_cache.get(key)
    if not cached:
        return None
    expires_at, value = cached
    if expires_at <= time.monotonic():
        _catalog_cache.pop(key, None)
        return None
    return value


def _set_cached_catalog(name: str, runtime_token: str, value: Any) -> Any:
    _catalog_cache[_cache_key(name, runtime_token)] = (
        time.monotonic() + _CATALOG_CACHE_TTL_SECONDS,
        value,
    )
    return value


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
        output_fields="id,name,friendlyname,status,service_id,service_id_friendlyname,request_type",
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
            requestType=str(item.get("request_type") or "").strip().lower(),
            status=str(item.get("status") or "").strip().lower(),
        )
        if option:
            options.append(option)
    options.sort(key=lambda item: item["label"].casefold())
    return options


def _load_catalog_with_connector(runtime_token: str, loader_name: str) -> list[dict[str, Any]]:
    connector = _build_connector(runtime_token)
    try:
        if loader_name == "organizations":
            return _list_active_organizations(connector)
        if loader_name == "services":
            return _list_services(connector)
        if loader_name == "service_subcategories":
            return _list_service_subcategories(connector)
        return []
    finally:
        connector.close()


def _load_requirement_catalog_parts(runtime_token: str) -> dict[str, list[dict[str, Any]]]:
    loaders = {
        "organizations": "organizations",
        "services": "services",
        "serviceSubcategories": "service_subcategories",
    }
    results: dict[str, list[dict[str, Any]]] = {}
    with ThreadPoolExecutor(max_workers=len(loaders)) as executor:
        futures = {
            key: executor.submit(_load_catalog_with_connector, runtime_token, loader_name)
            for key, loader_name in loaders.items()
        }
        for key, future in futures.items():
            try:
                results[key] = future.result()
            except Exception:
                results[key] = []
    return results


def list_itop_asset_status_options(runtime_token: str) -> list[dict[str, Any]]:
    cached = _get_cached_catalog("asset-status-options", runtime_token)
    if cached is not None:
        return list(cached)

    connector = _build_connector(runtime_token)
    try:
        response = connector.get("PhysicalDevice", "SELECT PhysicalDevice", output_fields="id,status")
        if not response.ok:
            status_values = sorted(ITOP_ASSET_STATUS_LABELS.keys())
        else:
            status_values = sorted({
                str(item.get("status") or "").strip().lower()
                for item in response.items()
                if str(item.get("status") or "").strip()
            })
            if not status_values:
                status_values = sorted(ITOP_ASSET_STATUS_LABELS.keys())

        return _set_cached_catalog("asset-status-options", runtime_token, [
            {"value": value, "label": ITOP_ASSET_STATUS_LABELS.get(value, value)}
            for value in status_values
        ])
    finally:
        connector.close()


def list_itop_location_options(runtime_token: str) -> list[dict[str, Any]]:
    cached = _get_cached_catalog("location-options", runtime_token)
    if cached is not None:
        return list(cached)

    connector = _build_connector(runtime_token)
    try:
        items = connector.list_locations(output_fields="id,name,friendlyname,org_id_friendlyname,city,country")
        options: list[dict[str, Any]] = []
        for item in items:
            name = _normalize_space(item.get("friendlyname") or item.get("name"))
            organization_name = _normalize_space(item.get("org_id_friendlyname"))
            city = _normalize_space(item.get("city"))
            country = _normalize_space(item.get("country"))
            context_parts = [part for part in [organization_name, city, country] if part]
            label = name if not context_parts else f"{name} / {' / '.join(context_parts)}"
            option = _serialize_option(
                item.id,
                label,
                name=name,
                organizationName=organization_name,
                city=city,
                country=country,
            )
            if option:
                options.append(option)

        options.sort(key=lambda item: item["label"].casefold())
        return _set_cached_catalog("location-options", runtime_token, options)
    finally:
        connector.close()


def get_requirement_itop_catalog(runtime_token: str) -> dict[str, Any]:
    cached = _get_cached_catalog("requirement-catalog", runtime_token)
    if cached is not None:
        return dict(cached)

    parts = _load_requirement_catalog_parts(runtime_token)
    return _set_cached_catalog("requirement-catalog", runtime_token, {
        "organizations": parts.get("organizations") or [],
        "origins": REQUIREMENT_ORIGIN_OPTIONS,
        "services": parts.get("services") or [],
        "serviceSubcategories": parts.get("serviceSubcategories") or [],
        "teams": [],
        "impacts": REQUIREMENT_IMPACT_OPTIONS,
        "urgencies": REQUIREMENT_URGENCY_OPTIONS,
        "priorities": REQUIREMENT_PRIORITY_OPTIONS,
    })
