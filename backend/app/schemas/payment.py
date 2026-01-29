"""
Payment schemas for API requests and responses.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from uuid import UUID
import re


class PaymentGatewayEnum(str, Enum):
    RAZORPAY = "razorpay"
    STRIPE = "stripe"
    PAYTM = "paytm"
    PHONEPE = "phonepe"
    OFFLINE = "offline"


class OnlinePaymentStatusEnum(str, Enum):
    CREATED = "created"
    PENDING = "pending"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class RefundStatusEnum(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# ============== Gateway Config Schemas ==============

class PaymentGatewayConfigBase(BaseModel):
    """Base schema for payment gateway config."""
    gateway: PaymentGatewayEnum
    display_name: Optional[str] = None
    is_test_mode: bool = True
    is_active: bool = True
    is_default: bool = False
    supported_methods: List[str] = ["card", "upi", "netbanking", "wallet"]
    convenience_fee_percent: float = 0
    convenience_fee_fixed: float = 0
    pass_fee_to_customer: bool = False


class PaymentGatewayConfigCreate(PaymentGatewayConfigBase):
    """Schema for creating gateway config."""
    api_key: str
    api_secret: str
    webhook_secret: Optional[str] = None
    config: Dict[str, Any] = {}


class PaymentGatewayConfigUpdate(BaseModel):
    """Schema for updating gateway config."""
    display_name: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    webhook_secret: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_test_mode: Optional[bool] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    supported_methods: Optional[List[str]] = None
    convenience_fee_percent: Optional[float] = None
    convenience_fee_fixed: Optional[float] = None
    pass_fee_to_customer: Optional[bool] = None


class PaymentGatewayConfigResponse(PaymentGatewayConfigBase):
    """Schema for gateway config response (without secrets)."""
    id: UUID
    tenant_id: UUID
    webhook_url: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============== Payment Order Schemas ==============

class CreatePaymentOrderRequest(BaseModel):
    """Schema for creating a payment order."""
    amount: float = Field(..., gt=0)
    currency: str = "INR"
    purpose: str = "fee_payment"
    description: Optional[str] = None
    fee_payment_id: Optional[UUID] = None
    student_id: Optional[UUID] = None
    payer_name: Optional[str] = None
    payer_email: Optional[str] = None
    payer_phone: Optional[str] = None
    gateway: Optional[PaymentGatewayEnum] = None  # Use default if not specified
    notes: Dict[str, Any] = {}
    
    @field_validator('payer_email')
    @classmethod
    def validate_email(cls, v):
        if v and not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", v):
            raise ValueError('Invalid email format')
        return v
    
    @field_validator('payer_phone')
    @classmethod
    def validate_phone(cls, v):
        if v and not re.match(r"^\+?[\d\s-]{10,15}$", v):
            raise ValueError('Invalid phone format')
        return v


class PaymentOrderResponse(BaseModel):
    """Schema for payment order response."""
    id: UUID
    tenant_id: UUID
    order_number: str
    gateway: PaymentGatewayEnum
    gateway_order_id: Optional[str] = None
    amount: float
    currency: str
    convenience_fee: float
    total_amount: float
    purpose: str
    description: Optional[str] = None
    student_id: Optional[UUID] = None
    payer_name: Optional[str] = None
    payer_email: Optional[str] = None
    status: OnlinePaymentStatusEnum
    expires_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class PaymentOrderDetailResponse(PaymentOrderResponse):
    """Detailed payment order with checkout info."""
    checkout_url: Optional[str] = None
    gateway_data: Dict[str, Any] = {}  # Data needed for SDK initialization
    receipt_url: Optional[str] = None


class PaymentOrderListResponse(BaseModel):
    """Schema for list of payment orders."""
    items: List[PaymentOrderResponse]
    total: int
    page: int
    page_size: int


# ============== Payment Verification Schemas ==============

class VerifyPaymentRequest(BaseModel):
    """Schema for verifying payment (Razorpay format)."""
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    
    # Generic format
    order_id: Optional[str] = None
    payment_id: Optional[str] = None
    signature: Optional[str] = None


class VerifyPaymentResponse(BaseModel):
    """Schema for payment verification response."""
    success: bool
    order_number: str
    transaction_id: Optional[str] = None
    status: str
    message: str
    receipt_url: Optional[str] = None


# ============== Transaction Schemas ==============

class PaymentTransactionResponse(BaseModel):
    """Schema for payment transaction response."""
    id: UUID
    order_id: UUID
    transaction_id: str
    gateway_transaction_id: Optional[str] = None
    amount: float
    currency: str
    payment_method: Optional[str] = None
    status: OnlinePaymentStatusEnum
    error_message: Optional[str] = None
    authorized_at: Optional[datetime] = None
    captured_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============== Refund Schemas ==============

class CreateRefundRequest(BaseModel):
    """Schema for creating a refund."""
    transaction_id: UUID
    amount: Optional[float] = None  # If None, full refund
    reason: Optional[str] = None
    notes: Dict[str, Any] = {}


class RefundResponse(BaseModel):
    """Schema for refund response."""
    id: UUID
    refund_id: str
    gateway_refund_id: Optional[str] = None
    transaction_id: UUID
    amount: float
    reason: Optional[str] = None
    status: RefundStatusEnum
    processed_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============== Webhook Schemas ==============

class WebhookPayload(BaseModel):
    """Generic webhook payload schema."""
    event: str
    payload: Dict[str, Any]
    
    class Config:
        extra = "allow"


# ============== Checkout Schemas ==============

class CheckoutOptionsResponse(BaseModel):
    """Schema for checkout options (available payment methods)."""
    gateway: PaymentGatewayEnum
    key: str  # Public key for SDK
    order_id: str
    amount: float
    currency: str
    name: str  # Institution name
    description: str
    prefill: Dict[str, str] = {}
    notes: Dict[str, Any] = {}
    theme: Dict[str, str] = {}
    
    # Available payment methods
    methods: Dict[str, bool] = {
        "card": True,
        "upi": True,
        "netbanking": True,
        "wallet": True,
        "emi": False,
        "paylater": False,
    }


# ============== Statistics Schemas ==============

class PaymentStatsResponse(BaseModel):
    """Schema for payment statistics."""
    total_collected: float
    total_pending: float
    total_refunded: float
    total_transactions: int
    successful_transactions: int
    failed_transactions: int
    success_rate: float
    
    # By payment method
    by_method: Dict[str, float] = {}
    
    # By status
    by_status: Dict[str, int] = {}
    
    # Recent trends
    daily_collection: List[Dict[str, Any]] = []
