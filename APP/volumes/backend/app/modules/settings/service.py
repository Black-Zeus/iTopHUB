from __future__ import annotations

import base64
import binascii
from copy import deepcopy
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from PIL import Image

from infrastructure.redis_cache import cache_settings_panel, get_cached_settings_panel
from modules.handover.document_type_registry import (
    DEFAULT_DOCUMENT_TYPE_BASE_NAME,
    normalize_document_type_base_name,
    normalize_document_type_ids,
    normalize_document_type_strategy,
)
from modules.settings.repository import (
    create_profile,
    create_sync_task,
    delete_sync_task,
    fetch_settings_panels,
    fetch_profile_by_code,
    fetch_profiles,
    fetch_sync_task_by_id,
    fetch_sync_tasks,
    replace_profile_modules,
    update_profile,
    update_sync_task,
    upsert_settings_panel,
)


SYNC_TASK_TYPES = [
    {"value": "pdq_import", "label": "Importacion PDQ"},
    {"value": "cmdb_sync", "label": "Sincronizacion CMDB"},
    {"value": "documents", "label": "Documentos"},
    {"value": "custom", "label": "Personalizada"},
]

SYNC_COMMAND_PRESETS = [
    {"value": "sync.pdq.refresh", "label": "Actualizar copia PDQ"},
    {"value": "sync.cmdb.pull", "label": "Actualizar datos CMDB"},
    {"value": "documents.cleanup", "label": "Limpiar temporales documentales"},
]

PROFILE_MODULE_OPTIONS = [
    {"moduleCode": "dashboard", "label": "Dashboard"},
    {"moduleCode": "handover", "label": "Actas de Entrega"},
    {"moduleCode": "reception", "label": "Actas de Recepcion"},
    {"moduleCode": "reassignment", "label": "Acta de Reasignacion"},
    {"moduleCode": "lab", "label": "Laboratorio"},
    {"moduleCode": "devices", "label": "Dispositivos"},
    {"moduleCode": "pdq", "label": "PDQ"},
    {"moduleCode": "assets", "label": "Activos"},
    {"moduleCode": "people", "label": "Personas"},
    {"moduleCode": "checklists", "label": "Checklists"},
    {"moduleCode": "users", "label": "Usuarios"},
    {"moduleCode": "reports", "label": "Informes"},
    {"moduleCode": "settings", "label": "Configuracion"},
]

LEGACY_REQUIREMENT_SUBJECT = "Registro formal de asociacion de activo"
LEGACY_REQUIREMENT_TICKET_TEMPLATE = (
    "Se deja registro formal de la asociacion del activo en el marco del proceso corporativo vigente."
    "Solicitamos gestionar la actualizacion correspondiente y mantener trazabilidad del requerimiento asociado."
)
DEFAULT_REQUIREMENT_SUBJECT = "Registro Movimiento de Inventario"
DEFAULT_REQUIREMENT_TICKET_TEMPLATE = (
    "Se deja registro formal de la asociacion del activo en el marco del proceso corporativo vigente."
    "Solicitamos gestionar la actualizacion correspondiente y mantener trazabilidad del requerimiento asociado."
)
DEFAULT_REQUIREMENT_INITIAL_STATUS = "assigned"

PANEL_DEFAULTS: dict[str, dict[str, Any]] = {
    "organization": {
        "organizationName": "iTop Hub",
        "organizationAcronym": "ITH",
        "organizationLogo": "",
        "itopOrganizationId": "",
        "itopOrganizationName": "",
    },
    "itop": {
        "integrationUrl": "http://itop",
        "timeoutSeconds": 30,
        "verifySsl": True,
        "sessionTtlMinutes": 240,
        "runtimeTokenTtlMinutes": 60,
        "sessionWarningMinutes": 1,
    },
    "pdq": {
        "moduleEnabled": True,
        "databaseFilePath": "/app/data/pdq",
        "inventoryNote": (
            "PDQ se consume desde una copia local disponible para el backend. "
            "El Hub no consulta el servidor PDQ en linea."
        ),
    },
    "sync": {
        "manualExecutionLabel": "Disponible bajo demanda",
        "automationMode": "Copia externa de SQLite a carpeta compartida",
        "queryMode": "Busqueda por nombre de maquina o MAC",
        "notes": "Preparado para tareas programadas administradas desde la interfaz.",
    },
    "mail": {
        "senderName": "Mesa de Ayuda TI",
        "senderEmail": "soporte@empresa.local",
        "smtpHost": "mailpit",
        "smtpPort": "1025",
        "smtpSecurity": "none",
        "mailFormat": "html",
        "footerNote": "Documento generado automaticamente por iTop Hub.",
    },
    "docs": {
        "handoverPrefix": "ENT",
        "handoverReturnPrefix": "DEV",
        "handoverReassignmentPrefix": "REA",
        "handoverReplacementPrefix": "REP",
        "handoverNormalizationPrefix": "NOR",
        "handoverLaboratoryPrefix": "LAB",
        "receptionPrefix": "REC",
        "laboratoryPrefix": "LAB",
        "numberingFormat": "AAAA-NNNN",
        "requirementEnabled": False,
        "requirementTicketClass": "UserRequest",
        "requirementInitialStatus": DEFAULT_REQUIREMENT_INITIAL_STATUS,
        "requirementServiceId": "",
        "requirementServiceSubcategoryId": "",
        "requirementOrigin": "",
        "requirementImpact": "",
        "requirementUrgency": "",
        "requirementPriority": "",
        "requirementSubject": DEFAULT_REQUIREMENT_SUBJECT,
        "requirementTicketTemplate": DEFAULT_REQUIREMENT_TICKET_TEMPLATE,
        "pageSize": "A4",
        "marginTopMm": 12,
        "marginRightMm": 12,
        "marginBottomMm": 18,
        "marginLeftMm": 12,
        "showHeader": True,
        "headerShowLogo": True,
        "headerShowOrganizationName": True,
        "showFooter": True,
        "footerShowOrganizationName": True,
        "footerShowFolio": True,
        "footerShowPageNumber": True,
        "allowEvidenceUpload": True,
        "evidenceAllowedExtensions": ["pdf", "doc", "docx"],
        "itopDocumentTypeStrategy": "single",
        "itopDocumentTypeBaseName": DEFAULT_DOCUMENT_TYPE_BASE_NAME,
        "itopDocumentTypeIds": {},
        "handoverFooterNote": (
            "El firmante declara haber recibido los activos detallados en la presente acta, en la fecha indicada, "
            "aceptando su asignacion conforme a la informacion registrada. La revision tecnica y de preparacion "
            "de los equipos se documenta en anexo separado."
        ),
    },
    "cmdb": {
        "enabledAssetTypes": ["Desktop (PC)", "Laptop (Laptop)"],
        "showObsoleteAssets": False,
        "showImplementationAssets": False,
        "handoverReturnAssetStatus": "stock",
        "warrantyAlertDays": 30,
    },
}

ALLOWED_PANELS = set(PANEL_DEFAULTS.keys())
ALLOWED_TASK_TYPES = {item["value"] for item in SYNC_TASK_TYPES}
ALLOWED_COMMAND_PRESETS = {item["value"] for item in SYNC_COMMAND_PRESETS}
SETTINGS_ASSET_ROOT = Path("/app/data/settings_assets")
ORGANIZATION_LOGO_FILENAME = "organization_logo.png"
ORGANIZATION_LOGO_WIDTH_PX = 120


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _coerce_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on", "si"}


def _coerce_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _coerce_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _normalize_requirement_impact(value: Any) -> str:
    normalized = _coerce_str(value).lower()
    mapping = {
        "department": "1",
        "service": "2",
        "group": "2",
        "person": "3",
    }
    return mapping.get(normalized, normalized if normalized in {"1", "2", "3"} else "")


def _normalize_requirement_level(value: Any) -> str:
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


def _normalize_requirement_initial_status(value: Any, default: str = DEFAULT_REQUIREMENT_INITIAL_STATUS) -> str:
    normalized = _coerce_str(value, default).lower()
    mapping = {
        "assigned": "assigned",
        "asignado": "assigned",
        "assign": "assigned",
        "created": "created",
        "creado": "created",
        "new": "created",
        "nuevo": "created",
    }
    return mapping.get(normalized, default)


def _coerce_list(value: Any, default: list[str]) -> list[str]:
    if not isinstance(value, list):
        return default
    return [str(item).strip() for item in value if str(item).strip()]


def _build_organization_logo_url(relative_path: str, version: str) -> str:
    if not relative_path:
        return ""
    suffix = f"?v={version}" if version else ""
    return f"/api/v1/settings/assets/{relative_path}{suffix}"


def _extract_base64_payload(value: str) -> bytes:
    text = _coerce_str(value)
    if not text:
        raise HTTPException(status_code=422, detail="El logo de organizacion no contiene datos validos.")

    payload = text.split(",", 1)[1] if text.startswith("data:") and "," in text else text
    try:
        return base64.b64decode(payload, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=422, detail="El logo de organizacion no tiene un formato base64 valido.") from exc


def _save_organization_logo(encoded_image: str) -> tuple[str, str]:
    raw_bytes = _extract_base64_payload(encoded_image)
    try:
        source = Image.open(BytesIO(raw_bytes))
    except Exception as exc:
        raise HTTPException(status_code=422, detail="No fue posible leer el logo de organizacion.") from exc

    width, height = source.size
    if width <= 0 or height <= 0:
        raise HTTPException(status_code=422, detail="El logo de organizacion no tiene dimensiones validas.")

    target_width = ORGANIZATION_LOGO_WIDTH_PX
    target_height = max(1, round((height * target_width) / width))
    resize_filter = getattr(Image, "Resampling", Image).LANCZOS

    has_alpha = "A" in source.getbands() or (source.mode == "P" and "transparency" in source.info)
    converted = source.convert("RGBA" if has_alpha else "RGB")
    resized = converted.resize((target_width, target_height), resize_filter)

    output_directory = SETTINGS_ASSET_ROOT / "organization"
    output_directory.mkdir(parents=True, exist_ok=True)
    output_path = output_directory / ORGANIZATION_LOGO_FILENAME
    resized.save(output_path, format="PNG")
    version = str(int(output_path.stat().st_mtime))
    return "organization/organization_logo.png", version


def remove_organization_logo(relative_path: str) -> None:
    safe_relative = Path(_coerce_str(relative_path)).as_posix().strip("/")
    if not safe_relative:
        return
    file_path = SETTINGS_ASSET_ROOT / safe_relative
    if file_path.exists() and file_path.is_file():
        file_path.unlink(missing_ok=True)


def read_organization_logo_data_url(relative_path: str) -> str:
    safe_relative = Path(_coerce_str(relative_path)).as_posix().strip("/")
    if not safe_relative:
        return ""
    file_path = SETTINGS_ASSET_ROOT / safe_relative
    if not file_path.exists() or not file_path.is_file():
        return ""
    encoded = base64.b64encode(file_path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def normalize_panel_config(panel_code: str, config: dict[str, Any]) -> dict[str, Any]:
    if panel_code not in ALLOWED_PANELS:
        raise HTTPException(status_code=404, detail="Panel de configuracion no encontrado.")

    default_config = PANEL_DEFAULTS[panel_code]
    merged = _deep_merge(default_config, config or {})

    if panel_code == "itop":
        return {
            "integrationUrl": _coerce_str(merged.get("integrationUrl"), "http://itop"),
            "timeoutSeconds": _coerce_int(merged.get("timeoutSeconds"), 30),
            "verifySsl": _coerce_bool(merged.get("verifySsl"), True),
            "sessionTtlMinutes": max(1, _coerce_int(merged.get("sessionTtlMinutes"), 240)),
            "runtimeTokenTtlMinutes": max(1, _coerce_int(merged.get("runtimeTokenTtlMinutes"), 60)),
            "sessionWarningMinutes": max(1, _coerce_int(merged.get("sessionWarningMinutes"), 1)),
        }

    if panel_code == "organization":
        logo_path = _coerce_str(merged.get("organizationLogoPath"))
        logo_version = _coerce_str(merged.get("organizationLogoVersion"))
        return {
            "organizationName": _coerce_str(merged.get("organizationName"), "iTop Hub"),
            "organizationAcronym": _coerce_str(merged.get("organizationAcronym"), "ITH"),
            "itopOrganizationId": _coerce_str(merged.get("itopOrganizationId")),
            "itopOrganizationName": _coerce_str(merged.get("itopOrganizationName")),
            "organizationLogoPath": logo_path,
            "organizationLogoVersion": logo_version,
            "organizationLogoUrl": _build_organization_logo_url(logo_path, logo_version),
        }

    if panel_code == "pdq":
        return {
            "moduleEnabled": _coerce_bool(merged.get("moduleEnabled"), True),
            "databaseFilePath": _coerce_str(merged.get("databaseFilePath"), "/app/data/pdq"),
            "inventoryNote": _coerce_str(merged.get("inventoryNote")),
        }

    if panel_code == "sync":
        return {
            "manualExecutionLabel": _coerce_str(merged.get("manualExecutionLabel")),
            "automationMode": _coerce_str(merged.get("automationMode")),
            "queryMode": _coerce_str(merged.get("queryMode")),
            "notes": _coerce_str(merged.get("notes")),
        }

    if panel_code == "mail":
        mail_format = _coerce_str(merged.get("mailFormat"), "html").lower()
        if mail_format not in {"html", "txt"}:
            mail_format = "html"
        return {
            "senderName": _coerce_str(merged.get("senderName")),
            "senderEmail": _coerce_str(merged.get("senderEmail")),
            "smtpHost": _coerce_str(merged.get("smtpHost")),
            "smtpPort": _coerce_str(merged.get("smtpPort")),
            "smtpSecurity": _coerce_str(merged.get("smtpSecurity")),
            "mailFormat": mail_format,
            "footerNote": _coerce_str(merged.get("footerNote")),
        }

    if panel_code == "docs":
        page_size = _coerce_str(merged.get("pageSize"), "A4").upper()
        if page_size not in {"A4", "LETTER", "LEGAL"}:
            page_size = "A4"
        requirement_ticket_class = _coerce_str(merged.get("requirementTicketClass"), "UserRequest")
        if requirement_ticket_class not in {"UserRequest", "Incident", "NormalChange"}:
            requirement_ticket_class = "UserRequest"
        requirement_initial_status = _normalize_requirement_initial_status(merged.get("requirementInitialStatus"))
        requirement_subject = _coerce_str(merged.get("requirementSubject"), DEFAULT_REQUIREMENT_SUBJECT)
        if requirement_subject == LEGACY_REQUIREMENT_SUBJECT:
            requirement_subject = DEFAULT_REQUIREMENT_SUBJECT
        requirement_ticket_template = _coerce_str(merged.get("requirementTicketTemplate"), DEFAULT_REQUIREMENT_TICKET_TEMPLATE)
        if requirement_ticket_template == LEGACY_REQUIREMENT_TICKET_TEMPLATE:
            requirement_ticket_template = DEFAULT_REQUIREMENT_TICKET_TEMPLATE
        return {
            "handoverPrefix": _coerce_str(merged.get("handoverPrefix")),
            "handoverReturnPrefix": _coerce_str(merged.get("handoverReturnPrefix")),
            "handoverReassignmentPrefix": _coerce_str(merged.get("handoverReassignmentPrefix")),
            "handoverReplacementPrefix": _coerce_str(merged.get("handoverReplacementPrefix")),
            "handoverNormalizationPrefix": _coerce_str(merged.get("handoverNormalizationPrefix")),
            "handoverLaboratoryPrefix": _coerce_str(merged.get("handoverLaboratoryPrefix")),
            "receptionPrefix": _coerce_str(merged.get("receptionPrefix")),
            "laboratoryPrefix": _coerce_str(merged.get("laboratoryPrefix")),
            "numberingFormat": _coerce_str(merged.get("numberingFormat")),
            "requirementEnabled": _coerce_bool(merged.get("requirementEnabled"), False),
            "requirementTicketClass": requirement_ticket_class,
            "requirementInitialStatus": requirement_initial_status,
            "requirementServiceId": _coerce_str(merged.get("requirementServiceId")),
            "requirementServiceSubcategoryId": _coerce_str(merged.get("requirementServiceSubcategoryId")),
            "requirementOrigin": _coerce_str(merged.get("requirementOrigin")),
            "requirementImpact": _normalize_requirement_impact(merged.get("requirementImpact")),
            "requirementUrgency": _normalize_requirement_level(merged.get("requirementUrgency")),
            "requirementPriority": _normalize_requirement_level(merged.get("requirementPriority")),
            "requirementSubject": requirement_subject,
            "requirementTicketTemplate": requirement_ticket_template,
            "pageSize": page_size,
            "marginTopMm": max(0, _coerce_int(merged.get("marginTopMm"), 12)),
            "marginRightMm": max(0, _coerce_int(merged.get("marginRightMm"), 12)),
            "marginBottomMm": max(0, _coerce_int(merged.get("marginBottomMm"), 18)),
            "marginLeftMm": max(0, _coerce_int(merged.get("marginLeftMm"), 12)),
            "showHeader": _coerce_bool(merged.get("showHeader"), True),
            "headerShowLogo": _coerce_bool(merged.get("headerShowLogo"), True),
            "headerShowOrganizationName": _coerce_bool(merged.get("headerShowOrganizationName"), True),
            "showFooter": _coerce_bool(merged.get("showFooter"), True),
            "footerShowOrganizationName": _coerce_bool(merged.get("footerShowOrganizationName"), True),
            "footerShowFolio": _coerce_bool(merged.get("footerShowFolio"), True),
            "footerShowPageNumber": _coerce_bool(merged.get("footerShowPageNumber"), True),
            "allowEvidenceUpload": _coerce_bool(merged.get("allowEvidenceUpload"), True),
            "itopDocumentTypeStrategy": normalize_document_type_strategy(merged.get("itopDocumentTypeStrategy")),
            "itopDocumentTypeBaseName": normalize_document_type_base_name(merged.get("itopDocumentTypeBaseName")),
            "itopDocumentTypeIds": normalize_document_type_ids(merged.get("itopDocumentTypeIds")),
            "evidenceAllowedExtensions": [
                item
                for item in _coerce_list(
                    merged.get("evidenceAllowedExtensions"),
                    PANEL_DEFAULTS["docs"]["evidenceAllowedExtensions"],
                )
                if item in {"pdf", "doc", "docx", "txt"}
            ] or PANEL_DEFAULTS["docs"]["evidenceAllowedExtensions"],
            "handoverFooterNote": _coerce_str(
                merged.get("handoverFooterNote"),
                PANEL_DEFAULTS["docs"]["handoverFooterNote"],
            ),
        }

    return {
        "enabledAssetTypes": _coerce_list(merged.get("enabledAssetTypes"), PANEL_DEFAULTS["cmdb"]["enabledAssetTypes"]),
        "showObsoleteAssets": _coerce_bool(merged.get("showObsoleteAssets"), False),
        "showImplementationAssets": _coerce_bool(merged.get("showImplementationAssets"), False),
        "handoverReturnAssetStatus": (
            _coerce_str(merged.get("handoverReturnAssetStatus"), PANEL_DEFAULTS["cmdb"]["handoverReturnAssetStatus"]).lower()
            if _coerce_str(merged.get("handoverReturnAssetStatus"), PANEL_DEFAULTS["cmdb"]["handoverReturnAssetStatus"]).lower()
            in {"stock", "implementation", "production", "obsolete", "test", "inactive"}
            else PANEL_DEFAULTS["cmdb"]["handoverReturnAssetStatus"]
        ),
        "warrantyAlertDays": max(1, _coerce_int(merged.get("warrantyAlertDays"), 30)),
    }


def list_settings_payload() -> dict[str, Any]:
    rows = fetch_settings_panels()
    panels = {
        panel_code: normalize_panel_config(panel_code, rows.get(panel_code, {}))
        for panel_code in PANEL_DEFAULTS
    }
    return {
        "panels": panels,
        "syncTasks": [_serialize_sync_task(row) for row in fetch_sync_tasks()],
        "meta": {
            "syncTaskTypes": SYNC_TASK_TYPES,
            "syncCommandPresets": SYNC_COMMAND_PRESETS,
            "profileModules": PROFILE_MODULE_OPTIONS,
        },
    }


def update_settings_panel(panel_code: str, config: dict[str, Any]) -> dict[str, Any]:
    if panel_code == "organization":
        current = get_settings_panel(panel_code)
        next_config = {
            "organizationName": _coerce_str(config.get("organizationName"), current.get("organizationName", "iTop Hub")),
            "organizationAcronym": _coerce_str(config.get("organizationAcronym"), current.get("organizationAcronym", "ITH")),
            "itopOrganizationId": _coerce_str(config.get("itopOrganizationId"), current.get("itopOrganizationId", "")),
            "itopOrganizationName": _coerce_str(config.get("itopOrganizationName"), current.get("itopOrganizationName", "")),
            "organizationLogoPath": _coerce_str(current.get("organizationLogoPath")),
            "organizationLogoVersion": _coerce_str(current.get("organizationLogoVersion")),
        }
        if _coerce_bool(config.get("organizationLogoRemoved"), False):
            remove_organization_logo(next_config["organizationLogoPath"])
            next_config["organizationLogoPath"] = ""
            next_config["organizationLogoVersion"] = ""
        elif _coerce_str(config.get("organizationLogoUpload")):
            old_path = next_config["organizationLogoPath"]
            relative_path, version = _save_organization_logo(_coerce_str(config.get("organizationLogoUpload")))
            next_config["organizationLogoPath"] = relative_path
            next_config["organizationLogoVersion"] = version
            if old_path and old_path != relative_path:
                remove_organization_logo(old_path)
        normalized = normalize_panel_config(panel_code, next_config)
    else:
        normalized = normalize_panel_config(panel_code, config)
    upsert_settings_panel(panel_code, normalized)
    cache_settings_panel(panel_code, normalized)
    return normalized


def get_settings_panel(panel_code: str) -> dict[str, Any]:
    if panel_code not in ALLOWED_PANELS:
        raise HTTPException(status_code=404, detail="Panel de configuracion no encontrado.")

    cached = get_cached_settings_panel(panel_code)
    if cached is not None:
        return normalize_panel_config(panel_code, cached)

    rows = fetch_settings_panels()
    normalized = normalize_panel_config(panel_code, rows.get(panel_code, {}))
    cache_settings_panel(panel_code, normalized)
    return normalized


def _normalize_sync_task_payload(payload: dict[str, Any]) -> dict[str, Any]:
    schedule_expression = _coerce_str(payload.get("schedule"))
    description = _coerce_str(payload.get("description"))
    task_type = _coerce_str(payload.get("taskType"))
    command_source = _coerce_str(payload.get("commandSource"), "preset")
    command_value = _coerce_str(payload.get("commandValue"))
    is_active = _coerce_bool(payload.get("isActive"), True)

    if not schedule_expression:
        raise HTTPException(status_code=422, detail="La programacion es obligatoria.")
    if not description:
        raise HTTPException(status_code=422, detail="La descripcion es obligatoria.")
    if task_type not in ALLOWED_TASK_TYPES:
        raise HTTPException(status_code=422, detail="El tipo de tarea no es valido.")
    if command_source not in {"preset", "manual"}:
        raise HTTPException(status_code=422, detail="El origen del comando no es valido.")
    if not command_value:
        raise HTTPException(status_code=422, detail="El comando es obligatorio.")
    if command_source == "preset" and command_value not in ALLOWED_COMMAND_PRESETS:
        raise HTTPException(status_code=422, detail="El comando predefinido no es valido.")

    return {
        "schedule_expression": schedule_expression,
        "description": description,
        "task_type": task_type,
        "command_source": command_source,
        "command_value": command_value,
        "is_active": is_active,
    }


def _serialize_sync_task(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "schedule": row["schedule_expression"],
        "description": row["description"],
        "taskType": row["task_type"],
        "commandSource": row["command_source"],
        "commandValue": row["command_value"],
        "isActive": bool(row["is_active"]),
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "updatedAt": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def create_settings_sync_task(payload: dict[str, Any]) -> dict[str, Any]:
    normalized = _normalize_sync_task_payload(payload)
    task_id = create_sync_task(**normalized)
    created = fetch_sync_task_by_id(task_id)
    if not created:
        raise HTTPException(status_code=500, detail="No fue posible crear la tarea.")
    return _serialize_sync_task(created)


def update_settings_sync_task(task_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    existing = fetch_sync_task_by_id(task_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Tarea de sincronizacion no encontrada.")

    normalized = _normalize_sync_task_payload(payload)
    update_sync_task(task_id=task_id, **normalized)
    updated = fetch_sync_task_by_id(task_id)
    if not updated:
        raise HTTPException(status_code=500, detail="No fue posible actualizar la tarea.")
    return _serialize_sync_task(updated)


def remove_settings_sync_task(task_id: int) -> None:
    existing = fetch_sync_task_by_id(task_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Tarea de sincronizacion no encontrada.")
    delete_sync_task(task_id)


def _serialize_profile_rows(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not rows:
        return None

    first = rows[0]
    modules = []
    for option in PROFILE_MODULE_OPTIONS:
        module_row = next((row for row in rows if row.get("module_code") == option["moduleCode"]), None)
        modules.append({
            "moduleCode": option["moduleCode"],
            "label": option["label"],
            "canView": bool(module_row["can_view"]) if module_row else False,
            "canWrite": bool(module_row["can_write"]) if module_row else False,
        })

    return {
        "id": first["id"],
        "code": first["code"],
        "name": first["name"],
        "description": first.get("description") or "",
        "isAdmin": bool(first["is_admin"]),
        "status": first["status"],
        "modules": modules,
    }


def list_settings_profiles() -> list[dict[str, Any]]:
    rows = fetch_profiles()
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(row["code"], []).append(row)
    return [
        _serialize_profile_rows(grouped[code])
        for code in grouped
        if _serialize_profile_rows(grouped[code]) is not None
    ]


def _normalize_profile_payload(payload: dict[str, Any], is_create: bool) -> dict[str, Any]:
    code = _coerce_str(payload.get("code")).lower().replace(" ", "_")
    name = _coerce_str(payload.get("name"))
    description = _coerce_str(payload.get("description"))
    is_admin = _coerce_bool(payload.get("isAdmin"), False)
    status = _coerce_str(payload.get("status"), "active")
    modules = payload.get("modules") or []

    if is_create and not code:
        raise HTTPException(status_code=422, detail="El codigo del perfil es obligatorio.")
    if not name:
        raise HTTPException(status_code=422, detail="El nombre del perfil es obligatorio.")
    if status not in {"active", "inactive"}:
        raise HTTPException(status_code=422, detail="El estado del perfil no es valido.")
    if not isinstance(modules, list):
        raise HTTPException(status_code=422, detail="La lista de modulos no es valida.")

    normalized_modules = []
    valid_modules = {item["moduleCode"] for item in PROFILE_MODULE_OPTIONS}
    for module in modules:
        module_code = _coerce_str(module.get("moduleCode"))
        if module_code not in valid_modules:
            continue
        can_view = _coerce_bool(module.get("canView"), False)
        can_write = _coerce_bool(module.get("canWrite"), False)
        if can_write:
            can_view = True
        normalized_modules.append({
            "moduleCode": module_code,
            "canView": can_view,
            "canWrite": can_write,
        })

    return {
        "code": code,
        "name": name,
        "description": description,
        "isAdmin": is_admin,
        "status": status,
        "modules": normalized_modules,
    }


def create_settings_profile(payload: dict[str, Any]) -> dict[str, Any]:
    normalized = _normalize_profile_payload(payload, is_create=True)
    if fetch_profile_by_code(normalized["code"]):
        raise HTTPException(status_code=409, detail="Ya existe un perfil con ese codigo.")

    role_id = create_profile(
        code=normalized["code"],
        name=normalized["name"],
        description=normalized["description"],
        is_admin=normalized["isAdmin"],
        status=normalized["status"],
    )
    replace_profile_modules(role_id, normalized["modules"])
    created = _serialize_profile_rows(fetch_profile_by_code(normalized["code"]))
    if not created:
        raise HTTPException(status_code=500, detail="No fue posible crear el perfil.")
    return created


def update_settings_profile(role_code: str, payload: dict[str, Any]) -> dict[str, Any]:
    existing_rows = fetch_profile_by_code(role_code)
    existing = _serialize_profile_rows(existing_rows)
    if not existing:
        raise HTTPException(status_code=404, detail="Perfil no encontrado.")

    normalized = _normalize_profile_payload({**payload, "code": role_code}, is_create=False)
    update_profile(
        role_id=existing["id"],
        name=normalized["name"],
        description=normalized["description"],
        is_admin=normalized["isAdmin"],
        status=normalized["status"],
    )
    replace_profile_modules(existing["id"], normalized["modules"])
    updated = _serialize_profile_rows(fetch_profile_by_code(role_code))
    if not updated:
        raise HTTPException(status_code=500, detail="No fue posible actualizar el perfil.")
    return updated


def is_requirement_ticket_enabled(docs_settings: dict[str, Any] | None = None) -> bool:
    resolved_settings = docs_settings if docs_settings is not None else get_settings_panel("docs")
    return _coerce_bool(resolved_settings.get("requirementEnabled"), False)


def get_requirement_initial_status(docs_settings: dict[str, Any] | None = None) -> str:
    resolved_settings = docs_settings if docs_settings is not None else get_settings_panel("docs")
    return _normalize_requirement_initial_status(resolved_settings.get("requirementInitialStatus"))
