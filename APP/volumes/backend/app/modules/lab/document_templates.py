from __future__ import annotations

from datetime import datetime
from html import escape
from typing import Any

from modules.settings.service import read_organization_logo_data_url, get_settings_panel
from modules.lab.shared import REASON_DB_TO_UI, STATUS_DB_TO_UI, coerce_str


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


def _get_base_css() -> str:
    return """
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10pt; color: #1a1a1a; background: #fff; }
        .page { padding: 28px 32px; max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 14px; margin-bottom: 20px; }
        .header-logo img { height: 52px; object-fit: contain; }
        .header-logo .org-name { font-size: 18pt; font-weight: 700; color: #1a1a1a; letter-spacing: -0.5px; }
        .header-info { text-align: right; }
        .header-info .doc-title { font-size: 13pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1a1a1a; }
        .header-info .doc-code { font-size: 11pt; font-weight: 600; color: #555; margin-top: 3px; }
        .header-info .doc-phase { display: inline-block; margin-top: 5px; padding: 3px 10px; border-radius: 20px; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; }
        .phase-entry      { background: #e8f4fd; color: #1a6fa0; }
        .phase-processing { background: #f3eefb; color: #6a3fa0; }
        .phase-exit       { background: #e8f9ef; color: #1a7a40; }
        .checklist-block { margin-bottom: 14px; border: 1px solid #dde3ec; border-radius: 6px; overflow: hidden; }
        .checklist-header { background: #f3eefb; padding: 8px 14px; }
        .checklist-header .cl-name { font-size: 9pt; font-weight: 700; color: #4a2a80; }
        .checklist-header .cl-desc { font-size: 8pt; color: #7a5aaa; margin-top: 2px; }
        .checklist-item { padding: 8px 14px; border-top: 1px solid #eee; display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: start; }
        .checklist-item:nth-child(even) { background: #fafafa; }
        .ci-label { font-size: 8.5pt; font-weight: 600; color: #333; }
        .ci-desc { font-size: 7.5pt; color: #888; margin-top: 1px; }
        .ci-value { font-size: 8.5pt; color: #1a1a1a; font-weight: 500; text-align: right; max-width: 160px; word-break: break-word; }
        .section { margin-bottom: 18px; }
        .section-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
        .info-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
        .field { }
        .field label { font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: #888; display: block; margin-bottom: 2px; }
        .field .value { font-size: 9.5pt; color: #1a1a1a; font-weight: 500; }
        .field .value-empty { font-size: 9.5pt; color: #bbb; font-style: italic; }
        .asset-box { background: #f7f9fc; border: 1px solid #dde3ec; border-radius: 6px; padding: 12px 16px; }
        .asset-box .asset-class { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #888; }
        .asset-box .asset-name { font-size: 12pt; font-weight: 700; color: #1a1a1a; margin-top: 2px; }
        .asset-box .asset-meta { font-size: 8.5pt; color: #666; margin-top: 4px; }
        .observations-box { background: #fafafa; border: 1px solid #eee; border-radius: 6px; padding: 12px 16px; font-size: 9.5pt; color: #333; line-height: 1.55; white-space: pre-wrap; min-height: 48px; }
        .observations-empty { color: #bbb; font-style: italic; }
        .work-box { background: #f7f9fc; border: 1px solid #dde3ec; border-radius: 6px; padding: 12px 16px; font-size: 9.5pt; color: #333; line-height: 1.55; white-space: pre-wrap; min-height: 48px; }
        .obsolete-notice { margin-top: 14px; background: #fff4e5; border: 1px solid #f5c87a; border-radius: 6px; padding: 12px 16px; }
        .obsolete-notice .notice-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; color: #b35c00; letter-spacing: 0.6px; margin-bottom: 5px; }
        .obsolete-notice .notice-text { font-size: 9pt; color: #7a3c00; }
        .footer-meta { margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: flex-end; }
        .footer-meta .generated { font-size: 7.5pt; color: #bbb; }
        .signature-area { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
        .sig-block { border: 1px solid #ddd; border-radius: 6px; padding: 12px; text-align: center; }
        .sig-block .sig-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; color: #888; }
        .sig-block .sig-line { margin-top: 40px; border-top: 1px solid #aaa; padding-top: 6px; font-size: 8pt; color: #555; }
        .reason-badge { display: inline-block; background: #f0f4fa; border: 1px solid #c8d4e8; border-radius: 20px; padding: 3px 12px; font-size: 8.5pt; font-weight: 600; color: #3a5a8a; }
    """


def _build_org_header(phase_label: str, phase_class: str, document_number: str) -> str:
    org_settings = get_settings_panel("organization")
    logo_path = coerce_str(org_settings.get("organizationLogoPath"))
    org_name = coerce_str(org_settings.get("organizationName")) or "iTop Hub"
    org_acronym = coerce_str(org_settings.get("organizationAcronym")) or "ITH"
    logo_data_url = read_organization_logo_data_url(logo_path)

    if logo_data_url:
        logo_html = f'<img src="{escape(logo_data_url)}" alt="{_escape(org_acronym)}" />'
    else:
        logo_html = f'<span class="org-name">{_escape(org_acronym)}</span>'

    return f"""
    <div class="header">
        <div class="header-logo">{logo_html}</div>
        <div class="header-info">
            <div class="doc-title">Acta de Laboratorio</div>
            <div class="doc-code">{_escape(document_number)}</div>
            <span class="doc-phase {phase_class}">{_escape(phase_label)}</span>
        </div>
    </div>
    """


def build_lab_entry_html(record: dict[str, Any]) -> str:
    document_number = coerce_str(record.get("document_number"))
    reason_db = coerce_str(record.get("reason", "maintenance"))
    reason_label = REASON_DB_TO_UI.get(reason_db, reason_db)
    owner_name = coerce_str(record.get("owner_name"))
    entry_date = _format_date(record.get("entry_date"))
    entry_observations = coerce_str(record.get("entry_observations"))

    asset = record.get("asset") or {}
    asset_class = coerce_str(asset.get("className") or record.get("asset_class"))
    asset_name = coerce_str(asset.get("name") or record.get("asset_name"))
    asset_code = coerce_str(asset.get("code") or record.get("asset_code"))
    asset_serial = coerce_str(asset.get("serial") or record.get("asset_serial"))
    asset_org = coerce_str(asset.get("organization") or record.get("asset_organization"))
    asset_location = coerce_str(asset.get("location") or record.get("asset_location"))

    asset_meta_parts = [p for p in [
        f"Codigo: {asset_code}" if asset_code else None,
        f"Serie: {asset_serial}" if asset_serial else None,
        f"Org: {asset_org}" if asset_org else None,
        f"Locacion: {asset_location}" if asset_location else None,
    ] if p]
    asset_meta_html = " &nbsp;|&nbsp; ".join(_escape(p) for p in asset_meta_parts) or "Sin informacion adicional"

    obs_html = (
        f'<div class="observations-box">{_escape(entry_observations)}</div>'
        if entry_observations
        else '<div class="observations-box observations-empty">Sin observaciones registradas.</div>'
    )

    org_header = _build_org_header("Fase de Entrada", "phase-entry", document_number)

    now_str = datetime.now().strftime("%d-%m-%Y %H:%M")

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>{_get_base_css()}</style>
</head>
<body>
<div class="page">
    {org_header}

    <div class="section">
        <div class="section-title">Identificacion del acta</div>
        <div class="info-grid info-grid-3">
            <div class="field">
                <label>Numero de acta</label>
                <div class="value">{_escape(document_number)}</div>
            </div>
            <div class="field">
                <label>Motivo</label>
                <div class="value"><span class="reason-badge">{_escape(reason_label)}</span></div>
            </div>
            <div class="field">
                <label>Especialista</label>
                <div class="value">{_escape(owner_name) or '<span class="value-empty">Sin registrar</span>'}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Activo analizado</div>
        <div class="asset-box">
            <div class="asset-class">{_escape(asset_class) or "Activo"}</div>
            <div class="asset-name">{_escape(asset_name) or "Sin identificar"}</div>
            <div class="asset-meta">{asset_meta_html}</div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Fase de entrada</div>
        <div class="info-grid" style="margin-bottom:12px;">
            <div class="field">
                <label>Fecha de ingreso</label>
                <div class="value">{_escape(entry_date)}</div>
            </div>
        </div>
        <div class="field" style="margin-bottom:6px;"><label>Analisis previo y observaciones de ingreso</label></div>
        {obs_html}
    </div>

    <div class="signature-area">
        <div class="sig-block">
            <div class="sig-label">Especialista de laboratorio</div>
            <div class="sig-line">{_escape(owner_name) or "&nbsp;"}</div>
        </div>
        <div class="sig-block">
            <div class="sig-label">Receptor / Responsable del activo</div>
            <div class="sig-line">&nbsp;</div>
        </div>
    </div>

    <div class="footer-meta">
        <span class="generated">Generado: {now_str}</span>
        <span class="generated">{_escape(document_number)} — Entrada</span>
    </div>
</div>
</body>
</html>"""


def build_lab_exit_html(record: dict[str, Any]) -> str:
    document_number = coerce_str(record.get("document_number"))
    reason_db = coerce_str(record.get("reason", "maintenance"))
    reason_label = REASON_DB_TO_UI.get(reason_db, reason_db)
    owner_name = coerce_str(record.get("owner_name"))
    entry_date = _format_date(record.get("entry_date"))
    exit_date = _format_date(record.get("exit_date"))
    exit_observations = coerce_str(record.get("exit_observations"))
    work_performed = coerce_str(record.get("work_performed"))
    marked_obsolete = bool(record.get("marked_obsolete"))
    obsolete_notes = coerce_str(record.get("obsolete_notes"))
    normalization_act_code = coerce_str(record.get("normalization_act_code"))

    asset = record.get("asset") or {}
    asset_class = coerce_str(asset.get("className") or record.get("asset_class"))
    asset_name = coerce_str(asset.get("name") or record.get("asset_name"))
    asset_code = coerce_str(asset.get("code") or record.get("asset_code"))
    asset_serial = coerce_str(asset.get("serial") or record.get("asset_serial"))
    asset_org = coerce_str(asset.get("organization") or record.get("asset_organization"))
    asset_location = coerce_str(asset.get("location") or record.get("asset_location"))

    asset_meta_parts = [p for p in [
        f"Codigo: {asset_code}" if asset_code else None,
        f"Serie: {asset_serial}" if asset_serial else None,
        f"Org: {asset_org}" if asset_org else None,
        f"Locacion: {asset_location}" if asset_location else None,
    ] if p]
    asset_meta_html = " &nbsp;|&nbsp; ".join(_escape(p) for p in asset_meta_parts) or "Sin informacion adicional"

    work_html = (
        f'<div class="work-box">{_escape(work_performed)}</div>'
        if work_performed
        else '<div class="work-box observations-empty">Sin descripcion de trabajo.</div>'
    )
    obs_html = (
        f'<div class="observations-box">{_escape(exit_observations)}</div>'
        if exit_observations
        else '<div class="observations-box observations-empty">Sin observaciones registradas.</div>'
    )

    obsolete_html = ""
    if marked_obsolete:
        norm_ref = f" Acta de normalizacion generada: <strong>{_escape(normalization_act_code)}</strong>." if normalization_act_code else ""
        obs_text = _escape(obsolete_notes) if obsolete_notes else "Sin observaciones adicionales."
        obsolete_html = f"""
        <div class="obsolete-notice">
            <div class="notice-title">Equipo derivado a obsoleto</div>
            <div class="notice-text">{obs_text}{norm_ref}</div>
        </div>
        """

    org_header = _build_org_header("Fase de Salida", "phase-exit", document_number)
    now_str = datetime.now().strftime("%d-%m-%Y %H:%M")

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>{_get_base_css()}</style>
</head>
<body>
<div class="page">
    {org_header}

    <div class="section">
        <div class="section-title">Identificacion del acta</div>
        <div class="info-grid info-grid-3">
            <div class="field">
                <label>Numero de acta</label>
                <div class="value">{_escape(document_number)}</div>
            </div>
            <div class="field">
                <label>Motivo</label>
                <div class="value"><span class="reason-badge">{_escape(reason_label)}</span></div>
            </div>
            <div class="field">
                <label>Especialista</label>
                <div class="value">{_escape(owner_name) or '<span class="value-empty">Sin registrar</span>'}</div>
            </div>
        </div>
        <div class="info-grid" style="margin-top:12px;">
            <div class="field">
                <label>Fecha de ingreso</label>
                <div class="value">{_escape(entry_date)}</div>
            </div>
            <div class="field">
                <label>Fecha de salida</label>
                <div class="value">{_escape(exit_date)}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Activo analizado</div>
        <div class="asset-box">
            <div class="asset-class">{_escape(asset_class) or "Activo"}</div>
            <div class="asset-name">{_escape(asset_name) or "Sin identificar"}</div>
            <div class="asset-meta">{asset_meta_html}</div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Trabajo realizado</div>
        {work_html}
    </div>

    <div class="section">
        <div class="section-title">Observaciones de salida</div>
        {obs_html}
        {obsolete_html}
    </div>

    <div class="signature-area">
        <div class="sig-block">
            <div class="sig-label">Especialista de laboratorio</div>
            <div class="sig-line">{_escape(owner_name) or "&nbsp;"}</div>
        </div>
        <div class="sig-block">
            <div class="sig-label">Receptor / Responsable del activo</div>
            <div class="sig-line">&nbsp;</div>
        </div>
    </div>

    <div class="footer-meta">
        <span class="generated">Generado: {now_str}</span>
        <span class="generated">{_escape(document_number)} — Salida</span>
    </div>
</div>
</body>
</html>"""


def _build_checklists_html(checklists: list[dict]) -> str:
    if not checklists:
        return '<div class="observations-box observations-empty">Sin checklists completados.</div>'

    blocks = []
    for cl in checklists:
        cl_name = _escape(cl.get("templateName", "Checklist"))
        cl_desc = _escape(cl.get("templateDescription", ""))
        answers = cl.get("answers") or []

        items_html = ""
        for answer in answers:
            a_name = _escape(answer.get("name", ""))
            a_desc = _escape(answer.get("description", ""))
            a_type = answer.get("type", "Input text")
            a_value = answer.get("value", "")

            if a_type == "Check":
                display_value = "Si" if a_value else "No"
            elif a_type == "Option / Radio":
                display_value = _escape(str(a_value)) if a_value else "Sin respuesta"
            else:
                display_value = _escape(str(a_value)) if str(a_value).strip() else "—"

            items_html += f"""
            <div class="checklist-item">
                <div>
                    <div class="ci-label">{a_name}</div>
                    {f'<div class="ci-desc">{a_desc}</div>' if a_desc else ''}
                </div>
                <div class="ci-value">{display_value}</div>
            </div>"""

        desc_html = f'<div class="cl-desc">{cl_desc}</div>' if cl_desc else ""
        blocks.append(f"""
        <div class="checklist-block">
            <div class="checklist-header">
                <div class="cl-name">{cl_name}</div>
                {desc_html}
            </div>
            {items_html}
        </div>""")

    return "\n".join(blocks)


def build_lab_processing_html(record: dict) -> str:
    document_number = coerce_str(record.get("document_number"))
    reason_db = coerce_str(record.get("reason", "maintenance"))
    reason_label = REASON_DB_TO_UI.get(reason_db, reason_db)
    owner_name = coerce_str(record.get("owner_name"))
    entry_date = _format_date(record.get("entry_date"))
    processing_date = _format_date(record.get("processing_date"))
    processing_observations = coerce_str(record.get("processing_observations"))
    checklists = record.get("processing_checklists") or []

    asset = record.get("asset") or {}
    asset_class = coerce_str(asset.get("className") or record.get("asset_class"))
    asset_name = coerce_str(asset.get("name") or record.get("asset_name"))
    asset_code = coerce_str(asset.get("code") or record.get("asset_code"))
    asset_serial = coerce_str(asset.get("serial") or record.get("asset_serial"))
    asset_org = coerce_str(asset.get("organization") or record.get("asset_organization"))
    asset_location = coerce_str(asset.get("location") or record.get("asset_location"))

    asset_meta_parts = [p for p in [
        f"Codigo: {asset_code}" if asset_code else None,
        f"Serie: {asset_serial}" if asset_serial else None,
        f"Org: {asset_org}" if asset_org else None,
        f"Locacion: {asset_location}" if asset_location else None,
    ] if p]
    asset_meta_html = " &nbsp;|&nbsp; ".join(_escape(p) for p in asset_meta_parts) or "Sin informacion adicional"

    obs_html = (
        f'<div class="observations-box">{_escape(processing_observations)}</div>'
        if processing_observations
        else '<div class="observations-box observations-empty">Sin observaciones registradas.</div>'
    )

    checklists_html = _build_checklists_html(checklists)
    org_header = _build_org_header("Fase de Procesamiento", "phase-processing", document_number)
    now_str = datetime.now().strftime("%d-%m-%Y %H:%M")

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>{_get_base_css()}</style>
</head>
<body>
<div class="page">
    {org_header}

    <div class="section">
        <div class="section-title">Identificacion del acta</div>
        <div class="info-grid info-grid-3">
            <div class="field">
                <label>Numero de acta</label>
                <div class="value">{_escape(document_number)}</div>
            </div>
            <div class="field">
                <label>Motivo</label>
                <div class="value"><span class="reason-badge">{_escape(reason_label)}</span></div>
            </div>
            <div class="field">
                <label>Especialista</label>
                <div class="value">{_escape(owner_name) or '<span class="value-empty">Sin registrar</span>'}</div>
            </div>
        </div>
        <div class="info-grid" style="margin-top:12px;">
            <div class="field">
                <label>Fecha de ingreso</label>
                <div class="value">{_escape(entry_date)}</div>
            </div>
            <div class="field">
                <label>Fecha de procesamiento</label>
                <div class="value">{_escape(processing_date) if processing_date != "—" else '<span style="color:#bbb">Sin registrar</span>'}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Activo analizado</div>
        <div class="asset-box">
            <div class="asset-class">{_escape(asset_class) or "Activo"}</div>
            <div class="asset-name">{_escape(asset_name) or "Sin identificar"}</div>
            <div class="asset-meta">{asset_meta_html}</div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Observaciones de procesamiento</div>
        {obs_html}
    </div>

    <div class="section">
        <div class="section-title">Checklists de procesamiento</div>
        {checklists_html}
    </div>

    <div class="signature-area">
        <div class="sig-block">
            <div class="sig-label">Especialista de laboratorio</div>
            <div class="sig-line">{_escape(owner_name) or "&nbsp;"}</div>
        </div>
        <div class="sig-block">
            <div class="sig-label">Supervisor / Validador</div>
            <div class="sig-line">&nbsp;</div>
        </div>
    </div>

    <div class="footer-meta">
        <span class="generated">Generado: {now_str}</span>
        <span class="generated">{_escape(document_number)} — Procesamiento</span>
    </div>
</div>
</body>
</html>"""
