"""
Payment API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID
from datetime import datetime

from app.config.database import get_db
from app.core.middleware.auth import get_current_user
from app.core.permissions import require_permission
from app.models.user import User
from app.models.payment import (
    PaymentGatewayConfig,
    PaymentOrder,
    PaymentTransaction,
    PaymentRefund,
    PaymentNotification,
    PaymentGateway,
    OnlinePaymentStatus,
)
from app.schemas.payment import (
    PaymentGatewayConfigCreate,
    PaymentGatewayConfigUpdate,
    PaymentGatewayConfigResponse,
    CreatePaymentOrderRequest,
    PaymentOrderResponse,
    PaymentOrderDetailResponse,
    PaymentOrderListResponse,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
    PaymentTransactionResponse,
    CreateRefundRequest,
    RefundResponse,
    CheckoutOptionsResponse,
    PaymentStatsResponse,
)
from app.core.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["Payments"])


# ============== Gateway Configuration ==============

@router.get("/gateways", response_model=list)
async def list_gateway_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all payment gateway configurations."""
    result = await db.execute(
        select(PaymentGatewayConfig).where(
            PaymentGatewayConfig.tenant_id == current_user.tenant_id
        )
    )
    configs = result.scalars().all()
    return [PaymentGatewayConfigResponse.model_validate(c) for c in configs]


@router.post("/gateways", response_model=PaymentGatewayConfigResponse, status_code=status.HTTP_201_CREATED)
@require_permission("payments", "update")
async def create_gateway_config(
    request: Request,
    config_data: PaymentGatewayConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or update a payment gateway configuration."""
    # Check if config exists
    existing = await db.execute(
        select(PaymentGatewayConfig).where(
            PaymentGatewayConfig.tenant_id == current_user.tenant_id,
            PaymentGatewayConfig.gateway == PaymentGateway(config_data.gateway.value),
        )
    )
    config = existing.scalar_one_or_none()
    
    if config:
        # Update existing
        for field, value in config_data.model_dump(exclude_unset=True).items():
            if field == "gateway":
                continue
            setattr(config, field, value)
    else:
        # Create new
        config = PaymentGatewayConfig(
            tenant_id=current_user.tenant_id,
            gateway=PaymentGateway(config_data.gateway.value),
            display_name=config_data.display_name,
            api_key=config_data.api_key,
            api_secret=config_data.api_secret,
            webhook_secret=config_data.webhook_secret,
            config=config_data.config,
            is_test_mode=config_data.is_test_mode,
            is_active=config_data.is_active,
            is_default=config_data.is_default,
            supported_methods=config_data.supported_methods,
            convenience_fee_percent=config_data.convenience_fee_percent,
            convenience_fee_fixed=config_data.convenience_fee_fixed,
            pass_fee_to_customer=config_data.pass_fee_to_customer,
        )
        db.add(config)
    
    await db.commit()
    await db.refresh(config)
    
    return PaymentGatewayConfigResponse.model_validate(config)


@router.delete("/gateways/{gateway}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("payments", "delete")
async def delete_gateway_config(
    request: Request,
    gateway: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a payment gateway configuration."""
    result = await db.execute(
        select(PaymentGatewayConfig).where(
            PaymentGatewayConfig.tenant_id == current_user.tenant_id,
            PaymentGatewayConfig.gateway == PaymentGateway(gateway),
        )
    )
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gateway configuration not found",
        )
    
    await db.delete(config)
    await db.commit()


# ============== Payment Orders ==============

@router.post("/orders", response_model=PaymentOrderDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_order(
    order_data: CreatePaymentOrderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new payment order."""
    service = PaymentService(db)
    
    try:
        gateway = PaymentGateway(order_data.gateway.value) if order_data.gateway else None
        
        order = await service.create_payment_order(
            tenant_id=str(current_user.tenant_id),
            amount=order_data.amount,
            currency=order_data.currency,
            purpose=order_data.purpose,
            description=order_data.description,
            fee_payment_id=str(order_data.fee_payment_id) if order_data.fee_payment_id else None,
            student_id=str(order_data.student_id) if order_data.student_id else None,
            payer_name=order_data.payer_name,
            payer_email=order_data.payer_email,
            payer_phone=order_data.payer_phone,
            gateway=gateway,
            notes=order_data.notes,
            payer_id=str(current_user.id),
        )
        
        # Get checkout options
        config = await service.get_gateway_config(str(current_user.tenant_id), order.gateway)
        checkout_options = await service.get_checkout_options(order, config) if config else {}
        
        response = PaymentOrderDetailResponse(
            id=order.id,
            tenant_id=order.tenant_id,
            order_number=order.order_number,
            gateway=order.gateway,
            gateway_order_id=order.gateway_order_id,
            amount=order.amount,
            currency=order.currency,
            convenience_fee=order.convenience_fee,
            total_amount=order.total_amount,
            purpose=order.purpose,
            description=order.description,
            student_id=order.student_id,
            payer_name=order.payer_name,
            payer_email=order.payer_email,
            status=order.status,
            expires_at=order.expires_at,
            created_at=order.created_at,
            gateway_data=checkout_options,
        )
        
        return response
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/orders", response_model=PaymentOrderListResponse)
async def list_payment_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    student_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all payment orders."""
    service = PaymentService(db)
    
    order_status = OnlinePaymentStatus(status) if status else None
    
    orders, total = await service.get_orders(
        tenant_id=str(current_user.tenant_id),
        page=page,
        page_size=page_size,
        status=order_status,
        student_id=str(student_id) if student_id else None,
    )
    
    return PaymentOrderListResponse(
        items=[PaymentOrderResponse.model_validate(o) for o in orders],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/orders/{order_id}", response_model=PaymentOrderDetailResponse)
async def get_payment_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific payment order."""
    result = await db.execute(
        select(PaymentOrder).where(
            PaymentOrder.id == order_id,
            PaymentOrder.tenant_id == current_user.tenant_id,
        )
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    
    service = PaymentService(db)
    config = await service.get_gateway_config(str(current_user.tenant_id), order.gateway)
    checkout_options = await service.get_checkout_options(order, config) if config and order.status == OnlinePaymentStatus.PENDING else {}
    
    return PaymentOrderDetailResponse(
        id=order.id,
        tenant_id=order.tenant_id,
        order_number=order.order_number,
        gateway=order.gateway,
        gateway_order_id=order.gateway_order_id,
        amount=order.amount,
        currency=order.currency,
        convenience_fee=order.convenience_fee,
        total_amount=order.total_amount,
        purpose=order.purpose,
        description=order.description,
        student_id=order.student_id,
        payer_name=order.payer_name,
        payer_email=order.payer_email,
        status=order.status,
        expires_at=order.expires_at,
        created_at=order.created_at,
        gateway_data=checkout_options,
        receipt_url=order.receipt_url,
    )


# ============== Payment Verification ==============

@router.post("/verify", response_model=VerifyPaymentResponse)
async def verify_payment(
    verification: VerifyPaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify a payment after completion."""
    service = PaymentService(db)
    
    # Use Razorpay format if provided, otherwise generic format
    order_id = verification.razorpay_order_id or verification.order_id
    payment_id = verification.razorpay_payment_id or verification.payment_id
    signature = verification.razorpay_signature or verification.signature
    
    if not all([order_id, payment_id, signature]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required verification parameters",
        )
    
    success, transaction, message = await service.verify_payment(
        tenant_id=str(current_user.tenant_id),
        order_id=order_id,
        payment_id=payment_id,
        signature=signature,
    )
    
    # Get order for response — verify it belongs to this tenant
    order_result = await db.execute(
        select(PaymentOrder).where(
            PaymentOrder.gateway_order_id == order_id,
            PaymentOrder.tenant_id == current_user.tenant_id,
        )
    )
    order = order_result.scalar_one_or_none()
    
    return VerifyPaymentResponse(
        success=success,
        order_number=order.order_number if order else "",
        transaction_id=transaction.transaction_id if transaction else None,
        status=transaction.status.value if transaction else "unknown",
        message=message,
        receipt_url=order.receipt_url if order else None,
    )


# ============== Transactions ==============

@router.get("/orders/{order_id}/transactions", response_model=list)
async def get_order_transactions(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all transactions for an order."""
    # First verify order belongs to current user's tenant
    order_check = await db.execute(
        select(PaymentOrder).where(
            PaymentOrder.id == order_id,
            PaymentOrder.tenant_id == current_user.tenant_id
        )
    )
    if not order_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    result = await db.execute(
        select(PaymentTransaction).where(
            PaymentTransaction.order_id == order_id,
        )
    )
    transactions = result.scalars().all()
    return [PaymentTransactionResponse.model_validate(t) for t in transactions]


# ============== Refunds ==============

@router.post("/refunds", response_model=RefundResponse, status_code=status.HTTP_201_CREATED)
async def create_refund(
    refund_data: CreateRefundRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a refund for a transaction."""
    service = PaymentService(db)
    
    try:
        refund = await service.create_refund(
            tenant_id=str(current_user.tenant_id),
            transaction_id=str(refund_data.transaction_id),
            amount=refund_data.amount,
            reason=refund_data.reason,
            initiated_by_id=str(current_user.id),
            notes=refund_data.notes,
        )
        
        return RefundResponse.model_validate(refund)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ============== Webhook ==============

@router.post("/webhook/{gateway}")
async def handle_webhook(
    gateway: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle payment gateway webhook.
    This is a public endpoint - no authentication required.
    """
    try:
        payload = await request.body()
        headers = dict(request.headers)
        
        # Find config by gateway
        gateway_enum = PaymentGateway(gateway)
        
        # Log notification
        notification = PaymentNotification(
            gateway=gateway_enum,
            event_type=headers.get("x-razorpay-event-id", "unknown"),
            payload=await request.json() if payload else {},
            headers=headers,
            signature=headers.get("x-razorpay-signature"),
        )
        db.add(notification)
        await db.commit()
        
        # TODO: Process webhook asynchronously
        # This would typically be done via Celery or similar
        
        return {"status": "received"}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ============== Statistics ==============

@router.get("/stats", response_model=PaymentStatsResponse)
async def get_payment_stats(
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get payment statistics."""
    service = PaymentService(db)
    
    stats = await service.get_stats(
        tenant_id=str(current_user.tenant_id),
        from_date=from_date,
        to_date=to_date,
    )
    
    return PaymentStatsResponse(**stats)


# ============== Checkout Page ==============

@router.get("/checkout/{order_number}")
async def get_checkout_page(
    order_number: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get checkout page data for an order.
    Public endpoint - accessed by payment page.
    """
    result = await db.execute(
        select(PaymentOrder).where(PaymentOrder.order_number == order_number)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    
    if order.status not in [OnlinePaymentStatus.CREATED, OnlinePaymentStatus.PENDING]:
        return {
            "order_number": order.order_number,
            "status": order.status.value,
            "message": "This order has already been processed",
        }
    
    if order.is_expired:
        return {
            "order_number": order.order_number,
            "status": "expired",
            "message": "This order has expired",
        }
    
    # Get checkout options
    service = PaymentService(db)
    config = await service.get_gateway_config(str(order.tenant_id), order.gateway)
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment gateway not configured",
        )
    
    checkout_options = await service.get_checkout_options(order, config)
    
    return {
        "order_number": order.order_number,
        "amount": order.total_amount,
        "currency": order.currency,
        "description": order.description,
        "status": order.status.value,
        "checkout_options": checkout_options,
    }
