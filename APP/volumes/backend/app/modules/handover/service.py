from __future__ import annotations

import json
import logging
from base64 import b64decode, b64encode
from datetime import datetime
from html import escape
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from core.config import settings
from integrations.itop_cmdb_connector import iTopCMDBConnector, iTopObject
from integrations.itop_runtime import get_itop_runtime_config
from infrastructure.job_manager import create_job
from modules.handover.document_templates import build_detail_document_number
from modules.handover.document_type_registry import (
    build_missing_document_type_error_message,
    resolve_required_document_type_id_for_handover_type,
)
from modules.handover.handover_types import (
    find_handover_type_definition,
    get_handover_type_definition,
    list_handover_type_options,
    resolve_handover_prefix,
    serialize_handover_type_catalog,
)
from modules.handover.payloads import (
    build_document_payload_from_detail as _build_document_payload_from_detail,
    build_item_payloads_from_detail as _build_item_payloads_from_detail,
    deserialize_additional_receivers as _deserialize_additional_receivers,
    deserialize_evidence_attachments as _deserialize_evidence_attachments,
    deserialize_generated_documents as _deserialize_generated_documents,
    normalize_additional_receivers as _normalize_additional_receivers,
    normalize_evidence_attachments as _normalize_evidence_attachments,
    normalize_evidence_document_type as _normalize_evidence_document_type,
    normalize_generated_at as _normalize_generated_at,
    normalize_generated_documents as _normalize_generated_documents,
    normalize_itop_ticket_summary as _normalize_itop_ticket_summary,
    normalize_optional_datetime as _normalize_optional_datetime,
    normalize_receiver as _normalize_receiver,
)
from modules.handover.pdf_pipeline import (
    remove_generated_handover_documents,
    remove_generated_handover_documents_by_names,
)
from modules.handover.repository import (
    fetch_handover_checklist_answer_rows,
    fetch_handover_document_row,
    fetch_handover_document_rows,
    fetch_handover_item_evidence_rows,
    fetch_handover_item_checklist_rows,
    fetch_handover_item_rows,
    fetch_handover_template_item_rows,
    fetch_handover_template_rows,
    get_next_handover_sequence,
    replace_handover_item_evidences,
    save_handover_document,
)
from modules.handover.shared import (
    DEFAULT_EVIDENCE_ALLOWED_EXTENSIONS,
    EVIDENCE_DOCUMENT_TYPE_TO_GENERATED_KIND,
    GENERATED_DOCUMENT_KINDS,
    INPUT_TYPE_DB_TO_UI,
    MAX_HANDOVER_DOCUMENT_FILES,
    STATUS_DB_TO_UI,
    STATUS_UI_TO_DB,
    coerce_str as _coerce_str,
    normalize_comparison_text as _normalize_comparison_text,
)
from modules.settings.service import (
    get_requirement_initial_status,
    get_settings_panel,
    is_requirement_ticket_enabled,
)
from modules.handover.storage_paths import (
    HANDOVER_DOCUMENT_ROOT,
    HANDOVER_EVIDENCE_ROOT,
    HANDOVER_ITEM_EVIDENCE_ROOT,
    build_handover_storage_directory,
    build_handover_storage_source,
    resolve_existing_handover_storage_directory,
    resolve_existing_handover_storage_file,
)


logger = logging.getLogger(__name__)


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


def _format_itop_ticket_description_html(value: Any) -> str:
    text = _coerce_str(value)
    if not text:
        return ""

    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    blocks: list[str] = []
    paragraph_lines: list[str] = []
    list_items: list[str] = []
    list_kind = ""

    def flush_paragraph() -> None:
        if not paragraph_lines:
            return
        blocks.append("<p>" + "<br/>".join(escape(line) for line in paragraph_lines) + "</p>")
        paragraph_lines.clear()

    def flush_list() -> None:
        nonlocal list_kind
        if not list_items or list_kind not in {"ul", "ol"}:
            list_items.clear()
            list_kind = ""
            return
        blocks.append(f"<{list_kind}>" + "".join(f"<li>{escape(item)}</li>" for item in list_items) + f"</{list_kind}>")
        list_items.clear()
        list_kind = ""

    for raw_line in lines:
        stripped = raw_line.strip()
        if not stripped:
            flush_paragraph()
            flush_list()
            continue

        candidate = raw_line.lstrip()
        next_list_kind = ""
        list_value = ""

        if candidate.startswith("* ") or candidate.startswith("- "):
            next_list_kind = "ul"
            list_value = candidate[2:].strip()
        else:
            dot_index = candidate.find(". ")
            if dot_index > 0 and candidate[:dot_index].isdigit():
                next_list_kind = "ol"
                list_value = candidate[dot_index + 2 :].strip()

        if next_list_kind and list_value:
            flush_paragraph()
            if list_kind and list_kind != next_list_kind:
                flush_list()
            list_kind = next_list_kind
            list_items.append(list_value)
            continue

        flush_list()
        paragraph_lines.append(stripped)

    flush_paragraph()
    flush_list()
    return "".join(blocks) or f"<p>{escape(text)}</p>"


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


def _remove_evidence_attachment_files(
    document_id: int,
    stored_names: list[str],
    *,
    handover_type: Any | None = None,
) -> None:
    storage_directories = [
        path
        for path in (
            resolve_existing_handover_storage_directory(
                "evidence",
                document_id,
                handover_type,
                include_legacy=True,
            ),
            build_handover_storage_directory("evidence", document_id, handover_type) if handover_type is not None else None,
        )
        if isinstance(path, Path)
    ]

    for stored_name in stored_names:
        safe_name = Path(_coerce_str(stored_name)).name
        if not safe_name:
            continue
        for storage_directory in storage_directories:
            (storage_directory / safe_name).unlink(missing_ok=True)


def _remove_item_evidence_files(
    document_id: int,
    stored_names: list[str],
    *,
    handover_type: Any | None = None,
) -> None:
    storage_directories = [
        path
        for path in (
            resolve_existing_handover_storage_directory(
                "item_evidence",
                document_id,
                handover_type,
                include_legacy=True,
            ),
            build_handover_storage_directory("item_evidence", document_id, handover_type) if handover_type is not None else None,
        )
        if isinstance(path, Path)
    ]

    for stored_name in stored_names:
        safe_name = Path(_coerce_str(stored_name)).name
        if not safe_name:
            continue
        for storage_directory in storage_directories:
            (storage_directory / safe_name).unlink(missing_ok=True)


def _normalize_item_evidence_entries(payload: Any, *, asset_label: str) -> list[dict[str, Any]]:
    if not payload:
        return []
    if not isinstance(payload, list):
        raise HTTPException(
            status_code=422,
            detail=f"Las evidencias del activo '{asset_label}' no tienen un formato valido.",
        )

    normalized: list[dict[str, Any]] = []
    for index, evidence in enumerate(payload, start=1):
        if not isinstance(evidence, dict):
            raise HTTPException(
                status_code=422,
                detail=f"Una evidencia del activo '{asset_label}' no tiene un formato valido.",
            )

        caption = _coerce_str(evidence.get("caption"))
        if not caption:
            raise HTTPException(
                status_code=422,
                detail=f"Cada imagen del activo '{asset_label}' debe incluir una glosa obligatoria.",
            )

        original_name = _sanitize_attachment_filename(
            evidence.get("originalName") or evidence.get("name") or evidence.get("storedName")
        )
        mime_type = _coerce_str(evidence.get("mimeType")).lower()
        file_extension = Path(original_name).suffix.lower().lstrip(".")
        if file_extension not in {"png", "jpg", "jpeg", "webp"}:
            raise HTTPException(
                status_code=422,
                detail=f"La evidencia {index} del activo '{asset_label}' debe ser una imagen PNG, JPG o WEBP.",
            )
        if mime_type and not mime_type.startswith("image/"):
            raise HTTPException(
                status_code=422,
                detail=f"La evidencia {index} del activo '{asset_label}' no corresponde a una imagen valida.",
            )

        content_base64 = _coerce_str(evidence.get("contentBase64"))
        stored_name = Path(_coerce_str(evidence.get("storedName"))).name
        source = _coerce_str(evidence.get("source"))
        if not content_base64 and not stored_name:
            raise HTTPException(
                status_code=422,
                detail=f"La evidencia {index} del activo '{asset_label}' no contiene archivo valido.",
            )

        file_size_raw = evidence.get("fileSize") if evidence.get("fileSize") not in (None, "") else evidence.get("size")
        try:
            file_size = int(file_size_raw) if file_size_raw not in (None, "") else None
        except (TypeError, ValueError):
            file_size = None

        normalized.append(
            {
                "original_name": original_name,
                "stored_name": stored_name,
                "mime_type": mime_type or None,
                "file_size": file_size,
                "caption": caption,
                "source": source,
                "content_base64": content_base64,
            }
        )
    return normalized


def _persist_handover_item_evidences(
    document_id: int,
    items: list[dict[str, Any]],
    *,
    previous_detail: dict[str, Any] | None = None,
    handover_type: Any | None = None,
) -> None:
    resolved_handover_type = (
        _coerce_str(handover_type)
        or
        _coerce_str((previous_detail or {}).get("handoverTypeCode"))
        or _coerce_str((previous_detail or {}).get("handoverType"))
        or "initial_assignment"
    )
    storage_directory = build_handover_storage_directory(
        "item_evidence",
        document_id,
        resolved_handover_type,
    )
    storage_directory.mkdir(parents=True, exist_ok=True)
    logger.info(
        "Usando directorio de evidencias por activo para acta %s (%s): %s",
        document_id,
        resolved_handover_type,
        storage_directory,
    )

    previous_stored_names = {
        Path(_coerce_str(evidence.get("storedName"))).name
        for item in (previous_detail or {}).get("items") or []
        for evidence in item.get("evidences") or []
        if Path(_coerce_str(evidence.get("storedName"))).name
    }
    next_stored_names: set[str] = set()
    pending_files: list[tuple[Path, Path]] = []
    created_paths: list[Path] = []
    moved_final_paths: list[Path] = []
    evidences_by_asset: dict[int, list[dict[str, Any]]] = {}

    try:
        for item in items:
            asset_id = int(item.get("asset_itop_id") or 0)
            if asset_id <= 0:
                continue
            evidence_rows: list[dict[str, Any]] = []
            for evidence_index, evidence in enumerate(item.get("evidences") or [], start=1):
                original_name = _sanitize_attachment_filename(evidence.get("original_name"))
                mime_type = _coerce_str(evidence.get("mime_type")) or "image/png"
                content_base64 = _coerce_str(evidence.get("content_base64"))
                stored_name = Path(_coerce_str(evidence.get("stored_name"))).name

                if content_base64:
                    try:
                        content = b64decode(content_base64, validate=True)
                    except Exception as exc:
                        raise HTTPException(
                            status_code=422,
                            detail=f"Una imagen del activo '{_coerce_str(item.get('asset_code')) or asset_id}' no tiene un base64 valido.",
                        ) from exc
                    if not content:
                        raise HTTPException(
                            status_code=422,
                            detail=f"Una imagen del activo '{_coerce_str(item.get('asset_code')) or asset_id}' no contiene datos validos.",
                        )
                    suffix = Path(original_name).suffix.lower() or ".png"
                    stored_name = f"asset_{asset_id}_{uuid4().hex}{suffix}"
                    temporary_path = storage_directory / f".upload_{uuid4().hex}{suffix}"
                    temporary_path.write_bytes(content)
                    created_paths.append(temporary_path)
                    pending_files.append((temporary_path, storage_directory / stored_name))
                    file_size = len(content)
                else:
                    if not stored_name:
                        raise HTTPException(
                            status_code=422,
                            detail=f"Una imagen del activo '{_coerce_str(item.get('asset_code')) or asset_id}' no tiene referencia almacenada.",
                        )
                    current_path = storage_directory / stored_name
                    if not current_path.exists():
                        raise HTTPException(
                            status_code=422,
                            detail=f"No fue posible recuperar la imagen '{original_name}' del activo '{_coerce_str(item.get('asset_code')) or asset_id}'.",
                        )
                    try:
                        file_size = int(evidence.get("file_size")) if evidence.get("file_size") is not None else current_path.stat().st_size
                    except (TypeError, ValueError, OSError):
                        file_size = None

                next_stored_names.add(stored_name)
                evidence_rows.append(
                    {
                        "original_name": original_name,
                        "stored_name": stored_name,
                        "mime_type": mime_type,
                        "file_size": file_size,
                        "caption": _coerce_str(evidence.get("caption")),
                        "source": build_handover_storage_source(
                            settings.env_name,
                            "item_evidence",
                            document_id,
                            resolved_handover_type,
                            stored_name,
                        ),
                    }
                )
            evidences_by_asset[asset_id] = evidence_rows

        for temporary_path, final_path in pending_files:
            temporary_path.replace(final_path)
            moved_final_paths.append(final_path)
        replace_handover_item_evidences(document_id, evidences_by_asset)
        _remove_item_evidence_files(
            document_id,
            sorted(previous_stored_names.difference(next_stored_names)),
            handover_type=resolved_handover_type,
        )
    except Exception as exc:
        for path in created_paths:
            try:
                if path.exists():
                    path.unlink()
            except OSError:
                continue
        for path in moved_final_paths:
            try:
                if path.exists():
                    path.unlink()
            except OSError:
                continue
        args = getattr(exc, "args", ()) or ()
        if args and args[0] == 1146 and "hub_handover_item_evidences" in str(args[-1]):
            raise HTTPException(
                status_code=500,
                detail="La base de datos aun no tiene habilitado el almacenamiento de evidencias por activo. Solicita aplicar la actualizacion del esquema Hub antes de continuar.",
            ) from exc
        raise


def _read_item_evidence_data_url(
    document_id: int,
    stored_name: str,
    mime_type: str,
    handover_type: Any | None = None,
) -> str:
    file_path = resolve_existing_handover_storage_file(
        "item_evidence",
        document_id,
        stored_name,
        handover_type=handover_type,
        include_legacy=True,
    )
    if file_path is None:
        return ""
    encoded = b64encode(file_path.read_bytes()).decode("ascii")
    return f"data:{_coerce_str(mime_type) or 'image/png'};base64,{encoded}"


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


def _resolve_handover_checklist_usage_types(type_definition: Any) -> tuple[str, ...]:
    code = _coerce_str(getattr(type_definition, "code", "")).lower()
    if code == "return":
        return ("return",)
    if code == "reassignment":
        return ("reassignment",)
    if code == "normalization":
        return ("normalization",)
    return ("delivery",)


def _resolve_handover_template_usage_type(row: dict[str, Any]) -> str:
    usage_type = _coerce_str(row.get("usage_type")).lower()
    if usage_type:
        return usage_type
    template_name = _coerce_str(row.get("name")).lower()
    if template_name.startswith("devolucion") or template_name.startswith("checklist devolucion"):
        return "return"
    if template_name.startswith("normalizacion") or template_name.startswith("checklist normalizacion"):
        return "normalization"
    return "delivery"


def _serialize_template_catalog(
    include_inactive: bool = False,
    *,
    usage_types: list[str] | tuple[str, ...] | None = None,
) -> list[dict[str, Any]]:
    template_rows = fetch_handover_template_rows(
        include_inactive=include_inactive,
        usage_types=list(usage_types or []),
    )
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
                "usageType": _resolve_handover_template_usage_type(row),
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
                "evidences": [
                    {
                        **evidence,
                        "dataUrl": _read_item_evidence_data_url(
                            int(detail.get("id") or 0),
                            _coerce_str(evidence.get("storedName")),
                            _coerce_str(evidence.get("mimeType")),
                            detail.get("handoverTypeCode") or detail.get("handoverType"),
                        ),
                    }
                    for evidence in item.get("evidences") or []
                ],
            }
        )

    return {
        **detail,
        "items": enriched_items,
    }


def get_handover_bootstrap(session_user: dict[str, Any], runtime_token: str) -> dict[str, Any]:
    docs_settings = get_settings_panel("docs")
    default_type = get_handover_type_definition("initial_assignment")
    allowed_evidence_extensions = sorted(_get_allowed_evidence_extensions())
    ticket_rules = _resolve_handover_ticket_rules(docs_settings)
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
            "handoverType": default_type.label,
            "handoverTypeCode": default_type.code,
            "prefix": resolve_handover_prefix(docs_settings, default_type.code),
        },
        "actions": {
            "allowEvidenceUpload": bool(docs_settings.get("allowEvidenceUpload", True)),
            "evidenceAllowedExtensions": allowed_evidence_extensions,
            "requirementTicketEnabled": ticket_rules["enabled"],
        },
        "statusOptions": [
            {"value": value, "label": label}
            for value, label in STATUS_DB_TO_UI.items()
        ],
        "typeOptions": list_handover_type_options(include_internal=False),
        "typeCatalog": serialize_handover_type_catalog(docs_settings, include_internal=True),
        "checklistTemplates": _serialize_template_catalog(include_inactive=False),
        "searchHints": {
            "minCharsPeople": 2,
            "minCharsAssets": 2,
        },
        "runtimeReady": bool(runtime_token),
        "itopIntegrationUrl": get_itop_runtime_config().get("integrationUrl") or "",
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
    if normalized_type:
        type_definition = find_handover_type_definition(normalized_type)
        if type_definition is None:
            raise HTTPException(status_code=422, detail="El tipo de acta no es valido.")
        normalized_type = type_definition.code

    rows = fetch_handover_document_rows(
        query=_coerce_str(query),
        status=normalized_status,
        handover_type=normalized_type,
    )

    def _build_list_item(row: dict[str, Any]) -> dict[str, Any]:
        type_definition = get_handover_type_definition(row["handover_type"])
        itop_ticket = _extract_itop_ticket_from_attachments(
            _deserialize_evidence_attachments(row.get("evidence_attachments"))
        )
        return {
            "id": int(row["id"]),
            "code": row["document_number"],
            "person": row["receiver_name"],
            "email": row.get("receiver_email") or "",
            "role": row.get("receiver_role") or "",
            "elaborador": row.get("owner_name") or "",
            "assetCount": int(row.get("asset_count") or 0),
            "asset": _format_asset_summary(
                _coerce_str(row.get("first_asset_name")),
                int(row.get("asset_count") or 0),
            ),
            "date": _serialize_date(row.get("generated_at")),
            "generatedAt": _serialize_datetime(row.get("generated_at")),
            "status": STATUS_DB_TO_UI.get(row["status"], row["status"]),
            "handoverType": type_definition.label,
            "handoverTypeCode": type_definition.code,
            "ownerName": row.get("owner_name") or "",
            "itopTicketNumber": itop_ticket.get("number") or "",
            "itopTicketId": itop_ticket.get("id") or "",
            "itopTicketClass": itop_ticket.get("className") or "",
        }

    items = [_build_list_item(row) for row in rows]
    return {"items": items}


def get_handover_document_detail(document_id: int) -> dict[str, Any]:
    document_row = fetch_handover_document_row(document_id)
    if not document_row:
        raise HTTPException(status_code=404, detail="Acta no encontrada.")

    type_definition = get_handover_type_definition(document_row["handover_type"])

    item_rows = fetch_handover_item_rows(document_id)
    checklist_rows = fetch_handover_item_checklist_rows(document_id)
    answer_rows = fetch_handover_checklist_answer_rows(document_id)
    evidence_rows = fetch_handover_item_evidence_rows(document_id)

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
            "evidences": [],
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

    for row in evidence_rows:
        item_id = int(row["item_id"])
        item_payload = items_by_id.get(item_id)
        if item_payload is None:
            continue
        item_payload["evidences"].append(
            {
                "id": int(row["id"]),
                "name": row.get("original_name") or row.get("stored_name") or "",
                "originalName": row.get("original_name") or "",
                "storedName": row.get("stored_name") or "",
                "mimeType": row.get("mime_type") or "",
                "fileSize": int(row.get("file_size") or 0) if row.get("file_size") not in (None, "") else None,
                "caption": row.get("caption") or "",
                "source": row.get("source") or "",
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
        "handoverType": type_definition.label,
        "handoverTypeCode": type_definition.code,
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


def _build_asset_label(item: dict[str, Any]) -> str:
    asset = item.get("asset") or {}
    return _coerce_str(asset.get("code")) or _coerce_str(asset.get("name")) or "sin codigo"


def _validate_required_checklists(
    items: list[dict[str, Any]],
    *,
    action_label: str,
) -> None:
    for item in items:
        asset_label = _build_asset_label(item)
        checklists = item.get("checklists") or []
        if not checklists:
            raise HTTPException(
                status_code=422,
                detail=f"Debes seleccionar al menos un checklist para el activo '{asset_label}' antes de {action_label}.",
            )

        for checklist in checklists:
            answers = checklist.get("answers") or []
            if not answers:
                raise HTTPException(
                    status_code=422,
                    detail=f"El checklist '{checklist.get('templateName') or checklist.get('template_name') or 'sin nombre'}' del activo '{asset_label}' no contiene checks para validar.",
                )

            incomplete_answer = next(
                (
                    answer for answer in answers if not _is_answer_completed(
                        {
                            "input_type": {
                                "Input text": "input_text",
                                "Text area": "text_area",
                                "Check": "check",
                                "Option / Radio": "radio",
                            }.get(answer.get("type"), answer.get("input_type") or "input_text"),
                            "response_value": (
                                "1"
                                if answer.get("type") == "Check" and bool(answer.get("value"))
                                else ("0" if answer.get("type") == "Check" else _coerce_str(answer.get("value")))
                            )
                            if "type" in answer
                            else answer.get("response_value"),
                        }
                    )
                ),
                None,
            )
            if incomplete_answer is not None:
                raise HTTPException(
                    status_code=422,
                    detail=f"Debes completar el check '{incomplete_answer['name'] if 'name' in incomplete_answer else incomplete_answer.get('check_name') or 'sin nombre'}' del activo '{asset_label}' antes de {action_label}.",
                )


def _validate_handover_items_ready_for_workflow(
    detail: dict[str, Any],
    *,
    action_label: str,
) -> None:
    items = detail.get("items") or []
    if not items:
        raise HTTPException(status_code=422, detail=f"Debes agregar al menos un activo antes de {action_label}.")
    _validate_required_checklists(items, action_label=action_label)


def _get_receiver_person_id(detail: dict[str, Any], *, action_label: str) -> int:
    receiver = detail.get("receiver") or {}
    try:
        person_id = int(receiver.get("id") or 0)
    except (TypeError, ValueError):
        person_id = 0
    if person_id <= 0:
        raise HTTPException(status_code=422, detail=f"Debes seleccionar el responsable antes de {action_label}.")
    return person_id


def _validate_handover_receiver_rules(
    detail: dict[str, Any],
    *,
    type_definition: Any,
    action_label: str,
) -> int:
    person_id = _get_receiver_person_id(detail, action_label=action_label)
    additional_receivers = detail.get("additionalReceivers") or []
    if not type_definition.allow_additional_receivers and additional_receivers:
        raise HTTPException(
            status_code=422,
            detail=f"El tipo de acta '{type_definition.label}' solo permite un responsable para {action_label}.",
        )
    return person_id


def _list_handover_contact_people(detail: dict[str, Any]) -> list[dict[str, Any]]:
    contacts: list[dict[str, Any]] = []
    seen_ids: set[int] = set()

    def append_person(raw_person: Any) -> None:
        if not isinstance(raw_person, dict):
            return
        try:
            person_id = int(raw_person.get("id") or 0)
        except (TypeError, ValueError):
            person_id = 0
        if person_id <= 0 or person_id in seen_ids:
            return
        seen_ids.add(person_id)
        contacts.append(
            {
                "id": person_id,
                "name": _coerce_str(raw_person.get("name")) or f"Persona {person_id}",
                "code": _coerce_str(raw_person.get("code")),
                "email": _coerce_str(raw_person.get("email")),
                "role": _coerce_str(raw_person.get("role")),
            }
        )

    append_person(detail.get("receiver") or {})
    for person in detail.get("additionalReceivers") or []:
        append_person(person)
    return contacts


def _get_handover_contact_ids(detail: dict[str, Any]) -> list[int]:
    return [int(person["id"]) for person in _list_handover_contact_people(detail)]


def _load_ci_assigned_contacts(connector: iTopCMDBConnector, asset_id: int) -> list[dict[str, Any]]:
    contacts = connector.oql(
        (
            "SELECT Contact AS c "
            "JOIN lnkContactToFunctionalCI AS l ON l.contact_id = c.id "
            f"WHERE l.functionalci_id = {asset_id}"
        ),
        output_fields="id,name,friendlyname,email,function,status,finalclass",
    )
    normalized: list[dict[str, Any]] = []
    for contact in contacts:
        contact_id = int(contact.id)
        contact_name = _coerce_str(contact.get("friendlyname") or contact.get("name") or f"Persona {contact_id}")
        if any(int(item.get("id") or 0) == contact_id for item in normalized):
            continue
        normalized.append({"id": contact_id, "name": contact_name})
    return normalized


def _is_ci_assigned_to_contact(connector: iTopCMDBConnector, asset_id: int, contact_id: int) -> bool:
    if asset_id <= 0 or contact_id <= 0:
        return False
    relation_rows = connector.get(
        "lnkContactToFunctionalCI",
        (
            "SELECT lnkContactToFunctionalCI "
            f"WHERE functionalci_id = {int(asset_id)} AND contact_id = {int(contact_id)}"
        ),
        output_fields="id",
    ).items()
    return bool(relation_rows)


def _requires_exclusive_receiver_assignment(type_definition: Any) -> bool:
    return _coerce_str(getattr(type_definition, "code", "")).lower() == "return"


def _validate_ci_receiver_alignment(
    connector: iTopCMDBConnector,
    *,
    asset_id: int,
    receiver_id: int,
    receiver_name: str,
    asset_label: str,
    type_definition: Any,
    action_label: str,
    stage: str,
) -> None:
    assigned_contacts = _load_ci_assigned_contacts(connector, asset_id)
    assigned_contact_ids = {
        int(contact.get("id") or 0)
        for contact in assigned_contacts
        if int(contact.get("id") or 0) > 0
    }

    if receiver_id not in assigned_contact_ids:
        if stage == "draft":
            raise HTTPException(
                status_code=422,
                detail=(
                    f"El activo '{asset_label}' no esta asociado a {receiver_name} en iTop "
                    "y no puede ser incluido en esta devolucion."
                ),
            )
        raise HTTPException(
            status_code=422,
            detail=f"El activo '{asset_label}' ya no esta asociado a {receiver_name} en iTop, por lo que no se puede {action_label}.",
        )

    if not _requires_exclusive_receiver_assignment(type_definition):
        return

    extra_contacts = [
        _coerce_str(contact.get("name")) or f"Persona {int(contact.get('id') or 0)}"
        for contact in assigned_contacts
        if int(contact.get("id") or 0) != receiver_id
    ]
    if not extra_contacts:
        return

    assigned_names = ", ".join([receiver_name, *extra_contacts])
    if stage == "draft":
        raise HTTPException(
            status_code=422,
            detail=(
                f"El activo '{asset_label}' esta asociado a mas de una persona en iTop ({assigned_names}) "
                "y no puede ser incluido en esta devolucion."
            ),
        )
    raise HTTPException(
        status_code=422,
        detail=(
            f"El activo '{asset_label}' esta asociado a mas de una persona en iTop ({assigned_names}), "
            f"por lo que no se puede {action_label}."
        ),
    )


def _validate_assets_match_receiver_assignment(
    detail: dict[str, Any],
    *,
    runtime_token: str,
    type_definition: Any,
    action_label: str,
) -> None:
    if getattr(type_definition, "asset_selection_mode", "stock_unassigned") != "assigned_to_receiver":
        return

    receiver_id = _validate_handover_receiver_rules(detail, type_definition=type_definition, action_label=action_label)
    receiver = detail.get("receiver") or {}
    receiver_name = _coerce_str(receiver.get("name")) or "el responsable seleccionado"
    connector = _build_itop_connector(runtime_token)
    try:
        for item in detail.get("items") or []:
            asset = item.get("asset") or {}
            try:
                asset_id = int(asset.get("id") or 0)
            except (TypeError, ValueError):
                asset_id = 0
            if asset_id <= 0:
                continue

            asset_label = _build_asset_label(item)
            _validate_ci_receiver_alignment(
                connector,
                asset_id=asset_id,
                receiver_id=receiver_id,
                receiver_name=receiver_name,
                asset_label=asset_label,
                type_definition=type_definition,
                action_label=action_label,
                stage="workflow",
            )
    finally:
        connector.close()


def _validate_draft_assets_ownership(
    payload: dict[str, Any],
    *,
    runtime_token: str,
    type_definition: Any,
) -> None:
    """
    Lightweight ownership check at draft save (create/update) time.

    Only runs when:
    - The handover type uses "assigned_to_receiver" mode (return, reassignment).
    - Both a receiver ID and at least one asset item are present in the payload.
    This prevents saving drafts with assets belonging to a different person
    without blocking partially-filled forms where receiver or items are missing.
    """
    if getattr(type_definition, "asset_selection_mode", "stock_unassigned") != "assigned_to_receiver":
        return

    receiver = payload.get("receiver") or {}
    try:
        receiver_id = int(receiver.get("id") or 0)
    except (TypeError, ValueError):
        receiver_id = 0

    items = payload.get("items") or []
    if not receiver_id or not items:
        return

    receiver_name = _coerce_str(receiver.get("name")) or "el responsable seleccionado"
    connector = _build_itop_connector(runtime_token)
    try:
        for item in items:
            asset = item.get("asset") or {}
            try:
                asset_id = int(asset.get("id") or 0)
            except (TypeError, ValueError):
                asset_id = 0
            if asset_id <= 0:
                continue
            asset_label = _build_asset_label(item)
            _validate_ci_receiver_alignment(
                connector,
                asset_id=asset_id,
                receiver_id=receiver_id,
                receiver_name=receiver_name,
                asset_label=asset_label,
                type_definition=type_definition,
                action_label="guardar el borrador",
                stage="draft",
            )
    finally:
        connector.close()


def _validate_generated_documents_ready_for_confirmation(detail: dict[str, Any]) -> None:
    generated_documents = detail.get("generatedDocuments") or []
    available_kinds = {
        _coerce_str(item.get("kind"))
        for item in generated_documents
        if _coerce_str(item.get("kind")) in GENERATED_DOCUMENT_KINDS and _coerce_str(item.get("storedName"))
    }
    missing_kinds = sorted(GENERATED_DOCUMENT_KINDS.difference(available_kinds))
    if missing_kinds:
        raise HTTPException(
            status_code=422,
            detail="Debes generar correctamente el PDF principal y el detalle antes de confirmar el acta.",
        )


def _resolve_handover_ticket_rules(docs_settings: dict[str, Any] | None = None) -> dict[str, Any]:
    resolved_settings = docs_settings if docs_settings is not None else get_settings_panel("docs")
    return {
        "enabled": is_requirement_ticket_enabled(resolved_settings),
        "initialStatus": get_requirement_initial_status(resolved_settings),
    }


def _build_template_catalog_by_id() -> dict[int, dict[str, Any]]:
    template_map: dict[int, dict[str, Any]] = {}
    for template in _serialize_template_catalog(include_inactive=True):
        template_map[int(template["id"])] = template
    return template_map


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
    missing_required_fields = [
        field_name
        for field_name in ("team_id", "agent_id")
        if not isinstance(assignment_fields.get(field_name), int) or assignment_fields.get(field_name, 0) <= 0
    ]
    if missing_required_fields:
        raise HTTPException(
            status_code=422,
            detail="La configuracion del ticket iTop exige dejarlo Asignado, por lo que debes indicar equipo y analista.",
        )

    try:
        response = connector.get(ticket_class, ticket_id, output_fields=ITOP_HANDOVER_TICKET_OUTPUT_FIELDS)
    except Exception:
        return None

    item = response.first()
    if item is None:
        return None

    status = _coerce_str(item.get("status")).lower()
    missing_assignment = any(not _normalize_ticket_id(item.get(field_name)) for field_name in assignment_fields)
    if status == "assigned" and not missing_assignment:
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
            assigned_item = stimulus_response.first()
            if _coerce_str(assigned_item.get("status")).lower() == "assigned":
                return assigned_item

    refresh_response = connector.get(ticket_class, ticket_id, output_fields=ITOP_HANDOVER_TICKET_OUTPUT_FIELDS)
    refreshed_item = refresh_response.first()
    if refreshed_item is None:
        return None
    if _coerce_str(refreshed_item.get("status")).lower() != "assigned":
        raise HTTPException(status_code=502, detail="No fue posible dejar el ticket iTop en estado Asignado.")
    return refreshed_item


def _create_itop_handover_ticket(
    current_detail: dict[str, Any],
    ticket_payload: dict[str, Any] | None,
    runtime_token: str,
    *,
    contact_ids: list[int] | None = None,
) -> dict[str, Any]:
    payload = _normalize_itop_ticket_summary(ticket_payload)
    if not payload:
        return {}

    requester_id = _normalize_ticket_id(payload.get("requesterId"))
    group_id = _normalize_ticket_id(payload.get("groupId"))
    analyst_id = _normalize_ticket_id(payload.get("analystId"))
    subject = _coerce_str(payload.get("subject"))
    description = _coerce_str(payload.get("description"))
    description_html = _format_itop_ticket_description_html(description)
    if not requester_id or not subject or not description:
        raise HTTPException(status_code=422, detail="El ticket iTop requiere solicitante, asunto y descripcion.")

    docs_settings = get_settings_panel("docs")
    ticket_rules = _resolve_handover_ticket_rules(docs_settings)
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
            "description": description_html,
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

        if ticket_rules["initialStatus"] == "assigned":
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

        resolved_contact_ids = (
            sorted({int(contact_id) for contact_id in (contact_ids or []) if int(contact_id) > 0})
            if contact_ids is not None
            else _get_handover_contact_ids(current_detail)
        )
        if resolved_contact_ids:
            contact_link_response = connector.link_contacts_to_ticket(ticket_class, item.id, resolved_contact_ids)
            if not contact_link_response.ok:
                raise HTTPException(
                    status_code=502,
                    detail=f"No fue posible registrar todos los contactos del acta en el ticket iTop: {contact_link_response.message}",
                )
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


def _get_return_asset_target_status() -> str:
    cmdb_settings = get_settings_panel("cmdb")
    configured_status = _coerce_str(cmdb_settings.get("handoverReturnAssetStatus")).lower()
    return configured_status or "stock"


def _apply_itop_handover_assignment(
    current_detail: dict[str, Any],
    runtime_token: str,
    ticket_id: str = "",
) -> list[dict[str, Any]]:
    type_definition = get_handover_type_definition(
        current_detail.get("handoverTypeCode") or current_detail.get("handoverType")
    )
    person_id = _validate_handover_receiver_rules(
        current_detail,
        type_definition=type_definition,
        action_label="sincronizar el acta",
    )
    target_status = _get_return_asset_target_status() if type_definition.evidence_sync_mode == "return_to_inventory" else "production"

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
                "contactUnlinked": False,
                "statusUpdated": False,
                "statusUpdateError": "",
                "ticketLinked": False,
            }

            if type_definition.evidence_sync_mode == "assign_to_receiver":
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
                    target_status,
                    comment=f"Asignado desde acta {current_detail.get('documentNumber') or ''}".strip(),
                )
                if status_response.ok:
                    asset_result["statusUpdated"] = True
                else:
                    asset_result["statusUpdateError"] = status_response.message
            elif type_definition.evidence_sync_mode == "return_to_inventory":
                unlink_response = connector.unlink_contact_from_ci(asset_id, person_id)
                if not unlink_response.ok:
                    raise HTTPException(status_code=502, detail=f"No fue posible desvincular el EC {asset_id} del responsable: {unlink_response.message}")
                asset_result["contactUnlinked"] = True

                status_response = connector.update_ci_status(
                    asset_class,
                    asset_id,
                    target_status,
                    comment=f"Devuelto desde acta {current_detail.get('documentNumber') or ''}".strip(),
                )
                if not status_response.ok:
                    raise HTTPException(
                        status_code=502,
                        detail=f"No fue posible dejar el EC {asset_id} en estado '{target_status}': {status_response.message}",
                    )
                asset_result["statusUpdated"] = True

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
    handover_type: Any,
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
                "path": resolve_existing_handover_storage_file(
                    "documents",
                    document_id,
                    stored_name,
                    handover_type=handover_type,
                    include_legacy=True,
                )
                or (build_handover_storage_directory("documents", document_id, handover_type) / stored_name),
            }
        )

    for attachment in evidence_attachments:
        stored_name = Path(_coerce_str(attachment.get("storedName"))).name
        if not stored_name:
            continue
        pending_file = pending_by_name.get(stored_name)
        file_path = (
            pending_file.get("temporary")
            if pending_file
            else (
                resolve_existing_handover_storage_file(
                    "evidence",
                    document_id,
                    stored_name,
                    handover_type=handover_type,
                    include_legacy=True,
                )
                or (build_handover_storage_directory("evidence", document_id, handover_type) / stored_name)
            )
        )
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


def _resolve_itop_document_type_id(
    connector: iTopCMDBConnector,
    type_definition,
) -> str:
    docs_settings = get_settings_panel("docs")
    try:
        return resolve_required_document_type_id_for_handover_type(connector, docs_settings, type_definition)
    except ValueError:
        configured_document_type_id = _normalize_ticket_id(
            docs_settings.get("handoverDocumentTypeId")
            or docs_settings.get("itopAssetDocumentTypeId")
            or docs_settings.get("documentTypeId")
        )
        if configured_document_type_id:
            response = connector.get(
                "DocumentType",
                f"SELECT DocumentType WHERE id = {int(configured_document_type_id)}",
                output_fields="id,name",
            )
            item = response.first()
            if item is not None:
                return str(item.id)

    raise HTTPException(
        status_code=422,
        detail=build_missing_document_type_error_message(docs_settings, type_definition),
    )


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
    escaped_document_name = document_name.replace("\\", "\\\\").replace("'", "\\'")
    existing_link_response = connector.get(
        "lnkDocumentToFunctionalCI",
        (
            "SELECT lnkDocumentToFunctionalCI "
            f"WHERE functionalci_id = {target_id} AND document_name = '{escaped_document_name}'"
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
    type_definition = get_handover_type_definition(
        current_detail.get("handoverTypeCode") or current_detail.get("handoverType")
    )

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

        document_type_id = _resolve_itop_document_type_id(connector, type_definition)
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


def _normalize_items(
    payload_items: list[dict[str, Any]],
    template_catalog: dict[int, dict[str, Any]],
    *,
    type_definition,
) -> list[dict[str, Any]]:
    if not isinstance(payload_items, list) or not payload_items:
        raise HTTPException(status_code=422, detail="Debes agregar al menos un activo al acta.")

    normalized_items: list[dict[str, Any]] = []
    seen_asset_ids: set[int] = set()
    expected_usage_types = set(_resolve_handover_checklist_usage_types(type_definition))

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

        if type_definition.requires_stock_assignment:
            restriction_message = _get_asset_assignment_restriction(asset)
            if restriction_message:
                raise HTTPException(status_code=422, detail=restriction_message)

        seen_asset_ids.add(parsed_asset_id)

        normalized_evidences = _normalize_item_evidence_entries(
            item.get("evidences") or [],
            asset_label=asset_code or asset_name or str(parsed_asset_id),
        )
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
            if expected_usage_types and _coerce_str(template.get("usageType")) not in expected_usage_types:
                raise HTTPException(
                    status_code=422,
                    detail=f"El checklist '{template['name']}' no corresponde al tipo de acta '{type_definition.label}'.",
                )
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
                "evidences": normalized_evidences,
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
    raw_handover_type = payload.get("handoverTypeCode") or payload.get("handoverType") or "initial_assignment"
    reason = _coerce_str(payload.get("reason"))
    notes = _coerce_str(payload.get("notes"))

    if status_ui not in STATUS_UI_TO_DB:
        raise HTTPException(status_code=422, detail="El estado del acta no es valido.")
    type_definition = find_handover_type_definition(raw_handover_type)
    if type_definition is None:
        raise HTTPException(status_code=422, detail="El tipo de acta no es valido.")

    template_catalog = _build_template_catalog_by_id()
    receiver = _normalize_receiver(payload.get("receiver") or {})
    additional_receivers = _normalize_additional_receivers(payload.get("additionalReceivers") or [], receiver["receiver_person_id"])
    generated_documents = _normalize_generated_documents(payload.get("generatedDocuments") or [])
    evidence_attachments = _normalize_evidence_attachments(payload.get("evidenceAttachments") or [])
    items = _normalize_items(payload.get("items") or [], template_catalog, type_definition=type_definition)

    if not type_definition.allow_additional_receivers and additional_receivers:
        raise HTTPException(
            status_code=422,
            detail=f"El tipo de acta '{type_definition.label}' solo permite un responsable.",
        )

    if not reason:
        raise HTTPException(status_code=422, detail=f"Debes indicar el {type_definition.main_reason_label.lower()}.")
    if status_ui in {"Emitida", "Confirmada"}:
        _validate_required_checklists(
            [
                {
                    "asset": {
                        "code": item.get("asset_code"),
                        "name": item.get("asset_name"),
                    },
                    "checklists": item.get("checklists") or [],
                }
                for item in items
            ],
            action_label="guardar el acta en ese estado",
        )

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
        "handover_type": type_definition.code,
        "reason": reason,
        "notes": notes or None,
        "additional_receivers": additional_receivers or None,
        "generated_documents": generated_documents or None,
        "evidence_attachments": evidence_attachments or None,
        **receiver,
    }
    return document_payload, items


def _generate_document_number(generated_at: datetime, handover_type: Any) -> str:
    docs_settings = get_settings_panel("docs")
    prefix = resolve_handover_prefix(docs_settings, handover_type)
    year = generated_at.year
    sequence = get_next_handover_sequence(prefix, year)
    return f"{prefix}-{year}-{sequence:04d}"


def _resolve_handover_service(handover_type: Any):
    from modules.handover.services import resolve_handover_service

    return resolve_handover_service(handover_type)


def create_handover_document(
    payload: dict[str, Any],
    session_user: dict[str, Any],
    runtime_token: str | None = None,
) -> dict[str, Any]:
    handover_type = payload.get("handoverTypeCode") or payload.get("handoverType") or "initial_assignment"
    return _resolve_handover_service(handover_type).create_handover_document(
        payload,
        session_user,
        runtime_token=runtime_token,
    )


def update_handover_document(
    document_id: int,
    payload: dict[str, Any],
    session_user: dict[str, Any],
    runtime_token: str | None = None,
) -> dict[str, Any]:
    existing_document = fetch_handover_document_row(document_id)
    if not existing_document:
        raise HTTPException(status_code=404, detail="Acta no encontrada.")

    handover_type = (
        payload.get("handoverTypeCode") or payload.get("handoverType")
        or existing_document.get("handover_type_code") or existing_document.get("handover_type")
    )
    return _resolve_handover_service(handover_type).update_handover_document(
        document_id,
        payload,
        session_user,
        runtime_token=runtime_token,
    )


def emit_handover_document(document_id: int, session_user: dict[str, Any], session_id: str) -> dict[str, Any]:
    existing_document = fetch_handover_document_row(document_id)
    if not existing_document:
        raise HTTPException(status_code=404, detail="Acta no encontrada.")

    handover_type = existing_document.get("handover_type_code") or existing_document.get("handover_type")
    return _resolve_handover_service(handover_type).emit_handover_document(
        document_id,
        session_user,
        session_id,
    )


def rollback_handover_document(document_id: int, session_user: dict[str, Any]) -> dict[str, Any]:
    existing_document = fetch_handover_document_row(document_id)
    if not existing_document:
        raise HTTPException(status_code=404, detail="Acta no encontrada.")

    handover_type = existing_document.get("handover_type_code") or existing_document.get("handover_type")
    return _resolve_handover_service(handover_type).rollback_handover_document(document_id, session_user)


def attach_handover_document_evidence(
    document_id: int,
    attachments: list[dict[str, Any]],
    session_user: dict[str, Any],
    runtime_token: str,
    ticket_payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    existing_document = fetch_handover_document_row(document_id)
    if not existing_document:
        raise HTTPException(status_code=404, detail="Acta no encontrada.")

    handover_type = existing_document.get("handover_type_code") or existing_document.get("handover_type")
    return _resolve_handover_service(handover_type).confirm_handover_document(
        document_id,
        attachments,
        session_user,
        runtime_token,
        ticket_payload=ticket_payload,
    )
