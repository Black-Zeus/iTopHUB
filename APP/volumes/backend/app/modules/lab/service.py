from __future__ import annotations

import logging
import mimetypes
from base64 import b64decode
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

import requests
from fastapi import HTTPException

from core.config import settings
from modules.checklists.service import list_checklists_payload
from modules.lab.document_templates import build_lab_entry_html, build_lab_exit_html, build_lab_processing_html
from modules.lab.repository import (
    fetch_lab_record_row,
    fetch_lab_record_rows,
    get_next_lab_sequence,
    save_lab_record,
)
from modules.lab.shared import (
    ALLOWED_EVIDENCE_EXTENSIONS,
    REASON_DB_TO_UI,
    REASON_OPTIONS,
    STATUS_DB_TO_UI,
    STATUS_UI_TO_DB,
    coerce_str,
)
from modules.lab.storage_paths import (
    LAB_DOCUMENT_ROOT,
    LAB_EVIDENCE_ROOT,
    build_lab_document_directory,
    build_lab_evidence_directory,
    resolve_existing_lab_document,
    resolve_existing_lab_evidence,
)


logger = logging.getLogger(__name__)


def _coerce_str(value: Any, default: str = "") -> str:
    return coerce_str(value, default)


def _generate_document_number(year: int) -> str:
    seq = get_next_lab_sequence(year)
    return f"LAB-{year}-{seq:04d}"


def _render_lab_pdf_bytes(html: str, filename: str | None = None) -> bytes:
    headers = {}
    if settings.internal_api_secret:
        headers["X-Internal-Secret"] = settings.internal_api_secret

    try:
        response = requests.post(
            f"{settings.pdf_worker_url.rstrip('/')}/internal/render/html-to-pdf",
            json={"html": html, "filename": filename},
            headers=headers,
            timeout=120,
        )
    except requests.exceptions.Timeout as exc:
        raise HTTPException(status_code=504, detail="El servicio PDF tardó demasiado en responder.") from exc
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"No fue posible conectar con pdf-worker: {exc}") from exc

    if response.status_code >= 400:
        error_text = response.text.strip()
        detail = f"pdf-worker respondió con error {response.status_code}: {error_text[:240]}" if error_text else f"pdf-worker respondió con error {response.status_code}."
        raise HTTPException(status_code=502, detail=detail)
    if not response.content:
        raise HTTPException(status_code=502, detail="pdf-worker no devolvió contenido PDF.")
    return response.content


def _serialize_record_for_response(row: dict[str, Any]) -> dict[str, Any]:
    status_db = _coerce_str(row.get("status"), "draft")
    reason_db = _coerce_str(row.get("reason"), "maintenance")
    entry_date_raw = row.get("entry_date")
    exit_date_raw = row.get("exit_date")

    def _fmt_date(v: Any) -> str:
        if v is None:
            return ""
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return _coerce_str(v)

    return {
        "id": row.get("id"),
        "code": _coerce_str(row.get("document_number")),
        "reason": reason_db,
        "reasonLabel": REASON_DB_TO_UI.get(reason_db, reason_db),
        "status": STATUS_DB_TO_UI.get(status_db, status_db),
        "assetItopId": _coerce_str(row.get("asset_itop_id")),
        "assetCode": _coerce_str(row.get("asset_code")),
        "assetName": _coerce_str(row.get("asset_name")),
        "assetClass": _coerce_str(row.get("asset_class")),
        "assetSerial": _coerce_str(row.get("asset_serial")),
        "assetOrganization": _coerce_str(row.get("asset_organization")),
        "assetLocation": _coerce_str(row.get("asset_location")),
        "ownerUserId": row.get("owner_user_id"),
        "ownerName": _coerce_str(row.get("owner_name")),
        "entryDate": _fmt_date(entry_date_raw),
        "entryObservations": _coerce_str(row.get("entry_observations")),
        "entryEvidences": row.get("entry_evidences") or [],
        "entryGeneratedDocument": row.get("entry_generated_document"),
        "processingDate": _fmt_date(row.get("processing_date")),
        "processingObservations": _coerce_str(row.get("processing_observations")),
        "processingEvidences": row.get("processing_evidences") or [],
        "processingGeneratedDocument": row.get("processing_generated_document"),
        "processingChecklists": row.get("processing_checklists") or [],
        "exitDate": _fmt_date(exit_date_raw),
        "exitObservations": _coerce_str(row.get("exit_observations")),
        "workPerformed": _coerce_str(row.get("work_performed")),
        "exitEvidences": row.get("exit_evidences") or [],
        "exitGeneratedDocument": row.get("exit_generated_document"),
        "markedObsolete": bool(row.get("marked_obsolete")),
        "obsoleteNotes": _coerce_str(row.get("obsolete_notes")),
        "normalizationActCode": _coerce_str(row.get("normalization_act_code")),
        "hasEntryPhase": bool(row.get("entry_generated_document")),
        "hasProcessingPhase": bool(row.get("processing_generated_document")),
        "hasExitPhase": bool(row.get("exit_generated_document")),
    }


def get_lab_bootstrap(session_user: dict[str, Any]) -> dict[str, Any]:
    checklists_data = list_checklists_payload()
    lab_checklist_templates = checklists_data["itemsByModule"].get("lab", [])
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
        "checklistTemplates": lab_checklist_templates,
    }


def list_lab_records(
    query: str = "",
    status: str = "",
    reason: str = "",
) -> dict[str, Any]:
    rows = fetch_lab_record_rows(query=query, status=status, reason=reason)
    items = [_serialize_record_for_response(row) for row in rows]
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
    reason_db = _coerce_str(payload.get("reason"), "maintenance")

    record = {
        "document_number": document_number,
        "reason": reason_db,
        "status": "draft",
        "asset_itop_id": _coerce_str(asset.get("id") or asset.get("itopId")),
        "asset_code": _coerce_str(asset.get("code")),
        "asset_name": _coerce_str(asset.get("name")),
        "asset_class": _coerce_str(asset.get("className")),
        "asset_serial": _coerce_str(asset.get("serial")),
        "asset_organization": _coerce_str(asset.get("organization")),
        "asset_location": _coerce_str(asset.get("location")),
        "owner_user_id": session_user.get("id"),
        "owner_name": _coerce_str(session_user.get("name") or session_user.get("username")),
        "entry_date": _coerce_str(payload.get("entryDate")) or None,
        "entry_observations": _coerce_str(payload.get("entryObservations")),
        "entry_evidences": payload.get("entryEvidences") or [],
        "entry_generated_document": None,
        "processing_date": None,
        "processing_observations": "",
        "processing_evidences": [],
        "processing_generated_document": None,
        "processing_checklists": [],
        "exit_date": None,
        "exit_observations": "",
        "work_performed": "",
        "exit_evidences": [],
        "exit_generated_document": None,
        "marked_obsolete": False,
        "obsolete_notes": "",
        "normalization_act_code": "",
    }

    record_id = save_lab_record(None, record)
    row = fetch_lab_record_row(record_id)
    return _serialize_record_for_response(row)


def update_lab_record(record_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    existing = fetch_lab_record_row(record_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Acta de laboratorio #{record_id} no encontrada.")

    asset = payload.get("asset") or {}
    reason_db = _coerce_str(payload.get("reason") or existing.get("reason"), "maintenance")

    # Determine status based on phase completion
    current_status = _coerce_str(existing.get("status"), "draft")
    new_status_ui = _coerce_str(payload.get("status"))
    new_status_db = STATUS_UI_TO_DB.get(new_status_ui, current_status)

    marked_obsolete = bool(payload.get("markedObsolete", existing.get("marked_obsolete", False)))

    record = {
        "reason": reason_db,
        "status": new_status_db,
        "asset_itop_id": _coerce_str(asset.get("id") or asset.get("itopId")) or _coerce_str(existing.get("asset_itop_id")),
        "asset_code": _coerce_str(asset.get("code")) or _coerce_str(existing.get("asset_code")),
        "asset_name": _coerce_str(asset.get("name")) or _coerce_str(existing.get("asset_name")),
        "asset_class": _coerce_str(asset.get("className")) or _coerce_str(existing.get("asset_class")),
        "asset_serial": _coerce_str(asset.get("serial")) or _coerce_str(existing.get("asset_serial")),
        "asset_organization": _coerce_str(asset.get("organization")) or _coerce_str(existing.get("asset_organization")),
        "asset_location": _coerce_str(asset.get("location")) or _coerce_str(existing.get("asset_location")),
        "owner_user_id": existing.get("owner_user_id"),
        "owner_name": _coerce_str(existing.get("owner_name")),
        "entry_date": _coerce_str(payload.get("entryDate")) or (existing.get("entry_date").isoformat() if existing.get("entry_date") else None),
        "entry_observations": _coerce_str(payload.get("entryObservations")) if "entryObservations" in payload else _coerce_str(existing.get("entry_observations")),
        "entry_evidences": payload.get("entryEvidences") if "entryEvidences" in payload else existing.get("entry_evidences") or [],
        "entry_generated_document": payload.get("entryGeneratedDocument") if "entryGeneratedDocument" in payload else existing.get("entry_generated_document"),
        "processing_date": _coerce_str(payload.get("processingDate")) or (existing.get("processing_date").isoformat() if existing.get("processing_date") else None),
        "processing_observations": _coerce_str(payload.get("processingObservations")) if "processingObservations" in payload else _coerce_str(existing.get("processing_observations")),
        "processing_evidences": payload.get("processingEvidences") if "processingEvidences" in payload else existing.get("processing_evidences") or [],
        "processing_generated_document": payload.get("processingGeneratedDocument") if "processingGeneratedDocument" in payload else existing.get("processing_generated_document"),
        "processing_checklists": payload.get("processingChecklists") if "processingChecklists" in payload else existing.get("processing_checklists") or [],
        "exit_date": _coerce_str(payload.get("exitDate")) or (existing.get("exit_date").isoformat() if existing.get("exit_date") else None),
        "exit_observations": _coerce_str(payload.get("exitObservations")) if "exitObservations" in payload else _coerce_str(existing.get("exit_observations")),
        "work_performed": _coerce_str(payload.get("workPerformed")) if "workPerformed" in payload else _coerce_str(existing.get("work_performed")),
        "exit_evidences": payload.get("exitEvidences") if "exitEvidences" in payload else existing.get("exit_evidences") or [],
        "exit_generated_document": payload.get("exitGeneratedDocument") if "exitGeneratedDocument" in payload else existing.get("exit_generated_document"),
        "marked_obsolete": marked_obsolete,
        "obsolete_notes": _coerce_str(payload.get("obsoleteNotes")) if "obsoleteNotes" in payload else _coerce_str(existing.get("obsolete_notes")),
        "normalization_act_code": _coerce_str(payload.get("normalizationActCode")) if "normalizationActCode" in payload else _coerce_str(existing.get("normalization_act_code")),
    }

    # Delete evidence files that were removed
    for frontend_key, db_key in [
        ("entryEvidences", "entry_evidences"),
        ("processingEvidences", "processing_evidences"),
        ("exitEvidences", "exit_evidences"),
    ]:
        if frontend_key not in payload:
            continue
        new_ev_list = payload[frontend_key] or []
        old_ev_list = existing.get(db_key) or []
        new_names = {e.get("storedName") for e in new_ev_list if e.get("storedName")}
        ev_dir = build_lab_evidence_directory(record_id)
        for old_ev in old_ev_list:
            old_name = _coerce_str(old_ev.get("storedName"))
            if old_name and old_name not in new_names:
                (ev_dir / Path(old_name).name).unlink(missing_ok=True)

    save_lab_record(record_id, record)
    row = fetch_lab_record_row(record_id)
    return _serialize_record_for_response(row)


def generate_lab_document(record_id: int, phase: str) -> dict[str, Any]:
    if phase not in ("entrada", "procesamiento", "salida"):
        raise HTTPException(status_code=422, detail=f"Fase '{phase}' no valida. Use 'entrada', 'procesamiento' o 'salida'.")

    row = fetch_lab_record_row(record_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Acta de laboratorio #{record_id} no encontrada.")

    document_number = _coerce_str(row.get("document_number"))
    record_data = {**row}

    if phase == "entrada":
        html = build_lab_entry_html(record_data)
        suffix = "E"
        phase_label = "Entrada"
    elif phase == "procesamiento":
        if not row.get("entry_date"):
            raise HTTPException(status_code=422, detail="Debes completar la fase de entrada antes de generar el acta de procesamiento.")
        html = build_lab_processing_html(record_data)
        suffix = "P"
        phase_label = "Procesamiento"
    else:
        if not row.get("entry_date"):
            raise HTTPException(status_code=422, detail="Debes completar la fase de entrada antes de generar el acta de salida.")
        html = build_lab_exit_html(record_data)
        suffix = "S"
        phase_label = "Salida"

    safe_code = document_number.replace("/", "_").replace(" ", "_")
    filename = f"{safe_code}-{suffix}.pdf"
    stored_name = f"{safe_code}-{suffix}-{uuid4().hex[:8]}.pdf"

    pdf_bytes = _render_lab_pdf_bytes(html, filename=filename)

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
    if old_doc and isinstance(old_doc, dict):
        old_stored = _coerce_str(old_doc.get("storedName"))
        if old_stored:
            old_path = doc_dir / Path(old_stored).name
            old_path.unlink(missing_ok=True)

    update_payload: dict[str, Any] = {}
    if phase == "entrada":
        update_payload["entryGeneratedDocument"] = generated_document
        current_status = _coerce_str(row.get("status"), "draft")
        if current_status == "draft":
            update_payload["status"] = "En laboratorio"
    elif phase == "procesamiento":
        update_payload["processingGeneratedDocument"] = generated_document
    else:
        update_payload["exitGeneratedDocument"] = generated_document
        marked_obsolete = bool(row.get("marked_obsolete"))
        if marked_obsolete:
            update_payload["status"] = "Derivada a obsoleto"
        else:
            update_payload["status"] = "Completada"

    update_lab_record(record_id, update_payload)

    return {
        "document": generated_document,
        "record": _serialize_record_for_response(fetch_lab_record_row(record_id)),
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
        raise HTTPException(status_code=422, detail=f"Fase '{phase}' no valida.")

    row = fetch_lab_record_row(record_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Acta de laboratorio #{record_id} no encontrada.")

    evidence_key_map = {"entrada": "entry_evidences", "procesamiento": "processing_evidences", "salida": "exit_evidences"}
    evidence_key = evidence_key_map.get(phase, "exit_evidences")
    existing_evidences: list[dict[str, Any]] = row.get(evidence_key) or []

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
            raise HTTPException(status_code=422, detail=f"Extension '{ext}' no permitida para evidencias.")

        stored_name = f"{phase[:1].upper()}-{uuid4().hex[:12]}.{ext}"
        try:
            content = b64decode(content_b64, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Contenido base64 invalido para '{original_name}'.") from exc

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
    frontend_key_map = {"entrada": "entryEvidences", "procesamiento": "processingEvidences", "salida": "exitEvidences"}
    update_payload: dict[str, Any] = {frontend_key_map.get(phase, "exitEvidences"): merged_evidences}

    update_lab_record(record_id, update_payload)
    return {"evidences": merged_evidences}


def get_lab_evidence_file(record_id: int, stored_name: str) -> Path:
    path = resolve_existing_lab_evidence(record_id, stored_name)
    if not path:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada.")
    return path
