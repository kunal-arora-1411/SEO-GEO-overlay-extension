from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.schemas import (
    LoginRequest,
    RegisterRequest,
    SettingsResponse,
    SettingsUpdate,
    TIER_DAILY_LIMITS,
    TokenResponse,
    UserResponse,
)
from auth.security import create_access_token, hash_password, verify_password
from db.models.daily_usage import DailyUsage
from db.models.user import User
from db.session import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Register a new user and return a JWT access token."""
    result = await db.execute(select(User).where(User.email == request.email))
    existing = result.scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    user = User(
        email=request.email,
        hashed_password=hash_password(request.password),
        display_name=request.full_name,
        tier="free",
        is_active=True,
    )
    db.add(user)
    await db.flush()

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate an existing user and return a JWT access token."""
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Return the currently authenticated user's profile."""
    result = await db.execute(
        select(func.coalesce(func.sum(DailyUsage.scan_count), 0))
        .where(DailyUsage.user_id == user.id)
        .where(DailyUsage.date == date.today())
    )
    scans_today: int = result.scalar_one()
    daily_limit = TIER_DAILY_LIMITS.get(user.tier, 5)
    analyses_remaining = max(0, daily_limit - scans_today)

    response = UserResponse.model_validate(user)
    response.analyses_remaining = analyses_remaining
    return response


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(
    user: User = Depends(get_current_user),
) -> SettingsResponse:
    """Return the current user's notification and profile settings."""
    return SettingsResponse(
        full_name=user.display_name,
        email=user.email,
        notifications_enabled=user.notifications_enabled,
        weekly_reports=user.weekly_reports,
    )


@router.patch("/settings", response_model=SettingsResponse)
async def update_settings(
    payload: SettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SettingsResponse:
    """Update the current user's profile and notification settings."""
    if payload.full_name is not None:
        user.display_name = payload.full_name
    if payload.notifications_enabled is not None:
        user.notifications_enabled = payload.notifications_enabled
    if payload.weekly_reports is not None:
        user.weekly_reports = payload.weekly_reports

    await db.commit()
    await db.refresh(user)

    return SettingsResponse(
        full_name=user.display_name,
        email=user.email,
        notifications_enabled=user.notifications_enabled,
        weekly_reports=user.weekly_reports,
    )
