import logging
import os
from typing import Any

import pymysql
from modules.cmdb_visibility import (
    is_visible_ci_status,
    should_show_implementation_assets,
    should_show_obsolete_assets,
)
from modules.auth.service import AuthenticationError
from integrations.itop_cmdb_connector import iTopCMDBConnector
from integrations.itop_runtime import get_itop_runtime_config
from modules.people.service import _build_ci_detail, _format_ci_status
from pymysql.cursors import DictCursor


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


def _read_bool(name: str, default: bool = True) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _read_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _get_itop_db_connection():
    return pymysql.connect(
        host=os.getenv("ITOP_DB_HOST", "mariadb"),
        port=_read_int("ITOP_DB_PORT", 3306),
        user=os.getenv("ITOP_DB_USER", ""),
        password=os.getenv("ITOP_DB_PASSWORD", ""),
        database=os.getenv("ITOP_DB_NAME", ""),
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=True,
    )


def _normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _normalize_space(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def _escape_oql(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


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
        "assignedUser": normalized_assigned_user or "Sin asignar",
        "assignedUsers": contact_items,
        "warrantyDate": warranty_end or "Sin dato",
        "status": _format_ci_status(item.get("status")),
    }


def _build_contact_row(item) -> dict[str, str | int]:
    return {
        "id": item.id,
        "name": _normalize_space(item.get("friendlyname") or item.get("name") or f"Persona {item.id}"),
        "email": _normalize_space(item.get("email")),
        "role": _normalize_space(item.get("function")),
        "status": _normalize_space(item.get("status")).capitalize() or "Sin dato",
    }


def _load_asset_contact_audit(asset_class: str, asset_id: int) -> dict[int, dict[str, str]]:
    sql = """
        SELECT
            links.item_id AS contact_id,
            change_log.date AS assigned_at,
            change_log.userinfo AS assigned_by,
            change_log.origin AS origin
        FROM priv_change AS change_log
        INNER JOIN priv_changeop AS op
            ON op.changeid = change_log.id
        INNER JOIN priv_changeop_links AS links
            ON links.id = op.id
        INNER JOIN priv_changeop_links_addremove AS links_op
            ON links_op.id = op.id
        WHERE op.objclass = %s
          AND op.objkey = %s
          AND op.optype = 'CMDBChangeOpSetAttributeLinksAddRemove'
          AND links.item_class = 'Contact'
          AND links_op.type = 'added'
        ORDER BY change_log.date DESC, change_log.id DESC
    """

    audit_by_contact: dict[int, dict[str, str]] = {}
    connection = _get_itop_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql, (asset_class, asset_id))
            rows = cursor.fetchall() or []
    finally:
        connection.close()

    for row in rows:
        contact_id = int(row.get("contact_id") or 0)
        if contact_id <= 0 or contact_id in audit_by_contact:
            continue
        audit_by_contact[contact_id] = {
            "assignedAt": str(row.get("assigned_at") or "").strip(),
            "assignedBy": _normalize_space(row.get("assigned_by")),
            "origin": _normalize_space(row.get("origin")),
        }

    return audit_by_contact


def _load_asset_contact_history(asset_class: str, asset_id: int) -> list[dict[str, str | int]]:
    sql = """
        SELECT
            change_log.id AS change_id,
            change_log.date AS changed_at,
            change_log.userinfo AS changed_by,
            change_log.origin AS origin,
            links.item_id AS contact_id,
            links_op.type AS action_type,
            contact.finalclass AS contact_class,
            contact.name AS contact_last_name,
            person.first_name AS contact_first_name,
            contact.email AS contact_email,
            contact.function AS contact_role
        FROM priv_change AS change_log
        INNER JOIN priv_changeop AS op
            ON op.changeid = change_log.id
        INNER JOIN priv_changeop_links AS links
            ON links.id = op.id
        INNER JOIN priv_changeop_links_addremove AS links_op
            ON links_op.id = op.id
        LEFT JOIN contact
            ON contact.id = links.item_id
        LEFT JOIN person
            ON person.id = links.item_id
        WHERE op.objclass = %s
          AND op.objkey = %s
          AND op.optype = 'CMDBChangeOpSetAttributeLinksAddRemove'
          AND links.item_class = 'Contact'
          AND links_op.type IN ('added', 'removed')
        ORDER BY change_log.date DESC, change_log.id DESC
    """

    connection = _get_itop_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql, (asset_class, asset_id))
            rows = cursor.fetchall() or []
    finally:
        connection.close()

    history: list[dict[str, str | int]] = []
    for row in rows:
        full_name = _normalize_space(
            " ".join(
                part
                for part in [
                    row.get("contact_first_name"),
                    row.get("contact_last_name"),
                ]
                if str(part or "").strip()
            )
        )
        history.append(
            {
                "id": int(row.get("change_id") or 0),
                "contactId": int(row.get("contact_id") or 0),
                "contactName": full_name or f"Contacto {int(row.get('contact_id') or 0)}",
                "contactEmail": _normalize_space(row.get("contact_email")),
                "contactRole": _normalize_space(row.get("contact_role")),
                "action": "Agregado" if str(row.get("action_type") or "").strip().lower() == "added" else "Removido",
                "changedAt": str(row.get("changed_at") or "").strip(),
                "changedBy": _normalize_space(row.get("changed_by")),
                "origin": _normalize_space(row.get("origin")),
            }
        )

    return history


def _load_asset_assigned_users(asset_ids: list[int]) -> dict[int, list[dict[str, str | int]]]:
    normalized_ids = sorted({int(asset_id) for asset_id in asset_ids if int(asset_id) > 0})
    if not normalized_ids:
        return {}

    placeholders = ",".join(["%s"] * len(normalized_ids))
    sql = f"""
        SELECT
            lnk.functionalci_id AS asset_id,
            person.id AS person_id,
            person.first_name AS person_first_name,
            contact.name AS contact_last_name
        FROM `lnkContactToFunctionalCI` AS lnk
        INNER JOIN contact
            ON contact.id = lnk.contact_id
        LEFT JOIN person
            ON person.id = contact.id
        WHERE lnk.functionalci_id IN ({placeholders})
        ORDER BY lnk.functionalci_id ASC, person.first_name ASC, contact.name ASC
    """

    connection = _get_itop_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql, normalized_ids)
            rows = cursor.fetchall() or []
    except pymysql.MySQLError:
        logger.exception(
            "Asset assigned-user lookup failed for ids=%s. Returning empty assignments.",
            normalized_ids,
        )
        return {}
    finally:
        connection.close()

    contacts_by_asset: dict[int, list[dict[str, str | int]]] = {}
    for row in rows:
        asset_id = int(row.get("asset_id") or 0)
        if asset_id <= 0:
            continue

        full_name = _normalize_space(
            " ".join(
                part
                for part in [
                    str(row.get("person_first_name") or "").strip(),
                    str(row.get("contact_last_name") or "").strip(),
                ]
                if part
            )
        )
        if not full_name:
            continue

        contacts_by_asset.setdefault(asset_id, [])
        person_id = int(row.get("person_id") or 0)
        if any(int(contact.get("id") or 0) == person_id and str(contact.get("name") or "").strip() == full_name for contact in contacts_by_asset[asset_id]):
            continue

        contacts_by_asset[asset_id].append(
            {
                "id": person_id,
                "name": full_name,
            }
        )

    return contacts_by_asset


def _list_assigned_user_catalog(asset_ids: list[int]) -> list[dict[str, str]]:
    assigned_users_by_asset = _load_asset_assigned_users(asset_ids)
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
    except ConnectionError as exc:
        raise AuthenticationError(
            f"No fue posible consultar catalogos de activos en iTop: {exc}",
            status_code=503,
            code="ITOP_UNAVAILABLE",
        ) from exc
    finally:
        connector.close()

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
    assigned_user_items = _list_assigned_user_catalog([int(item.id) for item in visible_asset_items])

    return {
        "brands": brand_items,
        "models": model_items,
        "assignedUsers": assigned_user_items,
    }


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


def _find_asset_by_id(connector: iTopCMDBConnector, asset_id: int, enabled_labels: list[str]):
    for query_class in _iter_query_classes(enabled_labels):
        item = connector.get_ci(query_class, asset_id, output_fields="*")
        if item:
            return item
    return None


def search_itop_assets(query: str, runtime_token: str, limit: int = 200) -> list[dict[str, str | int]]:
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
    except ConnectionError as exc:
        raise AuthenticationError(
            f"No fue posible consultar activos en iTop: {exc}",
            status_code=503,
            code="ITOP_UNAVAILABLE",
        ) from exc
    finally:
        connector.close()

    filtered_items = [
        item
        for item in enriched_items
        if (
            _matches_enabled_asset_types(item, enabled_labels)
            and _matches_asset_query(item, normalized_query)
            and is_visible_ci_status(item.get("status"), show_obsolete_assets, show_implementation_assets)
        )
    ]

    assigned_users_by_asset = _load_asset_assigned_users([int(item.id) for item in filtered_items])
    rows = [
        _build_asset_row(item, enabled_labels, assigned_users_by_asset.get(int(item.id), []))
        for item in filtered_items
    ]
    rows.sort(key=lambda row: (str(row["className"]).lower(), str(row["name"]).lower(), str(row["code"]).lower()))
    return rows[:limit]


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
                "SELECT Person AS p "
                "JOIN lnkContactToFunctionalCI AS l ON l.contact_id = p.id "
                f"WHERE l.functionalci_id = {asset_id}"
            ),
            output_fields="id,name,first_name,friendlyname,email,function,status",
        )
    except ConnectionError as exc:
        raise AuthenticationError(
            f"No fue posible consultar el detalle del activo en iTop: {exc}",
            status_code=503,
            code="ITOP_UNAVAILABLE",
        ) from exc
    finally:
        connector.close()

    asset_class = str(item.itop_class or item.get("finalclass") or "FunctionalCI")
    contact_audit = _load_asset_contact_audit(asset_class, asset_id)
    contact_history = _load_asset_contact_history(asset_class, asset_id)
    detail = _build_ci_detail(item, warranty_alert_days)
    return {
        **detail,
        "code": _normalize_space(item.get("asset_number")) or detail["code"],
        "className": _resolve_asset_type_label(item, enabled_labels),
        "status": _format_ci_status(item.get("status")),
        "contacts": [
            {
                **_build_contact_row(contact),
                **contact_audit.get(int(contact.id), {}),
            }
            for contact in contacts
        ],
        "contactHistory": contact_history,
    }
