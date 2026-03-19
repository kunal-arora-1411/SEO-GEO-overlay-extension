import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from db.models.user import User


class TestPasswordHashing:
    def test_hash_password_returns_string(self):
        hashed = hash_password("mysecretpassword")
        assert isinstance(hashed, str)
        assert hashed != "mysecretpassword"

    def test_verify_password_correct(self):
        hashed = hash_password("mysecretpassword")
        assert verify_password("mysecretpassword", hashed) is True

    def test_verify_password_incorrect(self):
        hashed = hash_password("mysecretpassword")
        assert verify_password("wrongpassword", hashed) is False

    def test_different_hashes_for_same_password(self):
        hash1 = hash_password("samepassword")
        hash2 = hash_password("samepassword")
        assert hash1 != hash2  # bcrypt uses random salts


class TestJWT:
    def test_create_and_decode_token(self):
        user_id = str(uuid.uuid4())
        token = create_access_token({"sub": user_id})
        payload = decode_access_token(token)
        assert payload["sub"] == user_id
        assert "exp" in payload
        assert "iat" in payload

    def test_decode_expired_token_raises(self):
        import jwt as pyjwt
        from config import Settings

        settings = Settings()
        expired_payload = {
            "sub": str(uuid.uuid4()),
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
        }
        token = pyjwt.encode(
            expired_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm
        )
        with pytest.raises(pyjwt.ExpiredSignatureError):
            decode_access_token(token)

    def test_decode_invalid_token_raises(self):
        import jwt as pyjwt

        with pytest.raises(pyjwt.InvalidTokenError):
            decode_access_token("not.a.valid.token")


class TestRegisterEndpoint:
    @pytest.mark.asyncio
    async def test_register_success(self, client):
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "securepassword123",
                "display_name": "New User",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client):
        payload = {
            "email": "duplicate@example.com",
            "password": "securepassword123",
        }
        response1 = await client.post("/api/v1/auth/register", json=payload)
        assert response1.status_code == 201

        response2 = await client.post("/api/v1/auth/register", json=payload)
        assert response2.status_code == 409

    @pytest.mark.asyncio
    async def test_register_short_password(self, client):
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "short@example.com", "password": "short"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, client):
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "notanemail", "password": "securepassword123"},
        )
        assert response.status_code == 422


class TestLoginEndpoint:
    @pytest.mark.asyncio
    async def test_login_success(self, client):
        # Register first
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "logintest@example.com",
                "password": "securepassword123",
            },
        )
        # Login
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "logintest@example.com",
                "password": "securepassword123",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client):
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "wrongpw@example.com",
                "password": "securepassword123",
            },
        )
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "wrongpw@example.com",
                "password": "wrongpassword",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_email(self, client):
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "nobody@example.com",
                "password": "securepassword123",
            },
        )
        assert response.status_code == 401


class TestMeEndpoint:
    @pytest.mark.asyncio
    async def test_me_authenticated(self, client):
        # Register to get a token
        reg_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "metest@example.com",
                "password": "securepassword123",
                "display_name": "Me Test",
            },
        )
        token = reg_response.json()["access_token"]

        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "metest@example.com"
        assert data["display_name"] == "Me Test"
        assert data["tier"] == "free"

    @pytest.mark.asyncio
    async def test_me_no_token(self, client):
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_me_invalid_token(self, client):
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalidtoken"},
        )
        assert response.status_code == 401
