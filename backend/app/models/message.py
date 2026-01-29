"""
Message Model - Internal messaging system for the Education ERP
"""
from sqlalchemy import Column, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime

from app.models.base import TenantBaseModel, SoftDeleteMixin


class Message(TenantBaseModel, SoftDeleteMixin):
    """
    Internal message/notification entity.
    """
    __tablename__ = "messages"
    
    # Sender
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    sender_name = Column(String(200), nullable=True)  # Cached for display
    sender_email = Column(String(255), nullable=True)
    
    # Recipient(s)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    recipient_name = Column(String(200), nullable=True)
    recipient_email = Column(String(255), nullable=True)
    recipient_type = Column(String(50), nullable=True)  # user, role, group, all
    
    # Message Content
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    
    # Priority and Status (using String for simplicity)
    priority = Column(String(20), default="normal")  # low, normal, high, urgent
    status = Column(String(20), default="sent")  # draft, sent, read, archived
    
    # Timestamps
    sent_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    
    # Flags
    is_starred = Column(Boolean, default=False)
    is_important = Column(Boolean, default=False)
    
    # Thread (for replies)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    
    def __repr__(self):
        return f"<Message {self.subject[:30]}>"


# Enum values for reference
MESSAGE_STATUS_VALUES = ["draft", "sent", "delivered", "read", "archived"]
MESSAGE_PRIORITY_VALUES = ["low", "normal", "high", "urgent"]
