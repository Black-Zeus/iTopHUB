from __future__ import annotations

from pathlib import Path
from typing import Any

from modules.handover.storage_paths import (
    HANDOVER_DOCUMENT_ROOT,
    iter_handover_storage_directories,
)


def _coerce_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def remove_generated_handover_documents(document_id: int, handover_type: Any | None = None) -> None:
    for storage_directory in iter_handover_storage_directories(
        "documents",
        document_id,
        handover_type,
        include_legacy=True,
    ):
        if not storage_directory.exists():
            continue
        for file_path in storage_directory.iterdir():
            if file_path.is_file():
                file_path.unlink(missing_ok=True)


def remove_generated_handover_documents_by_names(
    document_id: int,
    stored_names: list[str],
    handover_type: Any | None = None,
) -> None:
    storage_directories = iter_handover_storage_directories(
        "documents",
        document_id,
        handover_type,
        include_legacy=True,
    )

    for stored_name in stored_names:
        safe_name = Path(_coerce_str(stored_name)).name
        if not safe_name:
            continue
        for storage_directory in storage_directories:
            (storage_directory / safe_name).unlink(missing_ok=True)
