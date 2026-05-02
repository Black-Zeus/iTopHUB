from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException

from infrastructure.db import get_db_connection
from modules.handover.handover_types import (
    NORMALIZATION_MODES,
    NORMALIZATION_MODES_REQUIRING_RECEIVER,
    normalize_normalization_mode,
)
from modules.handover.services.base_service import BaseHandoverService, _helpers


VALID_NORMALIZATION_MODES = frozenset(NORMALIZATION_MODES)


def _resolve_normalization_mode(detail: dict[str, Any]) -> str:
    mode = normalize_normalization_mode(detail.get("normalizationMode"))
    if mode not in VALID_NORMALIZATION_MODES:
        raise HTTPException(
            status_code=422,
            detail="El modo de normalizacion no es valido o no esta configurado en el acta.",
        )
    return mode


def _resolve_normalization_params(detail: dict[str, Any]) -> dict[str, Any]:
    raw = detail.get("normalizationParams")
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except (ValueError, TypeError):
            return {}
    return {}


def _resolve_target_status(params: dict[str, Any], *, allow_implicit_obsolete: bool = False) -> str:
    target_status = str(params.get("targetStatus") or "").strip().lower()
    if target_status:
        return target_status
    if allow_implicit_obsolete:
        return "obsolete"
    return ""


def _resolve_target_location_id(params: dict[str, Any]) -> str:
    return str(params.get("targetLocationId") or "").strip()


def _resolve_requester_admin(detail: dict[str, Any]) -> dict[str, Any]:
    requester_admin = detail.get("requesterAdmin")
    return requester_admin if isinstance(requester_admin, dict) else {}


def _load_requester_admin_user(user_id: int) -> dict[str, Any] | None:
    query = """
        SELECT
            u.id,
            u.full_name,
            u.status,
            u.itop_person_key,
            r.is_admin
        FROM hub_users u
        INNER JOIN hub_roles r
            ON r.id = u.role_id
        WHERE u.id = %s
        LIMIT 1
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (user_id,))
            return cursor.fetchone()


def _ensure_requester_admin(detail: dict[str, Any]) -> dict[str, Any]:
    requester_admin = _resolve_requester_admin(detail)
    requester_person_key = str(requester_admin.get("itopPersonKey") or "").strip()
    raw_user_id = requester_admin.get("userId")
    try:
        requester_user_id = int(raw_user_id or 0)
    except (TypeError, ValueError):
        requester_user_id = 0

    if requester_user_id <= 0:
        raise HTTPException(
            status_code=422,
            detail="Debes seleccionar el solicitante administrador antes de emitir el acta de normalizacion.",
        )
    if not requester_person_key:
        raise HTTPException(
            status_code=422,
            detail="El solicitante administrador seleccionado no tiene una persona iTop asociada para generar el ticket.",
        )
    if not requester_person_key.isdigit():
        raise HTTPException(
            status_code=422,
            detail="El solicitante administrador no tiene una persona iTop valida para generar el ticket.",
        )

    user_row = _load_requester_admin_user(requester_user_id)
    if not user_row or not bool(user_row.get("is_admin")) or str(user_row.get("status") or "").strip().lower() != "active":
        raise HTTPException(
            status_code=422,
            detail="El solicitante seleccionado ya no corresponde a un administrador activo del Hub.",
        )

    current_person_key = str(user_row.get("itop_person_key") or "").strip()
    if not current_person_key.isdigit() or current_person_key != requester_person_key:
        raise HTTPException(
            status_code=422,
            detail="El solicitante administrador no tiene una persona iTop valida o actualizada para generar el ticket.",
        )

    return requester_admin


class NormalizationHandoverService(BaseHandoverService):

    def pre_emit(self, current_detail: dict[str, Any], runtime_token: str) -> None:
        del runtime_token
        mode = _resolve_normalization_mode(current_detail)
        raw_mode = str(current_detail.get("normalizationMode") or "").strip().lower()
        if not mode or mode not in VALID_NORMALIZATION_MODES:
            raise HTTPException(
                status_code=422,
                detail="Debes seleccionar el modo de normalizacion antes de emitir el acta.",
            )
        _ensure_requester_admin(current_detail)
        params = _resolve_normalization_params(current_detail)
        if mode in {"change_status", "change_status_and_location"}:
            if not _resolve_target_status(params, allow_implicit_obsolete=raw_mode == "send_to_obsolete"):
                raise HTTPException(
                    status_code=422,
                    detail="Debes indicar el estado destino antes de emitir el acta en modo Cambiar estado.",
                )
        if mode in {"change_location", "change_status_and_location"}:
            if not _resolve_target_location_id(params):
                raise HTTPException(
                    status_code=422,
                    detail="Debes indicar la localizacion destino antes de emitir el acta en modo Cambiar localizacion.",
                )

    def pre_signature_session(self, current_detail: dict[str, Any], session_user: dict[str, Any]) -> None:
        if not session_user.get("isAdmin"):
            raise HTTPException(
                status_code=403,
                detail="Solo el administrador puede iniciar la firma de actas de normalizacion.",
            )

    def validate_assets(
        self,
        payload_or_detail: dict[str, Any],
        *,
        runtime_token: str,
        action_label: str,
        stage: str,
    ) -> None:
        pass

    def get_target_asset_status(self, current_detail: dict[str, Any]) -> str:
        return "production"

    def get_ticket_contact_ids(self, current_detail: dict[str, Any]) -> list[int]:
        helpers = _helpers()
        mode = normalize_normalization_mode(current_detail.get("normalizationMode"))
        if mode in NORMALIZATION_MODES_REQUIRING_RECEIVER:
            return helpers._get_handover_contact_ids(current_detail)
        return []

    def confirm_handover_document(
        self,
        document_id: int,
        attachments: list[dict[str, Any]],
        session_user: dict[str, Any],
        runtime_token: str,
        ticket_payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not session_user.get("isAdmin"):
            raise HTTPException(
                status_code=403,
                detail="Solo el administrador puede confirmar actas de normalizacion.",
            )
        current_detail = _helpers().get_handover_document_detail(document_id)
        _ensure_requester_admin(current_detail)
        return super().confirm_handover_document(
            document_id,
            attachments,
            session_user,
            runtime_token,
            ticket_payload,
        )

    def handle_evidence_sync(
        self,
        current_detail: dict[str, Any],
        runtime_token: str,
        *,
        ticket_id: str = "",
    ) -> list[dict[str, Any]]:
        helpers = _helpers()
        mode = _resolve_normalization_mode(current_detail)
        raw_mode = str(current_detail.get("normalizationMode") or "").strip().lower()
        params = _resolve_normalization_params(current_detail)
        connector = helpers._build_itop_connector(runtime_token)
        results: list[dict[str, Any]] = []

        try:
            for item in current_detail.get("items") or []:
                asset = item.get("asset") or {}
                try:
                    asset_id = int(asset.get("id") or 0)
                except (TypeError, ValueError):
                    asset_id = 0
                if asset_id <= 0:
                    continue

                asset_label = helpers._build_asset_display_label(item, asset_override=asset)
                asset_class = helpers._resolve_asset_itop_class(connector, asset_id)
                asset_result = {
                    "assetId": str(asset_id),
                    "assetClass": asset_class,
                    "contactLinked": False,
                    "contactUnlinked": False,
                    "statusUpdated": False,
                    "statusUpdateError": "",
                    "locationUpdated": False,
                    "locationUpdateError": "",
                    "ticketLinked": False,
                }

                if mode in {"assign_to_person", "assign_to_person_and_activate"}:
                    contact_ids = helpers._get_handover_contact_ids(current_detail)
                    if contact_ids:
                        link_response = connector.link_contacts_to_ci(asset_class, asset_id, contact_ids)
                        if not link_response.ok:
                            raise HTTPException(
                                status_code=502,
                                detail=f"No fue posible asociar el EC {asset_id} a la persona: {link_response.message}",
                            )
                        asset_result["contactLinked"] = True
                    if mode == "assign_to_person_and_activate":
                        status_response = connector.update_ci_status(
                            asset_class,
                            asset_id,
                            "production",
                            comment=f"Activo regularizado a produccion desde acta {current_detail.get('documentNumber') or ''}".strip(),
                        )
                        if status_response.ok:
                            asset_result["statusUpdated"] = True
                        else:
                            asset_result["statusUpdateError"] = status_response.message

                elif mode in {"remove_from_person", "return_to_stock"}:
                    receiver = current_detail.get("receiver") or {}
                    try:
                        person_id = int(receiver.get("id") or 0)
                    except (TypeError, ValueError):
                        person_id = 0
                    if person_id > 0:
                        unlink_response = connector.unlink_contact_from_ci(asset_id, person_id)
                        if not unlink_response.ok:
                            raise HTTPException(
                                status_code=502,
                                detail=f"No fue posible remover el EC {asset_id} de la persona: {unlink_response.message}",
                            )
                        asset_result["contactUnlinked"] = True
                    if mode == "return_to_stock":
                        status_response = connector.update_ci_status(
                            asset_class,
                            asset_id,
                            "stock",
                            comment=f"Activo liberado a stock desde acta {current_detail.get('documentNumber') or ''}".strip(),
                        )
                        if status_response.ok:
                            asset_result["statusUpdated"] = True
                        else:
                            asset_result["statusUpdateError"] = status_response.message

                elif mode in {"change_status", "change_status_and_location"}:
                    target_status = _resolve_target_status(params, allow_implicit_obsolete=raw_mode == "send_to_obsolete")
                    if not target_status:
                        raise HTTPException(
                            status_code=422,
                            detail="El acta no tiene un estado destino configurado.",
                        )
                    status_response = connector.update_ci_status(
                        asset_class,
                        asset_id,
                        target_status,
                        comment=f"Estado cambiado desde acta {current_detail.get('documentNumber') or ''}".strip(),
                    )
                    if status_response.ok:
                        asset_result["statusUpdated"] = True
                    else:
                        asset_result["statusUpdateError"] = status_response.message

                if mode in {"change_location", "change_status_and_location"}:
                    target_location_id = _resolve_target_location_id(params)
                    if not target_location_id:
                        raise HTTPException(
                            status_code=422,
                            detail="El acta no tiene una localizacion destino configurada.",
                        )
                    location_response = connector.update(
                        asset_class,
                        asset_id,
                        {"location_id": int(target_location_id)},
                        comment=f"Localizacion cambiada desde acta {current_detail.get('documentNumber') or ''}".strip(),
                    )
                    if location_response.ok:
                        asset_result["locationUpdated"] = True
                    else:
                        asset_result["locationUpdateError"] = location_response.message

                if helpers._normalize_ticket_id(ticket_id):
                    helpers._ensure_ci_ticket_link(
                        connector,
                        ticket_id=int(ticket_id),
                        asset_id=asset_id,
                        asset_label=asset_label,
                        document_number=helpers._coerce_str(current_detail.get("documentNumber")),
                    )
                    asset_result["ticketLinked"] = True

                results.append(asset_result)

        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"No fue posible ejecutar la normalizacion en iTop: {exc}",
            ) from exc
        finally:
            connector.close()

        return results
