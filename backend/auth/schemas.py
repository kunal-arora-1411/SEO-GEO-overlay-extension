import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, computed_field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


TIER_DAILY_LIMITS: dict[str, int] = {
    "free": 5,
    "starter": 50,
    "pro": 999,
    "agency": 999,
}


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    display_name: Optional[str] = None
    tier: str
    created_at: datetime
    analyses_remaining: int = 5

    @computed_field  # type: ignore[prop-decorator]
    @property
    def full_name(self) -> Optional[str]:
        return self.display_name

    model_config = {"from_attributes": True}


class SettingsResponse(BaseModel):
    full_name: Optional[str]
    email: str
    notifications_enabled: bool
    weekly_reports: bool

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=100)
    notifications_enabled: Optional[bool] = None
    weekly_reports: Optional[bool] = None
