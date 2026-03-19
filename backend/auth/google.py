"""Google OAuth 2.0 authentication endpoints."""

import logging
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.security import create_access_token, hash_password
from db.models.user import User
from db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/google", tags=["auth"])

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


class GoogleAuthRequest(BaseModel):
    code: str
    redirect_uri: str


class GoogleTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_new_user: bool = False


async def _exchange_code(
    code: str, redirect_uri: str, client_id: str, client_secret: str
) -> dict[str, Any]:
    """Exchange authorization code for Google access token."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if resp.status_code != 200:
        logger.error("Google token exchange failed: %s", resp.text)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange authorization code",
        )
    return resp.json()


async def _get_google_user(access_token: str) -> dict[str, Any]:
    """Fetch user info from Google."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to fetch Google user info",
        )
    return resp.json()


@router.post("/callback", response_model=GoogleTokenResponse)
async def google_callback(
    body: GoogleAuthRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> GoogleTokenResponse:
    """Handle Google OAuth callback.

    Exchanges the authorization code for tokens, fetches user info,
    and creates or logs in the user.
    """
    settings = request.app.state.settings
    client_id = settings.google_client_id
    client_secret = settings.google_client_secret

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth is not configured",
        )

    # Exchange code for Google tokens
    token_data = await _exchange_code(
        body.code, body.redirect_uri, client_id, client_secret
    )
    google_access_token = token_data.get("access_token")
    if not google_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No access token in Google response",
        )

    # Fetch user info
    google_user = await _get_google_user(google_access_token)
    email = google_user.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account has no email",
        )

    # Find or create user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    is_new = False

    if user is None:
        import secrets

        user = User(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            display_name=google_user.get("name", email.split("@")[0]),
            tier="free",
            is_active=True,
        )
        db.add(user)
        await db.flush()
        is_new = True
        logger.info("New user created via Google OAuth: %s", email)

    token = create_access_token({"sub": str(user.id)})
    return GoogleTokenResponse(
        access_token=token,
        is_new_user=is_new,
    )
