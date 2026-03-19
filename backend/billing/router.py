import logging
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from billing.schemas import (
    BillingStatusResponse,
    CheckoutResponse,
    CreateCheckoutRequest,
    PortalRequest,
    PortalResponse,
)
from billing.stripe_service import StripeService
from config import Settings
from db.models.daily_usage import DailyUsage
from db.models.user import User
from db.session import get_db
from middleware.usage_gate import TIER_LIMITS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


def _get_stripe_service() -> StripeService:
    return StripeService(Settings())


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    request: CreateCheckoutRequest,
    user: User = Depends(get_current_user),
    stripe_svc: StripeService = Depends(_get_stripe_service),
) -> CheckoutResponse:
    """Create a Stripe Checkout Session for the requested tier upgrade."""
    if request.tier == "free":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot subscribe to the free tier",
        )

    if user.tier == request.tier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Already subscribed to {request.tier} tier",
        )

    url = await stripe_svc.create_checkout_session(
        user_id=str(user.id),
        tier=request.tier,
        success_url=request.success_url,
        cancel_url=request.cancel_url,
        customer_id=user.stripe_customer_id,
    )
    return CheckoutResponse(checkout_url=url)


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Handle incoming Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    stripe_svc = StripeService(Settings())
    try:
        event_data = stripe_svc.handle_webhook(payload, sig_header)
    except Exception as exc:
        logger.warning("Stripe webhook verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook signature verification failed",
        )

    event_type = event_data["event_type"]

    if event_type == "checkout.session.completed":
        user_id = event_data.get("user_id")
        tier = event_data.get("tier")
        customer_id = event_data.get("customer_id")
        subscription_id = event_data.get("subscription_id")

        if user_id and tier:
            result = await db.execute(
                select(User).where(User.id == uuid.UUID(user_id))
            )
            user = result.scalar_one_or_none()
            if user is not None:
                user.tier = tier
                user.stripe_customer_id = customer_id
                user.subscription_status = "active"
                user.subscription_id = subscription_id
                await db.flush()
                logger.info(
                    "User %s upgraded to tier %s", user_id, tier
                )

    elif event_type == "customer.subscription.deleted":
        customer_id = event_data.get("customer_id")
        if customer_id:
            result = await db.execute(
                select(User).where(User.stripe_customer_id == customer_id)
            )
            user = result.scalar_one_or_none()
            if user is not None:
                user.tier = "free"
                user.subscription_status = "canceled"
                user.subscription_id = None
                await db.flush()
                logger.info(
                    "User %s downgraded to free (subscription deleted)",
                    user.id,
                )

    return {"status": "ok"}


@router.get("/status", response_model=BillingStatusResponse)
async def billing_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BillingStatusResponse:
    """Return the current billing status for the authenticated user."""
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

    return BillingStatusResponse(
        tier=user.tier,
        scans_today=scans_today,
        scans_limit=limit,
        subscription_status=user.subscription_status,
    )


@router.post("/portal", response_model=PortalResponse)
async def customer_portal(
    request: PortalRequest,
    user: User = Depends(get_current_user),
    stripe_svc: StripeService = Depends(_get_stripe_service),
) -> PortalResponse:
    """Create a Stripe Customer Portal session for subscription management."""
    if not user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Stripe customer record found. Subscribe to a plan first.",
        )

    url = await stripe_svc.create_customer_portal_session(
        customer_id=user.stripe_customer_id,
        return_url=request.return_url,
    )
    return PortalResponse(portal_url=url)
