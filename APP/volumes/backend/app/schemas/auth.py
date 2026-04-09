from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class RevalidateRequest(BaseModel):
    password: str
