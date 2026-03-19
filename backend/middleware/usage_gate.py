import logging
from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.daily_usage import DailyUsage
from db.models.user import User

logger = logging.getLogger(__name__)

TIER_LIMITS: dict[str, int] = {
    "free": 3,
    "starter": 50,
    "pro": 200,
    "agency": -1,  # unlimited
}


class UsageGateResult:
    """Result of a usage gate check."""

    __slots__ = ("allowed", "remaining", "limit")

    def __init__(self, allowed: bool, remaining: int, limit: int) -> None:
        self.allowed = allowed
        self.remaining = remaining
        self.limit = limit


class UsageGate:
    """Enforces per-tier daily scan limits.

    For authenticated users, usage is tracked by user_id.
    For anonymous users, usage is tracked by IP address.
    """

    async def check(
        self,
        user: Optional[User],
        ip_address: str,
        db: AsyncSession,
    ) -> UsageGateResult:
        """Check whether the user/IP is allowed to perform a scan.

        Returns a ``UsageGateResult`` with the allowed flag, remaining scans,
        and the total limit for the applicable tier.
        """
        tier = user.tier if user is not None else "free"
        limit = TIER_LIMITS.get(tier, TIER_LIMITS["free"])

        # Unlimited tier
        if limit == -1:
            return UsageGateResult(allowed=True, remaining=-1, limit=-1)

        today = date.today()

        if user is not None:
            result = await db.execute(
                select(DailyUsage).where(
                    DailyUsage.user_id == user.id,
                    DailyUsage.date == today,
                )
            )
        else:
            result = await db.execute(
                select(DailyUsage).where(
                    DailyUsage.ip_address == ip_address,
                    DailyUsage.date == today,
                )
            )

        usage = result.scalar_one_or_none()
        current_count = usage.scan_count if usage is not None else 0
        remaining = max(0, limit - current_count)
        allowed = current_count < limit

        return UsageGateResult(allowed=allowed, remaining=remaining, limit=limit)

    async def record_usage(
        self,
        user: Optional[User],
        ip_address: str,
        db: AsyncSession,
    ) -> None:
        """Increment the daily usage counter for the user or IP address."""
        today = date.today()

        if user is not None:
            result = await db.execute(
                select(DailyUsage).where(
                    DailyUsage.user_id == user.id,
                    DailyUsage.date == today,
                )
            )
        else:
            result = await db.execute(
                select(DailyUsage).where(
                    DailyUsage.ip_address == ip_address,
                    DailyUsage.date == today,
                )
            )

        usage = result.scalar_one_or_none()

        if usage is not None:
            usage.scan_count += 1
        else:
            usage = DailyUsage(
                user_id=user.id if user is not None else None,
                date=today,
                scan_count=1,
                ip_address=ip_address if user is None else None,
            )
            db.add(usage)

        await db.flush()
