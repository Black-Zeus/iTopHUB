from __future__ import annotations

import base64
import binascii
import os
import re
import time
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from fastapi import HTTPException
from PIL import Image

from modules.email_reports import repository

EMAIL_TO_PARAMETER_NAMES = {"email", "mail", "correo", "user_email", "recipient_email", "email_to"}
EMAIL_CC_PARAMETER_NAMES = {"email_cc", "cc", "copy", "copia"}
EMAIL_BCC_PARAMETER_NAMES = {"email_bcc", "bcc", "blind_copy", "copia_oculta"}
ALLOWED_PARAMETER_TYPES = {"text", "string", "date", "number", "select", "boolean", "email"}
EMAIL_REPORT_ASSET_ROOT = Path("/app/data/email_report_assets")
EMAIL_REPORT_LOGO_WIDTH_PX = 160
EMAIL_REPORT_TRIGGER_COOLDOWN_SECONDS = 180
_RECENT_EMAIL_REPORT_TRIGGERS: dict[tuple[str, int], float] = {}


def _coerce_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _coerce_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return bool(value)
    normalized = _coerce_str(value).lower()
    if normalized in {"true", "1", "yes", "si", "s"}:
        return True
    if normalized in {"false", "0", "no", "n", ""}:
        return False
    return default


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9_]+", "_", value.strip().lower())
    slug = re.sub(r"_+", "_", slug).strip("_")
    return slug


def _build_asset_url(relative_path: str) -> str:
    safe_relative = Path(_coerce_str(relative_path)).as_posix().strip("/")
    if not safe_relative:
        return ""
    file_path = EMAIL_REPORT_ASSET_ROOT / safe_relative
    version = str(int(file_path.stat().st_mtime)) if file_path.exists() else ""
    suffix = f"?v={version}" if version else ""
    return f"/api/v1/email-reports/assets/{safe_relative}{suffix}"


def _extract_base64_payload(value: str) -> bytes:
    text = _coerce_str(value)
    if not text:
        raise HTTPException(status_code=422, detail="El logo no contiene datos validos.")
    payload = text.split(",", 1)[1] if text.startswith("data:") and "," in text else text
    try:
        return base64.b64decode(payload, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=422, detail="El logo no tiene un formato base64 valido.") from exc


def _save_logo(report_code: str, encoded_image: str) -> str:
    raw_bytes = _extract_base64_payload(encoded_image)
    try:
        source = Image.open(BytesIO(raw_bytes))
    except Exception as exc:
        raise HTTPException(status_code=422, detail="No fue posible leer la imagen del logo.") from exc

    width, height = source.size
    if width <= 0 or height <= 0:
        raise HTTPException(status_code=422, detail="La imagen del logo no tiene dimensiones validas.")

    target_width = EMAIL_REPORT_LOGO_WIDTH_PX
    target_height = max(1, round((height * target_width) / width))
    resize_filter = getattr(Image, "Resampling", Image).LANCZOS
    has_alpha = "A" in source.getbands() or (source.mode == "P" and "transparency" in source.info)
    converted = source.convert("RGBA" if has_alpha else "RGB")
    resized = converted.resize((target_width, target_height), resize_filter)

    safe_code = _slugify(report_code) or "email-report"
    output_directory = EMAIL_REPORT_ASSET_ROOT / safe_code
    output_directory.mkdir(parents=True, exist_ok=True)
    output_path = output_directory / "logo.png"
    resized.save(output_path, format="PNG")
    return f"{safe_code}/logo.png"


def remove_logo(relative_path: str) -> None:
    safe_relative = Path(_coerce_str(relative_path)).as_posix().strip("/")
    if not safe_relative:
        return
    file_path = EMAIL_REPORT_ASSET_ROOT / safe_relative
    try:
        resolved_path = file_path.resolve()
        root_path = EMAIL_REPORT_ASSET_ROOT.resolve()
        if root_path in resolved_path.parents and resolved_path.is_file():
            resolved_path.unlink(missing_ok=True)
    except OSError:
        return


def _is_user_email_parameter(parameter: dict[str, Any]) -> bool:
    name = _coerce_str(parameter.get("name")).lower()
    source = _coerce_str(parameter.get("source")).lower()
    return name in EMAIL_TO_PARAMETER_NAMES or source in {"user.email", "session.email", "user_email"}


def _is_email_cc_parameter(parameter: dict[str, Any]) -> bool:
    name = _coerce_str(parameter.get("name")).lower()
    source = _coerce_str(parameter.get("source")).lower()
    return name in EMAIL_CC_PARAMETER_NAMES or source in {"user.email_cc", "session.email_cc", "email_cc"}


def _is_email_bcc_parameter(parameter: dict[str, Any]) -> bool:
    name = _coerce_str(parameter.get("name")).lower()
    source = _coerce_str(parameter.get("source")).lower()
    return name in EMAIL_BCC_PARAMETER_NAMES or source in {"user.email_bcc", "session.email_bcc", "email_bcc"}


def _normalize_email_list(value: Any) -> list[str]:
    raw_items = [_coerce_str(item) for item in _coerce_str(value).split(",")]
    emails = [item for item in raw_items if item]
    invalid = [item for item in emails if not re.match(r"^[^\s@,]+@[^\s@,]+\.[^\s@,]+$", item)]
    if invalid:
        raise HTTPException(status_code=422, detail=f"Revisa los correos en copia: {', '.join(invalid)}")
    return emails


def _normalize_parameters(value: Any) -> list[dict[str, Any]]:
    if value is None or value == "":
        return []
    raw_items = value.get("fields") if isinstance(value, dict) else value
    if not isinstance(raw_items, list):
        raise HTTPException(status_code=422, detail="Los parametros deben ser una lista JSON.")

    result: list[dict[str, Any]] = []
    for index, item in enumerate(raw_items):
        if not isinstance(item, dict):
            raise HTTPException(status_code=422, detail="Cada parametro debe ser un objeto JSON.")
        name = _slugify(_coerce_str(item.get("name")))
        if not name:
            raise HTTPException(status_code=422, detail="Cada parametro debe tener un nombre.")
        param_type = _coerce_str(item.get("type"), "text").lower()
        if param_type not in ALLOWED_PARAMETER_TYPES:
            param_type = "text"
        if param_type == "string":
            param_type = "text"
        label = _coerce_str(item.get("label"), name.replace("_", " ").title())
        options = item.get("options") if isinstance(item.get("options"), list) else []
        email_parameter = _is_user_email_parameter({**item, "name": name})
        default_value = item.get("defaultValue", item.get("default_value", ""))
        required_value = item.get("required", False)
        normalized = {
            "name": name,
            "label": label,
            "type": "email" if email_parameter else param_type,
            "required": required_value if required_value == "conditional" else _coerce_bool(required_value),
            "source": "user.email" if email_parameter else _coerce_str(item.get("source")),
            "placeholder": _coerce_str(item.get("placeholder")),
            "order": _coerce_int(item.get("order"), index + 1),
            "options": options,
            "defaultValue": default_value,
            "description": _coerce_str(item.get("description")),
        }
        result.append(normalized)
    return sorted(result, key=lambda current: current["order"])


def _normalize_payload(payload: dict[str, Any], existing: dict[str, Any] | None = None) -> dict[str, Any]:
    name = _coerce_str(payload.get("name"))
    report_code = _slugify(_coerce_str(payload.get("reportCode") or payload.get("report_code") or name))
    webhook_url = _coerce_str(payload.get("webhookUrl") or payload.get("webhook_url"))
    method = _coerce_str(payload.get("httpMethod") or payload.get("http_method"), "POST").upper()
    status = _coerce_str(payload.get("status"), "active").lower()

    if not report_code:
        raise HTTPException(status_code=422, detail="El codigo del reporte es obligatorio.")
    if not name:
        raise HTTPException(status_code=422, detail="El nombre del reporte es obligatorio.")
    parsed = urlparse(webhook_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=422, detail="La URL del webhook debe ser http:// o https://.")
    if "://" in parsed.netloc or parsed.netloc.endswith(":") or parsed.path.startswith("/:"):
        raise HTTPException(status_code=422, detail="La URL del webhook esta mal formada. Revisa protocolo, host y puerto.")
    if (parsed.hostname or "").lower() in {"localhost", "127.0.0.1", "::1"}:
        raise HTTPException(
            status_code=422,
            detail="La URL del webhook no debe usar localhost. Desde Docker usa host.docker.internal o el nombre DNS del contenedor n8n.",
        )
    if method not in {"GET", "POST"}:
        raise HTTPException(status_code=422, detail="El metodo HTTP debe ser GET o POST.")
    if status not in {"active", "inactive"}:
        raise HTTPException(status_code=422, detail="El estado debe ser active o inactive.")

    existing_logo = _coerce_str(existing.get("logo_url")) if existing else ""
    logo_path = _coerce_str(payload.get("logoUrl") or payload.get("logo_url") or existing_logo)
    if bool(payload.get("logoRemoved")):
        remove_logo(existing_logo)
        logo_path = ""
    elif _coerce_str(payload.get("logoUpload")):
        if existing_logo:
            remove_logo(existing_logo)
        logo_path = _save_logo(report_code, _coerce_str(payload.get("logoUpload")))

    return {
        "report_code": report_code,
        "name": name,
        "description": _coerce_str(payload.get("description")),
        "webhook_url": webhook_url,
        "http_method": method,
        "status": status,
        "display_order": _coerce_int(payload.get("displayOrder") or payload.get("display_order"), 100),
        "icon_name": _coerce_str(payload.get("iconName") or payload.get("icon_name"), "mail") or "mail",
        "logo_url": logo_path,
        "parameters_json": _normalize_parameters(payload.get("parameters")),
    }


def _serialize(row: dict[str, Any]) -> dict[str, Any]:
    logo_url = _build_asset_url(row.get("logo_url") or "") if _coerce_str(row.get("logo_url")) else ""
    return {
        "id": row["id"],
        "reportCode": row["report_code"],
        "name": row["name"],
        "description": row.get("description") or "",
        "webhookUrl": row.get("webhook_url") or "",
        "httpMethod": row.get("http_method") or "POST",
        "status": row.get("status") or "active",
        "displayOrder": int(row.get("display_order") or 100),
        "iconName": row.get("icon_name") or "mail",
        "logoUrl": logo_url,
        "parameters": _normalize_parameters(row.get("parameters_json")),
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "updatedAt": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def list_email_reports(include_inactive: bool = False) -> list[dict[str, Any]]:
    return [_serialize(row) for row in repository.fetch_email_reports(include_inactive=include_inactive)]


def create_email_report(payload: dict[str, Any], username: str) -> dict[str, Any]:
    normalized = _normalize_payload(payload)
    if repository.fetch_email_report_by_code(normalized["report_code"]):
        raise HTTPException(status_code=409, detail="Ya existe un reporte por correo con ese codigo.")
    report_id = repository.insert_email_report(normalized, username)
    created = repository.fetch_email_report(report_id)
    if not created:
        raise HTTPException(status_code=500, detail="No fue posible crear el reporte por correo.")
    return _serialize(created)


def update_email_report(report_id: int, payload: dict[str, Any], username: str) -> dict[str, Any]:
    existing = repository.fetch_email_report(report_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Reporte por correo no encontrado.")
    normalized = _normalize_payload(payload, existing=existing)
    duplicated = repository.fetch_email_report_by_code(normalized["report_code"])
    if duplicated and int(duplicated["id"]) != int(report_id):
        raise HTTPException(status_code=409, detail="Ya existe otro reporte por correo con ese codigo.")
    repository.update_email_report(report_id, normalized, username)
    updated = repository.fetch_email_report(report_id)
    if not updated:
        raise HTTPException(status_code=500, detail="No fue posible actualizar el reporte por correo.")
    return _serialize(updated)


def remove_email_report(report_id: int) -> None:
    if not repository.fetch_email_report(report_id):
        raise HTTPException(status_code=404, detail="Reporte por correo no encontrado.")
    repository.delete_email_report(report_id)


def _resolve_webhook_payload(report: dict[str, Any], submitted: dict[str, Any], session_user: dict[str, Any]) -> dict[str, Any]:
    user_email = _coerce_str(session_user.get("email"))
    result: dict[str, Any] = {}
    for parameter in _normalize_parameters(report.get("parameters_json")):
        name = parameter["name"]
        if _is_user_email_parameter(parameter):
            if not user_email:
                raise HTTPException(status_code=422, detail="Tu perfil no tiene correo configurado para solicitar este reporte.")
            result[name] = user_email
            continue
        if _is_email_cc_parameter(parameter) or _is_email_bcc_parameter(parameter):
            raw_value = submitted.get(name)
            emails = _normalize_email_list(raw_value)
            if emails:
                result[name] = ",".join(emails)
            continue
        raw_value = submitted.get(name)
        value = raw_value.strip() if isinstance(raw_value, str) else raw_value
        if parameter.get("required") is True and value in (None, ""):
            raise HTTPException(status_code=422, detail=f"El parametro {parameter['label']} es obligatorio.")
        if value not in (None, ""):
            result[name] = value
    return result


def _get_trigger_identity(session_user: dict[str, Any]) -> str:
    return (
        _coerce_str(session_user.get("id"))
        or _coerce_str(session_user.get("username"))
        or _coerce_str(session_user.get("email"))
        or "unknown"
    )


def _enforce_trigger_cooldown(report_id: int, session_user: dict[str, Any]) -> tuple[str, int]:
    now = time.monotonic()
    identity = _get_trigger_identity(session_user)
    key = (identity, int(report_id))

    expired_keys = [
        current_key
        for current_key, timestamp in _RECENT_EMAIL_REPORT_TRIGGERS.items()
        if now - timestamp >= EMAIL_REPORT_TRIGGER_COOLDOWN_SECONDS
    ]
    for current_key in expired_keys:
        _RECENT_EMAIL_REPORT_TRIGGERS.pop(current_key, None)

    previous_timestamp = _RECENT_EMAIL_REPORT_TRIGGERS.get(key)
    if previous_timestamp is not None:
        remaining_seconds = int(EMAIL_REPORT_TRIGGER_COOLDOWN_SECONDS - (now - previous_timestamp))
        if remaining_seconds > 0:
            remaining_minutes = max(1, round(remaining_seconds / 60))
            raise HTTPException(
                status_code=429,
                detail=f"Tu ultima solicitud de este reporte se esta procesando. Espera {remaining_minutes} minuto(s) antes de volver a intentarlo.",
            )

    _RECENT_EMAIL_REPORT_TRIGGERS[key] = now
    return key


def _release_trigger_cooldown(key: tuple[str, int] | None) -> None:
    if key is not None:
        _RECENT_EMAIL_REPORT_TRIGGERS.pop(key, None)


def _translate_n8n_response_message(n8n_payload: dict[str, Any], report: dict[str, Any]) -> str:
    raw_message = _coerce_str(n8n_payload.get("message")).lower()
    if raw_message in {"workflow was started", "workflow accepted"}:
        return "Reporte solicitado. Revisa tu bandeja de correo en unos minutos."
    if raw_message:
        return _coerce_str(n8n_payload.get("message"))
    return "Reporte solicitado. Revisa tu bandeja de correo en unos minutos."


def _parse_n8n_payload(response: requests.Response) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError:
        payload = {"message": response.text.strip()}
    if not isinstance(payload, dict):
        return {"message": response.text.strip()}
    return payload


def _build_webhook_headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    token = _coerce_str(os.getenv("WEBHOOK_TOKEN"))
    header_name = _coerce_str(os.getenv("WEBHOOK_TOKEN_HEADER"), "X-Webhook-Token")
    if token and header_name:
        headers[header_name] = token
    return headers


def _raise_n8n_error(response: requests.Response) -> None:
    n8n_payload = _parse_n8n_payload(response)
    raw_message = _coerce_str(n8n_payload.get("message") or n8n_payload.get("error"))
    if response.status_code in {401, 403}:
        message = "n8n rechazo la solicitud por autenticacion. Revisa WEBHOOK_TOKEN y el header configurado."
    elif response.status_code == 400:
        message = raw_message or "n8n rechazo la solicitud por parametros invalidos."
    else:
        message = raw_message or "n8n no pudo procesar la solicitud del reporte."
    raise HTTPException(status_code=502 if response.status_code >= 500 else response.status_code, detail=message)


def trigger_email_report(report_id: int, submitted_parameters: dict[str, Any], session_user: dict[str, Any]) -> dict[str, Any]:
    report = repository.fetch_active_email_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Reporte por correo no encontrado o inactivo.")

    payload = _resolve_webhook_payload(report, submitted_parameters or {}, session_user)
    cooldown_key = _enforce_trigger_cooldown(report_id, session_user)
    method = _coerce_str(report.get("http_method"), "POST").upper()
    try:
        headers = _build_webhook_headers()
        if method == "GET":
            response = requests.get(report["webhook_url"], params=payload, headers=headers, timeout=15)
        else:
            response = requests.post(report["webhook_url"], json=payload, headers=headers, timeout=15)
        if response.status_code >= 400:
            _release_trigger_cooldown(cooldown_key)
            _raise_n8n_error(response)
    except requests.exceptions.Timeout as exc:
        _release_trigger_cooldown(cooldown_key)
        raise HTTPException(status_code=504, detail="n8n no respondio dentro del tiempo maximo. Intenta nuevamente en unos minutos.") from exc
    except requests.exceptions.RequestException as exc:
        _release_trigger_cooldown(cooldown_key)
        raise HTTPException(status_code=502, detail=f"No fue posible solicitar el reporte en n8n. Revisa la configuracion del webhook.") from exc

    n8n_payload = _parse_n8n_payload(response)

    return {
        "ok": True,
        "message": _translate_n8n_response_message(n8n_payload, report),
        "statusCode": response.status_code,
    }
