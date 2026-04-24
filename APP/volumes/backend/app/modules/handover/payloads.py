from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from modules.handover.handover_types import get_handover_type_definition
from modules.handover.shared import (
    GENERATED_DOCUMENT_KINDS,
    INPUT_TYPE_UI_TO_DB,
    SECONDARY_RECEIVER_ROLE_ALIASES,
    SECONDARY_RECEIVER_ROLE_OPTIONS,
    STATUS_UI_TO_DB,
    coerce_str,
    normalize_comparison_text,
)


def normalize_generated_at(value: Any) -> datetime:
    text = coerce_str(value)
    if not text:
        return datetime.now()

    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    raise HTTPException(status_code=422, detail="La fecha de emision no es valida.")


def normalize_optional_datetime(value: Any) -> datetime | None:
    text = coerce_str(value)
    if not text:
        return None

    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    raise HTTPException(status_code=422, detail="Una de las fechas del acta no es valida.")


def normalize_receiver(payload: dict[str, Any]) -> dict[str, Any]:
    receiver_id = payload.get("id")
    name = coerce_str(payload.get("name"))
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
        "receiver_code": coerce_str(payload.get("code")),
        "receiver_name": name,
        "receiver_email": coerce_str(payload.get("email")),
        "receiver_phone": coerce_str(payload.get("phone")),
        "receiver_role": coerce_str(payload.get("role")),
        "receiver_status": coerce_str(payload.get("status")),
    }


def normalize_itop_ticket_summary(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}

    normalized = {
        "id": coerce_str(value.get("id")),
        "number": coerce_str(value.get("number") or value.get("ref")),
        "className": coerce_str(value.get("className") or value.get("ticketClass")),
        "status": coerce_str(value.get("status")),
        "subject": coerce_str(value.get("subject")),
        "description": coerce_str(value.get("description")),
        "requesterId": coerce_str(value.get("requesterId")),
        "requester": coerce_str(value.get("requester")),
        "orgId": coerce_str(value.get("orgId")),
        "groupId": coerce_str(value.get("groupId")),
        "groupName": coerce_str(value.get("groupName")),
        "analystId": coerce_str(value.get("analystId")),
        "analystName": coerce_str(value.get("analystName")),
        "origin": coerce_str(value.get("origin")),
        "originLabel": coerce_str(value.get("originLabel")),
        "impact": coerce_str(value.get("impact")),
        "impactLabel": coerce_str(value.get("impactLabel")),
        "urgency": coerce_str(value.get("urgency")),
        "urgencyLabel": coerce_str(value.get("urgencyLabel")),
        "priority": coerce_str(value.get("priority")),
        "priorityLabel": coerce_str(value.get("priorityLabel")),
        "category": coerce_str(value.get("category")),
        "categoryLabel": coerce_str(value.get("categoryLabel")),
        "subcategory": coerce_str(value.get("subcategory")),
        "subcategoryLabel": coerce_str(value.get("subcategoryLabel")),
        "createdAt": coerce_str(value.get("createdAt")),
    }
    if not any(
        normalized.get(key)
        for key in ("id", "number", "requesterId", "subject", "description", "groupId", "analystId")
    ):
        return {}
    return normalized


def normalize_evidence_document_type(value: Any, *, allow_blank: bool = False) -> str:
    normalized = normalize_comparison_text(value)
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


def deserialize_additional_receivers(raw_value: Any) -> list[dict[str, Any]]:
    text = coerce_str(raw_value)
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
                "code": coerce_str(item.get("code")),
                "name": coerce_str(item.get("name")),
                "email": coerce_str(item.get("email")),
                "phone": coerce_str(item.get("phone")),
                "role": coerce_str(item.get("role")),
                "status": coerce_str(item.get("status")),
                "assignmentRole": SECONDARY_RECEIVER_ROLE_ALIASES.get(
                    coerce_str(item.get("assignmentRole")),
                    coerce_str(item.get("assignmentRole")),
                ),
            }
        )
    return normalized


def deserialize_evidence_attachments(raw_value: Any) -> list[dict[str, Any]]:
    text = coerce_str(raw_value)
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
        stored_name = coerce_str(item.get("storedName")) or Path(coerce_str(item.get("source"))).name or coerce_str(item.get("name"))
        normalized.append(
            {
                "name": coerce_str(item.get("name")),
                "size": coerce_str(item.get("size")),
                "mimeType": coerce_str(item.get("mimeType")),
                "source": coerce_str(item.get("source")),
                "storedName": stored_name,
                "uploadedAt": coerce_str(item.get("uploadedAt")),
                "documentType": normalize_evidence_document_type(item.get("documentType"), allow_blank=True),
                "observation": coerce_str(item.get("observation")),
                "itopTicket": normalize_itop_ticket_summary(item.get("itopTicket")),
                "itopAssignment": item.get("itopAssignment") if isinstance(item.get("itopAssignment"), list) else [],
                "itopAttachments": item.get("itopAttachments") if isinstance(item.get("itopAttachments"), dict) else {},
            }
        )
    return normalized


def deserialize_generated_documents(raw_value: Any) -> list[dict[str, Any]]:
    text = coerce_str(raw_value)
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
        kind = coerce_str(item.get("kind"))
        if kind not in GENERATED_DOCUMENT_KINDS:
            continue
        normalized.append(
            {
                "kind": kind,
                "title": coerce_str(item.get("title")),
                "code": coerce_str(item.get("code")),
                "name": coerce_str(item.get("name")),
                "storedName": coerce_str(item.get("storedName")),
                "mimeType": coerce_str(item.get("mimeType")),
                "size": coerce_str(item.get("size")),
                "source": coerce_str(item.get("source")),
                "uploadedAt": coerce_str(item.get("uploadedAt")),
            }
        )
    return normalized


def normalize_additional_receivers(payload: Any, primary_receiver_id: int) -> str:
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

        name = coerce_str(item.get("name"))
        if not name:
            raise HTTPException(status_code=422, detail="Uno de los contactos adicionales no es valido.")

        assignment_role = SECONDARY_RECEIVER_ROLE_ALIASES.get(
            coerce_str(item.get("assignmentRole"), "Contraturno"),
            coerce_str(item.get("assignmentRole"), "Contraturno"),
        )
        if assignment_role not in SECONDARY_RECEIVER_ROLE_OPTIONS:
            raise HTTPException(status_code=422, detail="El rol de un contacto adicional no es valido.")

        seen_ids.add(parsed_id)
        normalized.append(
            {
                "id": parsed_id,
                "code": coerce_str(item.get("code")),
                "name": name,
                "email": coerce_str(item.get("email")),
                "phone": coerce_str(item.get("phone")),
                "role": coerce_str(item.get("role")),
                "status": coerce_str(item.get("status")),
                "assignmentRole": assignment_role,
            }
        )

    return json.dumps(normalized, ensure_ascii=True)


def normalize_evidence_attachments(payload: Any) -> str:
    if not payload:
        return ""
    if not isinstance(payload, list):
        raise HTTPException(status_code=422, detail="La evidencia adjunta no tiene un formato valido.")

    normalized: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            raise HTTPException(status_code=422, detail="La evidencia adjunta no tiene un formato valido.")
        stored_name = coerce_str(item.get("storedName")) or Path(coerce_str(item.get("source"))).name or coerce_str(item.get("name"))
        normalized.append(
            {
                "name": coerce_str(item.get("name")),
                "size": coerce_str(item.get("size")),
                "mimeType": coerce_str(item.get("mimeType")),
                "source": coerce_str(item.get("source")),
                "storedName": stored_name,
                "uploadedAt": coerce_str(item.get("uploadedAt")),
                "documentType": normalize_evidence_document_type(item.get("documentType"), allow_blank=True),
                "observation": coerce_str(item.get("observation")),
                "itopTicket": normalize_itop_ticket_summary(item.get("itopTicket")),
                "itopAssignment": item.get("itopAssignment") if isinstance(item.get("itopAssignment"), list) else [],
                "itopAttachments": item.get("itopAttachments") if isinstance(item.get("itopAttachments"), dict) else {},
            }
        )
    return json.dumps(normalized, ensure_ascii=True)


def normalize_generated_documents(payload: Any) -> str:
    if not payload:
        return ""
    if not isinstance(payload, list):
        raise HTTPException(status_code=422, detail="Los documentos generados no tienen un formato valido.")

    normalized: list[dict[str, Any]] = []
    seen_kinds: set[str] = set()
    for item in payload:
        if not isinstance(item, dict):
            raise HTTPException(status_code=422, detail="Los documentos generados no tienen un formato valido.")
        kind = coerce_str(item.get("kind"))
        if kind not in GENERATED_DOCUMENT_KINDS:
            raise HTTPException(status_code=422, detail="Uno de los documentos generados no es valido.")
        if kind in seen_kinds:
            raise HTTPException(status_code=422, detail="No se puede repetir el tipo de PDF generado.")
        seen_kinds.add(kind)
        normalized.append(
            {
                "kind": kind,
                "title": coerce_str(item.get("title")),
                "code": coerce_str(item.get("code")),
                "name": coerce_str(item.get("name")),
                "storedName": coerce_str(item.get("storedName")),
                "mimeType": coerce_str(item.get("mimeType")),
                "size": coerce_str(item.get("size")),
                "source": coerce_str(item.get("source")),
                "uploadedAt": coerce_str(item.get("uploadedAt")),
            }
        )
    return json.dumps(normalized, ensure_ascii=True)


def build_receiver_payload(receiver: dict[str, Any]) -> dict[str, Any]:
    return {
        "receiver_person_id": int(receiver["id"]) if receiver.get("id") else None,
        "receiver_code": coerce_str(receiver.get("code")) or None,
        "receiver_name": coerce_str(receiver.get("name")),
        "receiver_email": coerce_str(receiver.get("email")) or None,
        "receiver_phone": coerce_str(receiver.get("phone")) or None,
        "receiver_role": coerce_str(receiver.get("role")) or None,
        "receiver_status": coerce_str(receiver.get("status")) or None,
    }


def build_item_payloads_from_detail(detail_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    for item in detail_items:
        asset = item.get("asset") or {}
        evidences: list[dict[str, Any]] = []
        for evidence in item.get("evidences") or []:
            file_size_raw = evidence.get("fileSize")
            try:
                file_size = int(file_size_raw) if file_size_raw not in (None, "") else None
            except (TypeError, ValueError):
                file_size = None
            evidences.append(
                {
                    "original_name": coerce_str(evidence.get("originalName") or evidence.get("name")),
                    "stored_name": coerce_str(evidence.get("storedName")),
                    "mime_type": coerce_str(evidence.get("mimeType")) or None,
                    "file_size": file_size,
                    "caption": coerce_str(evidence.get("caption")),
                    "source": coerce_str(evidence.get("source")) or None,
                }
            )
        checklists: list[dict[str, Any]] = []
        for checklist in item.get("checklists") or []:
            answers: list[dict[str, Any]] = []
            for answer in checklist.get("answers") or []:
                input_type = INPUT_TYPE_UI_TO_DB.get(coerce_str(answer.get("type")), "input_text")
                value = answer.get("value")
                response_value = "1" if input_type == "check" and bool(value) else ("0" if input_type == "check" else coerce_str(value))
                answers.append(
                    {
                        "checklist_item_id": int(answer["checklistItemId"]),
                        "check_name": coerce_str(answer.get("name")),
                        "check_description": coerce_str(answer.get("description")),
                        "input_type": input_type,
                        "option_a": coerce_str(answer.get("optionA")) or None,
                        "option_b": coerce_str(answer.get("optionB")) or None,
                        "response_value": response_value,
                    }
                )

            checklists.append(
                {
                    "template_id": int(checklist["templateId"]),
                    "template_name": coerce_str(checklist.get("templateName")),
                    "template_description": coerce_str(checklist.get("templateDescription")) or None,
                    "answers": answers,
                }
            )

        payloads.append(
            {
                "asset_itop_id": int(asset["id"]),
                "asset_code": coerce_str(asset.get("code")),
                "asset_name": coerce_str(asset.get("name")),
                "asset_class_name": coerce_str(asset.get("className")) or None,
                "asset_brand": coerce_str(asset.get("brand")) or None,
                "asset_model": coerce_str(asset.get("model")) or None,
                "asset_serial": coerce_str(asset.get("serial")) or None,
                "asset_status": coerce_str(asset.get("status")) or None,
                "assigned_user_name": coerce_str(asset.get("assignedUser")) or None,
                "notes": coerce_str(item.get("notes")) or None,
                "evidences": evidences,
                "checklists": checklists,
            }
        )
    return payloads


def build_document_payload_from_detail(
    current_detail: dict[str, Any],
    existing_document: dict[str, Any],
    *,
    status_ui: str,
    assignment_date: str,
    evidence_date: str,
    generated_documents: list[dict[str, Any]],
    evidence_attachments: list[dict[str, Any]],
) -> dict[str, Any]:
    creation_at = normalize_generated_at(current_detail.get("creationDate") or current_detail.get("generatedAt"))
    assignment_at = normalize_optional_datetime(assignment_date)
    evidence_at = normalize_optional_datetime(evidence_date)
    type_definition = get_handover_type_definition(
        current_detail.get("handoverTypeCode") or current_detail.get("handoverType")
    )
    additional_receivers = normalize_additional_receivers(
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
        "handover_type": type_definition.code,
        "reason": coerce_str(current_detail.get("reason")),
        "notes": coerce_str(current_detail.get("notes")) or None,
        "additional_receivers": additional_receivers or None,
        "generated_documents": normalize_generated_documents(generated_documents) or None,
        "evidence_attachments": normalize_evidence_attachments(evidence_attachments) or None,
        **build_receiver_payload(current_detail.get("receiver") or {}),
    }
