import asyncio
from app.core.celery_app import celery_app
from app.core.services.reminder_service import ReminderService
from app.config import async_session_factory
from app.models.reminder import NotificationChannel
import logging

logger = logging.getLogger(__name__)

@celery_app.task
def process_auto_reminders_task():
    """
    Celery task to check for upcoming/overdue fees and send reminders.
    This is a synchronous wrapper around the async service method.
    """
    logger.info("Starting automated fee reminder process...")
    
    async def _run_process():
        async with async_session_factory() as db:
            service = ReminderService(db)
            await service.process_auto_reminders()
            
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If we are already in an event loop (unlikely for standard celery worker, but possible)
            loop.create_task(_run_process())
        else:
            loop.run_until_complete(_run_process())
            
    except RuntimeError:
        # Create a new loop if none exists
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(_run_process())
        loop.close()
    except Exception as e:
        logger.error(f"Error in process_auto_reminders_task: {str(e)}")
        # In production, you might want to retry here
        # raise self.retry(exc=e)

    logger.info("Automated fee reminder process completed.")

@celery_app.task
def check_monthly_reminders_task():
    """
    Celery task to run daily and check if today is the 'Monthly Reminder Day' for any tenant.
    """
    logger.info("Checking for monthly recurring reminders...")
    
    async def _run_process():
        async with async_session_factory() as db:
            service = ReminderService(db)
            await service.process_monthly_reminders()
            
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(_run_process())
        else:
            loop.run_until_complete(_run_process())
            
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(_run_process())
        loop.close()
    except Exception as e:
        logger.error(f"Error in check_monthly_reminders_task: {str(e)}")

    logger.info("Monthly reminder check completed.")

@celery_app.task
def process_bulk_reminders_task(tenant_id_str: str, request_data: dict):
    """
    Celery task to process bulk reminders asynchronously.
    """
    from uuid import UUID
    logger.info(f"Starting bulk reminder task for tenant {tenant_id_str}...")
    
    tenant_id = UUID(tenant_id_str)
    
    async def _run_process():
        async with async_session_factory() as db:
            service = ReminderService(db)
            
            # Reconstruct arguments from dict
            filters = request_data.get("filters", {})
            channels = [NotificationChannel(c) for c in request_data.get("channels", [])]
            exclude_ids = [UUID(id) for id in request_data.get("exclude_student_ids", [])] if request_data.get("exclude_student_ids") else None
            template_id = UUID(request_data.get("template_id")) if request_data.get("template_id") else None
            custom_message = request_data.get("custom_message")
            
            count = await service.send_bulk_reminders_by_filter(
                tenant_id=tenant_id,
                filters=filters,
                channels=channels,
                exclude_student_ids=exclude_ids,
                template_id=template_id,
                custom_message=custom_message
            )
            logger.info(f"Bulk task completed. Sent: {count}")

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(_run_process())
        else:
            loop.run_until_complete(_run_process())
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(_run_process())
        loop.close()
    except Exception as e:
         logger.error(f"Error in process_bulk_reminders_task: {str(e)}")
