from app.core.celery_app import celery_app

# Import tasks module to register tasks
from app.tasks import reminders

# celery_app is the instance used by the worker
__all__ = ["celery_app"]
