from __future__ import annotations

import logging
from typing import Any

from modules.cmdb_visibility import (
    is_visible_ci_status,
    should_show_implementation_assets,
    should_show_obsolete_assets,
)
from modules.auth.service import AuthenticationError
from integrations.itop_cmdb_connector import iTopCMDBConnector
from integrations.itop_runtime import get_itop_runtime_config
from modules.people.service import _build_ci_detail, _format_ci_status

logger = logging.getLogger(__name__)

CMDB_TYPE_RULES: dict[str, dict[str, set[str]]] = {
    "Desktop (PC)": {
        "classes": {"pc", "desktop"},
        "types": {"desktop"},
    },
    "Laptop (Laptop)": {
        "classes": {"pc", "laptop"},
        "types": {"laptop"},
    },
    "Tableta (Tablet)": {
        "classes": {"tablet"},
        "types": {"tablet"},
    },
    "Celular (MobilePhone)": {
        "classes": {"mobilephone", "phone"},
        "types": {"phone", "mobile phone", "mobile_phone", "cell phone", "smartphone"},
    },
    "Impresora (Printer)": {
        "classes": {"printer"},
        "types": set(),
    },
    "Periferico (Peripheral)": {
        "classes": {"peripheral"},
        "types": set(),
    },
}

CMDB_QUERY_MAP: dict[str, list[str]] = {
    "Desktop (PC)": ["PC"],
    "Laptop (Laptop)": ["PC"],
    "Tableta (Tablet)": ["Tablet"],
    "Celular (MobilePhone)": ["MobilePhone"],
    "Impresora (Printer)": ["Printer"],
    "Periferico (Peripheral)": ["Peripheral"],
}


def _normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _normalize_space(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def _escape_oql(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


def _safe_int(value: Any) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return 0


def _build_asset_query_conditions(query: str) -> list[str]:
    tokens = [token for token in query.split() if token]
    if not tokens:
        return []

    conditions: list[str] = []
    for token in tokens:
        safe = _escape_oql(token)
        conditions.append(
            "("
            f"friendlyname = '{safe}' OR "
            f"name = '{safe}' OR "
            f"asset_number = '{safe}' OR "
            f"serialnumber = '{safe}' OR "
            f"friendlyname LIKE '{safe}%' OR "
            f"name LIKE '{safe}%' OR "
            f"asset_number LIKE '{safe}%' OR "
            f"serialnumber LIKE '{safe}%'"
            ")"
        )
    return conditions


def _resolve_asset_type_label(item, enabled_labels: list[str]) -> str:
    finalclass = _normalize_text(item.get("finalclass") or item.itop_class)
    ci_type = _normalize_text(item.get("type"))
    labels_to_check = enabled_labels or list(CMDB_TYPE_RULES.keys())

    for label in labels_to_check:
        rule = CMDB_TYPE_RULES.get(label)
        if not rule:
            continue
        if finalclass in rule["classes"]:
            if not rule["types"] or ci_type in rule["types"]:
                return label
        if ci_type and ci_type in rule["classes"]:
            return label

    if finalclass == "pc":
        if ci_type == "laptop":
            return "Laptop (Laptop)"
        if ci_type == "desktop":
            return "Desktop (PC)"

    if finalclass:
        return str(item.get("finalclass") or item.itop_class).strip()

    return "Objeto CMDB"


def _matches_enabled_asset_types(item, enabled_labels: list[str]) -> bool:
    if not enabled_labels:
        return True
    return _resolve_asset_type_label(item, enabled_labels) in enabled_labels


def _matches_asset_query(item, query: str) -> bool:
    tokens = [token.casefold() for token in query.split() if token]
    if not tokens:
        return True

    haystack = " ".join(
        [
            str(item.get("friendlyname") or ""),
            str(item.get("name") or ""),
            str(item.get("finalclass") or ""),
            str(item.get("type") or ""),
            str(item.get("asset_number") or ""),
            str(item.get("serialnumber") or ""),
            str(item.get("brand_id_friendlyname") or item.get("brand_name") or ""),
            str(item.get("model_id_friendlyname") or item.get("model_name") or ""),
            str(item.get("org_id_friendlyname") or item.get("organization_name") or ""),
            str(item.get("location_id_friendlyname") or item.get("location_name") or ""),
        ]
    ).casefold()

    return all(token in haystack for token in tokens)


def _build_asset_row(item, enabled_labels: list[str], assigned_contacts: list[dict[str, str | int]] | None = None) -> dict[str, str | int | list[dict[str, str | int]]]:
    label = _resolve_asset_type_label(item, enabled_labels)
    asset_number = _normalize_space(item.get("asset_number"))
    warranty_end = _normalize_space(item.get("end_of_warranty"))
    contact_items = assigned_contacts or []
    normalized_assigned_user = ", ".join(
        name
        for name in [
            _normalize_space(contact.get("name"))
            for contact in contact_items
        ]
        if name
    )

    return {
        "id": item.id,
        "code": asset_number or f"CI-{int(item.id):05d}",
        "name": _normalize_space(item.get("friendlyname") or item.get("name") or f"Objeto {item.id}"),
        "className": label,
        "brand": _normalize_space(item.get("brand_id_friendlyname") or item.get("brand_name")),
        "model": _normalize_space(item.get("model_id_friendlyname") or item.get("model_name")),
        "brandModel": " / ".join(
            part
            for part in [
                _normalize_space(item.get("brand_id_friendlyname") or item.get("brand_name")),
                _normalize_space(item.get("model_id_friendlyname") or item.get("model_name")),
            ]
            if part
        ),
        "serial": _normalize_space(item.get("serialnumber")),
        "organization": _normalize_space(item.get("org_id_friendlyname") or item.get("organization_name")),
        "location": _normalize_space(item.get("location_id_friendlyname") or item.get("location_name")),
        "assignedUser": normalized_assigned_user or "Sin asignar",
        "assignedUsers": contact_items,
        "warrantyDate": warranty_end or "Sin dato",
        "status": _format_ci_status(item.get("status")),
    }


def _build_contact_row(item) -> dict[str, str | int]:
    status_value = _normalize_space(item.get("status")).capitalize() or "Sin dato"
    class_name = _normalize_space(item.get("finalclass") or item.itop_class)
    return {
        "id": item.id,
        "name": _normalize_space(item.get("friendlyname") or item.get("name") or f"Persona {item.id}"),
        "email": _normalize_space(item.get("email")),
        "role": _normalize_space(item.get("function")),
        "status": status_value,
        "className": class_name,
    }


def _load_change_index(connector: iTopCMDBConnector, change_ids: list[int]) -> dict[int, dict[str, str]]:
    normalized_ids = sorted({change_id for change_id in change_ids if change_id > 0})
    change_index: dict[int, dict[str, str]] = {}
    for change_id in normalized_ids:
        change = connector.get("CMDBChange", change_id, output_fields="*").first()
        if not change:
            continue
        change_index[change_id] = {
            "changedAt": str(change.get("date") or "").strip(),
            "changedBy": _normalize_space(change.get("userinfo")),
            "origin": _normalize_space(change.get("origin")),
        }
    return change_index


def _load_asset_contact_history(
    connector: iTopCMDBConnector,
    asset_class: str,
    asset_id: int,
) -> list[dict[str, str | int]]:
    safe_asset_class = _escape_oql(asset_class)
    history_items: list[dict[str, str | int]] = []

    create_ops = connector.oql(
        f"SELECT CMDBChangeOpCreate WHERE objclass = '{safe_asset_class}' AND objkey = {asset_id}",
        output_fields="*",
    )
    create_change_index = _load_change_index(
        connector,
        [_safe_int(item.get("change") or item.get("change_id")) for item in create_ops],
    )
    for operation in create_ops:
        change_id = _safe_int(operation.get("change") or operation.get("change_id"))
        change_info = create_change_index.get(change_id, {})
        history_items.append(
            {
                "id": int(operation.id),
                "contactId": 0,
                "contactName": "Objeto creado",
                "contactEmail": "",
                "contactRole": "",
                "action": "Creado",
                "changedAt": str(change_info.get("changedAt") or "").strip(),
                "changedBy": str(change_info.get("changedBy") or "").strip(),
                "origin": str(change_info.get("origin") or "").strip(),
                "contactStatus": "",
            }
        )

    link_ops = connector.oql(
        f"SELECT CMDBChangeOpSetAttributeLinksAddRemove WHERE objclass = '{safe_asset_class}' AND objkey = {asset_id}",
        output_fields="*",
    )
    link_change_index = _load_change_index(
        connector,
        [_safe_int(item.get("change") or item.get("change_id")) for item in link_ops],
    )

    for operation in link_ops:
        item_class = _normalize_space(operation.get("item_class"))
        if item_class.lower() not in {"contact", "person"}:
            continue

        contact_id = _safe_int(operation.get("item_id") or operation.get("contact_id"))
        contact = connector.get(
            "Contact",
            contact_id,
            output_fields="id,name,friendlyname,email,function,status,finalclass",
        ).first()
        contact_row = _build_contact_row(contact) if contact else {
            "id": contact_id,
            "name": f"Contacto {contact_id}",
            "email": "",
            "role": "",
            "status": "",
            "className": "",
        }
        change_id = _safe_int(operation.get("change") or operation.get("change_id"))
        change_info = link_change_index.get(change_id, {})
        action_type = _normalize_space(operation.get("type")).lower()
        history_items.append(
            {
                "id": int(operation.id),
                "contactId": int(contact_row.get("id") or 0),
                "contactName": str(contact_row.get("name") or f"Contacto {contact_id}"),
                "contactEmail": str(contact_row.get("email") or ""),
                "contactRole": str(contact_row.get("role") or ""),
                "action": "Agregado" if action_type == "added" else "Removido",
                "changedAt": str(change_info.get("changedAt") or "").strip(),
                "changedBy": str(change_info.get("changedBy") or "").strip(),
                "origin": str(change_info.get("origin") or "").strip(),
                "contactStatus": str(contact_row.get("status") or ""),
            }
        )

    history_items.sort(
        key=lambda item: (
            str(item.get("changedAt") or ""),
            int(item.get("id") or 0),
        ),
        reverse=True,
    )
    return history_items


_USERS_BATCH_SIZE = 50


def _load_asset_assigned_users(connector: iTopCMDBConnector, asset_ids: list[int]) -> dict[int, list[dict[str, str | int]]]:
    normalized_ids = sorted({int(asset_id) for asset_id in asset_ids if int(asset_id) > 0})
    if not normalized_ids:
        return {}

    contacts_by_asset: dict[int, list[dict[str, str | int]]] = {}

    for chunk_start in range(0, len(normalized_ids), _USERS_BATCH_SIZE):
        chunk = normalized_ids[chunk_start : chunk_start + _USERS_BATCH_SIZE]
        where = " OR ".join(f"l.functionalci_id = {aid}" for aid in chunk)
        try:
            links = connector.oql(
                f"SELECT lnkContactToFunctionalCI AS l WHERE {where}",
                output_fields="contact_id,contact_id_friendlyname,functionalci_id",
            )
        except Exception:
            logger.warning(
                "_load_asset_assigned_users: batch query failed for chunk starting at index %s, skipping",
                chunk_start,
            )
            continue

        for link in links:
            ci_id = int(link.get("functionalci_id") or 0)
            contact_id = int(link.get("contact_id") or 0)
            contact_name = _normalize_space(link.get("contact_id_friendlyname") or "")
            if ci_id <= 0 or not contact_name:
                continue
            bucket = contacts_by_asset.setdefault(ci_id, [])
            if not any(int(existing.get("id") or 0) == contact_id for existing in bucket):
                bucket.append({"id": contact_id, "name": contact_name})

    return contacts_by_asset


def _list_assigned_user_catalog(connector: iTopCMDBConnector, asset_ids: list[int]) -> list[dict[str, str]]:
    assigned_users_by_asset = _load_asset_assigned_users(connector, asset_ids)
    unique_names = sorted(
        {
            name.strip()
            for contacts in assigned_users_by_asset.values()
            for contact in contacts
            for name in [str(contact.get("name") or "").strip()]
            if name
        },
        key=lambda item: item.lower(),
    )
    return [{"name": name} for name in unique_names]


def list_itop_asset_catalog(runtime_token: str) -> dict[str, list[dict[str, object]]]:
    from modules.settings.service import get_settings_panel

    cmdb_settings = get_settings_panel("cmdb")
    enabled_labels = [str(item).strip() for item in cmdb_settings.get("enabledAssetTypes") or [] if str(item).strip()]
    show_obsolete_assets = should_show_obsolete_assets(cmdb_settings)
    show_implementation_assets = should_show_implementation_assets(cmdb_settings)
    itop_config = get_itop_runtime_config()

    connector = iTopCMDBConnector(
        base_url=itop_config["integrationUrl"],
        token=runtime_token,
        username="hub-session-user",
        verify_ssl=itop_config["verifySsl"],
        timeout=itop_config["timeoutSeconds"],
    )

    try:
        brands = connector.oql(
            "SELECT Brand",
            output_fields="id,name,friendlyname",
        )
        models = connector.oql(
            "SELECT Model",
            output_fields="id,name,friendlyname,brand_id,brand_id_friendlyname,brand_name",
        )
        asset_items = []
        for query_class in _iter_query_classes(enabled_labels):
            query_items = connector.oql(f"SELECT {query_class}", output_fields="*")
            asset_items.extend(query_items)
        brand_index = {
            int(item.id): {
                "id": item.id,
                "name": _normalize_space(item.get("friendlyname") or item.get("name")),
                "classes": set(),
            }
            for item in brands
            if _normalize_space(item.get("friendlyname") or item.get("name"))
        }

        model_index = {
            int(item.id): {
                "id": item.id,
                "name": _normalize_space(item.get("friendlyname") or item.get("name")),
                "brandId": int(str(item.get("brand_id") or "0") or "0"),
                "brandName": _normalize_space(item.get("brand_id_friendlyname") or item.get("brand_name")),
                "classes": set(),
            }
            for item in models
            if _normalize_space(item.get("friendlyname") or item.get("name"))
        }

        visible_asset_items = [
            item
            for item in asset_items
            if is_visible_ci_status(item.get("status"), show_obsolete_assets, show_implementation_assets)
        ]

        for item in visible_asset_items:
            class_name = _resolve_asset_type_label(item, enabled_labels)
            if enabled_labels and class_name not in enabled_labels:
                continue

            brand_name = _normalize_space(item.get("brand_id_friendlyname") or item.get("brand_name"))
            model_name = _normalize_space(item.get("model_id_friendlyname") or item.get("model_name"))

            for brand in brand_index.values():
                if brand["name"] == brand_name:
                    brand["classes"].add(class_name)
                    break

            for model in model_index.values():
                if model["name"] == model_name and model["brandName"] == brand_name:
                    model["classes"].add(class_name)
                    break

        brand_items = [
            {
                "id": item["id"],
                "name": item["name"],
                "classes": sorted(item["classes"]),
            }
            for item in brand_index.values()
            if item["name"]
        ]
        brand_items.sort(key=lambda item: str(item["name"]).lower())

        model_items = [
            {
                "id": item["id"],
                "name": item["name"],
                "brandId": item["brandId"],
                "brandName": item["brandName"],
                "classes": sorted(item["classes"]),
            }
            for item in model_index.values()
            if item["name"]
        ]
        model_items.sort(key=lambda item: (str(item["brandName"]).lower(), str(item["name"]).lower()))
        # Building the assigned-user catalog from iTop requires one relation query per asset
        # and can time out on large CMDBs. Keep the catalog lightweight here so the Assets page
        # can load reliably; per-asset related contacts are still resolved in detail/search flows.
        assigned_user_items: list[dict[str, str]] = []

        return {
            "brands": brand_items,
            "models": model_items,
            "assignedUsers": assigned_user_items,
        }
    except ConnectionError as exc:
        raise AuthenticationError(
            f"No fue posible consultar catalogos de activos en iTop: {exc}",
            status_code=503,
            code="ITOP_UNAVAILABLE",
        ) from exc
    finally:
        connector.close()


def _load_asset_summary(connector: iTopCMDBConnector, item):
    ci_class = str(item.get("finalclass") or item.itop_class or "FunctionalCI").strip() or "FunctionalCI"
    detailed_item = connector.get_ci(
        ci_class,
        item.id,
        output_fields=(
            "id,name,friendlyname,finalclass,status,type,asset_number,serialnumber,"
            "brand_id_friendlyname,brand_name,model_id_friendlyname,model_name,"
            "org_id_friendlyname,organization_name,location_id_friendlyname,location_name"
        ),
    )
    return detailed_item or item


ASSET_SEARCH_OUTPUT_FIELDS = (
    "id,name,friendlyname,finalclass,status,type,asset_number,serialnumber,"
    "brand_id_friendlyname,brand_name,model_id_friendlyname,model_name,"
    "org_id_friendlyname,organization_name,location_id_friendlyname,location_name,"
    "end_of_warranty"
)


def _iter_query_classes(enabled_labels: list[str]) -> list[str]:
    labels = enabled_labels or list(CMDB_QUERY_MAP.keys())
    classes: list[str] = []
    for label in labels:
        for query_class in CMDB_QUERY_MAP.get(label, []):
            if query_class not in classes:
                classes.append(query_class)
    return classes


def _iter_all_query_classes() -> list[str]:
    """Return all known CMDB query classes, regardless of enabledAssetTypes config."""
    classes: list[str] = []
    for query_class_list in CMDB_QUERY_MAP.values():
        for query_class in query_class_list:
            if query_class not in classes:
                classes.append(query_class)
    return classes


def _search_assets_by_person(
    connector: iTopCMDBConnector,
    person_id: int,
    normalized_query: str,
    show_obsolete_assets: bool,
    show_implementation_assets: bool,
    enabled_labels: list[str],
) -> list:
    """
    Fetch assets assigned to a specific person using an OQL JOIN query.

    Queries ALL known asset classes (not filtered by enabledAssetTypes) so that
    peripherals, docking stations, monitors, etc. are always included regardless
    of hub catalog configuration.  The JOIN filters at the iTop level, avoiding
    the N+1 pattern of fetching the full inventory and post-filtering.
    """
    enriched_items = []
    for query_class in _iter_all_query_classes():
        oql = (
            f"SELECT {query_class} AS ci "
            f"JOIN lnkContactToFunctionalCI AS lnk ON lnk.functionalci_id = ci.id "
            f"WHERE lnk.contact_id = {person_id}"
        )
        try:
            items = connector.oql(oql, output_fields=ASSET_SEARCH_OUTPUT_FIELDS)
            enriched_items.extend(items)
        except Exception:
            # Some iTop classes may not support this JOIN; skip gracefully.
            pass

    return [
        item
        for item in enriched_items
        if (
            _matches_asset_query(item, normalized_query)
            and is_visible_ci_status(item.get("status"), show_obsolete_assets, show_implementation_assets)
        )
    ]


def _find_asset_by_id(connector: iTopCMDBConnector, asset_id: int, enabled_labels: list[str]):
    for query_class in _iter_query_classes(enabled_labels):
        item = connector.get_ci(query_class, asset_id, output_fields="*")
        if item:
            return item
    return None


def search_itop_assets(
    query: str,
    runtime_token: str,
    limit: int = 200,
    assigned_person_id: int | None = None,
) -> list[dict[str, str | int]]:
    from modules.settings.service import get_settings_panel

    normalized_query = " ".join(query.strip().split())
    if normalized_query and len(normalized_query) < 2:
        return []

    cmdb_settings = get_settings_panel("cmdb")
    enabled_labels = [str(item).strip() for item in cmdb_settings.get("enabledAssetTypes") or [] if str(item).strip()]
    show_obsolete_assets = should_show_obsolete_assets(cmdb_settings)
    show_implementation_assets = should_show_implementation_assets(cmdb_settings)
    itop_config = get_itop_runtime_config()

    connector = iTopCMDBConnector(
        base_url=itop_config["integrationUrl"],
        token=runtime_token,
        username="hub-session-user",
        verify_ssl=itop_config["verifySsl"],
        timeout=itop_config["timeoutSeconds"],
    )

    try:
        if assigned_person_id:
            # Fast path: use OQL JOIN to fetch only assets assigned to this person.
            # Queries all known CMDB classes (ignores enabledAssetTypes filter) so that
            # peripherals, monitors, docking stations, etc. are always included.
            person_id_int = int(assigned_person_id)
            filtered_items = _search_assets_by_person(
                connector,
                person_id_int,
                normalized_query,
                show_obsolete_assets,
                show_implementation_assets,
                enabled_labels,
            )
            # Load contacts only for the small set of matching assets (no N+1 at scale).
            assigned_users_by_asset = _load_asset_assigned_users(
                connector, [int(item.id) for item in filtered_items]
            )
            rows = []
            for item in filtered_items:
                assigned_contacts = assigned_users_by_asset.get(int(item.id), [])
                rows.append(_build_asset_row(item, enabled_labels, assigned_contacts))
            rows.sort(key=lambda row: (str(row["className"]).lower(), str(row["name"]).lower(), str(row["code"]).lower()))
            return rows[:limit]

        # Standard path: search across enabled asset types without person filter.
        enriched_items = []
        for query_class in _iter_query_classes(enabled_labels):
            oql = f"SELECT {query_class}"
            if normalized_query:
                conditions = _build_asset_query_conditions(normalized_query)
                if conditions:
                    oql = f"{oql} WHERE {' AND '.join(conditions)}"
            query_items = connector.oql(oql, output_fields=ASSET_SEARCH_OUTPUT_FIELDS)
            enriched_items.extend(query_items)

        if normalized_query and not enriched_items:
            # Fallback for iTop instances where per-class OQL filtering can behave more strictly
            # than expected for some fields. We retry with a broad class fetch and backend filtering.
            for query_class in _iter_query_classes(enabled_labels):
                query_items = connector.oql(f"SELECT {query_class}", output_fields=ASSET_SEARCH_OUTPUT_FIELDS)
                enriched_items.extend(query_items)

        filtered_items = [
            item
            for item in enriched_items
            if (
                _matches_enabled_asset_types(item, enabled_labels)
                and _matches_asset_query(item, normalized_query)
                and is_visible_ci_status(item.get("status"), show_obsolete_assets, show_implementation_assets)
            )
        ]

        assigned_users_by_asset = _load_asset_assigned_users(connector, [int(item.id) for item in filtered_items])
        rows = []
        for item in filtered_items:
            assigned_contacts = assigned_users_by_asset.get(int(item.id), [])
            rows.append(_build_asset_row(item, enabled_labels, assigned_contacts))
        rows.sort(key=lambda row: (str(row["className"]).lower(), str(row["name"]).lower(), str(row["code"]).lower()))
        return rows[:limit]
    except ConnectionError as exc:
        raise AuthenticationError(
            f"No fue posible consultar activos en iTop: {exc}",
            status_code=503,
            code="ITOP_UNAVAILABLE",
        ) from exc
    finally:
        connector.close()


def get_itop_asset_detail(asset_id: int, runtime_token: str) -> dict[str, object]:
    from modules.settings.service import get_settings_panel

    itop_config = get_itop_runtime_config()
    connector = iTopCMDBConnector(
        base_url=itop_config["integrationUrl"],
        token=runtime_token,
        username="hub-session-user",
        verify_ssl=itop_config["verifySsl"],
        timeout=itop_config["timeoutSeconds"],
    )

    try:
        cmdb_settings = get_settings_panel("cmdb")
        warranty_alert_days = int(cmdb_settings.get("warrantyAlertDays") or 30)
        enabled_labels = [str(item).strip() for item in cmdb_settings.get("enabledAssetTypes") or [] if str(item).strip()]

        item = _find_asset_by_id(connector, asset_id, enabled_labels)
        if not item:
            raise ValueError("El activo solicitado no existe en iTop.")

        contacts = connector.oql(
            (
                "SELECT Contact AS c "
                "JOIN lnkContactToFunctionalCI AS l ON l.contact_id = c.id "
                f"WHERE l.functionalci_id = {asset_id}"
            ),
            output_fields="id,name,friendlyname,email,function,status,finalclass",
        )
        asset_class = str(item.itop_class or item.get("finalclass") or "FunctionalCI").strip() or "FunctionalCI"
        history_items = _load_asset_contact_history(connector, asset_class, asset_id)
    except ConnectionError as exc:
        raise AuthenticationError(
            f"No fue posible consultar el detalle del activo en iTop: {exc}",
            status_code=503,
            code="ITOP_UNAVAILABLE",
        ) from exc
    finally:
        connector.close()

    detail = _build_ci_detail(item, warranty_alert_days)
    return {
        **detail,
        "code": _normalize_space(item.get("asset_number")) or detail["code"],
        "className": _resolve_asset_type_label(item, enabled_labels),
        "status": _format_ci_status(item.get("status")),
        "contacts": [
            _build_contact_row(contact)
            for contact in contacts
        ],
        "contactHistory": history_items,
    }
