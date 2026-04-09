from typing import Any

from pydantic import BaseModel


class SettingsPanelUpdateRequest(BaseModel):
    config: dict[str, Any]


class SyncTaskRequest(BaseModel):
    schedule: str
    description: str
    taskType: str
    commandSource: str
    commandValue: str
    isActive: bool = True


class MailTestRequest(BaseModel):
    config: dict[str, Any]


class ItopTestRequest(BaseModel):
    config: dict[str, Any]


class PdqTestRequest(BaseModel):
    config: dict[str, Any]


class ProfileRequest(BaseModel):
    code: str = ""
    name: str
    description: str = ""
    isAdmin: bool = False
    status: str = "active"
    modules: list[dict[str, Any]] = []
