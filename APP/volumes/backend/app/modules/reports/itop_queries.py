from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Any

from infrastructure.db import get_db_connection
from integrations.itop_cmdb_connector import iTopCMDBConnector
from integrations.itop_runtime import get_itop_runtime_config
from modules.assets.service import (
    CMDB_QUERY_MAP,
    _load_asset_assigned_users,
    _resolve_asset_type_label,
)
from modules.settings.service import get_settings_panel


ASSET_OUTPUT_FIELDS = (
    "id,name,friendlyname,finalclass,status,asset_number,serialnumber,"
    "brand_id_friendlyname,brand_name,model_id_friendlyname,model_name,"
    "org_id_friendlyname,organization_name,location_id,location_id_friendlyname,location_name,"
    "move2production,purchase_date,end_of_warranty"
)

ASSET_PC_OUTPUT_FIELDS = (
    "id,name,friendlyname,finalclass,status,type,asset_number,serialnumber,"
    "brand_id_friendlyname,brand_name,model_id_friendlyname,model_name,"
    "org_id_friendlyname,organization_name,location_id,location_id_friendlyname,location_name,"
    "move2production,purchase_date,end_of_warranty"
)

ASSET_FALLBACK_OUTPUT_FIELDS = (
    "id,name,friendlyname,finalclass,status,asset_number,serialnumber,"
    "brand_id_friendlyname,model_id_friendlyname,org_id_friendlyname,"
    "location_id,location_id_friendlyname,move2production,purchase_date,end_of_warranty"
)

STATUS_LABELS = {
    "production": "Produccion",
    "stock": "En inventario",
    "implementation": "En implementacion",
    "obsolete": "Obsoleto",
    "repair": "En reparacion",
    "test": "En prueba",
    "inactive": "Inactivo",
    "disposed": "Eliminado",
}

logger = logging.getLogger(__name__)


def _coerce_text(value: Any, default: str = "") -> str:
    text = str(value or "").strip()
    return text or default


def _normalize(value: Any) -> str:
    return _coerce_text(value).casefold()


def _filter_values(value: Any) -> list[str]:
    if isinstance(value, list):
        return [_normalize(item) for item in value if _coerce_text(item)]
    text = _normalize(value)
    return [text] if text else []


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def _escape_oql(value: Any) -> str:
    return _coerce_text(value).replace("\\", "\\\\").replace("'", "\\'")


def _is_connection_error(exc: Exception) -> bool:
    error_text = str(exc).casefold()
    return "connect" in error_text or "timeout" in error_text or "ssl" in error_text


def _parse_date(value: Any) -> date | None:
    text = _coerce_text(value)
    if not text or text in {"-", "0000-00-00"}:
        return None
    try:
        return datetime.fromisoformat(text[:10]).date()
    except ValueError:
        return None


def _format_date(value: Any) -> str:
    parsed = _parse_date(value)
    return parsed.isoformat() if parsed else "-"


def _months_between(start: date | None, end: date) -> int:
    if not start:
        return 0
    months = (end.year - start.year) * 12 + end.month - start.month
    return max(0, months - (1 if end.day < start.day else 0))


def _status_label(status: Any) -> str:
    raw = _coerce_text(status)
    return STATUS_LABELS.get(raw, raw or "-")


def _enabled_asset_labels() -> list[str]:
    cmdb = get_settings_panel("cmdb")
    labels = []
    for raw in cmdb.get("enabledAssetTypes", []) or []:
        text = _coerce_text(raw)
        if text:
            labels.append(text)
    return labels


def _enabled_query_classes(enabled_labels: list[str]) -> list[str]:
    classes: list[str] = []
    for label in enabled_labels:
        classes.extend(CMDB_QUERY_MAP.get(label, []))
    return sorted(set(classes)) or ["PhysicalDevice"]


def _open_connector(runtime_token: str) -> iTopCMDBConnector:
    itop_config = get_itop_runtime_config()
    return iTopCMDBConnector(
        base_url=itop_config["integrationUrl"],
        token=runtime_token,
        username="hub-reports",
        verify_ssl=itop_config["verifySsl"],
        timeout=itop_config["timeoutSeconds"],
    )


def _asset_output_fields_for_class(query_class: str) -> str:
    if _normalize(query_class) == "pc":
        return ASSET_PC_OUTPUT_FIELDS
    return ASSET_OUTPUT_FIELDS


def _build_oql_conditions(filters: dict[str, Any]) -> list[str]:
    conditions: list[str] = []
    status_values = _filter_values(filters.get("status"))
    name = _coerce_text(filters.get("asset_query") or filters.get("name"))
    production_before = _coerce_text(filters.get("production_before") or filters.get("move2production_before"))
    warranty_to = _coerce_text(filters.get("warranty_to"))

    if status_values:
        status_parts = [f"status = '{_escape_oql(status)}'" for status in status_values]
        conditions.append("(" + " OR ".join(status_parts) + ")" if len(status_parts) > 1 else status_parts[0])
    if production_before:
        conditions.append(f"move2production <= '{_escape_oql(production_before)}'")
    if warranty_to:
        conditions.append(f"end_of_warranty <= '{_escape_oql(warranty_to)}'")
    if name:
        safe = _escape_oql(name)
        conditions.append(
            "("
            f"name LIKE '%{safe}%' OR "
            f"friendlyname LIKE '%{safe}%' OR "
            f"asset_number LIKE '%{safe}%' OR "
            f"serialnumber LIKE '%{safe}%'"
            ")"
        )
    return conditions


def _fetch_assets(runtime_token: str, filters: dict[str, Any]) -> list[dict[str, Any]]:
    enabled_labels = _enabled_asset_labels()
    query_classes = _enabled_query_classes(enabled_labels)
    class_filters = _filter_values(filters.get("finalclass") or filters.get("asset_type"))
    location_filter = _normalize(filters.get("location"))
    responsible_filter = _normalize(filters.get("responsible") or filters.get("contact"))
    conditions = _build_oql_conditions(filters)
    items = []

    connector = _open_connector(runtime_token)
    try:
        for query_class in query_classes:
            oql = f"SELECT {query_class}"
            if conditions:
                oql += " WHERE " + " AND ".join(conditions)
            try:
                response = connector.get(query_class, oql, output_fields=_asset_output_fields_for_class(query_class))
                if not response.ok:
                    logger.warning(
                        "Report CMDB query returned %s for class '%s': %s",
                        response.code,
                        query_class,
                        response.message,
                    )
                    response = connector.get(query_class, oql, output_fields=ASSET_FALLBACK_OUTPUT_FIELDS)
                if not response.ok:
                    logger.warning(
                        "Report CMDB query skipped for class '%s' after fallback: %s",
                        query_class,
                        response.message,
                    )
                    continue
                query_items = response.items()
            except Exception as exc:
                if _is_connection_error(exc):
                    raise
                logger.warning(
                    "Report CMDB query skipped for class '%s': %s",
                    query_class,
                    exc,
                )
                continue
            for item in query_items:
                if int(getattr(item, "id", 0) or 0) > 0:
                    items.append(item)

        assigned_by_asset = _load_asset_assigned_users(connector, [int(item.id) for item in items])
    finally:
        connector.close()

    rows: list[dict[str, Any]] = []
    today = date.today()
    for item in items:
        asset_type = _resolve_asset_type_label(item, enabled_labels)
        asset_type_normalized = _normalize(asset_type)
        if class_filters and not any(
            class_filter == asset_type_normalized or class_filter in asset_type_normalized
            for class_filter in class_filters
        ):
            continue

        contacts = assigned_by_asset.get(int(item.id), [])
        responsible_ids = [
            int(contact.get("id") or 0)
            for contact in contacts
            if int(contact.get("id") or 0) > 0
        ]
        responsible = ", ".join(
            _coerce_text(contact.get("name"))
            for contact in contacts
            if _coerce_text(contact.get("name"))
        ) or "Sin asignar"
        location = _coerce_text(item.get("location_id_friendlyname") or item.get("location_name"), "Sin locacion")
        if location_filter and location_filter not in _normalize(location):
            continue
        if responsible_filter and responsible_filter not in _normalize(responsible):
            continue

        production_date = _parse_date(item.get("move2production"))
        warranty_date = _parse_date(item.get("end_of_warranty"))
        purchase_date = _parse_date(item.get("purchase_date"))
        warranty_days = (warranty_date - today).days if warranty_date else None
        production_months = _months_between(production_date, today)
        rows.append({
            "id": int(item.id),
            "codigo": _coerce_text(item.get("asset_number") or item.get("name") or item.get("friendlyname"), f"CI-{int(item.id):05d}"),
            "nombre": _coerce_text(item.get("name") or item.get("friendlyname")),
            "clase": asset_type,
            "estado": _status_label(item.get("status")),
            "estado_raw": _coerce_text(item.get("status")),
            "marca": _coerce_text(item.get("brand_id_friendlyname") or item.get("brand_name"), "-"),
            "modelo": _coerce_text(item.get("model_id_friendlyname") or item.get("model_name"), "-"),
            "serie": _coerce_text(item.get("serialnumber"), "-"),
            "organizacion": _coerce_text(item.get("org_id_friendlyname") or item.get("organization_name"), "-"),
            "locacion": location,
            "responsable": responsible,
            "responsable_ids": responsible_ids,
            "fecha_produccion": _format_date(item.get("move2production")),
            "fecha_compra": purchase_date.isoformat() if purchase_date else "-",
            "meses_en_produccion": production_months,
            "fin_garantia": _format_date(item.get("end_of_warranty")),
            "dias_garantia": warranty_days if warranty_days is not None else "",
        })

    return rows


def _paginate(rows: list[dict[str, Any]], pagination: dict[str, Any]) -> tuple[list[dict[str, Any]], int]:
    total = len(rows)
    page_size_raw = _safe_int(pagination.get("page_size"), 100)
    if page_size_raw <= 0:
        return rows, total
    page = max(1, _safe_int(pagination.get("page"), 1))
    page_size = min(5000, page_size_raw)
    offset = (page - 1) * page_size
    return rows[offset: offset + page_size], total


def assets_with_responsibles(filters: dict[str, Any], pagination: dict[str, Any], runtime_token: str) -> tuple[list[dict], int]:
    rows = _fetch_assets(runtime_token, filters)
    rows.sort(key=lambda row: (row["responsable"], row["clase"], row["codigo"]))
    return _paginate(rows, pagination)


def assets_grouped_by_class_status(filters: dict[str, Any], pagination: dict[str, Any], runtime_token: str) -> tuple[list[dict], int]:
    assets = _fetch_assets(runtime_token, filters)
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    for asset in assets:
        key = (asset["clase"], asset["estado"])
        row = grouped.setdefault(key, {
            "clase": asset["clase"],
            "estado": asset["estado"],
            "cantidad": 0,
            "con_responsable": 0,
            "sin_responsable": 0,
        })
        row["cantidad"] += 1
        if asset["responsable"] == "Sin asignar":
            row["sin_responsable"] += 1
        else:
            row["con_responsable"] += 1
    rows = sorted(grouped.values(), key=lambda row: (row["clase"], row["estado"]))
    return _paginate(rows, pagination)


def assets_grouped_by_location(filters: dict[str, Any], pagination: dict[str, Any], runtime_token: str) -> tuple[list[dict], int]:
    assets = _fetch_assets(runtime_token, filters)
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    for asset in assets:
        key = (asset["locacion"], asset["clase"])
        row = grouped.setdefault(key, {
            "locacion": asset["locacion"],
            "clase": asset["clase"],
            "cantidad": 0,
            "produccion": 0,
            "stock": 0,
            "otros_estados": 0,
        })
        row["cantidad"] += 1
        status = asset["estado_raw"]
        if status == "production":
            row["produccion"] += 1
        elif status == "stock":
            row["stock"] += 1
        else:
            row["otros_estados"] += 1
    rows = sorted(grouped.values(), key=lambda row: (row["locacion"], row["clase"]))
    return _paginate(rows, pagination)


def assets_by_location_detail(filters: dict[str, Any], pagination: dict[str, Any], runtime_token: str) -> tuple[list[dict], int]:
    rows = [
        {
            "clase": asset["clase"],
            "nombre": asset["nombre"],
            "estado": asset["estado"],
            "responsable": asset["responsable"],
            "locacion": asset["locacion"],
            "serie": asset["serie"],
        }
        for asset in _fetch_assets(runtime_token, filters)
    ]
    rows.sort(key=lambda row: (row["locacion"], row["clase"], row["nombre"]))
    return _paginate(rows, pagination)


def asset_lifecycle_and_warranty(filters: dict[str, Any], pagination: dict[str, Any], runtime_token: str) -> tuple[list[dict], int]:
    min_months = _safe_int(filters.get("min_production_months"), 0)
    warranty_days = _safe_int(filters.get("warranty_days"), 0)
    today = date.today()
    warranty_limit = today + timedelta(days=warranty_days) if warranty_days > 0 else None
    rows = []
    for asset in _fetch_assets(runtime_token, filters):
        warranty_date = _parse_date(asset.get("fin_garantia"))
        matches_age = min_months <= 0 or int(asset.get("meses_en_produccion") or 0) >= min_months
        matches_warranty = warranty_limit is None or (warranty_date is not None and warranty_date <= warranty_limit)
        if matches_age and matches_warranty:
            rows.append(asset)

    rows.sort(key=lambda row: (
        str(row.get("fin_garantia") or "9999-12-31"),
        -int(row.get("meses_en_produccion") or 0),
        row.get("codigo") or "",
    ))
    return _paginate(rows, pagination)


def assets_missing_user_or_location(filters: dict[str, Any], pagination: dict[str, Any], runtime_token: str) -> tuple[list[dict], int]:
    rows = []
    for asset in _fetch_assets(runtime_token, filters):
        missing_user = asset["responsable"] == "Sin asignar"
        missing_location = asset["locacion"] == "Sin locacion"
        if not missing_user and not missing_location:
            continue
        issue_parts = []
        if missing_user:
            issue_parts.append("Sin responsable")
        if missing_location:
            issue_parts.append("Sin locacion")
        rows.append({
            **asset,
            "problema": ", ".join(issue_parts),
        })

    rows.sort(key=lambda row: (row["problema"], row["clase"], row["codigo"]))
    return _paginate(rows, pagination)


def _fetch_people(runtime_token: str, filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    filters = filters or {}
    query = _coerce_text(filters.get("person_query") or filters.get("person"))
    connector = _open_connector(runtime_token)
    try:
        oql = "SELECT Person WHERE status = 'active'"
        people = connector.oql(oql, output_fields="id,name,first_name,friendlyname,email,function,status,org_id_friendlyname")
    finally:
        connector.close()

    rows = []
    query_norm = _normalize(query)
    for person in people:
        full_name = _coerce_text(person.get("friendlyname") or person.get("name") or person.get("first_name"), f"Persona {person.id}")
        email = _coerce_text(person.get("email"))
        if query_norm and query_norm not in _normalize(" ".join([full_name, email, _coerce_text(person.get("function"))])):
            continue
        rows.append({
            "persona_id": int(person.id),
            "persona": full_name,
            "correo": email or "-",
            "cargo": _coerce_text(person.get("function"), "-"),
            "organizacion": _coerce_text(person.get("org_id_friendlyname"), "-"),
            "estado_persona": _status_label(person.get("status")),
        })
    return rows


def people_with_assigned_assets(filters: dict[str, Any], pagination: dict[str, Any], runtime_token: str) -> tuple[list[dict], int]:
    assets = _fetch_assets(runtime_token, filters)
    rows = []
    for asset in assets:
        if asset["responsable"] == "Sin asignar":
            continue
        for person_name in [name.strip() for name in asset["responsable"].split(",") if name.strip()]:
            rows.append({
                "persona": person_name,
                "activo": asset["codigo"],
                "nombre_activo": asset["nombre"],
                "clase": asset["clase"],
                "estado": asset["estado"],
                "locacion": asset["locacion"],
                "marca": asset["marca"],
                "modelo": asset["modelo"],
                "fecha_produccion": asset["fecha_produccion"],
                "fecha_compra": asset["fecha_compra"],
                "vencimiento_garantia": asset["fin_garantia"],
                "fin_garantia": asset["fin_garantia"],
            })
    rows.sort(key=lambda row: (row["persona"], row["activo"]))
    return _paginate(rows, pagination)


def people_without_assigned_assets(filters: dict[str, Any], pagination: dict[str, Any], runtime_token: str) -> tuple[list[dict], int]:
    assets = _fetch_assets(runtime_token, {})
    assigned_ids = {
        person_id
        for asset in assets
        for person_id in asset.get("responsable_ids", [])
        if int(person_id or 0) > 0
    }
    rows = [
        person
        for person in _fetch_people(runtime_token, filters)
        if int(person.get("persona_id") or 0) not in assigned_ids
    ]
    rows.sort(key=lambda row: row["persona"])
    return _paginate(rows, pagination)


def _fetch_latest_documented_asset_state(filters: dict[str, Any]) -> list[dict[str, Any]]:
    params: list[Any] = []
    conditions = ["d.status != 'draft'"]
    asset_query = _coerce_text(filters.get("asset_query"))
    if asset_query:
        conditions.append("(LOWER(i.asset_code) LIKE %s OR LOWER(i.asset_name) LIKE %s)")
        like = f"%{asset_query.casefold()}%"
        params.extend([like, like])

    sql = f"""
        SELECT *
        FROM (
            SELECT
                i.asset_code,
                i.asset_name,
                i.asset_status,
                i.assigned_user_name,
                d.receiver_name,
                d.handover_type,
                d.document_number,
                d.generated_at,
                ROW_NUMBER() OVER (
                    PARTITION BY LOWER(i.asset_code)
                    ORDER BY d.generated_at DESC, d.id DESC
                ) AS rn
            FROM hub_handover_document_items i
            INNER JOIN hub_handover_documents d ON d.id = i.document_id
            WHERE {' AND '.join(conditions)}
        ) ranked
        WHERE rn = 1
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            return cur.fetchall() or []


def cmdb_vs_handover_inconsistencies(filters: dict[str, Any], pagination: dict[str, Any], runtime_token: str) -> tuple[list[dict], int]:
    assets = _fetch_assets(runtime_token, filters)
    asset_index = {
        _normalize(asset["codigo"]): asset
        for asset in assets
        if _coerce_text(asset.get("codigo"))
    }
    rows = []
    for doc in _fetch_latest_documented_asset_state(filters):
        code = _coerce_text(doc.get("asset_code"))
        cmdb_asset = asset_index.get(_normalize(code))
        if not cmdb_asset:
            rows.append({
                "activo": code,
                "acta": _coerce_text(doc.get("document_number")),
                "tipo_diferencia": "Activo no encontrado en CMDB",
                "valor_documental": _coerce_text(doc.get("asset_name"), "-"),
                "valor_cmdb": "-",
                "prioridad": "Alta",
            })
            continue

        expected_owner = _coerce_text(doc.get("receiver_name"))
        if doc.get("handover_type") == "return":
            expected_owner = "Sin asignar"
        current_owner = _coerce_text(cmdb_asset.get("responsable"), "Sin asignar")
        if expected_owner and _normalize(expected_owner) not in _normalize(current_owner):
            rows.append({
                "activo": code,
                "acta": _coerce_text(doc.get("document_number")),
                "tipo_diferencia": "Responsable distinto",
                "valor_documental": expected_owner,
                "valor_cmdb": current_owner,
                "prioridad": "Media",
            })

    rows.sort(key=lambda row: (row["prioridad"], row["activo"]))
    return _paginate(rows, pagination)


def non_standard_models(filters: dict[str, Any], pagination: dict[str, Any], runtime_token: str) -> tuple[list[dict], int]:
    rows = []
    for asset in _fetch_assets(runtime_token, filters):
        model = _coerce_text(asset.get("modelo"), "-")
        is_missing_model = model == "-"
        is_legacy_hint = any(token in _normalize(model) for token in ("legacy", "old", "obsolete", "eol"))
        if not is_missing_model and not is_legacy_hint:
            continue
        rows.append({
            "codigo": asset["codigo"],
            "nombre": asset["nombre"],
            "clase": asset["clase"],
            "marca": asset["marca"],
            "modelo": model,
            "responsable": asset["responsable"],
            "locacion": asset["locacion"],
            "motivo": "Sin modelo registrado" if is_missing_model else "Modelo marcado como legacy/EOL",
            "estado": asset["estado"],
        })
    rows.sort(key=lambda row: (row["motivo"], row["clase"], row["codigo"]))
    return _paginate(rows, pagination)


QUERY_REGISTRY: dict[str, Any] = {
    "assets_with_responsibles": assets_with_responsibles,
    "assets_grouped_by_class_status": assets_grouped_by_class_status,
    "assets_grouped_by_location": assets_grouped_by_location,
    "assets_by_location_detail": assets_by_location_detail,
    "asset_lifecycle_and_warranty": asset_lifecycle_and_warranty,
    "assets_missing_user_or_location": assets_missing_user_or_location,
    "people_with_assigned_assets": people_with_assigned_assets,
    "people_without_assigned_assets": people_without_assigned_assets,
    "cmdb_vs_handover_inconsistencies": cmdb_vs_handover_inconsistencies,
    "non_standard_models": non_standard_models,
}
