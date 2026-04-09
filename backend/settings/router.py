"""Settings endpoint for updating user profile preferences."""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from db.models.user import User
from db.session import get_db

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    full_name: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    weekly_reports: Optional[bool] = None
    timezone: Optional[str] = None


class SettingsResponse(BaseModel):
    full_name: str
    email: str
    notifications_enabled: bool
    weekly_reports: bool
    timezone: str


@router.patch("", response_model=SettingsResponse)
async def update_settings(
    body: SettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SettingsResponse:
    """Update the authenticated user's profile settings."""
    if body.full_name is not None:
        user.display_name = body.full_name
    db.add(user)

    return SettingsResponse(
        full_name=user.display_name or "",
        email=user.email,
        notifications_enabled=body.notifications_enabled if body.notifications_enabled is not None else True,
        weekly_reports=body.weekly_reports if body.weekly_reports is not None else True,
        timezone=body.timezone or "UTC",
    )
