from typing import Any


def should_show_obsolete_assets(cmdb_settings: dict[str, Any] | None) -> bool:
    return bool((cmdb_settings or {}).get("showObsoleteAssets", False))


def should_show_implementation_assets(cmdb_settings: dict[str, Any] | None) -> bool:
    return bool((cmdb_settings or {}).get("showImplementationAssets", False))


def is_visible_ci_status(status: Any, show_obsolete_assets: bool, show_implementation_assets: bool) -> bool:
    normalized_status = str(status or "").strip().lower()
    if normalized_status == "obsolete":
        return show_obsolete_assets
    if normalized_status == "implementation":
        return show_implementation_assets
    return True
