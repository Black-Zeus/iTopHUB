from __future__ import annotations

from modules.handover.services.base_service import AssignedReceiverHandoverService


class ReassignmentHandoverService(AssignedReceiverHandoverService):
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
