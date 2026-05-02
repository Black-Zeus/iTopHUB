from __future__ import annotations

from typing import Any
import unicodedata


STATUS_DB_TO_UI = {
    "draft": "En creacion",
    "in_lab": "En laboratorio",
    "completed": "Completada",
    "derived_obsolete": "Derivada a obsoleto",
    "cancelled": "Anulada",
}

STATUS_UI_TO_DB = {value: key for key, value in STATUS_DB_TO_UI.items()}

REASON_DB_TO_UI = {
    "maintenance": "Mantenimiento",
    "cleaning": "Limpieza",
    "reinstallation": "Reinstalacion",
    "backup": "Respaldo",
    "diagnosis": "Diagnostico",
    "software_update": "Actualizacion de software",
    "verification": "Verificacion funcional",
    "hardware_repair": "Reparacion de hardware",
}

REASON_UI_TO_DB = {value: key for key, value in REASON_DB_TO_UI.items()}

REASON_OPTIONS = [
    {"value": key, "label": label}
    for key, label in REASON_DB_TO_UI.items()
]

LAB_DOCUMENT_ROOT_ENV_NAME = "lab"
ALLOWED_EVIDENCE_EXTENSIONS = {"jpg", "jpeg", "png"}


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
