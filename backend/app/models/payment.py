"""
Payment models for online payment integration.
Supports Razorpay and Stripe payment gateways.
"""
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, Float, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import secrets

from app.models.base import TenantBaseModel, TimestampMixin


class PaymentGateway(str, enum.Enum):
    """Supported payment gateways."""
    RAZORPAY = "razorpay"
    STRIPE = "stripe"
    PAYTM = "paytm"
    PHONEPE = "phonepe"
    OFFLINE = "offline"


class OnlinePaymentStatus(str, enum.Enum):
    """Online payment status enumeration."""
    CREATED = "created"
    PENDING = "pending"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class RefundStatus(str, enum.Enum):
    """Refund status enumeration."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class PaymentGatewayConfig(TenantBaseModel, TimestampMixin):
    """
    Payment gateway configuration per tenant.
    Stores API keys and settings for each payment provider.
    """
    __tablename__ = "payment_gateway_configs"
    
    # Gateway type
    gateway = Column(SQLEnum(PaymentGateway), nullable=False)
    
    # Display name
    display_name = Column(String(100), nullable=True)
    
    # API credentials (encrypted in production)
    api_key = Column(String(500), nullable=True)
    api_secret = Column(String(500), nullable=True)
    
    # Additional config (merchant ID, webhook secret, etc.)
    config = Column(JSONB, default={})
    
    # Webhook URL
    webhook_url = Column(String(500), nullable=True)
    webhook_secret = Column(String(500), nullable=True)
    
    # Mode
    is_test_mode = Column(Boolean, default=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    
    # Supported payment methods
    supported_methods = Column(JSONB, default=["card", "upi", "netbanking", "wallet"])
    
    # Fee settings
    convenience_fee_percent = Column(Float, default=0)
    convenience_fee_fixed = Column(Float, default=0)
    pass_fee_to_customer = Column(Boolean, default=False)
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'gateway', name='uq_payment_gateway_tenant'),
    )
    
    def __repr__(self):
        return f"<PaymentGatewayConfig {self.gateway.value}>"


class PaymentOrder(TenantBaseModel, TimestampMixin):
    """
    Payment order - represents an intent to collect payment.
    Created before initiating payment with the gateway.
    """
    __tablename__ = "payment_orders"
    
    # Order identification
    order_number = Column(String(50), nullable=False, unique=True, index=True)
    
    # Gateway order ID
    gateway = Column(SQLEnum(PaymentGateway), nullable=False)
    gateway_order_id = Column(String(255), nullable=True, index=True)
    
    # Amount
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="INR")
    convenience_fee = Column(Float, default=0)
    total_amount = Column(Float, nullable=False)  # amount + convenience_fee
    
    # Purpose
    fee_payment_id = Column(UUID(as_uuid=True), ForeignKey("fee_payments.id"), nullable=True, index=True)
    purpose = Column(String(100), default="fee_payment")  # fee_payment, admission, other
    description = Column(String(500), nullable=True)
    
    # Payer information
    payer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=True, index=True)
    payer_name = Column(String(255), nullable=True)
    payer_email = Column(String(255), nullable=True)
    payer_phone = Column(String(20), nullable=True)
    
    # Status
    status = Column(SQLEnum(OnlinePaymentStatus), default=OnlinePaymentStatus.CREATED, index=True)
    
    # Gateway response
    gateway_response = Column(JSONB, default={})
    
    # Expiry
    expires_at = Column(DateTime, nullable=True)
    
    # Notes
    notes = Column(JSONB, default={})
    
    # Receipt URL (for successful payments)
    receipt_url = Column(String(500), nullable=True)
    
    # Relationships
    transactions = relationship("PaymentTransaction", back_populates="order", lazy="dynamic")
    fee_payment = relationship("FeePayment", foreign_keys=[fee_payment_id])
    student = relationship("Student", foreign_keys=[student_id])
    
    def __repr__(self):
        return f"<PaymentOrder {self.order_number}>"
    
    @classmethod
    def generate_order_number(cls) -> str:
        """Generate a unique order number."""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        random_suffix = secrets.token_hex(4).upper()
        return f"ORD-{timestamp}-{random_suffix}"
    
    @property
    def is_expired(self) -> bool:
        """Check if order has expired."""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at
    
    @property
    def is_successful(self) -> bool:
        """Check if payment was successful."""
        return self.status == OnlinePaymentStatus.CAPTURED


class PaymentTransaction(TenantBaseModel, TimestampMixin):
    """
    Individual payment transaction.
    Multiple transactions can be attempted for a single order.
    """
    __tablename__ = "payment_transactions"
    
    # Order reference
    order_id = Column(UUID(as_uuid=True), ForeignKey("payment_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Transaction identification
    transaction_id = Column(String(100), nullable=False, unique=True, index=True)
    gateway_transaction_id = Column(String(255), nullable=True, index=True)
    gateway_payment_id = Column(String(255), nullable=True)
    
    # Amount
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="INR")
    
    # Payment method used
    payment_method = Column(String(50), nullable=True)  # card, upi, netbanking, wallet
    payment_method_details = Column(JSONB, default={})  # last4, bank name, etc.
    
    # Status
    status = Column(SQLEnum(OnlinePaymentStatus), default=OnlinePaymentStatus.PENDING, index=True)
    
    # Gateway response
    gateway_response = Column(JSONB, default={})
    error_code = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    authorized_at = Column(DateTime, nullable=True)
    captured_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    
    # Signature verification
    signature = Column(String(500), nullable=True)
    signature_verified = Column(Boolean, default=False)
    
    # Relationships
    order = relationship("PaymentOrder", back_populates="transactions")
    refunds = relationship("PaymentRefund", back_populates="transaction", lazy="dynamic")
    
    def __repr__(self):
        return f"<PaymentTransaction {self.transaction_id}>"
    
    @classmethod
    def generate_transaction_id(cls) -> str:
        """Generate a unique transaction ID."""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        random_suffix = secrets.token_hex(6).upper()
        return f"TXN-{timestamp}-{random_suffix}"


class PaymentRefund(TenantBaseModel, TimestampMixin):
    """
    Refund record for payment transactions.
    """
    __tablename__ = "payment_refunds"
    
    # Transaction reference
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("payment_transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Refund identification
    refund_id = Column(String(100), nullable=False, unique=True, index=True)
    gateway_refund_id = Column(String(255), nullable=True)
    
    # Amount
    amount = Column(Float, nullable=False)
    
    # Reason
    reason = Column(String(500), nullable=True)
    
    # Status
    status = Column(SQLEnum(RefundStatus), default=RefundStatus.PENDING)
    
    # Gateway response
    gateway_response = Column(JSONB, default={})
    
    # Processing
    processed_at = Column(DateTime, nullable=True)
    
    # Initiated by
    initiated_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Notes
    notes = Column(JSONB, default={})
    
    # Relationships
    transaction = relationship("PaymentTransaction", back_populates="refunds")
    
    def __repr__(self):
        return f"<PaymentRefund {self.refund_id}>"
    
    @classmethod
    def generate_refund_id(cls) -> str:
        """Generate a unique refund ID."""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        random_suffix = secrets.token_hex(4).upper()
        return f"RFD-{timestamp}-{random_suffix}"


class PaymentNotification(TenantBaseModel):
    """
    Webhook notification log from payment gateways.
    """
    __tablename__ = "payment_notifications"
    
    # Source
    gateway = Column(SQLEnum(PaymentGateway), nullable=False)
    
    # Event type
    event_type = Column(String(100), nullable=False)
    
    # Raw payload
    payload = Column(JSONB, nullable=False)
    
    # Headers (for verification)
    headers = Column(JSONB, default={})
    
    # Signature
    signature = Column(String(500), nullable=True)
    signature_valid = Column(Boolean, default=False)
    
    # Processing
    processed = Column(Boolean, default=False)
    processed_at = Column(DateTime, nullable=True)
    processing_error = Column(Text, nullable=True)
    
    # Related entities
    order_id = Column(UUID(as_uuid=True), ForeignKey("payment_orders.id"), nullable=True)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("payment_transactions.id"), nullable=True)
    
    # Received timestamp
    received_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<PaymentNotification {self.event_type}>"
