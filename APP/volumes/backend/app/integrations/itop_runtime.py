import os
from typing import Any

from modules.settings.repository import fetch_settings_panels
from modules.settings.service import normalize_panel_config


def _read_bool(name: str, default: bool = True) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _read_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def get_itop_runtime_config(overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    override_config = overrides or {}

    try:
        panels = fetch_settings_panels()
        stored_config = normalize_panel_config("itop", panels.get("itop", {}))
    except Exception:
        stored_config = {}

    integration_url = str(
        override_config.get("integrationUrl")
        or stored_config.get("integrationUrl")
        or os.getenv("ITOP_URL", "")
    ).strip()

    verify_ssl_source = (
        override_config["verifySsl"]
        if "verifySsl" in override_config
        else stored_config.get("verifySsl", _read_bool("ITOP_VERIFY_SSL", True))
    )
    timeout_source = (
        override_config["timeoutSeconds"]
        if "timeoutSeconds" in override_config
        else stored_config.get("timeoutSeconds", _read_int("ITOP_TIMEOUT_SECONDS", 30))
    )

    try:
        timeout_seconds = int(timeout_source)
    except (TypeError, ValueError):
        timeout_seconds = 30

    return {
        "integrationUrl": integration_url,
        "verifySsl": bool(verify_ssl_source) if isinstance(verify_ssl_source, bool) else str(verify_ssl_source).strip().lower() in {"1", "true", "yes", "on", "si"},
        "timeoutSeconds": max(1, timeout_seconds),
    }
