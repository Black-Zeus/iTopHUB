from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from modules.handover.services.base_service import AssignedReceiverHandoverService, _helpers


class ReassignmentHandoverService(AssignedReceiverHandoverService):
    def _resolve_people(self, detail: dict[str, Any], *, action_label: str) -> tuple[dict[str, Any], dict[str, Any]]:
        helpers = _helpers()
        source_person, destination_id = helpers._validate_reassignment_people(
            detail,
            action_label=action_label,
        )
        destination_person = detail.get("receiver") or {}
        if int(destination_person.get("id") or 0) != destination_id:
            raise HTTPException(
                status_code=422,
                detail="El responsable destino no es valido para la reasignacion.",
            )
        return source_person, destination_person

    def validate_assets(
        self,
        payload_or_detail: dict[str, object],
        *,
        runtime_token: str,
        action_label: str,
        stage: str,
    ) -> None:
        helpers = _helpers()
        source_person, _ = self._resolve_people(payload_or_detail, action_label=action_label)
        source_id = int(source_person["id"])
        source_name = str(source_person.get("name") or "el responsable origen").strip()
        connector = helpers._build_itop_connector(runtime_token)
        try:
            for item in payload_or_detail.get("items") or []:
                asset = item.get("asset") or {}
                try:
                    asset_id = int(asset.get("id") or 0)
                except (TypeError, ValueError):
                    asset_id = 0
                if asset_id <= 0:
                    continue

                helpers._validate_ci_receiver_alignment(
                    connector,
                    asset_id=asset_id,
                    receiver_id=source_id,
                    receiver_name=source_name,
                    asset_label=helpers._build_asset_label(item),
                    type_definition=self.type_definition,
                    action_label=action_label,
                    stage="draft" if stage == "draft" else "workflow",
                )
        finally:
            connector.close()

    def get_ticket_contact_ids(self, current_detail: dict[str, Any]) -> list[int]:
        source_person, destination_person = self._resolve_people(
            current_detail,
            action_label="registrar el ticket iTop",
        )
        contact_ids = {
            int(source_person.get("id") or 0),
            int(destination_person.get("id") or 0),
        }
        return sorted(contact_id for contact_id in contact_ids if contact_id > 0)

    def handle_evidence_sync(
        self,
        current_detail: dict[str, Any],
        runtime_token: str,
        *,
        ticket_id: str = "",
    ) -> list[dict[str, Any]]:
        helpers = _helpers()
        source_person, destination_person = self._resolve_people(
            current_detail,
            action_label="sincronizar la reasignacion",
        )
        destination_id = int(destination_person["id"])
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
                assigned_contacts = helpers._load_ci_assigned_contacts(connector, asset_id)
                assigned_contact_ids = {
                    int(contact.get("id") or 0)
                    for contact in assigned_contacts
                    if int(contact.get("id") or 0) > 0
                }
                contact_ids_to_unlink = sorted(
                    contact_id
                    for contact_id in assigned_contact_ids
                    if contact_id != destination_id
                )
                asset_result = {
                    "assetId": str(asset_id),
                    "assetClass": asset_class,
                    "contactLinked": False,
                    "contactUnlinked": False,
                    "statusUpdated": False,
                    "statusUpdateError": "",
                    "ticketLinked": False,
                }

                for contact_id in contact_ids_to_unlink:
                    unlink_response = connector.unlink_contact_from_ci(asset_id, contact_id)
                    if not unlink_response.ok:
                        raise HTTPException(
                            status_code=502,
                            detail=f"No fue posible desvincular el EC {asset_id} del responsable anterior: {unlink_response.message}",
                        )
                asset_result["contactUnlinked"] = bool(contact_ids_to_unlink)

                if destination_id not in assigned_contact_ids:
                    link_response = connector.link_contacts_to_ci(asset_class, asset_id, [destination_id])
                    if not link_response.ok:
                        raise HTTPException(
                            status_code=502,
                            detail=f"No fue posible vincular el EC {asset_id} al nuevo responsable: {link_response.message}",
                        )
                    asset_result["contactLinked"] = True

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
            raise HTTPException(status_code=502, detail=f"No fue posible actualizar la reasignacion en iTop: {exc}") from exc
        finally:
            connector.close()

        return results
