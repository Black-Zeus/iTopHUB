from pydantic import BaseModel


class UserUpdateRequest(BaseModel):
    fullName: str
    roleCode: str
    statusCode: str
    tokenValue: str = ""
    tokenChanged: bool = False


class UserCreateRequest(BaseModel):
    username: str
    fullName: str
    roleCode: str
    statusCode: str
    tokenValue: str = ""
