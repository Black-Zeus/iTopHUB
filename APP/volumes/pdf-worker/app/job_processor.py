import os
import sys
import importlib
import importlib.util
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException

sys.path.insert(0, "/app")


def _load_pdf_worker_render_function():
    module_path = Path("/app/main.py")
    spec = importlib.util.spec_from_file_location("pdf_worker_main", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No fue posible cargar el modulo local desde {module_path}.")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    render_fn = getattr(module, "_render_pdf", None)
    if render_fn is None:
        raise RuntimeError("El modulo local de pdf-worker no expone _render_pdf.")
    return render_fn

sys.path.insert(0, "/app_backend")
from infrastructure.job_manager import get_pending_job, set_job_status


def _format_attachment_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{(size_bytes / 1024):.1f} KB"
    return f"{(size_bytes / (1024 * 1024)):.1f} MB"


def render_handover_pdf(html: str, footer_html: str | None = None, filename: str | None = None) -> dict[str, Any]:
    render_pdf = _load_pdf_worker_render_function()
    pdf_bytes = render_pdf(html, footer_html=footer_html, filename=filename)
    return {
        "content": pdf_bytes,
        "size": len(pdf_bytes),
    }


def _load_backend_module(module_name: str):
    module = importlib.import_module(module_name)
    if os.getenv("ENV_NAME", "").strip().lower() == "dev":
        # Reload each module before importing dependants so long-lived workers
        # pick up newly added symbols during local development.
        module = importlib.reload(module)
    return module


def _load_handover_emit_dependencies() -> dict[str, Any]:
    _load_backend_module("modules.settings.service")
    handover_types = _load_backend_module("modules.handover.handover_types")
    document_templates = _load_backend_module("modules.handover.document_templates")
    payloads = _load_backend_module("modules.handover.payloads")
    pdf_pipeline = _load_backend_module("modules.handover.pdf_pipeline")
    repository = _load_backend_module("modules.handover.repository")
    service = _load_backend_module("modules.handover.service")

    return {
        "build_detail_document_number": document_templates.build_detail_document_number,
        "build_handover_detail_html": document_templates.build_handover_detail_html,
        "build_handover_main_html": document_templates.build_handover_main_html,
        "build_document_payload_from_detail": payloads.build_document_payload_from_detail,
        "build_item_payloads_from_detail": payloads.build_item_payloads_from_detail,
        "build_handover_storage_directory": service.build_handover_storage_directory,
        "build_handover_storage_source": service.build_handover_storage_source,
        "fetch_handover_document_row": repository.fetch_handover_document_row,
        "save_handover_document": repository.save_handover_document,
        "enrich_handover_detail_for_pdf": service.enrich_handover_detail_for_pdf,
        "get_handover_document_detail": service.get_handover_document_detail,
        "logger": service.logger,
    }


def _extract_job_error(exc: Exception) -> tuple[str, str]:
    detail = getattr(exc, "detail", None)

    if isinstance(detail, dict):
        return (
            str(detail.get("code") or "PROCESSING_ERROR"),
            str(detail.get("message") or detail or str(exc)),
        )

    if isinstance(exc, HTTPException):
        if exc.status_code == 428:
            return ("TOKEN_REVALIDATION_REQUIRED", str(detail or str(exc)))
        return ("PROCESSING_ERROR", str(detail or str(exc)))

    error_code = getattr(exc, "code", None)
    error_message = getattr(exc, "message", None)
    if error_code or error_message:
        return (
            str(error_code or "PROCESSING_ERROR"),
            str(error_message or str(exc)),
        )

    return ("PROCESSING_ERROR", str(exc))


def process_handover_emit_job(job: dict[str, Any]) -> dict[str, Any]:
    sys.path.insert(0, "/app_backend")
    dependencies = _load_handover_emit_dependencies()
    build_detail_document_number = dependencies["build_detail_document_number"]
    build_handover_detail_html = dependencies["build_handover_detail_html"]
    build_handover_main_html = dependencies["build_handover_main_html"]
    build_document_payload_from_detail = dependencies["build_document_payload_from_detail"]
    build_item_payloads_from_detail = dependencies["build_item_payloads_from_detail"]
    build_handover_storage_directory = dependencies["build_handover_storage_directory"]
    build_handover_storage_source = dependencies["build_handover_storage_source"]
    fetch_handover_document_row = dependencies["fetch_handover_document_row"]
    save_handover_document = dependencies["save_handover_document"]
    enrich_handover_detail_for_pdf = dependencies["enrich_handover_detail_for_pdf"]
    get_handover_document_detail = dependencies["get_handover_document_detail"]
    logger = dependencies["logger"]

    document_id = int(job["payload"]["document_id"])
    session_id = str(job.get("session_id") or "").strip()
    env_name = os.getenv("ENV_NAME", "dev")
    current_detail = get_handover_document_detail(document_id)
    assignment_at = current_detail.get("assignmentDate") or current_detail.get("assignment_at") or ""

    if not assignment_at:
        assignment_at = datetime.now().strftime("%Y-%m-%dT%H:%M")

    detail_for_pdf = {
        **current_detail,
        "assignmentDate": assignment_at,
        "status": "Emitida",
    }
    detail_for_pdf = enrich_handover_detail_for_pdf(
        detail_for_pdf,
        session_id=session_id or None,
    )
    handover_type = detail_for_pdf.get("handoverTypeCode") or detail_for_pdf.get("handoverType") or "initial_assignment"

    main_stored_name = f"{detail_for_pdf.get('documentNumber')}.pdf"
    detail_document_code = build_detail_document_number(str(detail_for_pdf.get("documentNumber") or ""))
    detail_stored_name = f"{detail_document_code}.pdf"

    html_main, footer_main = build_handover_main_html(detail_for_pdf)
    html_detail, footer_detail = build_handover_detail_html(detail_for_pdf)

    pdf_main = render_handover_pdf(html_main, footer_main, filename=main_stored_name)
    pdf_detail = render_handover_pdf(html_detail, footer_detail, filename=detail_stored_name)

    storage_directory = build_handover_storage_directory("documents", document_id, handover_type)
    storage_directory.mkdir(parents=True, exist_ok=True)
    logger.info(
        "Usando directorio PDF de handover para acta %s (%s): %s",
        document_id,
        handover_type,
        storage_directory,
    )
    generated_at = datetime.now().strftime("%Y-%m-%dT%H:%M")

    created_files: list[Path] = []
    try:
        main_path = storage_directory / main_stored_name
        main_path.write_bytes(pdf_main["content"])
        created_files.append(main_path)

        detail_path = storage_directory / detail_stored_name
        detail_path.write_bytes(pdf_detail["content"])
        created_files.append(detail_path)

        existing_document = fetch_handover_document_row(document_id)
        document_payload = build_document_payload_from_detail(
            detail_for_pdf,
            existing_document,
            status_ui="Emitida",
            assignment_date=assignment_at,
            evidence_date=current_detail.get("evidenceDate") or "",
            generated_documents=[
                {
                    "kind": "main",
                    "title": "Acta principal",
                    "code": detail_for_pdf.get("documentNumber"),
                    "name": main_stored_name,
                    "storedName": main_stored_name,
                    "mimeType": "application/pdf",
                    "size": _format_attachment_size(pdf_main["size"]),
                    "source": build_handover_storage_source(
                        env_name,
                        "documents",
                        document_id,
                        handover_type,
                        main_stored_name,
                    ),
                    "uploadedAt": generated_at,
                },
                {
                    "kind": "detail",
                    "title": "Detalle de revision",
                    "code": detail_document_code,
                    "name": detail_stored_name,
                    "storedName": detail_stored_name,
                    "mimeType": "application/pdf",
                    "size": _format_attachment_size(pdf_detail["size"]),
                    "source": build_handover_storage_source(
                        env_name,
                        "documents",
                        document_id,
                        handover_type,
                        detail_stored_name,
                    ),
                    "uploadedAt": generated_at,
                },
            ],
            evidence_attachments=current_detail.get("evidenceAttachments") or [],
            signature_workflow={},
        )
        item_payloads = build_item_payloads_from_detail(current_detail.get("items") or [])

        save_handover_document(document_id, document_payload, item_payloads)
    except Exception:
        for path in created_files:
            try:
                if path.exists():
                    path.unlink()
            except OSError:
                continue
        raise

    return {
        "document_id": document_id,
        "status": "completed",
    }


JOB_HANDLERS = {
    "handover_emit": process_handover_emit_job,
}


def process_job(job_type: str) -> bool:
    job = get_pending_job(job_type)
    if not job:
        return False

    job_id = job["job_id"]
    handler = JOB_HANDLERS.get(job_type)

    if not handler:
        set_job_status(job_id, "failed", error_code="UNKNOWN_JOB_TYPE", error_detail=f"Job type {job_type} not supported")
        return True

    try:
        result = handler(job)
        set_job_status(job_id, "completed", result=result)
        return True
    except Exception as exc:
        error_code, error_detail = _extract_job_error(exc)
        set_job_status(job_id, "failed", error_code=error_code, error_detail=error_detail)
        return True


def run_worker(job_types: list[str], poll_interval: float = 2.0):
    import signal

    running = True

    def signal_handler(signum, frame):
        nonlocal running
        running = False
        print(f"[job-processor] Received signal {signum}, shutting down...", flush=True)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print(f"[job-processor] Starting worker for job types: {job_types}", flush=True)

    while running:
        processed = False
        for job_type in job_types:
            if not running:
                break
            if process_job(job_type):
                processed = True

        if not processed:
            import time
            time.sleep(poll_interval)

    print("[job-processor] Worker stopped", flush=True)


if __name__ == "__main__":
    job_types = os.getenv("JOB_TYPES", "handover_emit").split(",")
    poll_interval = float(os.getenv("POLL_INTERVAL", "2.0"))
    run_worker(job_types, poll_interval)
