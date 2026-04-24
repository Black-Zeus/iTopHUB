from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from modules.handover.handover_types import get_handover_type_definition, list_handover_type_definitions


logger = logging.getLogger(__name__)

HANDOVER_DOCUMENT_ROOT = Path("/app/data/handover_documents")
HANDOVER_EVIDENCE_ROOT = Path("/app/data/handover_evidence")
HANDOVER_ITEM_EVIDENCE_ROOT = Path("/app/data/handover_item_evidence")

_ROOTS_BY_KIND = {
    "documents": HANDOVER_DOCUMENT_ROOT,
    "evidence": HANDOVER_EVIDENCE_ROOT,
    "item_evidence": HANDOVER_ITEM_EVIDENCE_ROOT,
}
_SAFE_SEGMENT_PATTERN = re.compile(r"^[a-z0-9_]+$")


def _coerce_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _normalize_kind(kind: str) -> str:
    normalized = _coerce_str(kind).lower()
    if normalized not in _ROOTS_BY_KIND:
        raise ValueError(f"Storage kind '{kind}' no es valido.")
    return normalized


def resolve_handover_storage_type_segment(handover_type: Any) -> str:
    definition = get_handover_type_definition(handover_type)
    segment = _coerce_str(definition.code).lower()
    if not _SAFE_SEGMENT_PATTERN.match(segment):
        raise ValueError(f"El tipo de acta '{segment}' no es seguro para formar rutas.")
    return segment


def get_handover_storage_root(kind: str) -> Path:
    return _ROOTS_BY_KIND[_normalize_kind(kind)]


def build_handover_storage_directory(kind: str, document_id: int, handover_type: Any) -> Path:
    normalized_kind = _normalize_kind(kind)
    type_segment = resolve_handover_storage_type_segment(handover_type)
    return get_handover_storage_root(normalized_kind) / type_segment / f"document_{int(document_id)}"


def build_legacy_handover_storage_directory(kind: str, document_id: int) -> Path:
    normalized_kind = _normalize_kind(kind)
    return get_handover_storage_root(normalized_kind) / f"document_{int(document_id)}"


def iter_handover_storage_directories(
    kind: str,
    document_id: int,
    handover_type: Any | None = None,
    *,
    include_legacy: bool = True,
) -> list[Path]:
    normalized_kind = _normalize_kind(kind)
    candidates: list[Path] = []
    seen_paths: set[str] = set()

    def append_candidate(path: Path) -> None:
        key = str(path)
        if key in seen_paths:
            return
        seen_paths.add(key)
        candidates.append(path)

    if handover_type is not None:
        append_candidate(build_handover_storage_directory(normalized_kind, document_id, handover_type))
    else:
        for definition in list_handover_type_definitions(include_internal=True):
            append_candidate(build_handover_storage_directory(normalized_kind, document_id, definition.code))

    if include_legacy:
        append_candidate(build_legacy_handover_storage_directory(normalized_kind, document_id))

    return candidates


def resolve_existing_handover_storage_directory(
    kind: str,
    document_id: int,
    handover_type: Any | None = None,
    *,
    include_legacy: bool = True,
) -> Path:
    candidates = iter_handover_storage_directories(
        kind,
        document_id,
        handover_type,
        include_legacy=include_legacy,
    )
    for index, candidate in enumerate(candidates):
        if candidate.exists():
            logger.info(
                "Ruta de handover resuelta para %s %s: %s%s",
                _normalize_kind(kind),
                document_id,
                candidate,
                " (legacy)" if include_legacy and index == len(candidates) - 1 else "",
            )
            return candidate

    selected = candidates[0]
    logger.info("Ruta primaria de handover para %s %s: %s", _normalize_kind(kind), document_id, selected)
    return selected


def resolve_existing_handover_storage_file(
    kind: str,
    document_id: int,
    stored_name: str,
    handover_type: Any | None = None,
    *,
    include_legacy: bool = True,
) -> Path | None:
    safe_name = Path(_coerce_str(stored_name)).name
    if not safe_name:
        return None

    for candidate_directory in iter_handover_storage_directories(
        kind,
        document_id,
        handover_type,
        include_legacy=include_legacy,
    ):
        candidate = candidate_directory / safe_name
        if candidate.exists():
            logger.info(
                "Archivo de handover resuelto para %s %s: %s",
                _normalize_kind(kind),
                document_id,
                candidate,
            )
            return candidate
    return None


def build_handover_storage_source(
    env_name: str,
    kind: str,
    document_id: int,
    handover_type: Any,
    stored_name: str,
) -> str:
    safe_name = Path(_coerce_str(stored_name)).name
    type_segment = resolve_handover_storage_type_segment(handover_type)
    root_name = get_handover_storage_root(kind).name
    return f"{_coerce_str(env_name)}/{root_name}/{type_segment}/document_{int(document_id)}/{safe_name}"
