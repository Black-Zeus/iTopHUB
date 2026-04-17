from __future__ import annotations

from datetime import datetime
from html import escape
from pathlib import Path
from typing import Any

import requests
from fastapi import HTTPException

from core.config import settings
from modules.settings.service import get_settings_panel, read_organization_logo_data_url


HANDOVER_DOCUMENT_ROOT = Path("/app/data/handover_documents")


def _coerce_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _format_attachment_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{(size_bytes / 1024):.1f} KB"
    return f"{(size_bytes / (1024 * 1024)):.1f} MB"


def _escape(value: Any) -> str:
    return escape(_coerce_str(value))


def _format_datetime_label(value: Any) -> str:
    text = _coerce_str(value)
    if not text:
        return ""
    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(text, fmt).strftime("%d-%m-%Y %H:%M")
        except ValueError:
            continue
    return text


def _page_size_to_css(value: str) -> str:
    normalized = _coerce_str(value, "A4").upper()
    if normalized == "LETTER":
        return "Letter"
    if normalized == "LEGAL":
        return "Legal"
    return "A4"


def build_detail_document_number(document_number: str) -> str:
    parts = _coerce_str(document_number).split("-", 1)
    if len(parts) != 2 or not parts[0]:
        return f"{_coerce_str(document_number)}D"
    return f"{parts[0]}D-{parts[1]}"


def _build_footer_template(
    organization_name: str,
    code_value: str,
    footer_show_organization_name: bool,
    footer_show_folio: bool,
    footer_show_page_number: bool,
) -> str:
    left_html = _escape(organization_name) if footer_show_organization_name else "&nbsp;"
    center_html = f"Folio: {_escape(code_value)}" if footer_show_folio else "&nbsp;"
    right_html = (
        'Pagina <span class="pageNumber"></span> / <span class="totalPages"></span>'
        if footer_show_page_number
        else "&nbsp;"
    )
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <style>
        html {{
            -webkit-print-color-adjust: exact;
            color: #607080;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            margin: 0;
            padding: 0;
        }}
        body {{
            margin: 0;
            padding: 0;
        }}
        .page-footer {{
            border-top: 1px solid #d7e1ec;
            display: grid;
            gap: 12px;
            grid-template-columns: 1fr 1fr 1fr;
            padding-top: 6px;
            width: 100%;
        }}
        .page-footer-center {{
            text-align: center;
        }}
        .page-footer-right {{
            text-align: right;
        }}
    </style>
</head>
<body>
    <div class="page-footer">
        <div>{left_html}</div>
        <div class="page-footer-center">{center_html}</div>
        <div class="page-footer-right">{right_html}</div>
    </div>
</body>
</html>"""


def _build_base_html(title: str, subtitle: str, code_label: str, code_value: str, body: str, generated_at: str) -> tuple[str, str | None]:
    organization_settings = get_settings_panel("organization")
    docs_settings = get_settings_panel("docs")
    organization_name = _coerce_str(organization_settings.get("organizationName"), "iTop Hub")
    organization_acronym = _coerce_str(organization_settings.get("organizationAcronym"), "ITH")
    organization_logo = read_organization_logo_data_url(_coerce_str(organization_settings.get("organizationLogoPath")))
    page_size = _page_size_to_css(_coerce_str(docs_settings.get("pageSize"), "A4"))
    margin_top = max(0, int(docs_settings.get("marginTopMm") or 12))
    margin_right = max(0, int(docs_settings.get("marginRightMm") or 12))
    show_footer = bool(docs_settings.get("showFooter", True))
    margin_bottom = max(16 if show_footer else 8, int(docs_settings.get("marginBottomMm") or 18))
    margin_left = max(0, int(docs_settings.get("marginLeftMm") or 12))
    show_header = bool(docs_settings.get("showHeader", True))
    header_show_logo = bool(docs_settings.get("headerShowLogo", True))
    header_show_organization_name = bool(docs_settings.get("headerShowOrganizationName", True))
    footer_show_organization_name = bool(docs_settings.get("footerShowOrganizationName", True))
    footer_show_folio = bool(docs_settings.get("footerShowFolio", True))
    footer_show_page_number = bool(docs_settings.get("footerShowPageNumber", True))
    logo_html = (
        f'<img src="{organization_logo}" alt="{_escape(organization_name)}" style="max-width:56px;max-height:56px;object-fit:contain;" />'
        if organization_logo
        else f'<div style="font-weight:700;color:#16324f;font-size:18px;margin-top:14px;">{_escape(organization_acronym or organization_name[:3])}</div>'
    )
    organization_subtitle = _escape(subtitle)
    if header_show_organization_name:
        organization_subtitle = f"{organization_subtitle} · {_escape(organization_name)}"
    header_html = f"""
    <header class="header">
        <div class="header-grid">
            <div class="brand">
                {logo_html if header_show_logo else f'<div style="font-weight:700;color:#16324f;font-size:18px;margin-top:14px;">{_escape(organization_acronym or organization_name[:3])}</div>'}
                <div class="muted" style="margin-top:6px;">{_escape(organization_acronym or organization_name)}</div>
            </div>
            <div class="title">
                <span class="eyebrow">Entrega de activos</span>
                <h1>{_escape(title)}</h1>
                <div class="subtitle">{organization_subtitle}</div>
            </div>
            <div class="folio">
                <span class="label">{_escape(code_label)}</span>
                <div class="folio-code">{_escape(code_value)}</div>
                <span class="label" style="margin-top:8px;">Fecha</span>
                <div>{_escape(generated_at)}</div>
            </div>
        </div>
    </header>
    """ if show_header else ""
    footer_html = _build_footer_template(
        organization_name=organization_name,
        code_value=code_value,
        footer_show_organization_name=footer_show_organization_name,
        footer_show_folio=footer_show_folio,
        footer_show_page_number=footer_show_page_number,
    ) if show_footer else None
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <style>
        @page {{
            size: {page_size};
            margin: {margin_top}mm {margin_right}mm {margin_bottom}mm {margin_left}mm;
        }}
        :root {{
            --line: #d7e1ec;
            --line-strong: #b9c8d8;
            --text: #1f2a37;
            --muted: #607080;
            --primary: #16324f;
            --soft: #f7fafc;
            --soft-strong: #eaf2fb;
        }}
        * {{ box-sizing: border-box; }}
        body {{
            margin: 0;
            color: var(--text);
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 1.45;
            width: 100%;
        }}
        .header {{
            border: 1px solid var(--line-strong);
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 14px;
            max-width: 100%;
        }}
        .header-grid {{
            display: grid;
            grid-template-columns: 72px minmax(0, 1fr) 156px;
        }}
        .brand, .title, .folio {{
            min-height: 84px;
            padding: 12px;
            min-width: 0;
        }}
        .brand {{
            border-right: 1px solid var(--line);
            text-align: center;
            background: var(--soft);
        }}
        .title {{
            border-right: 1px solid var(--line);
        }}
        .folio {{
            background: var(--soft-strong);
        }}
        .eyebrow, .label {{
            color: var(--muted);
            display: block;
            font-size: 10px;
            letter-spacing: .08em;
            margin-bottom: 4px;
            text-transform: uppercase;
        }}
        h1 {{
            color: var(--primary);
            font-size: 22px;
            line-height: 1.2;
            margin: 0;
        }}
        .subtitle {{
            color: var(--muted);
            font-size: 11px;
            margin-top: 6px;
        }}
        .folio-code {{
            color: var(--primary);
            font-size: 18px;
            font-weight: 700;
        }}
        .section {{
            border: 1px solid var(--line);
            border-radius: 10px;
            margin-bottom: 12px;
            overflow: hidden;
        }}
        .section-title {{
            background: var(--soft);
            border-bottom: 1px solid var(--line);
            color: var(--primary);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: .06em;
            margin: 0;
            padding: 9px 12px;
            text-transform: uppercase;
        }}
        .section-body {{
            padding: 12px;
        }}
        table {{
            border-collapse: collapse;
            max-width: 100%;
            table-layout: fixed;
            width: 100%;
        }}
        th, td {{
            border: 1px solid var(--line);
            overflow-wrap: anywhere;
            padding: 7px 8px;
            text-align: left;
            vertical-align: top;
        }}
        th {{
            background: var(--soft);
            color: var(--primary);
            font-size: 10px;
            letter-spacing: .05em;
            text-transform: uppercase;
        }}
        .label-cell {{
            background: #fbfdff;
            font-weight: 700;
            width: 28%;
        }}
        .signature-grid {{
            display: grid;
            gap: 24px;
            grid-template-columns: 1fr 1fr;
            margin-top: 10px;
        }}
        .signature-box {{
            border: 1px solid var(--line);
            border-radius: 10px;
            min-height: 108px;
            padding: 10px;
            text-align: center;
        }}
        .signature-line {{
            border-top: 1px solid var(--line-strong);
            margin-top: 52px;
            padding-top: 7px;
        }}
        .muted {{
            color: var(--muted);
            font-size: 10px;
        }}
        .subsection-title {{
            background: var(--soft);
            border: 1px solid var(--line);
            border-radius: 7px;
            color: var(--primary);
            font-size: 10px;
            font-weight: 700;
            letter-spacing: .05em;
            margin: 0 0 8px 0;
            padding: 7px 8px;
            text-transform: uppercase;
        }}
        .block-space {{
            margin-bottom: 12px;
        }}
    </style>
</head>
<body>
    {header_html}
    {body}
</body>
</html>""", footer_html


def build_handover_main_html(detail: dict[str, Any]) -> tuple[str, str | None]:
    document_number = _coerce_str(detail.get("documentNumber"))
    generated_at = _format_datetime_label(detail.get("assignmentDate") or detail.get("generatedAt") or detail.get("creationDate"))
    receiver = detail.get("receiver") or {}
    additional_receivers = detail.get("additionalReceivers") or []
    items = detail.get("items") or []
    owner = detail.get("owner") or {}

    receiver_rows = [
        f"""
        <tr>
            <td>Responsable</td>
            <td>{_escape(receiver.get("name"))}</td>
            <td>{_escape(receiver.get("email"))}</td>
        </tr>
        """
    ]
    for item in additional_receivers:
        receiver_rows.append(
            f"""
            <tr>
                <td>{_escape(item.get("assignmentRole") or "Contacto adicional")}</td>
                <td>{_escape(item.get("name"))}</td>
                <td>{_escape(item.get("email"))}</td>
            </tr>
            """
        )

    asset_rows: list[str] = []
    for index, item in enumerate(items, start=1):
        asset = item.get("asset") or {}
        asset_rows.append(
            f"""
            <tr>
                <td>{index}</td>
                <td>{_escape(asset.get("className"))}</td>
                <td>{_escape(asset.get("name") or asset.get("code"))}</td>
                <td>{_escape(" / ".join(part for part in [_coerce_str(asset.get("brand")), _coerce_str(asset.get("model"))] if part))}</td>
                <td>{_escape(asset.get("serial") or asset.get("code"))}</td>
                <td>1</td>
            </tr>
            """
        )

    body = f"""
    <section class="section">
        <h2 class="section-title">Responsables de aceptacion y anexos</h2>
        <div class="section-body">
            <table>
                <thead>
                    <tr>
                        <th style="width:18%;">Tipo de responsabilidad</th>
                        <th style="width:36%;">Nombre</th>
                        <th style="width:46%;">Correo</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(receiver_rows)}
                </tbody>
            </table>
        </div>
    </section>

    <section class="section">
        <h2 class="section-title">Descripcion y observaciones del acta</h2>
        <div class="section-body">
            <table>
                <tbody>
                    <tr>
                        <td class="label-cell">Motivo</td>
                        <td>{_escape(detail.get("reason"))}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">Observaciones</td>
                        <td>{_escape(detail.get("notes"))}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>

    <section class="section">
        <h2 class="section-title">Detalle de activos entregados</h2>
        <div class="section-body">
            <table>
                <thead>
                    <tr>
                        <th style="width:7%;">#</th>
                        <th style="width:16%;">Tipo</th>
                        <th style="width:31%;">Activo</th>
                        <th style="width:22%;">Marca / Modelo</th>
                        <th style="width:16%;">Serie / Identificador</th>
                        <th style="width:8%;">Cantidad</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(asset_rows)}
                </tbody>
            </table>
        </div>
    </section>

    <section class="section">
        <h2 class="section-title">Aceptacion y conformidad</h2>
        <div class="section-body">
            <div class="signature-grid">
                <div class="signature-box">
                    <div class="signature-line">
                        <div><strong>{_escape(receiver.get("name"))}</strong></div>
                        <div class="muted">Responsable de aceptacion</div>
                        <div class="muted">{_escape(receiver.get("code"))} - {_escape(receiver.get("email"))}</div>
                    </div>
                </div>
                <div class="signature-box">
                    <div class="signature-line">
                        <div><strong>{_escape(owner.get("name"))}</strong></div>
                        <div class="muted">Emisor / responsable de entrega</div>
                        <div class="muted">Generado desde backend</div>
                    </div>
                </div>
            </div>
        </div>
    </section>
    """
    return _build_base_html(
        title="Acta de Entrega de Activos",
        subtitle="Documento emitido desde iTop HUB",
        code_label="Codigo de acta",
        code_value=document_number,
        body=body,
        generated_at=generated_at,
    )


def build_handover_detail_html(detail: dict[str, Any]) -> tuple[str, str | None]:
    detail_number = build_detail_document_number(_coerce_str(detail.get("documentNumber")))
    generated_at = _format_datetime_label(detail.get("assignmentDate") or detail.get("generatedAt") or detail.get("creationDate"))

    blocks: list[str] = []
    for item in detail.get("items") or []:
        asset = item.get("asset") or {}
        specification_rows = [
            ("Activo", asset.get("name") or asset.get("code")),
            ("Codigo", asset.get("code")),
            ("Serie", asset.get("serial") or asset.get("code")),
            ("Marca / Modelo", " / ".join(part for part in [_coerce_str(asset.get("brand")), _coerce_str(asset.get("model"))] if part)),
            ("Clase CMDB", asset.get("className")),
        ]
        specification_html = "".join(
            f"<tr><td class=\"label-cell\">{_escape(label)}</td><td>{_escape(value)}</td></tr>"
            for label, value in specification_rows
            if _coerce_str(value)
        )

        checklist_sections: list[str] = []
        for checklist in item.get("checklists") or []:
            answer_rows = "".join(
                f"<tr><td class=\"label-cell\">{_escape(answer.get('name'))}</td><td>{_escape('Si' if answer.get('type') == 'Check' and bool(answer.get('value')) else ('No' if answer.get('type') == 'Check' else answer.get('value')))}</td></tr>"
                for answer in checklist.get("answers") or []
            )
            checklist_sections.append(
                f"""
                <div class="block-space">
                    <h3 class="subsection-title">{_escape(checklist.get("templateName") or "Checklist")}</h3>
                    <table>
                        <tbody>{answer_rows}</tbody>
                    </table>
                </div>
                """
            )

        notes_block = ""
        if _coerce_str(item.get("notes")):
            notes_block = f"""
            <div class="block-space">
                <h3 class="subsection-title">Observaciones del item</h3>
                <table>
                    <tbody>
                        <tr>
                            <td>{_escape(item.get("notes"))}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            """

        blocks.append(
            f"""
            <section class="section">
                <h2 class="section-title">{_escape(asset.get('className') or 'Activo')} - {_escape(asset.get('code'))}</h2>
                <div class="section-body">
                    <div class="block-space">
                        <h3 class="subsection-title">Especificaciones</h3>
                        <table>
                            <tbody>{specification_html}</tbody>
                        </table>
                    </div>
                    {''.join(checklist_sections)}
                    {notes_block}
                </div>
            </section>
            """
        )

    return _build_base_html(
        title="Anexo de Revision y Preparacion",
        subtitle="Detalle tecnico separado del acta principal",
        code_label="Referencia acta",
        code_value=detail_number,
        body="".join(blocks),
        generated_at=generated_at,
    )


def _render_pdf_from_html(html: str, footer_html: str | None = None) -> bytes:
    headers = {}
    if settings.internal_api_secret:
        headers["X-Internal-Secret"] = settings.internal_api_secret

    try:
        response = requests.post(
            f"{settings.pdf_worker_url.rstrip('/')}/internal/render/html-to-pdf",
            json={"html": html, "footer_html": footer_html},
            headers=headers,
            timeout=60,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"No fue posible conectar con pdf-worker: {exc}") from exc

    if response.status_code >= 400:
        detail = ""
        try:
            payload = response.json()
            detail = _coerce_str(payload.get("detail"))
        except ValueError:
            detail = response.text.strip()
        raise HTTPException(
            status_code=502,
            detail=f"pdf-worker rechazo la generacion del PDF: {detail or response.status_code}",
        )

    if not response.content:
        raise HTTPException(status_code=502, detail="pdf-worker no devolvio contenido PDF.")
    return response.content


def remove_generated_handover_documents(document_id: int) -> None:
    storage_directory = HANDOVER_DOCUMENT_ROOT / f"document_{document_id}"
    if not storage_directory.exists():
        return
    for file_path in storage_directory.iterdir():
        if file_path.is_file():
            file_path.unlink(missing_ok=True)


def generate_handover_documents(document_id: int, detail: dict[str, Any]) -> list[dict[str, Any]]:
    generated_at = datetime.now().strftime("%Y-%m-%dT%H:%M")
    storage_directory = HANDOVER_DOCUMENT_ROOT / f"document_{document_id}"
    storage_directory.mkdir(parents=True, exist_ok=True)

    definitions = [
        {
            "kind": "main",
            "code": _coerce_str(detail.get("documentNumber")),
            "title": "Acta principal",
            "html": None,
            "footerHtml": None,
        },
        {
            "kind": "detail",
            "code": build_detail_document_number(_coerce_str(detail.get("documentNumber"))),
            "title": "Detalle de revision",
            "html": None,
            "footerHtml": None,
        },
    ]

    definitions[0]["html"], definitions[0]["footerHtml"] = build_handover_main_html(detail)
    definitions[1]["html"], definitions[1]["footerHtml"] = build_handover_detail_html(detail)

    created_files: list[Path] = []
    documents: list[dict[str, Any]] = []
    try:
        for definition in definitions:
            pdf_bytes = _render_pdf_from_html(definition["html"], definition["footerHtml"])
            stored_name = f"{definition['code']}.pdf"
            stored_path = storage_directory / stored_name
            stored_path.write_bytes(pdf_bytes)
            created_files.append(stored_path)
            documents.append(
                {
                    "kind": definition["kind"],
                    "title": definition["title"],
                    "code": definition["code"],
                    "name": stored_name,
                    "storedName": stored_name,
                    "mimeType": "application/pdf",
                    "size": _format_attachment_size(len(pdf_bytes)),
                    "source": f"{settings.env_name}/handover_documents/document_{document_id}/{stored_name}",
                    "uploadedAt": generated_at,
                }
            )
    except Exception:
        for file_path in created_files:
            file_path.unlink(missing_ok=True)
        raise

    return documents
