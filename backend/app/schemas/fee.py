"""
Fee Schemas - Pydantic models for Fee API
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from uuid import UUID
from enum import Enum


class FeeType(str, Enum):
    TUITION = "tuition"
    ADMISSION = "admission"
    EXAMINATION = "examination"
    LIBRARY = "library"
    LABORATORY = "laboratory"
    SPORTS = "sports"
    TRANSPORT = "transport"
    HOSTEL = "hostel"
    MESS = "mess"
    OTHER = "other"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    UPI = "upi"
    NET_BANKING = "net_banking"
    CHEQUE = "cheque"
    DD = "dd"
    ONLINE = "online"
    WALLET = "wallet"


# Fee Payment Schemas
class FeePaymentBase(BaseModel):
    student_id: UUID
    fee_type: FeeType
    description: Optional[str] = None
    academic_year: Optional[str] = None
    semester: Optional[int] = None
    total_amount: float = Field(..., gt=0)
    paid_amount: Optional[float] = 0.0
    discount_amount: Optional[float] = 0.0
    fine_amount: Optional[float] = 0.0
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None


class FeePaymentCreate(FeePaymentBase):
    pass


class FeePaymentUpdate(BaseModel):
    fee_type: Optional[FeeType] = None
    description: Optional[str] = None
    academic_year: Optional[str] = None
    semester: Optional[int] = None
    total_amount: Optional[float] = None
    paid_amount: Optional[float] = None
    discount_amount: Optional[float] = None
    fine_amount: Optional[float] = None
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = None
    payment_date: Optional[datetime] = None
    due_date: Optional[date] = None
    status: Optional[PaymentStatus] = None
    notes: Optional[str] = None


class FeePaymentResponse(FeePaymentBase):
    id: UUID
    tenant_id: UUID
    transaction_id: str
    receipt_number: Optional[str] = None
    payment_date: Optional[datetime] = None
    status: PaymentStatus
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class FeePaymentListResponse(BaseModel):
    items: List[FeePaymentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# Make Payment Schema
class MakePaymentRequest(BaseModel):
    payment_id: UUID
    amount: float = Field(..., gt=0)
    payment_method: PaymentMethod
    payment_reference: Optional[str] = None
    notes: Optional[str] = None


# Fee Summary Schema
class FeeSummary(BaseModel):
    total_fees: float
    total_paid: float
    total_pending: float
    total_overdue: float
    total_discounts: float
    payment_count: int
