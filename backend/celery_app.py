"""Celery application instance."""

from celery import Celery

app = Celery("seo_geo_optimizer")
app.config_from_object("celery_config")

# Auto-discover tasks from these modules
app.autodiscover_tasks([
    "audit",
    "competitors",
    "brand_voice",
])
