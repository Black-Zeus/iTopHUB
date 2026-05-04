from __future__ import annotations

import logging
import mimetypes
from base64 import b64decode
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

import requests
from fastapi import HTTPException

from core.config import settings
from modules.checklists.service import list_checklists_payload
from modules.handover.service import get_public_signature_branding
from modules.lab.document_templates import (
    build_lab_entry_html,
    build_lab_exit_html,
    build_lab_processing_html,
)
from modules.lab.repository import (
    fetch_lab_record_row,
    fetch_lab_record_row_by_signature_token,
    fetch_lab_record_rows,
    get_next_lab_sequence,
    save_lab_record,
)
from modules.lab.shared import (
    ALLOWED_EVIDENCE_EXTENSIONS,
    LAB_PHASE_SEQUENCE,
    OBSOLETE_EXIT_STATES,
    PHASE_LABELS,
    REASON_DB_TO_UI,
    REASON_OPTIONS,
    STATUS_DB_TO_UI,
    STATUS_UI_TO_DB,
    coerce_str,
    derive_status_db,
    get_admin_signature_workflow,
    get_itop_ticket_summary,
    get_phase_signature_workflow,
    normalize_comparison_text,
    normalize_phase_key,
    resolve_lab_phase_key,
    resolve_lab_phase_label,
    resolve_admin_signature_status,
    resolve_phase_signature_status,
    resolve_signature_workflow_status,
    should_require_signature,
)
from modules.lab.storage_paths import (
    build_lab_document_directory,
    build_lab_evidence_directory,
    resolve_existing_lab_document,
    resolve_existing_lab_evidence,
)
from modules.settings.service import get_settings_panel
from modules.users.service import list_users
from modules.handover.service import (
    _build_itop_connector,
    _create_itop_attachment,
    _create_itop_handover_ticket,
    _ensure_ci_ticket_link,
    _resolve_asset_itop_class,
)


logger = logging.getLogger(__name__)

SIGNATURE_PUBLIC_ROUTE = "firma/l"
AGENT_SIGNATURE_TARGET_ROLE = "Agente revisor"
ADMIN_SIGNATURE_TARGET_ROLE = "Administrador del Hub"


def _coerce_str(value: Any, default: str = "") -> str:
    return coerce_str(value, default)


def _generate_document_number(year: int) -> str:
    seq = get_next_lab_sequence(year)
    return f"LAB-{year}-{seq:04d}"


def _render_lab_pdf_bytes(
    html: str,
    footer_html: str | None = None,
    *,
    filename: str | None = None,
) -> bytes:
    headers = {}
    if settings.internal_api_secret:
        headers["X-Internal-Secret"] = settings.internal_api_secret

    try:
        response = requests.post(
            f"{settings.pdf_worker_url.rstrip('/')}/internal/render/html-to-pdf",
            json={
                "html": html,
                "footer_html": footer_html,
                "filename": filename,
            },
            headers=headers,
            timeout=120,
        )
    except requests.exceptions.Timeout as exc:
        raise HTTPException(status_code=504, detail="El servicio PDF tardó demasiado en responder.") from exc
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"No fue posible conectar con pdf-worker: {exc}") from exc

    if response.status_code >= 400:
        error_text = response.text.strip()
        detail = (
            f"pdf-worker respondió con error {response.status_code}: {error_text[:240]}"
            if error_text
            else f"pdf-worker respondió con error {response.status_code}."
        )
        raise HTTPException(status_code=502, detail=detail)
    if not response.content:
        raise HTTPException(status_code=502, detail="pdf-worker no devolvió contenido PDF.")
    return response.content


def _serialize_signature_timestamp(value: datetime | None = None) -> str:
    return (value or datetime.now()).replace(microsecond=0).isoformat()


def _get_qr_settings() -> dict[str, Any]:
    return get_settings_panel("qr")


def _is_qr_enabled() -> bool:
    return bool(_get_qr_settings().get("enabled", True))


def _ensure_qr_signature_enabled() -> dict[str, Any]:
    qr_settings = _get_qr_settings()
    if not bool(qr_settings.get("enabled", True)):
        raise HTTPException(
            status_code=422,
            detail="La firma QR está deshabilitada en Configuración > Firma QR.",
        )
    return qr_settings


def _get_qr_signature_ttl_minutes() -> int:
    return max(1, int(_get_qr_settings().get("sessionTtlMinutes") or 20))


def _is_qr_single_device_lock_enabled() -> bool:
    return bool(_get_qr_settings().get("singleDeviceLock", True))


def _build_lab_public_signature_url(token: str) -> str:
    qr_settings = _get_qr_settings()
    base_url = _coerce_str(qr_settings.get("hubPublicBaseUrl")).rstrip("/")
    route_path = _coerce_str(qr_settings.get("sessionRoutePath"), SIGNATURE_PUBLIC_ROUTE).strip("/") or SIGNATURE_PUBLIC_ROUTE
    if not base_url:
        return ""
    return f"{base_url}/{route_path}/{token}"


def _validate_signature_data_url(value: Any) -> dict[str, str]:
    raw_value = _coerce_str(value)
    prefix, separator, payload = raw_value.partition(",")
    if not separator or not prefix.startswith("data:image/"):
        raise HTTPException(status_code=422, detail="La firma digital no tiene un formato de imagen válido.")
    try:
        b64decode(payload, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="La firma digital contiene datos inválidos.") from exc
    return {
        "mimeType": prefix.removeprefix("data:").split(";")[0] or "image/png",
        "dataUrl": raw_value,
    }


def _is_processing_checklist_complete(checklists: list[dict[str, Any]] | None) -> bool:
    if not checklists:
        return False
    for checklist in checklists:
        for answer in checklist.get("answers") or []:
            if answer.get("type") == "Check":
                continue
            value = answer.get("value")
            if value in ("", None):
                return False
    return True


def _fmt_date(value: Any) -> str:
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return _coerce_str(value)


def _normalize_requested_actions(payload: dict[str, Any], existing: dict[str, Any] | None = None) -> list[str]:
    raw_value = payload.get("requestedActions") if "requestedActions" in payload else None
    if raw_value is None and existing is not None:
        raw_value = existing.get("requested_actions")

    values: list[str] = []
    if isinstance(raw_value, list):
        values = [normalize_comparison_text(item) for item in raw_value]
    elif raw_value:
        values = [normalize_comparison_text(raw_value)]

    cleaned = [item for item in values if item in REASON_DB_TO_UI]
    fallback_reason = normalize_comparison_text(payload.get("reason") if "reason" in payload else (existing or {}).get("reason"))
    if fallback_reason in REASON_DB_TO_UI and fallback_reason not in cleaned:
        cleaned.insert(0, fallback_reason)
    return list(dict.fromkeys(cleaned))


def _normalize_requester_admin(payload: dict[str, Any], existing: dict[str, Any] | None = None) -> dict[str, Any]:
    source = payload.get("requesterAdmin") if "requesterAdmin" in payload else None
    if source is None and existing is not None:
        source = {
            "userId": existing.get("requester_admin_user_id"),
            "name": existing.get("requester_admin_name"),
            "itopPersonKey": existing.get("requester_admin_itop_person_key"),
            "role": ADMIN_SIGNATURE_TARGET_ROLE,
        }
    if not isinstance(source, dict):
        return {}
    try:
        user_id = int(source.get("userId") or 0)
    except (TypeError, ValueError):
        user_id = 0
    return {
        "userId": user_id or None,
        "name": _coerce_str(source.get("name")),
        "itopPersonKey": _coerce_str(source.get("itopPersonKey") or source.get("id")),
        "role": _coerce_str(source.get("role")) or ADMIN_SIGNATURE_TARGET_ROLE,
    }


def _get_signature_root(record: dict[str, Any]) -> dict[str, Any]:
    workflow = record.get("signature_workflow")
    return workflow if isinstance(workflow, dict) else {}


def _with_signature_root(record: dict[str, Any], root: dict[str, Any]) -> dict[str, Any]:
    return {**record, "signature_workflow": root}


def _phase_document_key(phase_key: str) -> str:
    return {
        "entry": "entry_generated_document",
        "processing": "processing_generated_document",
        "exit": "exit_generated_document",
    }[phase_key]


def _get_phase_document(record: dict[str, Any], phase_key: str) -> dict[str, Any]:
    document = record.get(_phase_document_key(phase_key))
    return document if isinstance(document, dict) else {}


def _build_phase_signature_target(record: dict[str, Any], phase_key: str) -> dict[str, Any]:
    del phase_key
    owner_name = _coerce_str(record.get("owner_name"))
    if not owner_name:
        return {}
    return {
        "name": owner_name,
        "role": AGENT_SIGNATURE_TARGET_ROLE,
    }


def _build_admin_signature_target(record: dict[str, Any]) -> dict[str, Any]:
    return _normalize_requester_admin({}, existing=record)


def _phase_session_key(phase_key: str) -> str:
    normalized = normalize_phase_key(phase_key)
    if not normalized:
        raise HTTPException(status_code=422, detail="La fase indicada no es válida para firma.")
    return normalized


def _update_phase_signature_workflow(record: dict[str, Any], phase_key: str, workflow: dict[str, Any]) -> dict[str, Any]:
    root = _get_signature_root(record)
    phase_sessions = root.get("phaseSessions") if isinstance(root.get("phaseSessions"), dict) else {}
    phase_sessions = {**phase_sessions, _phase_session_key(phase_key): workflow}
    return _with_signature_root(record, {**root, "phaseSessions": phase_sessions})


def _update_admin_signature_workflow(record: dict[str, Any], workflow: dict[str, Any]) -> dict[str, Any]:
    root = _get_signature_root(record)
    return _with_signature_root(record, {**root, "adminApproval": workflow})


def _collect_phase_signature_states(record: dict[str, Any]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for phase_key in LAB_PHASE_SEQUENCE:
        workflow = get_phase_signature_workflow(record, phase_key)
        result[phase_key] = {
            "workflow": workflow,
            "status": resolve_phase_signature_status(record, phase_key),
            "label": PHASE_LABELS.get(phase_key, phase_key),
            "hasDocument": bool(_get_phase_document(record, phase_key)),
        }
    admin_workflow = get_admin_signature_workflow(record)
    exit_final_state = _coerce_str(record.get("exit_final_state")).lower()
    result["adminApproval"] = {
        "workflow": admin_workflow,
        "status": resolve_admin_signature_status(record),
        "label": "Aprobacion administrativa",
        "hasDocument": bool(_get_phase_document(record, "exit")) and exit_final_state in OBSOLETE_EXIT_STATES,
    }
    return result


def _resolve_next_signature_step(status_db: str) -> tuple[str, str]:
    if status_db == "pending_admin_signature":
        return ("admin", "adminApproval")
    return ("", "")


def _build_lab_record_state(record: dict[str, Any]) -> dict[str, Any]:
    qr_enabled = _is_qr_enabled()
    status_db = derive_status_db(
        record,
        qr_enabled=qr_enabled,
        previous_status=_coerce_str(record.get("status"), "draft"),
    )
    phase_key = resolve_lab_phase_key(record)
    phase_label = resolve_lab_phase_label(record)
    signature_states = _collect_phase_signature_states(record)
    next_signature_kind, next_signature_phase = _resolve_next_signature_step(status_db)
    signature_target = (
        _build_admin_signature_target(record)
        if next_signature_kind == "admin"
        else _build_phase_signature_target(record, next_signature_phase or phase_key)
    )

    return {
        "statusDb": status_db,
        "statusUi": STATUS_DB_TO_UI.get(status_db, status_db),
        "phaseKey": phase_key,
        "phaseLabel": phase_label,
        "signatureStates": signature_states,
        "signatureTarget": signature_target,
        "requiresSignature": should_require_signature(record, qr_enabled=qr_enabled),
        "nextSignatureKind": next_signature_kind,
        "nextSignaturePhase": next_signature_phase,
        "canOpenQr": bool(next_signature_kind),
        "canFinalize": status_db == "pending_itop_sync",
    }


def _serialize_record_for_response(row: dict[str, Any]) -> dict[str, Any]:
    state = _build_lab_record_state(row)
    signature_workflow = _get_signature_root(row)
    requester_admin = _normalize_requester_admin({}, existing=row)
    itop_ticket = get_itop_ticket_summary(row)

    return {
        "id": row.get("id"),
        "code": _coerce_str(row.get("document_number")),
        "reason": _coerce_str(row.get("reason"), "maintenance"),
        "reasonLabel": REASON_DB_TO_UI.get(_coerce_str(row.get("reason"), "maintenance"), _coerce_str(row.get("reason"), "maintenance")),
        "requestedActions": row.get("requested_actions") or [],
        "requestedActionLabels": [
            REASON_DB_TO_UI.get(_coerce_str(item), _coerce_str(item))
            for item in (row.get("requested_actions") or [])
        ],
        "status": state["statusUi"],
        "statusCode": state["statusDb"],
        "currentPhase": state["phaseKey"],
        "currentPhaseLabel": state["phaseLabel"],
        "assetItopId": _coerce_str(row.get("asset_itop_id")),
        "assetCode": _coerce_str(row.get("asset_code")),
        "assetName": _coerce_str(row.get("asset_name")),
        "assetClass": _coerce_str(row.get("asset_class")),
        "assetSerial": _coerce_str(row.get("asset_serial")),
        "assetOrganization": _coerce_str(row.get("asset_organization")),
        "assetLocation": _coerce_str(row.get("asset_location")),
        "assetStatus": _coerce_str(row.get("asset_status")),
        "assetAssignedUser": _coerce_str(row.get("asset_assigned_user")),
        "ownerUserId": row.get("owner_user_id"),
        "ownerName": _coerce_str(row.get("owner_name")),
        "requesterAdmin": requester_admin if requester_admin.get("userId") else None,
        "entryDate": _fmt_date(row.get("entry_date")),
        "entryObservations": _coerce_str(row.get("entry_observations")),
        "entryConditionNotes": _coerce_str(row.get("entry_condition_notes")),
        "entryReceivedNotes": _coerce_str(row.get("entry_received_notes")),
        "entryEvidences": row.get("entry_evidences") or [],
        "entryGeneratedDocument": row.get("entry_generated_document"),
        "processingDate": _fmt_date(row.get("processing_date")),
        "processingObservations": _coerce_str(row.get("processing_observations")),
        "processingEvidences": row.get("processing_evidences") or [],
        "processingGeneratedDocument": row.get("processing_generated_document"),
        "processingChecklists": row.get("processing_checklists") or [],
        "exitDate": _fmt_date(row.get("exit_date")),
        "exitObservations": _coerce_str(row.get("exit_observations")),
        "workPerformed": _coerce_str(row.get("work_performed")),
        "exitEvidences": row.get("exit_evidences") or [],
        "exitGeneratedDocument": row.get("exit_generated_document"),
        "exitFinalState": _coerce_str(row.get("exit_final_state")),
        "signatureWorkflow": signature_workflow,
        "signatureStates": state["signatureStates"],
        "nextSignatureKind": state["nextSignatureKind"],
        "nextSignaturePhase": state["nextSignaturePhase"],
        "markedObsolete": bool(row.get("marked_obsolete")),
        "obsoleteNotes": _coerce_str(row.get("obsolete_notes")),
        "normalizationActCode": _coerce_str(row.get("normalization_act_code")),
        "itopTicket": itop_ticket,
        "hasEntryPhase": bool(row.get("entry_generated_document")),
        "hasProcessingPhase": bool(row.get("processing_generated_document")),
        "hasExitPhase": bool(row.get("exit_generated_document")),
        "requiresSignature": state["requiresSignature"],
        "signatureTarget": state["signatureTarget"],
        "canOpenQr": state["canOpenQr"],
        "canFinalizeClosure": state["canFinalize"],
    }


def _build_record_haystack(item: dict[str, Any]) -> str:
    parts = [
        item.get("code"),
        item.get("reasonLabel"),
        item.get("status"),
        item.get("currentPhaseLabel"),
        item.get("assetCode"),
        item.get("assetName"),
        item.get("assetClass"),
        item.get("assetAssignedUser"),
        item.get("ownerName"),
    ]
    return normalize_comparison_text(" ".join(str(part or "") for part in parts))


EXIT_FINAL_STATE_OPTIONS = [
    {"value": "production", "label": "En produccion"},
    {"value": "stock", "label": "A stock"},
    {"value": "implementation", "label": "En implementacion"},
    {"value": "repair", "label": "En reparacion"},
    {"value": "test", "label": "En prueba"},
    {"value": "inactive", "label": "Inactivo"},
    {"value": "obsolete", "label": "Derivado a obsoleto"},
    {"value": "disposed", "label": "Dado de baja"},
]


def get_lab_bootstrap(session_user: dict[str, Any]) -> dict[str, Any]:
    checklists_data = list_checklists_payload()
    lab_checklist_templates = checklists_data["itemsByModule"].get("lab", [])
    qr_settings = _get_qr_settings()

    all_users = list_users()
    admin_options = [
        {
            "userId": u.get("id"),
            "name": _coerce_str(u.get("fullName") or u.get("username")),
            "itopPersonKey": _coerce_str(u.get("itopPersonKey")),
        }
        for u in all_users
        if u.get("status") == "active" and u.get("isAdmin")
    ]

    return {
        "currentUser": {
            "id": session_user.get("id"),
            "name": _coerce_str(session_user.get("name") or session_user.get("username")),
        },
        "currentDate": datetime.now().strftime("%Y-%m-%d"),
        "reasonOptions": REASON_OPTIONS,
        "statusOptions": [
            {"value": db_key, "label": ui_label}
            for db_key, ui_label in STATUS_DB_TO_UI.items()
        ],
        "exitFinalStateOptions": EXIT_FINAL_STATE_OPTIONS,
        "adminOptions": admin_options,
        "checklistTemplates": lab_checklist_templates,
        "searchHints": {
            "minCharsAssets": 2,
        },
        "actions": {
            "allowQrSignature": bool(qr_settings.get("enabled", True)),
            "qrSessionTtlMinutes": max(1, int(qr_settings.get("sessionTtlMinutes") or 20)),
        },
    }


def list_lab_records(
    query: str = "",
    status: str = "",
    reason: str = "",
) -> dict[str, Any]:
    rows = fetch_lab_record_rows(query="", status=status, reason=reason)
    items = [_serialize_record_for_response(row) for row in rows]

    normalized_query = normalize_comparison_text(query)
    if normalized_query:
        tokens = [token for token in normalized_query.split() if token]
        items = [
            item
            for item in items
            if all(token in _build_record_haystack(item) for token in tokens)
        ]

    return {"items": items}


def get_lab_record_detail(record_id: int) -> dict[str, Any]:
    row = fetch_lab_record_row(record_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Acta de laboratorio #{record_id} no encontrada.")
    return _serialize_record_for_response(row)


def create_lab_record(payload: dict[str, Any], session_user: dict[str, Any]) -> dict[str, Any]:
    year = datetime.now().year
    document_number = _generate_document_number(year)

    asset = payload.get("asset") or {}
    requester_admin = _normalize_requester_admin(payload)
    record = {
        "document_number": document_number,
        "reason": _coerce_str(payload.get("reason"), "maintenance"),
        "requested_actions": _normalize_requested_actions(payload),
        "status": "draft",
        "asset_itop_id": _coerce_str(asset.get("id") or asset.get("itopId")),
        "asset_code": _coerce_str(asset.get("code")),
        "asset_name": _coerce_str(asset.get("name")),
        "asset_class": _coerce_str(asset.get("className")),
        "asset_serial": _coerce_str(asset.get("serial")),
        "asset_organization": _coerce_str(asset.get("organization")),
        "asset_location": _coerce_str(asset.get("location")),
        "asset_status": _coerce_str(asset.get("status")),
        "asset_assigned_user": _coerce_str(asset.get("assignedUser")),
        "owner_user_id": session_user.get("id"),
        "owner_name": _coerce_str(session_user.get("name") or session_user.get("username")),
        "requester_admin_user_id": requester_admin.get("userId"),
        "requester_admin_name": requester_admin.get("name"),
        "requester_admin_itop_person_key": requester_admin.get("itopPersonKey"),
        "entry_date": _coerce_str(payload.get("entryDate")) or None,
        "entry_observations": _coerce_str(payload.get("entryObservations")),
        "entry_condition_notes": _coerce_str(payload.get("entryConditionNotes")),
        "entry_received_notes": _coerce_str(payload.get("entryReceivedNotes")),
        "entry_evidences": payload.get("entryEvidences") or [],
        "entry_generated_document": None,
        "processing_date": _coerce_str(payload.get("processingDate")) or None,
        "processing_observations": _coerce_str(payload.get("processingObservations")),
        "processing_evidences": payload.get("processingEvidences") or [],
        "processing_generated_document": None,
        "processing_checklists": payload.get("processingChecklists") or [],
        "exit_date": _coerce_str(payload.get("exitDate")) or None,
        "exit_observations": _coerce_str(payload.get("exitObservations")),
        "work_performed": _coerce_str(payload.get("workPerformed")),
        "exit_evidences": payload.get("exitEvidences") or [],
        "exit_generated_document": None,
        "exit_final_state": _coerce_str(payload.get("exitFinalState")),
        "signature_workflow": {},
        "itop_ticket_summary": {},
        "marked_obsolete": False,
        "obsolete_notes": _coerce_str(payload.get("obsoleteNotes")),
        "normalization_act_code": _coerce_str(payload.get("normalizationActCode")),
    }
    record["status"] = derive_status_db(record, qr_enabled=_is_qr_enabled())

    record_id = save_lab_record(None, record)
    row = fetch_lab_record_row(record_id)
    return _serialize_record_for_response(row)


def update_lab_record(record_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    existing = fetch_lab_record_row(record_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Acta de laboratorio #{record_id} no encontrada.")

    asset = payload.get("asset") or {}
    requester_admin = _normalize_requester_admin(payload, existing=existing)
    signature_workflow = (
        payload.get("signatureWorkflow")
        if "signatureWorkflow" in payload
        else existing.get("signature_workflow") or {}
    )
    itop_ticket_summary = (
        payload.get("itopTicket")
        if "itopTicket" in payload
        else existing.get("itop_ticket_summary") or {}
    )

    record = {
        "document_number": _coerce_str(existing.get("document_number")),
        "reason": _coerce_str(payload.get("reason") or existing.get("reason"), "maintenance"),
        "requested_actions": _normalize_requested_actions(payload, existing),
        "status": _coerce_str(existing.get("status"), "draft"),
        "asset_itop_id": _coerce_str(asset.get("id") or asset.get("itopId")) or _coerce_str(existing.get("asset_itop_id")),
        "asset_code": _coerce_str(asset.get("code")) or _coerce_str(existing.get("asset_code")),
        "asset_name": _coerce_str(asset.get("name")) or _coerce_str(existing.get("asset_name")),
        "asset_class": _coerce_str(asset.get("className")) or _coerce_str(existing.get("asset_class")),
        "asset_serial": _coerce_str(asset.get("serial")) or _coerce_str(existing.get("asset_serial")),
        "asset_organization": _coerce_str(asset.get("organization")) or _coerce_str(existing.get("asset_organization")),
        "asset_location": _coerce_str(asset.get("location")) or _coerce_str(existing.get("asset_location")),
        "asset_status": _coerce_str(asset.get("status")) or _coerce_str(existing.get("asset_status")),
        "asset_assigned_user": _coerce_str(asset.get("assignedUser")) or _coerce_str(existing.get("asset_assigned_user")),
        "owner_user_id": existing.get("owner_user_id"),
        "owner_name": _coerce_str(existing.get("owner_name")),
        "requester_admin_user_id": requester_admin.get("userId"),
        "requester_admin_name": requester_admin.get("name"),
        "requester_admin_itop_person_key": requester_admin.get("itopPersonKey"),
        "entry_date": _coerce_str(payload.get("entryDate")) or (_fmt_date(existing.get("entry_date")) or None),
        "entry_observations": _coerce_str(payload.get("entryObservations")) if "entryObservations" in payload else _coerce_str(existing.get("entry_observations")),
        "entry_condition_notes": _coerce_str(payload.get("entryConditionNotes")) if "entryConditionNotes" in payload else _coerce_str(existing.get("entry_condition_notes")),
        "entry_received_notes": _coerce_str(payload.get("entryReceivedNotes")) if "entryReceivedNotes" in payload else _coerce_str(existing.get("entry_received_notes")),
        "entry_evidences": payload.get("entryEvidences") if "entryEvidences" in payload else existing.get("entry_evidences") or [],
        "entry_generated_document": payload.get("entryGeneratedDocument") if "entryGeneratedDocument" in payload else existing.get("entry_generated_document"),
        "processing_date": _coerce_str(payload.get("processingDate")) or (_fmt_date(existing.get("processing_date")) or None),
        "processing_observations": _coerce_str(payload.get("processingObservations")) if "processingObservations" in payload else _coerce_str(existing.get("processing_observations")),
        "processing_evidences": payload.get("processingEvidences") if "processingEvidences" in payload else existing.get("processing_evidences") or [],
        "processing_generated_document": payload.get("processingGeneratedDocument") if "processingGeneratedDocument" in payload else existing.get("processing_generated_document"),
        "processing_checklists": payload.get("processingChecklists") if "processingChecklists" in payload else existing.get("processing_checklists") or [],
        "exit_date": _coerce_str(payload.get("exitDate")) or (_fmt_date(existing.get("exit_date")) or None),
        "exit_observations": _coerce_str(payload.get("exitObservations")) if "exitObservations" in payload else _coerce_str(existing.get("exit_observations")),
        "work_performed": _coerce_str(payload.get("workPerformed")) if "workPerformed" in payload else _coerce_str(existing.get("work_performed")),
        "exit_evidences": payload.get("exitEvidences") if "exitEvidences" in payload else existing.get("exit_evidences") or [],
        "exit_generated_document": payload.get("exitGeneratedDocument") if "exitGeneratedDocument" in payload else existing.get("exit_generated_document"),
        "exit_final_state": _coerce_str(payload.get("exitFinalState")) if "exitFinalState" in payload else _coerce_str(existing.get("exit_final_state")),
        "signature_workflow": signature_workflow if isinstance(signature_workflow, dict) else {},
        "itop_ticket_summary": itop_ticket_summary if isinstance(itop_ticket_summary, dict) else {},
        "obsolete_notes": _coerce_str(payload.get("obsoleteNotes")) if "obsoleteNotes" in payload else _coerce_str(existing.get("obsolete_notes")),
        "normalization_act_code": _coerce_str(payload.get("normalizationActCode")) if "normalizationActCode" in payload else _coerce_str(existing.get("normalization_act_code")),
    }

    exit_final_state_val = _coerce_str(record.get("exit_final_state")).lower()
    record["marked_obsolete"] = exit_final_state_val in OBSOLETE_EXIT_STATES

    forced_status_db = STATUS_UI_TO_DB.get(_coerce_str(payload.get("status")), _coerce_str(payload.get("status")).lower())
    record["status"] = derive_status_db(
        record,
        qr_enabled=_is_qr_enabled(),
        forced_status=forced_status_db,
        previous_status=_coerce_str(existing.get("status"), "draft"),
    )

    for frontend_key, db_key in [
        ("entryEvidences", "entry_evidences"),
        ("processingEvidences", "processing_evidences"),
        ("exitEvidences", "exit_evidences"),
    ]:
        if frontend_key not in payload:
            continue
        new_ev_list = payload[frontend_key] or []
        old_ev_list = existing.get(db_key) or []
        new_names = {item.get("storedName") for item in new_ev_list if item.get("storedName")}
        ev_dir = build_lab_evidence_directory(record_id)
        for old_ev in old_ev_list:
            old_name = _coerce_str(old_ev.get("storedName"))
            if old_name and old_name not in new_names:
                (ev_dir / Path(old_name).name).unlink(missing_ok=True)

    save_lab_record(record_id, record)
    row = fetch_lab_record_row(record_id)
    return _serialize_record_for_response(row)


PHASE_ROLLBACK_FIELDS: dict[str, list[str]] = {
    "entry": [
        "entry_generated_document", "entry_evidences",
        "entry_observations", "entry_condition_notes", "entry_received_notes",
    ],
    "processing": [
        "processing_generated_document", "processing_evidences",
        "processing_observations", "processing_checklists", "processing_date",
    ],
    "exit": [
        "exit_generated_document", "exit_evidences",
        "exit_observations", "work_performed", "exit_date", "exit_final_state",
        "marked_obsolete", "obsolete_notes",
    ],
}


def rollback_lab_phase(record_id: int, phase: str) -> dict[str, Any]:
    normalized_phase = normalize_phase_key(phase)
    if not normalized_phase:
        raise HTTPException(status_code=422, detail=f"Fase '{phase}' no válida.")

    existing = fetch_lab_record_row(record_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Acta de laboratorio #{record_id} no encontrada.")

    if _coerce_str(existing.get("status")) in {"completed_return_to_stock", "completed_obsolete", "cancelled"}:
        raise HTTPException(status_code=422, detail="No es posible revertir una acta cerrada o anulada.")

    phases_to_clear = _phases_at_or_after(normalized_phase)
    payload: dict[str, Any] = {}
    for p in phases_to_clear:
        for field in PHASE_ROLLBACK_FIELDS.get(p, []):
            if field in ("entry_evidences", "processing_evidences", "exit_evidences", "processing_checklists"):
                payload[field] = []
            elif field in ("marked_obsolete",):
                payload[field] = False
            else:
                payload[field] = None

    save_lab_record(record_id, {**{k: existing.get(k) for k in existing}, **payload})
    row = fetch_lab_record_row(record_id)
    return _serialize_record_for_response(row)


def _phases_at_or_after(phase: str) -> list[str]:
    try:
        idx = list(LAB_PHASE_SEQUENCE).index(phase)
    except ValueError:
        return []
    return list(LAB_PHASE_SEQUENCE[idx:])


def _validate_entry_document_generation(row: dict[str, Any]) -> None:
    if not _coerce_str(row.get("asset_itop_id")):
        raise HTTPException(status_code=422, detail="Debes seleccionar un activo antes de generar el acta de entrada.")
    if not row.get("entry_date"):
        raise HTTPException(status_code=422, detail="Debes indicar la fecha de ingreso antes de generar el acta de entrada.")
    if not (row.get("requested_actions") or []):
        raise HTTPException(status_code=422, detail="Debes seleccionar al menos una accion solicitada antes de generar el acta de ingreso.")


def _validate_processing_document_generation(row: dict[str, Any]) -> None:
    if not row.get("entry_generated_document"):
        raise HTTPException(status_code=422, detail="Debes generar primero el acta de ingreso para continuar con la ejecución.")
    if not row.get("processing_date"):
        raise HTTPException(status_code=422, detail="Debes indicar la fecha de ejecución antes de generar el acta de ejecución.")
    if not _is_processing_checklist_complete(row.get("processing_checklists") or []):
        raise HTTPException(status_code=422, detail="Debes completar al menos un checklist de ejecución antes de generar el acta.")


def _validate_exit_document_generation(row: dict[str, Any]) -> None:
    if not row.get("processing_generated_document"):
        raise HTTPException(status_code=422, detail="Debes generar primero el acta de ejecución antes de generar el cierre.")
    if not row.get("exit_date"):
        raise HTTPException(status_code=422, detail="Debes indicar la fecha de cierre antes de generar el acta.")
    if not _coerce_str(row.get("work_performed")):
        raise HTTPException(status_code=422, detail="Debes completar el trabajo realizado antes de generar el acta de cierre.")
    exit_final_state = _coerce_str(row.get("exit_final_state")).lower()
    if not exit_final_state:
        raise HTTPException(status_code=422, detail="Debes seleccionar el estado final del activo antes de generar el acta de cierre.")
    if exit_final_state in OBSOLETE_EXIT_STATES and not _normalize_requester_admin({}, existing=row).get("userId"):
        raise HTTPException(status_code=422, detail="Debes seleccionar un administrador responsable antes de cerrar un acta derivada a obsoleto.")


def generate_lab_document(record_id: int, phase: str) -> dict[str, Any]:
    if phase not in ("entrada", "procesamiento", "salida"):
        raise HTTPException(status_code=422, detail=f"Fase '{phase}' no válida. Usa 'entrada', 'procesamiento' o 'salida'.")

    row = fetch_lab_record_row(record_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Acta de laboratorio #{record_id} no encontrada.")

    document_number = _coerce_str(row.get("document_number"))
    safe_code = document_number.replace("/", "_").replace(" ", "_")

    if phase == "entrada":
        _validate_entry_document_generation(row)
        html, footer_html = build_lab_entry_html(row)
        suffix = "E"
        phase_label = PHASE_LABELS["entry"]
        phase_key = "entry"
    elif phase == "procesamiento":
        _validate_processing_document_generation(row)
        html, footer_html = build_lab_processing_html(row)
        suffix = "P"
        phase_label = PHASE_LABELS["processing"]
        phase_key = "processing"
    else:
        _validate_exit_document_generation(row)
        html, footer_html = build_lab_exit_html(row)
        suffix = "S"
        phase_label = PHASE_LABELS["exit"]
        phase_key = "exit"

    filename = f"{safe_code}-{suffix}.pdf"
    stored_name = f"{safe_code}-{suffix}-{uuid4().hex[:8]}.pdf"
    pdf_bytes = _render_lab_pdf_bytes(html, footer_html, filename=filename)

    doc_dir = build_lab_document_directory(record_id)
    doc_dir.mkdir(parents=True, exist_ok=True)
    stored_path = doc_dir / stored_name
    stored_path.write_bytes(pdf_bytes)

    generated_document = {
        "kind": phase,
        "phaseLabel": phase_label,
        "filename": filename,
        "storedName": stored_name,
        "fileSize": len(pdf_bytes),
        "generatedAt": datetime.now().isoformat(),
    }

    doc_key_map = {
        "entrada": "entry_generated_document",
        "procesamiento": "processing_generated_document",
        "salida": "exit_generated_document",
    }
    old_doc = row.get(doc_key_map[phase])
    if isinstance(old_doc, dict):
        old_stored = _coerce_str(old_doc.get("storedName"))
        if old_stored:
            (doc_dir / Path(old_stored).name).unlink(missing_ok=True)

    existing_root = _get_signature_root(row)
    phase_sessions = existing_root.get("phaseSessions") if isinstance(existing_root.get("phaseSessions"), dict) else {}
    keep_phase_sessions: dict[str, Any] = {}
    if phase_key == "processing":
        if isinstance(phase_sessions.get("entry"), dict):
            keep_phase_sessions["entry"] = phase_sessions["entry"]
    elif phase_key == "exit":
        for previous_key in ("entry", "processing"):
            if isinstance(phase_sessions.get(previous_key), dict):
                keep_phase_sessions[previous_key] = phase_sessions[previous_key]

    next_signature_root = {"phaseSessions": keep_phase_sessions}
    update_payload: dict[str, Any] = {
        "signatureWorkflow": next_signature_root,
        "itopTicket": {},
    }
    if phase == "entrada":
        update_payload["entryGeneratedDocument"] = generated_document
        update_payload["processingGeneratedDocument"] = None
        update_payload["exitGeneratedDocument"] = None
    elif phase == "procesamiento":
        update_payload["processingGeneratedDocument"] = generated_document
        update_payload["exitGeneratedDocument"] = None
    else:
        update_payload["exitGeneratedDocument"] = generated_document

    updated = update_lab_record(record_id, update_payload)
    return {
        "document": generated_document,
        "record": updated,
    }


def get_lab_document_file(record_id: int, stored_name: str) -> Path:
    path = resolve_existing_lab_document(record_id, stored_name)
    if not path:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    return path


def upload_lab_evidences(
    record_id: int,
    phase: str,
    files: list[dict[str, Any]],
) -> dict[str, Any]:
    if phase not in ("entrada", "procesamiento", "salida"):
        raise HTTPException(status_code=422, detail=f"Fase '{phase}' no válida.")

    row = fetch_lab_record_row(record_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Acta de laboratorio #{record_id} no encontrada.")

    evidence_key_map = {
        "entrada": "entry_evidences",
        "procesamiento": "processing_evidences",
        "salida": "exit_evidences",
    }
    existing_evidences: list[dict[str, Any]] = row.get(evidence_key_map[phase]) or []

    ev_dir = build_lab_evidence_directory(record_id)
    ev_dir.mkdir(parents=True, exist_ok=True)

    new_evidences: list[dict[str, Any]] = []
    for file_payload in files:
        original_name = _coerce_str(file_payload.get("name") or file_payload.get("originalName"))
        mime_type = _coerce_str(file_payload.get("mimeType"))
        content_b64 = _coerce_str(file_payload.get("contentBase64"))
        caption = _coerce_str(file_payload.get("caption"))

        ext = Path(original_name).suffix.lstrip(".").lower()
        if ext not in ALLOWED_EVIDENCE_EXTENSIONS:
            raise HTTPException(status_code=422, detail=f"Extensión '{ext}' no permitida para evidencias.")

        stored_name = f"{phase[:1].upper()}-{uuid4().hex[:12]}.{ext}"
        try:
            content = b64decode(content_b64, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Contenido base64 inválido para '{original_name}'.") from exc

        stored_path = ev_dir / stored_name
        stored_path.write_bytes(content)
        new_evidences.append({
            "storedName": stored_name,
            "originalName": original_name,
            "mimeType": mime_type or (mimetypes.guess_type(original_name)[0] or "application/octet-stream"),
            "fileSize": len(content),
            "caption": caption,
        })

    merged_evidences = existing_evidences + new_evidences
    frontend_key_map = {
        "entrada": "entryEvidences",
        "procesamiento": "processingEvidences",
        "salida": "exitEvidences",
    }
    update_lab_record(record_id, {frontend_key_map[phase]: merged_evidences})
    return {"evidences": merged_evidences}


def get_lab_evidence_file(record_id: int, stored_name: str) -> Path:
    path = resolve_existing_lab_evidence(record_id, stored_name)
    if not path:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada.")
    return path


def _build_signature_documents(record: dict[str, Any], workflow_kind: str, phase_key: str) -> list[dict[str, Any]]:
    target_phase = "exit" if workflow_kind == "admin" else normalize_phase_key(phase_key)
    if not target_phase:
        return []
    document = _get_phase_document(record, target_phase)
    if not document:
        return []
    return [{
        "kind": target_phase,
        "name": f"Acta de {PHASE_LABELS.get(target_phase, target_phase).lower()}",
        "filename": _coerce_str(document.get("filename")) or _coerce_str(document.get("storedName")),
    }]


def _render_phase_html(record: dict[str, Any], phase_key: str) -> tuple[str, str | None]:
    if phase_key == "entry":
        return build_lab_entry_html(record)
    if phase_key == "processing":
        return build_lab_processing_html(record)
    return build_lab_exit_html(record)


def _resolve_signature_session_context(
    record: dict[str, Any],
    *,
    workflow_kind: str = "",
    phase: str = "",
) -> tuple[str, str, dict[str, Any]]:
    normalized_kind = "admin" if _coerce_str(workflow_kind).lower() == "admin" else "phase"
    normalized_phase = normalize_phase_key(phase)

    if normalized_kind == "admin":
        return "admin", "adminApproval", get_admin_signature_workflow(record)

    if normalized_phase:
        return "phase", normalized_phase, get_phase_signature_workflow(record, normalized_phase)

    state = _build_lab_record_state(record)
    if state["nextSignatureKind"] == "admin":
        return "admin", "adminApproval", get_admin_signature_workflow(record)
    phase_key = state["nextSignaturePhase"] or resolve_lab_phase_key(record)
    return "phase", phase_key, get_phase_signature_workflow(record, phase_key)


def _build_lab_signature_session_response(
    record: dict[str, Any],
    signature_workflow: dict[str, Any],
    *,
    workflow_kind: str,
    phase_key: str,
    owner_claim_token: str = "",
    occupied: bool = False,
) -> dict[str, Any]:
    state = _build_lab_record_state(record)
    token = _coerce_str(signature_workflow.get("token"))
    public_url = _coerce_str(signature_workflow.get("publicUrl")) or _build_lab_public_signature_url(token)
    status = "occupied" if occupied else (resolve_signature_workflow_status(signature_workflow) or _coerce_str(signature_workflow.get("status"), "pending"))
    claim_token = _coerce_str(signature_workflow.get("claimToken"))
    signature_target = (
        _build_admin_signature_target(record)
        if workflow_kind == "admin"
        else _build_phase_signature_target(record, phase_key)
    )
    phase_label = "Aprobacion administrativa" if workflow_kind == "admin" else PHASE_LABELS.get(phase_key, phase_key)

    return {
        "documentId": int(record.get("id") or 0),
        "documentNumber": _coerce_str(record.get("document_number")),
        "handoverType": "Acta de laboratorio",
        "documentStatus": state["statusUi"],
        "status": status,
        "publicUrl": public_url,
        "workflowKind": workflow_kind,
        "phase": phase_key,
        "phaseLabel": phase_label,
        "requestedAt": _coerce_str(signature_workflow.get("requestedAt")),
        "expiresAt": _coerce_str(signature_workflow.get("expiresAt")),
        "claimedAt": _coerce_str(signature_workflow.get("claimedAt")),
        "completedAt": _coerce_str(signature_workflow.get("completedAt")),
        "claimToken": claim_token if claim_token and owner_claim_token and claim_token == owner_claim_token else owner_claim_token,
        "receiver": signature_target,
        "signatureTarget": signature_target,
        "documents": _build_signature_documents(record, workflow_kind, phase_key),
        "brand": get_public_signature_branding(),
        "messages": {
            "success": _coerce_str(_get_qr_settings().get("successMessage")) or "La firma digital del acta de laboratorio ya fue registrada correctamente.",
            "completionHint": _coerce_str(_get_qr_settings().get("completionHint")) or "Puedes cerrar esta ventana cuando quieras.",
        },
    }


def _assert_can_open_signature(record: dict[str, Any], workflow_kind: str, phase_key: str) -> None:
    state = _build_lab_record_state(record)
    if workflow_kind == "admin":
        if not record.get("marked_obsolete"):
            raise HTTPException(status_code=422, detail="La aprobación administrativa solo aplica a cierres derivados a obsolescencia.")
        if not _get_phase_document(record, "exit"):
            raise HTTPException(status_code=422, detail="Debes generar primero el acta de cierre antes de solicitar la aprobación administrativa.")
        if not _normalize_requester_admin({}, existing=record).get("userId"):
            raise HTTPException(status_code=422, detail="Debes seleccionar un administrador responsable antes de solicitar esta firma.")
        existing_status = resolve_admin_signature_status(record)
        if existing_status in {"pending", "claimed", "signed", "published"}:
            return
        if state["statusDb"] != "pending_admin_signature":
            raise HTTPException(status_code=422, detail="La aprobación administrativa no está disponible en el estado actual del acta.")
        return

    if not _get_phase_document(record, phase_key):
        raise HTTPException(status_code=422, detail="Debes generar el PDF de esta fase antes de solicitar la firma QR.")
    if not state["requiresSignature"]:
        raise HTTPException(status_code=422, detail="La firma QR está deshabilitada para este flujo.")
    existing_status = resolve_phase_signature_status(record, phase_key)
    if existing_status in {"pending", "claimed", "signed", "published"}:
        return
    expected_status = {
        "entry": "pending_entry_signature",
        "processing": "pending_processing_signature",
        "exit": "pending_exit_signature",
    }.get(phase_key)
    if state["statusDb"] != expected_status:
        raise HTTPException(status_code=422, detail="La firma QR solo está disponible para la fase activa pendiente de firma.")


def _save_scoped_signature_workflow(record_id: int, record: dict[str, Any], workflow_kind: str, phase_key: str, workflow: dict[str, Any]) -> dict[str, Any]:
    updated_record = (
        _update_admin_signature_workflow(record, workflow)
        if workflow_kind == "admin"
        else _update_phase_signature_workflow(record, phase_key, workflow)
    )
    return update_lab_record(record_id, {"signatureWorkflow": updated_record.get("signature_workflow") or {}})


def create_lab_signature_session(
    record_id: int,
    session_user: dict[str, Any],
    *,
    phase: str = "",
    workflow_kind: str = "",
    force_new: bool = False,
) -> dict[str, Any]:
    qr_settings = _ensure_qr_signature_enabled()
    if not _coerce_str(qr_settings.get("hubPublicBaseUrl")):
        raise HTTPException(
            status_code=422,
            detail="Debes configurar la URL pública del Hub en Configuración > Firma QR antes de generar un código QR.",
        )

    current_row = fetch_lab_record_row(record_id)
    if not current_row:
        raise HTTPException(status_code=404, detail="Acta no encontrada.")

    resolved_kind, resolved_phase, existing_workflow = _resolve_signature_session_context(
        current_row,
        workflow_kind=workflow_kind,
        phase=phase,
    )
    _assert_can_open_signature(current_row, resolved_kind, resolved_phase)
    workflow_status = resolve_signature_workflow_status(existing_workflow)

    if workflow_status in {"signed", "published"} and _coerce_str(existing_workflow.get("token")) and not force_new:
        return _build_lab_signature_session_response(current_row, existing_workflow, workflow_kind=resolved_kind, phase_key=resolved_phase)
    if workflow_status in {"pending", "claimed"} and _coerce_str(existing_workflow.get("token")) and not force_new:
        return _build_lab_signature_session_response(current_row, existing_workflow, workflow_kind=resolved_kind, phase_key=resolved_phase)

    now = datetime.now()
    token = uuid4().hex
    expires_at = now + timedelta(minutes=_get_qr_signature_ttl_minutes())
    signature_target = (
        _build_admin_signature_target(current_row)
        if resolved_kind == "admin"
        else _build_phase_signature_target(current_row, resolved_phase)
    )
    signature_workflow = {
        "channel": "qr",
        "status": "pending",
        "token": token,
        "publicUrl": _build_lab_public_signature_url(token),
        "requestedAt": _serialize_signature_timestamp(now),
        "expiresAt": _serialize_signature_timestamp(expires_at),
        "claimedAt": "",
        "completedAt": "",
        "cancelledAt": _serialize_signature_timestamp(now) if force_new and _coerce_str(existing_workflow.get("token")) else "",
        "claimToken": "",
        "requestedBy": {
            "id": session_user.get("id"),
            "name": _coerce_str(session_user.get("name") or session_user.get("username")),
        },
        "signatureTarget": signature_target,
        "signedBy": {},
        "signature": {},
        "signerObservation": "",
        "deviceLock": {
            "singleDevice": bool(qr_settings.get("singleDeviceLock", True)),
            "claimed": False,
        },
    }
    saved = _save_scoped_signature_workflow(record_id, current_row, resolved_kind, resolved_phase, signature_workflow)
    refreshed_row = fetch_lab_record_row(record_id) or current_row
    saved_workflow = (
        get_admin_signature_workflow(refreshed_row)
        if resolved_kind == "admin"
        else get_phase_signature_workflow(refreshed_row, resolved_phase)
    ) or signature_workflow
    return _build_lab_signature_session_response(refreshed_row, saved_workflow, workflow_kind=resolved_kind, phase_key=resolved_phase)


def get_lab_signature_session(record_id: int, *, phase: str = "", workflow_kind: str = "") -> dict[str, Any]:
    current_row = fetch_lab_record_row(record_id)
    if not current_row:
        raise HTTPException(status_code=404, detail="Acta no encontrada.")
    resolved_kind, resolved_phase, signature_workflow = _resolve_signature_session_context(
        current_row,
        workflow_kind=workflow_kind,
        phase=phase,
    )
    _assert_can_open_signature(current_row, resolved_kind, resolved_phase)
    return _build_lab_signature_session_response(current_row, signature_workflow, workflow_kind=resolved_kind, phase_key=resolved_phase)


def _get_public_lab_signature_detail(signature_token: str) -> tuple[dict[str, Any], dict[str, Any], str, str]:
    token = Path(_coerce_str(signature_token)).name
    if not token:
        raise HTTPException(status_code=404, detail="La sesión de firma no existe.")

    row = fetch_lab_record_row_by_signature_token(token)
    if not row:
        raise HTTPException(status_code=404, detail="La sesión de firma no existe.")

    for phase_key in LAB_PHASE_SEQUENCE:
        workflow = get_phase_signature_workflow(row, phase_key)
        if _coerce_str(workflow.get("token")) == token:
            return row, workflow, "phase", phase_key

    admin_workflow = get_admin_signature_workflow(row)
    if _coerce_str(admin_workflow.get("token")) == token:
        return row, admin_workflow, "admin", "adminApproval"

    raise HTTPException(status_code=404, detail="La sesión de firma no existe.")


def _claim_public_signature_session(
    record: dict[str, Any],
    signature_workflow: dict[str, Any],
    *,
    workflow_kind: str,
    phase_key: str,
    claim_token: str = "",
) -> tuple[dict[str, Any], str, bool]:
    workflow_status = resolve_signature_workflow_status(signature_workflow)
    if workflow_status not in {"pending", "claimed"} or not _is_qr_single_device_lock_enabled():
        return signature_workflow, "", False

    existing_claim_token = _coerce_str(signature_workflow.get("claimToken"))
    normalized_claim_token = _coerce_str(claim_token)
    if existing_claim_token:
        if existing_claim_token == normalized_claim_token:
            return signature_workflow, existing_claim_token, False
        return signature_workflow, "", True

    if not normalized_claim_token:
        return signature_workflow, "", False

    claimed_at = _serialize_signature_timestamp()
    updated_workflow = {
        **signature_workflow,
        "status": "claimed",
        "claimedAt": claimed_at,
        "claimToken": normalized_claim_token,
        "deviceLock": {
            "singleDevice": True,
            "claimed": True,
        },
    }
    _save_scoped_signature_workflow(int(record["id"]), record, workflow_kind, phase_key, updated_workflow)
    return updated_workflow, normalized_claim_token, False


def get_public_lab_signature_session(
    signature_token: str,
    *,
    claim_token: str = "",
) -> dict[str, Any]:
    record, signature_workflow, workflow_kind, phase_key = _get_public_lab_signature_detail(signature_token)
    resolved_workflow, owner_claim_token, occupied = _claim_public_signature_session(
        record,
        signature_workflow,
        workflow_kind=workflow_kind,
        phase_key=phase_key,
        claim_token=claim_token,
    )
    if resolved_workflow is not signature_workflow:
        record = fetch_lab_record_row(int(record["id"])) or record
    current_workflow = (
        get_admin_signature_workflow(record)
        if workflow_kind == "admin"
        else get_phase_signature_workflow(record, phase_key)
    ) or resolved_workflow
    return _build_lab_signature_session_response(
        record,
        current_workflow,
        workflow_kind=workflow_kind,
        phase_key=phase_key,
        owner_claim_token=owner_claim_token,
        occupied=occupied,
    )


def _save_signed_phase_document(record: dict[str, Any], phase_key: str, pdf_bytes: bytes, generated_at: str) -> dict[str, Any]:
    document = _get_phase_document(record, phase_key)
    if not document:
        raise HTTPException(status_code=422, detail="El acta no tiene un PDF disponible para firmar.")
    doc_dir = build_lab_document_directory(int(record["id"]))
    doc_dir.mkdir(parents=True, exist_ok=True)
    stored_name = _coerce_str(document.get("storedName"))
    stored_path = doc_dir / Path(stored_name).name
    stored_path.write_bytes(pdf_bytes)
    return {
        **document,
        "fileSize": len(pdf_bytes),
        "generatedAt": generated_at,
    }


def submit_public_lab_signature(
    signature_token: str,
    *,
    signature_data_url: str,
    signer_name: str = "",
    signer_role: str = "",
    observation: str = "",
    claim_token: str = "",
) -> dict[str, Any]:
    record, signature_workflow, workflow_kind, phase_key = _get_public_lab_signature_detail(signature_token)
    workflow_status = resolve_signature_workflow_status(signature_workflow)
    normalized_claim_token = _coerce_str(claim_token)

    if workflow_kind == "admin":
        current_state = _build_lab_record_state(record)
        current_status = resolve_admin_signature_status(record)
        if current_state["statusDb"] == "pending_admin_signature" and current_status in {"signed", "published"}:
            return _build_lab_signature_session_response(record, signature_workflow, workflow_kind=workflow_kind, phase_key=phase_key, owner_claim_token=normalized_claim_token)
        if current_state["statusDb"] != "pending_admin_signature" or workflow_status not in {"pending", "claimed"}:
            raise HTTPException(status_code=410, detail="La sesión de firma ya no está disponible para esta aprobación.")
    else:
        expected_status = {
            "entry": "pending_entry_signature",
            "processing": "pending_processing_signature",
            "exit": "pending_exit_signature",
        }.get(phase_key)
        current_state = _build_lab_record_state(record)
        current_status = resolve_phase_signature_status(record, phase_key)
        if current_state["statusDb"] == expected_status and current_status in {"signed", "published"}:
            return _build_lab_signature_session_response(record, signature_workflow, workflow_kind=workflow_kind, phase_key=phase_key, owner_claim_token=normalized_claim_token)
        if current_state["statusDb"] != expected_status or workflow_status not in {"pending", "claimed"}:
            raise HTTPException(status_code=410, detail="La sesión de firma ya no está disponible para esta fase.")

    if _is_qr_single_device_lock_enabled() and _coerce_str(signature_workflow.get("claimToken")) != normalized_claim_token:
        raise HTTPException(status_code=409, detail="Este código QR ya está siendo utilizado desde otro dispositivo.")

    validated_signature = _validate_signature_data_url(signature_data_url)
    signed_at = _serialize_signature_timestamp()
    signature_target = (
        _build_admin_signature_target(record)
        if workflow_kind == "admin"
        else _build_phase_signature_target(record, phase_key)
    )
    updated_workflow = {
        **signature_workflow,
        "status": "signed",
        "completedAt": signed_at,
        "signedBy": {
            "name": _coerce_str(signer_name) or _coerce_str(signature_target.get("name")),
            "role": _coerce_str(signer_role) or _coerce_str(signature_target.get("role")),
        },
        "signerObservation": _coerce_str(observation),
        "signature": validated_signature,
        "deviceLock": {
            "singleDevice": bool(signature_workflow.get("deviceLock", {}).get("singleDevice", _is_qr_single_device_lock_enabled())),
            "claimed": True,
        },
    }

    record_with_workflow = (
        _update_admin_signature_workflow(record, updated_workflow)
        if workflow_kind == "admin"
        else _update_phase_signature_workflow(record, phase_key, updated_workflow)
    )
    detail_for_pdf = {
        **record_with_workflow,
        "activeSignatureWorkflow": updated_workflow,
        "activeSignaturePhase": phase_key,
        "activeSignatureKind": workflow_kind,
    }
    rendered_phase = "exit" if workflow_kind == "admin" else phase_key
    html, footer_html = _render_phase_html(detail_for_pdf, rendered_phase)
    filename = _coerce_str(_get_phase_document(record, rendered_phase).get("filename")) or f"{_coerce_str(record.get('document_number'))}-{rendered_phase}.pdf"
    pdf_bytes = _render_lab_pdf_bytes(html, footer_html, filename=filename)
    updated_document = _save_signed_phase_document(record, rendered_phase, pdf_bytes, signed_at)

    payload: dict[str, Any] = {"signatureWorkflow": record_with_workflow.get("signature_workflow") or {}}
    if rendered_phase == "entry":
        payload["entryGeneratedDocument"] = updated_document
    elif rendered_phase == "processing":
        payload["processingGeneratedDocument"] = updated_document
    else:
        payload["exitGeneratedDocument"] = updated_document

    update_lab_record(int(record["id"]), payload)
    refreshed_row = fetch_lab_record_row(int(record["id"])) or record
    current_workflow = (
        get_admin_signature_workflow(refreshed_row)
        if workflow_kind == "admin"
        else get_phase_signature_workflow(refreshed_row, phase_key)
    ) or updated_workflow
    return _build_lab_signature_session_response(
        refreshed_row,
        current_workflow,
        workflow_kind=workflow_kind,
        phase_key=phase_key,
        owner_claim_token=normalized_claim_token,
    )


def get_public_lab_signature_document(
    signature_token: str,
    document_kind: str,
    *,
    claim_token: str = "",
) -> tuple[Path, str]:
    record, signature_workflow, workflow_kind, phase_key = _get_public_lab_signature_detail(signature_token)
    workflow_status = resolve_signature_workflow_status(signature_workflow)
    if workflow_status == "claimed" and _is_qr_single_device_lock_enabled():
        if _coerce_str(signature_workflow.get("claimToken")) != _coerce_str(claim_token):
            raise HTTPException(status_code=409, detail="Este código QR ya está siendo utilizado desde otro dispositivo.")

    kind = normalize_phase_key(Path(_coerce_str(document_kind)).name.lower()) or ("exit" if workflow_kind == "admin" else phase_key)
    document = _get_phase_document(record, kind)
    if not document:
        raise HTTPException(status_code=404, detail="Documento no disponible en esta sesión de firma.")

    stored_name = _coerce_str(document.get("storedName"))
    safe_name = _coerce_str(document.get("filename")) or Path(stored_name).name
    file_path = resolve_existing_lab_document(int(record["id"]), stored_name)
    if not file_path:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    return file_path, safe_name


def _build_lab_ticket_description(record: dict[str, Any]) -> str:
    actions = record.get("requested_actions") or []
    action_labels = ", ".join(REASON_DB_TO_UI.get(_coerce_str(item), _coerce_str(item)) for item in actions if _coerce_str(item))
    reason_label = REASON_DB_TO_UI.get(_coerce_str(record.get("reason")), _coerce_str(record.get("reason")))
    sections = [
        f"Acta: {_coerce_str(record.get('document_number'))}",
        f"Activo: {_coerce_str(record.get('asset_code'))} / {_coerce_str(record.get('asset_name'))}",
        f"Motivo principal: {reason_label}",
        f"Acciones solicitadas: {action_labels or reason_label}",
        f"Estado base / condicion: {_coerce_str(record.get('entry_condition_notes')) or 'Sin detalle'}",
        f"Observaciones de ingreso: {_coerce_str(record.get('entry_observations')) or 'Sin observaciones'}",
        f"Notas recibidas: {_coerce_str(record.get('entry_received_notes')) or 'Sin notas'}",
        f"Observaciones de ejecucion: {_coerce_str(record.get('processing_observations')) or 'Sin observaciones'}",
        f"Trabajo realizado: {_coerce_str(record.get('work_performed')) or 'Sin detalle'}",
        f"Observaciones de cierre: {_coerce_str(record.get('exit_observations')) or 'Sin observaciones'}",
    ]
    if record.get("marked_obsolete"):
        sections.append(f"Derivacion a obsoleto: {_coerce_str(record.get('obsolete_notes')) or 'Solicitada sin comentario adicional'}")
    return "\n".join(sections)


def _resolve_lab_ticket_requester(record: dict[str, Any], session_user: dict[str, Any]) -> dict[str, str]:
    if record.get("marked_obsolete"):
        requester_admin = _normalize_requester_admin({}, existing=record)
        if not requester_admin.get("userId") or not requester_admin.get("itopPersonKey"):
            raise HTTPException(status_code=422, detail="Debes seleccionar un administrador con persona iTop asociada para cerrar un acta derivada a obsoleto.")
        return {
            "requesterId": _coerce_str(requester_admin.get("itopPersonKey")),
            "requesterName": _coerce_str(requester_admin.get("name")),
        }

    requester_id = _coerce_str(session_user.get("itopPersonKey"))
    if requester_id.isdigit():
        return {
            "requesterId": requester_id,
            "requesterName": _coerce_str(session_user.get("name") or session_user.get("username")),
        }

    requester_admin = _normalize_requester_admin({}, existing=record)
    if requester_admin.get("itopPersonKey"):
        return {
            "requesterId": _coerce_str(requester_admin.get("itopPersonKey")),
            "requesterName": _coerce_str(requester_admin.get("name")),
        }

    raise HTTPException(status_code=422, detail="No fue posible determinar el solicitante iTop para cerrar esta acta de laboratorio.")


def _build_lab_ticket_payload(record: dict[str, Any], session_user: dict[str, Any]) -> dict[str, Any]:
    requester = _resolve_lab_ticket_requester(record, session_user)
    return {
        "requesterId": requester["requesterId"],
        "requester": requester["requesterName"],
        "subject": f"Acta laboratorio {_coerce_str(record.get('document_number'))} - {_coerce_str(record.get('asset_code') or record.get('asset_name'))}".strip(),
        "description": _build_lab_ticket_description(record),
    }


def _build_lab_itop_documents(record: dict[str, Any]) -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []
    for phase_key, phase_suffix in (("entry", "ingreso"), ("processing", "ejecucion"), ("exit", "cierre")):
        document = _get_phase_document(record, phase_key)
        if not document:
            continue
        stored_name = _coerce_str(document.get("storedName"))
        if not stored_name:
            continue
        file_path = resolve_existing_lab_document(int(record["id"]), stored_name)
        if not file_path:
            continue
        documents.append({
            "documentType": phase_key,
            "name": _coerce_str(document.get("filename")) or f"{_coerce_str(record.get('document_number'))}-{phase_suffix}.pdf",
            "mimeType": "application/pdf",
            "path": file_path,
        })
    return documents


def finalize_lab_closure(record_id: int, session_user: dict[str, Any], runtime_token: str) -> dict[str, Any]:
    current_row = fetch_lab_record_row(record_id)
    if not current_row:
        raise HTTPException(status_code=404, detail="Acta no encontrada.")

    state = _build_lab_record_state(current_row)
    if state["statusDb"] in {"completed_return_to_stock", "completed_obsolete"}:
        return _serialize_record_for_response(current_row)
    if state["statusDb"] != "pending_itop_sync":
        raise HTTPException(status_code=422, detail="El acta aún no está lista para registrar el ticket iTop.")

    ticket_summary = get_itop_ticket_summary(current_row)
    if not _coerce_str(ticket_summary.get("id")):
        ticket_summary = _create_itop_handover_ticket(
            {"documentNumber": _coerce_str(current_row.get("document_number"))},
            _build_lab_ticket_payload(current_row, session_user),
            runtime_token,
            contact_ids=[],
        )

    ticket_id = int(_coerce_str(ticket_summary.get("id")) or 0)
    if ticket_id <= 0:
        raise HTTPException(status_code=502, detail="No fue posible obtener el identificador del ticket iTop para esta acta.")

    documents = _build_lab_itop_documents(current_row)
    attachment_results: list[dict[str, Any]] = []
    connector = _build_itop_connector(runtime_token)
    try:
        for document in documents:
            attachment_results.append(
                _create_itop_attachment(
                    connector,
                    target_class=_coerce_str(ticket_summary.get("className"), "UserRequest") or "UserRequest",
                    target_id=ticket_id,
                    target_org_id=int(_coerce_str(ticket_summary.get("orgId")) or 0),
                    document=document,
                    comment=f"Adjunto sincronizado desde acta {_coerce_str(current_row.get('document_number'))}".strip(),
                )
            )

        asset_id = int(_coerce_str(current_row.get("asset_itop_id")) or 0)
        if asset_id > 0:
            _ensure_ci_ticket_link(
                connector,
                ticket_id=ticket_id,
                asset_id=asset_id,
                asset_label=_coerce_str(current_row.get("asset_code") or current_row.get("asset_name")),
                document_number=_coerce_str(current_row.get("document_number")),
            )

            exit_final_state = _coerce_str(current_row.get("exit_final_state")).lower()
            if exit_final_state:
                asset_class = _resolve_asset_itop_class(connector, asset_id)
                connector.update_ci_status(
                    asset_class,
                    asset_id,
                    exit_final_state,
                    comment=f"Estado actualizado desde acta de laboratorio {_coerce_str(current_row.get('document_number'))}".strip(),
                )
    finally:
        connector.close()

    saved_ticket = {
        **ticket_summary,
        "attachments": attachment_results,
        "syncedAt": _serialize_signature_timestamp(),
    }
    updated = update_lab_record(record_id, {"itopTicket": saved_ticket})
    return updated
