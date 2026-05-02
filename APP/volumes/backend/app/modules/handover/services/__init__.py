from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from modules.handover.handover_types import find_handover_type_definition
from modules.handover.services.delivery_service import DeliveryHandoverService
from modules.handover.services.normalization_service import NormalizationHandoverService
from modules.handover.services.reassignment_service import ReassignmentHandoverService
from modules.handover.services.return_service import ReturnHandoverService


SERVICE_CLASS_BY_TYPE = {
    "return": ReturnHandoverService,
    "reassignment": ReassignmentHandoverService,
    "normalization": NormalizationHandoverService,
}


def resolve_handover_service(handover_type: Any):
    type_definition = find_handover_type_definition(handover_type)
    if type_definition is None:
        raise HTTPException(status_code=422, detail="El tipo de acta no es valido.")
    service_class = SERVICE_CLASS_BY_TYPE.get(type_definition.code, DeliveryHandoverService)
    return service_class(type_definition)
