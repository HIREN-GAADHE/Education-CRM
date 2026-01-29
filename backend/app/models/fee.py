"""
Fee Management Models - Fee structures, payments, and invoices
"""
from sqlalchemy import Column, String, Date, Text, Enum, Integer, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, date
import enum

from app.models.base import TenantBaseModel, BaseModel


class FeeType(str, enum.Enum):
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


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CARD = "card"
    UPI = "upi"
    NET_BANKING = "net_banking"
    CHEQUE = "cheque"
    DD = "dd"
    ONLINE = "online"
    WALLET = "wallet"


class FeeStructure(TenantBaseModel):
    """
    Fee structure template for different courses/programs.
    """
    __tablename__ = "fee_structures"
    
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    
    # Applicability
    course = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    batch = Column(String(50), nullable=True)
    academic_year = Column(String(20), nullable=True)  # e.g., "2024-25"
    
    # Fee breakdown (JSONB for flexibility)
    fee_components = Column(JSONB, default=[])  # [{type, name, amount, optional}]
    
    total_amount = Column(Float, default=0.0)
    
    # Validity
    effective_from = Column(Date, nullable=True)
    effective_until = Column(Date, nullable=True)
    
    is_active = Column(Boolean, default=True)
    
    def __repr__(self):
        return f"<FeeStructure {self.name}: ₹{self.total_amount}>"


class FeePayment(TenantBaseModel):
    """
    Individual fee payment record.
    """
    __tablename__ = "fee_payments"
    
    # Transaction ID
    transaction_id = Column(String(50), unique=True, nullable=False, index=True)
    receipt_number = Column(String(50), nullable=True)
    
    # Student reference
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    
    # Fee details
    fee_type = Column(Enum(FeeType), nullable=False)
    description = Column(String(500), nullable=True)
    
    # Academic period
    academic_year = Column(String(20), nullable=True)
    semester = Column(Integer, nullable=True)
    
    # Amounts
    total_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    fine_amount = Column(Float, default=0.0)
    
    @property
    def balance_amount(self) -> float:
        return self.total_amount - self.paid_amount - self.discount_amount + self.fine_amount
    
    # Payment details
    payment_method = Column(Enum(PaymentMethod), nullable=True)
    payment_reference = Column(String(100), nullable=True)  # UPI ref, cheque no, etc.
    payment_date = Column(DateTime, nullable=True)
    
    # Due date and status
    due_date = Column(Date, nullable=True)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Extra data
    extra_data = Column(JSONB, default={})
    
    # Relationships
    student = relationship("Student", back_populates="fee_payments")
    
    def __repr__(self):
        return f"<FeePayment {self.transaction_id}: ₹{self.paid_amount}/{self.total_amount}>"


class FeeDiscount(TenantBaseModel):
    """
    Discount/scholarship applied to student fees.
    """
    __tablename__ = "fee_discounts"
    
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    
    # Discount type
    discount_type = Column(String(50), nullable=False)  # percentage, fixed
    discount_value = Column(Float, nullable=False)  # percentage or fixed amount
    
    # Applicability
    fee_types = Column(JSONB, default=[])  # List of applicable fee types
    
    # Validity
    valid_from = Column(Date, nullable=True)
    valid_until = Column(Date, nullable=True)
    
    is_active = Column(Boolean, default=True)
    
    def __repr__(self):
        return f"<FeeDiscount {self.name}: {self.discount_value}>"
