from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import HTTPException

from modules.handover.repository import (
    fetch_handover_checklist_answer_rows,
    fetch_handover_document_row,
    fetch_handover_document_rows,
    fetch_handover_item_checklist_rows,
    fetch_handover_item_rows,
    fetch_handover_template_item_rows,
    fetch_handover_template_rows,
    get_next_handover_sequence,
    save_handover_document,
)
from modules.settings.service import get_settings_panel


STATUS_DB_TO_UI = {
    "draft": "En creacion",
    "issued": "Emitida",
    "confirmed": "Confirmada",
}

STATUS_UI_TO_DB = {value: key for key, value in STATUS_DB_TO_UI.items()}

TYPE_DB_TO_UI = {
    "initial_assignment": "Entrega inicial",
    "reassignment": "Reasignacion",
    "replacement": "Reposicion",
}

TYPE_UI_TO_DB = {value: key for key, value in TYPE_DB_TO_UI.items()}

SECONDARY_RECEIVER_ROLE_ALIASES = {
    "Apoyo": "Respaldo operativo",
}

SECONDARY_RECEIVER_ROLE_OPTIONS = {
    "Contraturno",
    "Referente de area",
    "Respaldo operativo",
    "Testigo",
}

INPUT_TYPE_DB_TO_UI = {
    "input_text": "Input text",
    "text_area": "Text area",
    "check": "Check",
    "radio": "Option / Radio",
}


def _coerce_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _serialize_datetime(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%dT%H:%M")

    text = str(value).strip()
    if not text:
        return ""

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%dT%H:%M")
        except ValueError:
            continue
    return text


def _serialize_date(value: Any) -> str:
    serialized = _serialize_datetime(value)
    return serialized[:10] if serialized else ""


def _format_asset_summary(first_asset_name: str, asset_count: int) -> str:
    if asset_count <= 0:
        return "Sin activos"
    if asset_count == 1:
        return first_asset_name or "Activo"
    base_name = first_asset_name or "Activo"
    return f"{base_name} + {asset_count - 1} mas"


def _serialize_template_catalog(include_inactive: bool = False) -> list[dict[str, Any]]:
    template_rows = fetch_handover_template_rows(include_inactive=include_inactive)
    template_ids = [int(row["id"]) for row in template_rows]
    item_rows = fetch_handover_template_item_rows(template_ids)
    items_by_template: dict[int, list[dict[str, Any]]] = {template_id: [] for template_id in template_ids}

    for row in item_rows:
        template_id = int(row["template_id"])
        items_by_template.setdefault(template_id, []).append(
            {
                "id": int(row["id"]),
                "name": row["name"],
                "description": row["description"],
                "type": INPUT_TYPE_DB_TO_UI.get(row["input_type"], "Input text"),
                "optionA": row.get("option_a") or "",
                "optionB": row.get("option_b") or "",
            }
        )

    templates: list[dict[str, Any]] = []
    for row in template_rows:
        template_id = int(row["id"])
        templates.append(
            {
                "id": template_id,
                "name": row["name"],
                "description": row["description"],
                "status": row["status"],
                "checks": items_by_template.get(template_id, []),
            }
        )
    return templates


def get_handover_bootstrap(session_user: dict[str, Any], runtime_token: str) -> dict[str, Any]:
    docs_settings = get_settings_panel("docs")
    return {
        "sessionUser": {
            "id": session_user["id"],
            "username": session_user["username"],
            "name": session_user["name"],
        },
        "defaults": {
            "generatedAt": datetime.now().strftime("%Y-%m-%dT%H:%M"),
            "creationDate": datetime.now().strftime("%Y-%m-%dT%H:%M"),
            "assignmentDate": "",
            "evidenceDate": "",
            "evidenceAttachments": [],
            "notes": "",
            "notesPlaceholder": docs_settings.get("defaultObservation") or "",
            "prefix": docs_settings.get("handoverPrefix") or "ENT",
        },
        "statusOptions": [
            {"value": value, "label": label}
            for value, label in STATUS_DB_TO_UI.items()
        ],
        "typeOptions": [
            {"value": value, "label": label}
            for value, label in TYPE_DB_TO_UI.items()
            if value != "reassignment"
        ],
        "checklistTemplates": _serialize_template_catalog(include_inactive=False),
        "searchHints": {
            "minCharsPeople": 2,
            "minCharsAssets": 2,
        },
        "runtimeReady": bool(runtime_token),
    }


def list_handover_documents(
    query: str = "",
    status: str = "",
    handover_type: str = "",
) -> dict[str, Any]:
    normalized_status = _coerce_str(status)
    normalized_type = _coerce_str(handover_type)

    if normalized_status and normalized_status not in STATUS_DB_TO_UI:
        raise HTTPException(status_code=422, detail="El estado de acta no es valido.")
    if normalized_type and normalized_type not in TYPE_DB_TO_UI:
        raise HTTPException(status_code=422, detail="El tipo de entrega no es valido.")

    rows = fetch_handover_document_rows(
        query=_coerce_str(query),
        status=normalized_status,
        handover_type=normalized_type,
    )

    items = [
        {
            "id": int(row["id"]),
            "code": row["document_number"],
            "person": row["receiver_name"],
            "email": row.get("receiver_email") or "",
            "role": row.get("receiver_role") or "",
            "assetCount": int(row.get("asset_count") or 0),
            "asset": _format_asset_summary(
                _coerce_str(row.get("first_asset_name")),
                int(row.get("asset_count") or 0),
            ),
            "date": _serialize_date(row.get("generated_at")),
            "generatedAt": _serialize_datetime(row.get("generated_at")),
            "status": STATUS_DB_TO_UI.get(row["status"], row["status"]),
            "handoverType": TYPE_DB_TO_UI.get(row["handover_type"], row["handover_type"]),
            "ownerName": row["owner_name"],
        }
        for row in rows
    ]
    return {"items": items}


def get_handover_document_detail(document_id: int) -> dict[str, Any]:
    document_row = fetch_handover_document_row(document_id)
    if not document_row:
        raise HTTPException(status_code=404, detail="Acta de entrega no encontrada.")

    item_rows = fetch_handover_item_rows(document_id)
    checklist_rows = fetch_handover_item_checklist_rows(document_id)
    answer_rows = fetch_handover_checklist_answer_rows(document_id)

    items_by_id: dict[int, dict[str, Any]] = {}
    for row in item_rows:
        item_id = int(row["id"])
        items_by_id[item_id] = {
            "id": item_id,
            "asset": {
                "id": int(row["asset_itop_id"]),
                "code": row["asset_code"],
                "name": row["asset_name"],
                "className": row.get("asset_class_name") or "",
                "brand": row.get("asset_brand") or "",
                "model": row.get("asset_model") or "",
                "serial": row.get("asset_serial") or "",
                "status": row.get("asset_status") or "",
                "assignedUser": row.get("assigned_user_name") or "",
            },
            "notes": row.get("notes") or "",
            "checklists": [],
        }

    checklist_index: dict[tuple[int, int], dict[str, Any]] = {}
    for row in checklist_rows:
        item_id = int(row["item_id"])
        template_id = int(row["template_id"])
        checklist_payload = {
            "templateId": template_id,
            "templateName": row["template_name"],
            "templateDescription": row.get("template_description") or "",
            "answers": [],
        }
        items_by_id[item_id]["checklists"].append(checklist_payload)
        checklist_index[(item_id, template_id)] = checklist_payload

    for row in answer_rows:
        item_id = int(row["item_id"])
        template_id = int(row["template_id"])
        checklist_payload = checklist_index.get((item_id, template_id))
        if checklist_payload is None:
            continue

        input_type = row["input_type"]
        raw_value = row.get("response_value")
        if input_type == "check":
            value: Any = str(raw_value or "").strip() == "1"
        else:
            value = raw_value or ""

        checklist_payload["answers"].append(
            {
                "checklistItemId": int(row["checklist_item_id"]),
                "name": row["check_name"],
                "description": row["check_description"],
                "type": INPUT_TYPE_DB_TO_UI.get(input_type, "Input text"),
                "optionA": row.get("option_a") or "",
                "optionB": row.get("option_b") or "",
                "value": value,
            }
        )

    return {
        "id": int(document_row["id"]),
        "documentNumber": document_row["document_number"],
        "generatedAt": _serialize_datetime(document_row.get("generated_at")),
        "creationDate": _serialize_datetime(document_row.get("creation_date") or document_row.get("generated_at")),
        "assignmentDate": _serialize_datetime(document_row.get("assignment_date")),
        "evidenceDate": _serialize_datetime(document_row.get("evidence_date")),
        "evidenceAttachments": _deserialize_evidence_attachments(document_row.get("evidence_attachments")),
        "status": STATUS_DB_TO_UI.get(document_row["status"], document_row["status"]),
        "handoverType": TYPE_DB_TO_UI.get(document_row["handover_type"], document_row["handover_type"]),
        "reason": document_row["reason"],
        "notes": document_row.get("notes") or "",
        "owner": {
            "userId": int(document_row["owner_user_id"]),
            "name": document_row["owner_name"],
        },
        "receiver": {
            "id": int(document_row["receiver_person_id"]) if document_row.get("receiver_person_id") else None,
            "code": document_row.get("receiver_code") or "",
            "name": document_row["receiver_name"],
            "email": document_row.get("receiver_email") or "",
            "phone": document_row.get("receiver_phone") or "",
            "role": document_row.get("receiver_role") or "",
            "status": document_row.get("receiver_status") or "",
        },
        "additionalReceivers": _deserialize_additional_receivers(document_row.get("additional_receivers")),
        "items": list(items_by_id.values()),
    }


def _normalize_generated_at(value: Any) -> datetime:
    text = _coerce_str(value)
    if not text:
        return datetime.now()

    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    raise HTTPException(status_code=422, detail="La fecha de emision no es valida.")


def _normalize_optional_datetime(value: Any) -> datetime | None:
    text = _coerce_str(value)
    if not text:
        return None

    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    raise HTTPException(status_code=422, detail="Una de las fechas del acta no es valida.")


def _normalize_response_value(answer: dict[str, Any], template_item: dict[str, Any]) -> str | None:
    input_type = template_item["type"]
    raw_value = answer.get("value")

    if input_type == "check":
        return "1" if bool(raw_value) else "0"

    value = _coerce_str(raw_value)
    if input_type == "radio":
        allowed = {template_item.get("optionA") or "", template_item.get("optionB") or "", ""}
        if value not in allowed:
            raise HTTPException(status_code=422, detail=f"La respuesta del check '{template_item['name']}' no es valida.")
    return value


def _build_template_catalog_by_id() -> dict[int, dict[str, Any]]:
    template_map: dict[int, dict[str, Any]] = {}
    for template in _serialize_template_catalog(include_inactive=True):
        template_map[int(template["id"])] = template
    return template_map


def _normalize_receiver(payload: dict[str, Any]) -> dict[str, Any]:
    receiver_id = payload.get("id")
    name = _coerce_str(payload.get("name"))
    if receiver_id in (None, ""):
        raise HTTPException(status_code=422, detail="Debes seleccionar la persona destino.")
    if not name:
        raise HTTPException(status_code=422, detail="La persona destino no es valida.")

    try:
        parsed_receiver_id = int(receiver_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="La persona destino no es valida.") from exc

    return {
        "receiver_person_id": parsed_receiver_id,
        "receiver_code": _coerce_str(payload.get("code")),
        "receiver_name": name,
        "receiver_email": _coerce_str(payload.get("email")),
        "receiver_phone": _coerce_str(payload.get("phone")),
        "receiver_role": _coerce_str(payload.get("role")),
        "receiver_status": _coerce_str(payload.get("status")),
    }


def _deserialize_additional_receivers(raw_value: Any) -> list[dict[str, Any]]:
    text = _coerce_str(raw_value)
    if not text:
        return []

    try:
        payload = json.loads(text)
    except (TypeError, ValueError, json.JSONDecodeError):
        return []

    if not isinstance(payload, list):
        return []

    normalized: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        normalized.append(
            {
                "id": item.get("id"),
                "code": _coerce_str(item.get("code")),
                "name": _coerce_str(item.get("name")),
                "email": _coerce_str(item.get("email")),
                "phone": _coerce_str(item.get("phone")),
                "role": _coerce_str(item.get("role")),
                "status": _coerce_str(item.get("status")),
                "assignmentRole": SECONDARY_RECEIVER_ROLE_ALIASES.get(
                    _coerce_str(item.get("assignmentRole")),
                    _coerce_str(item.get("assignmentRole")),
                ),
            }
        )
    return normalized


def _deserialize_evidence_attachments(raw_value: Any) -> list[dict[str, Any]]:
    text = _coerce_str(raw_value)
    if not text:
        return []

    try:
        payload = json.loads(text)
    except (TypeError, ValueError, json.JSONDecodeError):
        return []

    if not isinstance(payload, list):
        return []

    normalized: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        normalized.append(
            {
                "name": _coerce_str(item.get("name")),
                "size": _coerce_str(item.get("size")),
                "mimeType": _coerce_str(item.get("mimeType")),
                "source": _coerce_str(item.get("source")),
            }
        )
    return normalized


def _normalize_evidence_attachments(payload: Any) -> str:
    if not payload:
        return ""
    if not isinstance(payload, list):
        raise HTTPException(status_code=422, detail="La evidencia adjunta no tiene un formato valido.")

    normalized: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            raise HTTPException(status_code=422, detail="La evidencia adjunta no tiene un formato valido.")
        normalized.append(
            {
                "name": _coerce_str(item.get("name")),
                "size": _coerce_str(item.get("size")),
                "mimeType": _coerce_str(item.get("mimeType")),
                "source": _coerce_str(item.get("source")),
            }
        )
    return json.dumps(normalized, ensure_ascii=True)


def _normalize_additional_receivers(payload: Any, primary_receiver_id: int) -> str:
    if not payload:
        return ""
    if not isinstance(payload, list):
        raise HTTPException(status_code=422, detail="Los contactos adicionales no tienen un formato valido.")

    normalized: list[dict[str, Any]] = []
    seen_ids: set[int] = set()
    for item in payload:
        if not isinstance(item, dict):
            raise HTTPException(status_code=422, detail="Los contactos adicionales no tienen un formato valido.")

        try:
            parsed_id = int(item.get("id"))
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=422, detail="Uno de los contactos adicionales no es valido.") from exc

        if parsed_id == primary_receiver_id:
            raise HTTPException(status_code=422, detail="La persona principal no puede repetirse como contacto adicional.")
        if parsed_id in seen_ids:
            raise HTTPException(status_code=422, detail="No se puede repetir un mismo contacto adicional.")

        name = _coerce_str(item.get("name"))
        if not name:
            raise HTTPException(status_code=422, detail="Uno de los contactos adicionales no es valido.")

        assignment_role = SECONDARY_RECEIVER_ROLE_ALIASES.get(
            _coerce_str(item.get("assignmentRole"), "Contraturno"),
            _coerce_str(item.get("assignmentRole"), "Contraturno"),
        )
        if assignment_role not in SECONDARY_RECEIVER_ROLE_OPTIONS:
            raise HTTPException(status_code=422, detail="El rol de un contacto adicional no es valido.")

        seen_ids.add(parsed_id)
        normalized.append(
            {
                "id": parsed_id,
                "code": _coerce_str(item.get("code")),
                "name": name,
                "email": _coerce_str(item.get("email")),
                "phone": _coerce_str(item.get("phone")),
                "role": _coerce_str(item.get("role")),
                "status": _coerce_str(item.get("status")),
                "assignmentRole": assignment_role,
            }
        )

    return json.dumps(normalized, ensure_ascii=True)


def _normalize_items(payload_items: list[dict[str, Any]], template_catalog: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
    if not isinstance(payload_items, list) or not payload_items:
        raise HTTPException(status_code=422, detail="Debes agregar al menos un activo al acta.")

    normalized_items: list[dict[str, Any]] = []
    seen_asset_ids: set[int] = set()

    for item in payload_items:
        asset = item.get("asset") or {}
        asset_id = asset.get("id")
        asset_name = _coerce_str(asset.get("name"))
        asset_code = _coerce_str(asset.get("code"))

        try:
            parsed_asset_id = int(asset_id)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=422, detail="Uno de los activos seleccionados no es valido.") from exc

        if parsed_asset_id in seen_asset_ids:
            raise HTTPException(status_code=422, detail="No se puede repetir el mismo activo dentro del acta.")
        if not asset_name or not asset_code:
            raise HTTPException(status_code=422, detail="Uno de los activos seleccionados no es valido.")
        seen_asset_ids.add(parsed_asset_id)

        checklist_payloads = item.get("checklists") or []
        if not isinstance(checklist_payloads, list):
            raise HTTPException(status_code=422, detail="La estructura de checklists del activo no es valida.")

        normalized_checklists: list[dict[str, Any]] = []
        seen_template_ids: set[int] = set()

        for checklist in checklist_payloads:
            template_id = checklist.get("templateId")
            try:
                parsed_template_id = int(template_id)
            except (TypeError, ValueError) as exc:
                raise HTTPException(status_code=422, detail="Uno de los checklists del acta no es valido.") from exc

            template = template_catalog.get(parsed_template_id)
            if template is None:
                raise HTTPException(status_code=422, detail="Uno de los checklists seleccionados ya no existe.")
            if parsed_template_id in seen_template_ids:
                raise HTTPException(status_code=422, detail="No se puede repetir una misma plantilla en el mismo activo.")
            seen_template_ids.add(parsed_template_id)

            answers_payload = checklist.get("answers") or []
            answers_by_id: dict[int, dict[str, Any]] = {}
            for answer in answers_payload:
                checklist_item_id = answer.get("checklistItemId")
                try:
                    parsed_item_id = int(checklist_item_id)
                except (TypeError, ValueError) as exc:
                    raise HTTPException(status_code=422, detail="Una respuesta del checklist no es valida.") from exc
                answers_by_id[parsed_item_id] = answer

            normalized_answers: list[dict[str, Any]] = []
            for template_item in template["checks"]:
                template_item_id = int(template_item["id"])
                answer_payload = answers_by_id.get(template_item_id, {"value": False if template_item["type"] == "Check" else ""})
                normalized_answers.append(
                    {
                        "checklist_item_id": template_item_id,
                        "check_name": template_item["name"],
                        "check_description": template_item["description"],
                        "input_type": {
                            "Input text": "input_text",
                            "Text area": "text_area",
                            "Check": "check",
                            "Option / Radio": "radio",
                        }[template_item["type"]],
                        "option_a": template_item.get("optionA") or None,
                        "option_b": template_item.get("optionB") or None,
                        "response_value": _normalize_response_value(answer_payload, template_item),
                    }
                )

            normalized_checklists.append(
                {
                    "template_id": parsed_template_id,
                    "template_name": template["name"],
                    "template_description": template["description"],
                    "answers": normalized_answers,
                }
            )

        normalized_items.append(
            {
                "asset_itop_id": parsed_asset_id,
                "asset_code": asset_code,
                "asset_name": asset_name,
                "asset_class_name": _coerce_str(asset.get("className")),
                "asset_brand": _coerce_str(asset.get("brand")),
                "asset_model": _coerce_str(asset.get("model")),
                "asset_serial": _coerce_str(asset.get("serial")),
                "asset_status": _coerce_str(asset.get("status")),
                "assigned_user_name": _coerce_str(asset.get("assignedUser")),
                "notes": _coerce_str(item.get("notes")),
                "checklists": normalized_checklists,
            }
        )

    return normalized_items


def _normalize_handover_payload(
    payload: dict[str, Any],
    session_user: dict[str, Any],
    document_number: str,
    existing_document: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    creation_at = _normalize_generated_at(payload.get("creationDate") or payload.get("generatedAt"))
    assignment_at = _normalize_optional_datetime(payload.get("assignmentDate"))
    evidence_at = _normalize_optional_datetime(payload.get("evidenceDate"))
    status_ui = _coerce_str(payload.get("status"), "En creacion")
    handover_type_ui = _coerce_str(payload.get("handoverType"), "Entrega inicial")
    reason = _coerce_str(payload.get("reason"))
    notes = _coerce_str(payload.get("notes"))

    if status_ui not in STATUS_UI_TO_DB:
        raise HTTPException(status_code=422, detail="El estado del acta no es valido.")
    if handover_type_ui not in TYPE_UI_TO_DB:
        raise HTTPException(status_code=422, detail="El tipo de entrega no es valido.")

    template_catalog = _build_template_catalog_by_id()
    receiver = _normalize_receiver(payload.get("receiver") or {})
    additional_receivers = _normalize_additional_receivers(payload.get("additionalReceivers") or [], receiver["receiver_person_id"])
    evidence_attachments = _normalize_evidence_attachments(payload.get("evidenceAttachments") or [])
    items = _normalize_items(payload.get("items") or [], template_catalog)

    if not reason:
        raise HTTPException(status_code=422, detail="Debes indicar el motivo de entrega.")

    owner_user_id = int(existing_document["owner_user_id"]) if existing_document else int(session_user["id"])
    owner_name = existing_document["owner_name"] if existing_document else session_user["name"]

    document_payload = {
        "document_number": document_number,
        "generated_at": creation_at.strftime("%Y-%m-%d %H:%M:%S"),
        "creation_date": creation_at.strftime("%Y-%m-%d %H:%M:%S"),
        "assignment_date": assignment_at.strftime("%Y-%m-%d %H:%M:%S") if assignment_at else None,
        "evidence_date": evidence_at.strftime("%Y-%m-%d %H:%M:%S") if evidence_at else None,
        "owner_user_id": owner_user_id,
        "owner_name": owner_name,
        "status": STATUS_UI_TO_DB[status_ui],
        "handover_type": TYPE_UI_TO_DB[handover_type_ui],
        "reason": reason,
        "notes": notes or None,
        "additional_receivers": additional_receivers or None,
        "evidence_attachments": evidence_attachments or None,
        **receiver,
    }
    return document_payload, items


def _generate_document_number(generated_at: datetime) -> str:
    docs_settings = get_settings_panel("docs")
    prefix = _coerce_str(docs_settings.get("handoverPrefix"), "ENT") or "ENT"
    year = generated_at.year
    sequence = get_next_handover_sequence(prefix, year)
    return f"{prefix}-{year}-{sequence:04d}"


def create_handover_document(payload: dict[str, Any], session_user: dict[str, Any]) -> dict[str, Any]:
    creation_at = _normalize_generated_at(payload.get("creationDate") or payload.get("generatedAt"))
    document_number = _generate_document_number(creation_at)
    document_payload, item_payloads = _normalize_handover_payload(
        {**payload, "creationDate": creation_at.strftime("%Y-%m-%dT%H:%M"), "generatedAt": creation_at.strftime("%Y-%m-%dT%H:%M")},
        session_user,
        document_number=document_number,
        existing_document=None,
    )
    saved_document_id = save_handover_document(None, document_payload, item_payloads)
    return get_handover_document_detail(saved_document_id)


def update_handover_document(
    document_id: int,
    payload: dict[str, Any],
    session_user: dict[str, Any],
) -> dict[str, Any]:
    existing_document = fetch_handover_document_row(document_id)
    if not existing_document:
        raise HTTPException(status_code=404, detail="Acta de entrega no encontrada.")

    document_payload, item_payloads = _normalize_handover_payload(
        payload,
        session_user,
        document_number=existing_document["document_number"],
        existing_document=existing_document,
    )
    save_handover_document(document_id, document_payload, item_payloads)
    return get_handover_document_detail(document_id)
