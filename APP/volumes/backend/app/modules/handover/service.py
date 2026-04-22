from __future__ import annotations

import json
import unicodedata
from base64 import b64decode, b64encode
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from core.config import settings
from integrations.itop_cmdb_connector import iTopCMDBConnector, iTopObject
from integrations.itop_runtime import get_itop_runtime_config
from infrastructure.job_manager import create_job, get_job
from modules.handover.pdf_pipeline import (
    HANDOVER_DOCUMENT_ROOT,
    build_detail_document_number,
    generate_handover_documents,
    remove_generated_handover_documents,
    remove_generated_handover_documents_by_names,
)
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
GENERATED_DOCUMENT_KINDS = {"main", "detail"}
MAX_HANDOVER_DOCUMENT_FILES = 2
EVIDENCE_DOCUMENT_TYPE_TO_GENERATED_KIND = {
    "acta": "main",
    "detalle": "detail",
}


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


def _normalize_ticket_id(value: Any) -> str:
    text = _coerce_str(value)
    return text if text.isdigit() else ""


def _normalize_itop_impact(value: Any) -> str:
    normalized = _coerce_str(value).lower()
    mapping = {
        "department": "1",
        "service": "2",
        "group": "2",
        "person": "3",
    }
    return mapping.get(normalized, normalized if normalized in {"1", "2", "3"} else "")


def _normalize_itop_level(value: Any) -> str:
    normalized = _coerce_str(value).lower()
    mapping = {
        "critical": "1",
        "critica": "1",
        "high": "2",
        "alta": "2",
        "medium": "3",
        "media": "3",
        "low": "4",
        "baja": "4",
    }
    return mapping.get(normalized, normalized if normalized in {"1", "2", "3", "4"} else "")


def _build_itop_connector(runtime_token: str) -> iTopCMDBConnector:
    itop_config = get_itop_runtime_config()
    return iTopCMDBConnector(
        base_url=itop_config["integrationUrl"],
        token=runtime_token,
        username="hub-session-user",
        verify_ssl=itop_config["verifySsl"],
        timeout=itop_config["timeoutSeconds"],
    )


def _get_allowed_evidence_extensions() -> set[str]:
    docs_settings = get_settings_panel("docs")
    configured_values = docs_settings.get("evidenceAllowedExtensions") or []
    allowed = {
        _coerce_str(item).lower().lstrip(".")
        for item in configured_values
        if _coerce_str(item).lower().lstrip(".") in {"pdf", "doc", "docx", "txt"}
    }
    return allowed or set(DEFAULT_EVIDENCE_ALLOWED_EXTENSIONS)


def _normalize_evidence_document_type(value: Any, *, allow_blank: bool = False) -> str:
    normalized = _normalize_comparison_text(value)
    if not normalized:
        if allow_blank:
            return ""
        raise HTTPException(status_code=422, detail="Debes indicar si el adjunto corresponde a Acta o Detalle.")

    if normalized in {"acta", "main", "principal"}:
        return "acta"
    if normalized in {"detalle", "detail"}:
        return "detalle"

    if allow_blank:
        return ""
    raise HTTPException(status_code=422, detail="Uno de los adjuntos no tiene un tipo de documento valido.")


def _normalize_itop_ticket_summary(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}

    return {
        "id": _coerce_str(value.get("id")),
        "number": _coerce_str(value.get("number") or value.get("ref")),
        "className": _coerce_str(value.get("className") or value.get("ticketClass")),
        "status": _coerce_str(value.get("status")),
        "subject": _coerce_str(value.get("subject")),
        "description": _coerce_str(value.get("description")),
        "requesterId": _coerce_str(value.get("requesterId")),
        "requester": _coerce_str(value.get("requester")),
        "orgId": _coerce_str(value.get("orgId")),
        "groupId": _coerce_str(value.get("groupId")),
        "groupName": _coerce_str(value.get("groupName")),
        "analystId": _coerce_str(value.get("analystId")),
        "analystName": _coerce_str(value.get("analystName")),
        "origin": _coerce_str(value.get("origin")),
        "originLabel": _coerce_str(value.get("originLabel")),
        "impact": _coerce_str(value.get("impact")),
        "impactLabel": _coerce_str(value.get("impactLabel")),
        "urgency": _coerce_str(value.get("urgency")),
        "urgencyLabel": _coerce_str(value.get("urgencyLabel")),
        "priority": _coerce_str(value.get("priority")),
        "priorityLabel": _coerce_str(value.get("priorityLabel")),
        "category": _coerce_str(value.get("category")),
        "categoryLabel": _coerce_str(value.get("categoryLabel")),
        "subcategory": _coerce_str(value.get("subcategory")),
        "subcategoryLabel": _coerce_str(value.get("subcategoryLabel")),
        "createdAt": _coerce_str(value.get("createdAt")),
    }


def _extract_itop_ticket_from_attachments(attachments: list[dict[str, Any]]) -> dict[str, Any]:
    for attachment in attachments:
        ticket = _normalize_itop_ticket_summary(attachment.get("itopTicket"))
        if ticket.get("id") or ticket.get("number"):
            return ticket
    return {}


def _build_evidence_document_code(document_number: Any, document_type: str) -> str:
    normalized_type = _normalize_evidence_document_type(document_type)
    base_code = _coerce_str(document_number)
    if normalized_type == "detalle":
        return build_detail_document_number(base_code)
    return base_code


def _remove_evidence_attachment_files(document_id: int, stored_names: list[str]) -> None:
    storage_directory = HANDOVER_EVIDENCE_ROOT / f"document_{document_id}"
    if not storage_directory.exists():
        return

    for stored_name in stored_names:
        safe_name = Path(_coerce_str(stored_name)).name
        if not safe_name:
            continue
        (storage_directory / safe_name).unlink(missing_ok=True)


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


def _build_itop_field_lookup(fields: list[dict[str, Any]] | None) -> dict[str, str]:
    lookup: dict[str, str] = {}
    for field in fields or []:
        if not isinstance(field, dict):
            continue
        label = _normalize_comparison_text(field.get("label"))
        value = _coerce_str(field.get("value"))
        if label and value and label not in lookup:
            lookup[label] = value
    return lookup


def _get_itop_field_value(field_lookup: dict[str, str], *labels: str) -> str:
    for label in labels:
        value = field_lookup.get(_normalize_comparison_text(label))
        if value:
            return value
    return ""


def enrich_handover_detail_for_pdf(
    detail: dict[str, Any],
    *,
    session_id: str | None = None,
    runtime_token: str | None = None,
) -> dict[str, Any]:
    from modules.assets.service import get_itop_asset_detail
    from modules.auth.service import get_runtime_token as get_session_runtime_token

    resolved_token = _coerce_str(runtime_token)
    if not resolved_token and session_id:
        resolved_token = get_session_runtime_token(session_id)
    if not resolved_token:
        raise HTTPException(
            status_code=428,
            detail={
                "message": "No existe un token runtime disponible para recuperar las especificaciones desde iTop.",
                "code": "TOKEN_REVALIDATION_REQUIRED",
            },
        )

    enriched_items: list[dict[str, Any]] = []
    for item in detail.get("items") or []:
        asset = item.get("asset") or {}
        asset_id = int(asset.get("id") or 0)
        if asset_id <= 0:
            enriched_items.append(item)
            continue

        try:
            itop_asset_detail = get_itop_asset_detail(asset_id, resolved_token)
        except HTTPException:
            raise
        except Exception as exc:
            asset_code = _coerce_str(asset.get("code")) or _coerce_str(asset.get("name")) or str(asset_id)
            raise HTTPException(
                status_code=502,
                detail=f"No fue posible recuperar desde iTop las especificaciones del activo '{asset_code}'.",
            ) from exc

        field_lookup = _build_itop_field_lookup(itop_asset_detail.get("fields"))
        contact_names = ", ".join(
            _coerce_str(contact.get("name"))
            for contact in itop_asset_detail.get("contacts") or []
            if _coerce_str(contact.get("name"))
        )

        enriched_asset = {
            **asset,
            "code": _coerce_str(itop_asset_detail.get("code")) or _coerce_str(asset.get("code")),
            "name": _coerce_str(itop_asset_detail.get("name")) or _coerce_str(asset.get("name")),
            "className": _coerce_str(itop_asset_detail.get("className")) or _coerce_str(asset.get("className")),
            "brand": _get_itop_field_value(field_lookup, "Marca") or _coerce_str(asset.get("brand")),
            "model": _get_itop_field_value(field_lookup, "Modelo") or _coerce_str(asset.get("model")),
            "serial": (
                _get_itop_field_value(field_lookup, "Numero de serie", "Serie")
                or _coerce_str(asset.get("serial"))
                or _coerce_str(asset.get("code"))
            ),
            "status": _coerce_str(itop_asset_detail.get("status")) or _coerce_str(asset.get("status")),
            "assignedUser": contact_names or _coerce_str(asset.get("assignedUser")),
        }

        enriched_items.append(
            {
                **item,
                "asset": enriched_asset,
                "itopAssetDetail": itop_asset_detail,
            }
        )

    return {
        **detail,
        "items": enriched_items,
    }


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
            "notesPlaceholder": "",
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

    generated_documents = _deserialize_generated_documents(document_row.get("generated_documents"))
    evidence_attachments = _deserialize_evidence_attachments(document_row.get("evidence_attachments"))

    return {
        "id": int(document_row["id"]),
        "documentNumber": document_row["document_number"],
        "generatedAt": _serialize_datetime(document_row.get("generated_at")),
        "creationDate": _serialize_datetime(document_row.get("creation_date") or document_row.get("generated_at")),
        "assignmentDate": _serialize_datetime(document_row.get("assignment_date")),
        "evidenceDate": _serialize_datetime(document_row.get("evidence_date")),
        "generatedDocuments": generated_documents,
        "evidenceAttachments": evidence_attachments,
        "itopTicket": _extract_itop_ticket_from_attachments(evidence_attachments),
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
        stored_name = _coerce_str(item.get("storedName")) or Path(_coerce_str(item.get("source"))).name or _coerce_str(item.get("name"))
        normalized.append(
            {
                "name": _coerce_str(item.get("name")),
                "size": _coerce_str(item.get("size")),
                "mimeType": _coerce_str(item.get("mimeType")),
                "source": _coerce_str(item.get("source")),
                "storedName": stored_name,
                "uploadedAt": _coerce_str(item.get("uploadedAt")),
                "documentType": _normalize_evidence_document_type(item.get("documentType"), allow_blank=True),
                "observation": _coerce_str(item.get("observation")),
                "itopTicket": _normalize_itop_ticket_summary(item.get("itopTicket")),
                "itopAssignment": item.get("itopAssignment") if isinstance(item.get("itopAssignment"), list) else [],
                "itopAttachments": item.get("itopAttachments") if isinstance(item.get("itopAttachments"), dict) else {},
            }
        )
    return normalized


def _deserialize_generated_documents(raw_value: Any) -> list[dict[str, Any]]:
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
        kind = _coerce_str(item.get("kind"))
        if kind not in GENERATED_DOCUMENT_KINDS:
            continue
        normalized.append(
            {
                "kind": kind,
                "title": _coerce_str(item.get("title")),
                "code": _coerce_str(item.get("code")),
                "name": _coerce_str(item.get("name")),
                "storedName": _coerce_str(item.get("storedName")),
                "mimeType": _coerce_str(item.get("mimeType")),
                "size": _coerce_str(item.get("size")),
                "source": _coerce_str(item.get("source")),
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
        stored_name = _coerce_str(item.get("storedName")) or Path(_coerce_str(item.get("source"))).name or _coerce_str(item.get("name"))
        normalized.append(
            {
                "name": _coerce_str(item.get("name")),
                "size": _coerce_str(item.get("size")),
                "mimeType": _coerce_str(item.get("mimeType")),
                "source": _coerce_str(item.get("source")),
                "storedName": stored_name,
                "uploadedAt": _coerce_str(item.get("uploadedAt")),
                "documentType": _normalize_evidence_document_type(item.get("documentType"), allow_blank=True),
                "observation": _coerce_str(item.get("observation")),
                "itopTicket": _normalize_itop_ticket_summary(item.get("itopTicket")),
                "itopAssignment": item.get("itopAssignment") if isinstance(item.get("itopAssignment"), list) else [],
                "itopAttachments": item.get("itopAttachments") if isinstance(item.get("itopAttachments"), dict) else {},
            }
        )
    return json.dumps(normalized, ensure_ascii=True)


def _normalize_generated_documents(payload: Any) -> str:
    if not payload:
        return ""
    if not isinstance(payload, list):
        raise HTTPException(status_code=422, detail="Los documentos generados no tienen un formato valido.")

    normalized: list[dict[str, Any]] = []
    seen_kinds: set[str] = set()
    for item in payload:
        if not isinstance(item, dict):
            raise HTTPException(status_code=422, detail="Los documentos generados no tienen un formato valido.")
        kind = _coerce_str(item.get("kind"))
        if kind not in GENERATED_DOCUMENT_KINDS:
            raise HTTPException(status_code=422, detail="Uno de los documentos generados no es valido.")
        if kind in seen_kinds:
            raise HTTPException(status_code=422, detail="No se puede repetir el tipo de PDF generado.")
        seen_kinds.add(kind)
        normalized.append(
            {
                "kind": kind,
                "title": _coerce_str(item.get("title")),
                "code": _coerce_str(item.get("code")),
                "name": _coerce_str(item.get("name")),
                "storedName": _coerce_str(item.get("storedName")),
                "mimeType": _coerce_str(item.get("mimeType")),
                "size": _coerce_str(item.get("size")),
                "source": _coerce_str(item.get("source")),
                "uploadedAt": _coerce_str(item.get("uploadedAt")),
            }
        )
    return json.dumps(normalized, ensure_ascii=True)


def _get_requester_org_id(connector: iTopCMDBConnector, requester_id: str) -> str:
    if not requester_id.isdigit():
        return ""
    try:
        response = connector.get("Person", int(requester_id), output_fields="id,org_id,org_id_friendlyname")
    except Exception:
        return ""

    person = response.first()
    if person is None:
        return ""
    return _normalize_ticket_id(person.get("org_id"))


ITOP_HANDOVER_TICKET_OUTPUT_FIELDS = (
    "id,ref,title,status,caller_id,caller_id_friendlyname,team_id,team_id_friendlyname,"
    "agent_id,agent_id_friendlyname,impact,urgency,priority,service_id,service_id_friendlyname,"
    "servicesubcategory_id,servicesubcategory_id_friendlyname"
)


def _ensure_itop_ticket_assignment(
    connector: iTopCMDBConnector,
    ticket_class: str,
    ticket_id: int,
    assignment_fields: dict[str, int],
    document_number: str,
) -> iTopObject | None:
    if not assignment_fields:
        return None

    try:
        response = connector.get(ticket_class, ticket_id, output_fields=ITOP_HANDOVER_TICKET_OUTPUT_FIELDS)
    except Exception:
        return None

    item = response.first()
    if item is None:
        return None

    status = _coerce_str(item.get("status")).lower()
    missing_assignment = any(not _normalize_ticket_id(item.get(field_name)) for field_name in assignment_fields)
    if status not in {"new", "created"} and not missing_assignment:
        return item

    comment = f"Asignacion sincronizada desde acta {document_number}".strip()
    if missing_assignment:
        update_response = connector.update(
            ticket_class,
            ticket_id,
            assignment_fields,
            output_fields=ITOP_HANDOVER_TICKET_OUTPUT_FIELDS,
            comment=comment,
        )
        if update_response.ok and update_response.first() is not None:
            item = update_response.first()
            status = _coerce_str(item.get("status")).lower()

    if status in {"new", "created"}:
        stimulus_response = connector.apply_stimulus(
            ticket_class,
            ticket_id,
            "ev_assign",
            fields=assignment_fields,
            output_fields=ITOP_HANDOVER_TICKET_OUTPUT_FIELDS,
            comment=comment,
        )
        if stimulus_response.ok and stimulus_response.first() is not None:
            return stimulus_response.first()

    refresh_response = connector.get(ticket_class, ticket_id, output_fields=ITOP_HANDOVER_TICKET_OUTPUT_FIELDS)
    return refresh_response.first()


def _create_itop_handover_ticket(
    current_detail: dict[str, Any],
    ticket_payload: dict[str, Any] | None,
    runtime_token: str,
) -> dict[str, Any]:
    payload = _normalize_itop_ticket_summary(ticket_payload)
    if not payload:
        return {}

    requester_id = _normalize_ticket_id(payload.get("requesterId"))
    group_id = _normalize_ticket_id(payload.get("groupId"))
    analyst_id = _normalize_ticket_id(payload.get("analystId"))
    subject = _coerce_str(payload.get("subject"))
    description = _coerce_str(payload.get("description"))
    if not requester_id or not subject or not description:
        raise HTTPException(status_code=422, detail="El ticket iTop requiere solicitante, asunto y descripcion.")

    docs_settings = get_settings_panel("docs")
    organization_settings = get_settings_panel("organization")
    ticket_class = _coerce_str(docs_settings.get("requirementTicketClass"), "UserRequest") or "UserRequest"

    connector = _build_itop_connector(runtime_token)
    try:
        org_id = _normalize_ticket_id(organization_settings.get("itopOrganizationId")) or _get_requester_org_id(connector, requester_id)
        if not org_id:
            raise HTTPException(status_code=422, detail="No fue posible determinar la organizacion para crear el ticket iTop.")

        fields: dict[str, Any] = {
            "org_id": int(org_id),
            "caller_id": int(requester_id),
            "title": subject,
            "description": description,
        }

        for field_name, field_value in {
            "team_id": group_id,
            "agent_id": analyst_id,
            "service_id": _normalize_ticket_id(payload.get("category")),
            "servicesubcategory_id": _normalize_ticket_id(payload.get("subcategory")),
        }.items():
            if field_value:
                fields[field_name] = int(field_value)

        origin = _coerce_str(payload.get("origin"))
        if origin:
            fields["origin"] = origin

        impact = _normalize_itop_impact(payload.get("impact"))
        if impact:
            fields["impact"] = impact

        urgency = _normalize_itop_level(payload.get("urgency"))
        if urgency:
            fields["urgency"] = urgency

        priority = _normalize_itop_level(payload.get("priority"))
        if priority:
            fields["priority"] = priority

        response = connector.create(
            ticket_class,
            fields,
            output_fields=ITOP_HANDOVER_TICKET_OUTPUT_FIELDS,
            comment=f"Registro generado desde acta {current_detail.get('documentNumber') or ''}".strip(),
        )
        if not response.ok:
            raise HTTPException(status_code=502, detail=f"No fue posible crear el ticket iTop: {response.message}")

        item = response.first()
        if item is None:
            raise HTTPException(status_code=502, detail="iTop no retorno el ticket creado.")

        assigned_item = _ensure_itop_ticket_assignment(
            connector,
            ticket_class,
            item.id,
            {
                field_name: field_value
                for field_name, field_value in {
                    "team_id": fields.get("team_id"),
                    "agent_id": fields.get("agent_id"),
                }.items()
                if isinstance(field_value, int)
            },
            _coerce_str(current_detail.get("documentNumber")),
        )
        if assigned_item is not None:
            item = assigned_item
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"No fue posible crear el ticket iTop: {exc}") from exc
    finally:
        connector.close()

    return _normalize_itop_ticket_summary(
        {
            **payload,
            "id": item.id,
            "number": item.get("ref") or item.get("friendlyname") or str(item.id),
            "className": item.itop_class or ticket_class,
            "status": item.get("status"),
            "orgId": org_id,
            "subject": item.get("title") or subject,
            "requester": item.get("caller_id_friendlyname") or payload.get("requester"),
            "groupName": item.get("team_id_friendlyname") or payload.get("groupName"),
            "analystName": item.get("agent_id_friendlyname") or payload.get("analystName"),
            "categoryLabel": item.get("service_id_friendlyname") or payload.get("categoryLabel"),
            "subcategoryLabel": item.get("servicesubcategory_id_friendlyname") or payload.get("subcategoryLabel"),
            "createdAt": datetime.now().strftime("%Y-%m-%dT%H:%M"),
        }
    )


def _resolve_asset_itop_class(connector: iTopCMDBConnector, asset_id: int) -> str:
    try:
        response = connector.get("FunctionalCI", asset_id, output_fields="id,finalclass,status")
    except Exception:
        response = None

    item = response.first() if response is not None else None
    resolved_class = _coerce_str(item.get("finalclass")) if item else ""
    if resolved_class and resolved_class != "FunctionalCI":
        return resolved_class

    try:
        oql_response = connector.get(
            "FunctionalCI",
            f"SELECT FunctionalCI WHERE id = {asset_id}",
            output_fields="id,finalclass",
        )
    except Exception:
        oql_response = None

    oql_item = oql_response.first() if oql_response is not None else None
    resolved_class = _coerce_str(oql_item.get("finalclass")) if oql_item else ""
    if resolved_class and resolved_class != "FunctionalCI":
        return resolved_class

    return _coerce_str(item.itop_class if item else "") or "FunctionalCI"


def _apply_itop_handover_assignment(
    current_detail: dict[str, Any],
    runtime_token: str,
    ticket_id: str = "",
) -> list[dict[str, Any]]:
    receiver = current_detail.get("receiver") or {}
    try:
        person_id = int(receiver.get("id") or 0)
    except (TypeError, ValueError):
        person_id = 0
    if person_id <= 0:
        raise HTTPException(status_code=422, detail="La persona principal del acta no tiene un identificador iTop valido.")

    connector = _build_itop_connector(runtime_token)
    results: list[dict[str, Any]] = []
    try:
        for item in current_detail.get("items") or []:
            asset = item.get("asset") or {}
            try:
                asset_id = int(asset.get("id") or 0)
            except (TypeError, ValueError):
                asset_id = 0
            if asset_id <= 0:
                continue

            asset_class = _resolve_asset_itop_class(connector, asset_id)
            asset_result = {
                "assetId": str(asset_id),
                "assetClass": asset_class,
                "contactLinked": False,
                "statusUpdated": False,
                "statusUpdateError": "",
                "ticketLinked": False,
            }

            link_response = connector.link_contact_to_ci(
                asset_class,
                asset_id,
                person_id,
            )
            if not link_response.ok:
                raise HTTPException(status_code=502, detail=f"No fue posible relacionar el EC {asset_id} con la persona: {link_response.message}")
            asset_result["contactLinked"] = True

            status_response = connector.update_ci_status(
                asset_class,
                asset_id,
                "production",
                comment=f"Asignado desde acta {current_detail.get('documentNumber') or ''}".strip(),
            )
            if status_response.ok:
                asset_result["statusUpdated"] = True
            else:
                asset_result["statusUpdateError"] = status_response.message

            if _normalize_ticket_id(ticket_id):
                ticket_link_response = connector.create(
                    "lnkFunctionalCIToTicket",
                    {
                        "ticket_id": int(ticket_id),
                        "functionalci_id": asset_id,
                        "impact_code": "manual",
                    },
                    output_fields="id,ticket_id,functionalci_id,impact_code",
                    comment=f"EC asociado desde acta {current_detail.get('documentNumber') or ''}".strip(),
                )
                if ticket_link_response.ok:
                    asset_result["ticketLinked"] = True
                else:
                    raise HTTPException(
                        status_code=502,
                        detail=f"No fue posible relacionar el EC {asset_id} con el ticket iTop: {ticket_link_response.message}",
                    )

            results.append(asset_result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"No fue posible actualizar la asignacion en iTop: {exc}") from exc
    finally:
        connector.close()

    return results


def _resolve_itop_object_org_id(connector: iTopCMDBConnector, item_class: str, item_id: int) -> str:
    try:
        response = connector.get(item_class, item_id, output_fields="id,org_id")
    except Exception:
        return ""

    item = response.first()
    if item is None:
        return ""
    return _normalize_ticket_id(item.get("org_id"))


def _build_itop_handover_document_files(
    document_id: int,
    generated_documents: list[dict[str, Any]],
    evidence_attachments: list[dict[str, Any]],
    pending_files: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    pending_by_name = {
        Path(_coerce_str(item.get("final"))).name: item
        for item in pending_files
        if _coerce_str(item.get("final"))
    }
    documents: list[dict[str, Any]] = []

    for document in generated_documents:
        stored_name = Path(_coerce_str(document.get("storedName"))).name
        if not stored_name:
            continue
        documents.append(
            {
                "documentType": "detalle" if _coerce_str(document.get("kind")) == "detail" else "acta",
                "name": _coerce_str(document.get("name")) or stored_name,
                "storedName": stored_name,
                "mimeType": _coerce_str(document.get("mimeType")) or "application/pdf",
                "path": HANDOVER_DOCUMENT_ROOT / f"document_{document_id}" / stored_name,
            }
        )

    for attachment in evidence_attachments:
        stored_name = Path(_coerce_str(attachment.get("storedName"))).name
        if not stored_name:
            continue
        pending_file = pending_by_name.get(stored_name)
        file_path = pending_file.get("temporary") if pending_file else HANDOVER_EVIDENCE_ROOT / f"document_{document_id}" / stored_name
        documents.append(
            {
                "documentType": _normalize_evidence_document_type(attachment.get("documentType"), allow_blank=True),
                "name": _coerce_str(attachment.get("name")) or stored_name,
                "storedName": stored_name,
                "mimeType": _coerce_str(attachment.get("mimeType")) or "application/octet-stream",
                "path": file_path,
            }
        )

    ordered: list[dict[str, Any]] = []
    for document_type in ("acta", "detalle"):
        match = next((item for item in documents if item.get("documentType") == document_type), None)
        if match:
            ordered.append(match)
    return ordered


def _create_itop_attachment(
    connector: iTopCMDBConnector,
    *,
    target_class: str,
    target_id: int,
    target_org_id: int,
    document: dict[str, Any],
    comment: str,
) -> dict[str, Any]:
    file_path = document.get("path")
    if not isinstance(file_path, Path) or not file_path.exists():
        raise HTTPException(status_code=502, detail=f"No fue posible adjuntar '{document.get('name') or 'documento'}' en iTop: el archivo local no existe.")

    file_content = file_path.read_bytes()
    response = connector.create(
        "Attachment",
        {
            "item_class": target_class,
            "item_id": target_id,
            "item_org_id": target_org_id,
            "creation_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "contents": {
                "filename": _coerce_str(document.get("name")) or file_path.name,
                "mimetype": _coerce_str(document.get("mimeType")) or "application/octet-stream",
                "data": b64encode(file_content).decode("ascii"),
            },
        },
        output_fields="id,item_class,item_id,item_org_id",
        comment=comment,
    )
    if not response.ok:
        raise HTTPException(status_code=502, detail=f"No fue posible adjuntar '{document.get('name') or file_path.name}' en iTop: {response.message}")

    item = response.first()
    return {
        "id": str(item.id) if item else "",
        "targetClass": target_class,
        "targetId": str(target_id),
        "name": _coerce_str(document.get("name")) or file_path.name,
        "documentType": _coerce_str(document.get("documentType")),
    }


def _resolve_itop_document_type_id(connector: iTopCMDBConnector) -> str:
    docs_settings = get_settings_panel("docs")
    configured_document_type_id = _normalize_ticket_id(
        docs_settings.get("handoverDocumentTypeId")
        or docs_settings.get("itopAssetDocumentTypeId")
        or docs_settings.get("documentTypeId")
    )
    if configured_document_type_id:
        return configured_document_type_id

    for document_type_name in ("Acta de Entrega", "Acta", "Aprobacion Equipos"):
        escaped_name = document_type_name.replace("\\", "\\\\").replace("'", "\\'")
        response = connector.get("DocumentType", f"SELECT DocumentType WHERE name = '{escaped_name}'", output_fields="id,name")
        item = response.first()
        if item is not None:
            return str(item.id)

    response = connector.get("DocumentType", "SELECT DocumentType", output_fields="id,name")
    item = response.first()
    return str(item.id) if item is not None else ""


def _create_itop_document_file(
    connector: iTopCMDBConnector,
    *,
    target_id: int,
    target_org_id: int,
    document_type_id: int,
    document: dict[str, Any],
    document_number: str,
) -> dict[str, Any]:
    file_path = document.get("path")
    if not isinstance(file_path, Path) or not file_path.exists():
        raise HTTPException(status_code=502, detail=f"No fue posible crear documento iTop '{document.get('name') or 'documento'}': el archivo local no existe.")

    document_name = _coerce_str(document.get("name")) or file_path.name
    existing_link_response = connector.get(
        "lnkDocumentToFunctionalCI",
        (
            "SELECT lnkDocumentToFunctionalCI "
            f"WHERE functionalci_id = {target_id} AND document_name = '{document_name.replace('\\', '\\\\').replace("'", "\\'")}'"
        ),
        output_fields="id,functionalci_id,document_id,document_id_friendlyname",
    )
    existing_link = existing_link_response.first()
    if existing_link is not None:
        return {
            "id": _coerce_str(existing_link.get("document_id")),
            "linkId": str(existing_link.id),
            "targetId": str(target_id),
            "name": _coerce_str(existing_link.get("document_id_friendlyname")) or document_name,
            "documentType": _coerce_str(document.get("documentType")),
            "reused": True,
        }

    file_content = file_path.read_bytes()
    create_response = connector.create(
        "DocumentFile",
        {
            "name": document_name,
            "org_id": target_org_id,
            "documenttype_id": document_type_id,
            "version": "1",
            "description": f"Documento sincronizado desde acta {document_number}".strip(),
            "status": "published",
            "file": {
                "filename": document_name,
                "mimetype": _coerce_str(document.get("mimeType")) or "application/octet-stream",
                "data": b64encode(file_content).decode("ascii"),
            },
        },
        output_fields="id,name,org_id,documenttype_id,status",
        comment=f"Documento creado desde acta {document_number}".strip(),
    )
    if not create_response.ok:
        raise HTTPException(status_code=502, detail=f"No fue posible crear documento iTop '{document_name}': {create_response.message}")

    created_document = create_response.first()
    if created_document is None:
        raise HTTPException(status_code=502, detail=f"iTop no retorno el documento creado para '{document_name}'.")

    link_response = connector.create(
        "lnkDocumentToFunctionalCI",
        {
            "document_id": created_document.id,
            "functionalci_id": target_id,
        },
        output_fields="id,functionalci_id,document_id",
        comment=f"Documento asociado desde acta {document_number}".strip(),
    )
    if not link_response.ok:
        raise HTTPException(status_code=502, detail=f"No fue posible vincular documento '{document_name}' al EC {target_id}: {link_response.message}")

    link = link_response.first()
    return {
        "id": str(created_document.id),
        "linkId": str(link.id) if link else "",
        "targetId": str(target_id),
        "name": document_name,
        "documentType": _coerce_str(document.get("documentType")),
        "reused": False,
    }


def _attach_handover_documents_to_itop_targets(
    current_detail: dict[str, Any],
    runtime_token: str,
    itop_ticket: dict[str, Any],
    documents: list[dict[str, Any]],
) -> dict[str, Any]:
    if not documents:
        return {"ticket": [], "assets": [], "person": []}

    connector = _build_itop_connector(runtime_token)
    result: dict[str, Any] = {"ticket": [], "assets": [], "person": []}
    document_number = _coerce_str(current_detail.get("documentNumber"))

    try:
        ticket_id = _normalize_ticket_id(itop_ticket.get("id"))
        if ticket_id:
            ticket_class = _coerce_str(itop_ticket.get("className"), "UserRequest") or "UserRequest"
            ticket_org_id = _normalize_ticket_id(itop_ticket.get("orgId")) or _resolve_itop_object_org_id(connector, ticket_class, int(ticket_id))
            if not ticket_org_id:
                raise HTTPException(status_code=502, detail="No fue posible determinar la organizacion del ticket iTop para adjuntar documentos.")
            for document in documents:
                result["ticket"].append(
                    _create_itop_attachment(
                        connector,
                        target_class=ticket_class,
                        target_id=int(ticket_id),
                        target_org_id=int(ticket_org_id),
                        document=document,
                        comment=f"Adjunto sincronizado desde acta {document_number}".strip(),
                    )
                )

        document_type_id = _resolve_itop_document_type_id(connector)
        if not document_type_id:
            raise HTTPException(status_code=502, detail="No fue posible determinar el tipo de documento iTop para vincular documentos al EC.")

        for item in current_detail.get("items") or []:
            asset = item.get("asset") or {}
            try:
                asset_id = int(asset.get("id") or 0)
            except (TypeError, ValueError):
                asset_id = 0
            if asset_id <= 0:
                continue

            asset_class = _resolve_asset_itop_class(connector, asset_id)
            asset_org_id = _resolve_itop_object_org_id(connector, asset_class, asset_id)
            if not asset_org_id:
                raise HTTPException(status_code=502, detail=f"No fue posible determinar la organizacion del EC {asset_id} para adjuntar documentos.")
            asset_attachments = []
            asset_documents = []
            for document in documents:
                asset_attachments.append(
                    _create_itop_attachment(
                        connector,
                        target_class=asset_class,
                        target_id=asset_id,
                        target_org_id=int(asset_org_id),
                        document=document,
                        comment=f"Adjunto sincronizado desde acta {document_number}".strip(),
                    )
                )
                asset_documents.append(
                    _create_itop_document_file(
                        connector,
                        target_id=asset_id,
                        target_org_id=int(asset_org_id),
                        document_type_id=int(document_type_id),
                        document=document,
                        document_number=document_number,
                    )
                )
            result["assets"].append(
                {
                    "assetId": str(asset_id),
                    "assetClass": asset_class,
                    "attachments": asset_attachments,
                    "documents": asset_documents,
                }
            )

        # TODO pendiente UI no soporta adjunto: Person acepta Attachment via API,
        # pero la pantalla de iTop no expone documentos/adjuntos para personas.
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"No fue posible adjuntar documentos en iTop: {exc}") from exc
    finally:
        connector.close()

    return result


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
    generated_documents: list[dict[str, Any]],
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
        "generated_documents": _normalize_generated_documents(generated_documents) or None,
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
    generated_documents = _normalize_generated_documents(payload.get("generatedDocuments") or [])
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
        "generated_documents": generated_documents or None,
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
    target_status = _coerce_str(payload.get("status"))
    if target_status == "Anulada":
        document_payload["generated_documents"] = None
    save_handover_document(document_id, document_payload, item_payloads)
    if target_status == "Anulada":
        remove_generated_handover_documents(document_id)
    return get_handover_document_detail(document_id)


def emit_handover_document(document_id: int, session_user: dict[str, Any], session_id: str) -> dict[str, Any]:
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

    job_id = create_job(
        document_id,
        "handover_emit",
        {
            "document_id": document_id,
        },
        session_id=session_id,
        owner_user_id=int(session_user["id"]),
        owner_name=str(session_user["name"]),
        module_code="handover",
        resource_type="handover_document",
    )

    return {
        "jobId": job_id,
        "status": "pending",
    }


def _process_handover_emit_job(job_id: str, document_id: int) -> dict[str, Any]:
    from core.errors import get_user_error

    try:
        current_detail = get_handover_document_detail(document_id)
        assignment_at = datetime.now().strftime("%Y-%m-%dT%H:%M")
        detail_for_pdf = {
            **current_detail,
            "assignmentDate": assignment_at,
            "status": "Emitida",
        }
        generated_documents = generate_handover_documents(document_id, detail_for_pdf)
        existing_document = fetch_handover_document_row(document_id)
        document_payload = _build_document_payload_from_detail(
            detail_for_pdf,
            existing_document,
            status_ui="Emitida",
            assignment_date=assignment_at,
            evidence_date=current_detail.get("evidenceDate") or "",
            generated_documents=generated_documents,
            evidence_attachments=current_detail.get("evidenceAttachments") or [],
        )
        item_payloads = _build_item_payloads_from_detail(current_detail.get("items") or [])
        try:
            save_handover_document(document_id, document_payload, item_payloads)
        except Exception:
            remove_generated_handover_documents(document_id)
            raise
        return get_handover_document_detail(document_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=get_user_error("PDF_GENERATION_FAILED")) from exc


def rollback_handover_document(document_id: int, session_user: dict[str, Any]) -> dict[str, Any]:
    del session_user

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
        "generatedDocuments": [],
        "evidenceAttachments": current_detail.get("evidenceAttachments") or [],
        "status": "En creacion",
        "handoverType": current_detail.get("handoverType") or "Entrega inicial",
        "reason": current_detail.get("reason") or "",
        "notes": current_detail.get("notes") or "",
        "receiver": current_detail.get("receiver") or {},
        "additionalReceivers": current_detail.get("additionalReceivers") or [],
        "items": current_detail.get("items") or [],
    }
    updated_document = update_handover_document(document_id, payload, {"id": existing_document["owner_user_id"], "name": existing_document["owner_name"]})
    remove_generated_handover_documents(document_id)
    return updated_document


def attach_handover_document_evidence(
    document_id: int,
    attachments: list[dict[str, Any]],
    session_user: dict[str, Any],
    runtime_token: str,
    ticket_payload: dict[str, Any] | None = None,
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
    if len(attachments) > MAX_HANDOVER_DOCUMENT_FILES:
        raise HTTPException(
            status_code=422,
            detail=f"Solo se permiten {MAX_HANDOVER_DOCUMENT_FILES} archivos por carga entre Acta y Detalle.",
        )

    storage_directory = HANDOVER_EVIDENCE_ROOT / f"document_{document_id}"
    storage_directory.mkdir(parents=True, exist_ok=True)

    created_paths: list[Path] = []
    current_detail = get_handover_document_detail(document_id)
    now = datetime.now()
    evidence_at = now.strftime("%Y-%m-%dT%H:%M")
    document_number = _coerce_str(current_detail.get("documentNumber"))
    if not document_number:
        raise HTTPException(status_code=422, detail="El acta no tiene un numero documental valido.")

    next_generated_documents = list(current_detail.get("generatedDocuments") or [])
    next_evidence_attachments = list(current_detail.get("evidenceAttachments") or [])
    existing_ticket = _extract_itop_ticket_from_attachments(next_evidence_attachments)
    itop_ticket = existing_ticket or _create_itop_handover_ticket(current_detail, ticket_payload, runtime_token)
    if not _normalize_ticket_id(itop_ticket.get("id") if itop_ticket else ""):
        raise HTTPException(status_code=422, detail="No fue posible determinar el ticket iTop para registrar los adjuntos del acta.")
    assignment_updates = _apply_itop_handover_assignment(
        current_detail,
        runtime_token,
        ticket_id=_coerce_str(itop_ticket.get("id") if itop_ticket else ""),
    )
    pending_files: list[dict[str, Path]] = []
    evidence_stored_names_to_delete: list[str] = []
    generated_stored_names_to_delete: list[str] = []
    processed_document_types: set[str] = set()
    allowed_extensions = _get_allowed_evidence_extensions()

    try:
        for attachment in attachments:
            document_type = _normalize_evidence_document_type(attachment.get("documentType"))
            if document_type in processed_document_types:
                raise HTTPException(
                    status_code=422,
                    detail="Solo puedes cargar un archivo por tipo de documento entre Acta y Detalle.",
                )
            processed_document_types.add(document_type)

            original_name = _sanitize_attachment_filename(attachment.get("name"))
            file_extension = Path(original_name).suffix.lower().lstrip(".")
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
            stored_name = f"{_build_evidence_document_code(document_number, document_type)}{suffix}"
            temporary_path = storage_directory / f".upload_{uuid4().hex}{suffix}"
            temporary_path.write_bytes(bytes(content))
            created_paths.append(temporary_path)
            pending_files.append(
                {
                    "temporary": temporary_path,
                    "final": storage_directory / stored_name,
                }
            )

            replaced_generated_documents = [
                item for item in next_generated_documents if _coerce_str(item.get("kind")) == EVIDENCE_DOCUMENT_TYPE_TO_GENERATED_KIND[document_type]
            ]
            next_generated_documents = [
                item for item in next_generated_documents if _coerce_str(item.get("kind")) != EVIDENCE_DOCUMENT_TYPE_TO_GENERATED_KIND[document_type]
            ]
            generated_stored_names_to_delete.extend(
                [
                    _coerce_str(item.get("storedName"))
                    for item in replaced_generated_documents
                    if _coerce_str(item.get("storedName"))
                ]
            )

            replaced_evidence_attachments = [
                item
                for item in next_evidence_attachments
                if _normalize_evidence_document_type(item.get("documentType"), allow_blank=True) == document_type
            ]
            next_evidence_attachments = [
                item
                for item in next_evidence_attachments
                if _normalize_evidence_document_type(item.get("documentType"), allow_blank=True) != document_type
            ]
            evidence_stored_names_to_delete.extend(
                [
                    _coerce_str(item.get("storedName"))
                    for item in replaced_evidence_attachments
                    if _coerce_str(item.get("storedName")) and Path(_coerce_str(item.get("storedName"))).name != stored_name
                ]
            )

            next_evidence_attachments.append(
                {
                    "name": stored_name,
                    "size": _format_attachment_size(len(content)),
                    "mimeType": _coerce_str(attachment.get("mimeType")) or "application/octet-stream",
                    "source": f"{settings.env_name}/handover_evidence/document_{document_id}/{stored_name}",
                    "storedName": stored_name,
                    "uploadedAt": evidence_at,
                    "documentType": document_type,
                    "observation": "",
                    "itopTicket": itop_ticket,
                    "itopAssignment": assignment_updates,
                }
            )

        if len(next_generated_documents) + len(next_evidence_attachments) > MAX_HANDOVER_DOCUMENT_FILES:
            raise HTTPException(
                status_code=422,
                detail="El acta solo puede conservar un maximo total de 2 documentos entre generados y adjuntos.",
            )

        itop_documents = _build_itop_handover_document_files(
            document_id,
            next_generated_documents,
            next_evidence_attachments,
            pending_files,
        )
        itop_attachment_updates = _attach_handover_documents_to_itop_targets(
            current_detail,
            runtime_token,
            itop_ticket,
            itop_documents,
        )
        next_evidence_attachments = [
            {
                **item,
                "itopAttachments": itop_attachment_updates,
            }
            for item in next_evidence_attachments
        ]

        document_payload = _build_document_payload_from_detail(
            current_detail,
            existing_document,
            status_ui="Confirmada",
            assignment_date=current_detail.get("assignmentDate") or evidence_at,
            evidence_date=evidence_at,
            generated_documents=next_generated_documents,
            evidence_attachments=next_evidence_attachments,
        )
        item_payloads = _build_item_payloads_from_detail(current_detail.get("items") or [])
        save_handover_document(document_id, document_payload, item_payloads)

        for pending_file in pending_files:
            pending_file["temporary"].replace(pending_file["final"])

        remove_generated_handover_documents_by_names(document_id, generated_stored_names_to_delete)
        _remove_evidence_attachment_files(document_id, evidence_stored_names_to_delete)
    except Exception:
        for path in created_paths:
            try:
                if path.exists():
                    path.unlink()
            except OSError:
                continue
        raise

    return get_handover_document_detail(document_id)
