from __future__ import annotations

import json
import unicodedata
from base64 import b64decode
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from core.config import settings
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
    "cancelled": "Anulada",
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
INPUT_TYPE_UI_TO_DB = {value: key for key, value in INPUT_TYPE_DB_TO_UI.items()}
HANDOVER_EVIDENCE_ROOT = Path("/app/data/handover_evidence")
DEFAULT_EVIDENCE_ALLOWED_EXTENSIONS = {"pdf", "doc", "docx"}


def _coerce_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _normalize_comparison_text(value: Any) -> str:
    text = _coerce_str(value)
    if not text:
        return ""
    return (
        unicodedata.normalize("NFD", text)
        .encode("ascii", "ignore")
        .decode("ascii")
        .strip()
        .lower()
    )


def _sanitize_attachment_filename(value: Any) -> str:
    name = Path(_coerce_str(value)).name
    sanitized = "".join(character if character.isalnum() or character in {".", "-", "_"} else "_" for character in name)
    return sanitized.strip("._") or "evidencia"


def _format_attachment_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{(size_bytes / 1024):.1f} KB"
    return f"{(size_bytes / (1024 * 1024)):.1f} MB"


def _get_allowed_evidence_extensions() -> set[str]:
    docs_settings = get_settings_panel("docs")
    configured_values = docs_settings.get("evidenceAllowedExtensions") or []
    allowed = {
        _coerce_str(item).lower().lstrip(".")
        for item in configured_values
        if _coerce_str(item).lower().lstrip(".") in {"pdf", "doc", "docx", "txt"}
    }
    return allowed or set(DEFAULT_EVIDENCE_ALLOWED_EXTENSIONS)


def _get_asset_assignment_restriction(asset: dict[str, Any]) -> str:
    status = _coerce_str(asset.get("status"))
    assigned_user = _coerce_str(asset.get("assignedUser"))
    normalized_status = _normalize_comparison_text(status)
    normalized_assigned_user = _normalize_comparison_text(assigned_user)

    if normalized_status != "stock":
        return f"No se puede asignar el activo '{_coerce_str(asset.get('code')) or _coerce_str(asset.get('name')) or 'sin codigo'}' porque esta en estado {status or 'desconocido'}."

    if normalized_assigned_user and normalized_assigned_user != "sin asignar":
        return f"No se puede asignar el activo '{_coerce_str(asset.get('code')) or _coerce_str(asset.get('name')) or 'sin codigo'}' porque ya esta asociado a {assigned_user}."

    return ""


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
                "cmdbClassLabel": row.get("cmdb_class_label") or "",
                "checks": items_by_template.get(template_id, []),
            }
        )
    return templates


def _matches_template_cmdb_class(asset_class_name: Any, template_class_label: Any) -> bool:
    normalized_asset_class = _normalize_comparison_text(asset_class_name)
    normalized_template_class = _normalize_comparison_text(template_class_label)

    if not normalized_template_class:
        return True

    return normalized_asset_class == normalized_template_class


def get_handover_bootstrap(session_user: dict[str, Any], runtime_token: str) -> dict[str, Any]:
    docs_settings = get_settings_panel("docs")
    allowed_evidence_extensions = sorted(_get_allowed_evidence_extensions())
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
        "actions": {
            "allowEvidenceUpload": bool(docs_settings.get("allowEvidenceUpload", True)),
            "evidenceAllowedExtensions": allowed_evidence_extensions,
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


def _is_answer_completed(answer: dict[str, Any]) -> bool:
    input_type = answer.get("input_type")
    response_value = answer.get("response_value")

    if input_type == "check":
        return response_value in {"0", "1"}

    return bool(_coerce_str(response_value))


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
                "storedName": _coerce_str(item.get("storedName")),
                "uploadedAt": _coerce_str(item.get("uploadedAt")),
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
                "storedName": _coerce_str(item.get("storedName")),
                "uploadedAt": _coerce_str(item.get("uploadedAt")),
            }
        )
    return json.dumps(normalized, ensure_ascii=True)


def _build_receiver_payload(receiver: dict[str, Any]) -> dict[str, Any]:
    return {
        "receiver_person_id": int(receiver["id"]) if receiver.get("id") else None,
        "receiver_code": _coerce_str(receiver.get("code")) or None,
        "receiver_name": _coerce_str(receiver.get("name")),
        "receiver_email": _coerce_str(receiver.get("email")) or None,
        "receiver_phone": _coerce_str(receiver.get("phone")) or None,
        "receiver_role": _coerce_str(receiver.get("role")) or None,
        "receiver_status": _coerce_str(receiver.get("status")) or None,
    }


def _build_item_payloads_from_detail(detail_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    for item in detail_items:
        asset = item.get("asset") or {}
        checklists: list[dict[str, Any]] = []
        for checklist in item.get("checklists") or []:
            answers: list[dict[str, Any]] = []
            for answer in checklist.get("answers") or []:
                input_type = INPUT_TYPE_UI_TO_DB.get(_coerce_str(answer.get("type")), "input_text")
                value = answer.get("value")
                response_value = "1" if input_type == "check" and bool(value) else ("0" if input_type == "check" else _coerce_str(value))
                answers.append(
                    {
                        "checklist_item_id": int(answer["checklistItemId"]),
                        "check_name": _coerce_str(answer.get("name")),
                        "check_description": _coerce_str(answer.get("description")),
                        "input_type": input_type,
                        "option_a": _coerce_str(answer.get("optionA")) or None,
                        "option_b": _coerce_str(answer.get("optionB")) or None,
                        "response_value": response_value,
                    }
                )

            checklists.append(
                {
                    "template_id": int(checklist["templateId"]),
                    "template_name": _coerce_str(checklist.get("templateName")),
                    "template_description": _coerce_str(checklist.get("templateDescription")) or None,
                    "answers": answers,
                }
            )

        payloads.append(
            {
                "asset_itop_id": int(asset["id"]),
                "asset_code": _coerce_str(asset.get("code")),
                "asset_name": _coerce_str(asset.get("name")),
                "asset_class_name": _coerce_str(asset.get("className")) or None,
                "asset_brand": _coerce_str(asset.get("brand")) or None,
                "asset_model": _coerce_str(asset.get("model")) or None,
                "asset_serial": _coerce_str(asset.get("serial")) or None,
                "asset_status": _coerce_str(asset.get("status")) or None,
                "assigned_user_name": _coerce_str(asset.get("assignedUser")) or None,
                "notes": _coerce_str(item.get("notes")) or None,
                "checklists": checklists,
            }
        )
    return payloads


def _build_document_payload_from_detail(
    current_detail: dict[str, Any],
    existing_document: dict[str, Any],
    *,
    status_ui: str,
    assignment_date: str,
    evidence_date: str,
    evidence_attachments: list[dict[str, Any]],
) -> dict[str, Any]:
    creation_at = _normalize_generated_at(current_detail.get("creationDate") or current_detail.get("generatedAt"))
    assignment_at = _normalize_optional_datetime(assignment_date)
    evidence_at = _normalize_optional_datetime(evidence_date)
    additional_receivers = _normalize_additional_receivers(
        current_detail.get("additionalReceivers") or [],
        int(current_detail.get("receiver", {}).get("id")) if current_detail.get("receiver", {}).get("id") else 0,
    )

    return {
        "document_number": existing_document["document_number"],
        "generated_at": creation_at.strftime("%Y-%m-%d %H:%M:%S"),
        "creation_date": creation_at.strftime("%Y-%m-%d %H:%M:%S"),
        "assignment_date": assignment_at.strftime("%Y-%m-%d %H:%M:%S") if assignment_at else None,
        "evidence_date": evidence_at.strftime("%Y-%m-%d %H:%M:%S") if evidence_at else None,
        "owner_user_id": int(existing_document["owner_user_id"]),
        "owner_name": existing_document["owner_name"],
        "status": STATUS_UI_TO_DB[status_ui],
        "handover_type": TYPE_UI_TO_DB[_coerce_str(current_detail.get("handoverType"), "Entrega inicial")],
        "reason": _coerce_str(current_detail.get("reason")),
        "notes": _coerce_str(current_detail.get("notes")) or None,
        "additional_receivers": additional_receivers or None,
        "evidence_attachments": _normalize_evidence_attachments(evidence_attachments) or None,
        **_build_receiver_payload(current_detail.get("receiver") or {}),
    }


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

        restriction_message = _get_asset_assignment_restriction(asset)
        if restriction_message:
            raise HTTPException(status_code=422, detail=restriction_message)

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
            if not _matches_template_cmdb_class(asset.get("className"), template.get("cmdbClassLabel")):
                raise HTTPException(
                    status_code=422,
                    detail=f"El checklist '{template['name']}' no aplica para el activo '{asset_code or asset_name}'.",
                )
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


def emit_handover_document(document_id: int, session_user: dict[str, Any]) -> dict[str, Any]:
    existing_document = fetch_handover_document_row(document_id)
    if not existing_document:
        raise HTTPException(status_code=404, detail="Acta de entrega no encontrada.")

    current_status = STATUS_DB_TO_UI.get(existing_document["status"], existing_document["status"])
    if current_status != "En creacion":
        raise HTTPException(status_code=422, detail="Solo se puede emitir un acta en estado En creacion.")

    current_detail = get_handover_document_detail(document_id)
    if not current_detail.get("receiver", {}).get("id"):
        raise HTTPException(status_code=422, detail="Debes seleccionar la persona destino antes de emitir el acta.")
    if not current_detail.get("items"):
        raise HTTPException(status_code=422, detail="Debes agregar al menos un activo antes de emitir el acta.")

    for item in current_detail["items"]:
        for checklist in item.get("checklists") or []:
            incomplete_answer = next(
                (answer for answer in checklist.get("answers") or [] if not _is_answer_completed({
                    "input_type": {
                        "Input text": "input_text",
                        "Text area": "text_area",
                        "Check": "check",
                        "Option / Radio": "radio",
                    }.get(answer.get("type"), "input_text"),
                    "response_value": "1" if answer.get("type") == "Check" and bool(answer.get("value")) else (
                        "0" if answer.get("type") == "Check" else _coerce_str(answer.get("value"))
                    ),
                })),
                None,
            )
            if incomplete_answer is not None:
                raise HTTPException(
                    status_code=422,
                    detail=f"Debes completar el check '{incomplete_answer['name']}' del activo '{item['asset'].get('code') or item['asset'].get('name') or 'sin codigo'}' antes de emitir.",
                )

    assignment_at = datetime.now().strftime("%Y-%m-%dT%H:%M")
    payload = {
        "generatedAt": current_detail.get("generatedAt") or current_detail.get("creationDate") or assignment_at,
        "creationDate": current_detail.get("creationDate") or current_detail.get("generatedAt") or assignment_at,
        "assignmentDate": assignment_at,
        "evidenceDate": current_detail.get("evidenceDate") or "",
        "evidenceAttachments": current_detail.get("evidenceAttachments") or [],
        "status": "Emitida",
        "handoverType": current_detail.get("handoverType") or "Entrega inicial",
        "reason": current_detail.get("reason") or "",
        "notes": current_detail.get("notes") or "",
        "receiver": current_detail.get("receiver") or {},
        "additionalReceivers": current_detail.get("additionalReceivers") or [],
        "items": current_detail.get("items") or [],
    }
    return update_handover_document(document_id, payload, session_user)


def rollback_handover_document(document_id: int, session_user: dict[str, Any]) -> dict[str, Any]:
    existing_document = fetch_handover_document_row(document_id)
    if not existing_document:
        raise HTTPException(status_code=404, detail="Acta de entrega no encontrada.")

    current_status = STATUS_DB_TO_UI.get(existing_document["status"], existing_document["status"])
    if current_status != "Emitida":
        raise HTTPException(status_code=422, detail="Solo se puede cancelar la emision de un acta en estado Emitida.")

    current_detail = get_handover_document_detail(document_id)
    payload = {
        "generatedAt": current_detail.get("generatedAt") or current_detail.get("creationDate") or "",
        "creationDate": current_detail.get("creationDate") or current_detail.get("generatedAt") or "",
        "assignmentDate": "",
        "evidenceDate": current_detail.get("evidenceDate") or "",
        "evidenceAttachments": current_detail.get("evidenceAttachments") or [],
        "status": "En creacion",
        "handoverType": current_detail.get("handoverType") or "Entrega inicial",
        "reason": current_detail.get("reason") or "",
        "notes": current_detail.get("notes") or "",
        "receiver": current_detail.get("receiver") or {},
        "additionalReceivers": current_detail.get("additionalReceivers") or [],
        "items": current_detail.get("items") or [],
    }
    return update_handover_document(document_id, payload, session_user)


def attach_handover_document_evidence(
    document_id: int,
    attachments: list[dict[str, Any]],
    session_user: dict[str, Any],
) -> dict[str, Any]:
    del session_user

    existing_document = fetch_handover_document_row(document_id)
    if not existing_document:
        raise HTTPException(status_code=404, detail="Acta de entrega no encontrada.")

    current_status = STATUS_DB_TO_UI.get(existing_document["status"], existing_document["status"])
    if current_status not in {"Emitida", "Confirmada"}:
        raise HTTPException(status_code=422, detail="Solo se puede cargar evidencia sobre actas emitidas o confirmadas.")
    if not attachments:
        raise HTTPException(status_code=422, detail="Debes adjuntar al menos una evidencia.")

    storage_directory = HANDOVER_EVIDENCE_ROOT / f"document_{document_id}"
    storage_directory.mkdir(parents=True, exist_ok=True)

    created_paths: list[Path] = []
    current_detail = get_handover_document_detail(document_id)
    now = datetime.now()
    evidence_at = now.strftime("%Y-%m-%dT%H:%M")
    serialized_attachments = list(current_detail.get("evidenceAttachments") or [])

    try:
        for index, attachment in enumerate(attachments, start=1):
            original_name = _sanitize_attachment_filename(attachment.get("name"))
            file_extension = Path(original_name).suffix.lower().lstrip(".")
            allowed_extensions = _get_allowed_evidence_extensions()
            if file_extension not in allowed_extensions:
                allowed_label = ", ".join(f".{item}" for item in sorted(allowed_extensions))
                raise HTTPException(
                    status_code=422,
                    detail=f"El archivo '{original_name}' no es valido para evidencia. Tipos permitidos: {allowed_label}.",
                )
            raw_content = _coerce_str(attachment.get("contentBase64"))
            try:
                content = b64decode(raw_content, validate=True) if raw_content else b""
            except Exception as exc:
                raise HTTPException(status_code=422, detail="Una de las evidencias adjuntas no tiene un formato valido.") from exc
            if not content:
                raise HTTPException(status_code=422, detail="Una de las evidencias adjuntas no contiene datos validos.")

            suffix = Path(original_name).suffix
            stored_name = f"{now.strftime('%Y%m%d%H%M%S')}_{index}_{uuid4().hex[:8]}{suffix}"
            stored_path = storage_directory / stored_name
            stored_path.write_bytes(bytes(content))
            created_paths.append(stored_path)

            serialized_attachments.append(
                {
                    "name": Path(original_name).name,
                    "size": _format_attachment_size(len(content)),
                    "mimeType": _coerce_str(attachment.get("mimeType")) or "application/octet-stream",
                    "source": f"{settings.env_name}/handover_evidence/document_{document_id}/{stored_name}",
                    "storedName": stored_name,
                    "uploadedAt": evidence_at,
                }
            )

        document_payload = _build_document_payload_from_detail(
            current_detail,
            existing_document,
            status_ui="Confirmada",
            assignment_date=current_detail.get("assignmentDate") or evidence_at,
            evidence_date=evidence_at,
            evidence_attachments=serialized_attachments,
        )
        item_payloads = _build_item_payloads_from_detail(current_detail.get("items") or [])
        save_handover_document(document_id, document_payload, item_payloads)
    except Exception:
        for path in created_paths:
            try:
                if path.exists():
                    path.unlink()
            except OSError:
                continue
        raise

    return get_handover_document_detail(document_id)
