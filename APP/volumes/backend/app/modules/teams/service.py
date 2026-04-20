from __future__ import annotations

from typing import Any

from integrations.itop_cmdb_connector import iTopCMDBConnector
from integrations.itop_runtime import get_itop_runtime_config
from modules.auth.service import AuthenticationError
from modules.people.service import _build_person_row, _matches_person_query, _matches_person_status


def _normalize_space(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def _is_active_status(value: Any) -> bool:
    normalized = str(value or "").strip().lower()
    return normalized in {"", "active", "production", "enabled"}


def _build_connector(runtime_token: str) -> iTopCMDBConnector:
    itop_config = get_itop_runtime_config()
    return iTopCMDBConnector(
        base_url=itop_config["integrationUrl"],
        token=runtime_token,
        username="hub-session-user",
        verify_ssl=itop_config["verifySsl"],
        timeout=itop_config["timeoutSeconds"],
    )


def _build_team_row(item) -> dict[str, Any]:
    return {
        "id": item.id,
        "name": _normalize_space(item.get("friendlyname") or item.get("name") or f"Equipo {item.id}"),
        "email": _normalize_space(item.get("email")),
        "phone": _normalize_space(item.get("phone")),
        "role": _normalize_space(item.get("function")),
        "status": _normalize_space(item.get("status")).capitalize() or "Activo",
        "organizationId": str(item.get("org_id") or "").strip(),
        "organizationName": _normalize_space(item.get("org_id_friendlyname")),
    }


def _matches_team_query(item, query: str) -> bool:
    tokens = [token.casefold() for token in query.split() if token]
    if not tokens:
        return True

    haystack = " ".join(
        [
            str(item.get("friendlyname") or ""),
            str(item.get("name") or ""),
            str(item.get("email") or ""),
            str(item.get("function") or ""),
            str(item.get("org_id_friendlyname") or ""),
        ]
    ).casefold()
    return all(token in haystack for token in tokens)


def search_itop_teams(query: str, runtime_token: str, org_id: int | None = None, limit: int = 100) -> list[dict[str, Any]]:
    normalized_query = query.strip()
    if normalized_query and len(normalized_query) < 2:
        return []

    connector = _build_connector(runtime_token)
    try:
        items = connector.list_teams(
            org_id=org_id,
            output_fields="id,name,friendlyname,email,phone,function,org_id,org_id_friendlyname,status",
        )
    except ConnectionError as exc:
        raise AuthenticationError(
            f"No fue posible consultar equipos en iTop: {exc}",
            status_code=503,
            code="ITOP_UNAVAILABLE",
        ) from exc
    finally:
        connector.close()

    filtered = [
        item
        for item in items
        if _is_active_status(item.get("status")) and _matches_team_query(item, normalized_query)
    ]
    rows = [_build_team_row(item) for item in filtered]
    rows.sort(key=lambda row: row["name"].casefold())
    return rows[:limit]


def search_itop_team_people(team_id: int, query: str, runtime_token: str, status: str = "active", limit: int = 50) -> list[dict[str, Any]]:
    normalized_query = query.strip()
    normalized_status = status.strip().lower()
    if normalized_query and len(normalized_query) < 2:
        return []
    if normalized_status and normalized_status not in {"active", "inactive"}:
        raise ValueError("El estado de persona no es valido.")

    connector = _build_connector(runtime_token)
    try:
        items = connector.oql(
            (
                "SELECT Person AS p "
                "JOIN lnkPersonToTeam AS l ON l.person_id = p.id "
                f"WHERE l.team_id = {team_id}"
            ),
            output_fields="id,name,first_name,friendlyname,email,phone,function,status",
        )
    except ConnectionError as exc:
        raise AuthenticationError(
            f"No fue posible consultar analistas del equipo en iTop: {exc}",
            status_code=503,
            code="ITOP_UNAVAILABLE",
        ) from exc
    finally:
        connector.close()

    rows = [
        _build_person_row(item)
        for item in items
        if _matches_person_query(item, normalized_query) and _matches_person_status(item, normalized_status)
    ]
    rows.sort(key=lambda row: str(row["person"]).casefold())
    return rows[:limit]
