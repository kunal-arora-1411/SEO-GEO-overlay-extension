import logging
from typing import Any, Optional

import stripe

from config import Settings

logger = logging.getLogger(__name__)


class StripeService:
    """Wrapper around the Stripe SDK for subscription billing."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        stripe.api_key = settings.stripe_secret_key

    async def create_checkout_session(
        self,
        user_id: str,
        tier: str,
        success_url: str,
        cancel_url: str,
        customer_id: Optional[str] = None,
    ) -> str:
        """Create a Stripe Checkout Session and return the session URL.

        If the user already has a Stripe customer ID, it is reused.
        """
        price_id = self._settings.stripe_price_ids.get(tier)
        if price_id is None:
            raise ValueError(f"No Stripe price configured for tier: {tier}")

        params: dict[str, Any] = {
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": success_url,
            "cancel_url": cancel_url,
            "metadata": {"user_id": user_id, "tier": tier},
        }

        if customer_id:
            params["customer"] = customer_id
        else:
            params["customer_creation"] = "always"

        session = stripe.checkout.Session.create(**params)
        return session.url

    async def create_customer_portal_session(
        self,
        customer_id: str,
        return_url: str,
    ) -> str:
        """Create a Stripe Customer Portal session and return the URL."""
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return session.url

    def handle_webhook(
        self,
        payload: bytes,
        sig_header: str,
    ) -> dict[str, Any]:
        """Verify and parse a Stripe webhook event.

        Returns a dict with ``event_type`` and relevant data fields.

        Raises ``stripe.error.SignatureVerificationError`` on invalid signature.
        """
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            self._settings.stripe_webhook_secret,
        )

        event_type = event["type"]
        data_object = event["data"]["object"]
        result: dict[str, Any] = {"event_type": event_type, "raw": data_object}

        if event_type == "checkout.session.completed":
            result["user_id"] = data_object.get("metadata", {}).get("user_id")
            result["tier"] = data_object.get("metadata", {}).get("tier")
            result["customer_id"] = data_object.get("customer")
            result["subscription_id"] = data_object.get("subscription")
            logger.info(
                "Checkout completed: user_id=%s tier=%s",
                result["user_id"],
                result["tier"],
            )

        elif event_type == "customer.subscription.deleted":
            result["customer_id"] = data_object.get("customer")
            result["subscription_id"] = data_object.get("id")
            logger.info(
                "Subscription deleted: customer_id=%s subscription_id=%s",
                result["customer_id"],
                result["subscription_id"],
            )

        return result
