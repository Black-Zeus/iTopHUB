from __future__ import annotations

from typing import Any

from integrations.itop_cmdb_connector import iTopCMDBConnector


DEFAULT_DOCUMENT_TYPE_BASE_NAME = "Acta"
DOCUMENT_TYPE_STRATEGIES = {"single", "per_type"}
DOCUMENT_TYPE_DEFAULT_KEY = "default"
HANDOVER_DOCUMENT_TYPE_TARGETS = [
    {"key": "initial_assignment", "typeCode": "initial_assignment", "typeLabel": "Entrega inicial", "suffix": "Entrega"},
    {"key": "return", "typeCode": "return", "typeLabel": "Devolucion", "suffix": "Devolucion"},
    {"key": "reassignment", "typeCode": "reassignment", "typeLabel": "Reasignacion", "suffix": "Reasignacion"},
    {"key": "replacement", "typeCode": "replacement", "typeLabel": "Reposicion", "suffix": "Reposicion"},
    {"key": "normalization", "typeCode": "normalization", "typeLabel": "Normalizacion", "suffix": "Normalizacion"},
    {"key": "laboratory", "typeCode": "laboratory", "typeLabel": "Laboratorio", "suffix": "Laboratorio"},
]
DOCUMENT_TYPE_TARGET_KEYS = {item["key"] for item in HANDOVER_DOCUMENT_TYPE_TARGETS}


def _coerce_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def normalize_document_type_strategy(value: Any) -> str:
    normalized = _coerce_str(value, "single").lower()
    return normalized if normalized in DOCUMENT_TYPE_STRATEGIES else "single"


def normalize_document_type_base_name(value: Any) -> str:
    normalized = " ".join(_coerce_str(value, DEFAULT_DOCUMENT_TYPE_BASE_NAME).split())
    return normalized or DEFAULT_DOCUMENT_TYPE_BASE_NAME


def normalize_document_type_ids(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    normalized: dict[str, str] = {}
    for key, raw_value in value.items():
        normalized_key = _coerce_str(key).lower()
        if normalized_key not in DOCUMENT_TYPE_TARGET_KEYS.union({DOCUMENT_TYPE_DEFAULT_KEY}):
            continue
        normalized_value = _coerce_str(raw_value)
        if normalized_value.isdigit():
            normalized[normalized_key] = normalized_value
    return normalized


def build_document_type_plan(docs_settings: dict[str, Any] | None = None) -> list[dict[str, str]]:
    settings = docs_settings or {}
    base_name = normalize_document_type_base_name(settings.get("itopDocumentTypeBaseName"))
    strategy = normalize_document_type_strategy(settings.get("itopDocumentTypeStrategy"))

    if strategy == "single":
        return [
            {
                "key": DOCUMENT_TYPE_DEFAULT_KEY,
                "typeCode": "",
                "typeLabel": "Todas las actas",
                "documentTypeName": base_name,
            }
        ]

    return [
        {
            "key": item["key"],
            "typeCode": item["typeCode"],
            "typeLabel": item["typeLabel"],
            "documentTypeName": f"{base_name} {item['suffix']}".strip(),
        }
        for item in HANDOVER_DOCUMENT_TYPE_TARGETS
    ]


def _find_document_type_by_name(connector: iTopCMDBConnector, document_type_name: str) -> dict[str, str] | None:
    escaped_name = document_type_name.replace("\\", "\\\\").replace("'", "\\'")
    response = connector.get("DocumentType", f"SELECT DocumentType WHERE name = '{escaped_name}'", output_fields="id,name")
    item = response.first()
    if item is None:
        return None
    return {
        "id": str(item.id),
        "name": _coerce_str(item.get("name")),
    }


def _find_document_type_by_id(connector: iTopCMDBConnector, document_type_id: str) -> dict[str, str] | None:
    normalized_id = _coerce_str(document_type_id)
    if not normalized_id.isdigit():
        return None
    response = connector.get("DocumentType", f"SELECT DocumentType WHERE id = {int(normalized_id)}", output_fields="id,name")
    item = response.first()
    if item is None:
        return None
    return {
        "id": str(item.id),
        "name": _coerce_str(item.get("name")),
    }


def _resolve_plan_entry_for_handover_type(settings: dict[str, Any], type_definition) -> dict[str, str] | None:
    strategy = normalize_document_type_strategy(settings.get("itopDocumentTypeStrategy"))
    target_key = DOCUMENT_TYPE_DEFAULT_KEY if strategy == "single" else _coerce_str(type_definition.code).lower()
    return next((item for item in build_document_type_plan(settings) if item["key"] == target_key), None)


def build_missing_document_type_error_message(docs_settings: dict[str, Any] | None, type_definition) -> str:
    settings = docs_settings or {}
    plan_entry = _resolve_plan_entry_for_handover_type(settings, type_definition)
    expected_name = _coerce_str(plan_entry.get("documentTypeName")) if plan_entry else normalize_document_type_base_name(settings.get("itopDocumentTypeBaseName"))
    type_label = _coerce_str(getattr(type_definition, "label", ""), "esta acta")
    if expected_name:
        return (
            f"No se ha definido o validado el tipo documental de iTop '{expected_name}' para el flujo de {type_label}. "
            "Solicita a tu administrador que valide en Configuracion > Documentos que este tipo de documento este definido en iTop antes de continuar."
        )
    return (
        f"No se ha definido o validado el tipo documental de iTop para el flujo de {type_label}. "
        "Solicita a tu administrador que valide en Configuracion > Documentos que el tipo de documento este definido en iTop antes de continuar."
    )


def inspect_document_types(connector: iTopCMDBConnector, docs_settings: dict[str, Any] | None = None) -> dict[str, Any]:
    settings = docs_settings or {}
    configured_ids = normalize_document_type_ids(settings.get("itopDocumentTypeIds"))
    plan = build_document_type_plan(settings)
    items: list[dict[str, Any]] = []
    resolved_ids: dict[str, str] = {}

    for entry in plan:
        document_type = _find_document_type_by_name(connector, entry["documentTypeName"])
        exists = document_type is not None
        resolved_id = document_type["id"] if document_type is not None else configured_ids.get(entry["key"], "")
        if exists and resolved_id:
            resolved_ids[entry["key"]] = resolved_id
        items.append(
            {
                **entry,
                "exists": exists,
                "documentTypeId": resolved_id,
            }
        )

    return {
        "strategy": normalize_document_type_strategy(settings.get("itopDocumentTypeStrategy")),
        "baseName": normalize_document_type_base_name(settings.get("itopDocumentTypeBaseName")),
        "items": items,
        "resolvedIds": resolved_ids,
    }


def create_missing_document_types(connector: iTopCMDBConnector, docs_settings: dict[str, Any] | None = None) -> dict[str, Any]:
    initial = inspect_document_types(connector, docs_settings)
    resolved_ids = dict(initial["resolvedIds"])
    created: list[dict[str, str]] = []

    for entry in initial["items"]:
        if entry["exists"]:
            continue
        response = connector.create(
            "DocumentType",
            {
                "name": entry["documentTypeName"],
            },
            output_fields="id,name",
            comment=f"Tipo documental creado desde iTop Hub para {entry['documentTypeName']}",
        )
        if not response.ok or response.first() is None:
            raise ValueError(
                f"No fue posible crear el tipo documental '{entry['documentTypeName']}' en iTop: {response.message or 'sin detalle'}"
            )
        item = response.first()
        document_type_id = str(item.id)
        resolved_ids[entry["key"]] = document_type_id
        created.append(
            {
                "key": entry["key"],
                "documentTypeName": entry["documentTypeName"],
                "documentTypeId": document_type_id,
            }
        )

    inspected = inspect_document_types(
        connector,
        {
            **(docs_settings or {}),
            "itopDocumentTypeIds": resolved_ids,
        },
    )
    inspected["created"] = created
    return inspected


def get_document_type_id_for_handover_type(
    connector: iTopCMDBConnector,
    docs_settings: dict[str, Any] | None,
    type_definition,
) -> str:
    settings = docs_settings or {}
    strategy = normalize_document_type_strategy(settings.get("itopDocumentTypeStrategy"))
    configured_ids = normalize_document_type_ids(settings.get("itopDocumentTypeIds"))

    if strategy == "single":
        configured_id = configured_ids.get(DOCUMENT_TYPE_DEFAULT_KEY, "")
        if configured_id:
            return configured_id
        plan_entry = next((item for item in build_document_type_plan(settings) if item["key"] == DOCUMENT_TYPE_DEFAULT_KEY), None)
        if plan_entry is not None:
            document_type = _find_document_type_by_name(connector, plan_entry["documentTypeName"])
            if document_type is not None:
                return document_type["id"]
    else:
        configured_id = configured_ids.get(_coerce_str(type_definition.code).lower(), "")
        if configured_id:
            return configured_id
        plan_entry = next(
            (item for item in build_document_type_plan(settings) if item["key"] == _coerce_str(type_definition.code).lower()),
            None,
        )
        if plan_entry is not None:
            document_type = _find_document_type_by_name(connector, plan_entry["documentTypeName"])
            if document_type is not None:
                return document_type["id"]

    return ""


def resolve_required_document_type_id_for_handover_type(
    connector: iTopCMDBConnector,
    docs_settings: dict[str, Any] | None,
    type_definition,
) -> str:
    settings = docs_settings or {}
    configured_ids = normalize_document_type_ids(settings.get("itopDocumentTypeIds"))
    plan_entry = _resolve_plan_entry_for_handover_type(settings, type_definition)
    target_key = _coerce_str(plan_entry.get("key")) if plan_entry else DOCUMENT_TYPE_DEFAULT_KEY
    configured_id = configured_ids.get(target_key, "")
    if not configured_id:
        raise ValueError(build_missing_document_type_error_message(settings, type_definition))

    document_type = _find_document_type_by_id(connector, configured_id)
    if document_type is None:
        raise ValueError(build_missing_document_type_error_message(settings, type_definition))

    return document_type["id"]
