from __future__ import annotations

from typing import Any
import unicodedata

from modules.handover.handover_types import HANDOVER_TYPE_DEFINITIONS


STATUS_DB_TO_UI = {
    "draft": "En creacion",
    "issued": "Emitida",
    "confirmed": "Confirmada",
    "cancelled": "Anulada",
}

STATUS_UI_TO_DB = {value: key for key, value in STATUS_DB_TO_UI.items()}

TYPE_DB_TO_UI = {code: definition.label for code, definition in HANDOVER_TYPE_DEFINITIONS.items()}

TYPE_UI_TO_DB = {value: key for key, value in TYPE_DB_TO_UI.items()}

SECONDARY_RECEIVER_ROLE_ALIASES = {
    "Apoyo": "Respaldo operativo",
    "Origen": "Responsable origen",
}

SECONDARY_RECEIVER_ROLE_OPTIONS = {
    "Contraturno",
    "Referente de area",
    "Respaldo operativo",
    "Responsable origen",
    "Testigo",
}

INPUT_TYPE_DB_TO_UI = {
    "input_text": "Input text",
    "text_area": "Text area",
    "check": "Check",
    "radio": "Option / Radio",
}

INPUT_TYPE_UI_TO_DB = {value: key for key, value in INPUT_TYPE_DB_TO_UI.items()}

DEFAULT_EVIDENCE_ALLOWED_EXTENSIONS = {"pdf", "doc", "docx"}
GENERATED_DOCUMENT_KINDS = {"main", "detail"}
MAX_HANDOVER_DOCUMENT_FILES = 2
EVIDENCE_DOCUMENT_TYPE_TO_GENERATED_KIND = {
    "acta": "main",
    "detalle": "detail",
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
