import uuid
from datetime import date

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.security import hash_password
from db.models.daily_usage import DailyUsage
from db.models.user import User
from middleware.usage_gate import TIER_LIMITS, UsageGate


@pytest_asyncio.fixture
async def gate() -> UsageGate:
    return UsageGate()


@pytest_asyncio.fixture
async def free_user(db: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email="freeuser@example.com",
        hashed_password=hash_password("password123"),
        tier="free",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


@pytest_asyncio.fixture
async def pro_user(db: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email="prouser@example.com",
        hashed_password=hash_password("password123"),
        tier="pro",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


@pytest_asyncio.fixture
async def agency_user(db: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email="agencyuser@example.com",
        hashed_password=hash_password("password123"),
        tier="agency",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


class TestUsageGateCheck:
    @pytest.mark.asyncio
    async def test_free_user_allowed_initially(
        self, gate: UsageGate, free_user: User, db: AsyncSession
    ):
        result = await gate.check(free_user, "127.0.0.1", db)
        assert result.allowed is True
        assert result.remaining == TIER_LIMITS["free"]
        assert result.limit == TIER_LIMITS["free"]

    @pytest.mark.asyncio
    async def test_free_user_blocked_after_limit(
        self, gate: UsageGate, free_user: User, db: AsyncSession
    ):
        usage = DailyUsage(
            user_id=free_user.id,
            date=date.today(),
            scan_count=TIER_LIMITS["free"],
        )
        db.add(usage)
        await db.flush()

        result = await gate.check(free_user, "127.0.0.1", db)
        assert result.allowed is False
        assert result.remaining == 0
        assert result.limit == TIER_LIMITS["free"]

    @pytest.mark.asyncio
    async def test_pro_user_higher_limit(
        self, gate: UsageGate, pro_user: User, db: AsyncSession
    ):
        usage = DailyUsage(
            user_id=pro_user.id,
            date=date.today(),
            scan_count=10,
        )
        db.add(usage)
        await db.flush()

        result = await gate.check(pro_user, "127.0.0.1", db)
        assert result.allowed is True
        assert result.remaining == TIER_LIMITS["pro"] - 10
        assert result.limit == TIER_LIMITS["pro"]

    @pytest.mark.asyncio
    async def test_agency_user_unlimited(
        self, gate: UsageGate, agency_user: User, db: AsyncSession
    ):
        result = await gate.check(agency_user, "127.0.0.1", db)
        assert result.allowed is True
        assert result.remaining == -1
        assert result.limit == -1

    @pytest.mark.asyncio
    async def test_anonymous_tracked_by_ip(
        self, gate: UsageGate, db: AsyncSession
    ):
        result = await gate.check(None, "192.168.1.1", db)
        assert result.allowed is True
        assert result.limit == TIER_LIMITS["free"]

    @pytest.mark.asyncio
    async def test_anonymous_blocked_after_limit(
        self, gate: UsageGate, db: AsyncSession
    ):
        usage = DailyUsage(
            ip_address="10.0.0.1",
            date=date.today(),
            scan_count=TIER_LIMITS["free"],
        )
        db.add(usage)
        await db.flush()

        result = await gate.check(None, "10.0.0.1", db)
        assert result.allowed is False
        assert result.remaining == 0


class TestUsageGateRecordUsage:
    @pytest.mark.asyncio
    async def test_record_creates_new_entry_for_user(
        self, gate: UsageGate, free_user: User, db: AsyncSession
    ):
        await gate.record_usage(free_user, "127.0.0.1", db)

        result = await db.execute(
            select(DailyUsage).where(
                DailyUsage.user_id == free_user.id,
                DailyUsage.date == date.today(),
            )
        )
        usage = result.scalar_one()
        assert usage.scan_count == 1

    @pytest.mark.asyncio
    async def test_record_increments_existing_entry(
        self, gate: UsageGate, free_user: User, db: AsyncSession
    ):
        usage = DailyUsage(
            user_id=free_user.id,
            date=date.today(),
            scan_count=1,
        )
        db.add(usage)
        await db.flush()

        await gate.record_usage(free_user, "127.0.0.1", db)

        result = await db.execute(
            select(DailyUsage).where(
                DailyUsage.user_id == free_user.id,
                DailyUsage.date == date.today(),
            )
        )
        updated = result.scalar_one()
        assert updated.scan_count == 2

    @pytest.mark.asyncio
    async def test_record_anonymous_by_ip(
        self, gate: UsageGate, db: AsyncSession
    ):
        await gate.record_usage(None, "172.16.0.1", db)

        result = await db.execute(
            select(DailyUsage).where(
                DailyUsage.ip_address == "172.16.0.1",
                DailyUsage.date == date.today(),
            )
        )
        usage = result.scalar_one()
        assert usage.scan_count == 1
        assert usage.user_id is None


class TestTierLimits:
    def test_all_tiers_defined(self):
        assert "free" in TIER_LIMITS
        assert "starter" in TIER_LIMITS
        assert "pro" in TIER_LIMITS
        assert "agency" in TIER_LIMITS

    def test_free_lowest(self):
        assert TIER_LIMITS["free"] < TIER_LIMITS["starter"]
        assert TIER_LIMITS["starter"] < TIER_LIMITS["pro"]

    def test_agency_unlimited(self):
        assert TIER_LIMITS["agency"] == -1
