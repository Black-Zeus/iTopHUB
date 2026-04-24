from __future__ import annotations

from typing import Any

from modules.handover.services.base_service import AssignedReceiverHandoverService, _helpers


class ReturnHandoverService(AssignedReceiverHandoverService):
    def validate_assets(
        self,
        payload_or_detail: dict[str, object],
        *,
        runtime_token: str,
        action_label: str,
        stage: str,
    ) -> None:
        super().validate_assets(
            payload_or_detail,
            runtime_token=runtime_token,
            action_label=action_label,
            stage=stage,
        )

    def get_target_asset_status(self, current_detail: dict[str, Any]) -> str:
        del current_detail
        helpers = _helpers()
        return helpers._get_return_asset_target_status()

    def get_ticket_contact_ids(self, current_detail: dict[str, Any]) -> list[int]:
        receiver = current_detail.get("receiver") or {}
        try:
            receiver_id = int(receiver.get("id") or 0)
        except (TypeError, ValueError):
            receiver_id = 0
        return [receiver_id] if receiver_id > 0 else []

    def get_contacts_to_unlink(
        self,
        current_detail: dict[str, Any],
        connector: Any,
        asset_id: int,
        receiver_person_id: int,
    ) -> list[int]:
        del current_detail, receiver_person_id
        helpers = _helpers()
        assigned_contacts = helpers._load_ci_assigned_contacts(connector, asset_id)
        return [
            int(contact.get("id") or 0)
            for contact in assigned_contacts
            if int(contact.get("id") or 0) > 0
        ]

    def handle_evidence_sync(
        self,
        current_detail: dict[str, Any],
        runtime_token: str,
        *,
        ticket_id: str = "",
    ) -> list[dict[str, Any]]:
        return super().handle_evidence_sync(
            current_detail,
            runtime_token,
            ticket_id=ticket_id,
        )

    def post_confirm(
        self,
        updated_document: dict[str, Any],
        *,
        assignment_updates: list[dict[str, Any]],
        itop_ticket: dict[str, Any],
    ) -> dict[str, Any]:
        del assignment_updates, itop_ticket
        return updated_document
