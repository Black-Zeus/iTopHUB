from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class RevalidateRequest(BaseModel):
    password: str


class BootstrapFirstAdminRequest(BaseModel):
    integrationUrl: str
    username: str
    password: str
    tokenValue: str
    verifySsl: bool = True
    timeoutSeconds: int = 30
