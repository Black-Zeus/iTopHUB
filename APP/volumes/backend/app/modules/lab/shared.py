from __future__ import annotations

from datetime import datetime
from typing import Any
import unicodedata


STATUS_DB_TO_UI = {
    "draft": "Borrador de ingreso",
    "pending_entry_signature": "Pendiente firma ingreso",
    "in_execution": "En ejecucion",
    "pending_processing_signature": "Pendiente firma ejecucion",
    "ready_for_closure": "Lista para cierre",
    "pending_exit_signature": "Pendiente firma cierre",
    "pending_admin_signature": "Pendiente firma administrador",
    "pending_itop_sync": "Pendiente registro iTop",
    "completed_return_to_stock": "Cerrada a stock",
    "completed_obsolete": "Cerrada por obsolescencia",
    "cancelled": "Anulada",
}

STATUS_UI_TO_DB = {value: key for key, value in STATUS_DB_TO_UI.items()}

REASON_DB_TO_UI = {
    "maintenance": "Mantenimiento",
    "cleaning": "Limpieza",
    "backup": "Respaldo",
    "virus_analysis": "Analisis de virus",
    "full_reset": "Reinicio completo",
    "warranty_referral": "Derivado a garantia",
    "donation_format": "Formateo para donacion",
    "retirement_format": "Formateo para baja",
    "hardware_analysis": "Analisis de hardware",
    "hardware_repair": "Reparacion de hardware",
    "software_update": "Actualizacion de software",
    "functional_verification": "Verificacion funcional",
    "reinstallation": "Reinstalacion",
    "diagnosis": "Diagnostico",
    "other": "Otro procedimiento",
}

REASON_UI_TO_DB = {value: key for key, value in REASON_DB_TO_UI.items()}

REASON_OPTIONS = [
    {"value": key, "label": label}
    for key, label in REASON_DB_TO_UI.items()
]

LAB_DOCUMENT_ROOT_ENV_NAME = "lab"
ALLOWED_EVIDENCE_EXTENSIONS = {"jpg", "jpeg", "png"}
EMPTY_ASSIGNED_USER_LABELS = {"", "sin asignar", "sin responsable"}
LAB_PHASE_SEQUENCE = ("entry", "processing", "exit")

PHASE_LABELS = {
    "entry": "Ingreso",
    "processing": "Ejecucion",
    "exit": "Cierre",
}

PHASE_NAME_TO_KEY = {
    "entrada": "entry",
    "ingreso": "entry",
    "entry": "entry",
    "procesamiento": "processing",
    "ejecucion": "processing",
    "processing": "processing",
    "salida": "exit",
    "cierre": "exit",
    "exit": "exit",
}


def coerce_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def normalize_comparison_text(value: Any) -> str:
    text = coerce_str(value)
    if not text:
        return ""
    return (
        unicodedata.normalize("NFD", text)
        .encode("ascii", "ignore")
        .decode("ascii")
        .strip()
        .lower()
    )


def parse_signature_timestamp(value: Any) -> datetime | None:
    text = coerce_str(value)
    if not text:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def normalize_phase_key(value: Any) -> str:
    return PHASE_NAME_TO_KEY.get(coerce_str(value).lower(), "")


def _resolve_workflow_status(workflow: Any) -> str:
    if not isinstance(workflow, dict):
        return ""

    status = coerce_str(workflow.get("status")).lower()
    if status in {"signed", "published", "cancelled", "occupied"}:
        return status

    expires_at = parse_signature_timestamp(workflow.get("expiresAt"))
    if expires_at and expires_at <= datetime.now():
        return "expired"

    if status in {"pending", "claimed"}:
        return status

    return ""


def get_lab_signature_payload(record: dict[str, Any]) -> dict[str, Any]:
    workflow = record.get("signature_workflow")
    return workflow if isinstance(workflow, dict) else {}


def get_phase_signature_map(record: dict[str, Any]) -> dict[str, Any]:
    payload = get_lab_signature_payload(record)
    phase_sessions = payload.get("phaseSessions")
    return phase_sessions if isinstance(phase_sessions, dict) else {}


def get_phase_signature_workflow(record: dict[str, Any], phase_key: str) -> dict[str, Any]:
    phase = normalize_phase_key(phase_key) or phase_key
    workflow = get_phase_signature_map(record).get(phase)
    return workflow if isinstance(workflow, dict) else {}


def resolve_phase_signature_status(record: dict[str, Any], phase_key: str) -> str:
    return _resolve_workflow_status(get_phase_signature_workflow(record, phase_key))


def get_admin_signature_workflow(record: dict[str, Any]) -> dict[str, Any]:
    payload = get_lab_signature_payload(record)
    workflow = payload.get("adminApproval")
    return workflow if isinstance(workflow, dict) else {}


def resolve_admin_signature_status(record: dict[str, Any]) -> str:
    return _resolve_workflow_status(get_admin_signature_workflow(record))


def resolve_signature_workflow_status(workflow: Any) -> str:
    return _resolve_workflow_status(workflow)


def get_itop_ticket_summary(record: dict[str, Any]) -> dict[str, Any]:
    payload = record.get("itop_ticket_summary")
    return payload if isinstance(payload, dict) else {}


def is_itop_ticket_registered(record: dict[str, Any]) -> bool:
    ticket = get_itop_ticket_summary(record)
    return bool(coerce_str(ticket.get("id")) and coerce_str(ticket.get("syncedAt")))


def resolve_signature_target_name(record: dict[str, Any]) -> str:
    assigned_user = normalize_comparison_text(record.get("asset_assigned_user"))
    if assigned_user in EMPTY_ASSIGNED_USER_LABELS:
        return ""
    return coerce_str(record.get("asset_assigned_user"))


def resolve_lab_phase_key(record: dict[str, Any]) -> str:
    if record.get("exit_generated_document"):
        return "exit"
    if (
        record.get("processing_generated_document")
        or record.get("processing_date")
        or record.get("processing_observations")
        or record.get("processing_checklists")
        or record.get("processing_evidences")
    ):
        return "processing"
    return "entry"


def resolve_lab_phase_label(record: dict[str, Any]) -> str:
    return PHASE_LABELS.get(resolve_lab_phase_key(record), "Ingreso")


def should_require_signature(record: dict[str, Any], *, qr_enabled: bool) -> bool:
    return bool(qr_enabled)


def derive_status_db(
    record: dict[str, Any],
    *,
    qr_enabled: bool,
    forced_status: str = "",
    previous_status: str = "",
) -> str:
    normalized_forced = coerce_str(forced_status).lower()
    normalized_previous = coerce_str(previous_status).lower()

    if normalized_forced == "cancelled" or normalized_previous == "cancelled":
        return "cancelled"

    if not record.get("entry_generated_document"):
        return "draft"

    if should_require_signature(record, qr_enabled=qr_enabled) and resolve_phase_signature_status(record, "entry") not in {"signed", "published"}:
        return "pending_entry_signature"

    if not record.get("processing_generated_document"):
        return "in_execution"

    if should_require_signature(record, qr_enabled=qr_enabled) and resolve_phase_signature_status(record, "processing") not in {"signed", "published"}:
        return "pending_processing_signature"

    if not record.get("exit_generated_document"):
        return "ready_for_closure"

    if should_require_signature(record, qr_enabled=qr_enabled) and resolve_phase_signature_status(record, "exit") not in {"signed", "published"}:
        return "pending_exit_signature"

    if bool(record.get("marked_obsolete")) and resolve_admin_signature_status(record) not in {"signed", "published"}:
        return "pending_admin_signature"

    if not is_itop_ticket_registered(record):
        return "pending_itop_sync"

    if bool(record.get("marked_obsolete")):
        return "completed_obsolete"
    return "completed_return_to_stock"
