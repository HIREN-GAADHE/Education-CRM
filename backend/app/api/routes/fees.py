"""
Fee Payment API Router - CRUD operations for fee payments
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID, uuid4
from datetime import datetime
from pydantic import BaseModel
import math
import logging

from app.config.database import get_db
from app.models import FeePayment, PaymentStatus, Student, Tenant
from app.models.user import User
from app.core.permissions import require_permission
from app.core.middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/fees", tags=["Fees"])


def generate_transaction_id() -> str:
    """Generate unique transaction ID."""
    return f"TXN{datetime.now().strftime('%Y%m%d%H%M%S')}{str(uuid4())[:8].upper()}"


def generate_receipt_number() -> str:
    """Generate receipt number."""
    return f"RCP{datetime.now().strftime('%Y%m%d')}{str(uuid4())[:6].upper()}"


# Pydantic Schemas
class StudentInfo(BaseModel):
    id: UUID
    admission_number: str
    first_name: str
    last_name: str
    course: Optional[str] = None
    
    class Config:
        from_attributes = True


class FeePaymentResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID] = None
    transaction_id: Optional[str] = None
    receipt_number: Optional[str] = None
    student_id: UUID
    fee_type: str
    description: Optional[str] = None
    academic_year: Optional[str] = None
    semester: Optional[int] = None
    total_amount: float
    paid_amount: float
    discount_amount: float
    fine_amount: float
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    payment_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    student: Optional[StudentInfo] = None
    
    class Config:
        from_attributes = True


class FeePaymentListResponse(BaseModel):
    items: List[FeePaymentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class FeePaymentCreate(BaseModel):
    student_id: UUID
    fee_type: str
    description: Optional[str] = None
    academic_year: Optional[str] = None
    semester: Optional[int] = None
    total_amount: float
    due_date: Optional[str] = None
    notes: Optional[str] = None


class FeePaymentUpdate(BaseModel):
    status: Optional[str] = None
    paid_amount: Optional[float] = None
    discount_amount: Optional[float] = None
    fine_amount: Optional[float] = None
    notes: Optional[str] = None


class MakePaymentRequest(BaseModel):
    amount: float
    payment_method: str
    payment_reference: Optional[str] = None
    notes: Optional[str] = None


class FeeSummary(BaseModel):
    total_fees: float
    total_paid: float
    total_pending: float
    total_overdue: float
    total_discounts: float
    payment_count: int


@router.get("", response_model=FeePaymentListResponse)
@require_permission("fees", "read")
async def list_fee_payments(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    student_id: Optional[UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    fee_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all fee payments with pagination and filtering."""
    try:
        # Include student relationship with tenant filter
        query = select(FeePayment).where(
            FeePayment.tenant_id == current_user.tenant_id  # Tenant isolation
        ).options(selectinload(FeePayment.student))
        
        # Apply filters
        if student_id:
            query = query.where(FeePayment.student_id == student_id)
        
        if status_filter:
            query = query.where(FeePayment.status == status_filter)
        
        if fee_type:
            query = query.where(FeePayment.fee_type == fee_type)
        
        # Get total count with tenant filter
        count_query = select(func.count(FeePayment.id)).where(
            FeePayment.tenant_id == current_user.tenant_id
        )
        if student_id:
            count_query = count_query.where(FeePayment.student_id == student_id)
        if status_filter:
            count_query = count_query.where(FeePayment.status == status_filter)
        if fee_type:
            count_query = count_query.where(FeePayment.fee_type == fee_type)
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size).order_by(FeePayment.created_at.desc())
        
        result = await db.execute(query)
        payments = result.scalars().unique().all()
        
        return FeePaymentListResponse(
            items=payments,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total > 0 else 1,
        )
    except Exception as e:
        logger.error(f"Error listing fees: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while fetching fees")


@router.post("", response_model=FeePaymentResponse, status_code=status.HTTP_201_CREATED)
@require_permission("fees", "create")
async def create_fee_payment(
    request: Request,
    payment_data: FeePaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new fee payment record."""
    try:
        # Verify student exists and belongs to same tenant
        student_result = await db.execute(
            select(Student).where(
                Student.id == payment_data.student_id,
                Student.tenant_id == current_user.tenant_id  # Tenant isolation
            )
        )
        student = student_result.scalar_one_or_none()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        
        # Create payment with current user's tenant
        payment = FeePayment(
            student_id=payment_data.student_id,
            fee_type=payment_data.fee_type,
            description=payment_data.description,
            academic_year=payment_data.academic_year,
            semester=payment_data.semester,
            total_amount=payment_data.total_amount,
            notes=payment_data.notes,
            tenant_id=current_user.tenant_id,  # Use authenticated user's tenant
            transaction_id=generate_transaction_id(),
            status=PaymentStatus.PENDING,
            paid_amount=0,
            discount_amount=0,
            fine_amount=0,
        )
        
        db.add(payment)
        await db.commit()
        await db.refresh(payment)
        
        # Reload with student
        result = await db.execute(
            select(FeePayment).options(selectinload(FeePayment.student)).where(FeePayment.id == payment.id)
        )
        payment = result.scalar_one()
        
        return payment
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating fee: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="An error occurred while creating fee")


@router.get("/summary", response_model=FeeSummary)
@require_permission("fees", "read")
async def get_fee_summary(
    request: Request,
    student_id: Optional[UUID] = None,
    academic_year: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get fee summary statistics using database aggregation."""
    # Use database aggregation for better performance
    base_filter = FeePayment.tenant_id == current_user.tenant_id
    
    filters = [base_filter]
    if student_id:
        filters.append(FeePayment.student_id == student_id)
    if academic_year:
        filters.append(FeePayment.academic_year == academic_year)
    
    # Get totals using database aggregation (more efficient)
    totals_query = select(
        func.coalesce(func.sum(FeePayment.total_amount), 0).label('total_fees'),
        func.coalesce(func.sum(FeePayment.paid_amount), 0).label('total_paid'),
        func.coalesce(func.sum(FeePayment.discount_amount), 0).label('total_discounts'),
        func.count(FeePayment.id).label('payment_count')
    ).where(*filters)
    
    result = await db.execute(totals_query)
    row = result.one()
    
    total_fees = float(row.total_fees)
    total_paid = float(row.total_paid)
    total_discounts = float(row.total_discounts)
    total_pending = total_fees - total_paid - total_discounts
    
    # Get overdue amount
    overdue_query = select(
        func.coalesce(func.sum(FeePayment.total_amount - FeePayment.paid_amount - FeePayment.discount_amount), 0)
    ).where(*filters, FeePayment.status == PaymentStatus.OVERDUE)
    
    overdue_result = await db.execute(overdue_query)
    total_overdue = float(overdue_result.scalar() or 0)
    
    return FeeSummary(
        total_fees=total_fees,
        total_paid=total_paid,
        total_pending=total_pending,
        total_overdue=total_overdue,
        total_discounts=total_discounts,
        payment_count=row.payment_count,
    )


@router.get("/{payment_id}", response_model=FeePaymentResponse)
@require_permission("fees", "read")
async def get_fee_payment(
    request: Request,
    payment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single fee payment by ID."""
    result = await db.execute(
        select(FeePayment)
        .where(
            FeePayment.id == payment_id,
            FeePayment.tenant_id == current_user.tenant_id  # Tenant isolation
        )
        .options(selectinload(FeePayment.student))
    )
    payment = result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee payment not found"
        )
    
    return payment


@router.put("/{payment_id}", response_model=FeePaymentResponse)
@require_permission("fees", "update")
async def update_fee_payment(
    request: Request,
    payment_id: UUID,
    payment_data: FeePaymentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a fee payment."""
    result = await db.execute(
        select(FeePayment).where(
            FeePayment.id == payment_id,
            FeePayment.tenant_id == current_user.tenant_id  # Tenant isolation
        )
    )
    payment = result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee payment not found"
        )
    
    # Update fields
    update_data = payment_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(payment, field, value)
    
    await db.commit()
    await db.refresh(payment)
    
    # Reload with student
    result = await db.execute(
        select(FeePayment).options(selectinload(FeePayment.student)).where(FeePayment.id == payment_id)
    )
    payment = result.scalar_one()
    
    return payment


@router.post("/{payment_id}/pay", response_model=FeePaymentResponse)
@require_permission("fees", "update")
async def make_payment(
    request: Request,
    payment_id: UUID,
    payment_request: MakePaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Make a payment against a fee."""
    try:
        result = await db.execute(
            select(FeePayment).where(
                FeePayment.id == payment_id,
                FeePayment.tenant_id == current_user.tenant_id  # Tenant isolation
            )
        )
        payment = result.scalar_one_or_none()
        
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fee payment not found"
            )
        
        # Calculate balance
        balance = payment.total_amount - payment.paid_amount - payment.discount_amount + payment.fine_amount
        
        if payment_request.amount > balance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment amount exceeds balance. Maximum payable: {balance}"
            )
        
        # Update payment
        payment.paid_amount += payment_request.amount
        payment.payment_method = payment_request.payment_method
        payment.payment_reference = payment_request.payment_reference
        payment.payment_date = datetime.utcnow()
        payment.notes = payment_request.notes
        
        # Generate receipt number
        if not payment.receipt_number:
            payment.receipt_number = generate_receipt_number()
        
        # Update status
        new_balance = payment.total_amount - payment.paid_amount - payment.discount_amount + payment.fine_amount
        if new_balance <= 0:
            payment.status = PaymentStatus.COMPLETED
        else:
            payment.status = PaymentStatus.PARTIAL
        
        await db.commit()
        
        # Reload with student
        result = await db.execute(
            select(FeePayment).options(selectinload(FeePayment.student)).where(FeePayment.id == payment_id)
        )
        payment = result.scalar_one()
        
        return payment
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error making payment: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="An error occurred while processing payment")


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("fees", "delete")
async def delete_fee_payment(
    request: Request,
    payment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a fee payment (soft delete for audit trail)."""
    try:
        result = await db.execute(
            select(FeePayment).where(
                FeePayment.id == payment_id,
                FeePayment.tenant_id == current_user.tenant_id  # Tenant isolation
            )
        )
        payment = result.scalar_one_or_none()
        
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fee payment not found"
            )
        
        # Soft delete - keep for audit trail
        payment.is_deleted = True
        payment.deleted_at = datetime.utcnow()
        payment.deleted_by = current_user.id
        await db.commit()
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting fee payment: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="An error occurred while deleting")
