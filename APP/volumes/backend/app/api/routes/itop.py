from typing import Any

from fastapi import APIRouter, Cookie, HTTPException

from api.deps import ensure_any_module_access, ensure_session, ensure_settings_access, raise_auth_error
from modules.assets.service import get_itop_asset_detail, list_itop_asset_catalog, search_itop_assets
from modules.auth.service import AuthenticationError, get_runtime_token
from modules.people.service import get_itop_person_detail, search_itop_people
from modules.settings.itop_catalog_service import get_requirement_itop_catalog
from modules.settings.service import get_settings_panel
from modules.teams.service import (
    list_itop_current_user_teams,
    resolve_itop_current_person_id,
    search_itop_team_people,
    search_itop_teams,
)
from modules.users.service import search_itop_users


router = APIRouter(prefix="/v1/itop", tags=["itop"])


@router.get("/people/search")
def itop_people_search(
    q: str = "",
    status: str = "",
    org_id: int | None = None,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_any_module_access(session_id, ("people", "handover"))
        runtime_token = get_runtime_token(session_id)
        return {
            "items": search_itop_people(q, runtime_token, status=status, org_id=org_id),
            "sessionUser": session_user["username"],
        }
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to search iTop people: {exc}") from exc


@router.get("/people/{person_id}")
def itop_person_detail(person_id: int, hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_any_module_access(session_id, ("people",))
        runtime_token = get_runtime_token(session_id)
        return {"item": get_itop_person_detail(person_id, runtime_token)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load iTop person detail: {exc}") from exc


@router.get("/assets/search")
def itop_assets_search(
    q: str = "",
    assigned_person_id: int | None = None,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_any_module_access(session_id, ("assets", "handover"))
        runtime_token = get_runtime_token(session_id)
        return {
            "items": search_itop_assets(q, runtime_token, assigned_person_id=assigned_person_id),
            "sessionUser": session_user["username"],
        }
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to search iTop assets: {exc}") from exc


@router.get("/assets/catalog")
def itop_assets_catalog(
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_any_module_access(session_id, ("assets",))
        runtime_token = get_runtime_token(session_id)
        return list_itop_asset_catalog(runtime_token)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load iTop asset catalog: {exc}") from exc


@router.get("/assets/{asset_id}")
def itop_asset_detail(asset_id: int, hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_any_module_access(session_id, ("assets",))
        runtime_token = get_runtime_token(session_id)
        return {"item": get_itop_asset_detail(asset_id, runtime_token)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load iTop asset detail: {exc}") from exc


@router.get("/users/search")
def itop_users_search(q: str = "", hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_any_module_access(session_id, ("users",))
        runtime_token = get_runtime_token(session_id)
        return {"items": search_itop_users(q, runtime_token), "sessionUser": session_user["username"]}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to search iTop users: {exc}") from exc


@router.get("/settings/requirement-catalog")
def itop_requirement_catalog(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_any_module_access(session_id, ("settings", "handover"))
        runtime_token = get_runtime_token(session_id)
        return get_requirement_itop_catalog(runtime_token)
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load iTop requirement catalog: {exc}") from exc


@router.get("/ticket/defaults")
def itop_ticket_defaults(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_any_module_access(session_id, ("settings", "handover"))
        return {"item": get_settings_panel("docs")}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load iTop ticket defaults: {exc}") from exc


@router.get("/me/teams")
def itop_current_user_teams(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_any_module_access(session_id, ("handover", "settings"))
        runtime_token = get_runtime_token(session_id)
        current_person_id = resolve_itop_current_person_id(session_user, runtime_token)
        return {
            "items": list_itop_current_user_teams(session_user, runtime_token),
            "sessionUser": {
                **session_user,
                "itopPersonId": current_person_id,
                "itopPersonKey": session_user.get("itopPersonKey") or current_person_id,
            },
        }
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load current user teams: {exc}") from exc


@router.get("/teams/search")
def itop_teams_search(
    q: str = "",
    org_id: int | None = None,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_settings_access(session_id)
        runtime_token = get_runtime_token(session_id)
        return {"items": search_itop_teams(q, runtime_token, org_id=org_id)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to search iTop teams: {exc}") from exc


@router.get("/teams/{team_id}/people/search")
def itop_team_people_search(
    team_id: int,
    q: str = "",
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_any_module_access(session_id, ("settings", "handover"))
        runtime_token = get_runtime_token(session_id)
        return {"items": search_itop_team_people(team_id, q, runtime_token)}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to search iTop team people: {exc}") from exc
