from datetime import date, datetime
from typing import Any

from modules.cmdb_visibility import (
    is_visible_ci_status,
    should_show_implementation_assets,
    should_show_obsolete_assets,
)
from modules.auth.service import AuthenticationError
from integrations.itop_cmdb_connector import iTopCMDBConnector
from integrations.itop_runtime import get_itop_runtime_config

def _escape_oql(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


def _build_query_conditions(query: str) -> list[str]:
    tokens = [token for token in query.split() if token]
    if not tokens:
        return []

    conditions: list[str] = []
    for token in tokens:
        safe = _escape_oql(token)
        conditions.append(
            "("
            f"name LIKE '%{safe}%' OR "
            f"first_name LIKE '%{safe}%' OR "
            f"email LIKE '%{safe}%' OR "
            f"function LIKE '%{safe}%'"
            ")"
        )
    return conditions


def _build_person_row(item) -> dict[str, str | int]:
    status = str(item.get("status") or "").strip() or "Desconocido"
    last_name = str(item.get("name") or "").strip()
    first_name = str(item.get("first_name") or "").strip()
    full_name = str(item.get("friendlyname") or "").strip()

    if not full_name:
        full_name = " ".join(part for part in [first_name, last_name] if part).strip() or f"Persona {item.id}"

    return {
        "id": item.id,
        "code": f"PER-{int(item.id):05d}",
        "person": full_name,
        "asset": str(item.get("email") or "").strip(),
        "phone": str(item.get("phone") or "").strip(),
        "role": str(item.get("function") or "").strip(),
        "status": status.capitalize(),
    }


def _build_person_detail(item, related_cis, history_items) -> dict[str, object]:
    base_row = _build_person_row(item)
    organization = str(item.get("org_id_friendlyname") or item.get("org_name") or "").strip()
    location = str(item.get("location_id_friendlyname") or "").strip()
    manager = str(item.get("manager_id_friendlyname") or "").strip()
    assignment_by_ci: dict[int, dict[str, str]] = {}

    for history_item in history_items:
        if str(history_item.get("action") or "").strip() != "Agregado":
            continue
        ci_id = int(history_item.get("ciId") or 0)
        if ci_id <= 0 or ci_id in assignment_by_ci:
            continue
        assignment_by_ci[ci_id] = {
            "assignedAt": str(history_item.get("changedAt") or "").strip(),
            "assignedBy": str(history_item.get("changedBy") or "").strip(),
        }

    enriched_related_cis = [
        {
            **ci_item,
            **assignment_by_ci.get(int(ci_item.get("id") or 0), {}),
        }
        for ci_item in related_cis
    ]

    return {
        **base_row,
        "firstName": str(item.get("first_name") or "").strip(),
        "lastName": str(item.get("name") or "").strip(),
        "organization": organization,
        "location": location,
        "manager": manager,
        "cmdbItems": enriched_related_cis,
        "cmdbHistory": history_items,
    }


def _build_ci_summary(ci) -> dict[str, object]:
    return {
        "id": ci.id,
        "code": f"CI-{int(ci.id):05d}",
        "name": str(ci.get("friendlyname") or ci.get("name") or f"Objeto {ci.id}").strip(),
        "className": _format_ci_class(ci.get("finalclass") or ci.itop_class),
        "status": str(ci.get("status") or "").strip(),
    }


def _append_ci_field(fields: list[dict[str, str]], label: str, value: Any) -> None:
    text = str(value or "").strip()
    if not text:
        return
    fields.append({"label": label, "value": text})


def _to_sentence_case(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return text[:1].upper() + text[1:].lower()


def _format_ci_status(value: Any) -> str:
    raw = str(value or "").strip().lower()
    mapping = {
        "production": "Produccion",
        "implementation": "Implementacion",
        "obsolete": "Obsoleto",
        "stock": "Stock",
        "test": "Prueba",
        "inactive": "Inactivo",
        "active": "Activo",
    }
    return mapping.get(raw, _to_sentence_case(value))


def _format_ci_type(value: Any) -> str:
    raw = str(value or "").strip().lower()
    mapping = {
        "laptop": "Laptop",
        "desktop": "Desktop",
        "server": "Servidor",
        "virtual machine": "Maquina virtual",
        "virtualmachine": "Maquina virtual",
        "phone": "Telefono",
        "mobile phone": "Telefono movil",
        "tablet": "Tablet",
        "printer": "Impresora",
        "monitor": "Monitor",
        "peripheral": "Periferico",
    }
    return mapping.get(raw, _to_sentence_case(value))


def _format_ci_class(value: Any) -> str:
    raw = str(value or "").strip().lower()
    mapping = {
        "pc": "Equipo",
        "server": "Servidor",
        "virtualmachine": "Maquina virtual",
        "virtual machine": "Maquina virtual",
        "mobilephone": "Celular",
        "mobile phone": "Celular",
        "tablet": "Tableta",
        "printer": "Impresora",
        "peripheral": "Periferico",
        "phone": "Telefono",
        "functionalci": "Objeto CMDB",
    }
    return mapping.get(raw, _to_sentence_case(value))


def _append_ci_date_field(
    fields: list[dict[str, Any]],
    label: str,
    value: Any,
    warning_threshold_days: int | None = None,
) -> None:
    text = str(value or "").strip()
    if not text:
        return

    field: dict[str, Any] = {"label": label, "value": text}

    try:
        parsed = datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        parsed = None

    if parsed and warning_threshold_days is not None:
        days_left = (parsed - date.today()).days
        if days_left <= warning_threshold_days:
            if days_left < 0:
                field["alert"] = f"Vencida hace {abs(days_left)} dias"
            elif days_left == 0:
                field["alert"] = "Vence hoy"
            else:
                field["alert"] = f"Vence en {days_left} dias"

    fields.append(field)


def _build_ci_detail(ci, warranty_alert_days: int) -> dict[str, object]:
    summary = _build_ci_summary(ci)
    class_name = summary["className"]
    raw_class = str(ci.get("finalclass") or ci.itop_class or "").strip().lower()
    detail_fields: list[dict[str, str]] = []

    _append_ci_field(detail_fields, "Estado", _format_ci_status(ci.get("status")))
    _append_ci_field(detail_fields, "Organizacion", ci.get("org_id_friendlyname") or ci.get("organization_name"))
    _append_ci_field(detail_fields, "Ubicacion", ci.get("location_id_friendlyname") or ci.get("location_name"))

    if raw_class in {"pc", "server", "virtualmachine", "virtual machine"}:
        _append_ci_field(detail_fields, "Tipo", _format_ci_type(ci.get("type")))
        _append_ci_field(detail_fields, "Marca", ci.get("brand_id_friendlyname") or ci.get("brand_name"))
        _append_ci_field(detail_fields, "Modelo", ci.get("model_id_friendlyname") or ci.get("model_name"))
        _append_ci_field(detail_fields, "Numero de activo", ci.get("asset_number"))
        _append_ci_field(detail_fields, "Numero de serie", ci.get("serialnumber"))
        _append_ci_field(detail_fields, "Sistema operativo", " ".join(
            part for part in [
                str(ci.get("osfamily_id_friendlyname") or ci.get("osfamily_name") or "").strip(),
                str(ci.get("osversion_id_friendlyname") or ci.get("osversion_name") or "").strip(),
            ]
            if part
        ))
        _append_ci_field(detail_fields, "Procesador", ci.get("cpu"))
        ram_value = str(ci.get("ram") or "").strip()
        if ram_value:
            _append_ci_field(detail_fields, "RAM", f"{ram_value} GB" if ram_value.isdigit() else ram_value)
        _append_ci_date_field(detail_fields, "Puesto en produccion", ci.get("move2production"))
        _append_ci_date_field(detail_fields, "Compra", ci.get("purchase_date"))
        _append_ci_date_field(detail_fields, "Garantia", ci.get("end_of_warranty"), warranty_alert_days)
    else:
        _append_ci_field(detail_fields, "Marca", ci.get("brand_id_friendlyname") or ci.get("brand_name"))
        _append_ci_field(detail_fields, "Modelo", ci.get("model_id_friendlyname") or ci.get("model_name"))
        _append_ci_field(detail_fields, "Numero de activo", ci.get("asset_number"))
        _append_ci_field(detail_fields, "Numero de serie", ci.get("serialnumber"))
        _append_ci_date_field(detail_fields, "Puesto en produccion", ci.get("move2production"))
        _append_ci_date_field(detail_fields, "Compra", ci.get("purchase_date"))
        _append_ci_date_field(detail_fields, "Garantia", ci.get("end_of_warranty"), warranty_alert_days)

    if raw_class in {"phone", "mobilephone", "mobile phone"}:
        _append_ci_field(detail_fields, "Numero", ci.get("phonenumber"))

    _append_ci_field(detail_fields, "Descripcion", ci.get("description"))

    if not detail_fields:
        _append_ci_field(detail_fields, "Clase", class_name)

    return {
        **summary,
        "fields": detail_fields,
    }


def _matches_person_query(item, query: str) -> bool:
    tokens = [token.casefold() for token in query.split() if token]
    if not tokens:
        return True

    haystack = " ".join(
        [
            str(item.get("friendlyname") or ""),
            str(item.get("first_name") or ""),
            str(item.get("name") or ""),
            str(item.get("email") or ""),
            str(item.get("function") or ""),
        ]
    ).casefold()

    return all(token in haystack for token in tokens)


def _matches_person_status(item, status: str) -> bool:
    if not status:
        return True
    return str(item.get("status") or "").strip().lower() == status


def search_itop_people(
    query: str,
    runtime_token: str,
    status: str = "",
    org_id: int | None = None,
    limit: int = 50,
) -> list[dict[str, str | int]]:
    normalized_query = query.strip()
    normalized_status = status.strip().lower()
    if not normalized_query and not normalized_status:
        return []

    if normalized_query and len(normalized_query) < 2:
        return []

    if normalized_status and normalized_status not in {"active", "inactive"}:
        raise ValueError("El estado de persona no es valido.")

    itop_config = get_itop_runtime_config()
    connector = iTopCMDBConnector(
        base_url=itop_config["integrationUrl"],
        token=runtime_token,
        username="hub-session-user",
        verify_ssl=itop_config["verifySsl"],
        timeout=itop_config["timeoutSeconds"],
    )

    conditions: list[str] = []
    if normalized_query:
        conditions.extend(_build_query_conditions(normalized_query))
    if normalized_status:
        conditions.append(f"status = '{normalized_status}'")
    if org_id:
        conditions.append(f"org_id = {org_id}")

    oql = "SELECT Person"
    if conditions:
        oql = f"{oql} WHERE {' AND '.join(conditions)}"

    output_fields = "id,name,first_name,friendlyname,email,phone,function,status"

    try:
        items = connector.oql(
            oql,
            output_fields=output_fields,
        )

        if normalized_query and not items:
            # Fallback for iTop instances where OQL filtering over Person fields is more restrictive
            # than expected. We fetch the visible people set and filter in backend memory.
            items = [
                item
                for item in connector.list_persons(org_id=org_id, output_fields=output_fields)
                if _matches_person_query(item, normalized_query) and _matches_person_status(item, normalized_status)
            ]
    except ConnectionError as exc:
        raise AuthenticationError(
            f"No fue posible consultar personas en iTop: {exc}",
            status_code=503,
            code="ITOP_UNAVAILABLE",
        ) from exc
    finally:
        connector.close()

    rows = [_build_person_row(item) for item in items]

    rows.sort(key=lambda row: str(row["person"]).lower())
    return rows[:limit]


def get_itop_person_detail(person_id: int, runtime_token: str) -> dict[str, object]:
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
        show_obsolete_assets = should_show_obsolete_assets(cmdb_settings)
        show_implementation_assets = should_show_implementation_assets(cmdb_settings)

        person = connector.get_person(
            person_id,
            output_fields="id,name,first_name,friendlyname,email,phone,function,status,org_id_friendlyname,location_id_friendlyname,manager_id_friendlyname",
        )
        if not person:
            raise ValueError("La persona solicitada no existe en iTop.")

        related_cis = connector.get_person_cis(
            person_id,
            output_fields="id,name,friendlyname,finalclass",
        )
        detailed_cis = []
        for ci in related_cis:
            ci_class = str(ci.get("finalclass") or ci.itop_class or "FunctionalCI").strip() or "FunctionalCI"
            detailed_item = connector.get_ci(ci_class, ci.id, output_fields="*")
            visible_ci = detailed_item or ci
            if not is_visible_ci_status(visible_ci.get("status"), show_obsolete_assets, show_implementation_assets):
                continue
            detailed_cis.append(_build_ci_detail(visible_ci, warranty_alert_days))
        history_items: list[dict[str, str | int]] = []
    except ConnectionError as exc:
        raise AuthenticationError(
            f"No fue posible consultar el detalle de la persona en iTop: {exc}",
            status_code=503,
            code="ITOP_UNAVAILABLE",
        ) from exc
    finally:
        connector.close()

    return _build_person_detail(person, detailed_cis, history_items)
