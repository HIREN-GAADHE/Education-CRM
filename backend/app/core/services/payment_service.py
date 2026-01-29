"""
Payment service for Razorpay and Stripe integration.
"""
import logging
import hmac
import hashlib
from typing import Optional, Dict, Any, Tuple, List
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from uuid import UUID
import httpx

from app.config.settings import settings
from app.models.payment import (
    PaymentGatewayConfig,
    PaymentOrder,
    PaymentTransaction,
    PaymentRefund,
    PaymentNotification,
    PaymentGateway,
    OnlinePaymentStatus,
    RefundStatus,
)
from app.models.fee import FeePayment, PaymentStatus
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)


class RazorpayService:
    """
    Razorpay payment gateway integration.
    """
    
    def __init__(self, api_key: str, api_secret: str, is_test: bool = True):
        self.api_key = api_key
        self.api_secret = api_secret
        self.is_test = is_test
        self.base_url = "https://api.razorpay.com/v1"
    
    async def create_order(
        self,
        amount: int,  # Amount in paise (smallest currency unit)
        currency: str = "INR",
        receipt: str = None,
        notes: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """Create a Razorpay order."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/orders",
                json={
                    "amount": amount,
                    "currency": currency,
                    "receipt": receipt,
                    "notes": notes or {},
                },
                auth=(self.api_key, self.api_secret),
            )
            
            if response.status_code != 200:
                logger.error(f"Razorpay order creation failed: {response.text}")
                raise Exception(f"Failed to create Razorpay order: {response.text}")
            
            return response.json()
    
    async def fetch_payment(self, payment_id: str) -> Dict[str, Any]:
        """Fetch payment details from Razorpay."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/payments/{payment_id}",
                auth=(self.api_key, self.api_secret),
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to fetch payment: {response.text}")
            
            return response.json()
    
    async def capture_payment(
        self,
        payment_id: str,
        amount: int,
        currency: str = "INR",
    ) -> Dict[str, Any]:
        """Capture an authorized payment."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/payments/{payment_id}/capture",
                json={
                    "amount": amount,
                    "currency": currency,
                },
                auth=(self.api_key, self.api_secret),
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to capture payment: {response.text}")
            
            return response.json()
    
    async def create_refund(
        self,
        payment_id: str,
        amount: Optional[int] = None,  # If None, full refund
        notes: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """Create a refund for a payment."""
        payload = {"notes": notes or {}}
        if amount:
            payload["amount"] = amount
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/payments/{payment_id}/refund",
                json=payload,
                auth=(self.api_key, self.api_secret),
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to create refund: {response.text}")
            
            return response.json()
    
    def verify_signature(
        self,
        order_id: str,
        payment_id: str,
        signature: str,
    ) -> bool:
        """Verify Razorpay payment signature."""
        message = f"{order_id}|{payment_id}"
        expected_signature = hmac.new(
            self.api_secret.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(expected_signature, signature)
    
    def verify_webhook_signature(
        self,
        payload: str,
        signature: str,
        webhook_secret: str,
    ) -> bool:
        """Verify Razorpay webhook signature."""
        expected_signature = hmac.new(
            webhook_secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(expected_signature, signature)


class PaymentService:
    """
    Main payment service for managing payments.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_gateway_config(
        self,
        tenant_id: str,
        gateway: Optional[PaymentGateway] = None,
    ) -> Optional[PaymentGatewayConfig]:
        """Get payment gateway configuration."""
        query = select(PaymentGatewayConfig).where(
            PaymentGatewayConfig.tenant_id == tenant_id,
            PaymentGatewayConfig.is_active == True,
        )
        
        if gateway:
            query = query.where(PaymentGatewayConfig.gateway == gateway)
        else:
            query = query.where(PaymentGatewayConfig.is_default == True)
        
        result = await self.db.execute(query)
        config = result.scalar_one_or_none()
        
        if not config and not gateway:
            # Fall back to any active config
            query = select(PaymentGatewayConfig).where(
                PaymentGatewayConfig.tenant_id == tenant_id,
                PaymentGatewayConfig.is_active == True,
            ).limit(1)
            result = await self.db.execute(query)
            config = result.scalar_one_or_none()
        
        return config
    
    def _get_gateway_service(
        self,
        config: PaymentGatewayConfig,
    ) -> RazorpayService:
        """Get gateway-specific service."""
        if config.gateway == PaymentGateway.RAZORPAY:
            return RazorpayService(
                api_key=config.api_key,
                api_secret=config.api_secret,
                is_test=config.is_test_mode,
            )
        else:
            raise NotImplementedError(f"Gateway {config.gateway} not implemented")
    
    async def create_payment_order(
        self,
        tenant_id: str,
        amount: float,
        currency: str = "INR",
        purpose: str = "fee_payment",
        description: Optional[str] = None,
        fee_payment_id: Optional[str] = None,
        student_id: Optional[str] = None,
        payer_name: Optional[str] = None,
        payer_email: Optional[str] = None,
        payer_phone: Optional[str] = None,
        gateway: Optional[PaymentGateway] = None,
        notes: Dict[str, Any] = None,
        payer_id: Optional[str] = None,
    ) -> PaymentOrder:
        """
        Create a new payment order.
        """
        # Get gateway config
        config = await self.get_gateway_config(tenant_id, gateway)
        if not config:
            raise ValueError("No active payment gateway configured")
        
        # Calculate convenience fee
        convenience_fee = 0.0
        if config.pass_fee_to_customer:
            convenience_fee = (
                (amount * config.convenience_fee_percent / 100) +
                config.convenience_fee_fixed
            )
        
        total_amount = amount + convenience_fee
        
        # Create order in database
        order_number = PaymentOrder.generate_order_number()
        
        order = PaymentOrder(
            tenant_id=tenant_id,
            order_number=order_number,
            gateway=config.gateway,
            amount=amount,
            currency=currency,
            convenience_fee=convenience_fee,
            total_amount=total_amount,
            purpose=purpose,
            description=description,
            fee_payment_id=fee_payment_id,
            student_id=student_id,
            payer_id=payer_id,
            payer_name=payer_name,
            payer_email=payer_email,
            payer_phone=payer_phone,
            status=OnlinePaymentStatus.CREATED,
            expires_at=datetime.utcnow() + timedelta(hours=24),
            notes=notes or {},
        )
        self.db.add(order)
        await self.db.flush()
        
        # Create order with payment gateway
        gateway_service = self._get_gateway_service(config)
        
        try:
            # Amount in paise (smallest currency unit)
            amount_in_paise = int(total_amount * 100)
            
            gateway_response = await gateway_service.create_order(
                amount=amount_in_paise,
                currency=currency,
                receipt=order_number,
                notes={
                    "order_number": order_number,
                    "tenant_id": tenant_id,
                    "purpose": purpose,
                    **(notes or {}),
                },
            )
            
            order.gateway_order_id = gateway_response.get("id")
            order.gateway_response = gateway_response
            order.status = OnlinePaymentStatus.PENDING
            
        except Exception as e:
            logger.error(f"Failed to create gateway order: {str(e)}")
            order.status = OnlinePaymentStatus.FAILED
            order.gateway_response = {"error": str(e)}
        
        await self.db.commit()
        await self.db.refresh(order)
        
        return order
    
    async def verify_payment(
        self,
        tenant_id: str,
        order_id: str,
        payment_id: str,
        signature: str,
    ) -> Tuple[bool, PaymentTransaction, str]:
        """
        Verify payment signature and update status.
        Returns (success, transaction, message)
        """
        # Get order
        result = await self.db.execute(
            select(PaymentOrder).where(
                PaymentOrder.gateway_order_id == order_id,
            )
        )
        order = result.scalar_one_or_none()
        
        if not order:
            return False, None, "Order not found"
        
        # Get gateway config
        config = await self.get_gateway_config(str(order.tenant_id), order.gateway)
        if not config:
            return False, None, "Gateway not configured"
        
        gateway_service = self._get_gateway_service(config)
        
        # Verify signature
        is_valid = gateway_service.verify_signature(order_id, payment_id, signature)
        
        # Create transaction record
        transaction = PaymentTransaction(
            tenant_id=str(order.tenant_id),
            order_id=order.id,
            transaction_id=PaymentTransaction.generate_transaction_id(),
            gateway_transaction_id=payment_id,
            gateway_payment_id=payment_id,
            amount=order.total_amount,
            currency=order.currency,
            signature=signature,
            signature_verified=is_valid,
        )
        
        if is_valid:
            # Fetch payment details from gateway
            try:
                payment_details = await gateway_service.fetch_payment(payment_id)
                
                transaction.payment_method = payment_details.get("method")
                transaction.gateway_response = payment_details
                
                if payment_details.get("status") == "captured":
                    transaction.status = OnlinePaymentStatus.CAPTURED
                    transaction.captured_at = datetime.utcnow()
                    order.status = OnlinePaymentStatus.CAPTURED
                    
                    # Update fee payment if linked
                    if order.fee_payment_id:
                        fee_result = await self.db.execute(
                            select(FeePayment).where(FeePayment.id == order.fee_payment_id)
                        )
                        fee_payment = fee_result.scalar_one_or_none()
                        if fee_payment:
                            fee_payment.status = PaymentStatus.COMPLETED
                            fee_payment.transaction_id = transaction.transaction_id
                            fee_payment.paid_at = datetime.utcnow()
                    
                elif payment_details.get("status") == "authorized":
                    transaction.status = OnlinePaymentStatus.AUTHORIZED
                    transaction.authorized_at = datetime.utcnow()
                    order.status = OnlinePaymentStatus.AUTHORIZED
                else:
                    transaction.status = OnlinePaymentStatus.FAILED
                    transaction.failed_at = datetime.utcnow()
                    order.status = OnlinePaymentStatus.FAILED
                    
            except Exception as e:
                logger.error(f"Failed to fetch payment details: {str(e)}")
                transaction.error_message = str(e)
                transaction.status = OnlinePaymentStatus.FAILED
                transaction.failed_at = datetime.utcnow()
                
        else:
            transaction.status = OnlinePaymentStatus.FAILED
            transaction.failed_at = datetime.utcnow()
            transaction.error_message = "Signature verification failed"
            order.status = OnlinePaymentStatus.FAILED
        
        self.db.add(transaction)
        await self.db.commit()
        await self.db.refresh(transaction)
        
        message = "Payment successful" if is_valid and transaction.status == OnlinePaymentStatus.CAPTURED else "Payment verification failed"
        
        return is_valid and transaction.status == OnlinePaymentStatus.CAPTURED, transaction, message
    
    async def create_refund(
        self,
        tenant_id: str,
        transaction_id: str,
        amount: Optional[float] = None,
        reason: Optional[str] = None,
        initiated_by_id: Optional[str] = None,
        notes: Dict[str, Any] = None,
    ) -> PaymentRefund:
        """Create a refund for a transaction."""
        # Get transaction
        result = await self.db.execute(
            select(PaymentTransaction).where(
                PaymentTransaction.id == transaction_id,
            )
        )
        transaction = result.scalar_one_or_none()
        
        if not transaction:
            raise ValueError("Transaction not found")
        
        if transaction.status != OnlinePaymentStatus.CAPTURED:
            raise ValueError("Can only refund captured payments")
        
        # Get order
        order_result = await self.db.execute(
            select(PaymentOrder).where(PaymentOrder.id == transaction.order_id)
        )
        order = order_result.scalar_one_or_none()
        
        # Determine refund amount
        refund_amount = amount or transaction.amount
        
        # Get gateway config
        config = await self.get_gateway_config(tenant_id, order.gateway)
        if not config:
            raise ValueError("Gateway not configured")
        
        # Create refund record
        refund = PaymentRefund(
            tenant_id=tenant_id,
            transaction_id=transaction.id,
            refund_id=PaymentRefund.generate_refund_id(),
            amount=refund_amount,
            reason=reason,
            status=RefundStatus.PENDING,
            initiated_by_id=initiated_by_id,
            notes=notes or {},
        )
        self.db.add(refund)
        await self.db.flush()
        
        # Process refund with gateway
        gateway_service = self._get_gateway_service(config)
        
        try:
            amount_in_paise = int(refund_amount * 100) if amount else None
            
            gateway_response = await gateway_service.create_refund(
                payment_id=transaction.gateway_payment_id,
                amount=amount_in_paise,
                notes=notes or {},
            )
            
            refund.gateway_refund_id = gateway_response.get("id")
            refund.gateway_response = gateway_response
            refund.status = RefundStatus.COMPLETED
            refund.processed_at = datetime.utcnow()
            
            # Update transaction status
            if refund_amount >= transaction.amount:
                transaction.status = OnlinePaymentStatus.REFUNDED
                order.status = OnlinePaymentStatus.REFUNDED
            else:
                transaction.status = OnlinePaymentStatus.PARTIALLY_REFUNDED
                order.status = OnlinePaymentStatus.PARTIALLY_REFUNDED
            
        except Exception as e:
            logger.error(f"Failed to create refund: {str(e)}")
            refund.status = RefundStatus.FAILED
            refund.gateway_response = {"error": str(e)}
        
        await self.db.commit()
        await self.db.refresh(refund)
        
        return refund
    
    async def get_checkout_options(
        self,
        order: PaymentOrder,
        config: PaymentGatewayConfig,
    ) -> Dict[str, Any]:
        """Get checkout options for frontend SDK."""
        # Get tenant info
        tenant_result = await self.db.execute(
            select(Tenant).where(Tenant.id == order.tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        
        options = {
            "gateway": config.gateway.value,
            "key": config.api_key,
            "order_id": order.gateway_order_id,
            "amount": int(order.total_amount * 100),  # In paise
            "currency": order.currency,
            "name": tenant.name if tenant else "EduERP",
            "description": order.description or f"Payment for {order.purpose}",
            "prefill": {
                "name": order.payer_name or "",
                "email": order.payer_email or "",
                "contact": order.payer_phone or "",
            },
            "notes": {
                "order_number": order.order_number,
                **order.notes,
            },
            "theme": {
                "color": "#1976D2",
            },
            "methods": {
                "card": "card" in config.supported_methods,
                "upi": "upi" in config.supported_methods,
                "netbanking": "netbanking" in config.supported_methods,
                "wallet": "wallet" in config.supported_methods,
            },
        }
        
        return options
    
    async def get_orders(
        self,
        tenant_id: str,
        page: int = 1,
        page_size: int = 20,
        status: Optional[OnlinePaymentStatus] = None,
        student_id: Optional[str] = None,
    ) -> Tuple[List[PaymentOrder], int]:
        """Get payment orders with filters."""
        query = select(PaymentOrder).where(PaymentOrder.tenant_id == tenant_id)
        count_query = select(func.count(PaymentOrder.id)).where(PaymentOrder.tenant_id == tenant_id)
        
        if status:
            query = query.where(PaymentOrder.status == status)
            count_query = count_query.where(PaymentOrder.status == status)
        
        if student_id:
            query = query.where(PaymentOrder.student_id == student_id)
            count_query = count_query.where(PaymentOrder.student_id == student_id)
        
        # Get total
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()
        
        # Paginate
        query = query.order_by(PaymentOrder.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        orders = list(result.scalars().all())
        
        return orders, total
    
    async def get_stats(
        self,
        tenant_id: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Get payment statistics."""
        conditions = [PaymentOrder.tenant_id == tenant_id]
        
        if from_date:
            conditions.append(PaymentOrder.created_at >= from_date)
        if to_date:
            conditions.append(PaymentOrder.created_at <= to_date)
        
        # Total collected
        collected_query = select(func.sum(PaymentOrder.total_amount)).where(
            and_(*conditions, PaymentOrder.status == OnlinePaymentStatus.CAPTURED)
        )
        collected_result = await self.db.execute(collected_query)
        total_collected = collected_result.scalar() or 0
        
        # Total pending
        pending_query = select(func.sum(PaymentOrder.total_amount)).where(
            and_(*conditions, PaymentOrder.status.in_([
                OnlinePaymentStatus.CREATED,
                OnlinePaymentStatus.PENDING,
                OnlinePaymentStatus.AUTHORIZED,
            ]))
        )
        pending_result = await self.db.execute(pending_query)
        total_pending = pending_result.scalar() or 0
        
        # By status
        status_query = select(
            PaymentOrder.status,
            func.count(PaymentOrder.id)
        ).where(and_(*conditions)).group_by(PaymentOrder.status)
        
        status_result = await self.db.execute(status_query)
        by_status = {row[0].value: row[1] for row in status_result}
        
        total_transactions = sum(by_status.values())
        successful = by_status.get("captured", 0)
        failed = by_status.get("failed", 0)
        
        return {
            "total_collected": total_collected,
            "total_pending": total_pending,
            "total_refunded": 0,  # Would calculate from refunds table
            "total_transactions": total_transactions,
            "successful_transactions": successful,
            "failed_transactions": failed,
            "success_rate": (successful / total_transactions * 100) if total_transactions > 0 else 0,
            "by_status": by_status,
            "by_method": {},
        }
