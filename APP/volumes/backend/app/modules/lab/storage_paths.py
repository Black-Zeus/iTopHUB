from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from modules.lab.shared import coerce_str


LAB_DOCUMENT_ROOT = Path("/app/data/lab_documents")
LAB_EVIDENCE_ROOT = Path("/app/data/lab_evidence")

_SAFE_NAME_PATTERN = re.compile(r"^[a-z0-9_.\-]+$", re.IGNORECASE)


def build_lab_document_directory(record_id: int) -> Path:
    return LAB_DOCUMENT_ROOT / f"record_{int(record_id)}"


def build_lab_evidence_directory(record_id: int) -> Path:
    return LAB_EVIDENCE_ROOT / f"record_{int(record_id)}"


def resolve_existing_lab_document(record_id: int, stored_name: str) -> Path | None:
    safe_name = Path(coerce_str(stored_name)).name
    if not safe_name:
        return None
    candidate = build_lab_document_directory(record_id) / safe_name
    return candidate if candidate.exists() else None


def resolve_existing_lab_evidence(record_id: int, stored_name: str) -> Path | None:
    safe_name = Path(coerce_str(stored_name)).name
    if not safe_name:
        return None
    candidate = build_lab_evidence_directory(record_id) / safe_name
    return candidate if candidate.exists() else None
