from typing import Any

from pydantic import BaseModel, Field


class HandoverSaveRequest(BaseModel):
    generatedAt: str = ""
    status: str = "Borrador"
    handoverType: str = "Asignacion inicial"
    reason: str = ""
    notes: str = ""
    receiver: dict[str, Any] = Field(default_factory=dict)
    items: list[dict[str, Any]] = Field(default_factory=list)
