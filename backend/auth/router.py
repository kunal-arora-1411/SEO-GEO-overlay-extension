from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from auth.security import create_access_token, hash_password, verify_password
from db.models.daily_usage import DailyUsage
from db.models.user import User
from db.session import get_db
from middleware.usage_gate import TIER_LIMITS

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
    today = date.today()
    result = await db.execute(
        select(DailyUsage).where(
            DailyUsage.user_id == user.id,
            DailyUsage.date == today,
        )
    )
    usage = result.scalar_one_or_none()
    scans_today = usage.scan_count if usage is not None else 0
    limit = TIER_LIMITS.get(user.tier, TIER_LIMITS["free"])
    analyses_remaining = -1 if limit == -1 else max(0, limit - scans_today)

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.display_name,
        tier=user.tier,
        analyses_remaining=analyses_remaining,
        created_at=user.created_at,
    )
