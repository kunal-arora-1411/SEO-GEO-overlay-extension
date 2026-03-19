from typing import Optional

from pydantic import BaseModel, Field


class CreateCheckoutRequest(BaseModel):
    tier: str = Field(
        description="Target subscription tier",
        pattern="^(starter|pro|agency)$",
    )
    success_url: str = "https://app.seo-geo-optimizer.com/billing/success"
    cancel_url: str = "https://app.seo-geo-optimizer.com/billing/cancel"


class CheckoutResponse(BaseModel):
    checkout_url: str


class BillingStatusResponse(BaseModel):
    tier: str
    scans_today: int
    scans_limit: int
    subscription_status: Optional[str] = None


class PortalRequest(BaseModel):
    return_url: str = "https://app.seo-geo-optimizer.com/billing"


class PortalResponse(BaseModel):
    portal_url: str
