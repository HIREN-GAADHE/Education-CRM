"""
Tenant Settings Model - Configuration and preferences per tenant
"""
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import TenantBaseModel


class TenantSettings(TenantBaseModel):
    """
    Tenant-specific settings and preferences.
    One-to-one relationship with Tenant.
    """
    __tablename__ = "tenant_settings"
    
    # Appearance Settings
    theme = Column(String(20), default="light")  # light, dark
    primary_color = Column(String(7), default="#667eea")  # Hex color
    sidebar_collapsed = Column(Boolean, default=False)
    language = Column(String(10), default="en")
    timezone = Column(String(50), default="Asia/Kolkata")
    
    # System Settings
    date_format = Column(String(20), default="DD/MM/YYYY")
    time_format = Column(String(10), default="12h")  # 12h, 24h
    currency = Column(String(3), default="INR")
    currency_symbol = Column(String(5), default="₹")
    
    # Notification Settings
    email_notifications = Column(Boolean, default=True)
    push_notifications = Column(Boolean, default=True)
    sms_alerts = Column(Boolean, default=False)
    weekly_digest = Column(Boolean, default=True)
    
    # SMTP Settings (Tenant Specific)
    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, nullable=True)
    smtp_username = Column(String(255), nullable=True)
    smtp_password = Column(String(255), nullable=True)
    smtp_from_email = Column(String(255), nullable=True)
    smtp_from_name = Column(String(255), nullable=True)
    smtp_security = Column(String(10), default="tls")  # tls, ssl, none
    
    # Security Settings
    two_factor_enabled = Column(Boolean, default=False)
    session_timeout_minutes = Column(Integer, default=30)
    login_notifications = Column(Boolean, default=True)
    api_access_enabled = Column(Boolean, default=False)
    password_expiry_days = Column(Integer, default=90)
    
    # Academic Settings
    academic_year = Column(String(20), nullable=True)  # e.g., "2024-25"
    grading_system = Column(String(50), default="percentage")  # percentage, cgpa, letter
    
    # Institution Info (overrides from Tenant if set)
    institution_name = Column(String(255), nullable=True)
    institution_logo_url = Column(String(500), nullable=True)
    institution_address = Column(Text, nullable=True)
    institution_phone = Column(String(20), nullable=True)
    institution_email = Column(String(255), nullable=True)
    institution_website = Column(String(255), nullable=True)
    
    # Extra settings (JSONB for flexibility)
    extra_settings = Column(JSONB, default={})
    
    def __repr__(self):
        return f"<TenantSettings tenant={self.tenant_id}>"
