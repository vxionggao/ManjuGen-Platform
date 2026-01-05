from pydantic import BaseModel

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    role: str

class UserOut(BaseModel):
    id: int
    username: str
    role: str
