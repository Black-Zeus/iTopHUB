from typing import Any

from pydantic import BaseModel, Field


class ChecklistSaveRequest(BaseModel):
    moduleCode: str
    usageType: str = ""
    name: str
    description: str = ""
    status: str = "Activo"
    cmdbClass: str = ""
    checks: list[dict[str, Any]] = Field(default_factory=list)
