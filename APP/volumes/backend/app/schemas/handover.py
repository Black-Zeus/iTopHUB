from typing import Any

from pydantic import BaseModel, Field


class HandoverSaveRequest(BaseModel):
    generatedAt: str = ""
    creationDate: str = ""
    assignmentDate: str = ""
    evidenceDate: str = ""
    evidenceAttachments: list[dict[str, Any]] = Field(default_factory=list)
    status: str = "En creacion"
    handoverType: str = "Entrega inicial"
    reason: str = ""
    notes: str = ""
    receiver: dict[str, Any] = Field(default_factory=dict)
    additionalReceivers: list[dict[str, Any]] = Field(default_factory=list)
    items: list[dict[str, Any]] = Field(default_factory=list)
