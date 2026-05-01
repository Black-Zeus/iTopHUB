from typing import Any

from pydantic import BaseModel, Field


class HandoverSaveRequest(BaseModel):
    generatedAt: str = ""
    creationDate: str = ""
    assignmentDate: str = ""
    evidenceDate: str = ""
    generatedDocuments: list[dict[str, Any]] = Field(default_factory=list)
    evidenceAttachments: list[dict[str, Any]] = Field(default_factory=list)
    signatureWorkflow: dict[str, Any] = Field(default_factory=dict)
    status: str = "En creacion"
    handoverType: str = "Entrega inicial"
    reason: str = ""
    notes: str = ""
    receiver: dict[str, Any] = Field(default_factory=dict)
    additionalReceivers: list[dict[str, Any]] = Field(default_factory=list)
    items: list[dict[str, Any]] = Field(default_factory=list)


class HandoverEvidenceFileRequest(BaseModel):
    name: str = ""
    mimeType: str = ""
    contentBase64: str = ""
    documentType: str = ""


class HandoverEvidenceUploadRequest(BaseModel):
    files: list[HandoverEvidenceFileRequest] = Field(default_factory=list)
    ticket: dict[str, Any] = Field(default_factory=dict)


class HandoverSignatureSubmitRequest(BaseModel):
    signatureDataUrl: str = ""
    signerName: str = ""
    signerRole: str = ""


class HandoverSignedPublicationRequest(BaseModel):
    ticket: dict[str, Any] = Field(default_factory=dict)
