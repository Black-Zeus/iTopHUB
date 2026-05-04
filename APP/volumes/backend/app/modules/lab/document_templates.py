from __future__ import annotations

from base64 import b64encode
from datetime import datetime
from html import escape
import mimetypes
from typing import Any

from modules.handover.document_templates import _build_base_html, _build_owner_signature_box
from modules.lab.shared import REASON_DB_TO_UI, coerce_str
from modules.lab.storage_paths import resolve_existing_lab_evidence


def _escape(value: Any) -> str:
    return escape(coerce_str(value))


def _format_date(value: Any) -> str:
    text = coerce_str(value)
    if not text:
        return "—"
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).strftime("%d-%m-%Y")
        except ValueError:
            continue
    return text


def _build_rows_table(rows: list[tuple[str, Any]]) -> str:
    rows_html = "".join(
        f"<tr><td class=\"label-cell\">{_escape(label)}</td><td>{_escape(value) or '—'}</td></tr>"
        for label, value in rows
    )
    return f"<table><tbody>{rows_html}</tbody></table>"


def _build_text_block(value: Any, empty_message: str) -> str:
    content = _escape(value)
    if not content:
        return f'<p class="muted" style="margin:0;">{_escape(empty_message)}</p>'
    return (
        "<div style=\"background:#fbfdff;border:1px solid #d7e1ec;border-radius:10px;"
        "padding:12px;white-space:pre-wrap;line-height:1.55;\">"
        f"{content}"
        "</div>"
    )


def _build_asset_section(record: dict[str, Any]) -> str:
    asset = record.get("asset") or {}
    rows = [
        ("Clase", asset.get("className") or record.get("asset_class") or "Activo"),
        ("Activo", asset.get("name") or record.get("asset_name") or "Sin identificar"),
        ("Codigo", asset.get("code") or record.get("asset_code")),
        ("Serie", asset.get("serial") or record.get("asset_serial")),
        ("Organizacion", asset.get("organization") or record.get("asset_organization")),
        ("Ubicacion", asset.get("location") or record.get("asset_location")),
        ("Estado del activo", asset.get("status") or record.get("asset_status")),
        ("Responsable actual", asset.get("assignedUser") or record.get("asset_assigned_user")),
    ]
    return f"""
    <section class="section">
        <h2 class="section-title">Activo analizado</h2>
        <div class="section-body">
            {_build_rows_table(rows)}
        </div>
    </section>
    """


def _build_identification_section(record: dict[str, Any], phase_label: str, extra_rows: list[tuple[str, Any]] | None = None) -> str:
    reason_db = coerce_str(record.get("reason", "maintenance"))
    reason_label = REASON_DB_TO_UI.get(reason_db, reason_db)
    rows = [
        ("Folio", record.get("document_number")),
        ("Motivo", reason_label),
        ("Fase", phase_label),
        ("Especialista", record.get("owner_name") or "Sin registrar"),
    ]
    rows.extend(extra_rows or [])
    return f"""
    <section class="section">
        <h2 class="section-title">Identificacion del acta</h2>
        <div class="section-body">
            {_build_rows_table(rows)}
        </div>
    </section>
    """


def _build_evidence_gallery(record: dict[str, Any], evidences: list[dict[str, Any]], empty_message: str) -> str:
    record_id = int(record.get("id") or 0)
    items: list[str] = []
    for evidence in evidences or []:
        stored_name = coerce_str(evidence.get("storedName"))
        if not stored_name or record_id <= 0:
            continue
        file_path = resolve_existing_lab_evidence(record_id, stored_name)
        if not file_path:
            continue
        mime_type = coerce_str(evidence.get("mimeType")) or (mimetypes.guess_type(file_path.name)[0] or "image/jpeg")
        try:
            data_url = f"data:{mime_type};base64,{b64encode(file_path.read_bytes()).decode('ascii')}"
        except Exception:
            continue
        caption = coerce_str(evidence.get("caption")) or "Sin glosa registrada."
        original_name = coerce_str(evidence.get("originalName") or stored_name)
        items.append(
            f"""
            <div class="evidence-row">
                <img src="{escape(data_url)}" alt="{_escape(original_name)}" class="evidence-image" />
                <div class="evidence-caption">
                    <h3 class="subsection-title" style="margin-bottom:0;">{_escape(original_name)}</h3>
                    <div style="background:#fbfdff;border:1px solid #d7e1ec;border-radius:10px;padding:10px;white-space:pre-wrap;line-height:1.55;">
                        {_escape(caption)}
                    </div>
                </div>
            </div>
            """
        )
    if not items:
        return f'<p class="muted" style="margin:0;">{_escape(empty_message)}</p>'
    return f'<div class="evidence-list">{"".join(items)}</div>'


def _format_check_answer_value(answer: dict[str, Any]) -> str:
    answer_type = coerce_str(answer.get("type"))
    value = answer.get("value")
    if answer_type == "Check":
        return "Si" if bool(value) else "No"
    return coerce_str(value) or "Sin respuesta"


def _build_checklists_html(checklists: list[dict[str, Any]]) -> str:
    if not checklists:
        return '<p class="muted" style="margin:0;">Sin checklists completados.</p>'

    sections: list[str] = []
    for checklist in checklists:
        answers = checklist.get("answers") or []
        if answers:
            rows_html = "".join(
                f"""
                <tr>
                    <td class="label-cell">
                        <strong>{_escape(answer.get("name"))}</strong>
                        {f'<div class="muted" style="margin-top:4px;">{_escape(answer.get("description"))}</div>' if coerce_str(answer.get("description")) else ""}
                    </td>
                    <td>{_escape(_format_check_answer_value(answer))}</td>
                </tr>
                """
                for answer in answers
            )
            table_html = f"<table><tbody>{rows_html}</tbody></table>"
        else:
            table_html = '<p class="muted" style="margin:0;">Esta plantilla no registra respuestas.</p>'
        sections.append(
            f"""
            <div class="block-space">
                <h3 class="subsection-title">{_escape(checklist.get("templateName") or "Checklist")}</h3>
                {f'<p class="muted" style="margin:0 0 8px 0;">{_escape(checklist.get("templateDescription"))}</p>' if coerce_str(checklist.get("templateDescription")) else ""}
                {table_html}
            </div>
            """
        )
    return "".join(sections)


def _build_signature_section(boxes: list[str], *, single: bool = False) -> str:
    grid_style = ' style="grid-template-columns:minmax(0,1fr);max-width:420px;"' if single else ""
    return f"""
    <section class="section section-keep-together">
        <h2 class="section-title">Firmas</h2>
        <div class="section-body">
            <div class="signature-grid"{grid_style}>
                {''.join(boxes)}
            </div>
        </div>
    </section>
    """


def _build_agent_signature_section(record: dict[str, Any]) -> str:
    owner = {
        "name": coerce_str(record.get("owner_name")),
        "role": "Agente revisor del Hub",
    }
    return _build_signature_section(
        [_build_owner_signature_box(owner, "Especialista de laboratorio")],
        single=True,
    )


def _build_exit_obsolete_notice(record: dict[str, Any]) -> str:
    if not bool(record.get("marked_obsolete")):
        return ""
    notes = coerce_str(record.get("obsolete_notes")) or "Sin observaciones adicionales."
    normalization_code = coerce_str(record.get("normalization_act_code"))
    reference_line = f"Acta de normalizacion asociada: {normalization_code}" if normalization_code else "Acta de normalizacion pendiente."
    return f"""
    <div style="margin-top:12px;border:1px solid #f0c36b;background:#fff8e6;border-radius:10px;padding:12px;">
        <div style="color:#9a6700;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;">
            Equipo derivado a obsoleto
        </div>
        <div style="white-space:pre-wrap;line-height:1.55;">{_escape(notes)}</div>
        <div class="muted" style="margin-top:8px;">{_escape(reference_line)}</div>
    </div>
    """


def _build_lab_document_html(
    *,
    record: dict[str, Any],
    subtitle: str,
    body: str,
) -> tuple[str, str | None]:
    document_number = coerce_str(record.get("document_number"))
    generated_at = datetime.now().strftime("%d-%m-%Y %H:%M")
    return _build_base_html(
        title="Acta de laboratorio",
        subtitle=subtitle,
        code_label="Folio",
        code_value=document_number,
        body=body,
        generated_at=generated_at,
        eyebrow="Laboratorio",
    )


def build_lab_entry_html(record: dict[str, Any]) -> tuple[str, str | None]:
    body = f"""
    {_build_identification_section(record, "Entrada", [("Fecha de ingreso", _format_date(record.get("entry_date")))])}
    {_build_asset_section(record)}
    <section class="section">
        <h2 class="section-title">Registro de entrada</h2>
        <div class="section-body">
            <div class="block-space">
                <h3 class="subsection-title">Analisis previo y observaciones</h3>
                {_build_text_block(record.get("entry_observations"), "Sin observaciones registradas.")}
            </div>
        </div>
    </section>
    <section class="section">
        <h2 class="section-title">Adjuntos de entrada</h2>
        <div class="section-body">
            {_build_evidence_gallery(record, record.get("entry_evidences") or [], "Sin evidencias de entrada adjuntas.")}
        </div>
    </section>
    {_build_agent_signature_section(record)}
    """
    return _build_lab_document_html(
        record=record,
        subtitle="Fase de entrada",
        body=body,
    )


def build_lab_processing_html(record: dict[str, Any]) -> tuple[str, str | None]:
    body = f"""
    {_build_identification_section(
        record,
        "Procesamiento",
        [
            ("Fecha de ingreso", _format_date(record.get("entry_date"))),
            ("Fecha de procesamiento", _format_date(record.get("processing_date"))),
        ],
    )}
    {_build_asset_section(record)}
    <section class="section">
        <h2 class="section-title">Registro de procesamiento</h2>
        <div class="section-body">
            <div class="block-space">
                <h3 class="subsection-title">Observaciones de procesamiento</h3>
                {_build_text_block(record.get("processing_observations"), "Sin observaciones registradas.")}
            </div>
            <div class="block-space" style="margin-bottom:0;">
                <h3 class="subsection-title">Checklists aplicados</h3>
                {_build_checklists_html(record.get("processing_checklists") or [])}
            </div>
        </div>
    </section>
    <section class="section">
        <h2 class="section-title">Adjuntos de procesamiento</h2>
        <div class="section-body">
            {_build_evidence_gallery(record, record.get("processing_evidences") or [], "Sin evidencias de procesamiento adjuntas.")}
        </div>
    </section>
    {_build_agent_signature_section(record)}
    """
    return _build_lab_document_html(
        record=record,
        subtitle="Fase de procesamiento",
        body=body,
    )


def build_lab_exit_html(record: dict[str, Any]) -> tuple[str, str | None]:
    body = f"""
    {_build_identification_section(
        record,
        "Salida",
        [
            ("Fecha de ingreso", _format_date(record.get("entry_date"))),
            ("Fecha de salida", _format_date(record.get("exit_date"))),
        ],
    )}
    {_build_asset_section(record)}
    <section class="section">
        <h2 class="section-title">Cierre tecnico</h2>
        <div class="section-body">
            <div class="block-space">
                <h3 class="subsection-title">Trabajo realizado</h3>
                {_build_text_block(record.get("work_performed"), "Sin descripcion del trabajo realizado.")}
            </div>
            <div class="block-space" style="margin-bottom:0;">
                <h3 class="subsection-title">Observaciones de salida</h3>
                {_build_text_block(record.get("exit_observations"), "Sin observaciones registradas.")}
                {_build_exit_obsolete_notice(record)}
            </div>
        </div>
    </section>
    <section class="section">
        <h2 class="section-title">Adjuntos de salida</h2>
        <div class="section-body">
            {_build_evidence_gallery(record, record.get("exit_evidences") or [], "Sin evidencias de salida adjuntas.")}
        </div>
    </section>
    {_build_agent_signature_section(record)}
    """
    return _build_lab_document_html(
        record=record,
        subtitle="Fase de salida",
        body=body,
    )
