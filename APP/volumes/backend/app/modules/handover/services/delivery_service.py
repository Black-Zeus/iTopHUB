from __future__ import annotations

from fastapi import HTTPException

from modules.assets.service import get_itop_asset_detail
from modules.handover.services.base_service import BaseHandoverService
from modules.handover.services.base_service import _helpers


class DeliveryHandoverService(BaseHandoverService):
    def _validate_stock_assets(self, payload_or_detail: dict[str, object], runtime_token: str, *, action_label: str) -> None:
        helpers = _helpers()

        for item in payload_or_detail.get("items") or []:
            asset = item.get("asset") or {}
            try:
                asset_id = int(asset.get("id") or 0)
            except (TypeError, ValueError):
                asset_id = 0
            if asset_id <= 0:
                continue

            fallback_asset_label = helpers._build_asset_display_label(item)
            try:
                itop_asset_detail = get_itop_asset_detail(asset_id, runtime_token)
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"No fue posible validar en iTop el estado actual del activo '{fallback_asset_label}' antes de {action_label}.",
                ) from exc

            resolved_asset_label = helpers._build_asset_display_label(
                item,
                asset_override={
                    "name": itop_asset_detail.get("name"),
                    "code": itop_asset_detail.get("code"),
                },
            )
            current_status = helpers._coerce_str(itop_asset_detail.get("status")) or helpers._coerce_str(asset.get("status"))
            if helpers._normalize_comparison_text(current_status) != "stock":
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"No se puede {action_label} porque el activo '{resolved_asset_label}' no esta en inventario. "
                        f"Estado actual en iTop: {current_status or 'desconocido'}."
                    ),
                )

    def validate_assets(
        self,
        payload_or_detail: dict[str, object],
        *,
        runtime_token: str,
        action_label: str,
        stage: str,
    ) -> None:
        del stage
        self._validate_stock_assets(
            payload_or_detail,
            runtime_token,
            action_label=action_label,
        )

    def pre_ticket_creation(self, current_detail: dict[str, object], runtime_token: str) -> None:
        self._validate_stock_assets(
            current_detail,
            runtime_token,
            action_label="generar el ticket iTop",
        )
