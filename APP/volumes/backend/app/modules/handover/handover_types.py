from __future__ import annotations

from dataclasses import dataclass
from typing import Any
import unicodedata

from modules.settings.service import is_requirement_ticket_enabled


@dataclass(frozen=True)
class HandoverTypeDefinition:
    code: str
    label: str
    prefix_setting_key: str
    default_prefix: str
    main_title: str
    main_subtitle: str
    main_code_label: str
    main_reason_section_title: str
    main_reason_label: str
    main_notes_label: str
    main_asset_section_title: str
    main_signature_receiver_label: str
    main_signature_issuer_label: str
    detail_title: str
    detail_subtitle: str
    detail_code_label: str
    itop_document_type_names: tuple[str, ...]
    available_in_bootstrap: bool = True
    requires_stock_assignment: bool = True
    allow_additional_receivers: bool = True
    asset_selection_mode: str = "stock_unassigned"
    evidence_sync_mode: str = "assign_to_receiver"
    sync_assignment_on_evidence: bool = True
    attach_documents_on_evidence: bool = True


def _normalize_lookup_value(value: Any) -> str:
    text = "" if value is None else str(value).strip()
    if not text:
        return ""
    return (
        unicodedata.normalize("NFD", text)
        .encode("ascii", "ignore")
        .decode("ascii")
        .strip()
        .lower()
    )


HANDOVER_TYPE_DEFINITIONS: dict[str, HandoverTypeDefinition] = {
    "initial_assignment": HandoverTypeDefinition(
        code="initial_assignment",
        label="Entrega inicial",
        prefix_setting_key="handoverPrefix",
        default_prefix="ENT",
        main_title="Acta de Entrega de Activos",
        main_subtitle="Documento emitido desde iTop HUB",
        main_code_label="Codigo de acta",
        main_reason_section_title="Descripción y observaciones del acta",
        main_reason_label="Motivo de entrega",
        main_notes_label="Observaciones",
        main_asset_section_title="Detalle de activos entregados",
        main_signature_receiver_label="Responsable de aceptación",
        main_signature_issuer_label="Emisor / responsable de entrega",
        detail_title="Anexo de Revision y Preparacion",
        detail_subtitle="Detalle tecnico separado del acta principal",
        detail_code_label="Referencia acta",
        itop_document_type_names=("Acta de Entrega", "Acta", "Aprobacion Equipos"),
        asset_selection_mode="stock_unassigned",
        evidence_sync_mode="assign_to_receiver",
    ),
    "return": HandoverTypeDefinition(
        code="return",
        label="Devolucion",
        prefix_setting_key="handoverReturnPrefix",
        default_prefix="DEV",
        main_title="Acta de Devolucion de Activos",
        main_subtitle="Documento emitido desde iTop HUB",
        main_code_label="Codigo de acta",
        main_reason_section_title="Descripción y observaciones del acta",
        main_reason_label="Motivo de devolucion",
        main_notes_label="Observaciones",
        main_asset_section_title="Detalle de activos devueltos",
        main_signature_receiver_label="Responsable de conformidad",
        main_signature_issuer_label="Responsable de recepcion / devolucion",
        detail_title="Anexo Tecnico de Devolucion",
        detail_subtitle="Detalle tecnico separado del acta principal",
        detail_code_label="Referencia acta",
        itop_document_type_names=("Acta de Devolucion", "Acta", "Aprobacion Equipos"),
        requires_stock_assignment=False,
        allow_additional_receivers=False,
        asset_selection_mode="assigned_to_receiver",
        evidence_sync_mode="return_to_inventory",
    ),
    "reassignment": HandoverTypeDefinition(
        code="reassignment",
        label="Reasignacion",
        prefix_setting_key="handoverReassignmentPrefix",
        default_prefix="REA",
        main_title="Acta de Reasignacion de Activos",
        main_subtitle="Documento emitido desde iTop HUB",
        main_code_label="Codigo de acta",
        main_reason_section_title="Descripción y observaciones del acta",
        main_reason_label="Motivo de reasignacion",
        main_notes_label="Observaciones",
        main_asset_section_title="Detalle de activos reasignados",
        main_signature_receiver_label="Responsable de aceptación",
        main_signature_issuer_label="Responsable de reasignacion",
        detail_title="Anexo Tecnico de Reasignacion",
        detail_subtitle="Detalle tecnico separado del acta principal",
        detail_code_label="Referencia acta",
        itop_document_type_names=("Acta de Reasignacion", "Acta", "Aprobacion Equipos"),
        requires_stock_assignment=False,
        asset_selection_mode="assigned_to_receiver",
        evidence_sync_mode="assign_to_receiver",
    ),
    "replacement": HandoverTypeDefinition(
        code="replacement",
        label="Reposicion",
        prefix_setting_key="handoverReplacementPrefix",
        default_prefix="REP",
        main_title="Acta de Reposicion de Activos",
        main_subtitle="Documento emitido desde iTop HUB",
        main_code_label="Codigo de acta",
        main_reason_section_title="Descripción y observaciones del acta",
        main_reason_label="Motivo de reposicion",
        main_notes_label="Observaciones",
        main_asset_section_title="Detalle de activos repuestos",
        main_signature_receiver_label="Responsable de aceptación",
        main_signature_issuer_label="Emisor / responsable de reposicion",
        detail_title="Anexo Tecnico de Reposicion",
        detail_subtitle="Detalle tecnico separado del acta principal",
        detail_code_label="Referencia acta",
        itop_document_type_names=("Acta de Reposicion", "Acta", "Aprobacion Equipos"),
        asset_selection_mode="stock_unassigned",
        evidence_sync_mode="assign_to_receiver",
    ),
    "normalization": HandoverTypeDefinition(
        code="normalization",
        label="Normalizacion",
        prefix_setting_key="handoverNormalizationPrefix",
        default_prefix="NOR",
        main_title="Acta de Normalizacion de Activos",
        main_subtitle="Documento emitido desde iTop HUB",
        main_code_label="Codigo de acta",
        main_reason_section_title="Descripción y observaciones del acta",
        main_reason_label="Motivo de normalizacion",
        main_notes_label="Observaciones",
        main_asset_section_title="Detalle de activos normalizados",
        main_signature_receiver_label="Responsable de conformidad",
        main_signature_issuer_label="Responsable de normalizacion",
        detail_title="Anexo Tecnico de Normalizacion",
        detail_subtitle="Detalle tecnico separado del acta principal",
        detail_code_label="Referencia acta",
        itop_document_type_names=("Acta de Normalizacion", "Acta"),
        available_in_bootstrap=False,
        requires_stock_assignment=False,
        asset_selection_mode="none",
        evidence_sync_mode="none",
        sync_assignment_on_evidence=False,
    ),
    "laboratory": HandoverTypeDefinition(
        code="laboratory",
        label="Laboratorio",
        prefix_setting_key="handoverLaboratoryPrefix",
        default_prefix="LAB",
        main_title="Acta de Laboratorio",
        main_subtitle="Documento emitido desde iTop HUB",
        main_code_label="Codigo de acta",
        main_reason_section_title="Descripción y observaciones del acta",
        main_reason_label="Motivo de laboratorio",
        main_notes_label="Observaciones",
        main_asset_section_title="Detalle de activos en laboratorio",
        main_signature_receiver_label="Responsable de conformidad",
        main_signature_issuer_label="Responsable de laboratorio",
        detail_title="Anexo Tecnico de Laboratorio",
        detail_subtitle="Detalle tecnico separado del acta principal",
        detail_code_label="Referencia acta",
        itop_document_type_names=("Acta de Laboratorio", "Acta"),
        available_in_bootstrap=False,
        requires_stock_assignment=False,
        asset_selection_mode="none",
        evidence_sync_mode="none",
        sync_assignment_on_evidence=False,
    ),
}

_HANDOVER_TYPE_BY_NORMALIZED_LABEL = {
    _normalize_lookup_value(definition.label): definition
    for definition in HANDOVER_TYPE_DEFINITIONS.values()
}


def find_handover_type_definition(value: Any) -> HandoverTypeDefinition | None:
    text = "" if value is None else str(value).strip()
    if not text:
        return None

    if text in HANDOVER_TYPE_DEFINITIONS:
        return HANDOVER_TYPE_DEFINITIONS[text]

    normalized = _normalize_lookup_value(text)
    if text.replace(" ", "_").lower() in HANDOVER_TYPE_DEFINITIONS:
        return HANDOVER_TYPE_DEFINITIONS[text.replace(" ", "_").lower()]
    return _HANDOVER_TYPE_BY_NORMALIZED_LABEL.get(normalized)


def get_handover_type_definition(value: Any, *, default_code: str = "initial_assignment") -> HandoverTypeDefinition:
    definition = find_handover_type_definition(value)
    if definition is not None:
        return definition
    return HANDOVER_TYPE_DEFINITIONS[default_code]


def list_handover_type_definitions(*, include_internal: bool = True) -> list[HandoverTypeDefinition]:
    items = list(HANDOVER_TYPE_DEFINITIONS.values())
    if include_internal:
        return items
    return [item for item in items if item.available_in_bootstrap]


def list_handover_type_options(*, include_internal: bool = False) -> list[dict[str, str]]:
    return [
        {"value": definition.code, "label": definition.label}
        for definition in list_handover_type_definitions(include_internal=include_internal)
    ]


def resolve_handover_prefix(docs_settings: dict[str, Any], handover_type: Any) -> str:
    definition = get_handover_type_definition(handover_type)
    configured_prefix = str(docs_settings.get(definition.prefix_setting_key) or "").strip()
    return configured_prefix or definition.default_prefix


def serialize_handover_type_catalog(
    docs_settings: dict[str, Any] | None = None,
    *,
    include_internal: bool = True,
) -> list[dict[str, Any]]:
    resolved_settings = docs_settings if docs_settings is not None else {}
    requires_itop_ticket = is_requirement_ticket_enabled(docs_settings)
    return [
        {
            "code": definition.code,
            "label": definition.label,
            "prefix": resolve_handover_prefix(resolved_settings, definition.code),
            "availableInBootstrap": definition.available_in_bootstrap,
            "requiresStockAssignment": definition.requires_stock_assignment,
            "requiresItopTicketOnEvidence": requires_itop_ticket,
            "syncAssignmentOnEvidence": definition.sync_assignment_on_evidence,
            "attachDocumentsOnEvidence": definition.attach_documents_on_evidence,
            "mainTitle": definition.main_title,
            "detailTitle": definition.detail_title,
        }
        for definition in list_handover_type_definitions(include_internal=include_internal)
    ]
