from typing import Any

from pydantic import BaseModel, Field


class LabAssetPayload(BaseModel):
    id: str = ""
    itopId: str = ""
    code: str = ""
    name: str = ""
    className: str = ""
    serial: str = ""
    organization: str = ""
    location: str = ""
    status: str = ""
    assignedUser: str = ""


class LabRequesterAdminPayload(BaseModel):
    userId: int | None = None
    name: str = ""
    itopPersonKey: str = ""
    role: str = ""


class LabRecordCreateRequest(BaseModel):
    reason: str = "maintenance"
    requestedActions: list[str] = Field(default_factory=list)
    asset: LabAssetPayload = Field(default_factory=LabAssetPayload)
    requesterAdmin: LabRequesterAdminPayload | None = None
    entryDate: str = ""
    entryObservations: str = ""
    entryConditionNotes: str = ""
    entryReceivedNotes: str = ""
    entryEvidences: list[dict[str, Any]] = Field(default_factory=list)
    processingDate: str = ""
    processingObservations: str = ""
    processingEvidences: list[dict[str, Any]] = Field(default_factory=list)
    processingChecklists: list[dict[str, Any]] = Field(default_factory=list)
    exitDate: str = ""
    exitObservations: str = ""
    workPerformed: str = ""
    exitEvidences: list[dict[str, Any]] = Field(default_factory=list)
    markedObsolete: bool = False
    obsoleteNotes: str = ""
    normalizationActCode: str = ""


class LabRecordUpdateRequest(BaseModel):
    reason: str | None = None
    requestedActions: list[str] | None = None
    status: str | None = None
    asset: LabAssetPayload | None = None
    requesterAdmin: LabRequesterAdminPayload | None = None
    entryDate: str | None = None
    entryObservations: str | None = None
    entryConditionNotes: str | None = None
    entryReceivedNotes: str | None = None
    entryEvidences: list[dict[str, Any]] | None = None
    entryGeneratedDocument: dict[str, Any] | None = None
    processingDate: str | None = None
    processingObservations: str | None = None
    processingEvidences: list[dict[str, Any]] | None = None
    processingGeneratedDocument: dict[str, Any] | None = None
    processingChecklists: list[dict[str, Any]] | None = None
    exitDate: str | None = None
    exitObservations: str | None = None
    workPerformed: str | None = None
    exitEvidences: list[dict[str, Any]] | None = None
    exitGeneratedDocument: dict[str, Any] | None = None
    signatureWorkflow: dict[str, Any] | None = None
    itopTicket: dict[str, Any] | None = None
    markedObsolete: bool | None = None
    obsoleteNotes: str | None = None
    normalizationActCode: str | None = None


class LabEvidenceFileRequest(BaseModel):
    name: str = ""
    mimeType: str = ""
    contentBase64: str = ""
    caption: str = ""


class LabEvidenceUploadRequest(BaseModel):
    phase: str = "entrada"
    files: list[LabEvidenceFileRequest] = Field(default_factory=list)


class LabSignatureSubmitRequest(BaseModel):
    signatureDataUrl: str = ""
    signerName: str = ""
    signerRole: str = ""
    observation: str = ""
    claimToken: str = ""
