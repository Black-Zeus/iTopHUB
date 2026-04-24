from __future__ import annotations

from fastapi import HTTPException

from modules.assets.service import get_itop_asset_detail
from modules.handover.services.base_service import BaseHandoverService
from modules.handover.services.base_service import _helpers


class DeliveryHandoverService(BaseHandoverService):
    def pre_ticket_creation(self, current_detail: dict[str, object], runtime_token: str) -> None:
        helpers = _helpers()

        for item in current_detail.get("items") or []:
            asset = item.get("asset") or {}
            try:
                asset_id = int(asset.get("id") or 0)
            except (TypeError, ValueError):
                asset_id = 0
            if asset_id <= 0:
                continue

            asset_label = helpers._build_asset_label(item)
            try:
                itop_asset_detail = get_itop_asset_detail(asset_id, runtime_token)
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"No fue posible validar en iTop el estado actual del activo '{asset_label}' antes de generar el ticket.",
                ) from exc

            current_status = helpers._coerce_str(itop_asset_detail.get("status")) or helpers._coerce_str(asset.get("status"))
            if helpers._normalize_comparison_text(current_status) != "stock":
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"No se puede generar el ticket iTop porque el activo '{asset_label}' no esta en inventario. "
                        f"Estado actual en iTop: {current_status or 'desconocido'}."
                    ),
                )
