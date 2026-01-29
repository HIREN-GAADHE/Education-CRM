"""
Notification service for sending emails, SMS, and other notifications.
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.config.settings import settings
from app.models.notification import (
    Notification, 
    NotificationTemplate, 
    NotificationType, 
    NotificationStatus,
    NotificationPriority,
    NotificationPreference
)

logger = logging.getLogger(__name__)


class EmailService:
    """
    Email sending service using SMTP.
    """
    
    def __init__(self):
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.username = settings.SMTP_USER
        self.password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL
        self.from_name = settings.SMTP_FROM_NAME
        self.use_tls = settings.SMTP_USE_TLS
    
    async def send(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        to_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send an email using SMTP.
        
        Returns:
            Dict with success status and provider info
        """
        try:
            # Create message
            if html_body:
                message = MIMEMultipart("alternative")
                message.attach(MIMEText(body, "plain"))
                message.attach(MIMEText(html_body, "html"))
            else:
                message = MIMEText(body, "plain")
            
            message["Subject"] = subject
            message["From"] = f"{self.from_name} <{self.from_email}>"
            message["To"] = f"{to_name} <{to_email}>" if to_name else to_email
            
            # Send email
            if self.use_tls:
                await aiosmtplib.send(
                    message,
                    hostname=self.host,
                    port=self.port,
                    username=self.username,
                    password=self.password,
                    start_tls=True,
                )
            else:
                await aiosmtplib.send(
                    message,
                    hostname=self.host,
                    port=self.port,
                    username=self.username,
                    password=self.password,
                )
            
            logger.info(f"Email sent successfully to {to_email}")
            return {
                "success": True,
                "provider": "smtp",
                "message_id": None,
            }
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return {
                "success": False,
                "provider": "smtp",
                "error": str(e),
            }


class SMSService:
    """
    SMS sending service supporting MSG91 and Twilio.
    """
    
    def __init__(self):
        self.provider = getattr(settings, 'SMS_PROVIDER', 'msg91')
        
        # MSG91 settings
        self.msg91_auth_key = getattr(settings, 'MSG91_AUTH_KEY', None)
        self.msg91_sender_id = getattr(settings, 'MSG91_SENDER_ID', 'EDUERP')
        
        # Twilio settings
        self.twilio_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', None)
        self.twilio_token = getattr(settings, 'TWILIO_AUTH_TOKEN', None)
        self.twilio_from = getattr(settings, 'TWILIO_FROM_NUMBER', None)
    
    async def send(
        self,
        to_phone: str,
        message: str,
    ) -> Dict[str, Any]:
        """
        Send an SMS using configured provider.
        
        Returns:
            Dict with success status and provider info
        """
        if self.provider == "msg91":
            return await self._send_msg91(to_phone, message)
        elif self.provider == "twilio":
            return await self._send_twilio(to_phone, message)
        else:
            logger.warning(f"Unknown SMS provider: {self.provider}")
            return {
                "success": False,
                "provider": self.provider,
                "error": f"Unknown provider: {self.provider}",
            }
    
    async def _send_msg91(self, to_phone: str, message: str) -> Dict[str, Any]:
        """Send SMS via MSG91."""
        if not self.msg91_auth_key:
            return {
                "success": False,
                "provider": "msg91",
                "error": "MSG91 auth key not configured",
            }
        
        try:
            url = "https://api.msg91.com/api/v5/flow/"
            headers = {
                "authkey": self.msg91_auth_key,
                "Content-Type": "application/json",
            }
            payload = {
                "sender": self.msg91_sender_id,
                "route": "4",  # Transactional route
                "country": "91",
                "sms": [
                    {
                        "message": message,
                        "to": [to_phone.replace("+", "")],
                    }
                ],
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response_data = response.json()
                
                if response.status_code == 200 and response_data.get("type") == "success":
                    logger.info(f"SMS sent successfully to {to_phone} via MSG91")
                    return {
                        "success": True,
                        "provider": "msg91",
                        "message_id": response_data.get("request_id"),
                    }
                else:
                    logger.error(f"MSG91 error: {response_data}")
                    return {
                        "success": False,
                        "provider": "msg91",
                        "error": response_data.get("message", "Unknown error"),
                    }
                    
        except Exception as e:
            logger.error(f"Failed to send SMS via MSG91: {str(e)}")
            return {
                "success": False,
                "provider": "msg91",
                "error": str(e),
            }
    
    async def _send_twilio(self, to_phone: str, message: str) -> Dict[str, Any]:
        """Send SMS via Twilio."""
        if not all([self.twilio_sid, self.twilio_token, self.twilio_from]):
            return {
                "success": False,
                "provider": "twilio",
                "error": "Twilio credentials not configured",
            }
        
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{self.twilio_sid}/Messages.json"
            auth = (self.twilio_sid, self.twilio_token)
            payload = {
                "From": self.twilio_from,
                "To": to_phone,
                "Body": message,
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, data=payload, auth=auth)
                response_data = response.json()
                
                if response.status_code in [200, 201]:
                    logger.info(f"SMS sent successfully to {to_phone} via Twilio")
                    return {
                        "success": True,
                        "provider": "twilio",
                        "message_id": response_data.get("sid"),
                    }
                else:
                    logger.error(f"Twilio error: {response_data}")
                    return {
                        "success": False,
                        "provider": "twilio",
                        "error": response_data.get("message", "Unknown error"),
                    }
                    
        except Exception as e:
            logger.error(f"Failed to send SMS via Twilio: {str(e)}")
            return {
                "success": False,
                "provider": "twilio",
                "error": str(e),
            }


class NotificationService:
    """
    Main notification service that orchestrates sending notifications.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.email_service = EmailService()
        self.sms_service = SMSService()
    
    async def get_template(
        self,
        tenant_id: str,
        code: str,
    ) -> Optional[NotificationTemplate]:
        """Get a notification template by code."""
        result = await self.db.execute(
            select(NotificationTemplate).where(
                NotificationTemplate.tenant_id == tenant_id,
                NotificationTemplate.code == code,
                NotificationTemplate.is_active == True,
            )
        )
        return result.scalar_one_or_none()
    
    async def create_template(
        self,
        tenant_id: str,
        code: str,
        name: str,
        notification_type: NotificationType,
        body: str,
        subject: Optional[str] = None,
        html_body: Optional[str] = None,
        variables: List[str] = None,
        category: Optional[str] = None,
    ) -> NotificationTemplate:
        """Create a new notification template."""
        template = NotificationTemplate(
            tenant_id=tenant_id,
            code=code,
            name=name,
            notification_type=notification_type,
            subject=subject,
            body=body,
            html_body=html_body,
            variables=variables or [],
            category=category,
        )
        self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)
        return template
    
    async def send_notification(
        self,
        tenant_id: str,
        notification_type: NotificationType,
        recipient_email: Optional[str] = None,
        recipient_phone: Optional[str] = None,
        recipient_name: Optional[str] = None,
        recipient_id: Optional[str] = None,
        subject: Optional[str] = None,
        body: Optional[str] = None,
        html_body: Optional[str] = None,
        template_code: Optional[str] = None,
        template_data: Dict[str, Any] = None,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        metadata: Dict[str, Any] = None,
    ) -> Notification:
        """
        Send a notification.
        
        Can use a template by providing template_code and template_data,
        or send a custom message by providing subject, body, and html_body.
        """
        template = None
        template_data = template_data or {}
        
        # If template code provided, fetch and render template
        if template_code:
            template = await self.get_template(tenant_id, template_code)
            if template:
                subject, body, html_body = template.render(template_data)
        
        if not body:
            raise ValueError("Notification body is required")
        
        # Create notification record
        notification = Notification(
            tenant_id=tenant_id,
            template_id=template.id if template else None,
            notification_type=notification_type,
            priority=priority,
            recipient_id=recipient_id,
            recipient_email=recipient_email,
            recipient_phone=recipient_phone,
            recipient_name=recipient_name,
            subject=subject,
            body=body,
            html_body=html_body,
            template_data=template_data,
            status=NotificationStatus.PENDING,
            metadata=metadata or {},
        )
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)
        
        # Send the notification based on type
        result = await self._send(notification)
        
        # Update notification status
        if result["success"]:
            notification.mark_sent(result["provider"], result.get("message_id"))
        else:
            notification.mark_failed(result.get("error", "Unknown error"))
        
        await self.db.commit()
        await self.db.refresh(notification)
        
        return notification
    
    async def _send(self, notification: Notification) -> Dict[str, Any]:
        """Internal method to send notification via appropriate channel."""
        if notification.notification_type == NotificationType.EMAIL:
            if not notification.recipient_email:
                return {"success": False, "error": "No email address provided"}
            
            return await self.email_service.send(
                to_email=notification.recipient_email,
                subject=notification.subject or "Notification",
                body=notification.body,
                html_body=notification.html_body,
                to_name=notification.recipient_name,
            )
        
        elif notification.notification_type == NotificationType.SMS:
            if not notification.recipient_phone:
                return {"success": False, "error": "No phone number provided"}
            
            return await self.sms_service.send(
                to_phone=notification.recipient_phone,
                message=notification.body,
            )
        
        else:
            return {
                "success": False,
                "error": f"Unsupported notification type: {notification.notification_type}",
            }
    
    async def send_bulk(
        self,
        tenant_id: str,
        notification_type: NotificationType,
        recipients: List[Dict[str, Any]],
        template_code: Optional[str] = None,
        template_data: Dict[str, Any] = None,
        subject: Optional[str] = None,
        body: Optional[str] = None,
        priority: NotificationPriority = NotificationPriority.NORMAL,
    ) -> List[Notification]:
        """
        Send bulk notifications to multiple recipients.
        
        Recipients should be a list of dicts with keys:
        - email (optional)
        - phone (optional)
        - name (optional)
        - user_id (optional)
        - data (optional - recipient-specific template data)
        """
        notifications = []
        
        for recipient in recipients:
            # Merge recipient-specific data with common data
            merged_data = {**(template_data or {}), **(recipient.get("data", {}))}
            
            try:
                notification = await self.send_notification(
                    tenant_id=tenant_id,
                    notification_type=notification_type,
                    recipient_email=recipient.get("email"),
                    recipient_phone=recipient.get("phone"),
                    recipient_name=recipient.get("name"),
                    recipient_id=recipient.get("user_id"),
                    subject=subject,
                    body=body,
                    template_code=template_code,
                    template_data=merged_data,
                    priority=priority,
                )
                notifications.append(notification)
            except Exception as e:
                logger.error(f"Failed to send notification to {recipient}: {str(e)}")
        
        return notifications
    
    async def get_notifications(
        self,
        tenant_id: str,
        page: int = 1,
        page_size: int = 20,
        notification_type: Optional[NotificationType] = None,
        status: Optional[NotificationStatus] = None,
    ) -> tuple[List[Notification], int]:
        """Get notifications with filtering and pagination."""
        query = select(Notification).where(Notification.tenant_id == tenant_id)
        count_query = select(func.count(Notification.id)).where(Notification.tenant_id == tenant_id)
        
        if notification_type:
            query = query.where(Notification.notification_type == notification_type)
            count_query = count_query.where(Notification.notification_type == notification_type)
        
        if status:
            query = query.where(Notification.status == status)
            count_query = count_query.where(Notification.status == status)
        
        # Get total count
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()
        
        # Get paginated results
        query = query.order_by(Notification.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        notifications = result.scalars().all()
        
        return notifications, total
    
    async def get_stats(self, tenant_id: str) -> Dict[str, Any]:
        """Get notification statistics for a tenant."""
        # Count by status
        status_query = select(
            Notification.status,
            func.count(Notification.id)
        ).where(
            Notification.tenant_id == tenant_id
        ).group_by(Notification.status)
        
        status_result = await self.db.execute(status_query)
        by_status = {row[0].value: row[1] for row in status_result}
        
        # Count by type
        type_query = select(
            Notification.notification_type,
            func.count(Notification.id)
        ).where(
            Notification.tenant_id == tenant_id
        ).group_by(Notification.notification_type)
        
        type_result = await self.db.execute(type_query)
        by_type = {row[0].value: row[1] for row in type_result}
        
        return {
            "total_sent": by_status.get("sent", 0) + by_status.get("delivered", 0),
            "total_delivered": by_status.get("delivered", 0),
            "total_failed": by_status.get("failed", 0),
            "total_pending": by_status.get("pending", 0) + by_status.get("queued", 0),
            "by_type": by_type,
            "by_status": by_status,
        }
