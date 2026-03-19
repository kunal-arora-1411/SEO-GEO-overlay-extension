"""Celery configuration."""

import os

broker_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
result_backend = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")

task_serializer = "json"
result_serializer = "json"
accept_content = ["json"]
timezone = "UTC"
enable_utc = True

# Task settings
task_acks_late = True
worker_prefetch_multiplier = 1
task_soft_time_limit = 300  # 5 minutes
task_time_limit = 600  # 10 minutes

# Beat schedule for periodic tasks
beat_schedule = {
    "cleanup-old-audits": {
        "task": "audit.tasks.cleanup_old_audits",
        "schedule": 3600.0,  # every hour
    },
}
