from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from checklists_repository import (
    create_checklist_template,
    fetch_checklist_item_rows,
    fetch_checklist_rows,
    fetch_checklist_template_row,
    get_next_template_sort_order,
    replace_checklist_items,
    update_checklist_template,
)


MODULE_CODES = ("lab", "handover", "reassignment", "reception")

ITEM_TYPE_DB_TO_UI = {
    "input_text": "Input text",
    "text_area": "Text area",
    "check": "Check",
    "radio": "Option / Radio",
}

ITEM_TYPE_UI_TO_DB = {value: key for key, value in ITEM_TYPE_DB_TO_UI.items()}

STATUS_DB_TO_UI = {
    "active": "Activo",
    "inactive": "Inactivo",
}

STATUS_UI_TO_DB = {value: key for key, value in STATUS_DB_TO_UI.items()}


def _coerce_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _serialize_template(template_row: dict[str, Any], item_rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "id": template_row["id"],
        "moduleCode": template_row["module_code"],
        "name": template_row["name"],
        "description": template_row["description"],
        "status": STATUS_DB_TO_UI.get(template_row["status"], "Activo"),
        "cmdbClass": template_row.get("cmdb_class_label") or "",
        "checks": [
            {
                "id": item["id"],
                "name": item["name"],
                "description": item["description"],
                "type": ITEM_TYPE_DB_TO_UI.get(item["input_type"], "Input text"),
                "optionA": item.get("option_a") or "",
                "optionB": item.get("option_b") or "",
            }
            for item in item_rows
        ],
    }


def _serialize_grouped_rows(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[int, dict[str, Any]] = {}
    order: list[int] = []

    for row in rows:
        template_id = row["template_id"]
        if template_id not in grouped:
            grouped[template_id] = {
                "id": template_id,
                "moduleCode": row["module_code"],
                "name": row["template_name"],
                "description": row["template_description"],
                "status": STATUS_DB_TO_UI.get(row["template_status"], "Activo"),
                "cmdbClass": row.get("cmdb_class_label") or "",
                "checks": [],
            }
            order.append(template_id)

        if row.get("item_id"):
            grouped[template_id]["checks"].append({
                "id": row["item_id"],
                "name": row["item_name"],
                "description": row["item_description"],
                "type": ITEM_TYPE_DB_TO_UI.get(row["input_type"], "Input text"),
                "optionA": row.get("option_a") or "",
                "optionB": row.get("option_b") or "",
            })

    items_by_module: dict[str, list[dict[str, Any]]] = {module_code: [] for module_code in MODULE_CODES}
    for template_id in order:
        template = grouped[template_id]
        items_by_module.setdefault(template["moduleCode"], []).append(template)
    return items_by_module


def list_checklists_payload() -> dict[str, Any]:
    return {
        "itemsByModule": _serialize_grouped_rows(fetch_checklist_rows()),
    }


def _normalize_check_item(item: dict[str, Any], index: int) -> dict[str, Any]:
    name = _coerce_str(item.get("name"))
    description = _coerce_str(item.get("description"))
    item_type_ui = _coerce_str(item.get("type"), "Input text")
    input_type = ITEM_TYPE_UI_TO_DB.get(item_type_ui)
    option_a = _coerce_str(item.get("optionA"))
    option_b = _coerce_str(item.get("optionB"))

    if not name:
        raise HTTPException(status_code=422, detail=f"El nombre del check #{index + 1} es obligatorio.")
    if not description:
        raise HTTPException(status_code=422, detail=f"La descripcion del check #{index + 1} es obligatoria.")
    if not input_type:
        raise HTTPException(status_code=422, detail=f"El tipo del check #{index + 1} no es valido.")
    if input_type == "radio" and (not option_a or not option_b):
        raise HTTPException(status_code=422, detail=f"El check #{index + 1} requiere Estado A y Estado B.")

    return {
        "name": name,
        "description": description,
        "input_type": input_type,
        "option_a": option_a if input_type == "radio" else None,
        "option_b": option_b if input_type == "radio" else None,
    }


def _normalize_checklist_payload(payload: dict[str, Any], current_module_code: str | None = None) -> dict[str, Any]:
    module_code = _coerce_str(payload.get("moduleCode"), current_module_code or "")
    name = _coerce_str(payload.get("name"))
    description = _coerce_str(payload.get("description"))
    status_ui = _coerce_str(payload.get("status"), "Activo")
    cmdb_class = _coerce_str(payload.get("cmdbClass"))
    checks = payload.get("checks") or []

    if module_code not in MODULE_CODES:
        raise HTTPException(status_code=422, detail="El modulo del checklist no es valido.")
    if not name:
        raise HTTPException(status_code=422, detail="El nombre del checklist es obligatorio.")
    if not description:
        raise HTTPException(status_code=422, detail="La descripcion del checklist es obligatoria.")
    if status_ui not in STATUS_UI_TO_DB:
        raise HTTPException(status_code=422, detail="El estado del checklist no es valido.")
    if module_code == "lab" and not cmdb_class:
        raise HTTPException(status_code=422, detail="La clase CMDB es obligatoria para checklist de laboratorio.")
    if not isinstance(checks, list):
        raise HTTPException(status_code=422, detail="La lista de checks no es valida.")

    return {
        "module_code": module_code,
        "name": name,
        "description": description,
        "status": STATUS_UI_TO_DB[status_ui],
        "cmdb_class_label": cmdb_class or None,
        "checks": [_normalize_check_item(item, index) for index, item in enumerate(checks)],
    }


def _fetch_serialized_template(template_id: int) -> dict[str, Any]:
    template_row = fetch_checklist_template_row(template_id)
    if not template_row:
        raise HTTPException(status_code=404, detail="Checklist no encontrado.")
    item_rows = fetch_checklist_item_rows(template_id)
    return _serialize_template(template_row, item_rows)


def create_checklist(payload: dict[str, Any]) -> dict[str, Any]:
    normalized = _normalize_checklist_payload(payload)
    template_id = create_checklist_template(
        module_code=normalized["module_code"],
        name=normalized["name"],
        description=normalized["description"],
        status=normalized["status"],
        cmdb_class_label=normalized["cmdb_class_label"],
        sort_order=get_next_template_sort_order(normalized["module_code"]),
    )
    replace_checklist_items(template_id, normalized["checks"])
    return _fetch_serialized_template(template_id)


def update_checklist(template_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    existing = fetch_checklist_template_row(template_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Checklist no encontrado.")

    normalized = _normalize_checklist_payload(payload, current_module_code=existing["module_code"])
    if normalized["module_code"] != existing["module_code"]:
        raise HTTPException(status_code=422, detail="No es posible cambiar el modulo del checklist.")

    update_checklist_template(
        template_id=template_id,
        name=normalized["name"],
        description=normalized["description"],
        status=normalized["status"],
        cmdb_class_label=normalized["cmdb_class_label"],
    )
    replace_checklist_items(template_id, normalized["checks"])
    return _fetch_serialized_template(template_id)
