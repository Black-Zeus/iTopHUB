from __future__ import annotations

import base64
from datetime import datetime
from html import escape
from io import BytesIO
from pathlib import Path
from typing import Any
import unicodedata

from PIL import Image, ImageDraw, ImageFont

from modules.handover.handover_types import HANDOVER_DOCUMENT_LEGEND_TOKEN, get_handover_type_definition
from modules.settings.service import get_settings_panel, read_organization_logo_data_url


AGENT_SIGNATURE_STAMP_PATH = Path(__file__).resolve().parents[1] / "signature" / "assets" / "TimbreFirma.png"


def _coerce_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


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


def _join_non_empty(parts: list[Any], separator: str = " / ") -> str:
    return separator.join(_coerce_str(part) for part in parts if _coerce_str(part))


def _build_asset_heading(asset: dict[str, Any]) -> str:
    class_name = _coerce_str(asset.get("className"), "Activo")
    asset_name = _build_asset_display_name(asset)
    if asset_name and asset_name != "Activo sin identificar":
        return f"{class_name} - {asset_name}"
    return class_name


def _build_asset_display_name(asset: dict[str, Any]) -> str:
    return _coerce_str(asset.get("name") or asset.get("code"), "Activo sin identificar")


def _format_check_answer_value(answer: dict[str, Any]) -> str:
    answer_type = _coerce_str(answer.get("type"))
    value = answer.get("value")
    if answer_type == "Check":
        return "Sí" if bool(value) else "No"
    return _coerce_str(value)


def _normalize_label(value: Any) -> str:
    text = _coerce_str(value)
    if not text:
        return ""
    return (
        unicodedata.normalize("NFD", text)
        .encode("ascii", "ignore")
        .decode("ascii")
        .strip()
        .lower()
    )


def _build_field_lookup(fields: list[dict[str, Any]] | None) -> dict[str, str]:
    lookup: dict[str, str] = {}
    for field in fields or []:
        if not isinstance(field, dict):
            continue
        label = _normalize_label(field.get("label"))
        value = _coerce_str(field.get("value"))
        if label and value and label not in lookup:
            lookup[label] = value
    return lookup


def _find_field_value(field_lookup: dict[str, str], *labels: str) -> str:
    for label in labels:
        value = field_lookup.get(_normalize_label(label))
        if value:
            return value
    return ""


def _is_computer_asset(asset: dict[str, Any], itop_detail: dict[str, Any] | None = None) -> bool:
    candidates = [
        _coerce_str((itop_detail or {}).get("className")),
        _coerce_str(asset.get("className")),
    ]
    normalized = " ".join(_normalize_label(value) for value in candidates if _coerce_str(value))
    return any(token in normalized for token in ("laptop", "desktop", "pc", "notebook"))


def _build_brand_model_value(field_lookup: dict[str, str], asset: dict[str, Any]) -> str:
    brand = _find_field_value(field_lookup, "Marca") or _coerce_str(asset.get("brand"))
    model = _find_field_value(field_lookup, "Modelo") or _coerce_str(asset.get("model"))
    return _join_non_empty([brand, model], " ")


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
            width: 100%;
        }}
        body {{
            margin: 0;
            padding: 0 26px 10px;
            width: 100%;
            box-sizing: border-box;
        }}
        .page-footer {{
            border-top: 1px solid #d7e1ec;
            box-sizing: border-box;
            display: grid;
            gap: 12px;
            grid-template-columns: 1fr 1fr 1fr;
            padding: 8px 10px 4px;
            align-items: center;
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


def _resolve_handover_document_legend(docs_settings: dict[str, Any]) -> str:
    if not bool(docs_settings.get("handoverDocumentLegendEnabled", True)):
        return ""
    return _coerce_str(docs_settings.get("handoverDocumentLegendText"), "Documento emitido desde iTop HUB")


def _resolve_document_subtitle(subtitle: str, docs_settings: dict[str, Any]) -> str:
    normalized_subtitle = _coerce_str(subtitle)
    if normalized_subtitle == HANDOVER_DOCUMENT_LEGEND_TOKEN:
        return _resolve_handover_document_legend(docs_settings)
    return normalized_subtitle


def _resolve_signature_owner_support_text(owner: dict[str, Any]) -> str:
    docs_settings = get_settings_panel("docs")
    return _coerce_str(owner.get("role")) or _resolve_handover_document_legend(docs_settings)


def _load_stamp_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype("DejaVuSans.ttf", size)
    except Exception:
        return ImageFont.load_default()


def _build_agent_signature_stamp_data_url(owner: dict[str, Any]) -> str:
    owner_name = _coerce_str(owner.get("name"))
    if not owner_name or not AGENT_SIGNATURE_STAMP_PATH.exists():
        return ""

    source = Image.open(AGENT_SIGNATURE_STAMP_PATH).convert("RGBA")
    draw = ImageDraw.Draw(source)
    width, height = source.size
    box_left = int(width * 0.18)
    box_right = int(width * 0.82)
    box_top = int(height * 0.38)
    box_bottom = int(height * 0.62)
    max_width = max(1, box_right - box_left)
    max_height = max(1, box_bottom - box_top)

    font = _load_stamp_font(max(14, int(width * 0.065)))
    while True:
        text_box = draw.textbbox((0, 0), owner_name, font=font)
        text_width = text_box[2] - text_box[0]
        text_height = text_box[3] - text_box[1]
        if (text_width <= max_width and text_height <= max_height) or getattr(font, "size", 14) <= 12:
            break
        next_size = max(12, getattr(font, "size", 14) - 2)
        if next_size == getattr(font, "size", 14):
            break
        font = _load_stamp_font(next_size)

    draw.text(
        (
            box_left + (max_width - text_width) / 2,
            box_top + (max_height - text_height) / 2 - text_box[1],
        ),
        owner_name,
        fill=(42, 59, 79, 255),
        font=font,
    )

    buffer = BytesIO()
    source.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _build_owner_signature_box(owner: dict[str, Any], signature_label: str) -> str:
    stamp_data_url = _build_agent_signature_stamp_data_url(owner)
    signature_image_html = (
        f'<div class="signature-image-wrap"><img src="{stamp_data_url}" alt="Firma del agente" class="signature-image" /></div>'
        if stamp_data_url
        else ""
    )
    signature_line_class = "signature-line signature-line-signed" if stamp_data_url else "signature-line"
    signature_meta_html = (
        '<div class="signature-meta">Firma aplicada automáticamente por el agente del Hub</div>'
        if stamp_data_url
        else ""
    )
    return f"""
        <div class="signature-box">
            {signature_image_html}
            <div class="{signature_line_class}">
                <div><strong>{_escape(owner.get("name"))}</strong></div>
                <div class="muted">{_escape(signature_label)}</div>
                <div class="muted">{_escape(_resolve_signature_owner_support_text(owner))}</div>
                {signature_meta_html}
            </div>
        </div>
    """


def _build_signer_observation_row(detail: dict[str, Any]) -> str:
    signer_observation = _coerce_str(detail.get("signerObservation"))
    if not signer_observation:
        return ""
    return (
        "<tr>"
        "<td class=\"label-cell\">Observación firmante</td>"
        f"<td>{_escape(signer_observation)}</td>"
        "</tr>"
    )


def _build_receiver_signature_box(detail: dict[str, Any], receiver: dict[str, Any], signature_label: str) -> str:
    signature_workflow = detail.get("signatureWorkflow") or {}
    signature_status = _coerce_str(signature_workflow.get("status")).lower()
    signature = signature_workflow.get("signature") if isinstance(signature_workflow.get("signature"), dict) else {}
    signed_by = signature_workflow.get("signedBy") if isinstance(signature_workflow.get("signedBy"), dict) else {}
    signature_data_url = _coerce_str(signature.get("dataUrl"))
    signed_at = _coerce_str(signature_workflow.get("completedAt"))

    signature_image_html = ""
    signature_meta_html = ""
    signature_line_class = "signature-line"
    if signature_status in {"signed", "published"} and signature_data_url:
        signature_image_html = (
            f'<div class="signature-image-wrap"><img src="{signature_data_url}" alt="Firma digital" class="signature-image" /></div>'
        )
        signature_meta_html = (
            f'<div class="signature-meta">Firmado digitalmente'
            f'{f" el {_escape(signed_at)}" if signed_at else ""}</div>'
        )
        signature_line_class = "signature-line signature-line-signed"

    signed_name = _coerce_str(signed_by.get("name")) or _coerce_str(receiver.get("name"))
    signed_role = _coerce_str(signed_by.get("role")) or _coerce_str(receiver.get("role")) or "Sin cargo"
    return f"""
        <div class="signature-box">
            {signature_image_html}
            <div class="{signature_line_class}">
                <div><strong>{_escape(signed_name)}</strong></div>
                <div class="muted">{_escape(signature_label)}</div>
                <div class="muted">{_escape(signed_role)}</div>
                {signature_meta_html}
            </div>
        </div>
    """


def _resolve_signature_target(detail: dict[str, Any], type_definition: Any) -> dict[str, Any]:
    if _coerce_str(getattr(type_definition, "code", "")).lower() != "normalization":
        return detail.get("receiver") or {}

    signature_workflow = detail.get("signatureWorkflow") if isinstance(detail.get("signatureWorkflow"), dict) else {}
    workflow_target = signature_workflow.get("signatureTarget") if isinstance(signature_workflow.get("signatureTarget"), dict) else {}
    if _coerce_str(workflow_target.get("name")):
        return workflow_target

    return _resolve_normalization_responsible(detail)


def _resolve_normalization_responsible(detail: dict[str, Any]) -> dict[str, Any]:
    requester_admin = detail.get("requesterAdmin") if isinstance(detail.get("requesterAdmin"), dict) else {}
    return {
        "userId": requester_admin.get("userId"),
        "id": requester_admin.get("itopPersonKey"),
        "name": _coerce_str(requester_admin.get("name")),
        "role": _coerce_str(requester_admin.get("role")) or "Administrador iTop Hub",
        "itopPersonKey": _coerce_str(requester_admin.get("itopPersonKey")),
    }


def _is_same_signature_actor(first: dict[str, Any], second: dict[str, Any]) -> bool:
    first_user_id = _coerce_str(first.get("userId"))
    second_user_id = _coerce_str(second.get("userId"))
    if first_user_id and second_user_id:
        return first_user_id == second_user_id

    first_person_key = _coerce_str(first.get("itopPersonKey") or first.get("id"))
    second_person_key = _coerce_str(second.get("itopPersonKey") or second.get("id"))
    if first_person_key and second_person_key:
        return first_person_key == second_person_key

    return _normalize_label(first.get("name")) == _normalize_label(second.get("name"))


def _build_delivery_signature_boxes(detail: dict[str, Any], type_definition: Any, owner: dict[str, Any]) -> str:
    is_normalization = _coerce_str(getattr(type_definition, "code", "")).lower() == "normalization"
    signature_target = _resolve_signature_target(detail, type_definition)
    if not is_normalization:
        return (
            _build_receiver_signature_box(detail, signature_target, type_definition.main_signature_receiver_label)
            + _build_owner_signature_box(owner, type_definition.main_signature_issuer_label)
        )

    if _is_same_signature_actor(owner, signature_target):
        return _build_receiver_signature_box(detail, signature_target, type_definition.main_signature_issuer_label)

    return (
        _build_receiver_signature_box(detail, signature_target, type_definition.main_signature_issuer_label)
        + _build_owner_signature_box(owner, "Agente emisor del acta")
    )


def _build_base_html(
    title: str,
    subtitle: str,
    code_label: str,
    code_value: str,
    body: str,
    generated_at: str,
    *,
    eyebrow: str = "Entrega de activos",
) -> tuple[str, str | None]:
    organization_settings = get_settings_panel("organization")
    docs_settings = get_settings_panel("docs")
    organization_name = _coerce_str(organization_settings.get("organizationName"), "iTop Hub")
    organization_acronym = _coerce_str(organization_settings.get("organizationAcronym"), "ITH")
    organization_logo = read_organization_logo_data_url(_coerce_str(organization_settings.get("organizationLogoPath")))
    page_size = _page_size_to_css(_coerce_str(docs_settings.get("pageSize"), "A4"))
    margin_top = max(0, int(docs_settings.get("marginTopMm") or 12))
    margin_right = max(0, int(docs_settings.get("marginRightMm") or 12))
    show_footer = bool(docs_settings.get("showFooter", True))
    margin_bottom = max(22 if show_footer else 8, int(docs_settings.get("marginBottomMm") or 22))
    margin_left = max(0, int(docs_settings.get("marginLeftMm") or 12))
    show_header = bool(docs_settings.get("showHeader", True))
    header_show_logo = bool(docs_settings.get("headerShowLogo", True))
    header_show_organization_name = bool(docs_settings.get("headerShowOrganizationName", True))
    footer_show_organization_name = bool(docs_settings.get("footerShowOrganizationName", True))
    footer_show_folio = bool(docs_settings.get("footerShowFolio", True))
    footer_show_page_number = bool(docs_settings.get("footerShowPageNumber", True))
    logo_html = (
        f'<img src="{organization_logo}" alt="{_escape(organization_name)}" style="max-width:84px;max-height:50px;object-fit:contain;display:block;margin:0 auto 6px;" />'
        if organization_logo
        else f'<div style="font-weight:700;color:#16324f;font-size:18px;">{_escape(organization_acronym or organization_name[:3])}</div>'
    )
    resolved_subtitle = _resolve_document_subtitle(subtitle, docs_settings)
    subtitle_parts = [part for part in (resolved_subtitle, organization_name if header_show_organization_name else "") if _coerce_str(part)]
    organization_subtitle = " · ".join(_escape(part) for part in subtitle_parts) or "&nbsp;"
    header_html = f"""
    <header class="header">
        <div class="header-grid">
            <div class="brand">
                {logo_html if header_show_logo else f'<div style="font-weight:700;color:#16324f;font-size:18px;margin-top:14px;">{_escape(organization_acronym or organization_name[:3])}</div>'}
                <div class="muted" style="margin-top:6px;">{_escape(organization_acronym or organization_name)}</div>
            </div>
            <div class="title">
                <span class="eyebrow">{_escape(eyebrow)}</span>
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
            padding: 0 2px;
            box-sizing: border-box;
            max-width: 100%;
        }}
        .header {{
            border: 1px solid var(--line-strong);
            border-radius: 14px;
            overflow: hidden;
            margin-bottom: 14px;
            width: 100%;
            max-width: 100%;
        }}
        .header-grid {{
            display: grid;
            grid-template-columns: 120px minmax(0, 1fr) minmax(180px, 30%);
            background: linear-gradient(180deg, #f9fbfe 0%, #f4f8fc 100%);
        }}
        .brand, .title, .folio {{
            min-height: 88px;
            padding: 14px;
            min-width: 0;
        }}
        .brand {{
            border-right: 1px solid var(--line);
            text-align: center;
            align-items: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }}
        .title {{
            border-right: 1px solid var(--line);
            display: flex;
            flex-direction: column;
            justify-content: center;
        }}
        .folio {{
            background: var(--soft-strong);
            display: flex;
            flex-direction: column;
            justify-content: center;
        }}
        .eyebrow, .label {{
            color: var(--muted);
            display: block;
            font-size: 11px;
            letter-spacing: .08em;
            margin-bottom: 4px;
            text-transform: uppercase;
        }}
        h1 {{
            color: var(--primary);
            font-size: 24px;
            line-height: 1.2;
            margin: 0;
        }}
        .subtitle {{
            color: var(--muted);
            font-size: 12px;
            margin-top: 6px;
        }}
        .folio-code {{
            color: var(--primary);
            font-size: 19px;
            font-weight: 700;
        }}
        .section {{
            border: 1px solid var(--line);
            border-radius: 10px;
            margin-bottom: 12px;
            overflow: hidden;
            width: 100%;
            max-width: 100%;
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
            width: 100%;
            max-width: 100%;
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
        .section-keep-together,
        .section-keep-together .section-body,
        .section-keep-together .signature-grid,
        .section-keep-together .signature-box {{
            break-inside: avoid;
            page-break-inside: avoid;
        }}
        .signature-box {{
            border: 1px solid var(--line);
            border-radius: 10px;
            min-height: 108px;
            padding: 10px;
            text-align: center;
            position: relative;
        }}
        .signature-line {{
            border-top: 1px solid var(--line-strong);
            margin-top: 52px;
            padding-top: 7px;
        }}
        .signature-line-signed {{
            margin-top: 18px;
        }}
        .signature-image-wrap {{
            align-items: center;
            display: flex;
            justify-content: center;
            min-height: 48px;
        }}
        .signature-image {{
            display: block;
            max-height: 56px;
            max-width: 180px;
            object-fit: contain;
        }}
        .signature-meta {{
            color: var(--muted);
            font-size: 9px;
            margin-top: 6px;
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
        .evidence-list {{
            display: grid;
            gap: 14px;
        }}
        .evidence-row {{
            align-items: stretch;
            border: 1px solid var(--line);
            border-radius: 12px;
            display: grid;
            gap: 12px;
            grid-template-columns: 400px minmax(0, 1fr);
            overflow: hidden;
            padding: 12px;
        }}
        .evidence-image {{
            background: #eef3f9;
            border: 1px solid var(--line);
            border-radius: 10px;
            height: 300px;
            object-fit: cover;
            width: 400px;
        }}
        .evidence-placeholder {{
            align-items: center;
            background: #f8fbff;
            border: 1px dashed var(--line-strong);
            border-radius: 10px;
            color: var(--muted);
            display: flex;
            font-size: 11px;
            height: 300px;
            justify-content: center;
            padding: 18px;
            text-align: center;
            width: 400px;
        }}
        .evidence-caption {{
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 0;
        }}
    </style>
</head>
<body>
    {header_html}
    {body}
</body>
</html>""", footer_html


def _build_handover_footer_note() -> str:
    docs_settings = get_settings_panel("docs")
    note = _coerce_str(docs_settings.get("handoverFooterNote")).strip()
    if not note:
        return ""
    return f'<p class="muted" style="font-size:11px; margin:12px 0 0; text-align:justify;">{_escape(note)}</p>'


def _resolve_document_owner(detail: dict[str, Any], type_definition: Any) -> dict[str, Any]:
    return detail.get("owner") or {}


def _get_reassignment_source_person(detail: dict[str, Any]) -> dict[str, Any]:
    additional_receivers = detail.get("additionalReceivers") or []
    for person in additional_receivers:
        if _normalize_label(person.get("assignmentRole")) == "responsable origen":
            return person
    return additional_receivers[0] if additional_receivers else {}


def _build_reassignment_footer_note() -> str:
    note = (
        "El firmante declara recibir la responsabilidad de los activos detallados en la presente acta, "
        "en la fecha indicada, aceptando la reasignacion efectuada y la informacion registrada. "
        "El responsable origen deja de mantener relacion activa sobre los activos indicados, quedando "
        "estos asociados al responsable destinatario conforme al registro del sistema."
    )
    return f'<p class="muted" style="font-size:11px; margin:12px 0 0; text-align:justify;">{_escape(note)}</p>'


def _resolve_person_responsibility(person: dict[str, Any], fallback: str = "Responsable") -> str:
    return _coerce_str(person.get("assignmentRole")) or fallback


def _build_responsibility_row_html(responsibility: str, person: dict[str, Any]) -> str:
    return f"""
        <tr>
            <td>{_escape(responsibility)}</td>
            <td>{_escape(person.get("name"))}</td>
            <td>{_escape(person.get("role"))}</td>
        </tr>
    """


def _build_delivery_responsible_rows(detail: dict[str, Any], type_definition: Any, owner: dict[str, Any]) -> list[str]:
    receiver = detail.get("receiver") or {}
    additional_receivers = detail.get("additionalReceivers") or []
    is_normalization = _coerce_str(getattr(type_definition, "code", "")).lower() == "normalization"

    rows: list[str] = []
    if is_normalization:
        normalization_responsible = _resolve_normalization_responsible(detail)
        rows.append(_build_responsibility_row_html(type_definition.main_signature_issuer_label, normalization_responsible))
        if _coerce_str(receiver.get("name")):
            rows.append(_build_responsibility_row_html("Persona vinculada", receiver))
    else:
        rows.append(_build_responsibility_row_html("Responsable", receiver))

    for item in additional_receivers:
        rows.append(_build_responsibility_row_html(_resolve_person_responsibility(item, "Contacto adicional"), item))
    return rows


def _build_reassignment_person_rows(person: dict[str, Any], *, responsibility: str) -> list[tuple[str, str]]:
    return [
        ("Responsabilidad", responsibility or "Sin dato"),
        ("Nombre", _coerce_str(person.get("name")) or "Sin dato"),
        ("Cargo", _coerce_str(person.get("role")) or "Sin dato"),
    ]


def _build_reassignment_person_block(title: str, person: dict[str, Any], *, responsibility: str) -> str:
    rows_html = "".join(
        f"<tr><td class=\"label-cell\">{_escape(label)}</td><td>{_escape(value)}</td></tr>"
        for label, value in _build_reassignment_person_rows(person, responsibility=responsibility)
    )
    return f"""
    <div class="block-space">
        <h3 class="subsection-title">{_escape(title)}</h3>
        <table>
            <tbody>{rows_html}</tbody>
        </table>
    </div>
    """


def _build_return_main_html(detail: dict[str, Any], type_definition: Any) -> tuple[str, str | None]:
    document_number = _coerce_str(detail.get("documentNumber"))
    generated_at = _format_datetime_label(detail.get("assignmentDate") or detail.get("generatedAt") or detail.get("creationDate"))
    receiver = detail.get("receiver") or {}
    items = detail.get("items") or []
    owner = _resolve_document_owner(detail, type_definition)

    asset_rows: list[str] = []
    for index, item in enumerate(items, start=1):
        asset = item.get("asset") or {}
        asset_rows.append(
            f"""
            <tr>
                <td>{index}</td>
                <td>{_escape(asset.get("className"))}</td>
                <td>{_escape(_build_asset_display_name(asset))}</td>
                <td>{_escape(_join_non_empty([asset.get("brand"), asset.get("model")]))}</td>
                <td>{_escape(asset.get("serial") or asset.get("code"))}</td>
                <td>1</td>
            </tr>
            """
        )
    if not asset_rows:
        asset_rows.append(
            """
            <tr>
                <td colspan="6">Sin activos registrados.</td>
            </tr>
            """
        )

    body = f"""
    <section class="section">
        <h2 class="section-title">Responsable de devolucion</h2>
        <div class="section-body">
            <table>
                <thead>
                    <tr>
                        <th style="width:34%;">Responsabilidad</th>
                        <th style="width:33%;">Nombre</th>
                        <th style="width:33%;">Cargo</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Responsable</td>
                        <td>{_escape(receiver.get("name"))}</td>
                        <td>{_escape(receiver.get("role"))}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>

    <section class="section">
        <h2 class="section-title">{_escape(type_definition.main_reason_section_title)}</h2>
        <div class="section-body">
            <table>
                <tbody>
                    <tr>
                        <td class="label-cell">{_escape(type_definition.main_reason_label)}</td>
                        <td>{_escape(detail.get("reason"))}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">{_escape(type_definition.main_notes_label)}</td>
                        <td>{_escape(detail.get("notes"))}</td>
                    </tr>
                    {_build_signer_observation_row(detail)}
                </tbody>
            </table>
        </div>
    </section>

    <section class="section">
        <h2 class="section-title">{_escape(type_definition.main_asset_section_title)}</h2>
        <div class="section-body">
            <table>
                <thead>
                    <tr>
                        <th style="width:8%;">#</th>
                        <th style="width:14%;">Tipo</th>
                        <th style="width:29%;">Activo</th>
                        <th style="width:21%;">Marca / Modelo</th>
                        <th style="width:18%;">Serie / Identificador</th>
                        <th style="width:10%;">Cantidad</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(asset_rows)}
                </tbody>
            </table>
        </div>
    </section>

    <section class="section section-keep-together">
        <h2 class="section-title">Recepcion y conformidad</h2>
        <div class="section-body">
            <div class="signature-grid">
                {_build_receiver_signature_box(detail, receiver, type_definition.main_signature_receiver_label)}
                {_build_owner_signature_box(owner, type_definition.main_signature_issuer_label)}
            </div>
            {_build_handover_footer_note()}
        </div>
    </section>
    """
    return _build_base_html(
        title=type_definition.main_title,
        subtitle=type_definition.main_subtitle,
        code_label=type_definition.main_code_label,
        code_value=document_number,
        body=body,
        generated_at=generated_at,
        eyebrow="Devolucion de activos",
    )


def _build_reassignment_main_html(detail: dict[str, Any], type_definition: Any) -> tuple[str, str | None]:
    document_number = _coerce_str(detail.get("documentNumber"))
    generated_at = _format_datetime_label(detail.get("assignmentDate") or detail.get("generatedAt") or detail.get("creationDate"))
    owner = _resolve_document_owner(detail, type_definition)
    source_person = _get_reassignment_source_person(detail)
    destination_person = detail.get("receiver") or {}
    items = detail.get("items") or []

    asset_rows: list[str] = []
    for index, item in enumerate(items, start=1):
        asset = item.get("asset") or {}
        asset_rows.append(
            f"""
            <tr>
                <td>{index}</td>
                <td>{_escape(asset.get("className"))}</td>
                <td>{_escape(_build_asset_display_name(asset))}</td>
                <td>{_escape(_join_non_empty([asset.get("brand"), asset.get("model")]))}</td>
                <td>{_escape(asset.get("serial") or asset.get("code"))}</td>
                <td>{_escape(item.get("notes") or "Sin observacion")}</td>
            </tr>
            """
        )
    if not asset_rows:
        asset_rows.append(
            """
            <tr>
                <td colspan="6">Sin activos registrados.</td>
            </tr>
            """
        )

    body = f"""
    <section class="section">
        <h2 class="section-title">Responsables de reasignacion</h2>
        <div class="section-body">
            <table>
                <thead>
                    <tr>
                        <th style="width:34%;">Responsabilidad</th>
                        <th style="width:33%;">Nombre</th>
                        <th style="width:33%;">Cargo</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Responsable origen</td>
                        <td>{_escape(source_person.get("name"))}</td>
                        <td>{_escape(source_person.get("role"))}</td>
                    </tr>
                    <tr>
                        <td>Responsable destino</td>
                        <td>{_escape(destination_person.get("name"))}</td>
                        <td>{_escape(destination_person.get("role"))}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>

    <section class="section">
        <h2 class="section-title">{_escape(type_definition.main_reason_section_title)}</h2>
        <div class="section-body">
            <table>
                <tbody>
                    <tr>
                        <td class="label-cell">{_escape(type_definition.main_reason_label)}</td>
                        <td>{_escape(detail.get("reason"))}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">{_escape(type_definition.main_notes_label)}</td>
                        <td>{_escape(detail.get("notes"))}</td>
                    </tr>
                    {_build_signer_observation_row(detail)}
                </tbody>
            </table>
        </div>
    </section>

    <section class="section">
        <h2 class="section-title">{_escape(type_definition.main_asset_section_title)}</h2>
        <div class="section-body">
            <table>
                <thead>
                    <tr>
                        <th style="width:7%;">#</th>
                        <th style="width:15%;">Tipo</th>
                        <th style="width:24%;">Activo</th>
                        <th style="width:18%;">Marca / Modelo</th>
                        <th style="width:16%;">Serie / Identificador</th>
                        <th style="width:20%;">Observacion</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(asset_rows)}
                </tbody>
            </table>
        </div>
    </section>

    <section class="section section-keep-together">
        <h2 class="section-title">Aceptacion y conformidad</h2>
        <div class="section-body">
            <div class="signature-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
                <div class="signature-box">
                    <div class="signature-line">
                        <div><strong>{_escape(source_person.get("name"))}</strong></div>
                        <div class="muted">Responsable origen</div>
                        <div class="muted">{_escape(source_person.get("role") or "Sin cargo")}</div>
                    </div>
                </div>
                {_build_receiver_signature_box(detail, destination_person, type_definition.main_signature_receiver_label)}
                {_build_owner_signature_box(owner, type_definition.main_signature_issuer_label)}
            </div>
            {_build_reassignment_footer_note()}
        </div>
    </section>
    """
    return _build_base_html(
        title=type_definition.main_title,
        subtitle=type_definition.main_subtitle,
        code_label=type_definition.main_code_label,
        code_value=document_number,
        body=body,
        generated_at=generated_at,
        eyebrow="Reasignacion de activos",
    )


def _build_reassignment_detail_html(detail: dict[str, Any], type_definition: Any) -> tuple[str, str | None]:
    detail_number = build_detail_document_number(_coerce_str(detail.get("documentNumber")))
    generated_at = _format_datetime_label(detail.get("assignmentDate") or detail.get("generatedAt") or detail.get("creationDate"))
    source_person = _get_reassignment_source_person(detail)
    destination_person = detail.get("receiver") or {}

    blocks: list[str] = []
    for item in detail.get("items") or []:
        asset = item.get("asset") or {}
        itop_detail = item.get("itopAssetDetail") or {}
        field_lookup = _build_field_lookup(itop_detail.get("fields"))
        is_computer = _is_computer_asset(asset, itop_detail)

        if is_computer:
            specification_rows = [
                ("Serie", _find_field_value(field_lookup, "Numero de serie", "Serie") or _coerce_str(asset.get("serial")) or _coerce_str(asset.get("code")) or "Sin dato"),
                ("Marca / Modelo", _build_brand_model_value(field_lookup, asset) or "Sin dato"),
                ("CPU", _find_field_value(field_lookup, "Procesador", "CPU") or "Sin dato"),
                ("RAM", _find_field_value(field_lookup, "RAM") or "Sin dato"),
                ("Sistema Operativo", _find_field_value(field_lookup, "Sistema operativo", "Operating System") or "Sin dato"),
            ]
        else:
            specification_rows = [
                ("Activo", _coerce_str(itop_detail.get("name")) or _build_asset_display_name(asset)),
                ("Codigo", _coerce_str(itop_detail.get("code")) or _coerce_str(asset.get("code"))),
                ("Serie", _find_field_value(field_lookup, "Numero de serie", "Serie") or _coerce_str(asset.get("serial")) or _coerce_str(asset.get("code"))),
                ("Marca / Modelo", _build_brand_model_value(field_lookup, asset)),
                ("Clase CMDB", _coerce_str(itop_detail.get("className")) or _coerce_str(asset.get("className"))),
                ("Estado", _coerce_str(itop_detail.get("status")) or _coerce_str(asset.get("status"))),
            ]
        specification_html = "".join(
            f"<tr><td class=\"label-cell\">{_escape(label)}</td><td>{_escape(value)}</td></tr>"
            for label, value in specification_rows
            if _coerce_str(value)
        )

        transfer_block = f"""
        {_build_reassignment_person_block("Responsable origen", source_person, responsibility="Responsable origen")}
        {_build_reassignment_person_block("Responsable destino", destination_person, responsibility="Responsable destino")}
        <div class="block-space">
            <h3 class="subsection-title">Trazabilidad de reasignacion</h3>
            <table>
                <tbody>
                    <tr><td class="label-cell">Observacion</td><td>{_escape(item.get('notes') or 'Sin observacion registrada')}</td></tr>
                </tbody>
            </table>
        </div>
        """

        blocks.append(
            f"""
            <section class="section">
                <h2 class="section-title">{_escape(_build_asset_heading(asset))}</h2>
                <div class="section-body">
                    <div class="block-space">
                        <h3 class="subsection-title">Especificaciones</h3>
                        <table>
                            <tbody>{specification_html}</tbody>
                        </table>
                    </div>
                    {transfer_block}
                </div>
            </section>
            """
        )

    return _build_base_html(
        title=type_definition.detail_title,
        subtitle=type_definition.detail_subtitle,
        code_label=type_definition.detail_code_label,
        code_value=detail_number,
        body="".join(blocks),
        generated_at=generated_at,
        eyebrow="Reasignacion de activos",
    )


def _build_return_detail_html(detail: dict[str, Any], type_definition: Any) -> tuple[str, str | None]:
    detail_number = build_detail_document_number(_coerce_str(detail.get("documentNumber")))
    generated_at = _format_datetime_label(detail.get("assignmentDate") or detail.get("generatedAt") or detail.get("creationDate"))

    blocks: list[str] = []
    for item in detail.get("items") or []:
        asset = item.get("asset") or {}
        itop_detail = item.get("itopAssetDetail") or {}
        field_lookup = _build_field_lookup(itop_detail.get("fields"))
        is_computer = _is_computer_asset(asset, itop_detail)

        if is_computer:
            specification_rows = [
                ("Serie", _find_field_value(field_lookup, "Numero de serie", "Serie") or _coerce_str(asset.get("serial")) or _coerce_str(asset.get("code")) or "Sin dato"),
                ("Marca / Modelo", _build_brand_model_value(field_lookup, asset) or "Sin dato"),
                ("CPU", _find_field_value(field_lookup, "Procesador", "CPU") or "Sin dato"),
                ("RAM", _find_field_value(field_lookup, "RAM") or "Sin dato"),
                ("Sistema Operativo", _find_field_value(field_lookup, "Sistema operativo", "Operating System") or "Sin dato"),
            ]
        else:
            specification_rows = [
                ("Activo", _coerce_str(itop_detail.get("name")) or _build_asset_display_name(asset)),
                ("Codigo", _coerce_str(itop_detail.get("code")) or _coerce_str(asset.get("code"))),
                ("Serie", _find_field_value(field_lookup, "Numero de serie", "Serie") or _coerce_str(asset.get("serial")) or _coerce_str(asset.get("code"))),
                ("Marca / Modelo", _build_brand_model_value(field_lookup, asset)),
                ("Clase CMDB", _coerce_str(itop_detail.get("className")) or _coerce_str(asset.get("className"))),
                ("Estado", _coerce_str(itop_detail.get("status")) or _coerce_str(asset.get("status"))),
                ("Asignado a", _coerce_str(asset.get("assignedUser"))),
            ]
        specification_html = "".join(
            f"<tr><td class=\"label-cell\">{_escape(label)}</td><td>{_escape(value)}</td></tr>"
            for label, value in specification_rows
            if _coerce_str(value)
        )

        checklist_rows: list[str] = []
        checklists = item.get("checklists") or []
        multiple_checklists = len(checklists) > 1
        for checklist in checklists:
            template_name = _coerce_str(checklist.get("templateName"))
            if multiple_checklists and template_name:
                checklist_rows.append(
                    f"<tr><td class=\"label-cell\">Revision aplicada</td><td>{_escape(template_name)}</td></tr>"
                )
            for answer in checklist.get("answers") or []:
                answer_name = _coerce_str(answer.get("name"))
                answer_value = _format_check_answer_value(answer)
                if not answer_name and not answer_value:
                    continue
                checklist_rows.append(
                    f"<tr><td class=\"label-cell\">{_escape(answer_name or 'Ítem')}</td><td>{_escape(answer_value)}</td></tr>"
                )

        if _coerce_str(item.get("notes")):
            checklist_rows.append(
                f"<tr><td class=\"label-cell\">Observaciones</td><td>{_escape(item.get('notes'))}</td></tr>"
            )
        if not checklist_rows:
            checklist_rows.append(
                "<tr><td class=\"label-cell\">Revision</td><td>Sin validaciones registradas.</td></tr>"
            )

        checklist_block = f"""
        <div class="block-space">
            <h3 class="subsection-title">Revision de devolucion</h3>
            <table>
                <tbody>{''.join(checklist_rows)}</tbody>
            </table>
        </div>
        """

        evidence_rows: list[str] = []
        for evidence in item.get("evidences") or []:
            image_html = (
                f'<img class="evidence-image" src="{_escape(evidence.get("dataUrl"))}" alt="{_escape(evidence.get("caption") or asset.get("code") or asset.get("name"))}" />'
                if _coerce_str(evidence.get("dataUrl"))
                else '<div class="evidence-placeholder">Imagen no disponible para este PDF.</div>'
            )
            evidence_rows.append(
                f"""
                <div class="evidence-row">
                    {image_html}
                    <div class="evidence-caption">
                        <span class="label">Glosa</span>
                        <div>{_escape(evidence.get("caption"))}</div>
                    </div>
                </div>
                """
            )

        evidence_block = f"""
        <div class="block-space">
            <h3 class="subsection-title">Registro fotografico</h3>
            <div class="evidence-list">
                {''.join(evidence_rows)}
            </div>
        </div>
        """ if evidence_rows else ""

        blocks.append(
            f"""
            <section class="section">
                <h2 class="section-title">{_escape(_build_asset_heading(asset))}</h2>
                <div class="section-body">
                    <div class="block-space">
                        <h3 class="subsection-title">Especificaciones</h3>
                        <table>
                            <tbody>{specification_html}</tbody>
                        </table>
                    </div>
                    {checklist_block}
                    {evidence_block}
                </div>
            </section>
            """
        )

    return _build_base_html(
        title=type_definition.detail_title,
        subtitle=type_definition.detail_subtitle,
        code_label=type_definition.detail_code_label,
        code_value=detail_number,
        body="".join(blocks),
        generated_at=generated_at,
        eyebrow="Devolucion de activos",
    )


def _build_delivery_main_html(detail: dict[str, Any], type_definition: Any) -> tuple[str, str | None]:
    document_number = _coerce_str(detail.get("documentNumber"))
    generated_at = _format_datetime_label(detail.get("assignmentDate") or detail.get("generatedAt") or detail.get("creationDate"))
    receiver = detail.get("receiver") or {}
    items = detail.get("items") or []
    owner = _resolve_document_owner(detail, type_definition)
    is_normalization = _coerce_str(getattr(type_definition, "code", "")).lower() == "normalization"
    responsible_section_title = "Responsables de normalizacion" if is_normalization else "Responsables de aceptación y anexos"
    receiver_rows = _build_delivery_responsible_rows(detail, type_definition, owner)

    asset_rows: list[str] = []
    for index, item in enumerate(items, start=1):
        asset = item.get("asset") or {}
        asset_rows.append(
            f"""
            <tr>
                <td>{index}</td>
                <td>{_escape(asset.get("className"))}</td>
                <td>{_escape(_build_asset_display_name(asset))}</td>
                <td>{_escape(_join_non_empty([asset.get("brand"), asset.get("model")]))}</td>
                <td>{_escape(asset.get("serial") or asset.get("code"))}</td>
                <td>1</td>
            </tr>
            """
        )
    if not asset_rows:
        asset_rows.append(
            """
            <tr>
                <td colspan="6">Sin activos registrados.</td>
            </tr>
            """
        )

    body = f"""
    <section class="section">
        <h2 class="section-title">{_escape(responsible_section_title)}</h2>
        <div class="section-body">
            <table>
                <thead>
                    <tr>
                        <th style="width:34%;">Responsabilidad</th>
                        <th style="width:33%;">Nombre</th>
                        <th style="width:33%;">Cargo</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(receiver_rows)}
                </tbody>
            </table>
        </div>
    </section>

    <section class="section">
        <h2 class="section-title">{_escape(type_definition.main_reason_section_title)}</h2>
        <div class="section-body">
            <table>
                <tbody>
                    <tr>
                        <td class="label-cell">{_escape(type_definition.main_reason_label)}</td>
                        <td>{_escape(detail.get("reason"))}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">{_escape(type_definition.main_notes_label)}</td>
                        <td>{_escape(detail.get("notes"))}</td>
                    </tr>
                    {_build_signer_observation_row(detail)}
                </tbody>
            </table>
        </div>
    </section>

    <section class="section">
        <h2 class="section-title">{_escape(type_definition.main_asset_section_title)}</h2>
        <div class="section-body">
            <table>
                <thead>
                    <tr>
                        <th style="width:8%;">#</th>
                        <th style="width:14%;">Tipo</th>
                        <th style="width:29%;">Activo</th>
                        <th style="width:21%;">Marca / Modelo</th>
                        <th style="width:18%;">Serie / Identificador</th>
                        <th style="width:10%;">Cantidad</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(asset_rows)}
                </tbody>
            </table>
        </div>
    </section>

    <section class="section section-keep-together">
        <h2 class="section-title">Aceptación y conformidad</h2>
        <div class="section-body">
            <div class="signature-grid">
                {_build_delivery_signature_boxes(detail, type_definition, owner)}
            </div>
            {_build_handover_footer_note()}
        </div>
    </section>
    """
    return _build_base_html(
        title=type_definition.main_title,
        subtitle=type_definition.main_subtitle,
        code_label=type_definition.main_code_label,
        code_value=document_number,
        body=body,
        generated_at=generated_at,
        eyebrow="Entrega de activos",
    )


def _build_delivery_detail_html(detail: dict[str, Any], type_definition: Any) -> tuple[str, str | None]:
    detail_number = build_detail_document_number(_coerce_str(detail.get("documentNumber")))
    generated_at = _format_datetime_label(detail.get("assignmentDate") or detail.get("generatedAt") or detail.get("creationDate"))

    blocks: list[str] = []
    for item in detail.get("items") or []:
        asset = item.get("asset") or {}
        itop_detail = item.get("itopAssetDetail") or {}
        field_lookup = _build_field_lookup(itop_detail.get("fields"))
        is_computer = _is_computer_asset(asset, itop_detail)

        if is_computer:
            specification_rows = [
                ("Serie", _find_field_value(field_lookup, "Numero de serie", "Serie") or _coerce_str(asset.get("serial")) or _coerce_str(asset.get("code")) or "Sin dato"),
                ("Marca / Modelo", _build_brand_model_value(field_lookup, asset) or "Sin dato"),
                ("CPU", _find_field_value(field_lookup, "Procesador", "CPU") or "Sin dato"),
                ("RAM", _find_field_value(field_lookup, "RAM") or "Sin dato"),
                ("Sistema Operativo", _find_field_value(field_lookup, "Sistema operativo", "Operating System") or "Sin dato"),
            ]
        else:
            specification_rows = [
                ("Activo", _coerce_str(itop_detail.get("name")) or _build_asset_display_name(asset)),
                ("Codigo", _coerce_str(itop_detail.get("code")) or _coerce_str(asset.get("code"))),
                ("Serie", _find_field_value(field_lookup, "Numero de serie", "Serie") or _coerce_str(asset.get("serial")) or _coerce_str(asset.get("code"))),
                ("Marca / Modelo", _build_brand_model_value(field_lookup, asset)),
                ("Clase CMDB", _coerce_str(itop_detail.get("className")) or _coerce_str(asset.get("className"))),
                ("Estado", _coerce_str(itop_detail.get("status")) or _coerce_str(asset.get("status"))),
                ("Asignado a", _coerce_str(asset.get("assignedUser"))),
            ]
        specification_html = "".join(
            f"<tr><td class=\"label-cell\">{_escape(label)}</td><td>{_escape(value)}</td></tr>"
            for label, value in specification_rows
            if _coerce_str(value)
        )

        checklist_rows: list[str] = []
        checklists = item.get("checklists") or []
        multiple_checklists = len(checklists) > 1
        for checklist in checklists:
            template_name = _coerce_str(checklist.get("templateName"))
            if multiple_checklists and template_name:
                checklist_rows.append(
                    f"<tr><td class=\"label-cell\">Checklist aplicado</td><td>{_escape(template_name)}</td></tr>"
                )
            for answer in checklist.get("answers") or []:
                answer_name = _coerce_str(answer.get("name"))
                answer_value = _format_check_answer_value(answer)
                if not answer_name and not answer_value:
                    continue
                checklist_rows.append(
                    f"<tr><td class=\"label-cell\">{_escape(answer_name or 'Ítem')}</td><td>{_escape(answer_value)}</td></tr>"
                )

        if _coerce_str(item.get("notes")):
            checklist_rows.append(
                f"<tr><td class=\"label-cell\">Observaciones</td><td>{_escape(item.get('notes'))}</td></tr>"
            )
        if not checklist_rows:
            checklist_rows.append(
                "<tr><td class=\"label-cell\">Checklist</td><td>Sin validaciones registradas.</td></tr>"
            )

        checklist_block = f"""
        <div class="block-space">
            <h3 class="subsection-title">Checklist</h3>
            <table>
                <tbody>{''.join(checklist_rows)}</tbody>
            </table>
        </div>
        """

        blocks.append(
            f"""
            <section class="section">
                <h2 class="section-title">{_escape(_build_asset_heading(asset))}</h2>
                <div class="section-body">
                    <div class="block-space">
                        <h3 class="subsection-title">Especificaciones</h3>
                        <table>
                            <tbody>{specification_html}</tbody>
                        </table>
                    </div>
                    {checklist_block}
                </div>
            </section>
            """
        )

    return _build_base_html(
        title=type_definition.detail_title,
        subtitle=type_definition.detail_subtitle,
        code_label=type_definition.detail_code_label,
        code_value=detail_number,
        body="".join(blocks),
        generated_at=generated_at,
        eyebrow="Entrega de activos",
    )


_MAIN_TEMPLATE_BUILDERS = {
    "initial_assignment": _build_delivery_main_html,
    "return": _build_return_main_html,
    "reassignment": _build_reassignment_main_html,
    "replacement": _build_delivery_main_html,
    "normalization": _build_delivery_main_html,
    "laboratory": _build_delivery_main_html,
}

_DETAIL_TEMPLATE_BUILDERS = {
    "initial_assignment": _build_delivery_detail_html,
    "return": _build_return_detail_html,
    "reassignment": _build_reassignment_detail_html,
    "replacement": _build_delivery_detail_html,
    "normalization": _build_delivery_detail_html,
    "laboratory": _build_delivery_detail_html,
}


def build_handover_main_html(detail: dict[str, Any]) -> tuple[str, str | None]:
    type_definition = get_handover_type_definition(detail.get("handoverTypeCode") or detail.get("handoverType"))
    builder = _MAIN_TEMPLATE_BUILDERS.get(_coerce_str(type_definition.code), _build_delivery_main_html)
    return builder(detail, type_definition)


def build_handover_detail_html(detail: dict[str, Any]) -> tuple[str, str | None]:
    type_definition = get_handover_type_definition(detail.get("handoverTypeCode") or detail.get("handoverType"))
    builder = _DETAIL_TEMPLATE_BUILDERS.get(_coerce_str(type_definition.code), _build_delivery_detail_html)
    return builder(detail, type_definition)
