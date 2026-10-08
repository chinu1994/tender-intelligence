from pydantic import BaseModel, EmailStr, Field

from app.models import UserRole


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.REVIEWER


class UpdateUserRequest(BaseModel):
    role: UserRole